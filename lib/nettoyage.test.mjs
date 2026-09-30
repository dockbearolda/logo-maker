/* LE NETTOYAGE IA (lib/nettoyage.js), sans le modèle : les tuiles se
   recollent sans couture, l'opacité suit, l'avancement se dit. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { entreeTuile, nettoyerParTuiles, agrandir, raffermir, fidele, orienter, redresser, enOrientations, aireTuiles, recaler, ORIENTATIONS } from './nettoyage.js'

/* Un « modèle » qui agrandit au plus proche : ce que les tuiles recollées
   doivent rendre, pixel pour pixel, sans couture. */
const auPlusProche = f => async (e, l, h) => {
  const L = l * f, H = h * f, n = l * h, N = L * H
  const s = new Float32Array(3 * N)
  for (let c = 0; c < 3; c++) for (let y = 0; y < H; y++) for (let x = 0; x < L; x++) s[c * N + y * L + x] = e[c * n + Math.floor(y / f) * l + Math.floor(x / f)]
  return s
}

test('les tuiles se recollent sans couture, l\'opacité suit', async () => {
  const l = 37, h = 23
  const rgba = new Uint8ClampedArray(l * h * 4)
  for (let p = 0; p < l * h; p++) rgba.set([p * 7 % 256, p * 13 % 256, p * 29 % 256, p % 5 ? 255 : 128], p * 4)
  const parts = []
  const r = await nettoyerParTuiles(rgba, l, h, auPlusProche(2), p => parts.push(p), { tuile: 10, marge: 3, facteur: 2 })
  assert.equal(r.largeur, 74)
  assert.equal(r.hauteur, 46)
  /* Quatre colonnes, trois rangées de tuiles, deux passes (couleur, opacité). */
  assert.equal(parts.length, 24)
  assert.equal(parts.at(-1), 1)
  for (let y = 0; y < 46; y++) for (let x = 0; x < 74; x++) {
    const i = ((y >> 1) * l + (x >> 1)) * 4, o = (y * 74 + x) * 4
    const a = rgba[i + 3] / 255
    for (let c = 0; c < 3; c++) assert.ok(Math.abs(r.data[o + c] - (rgba[i + c] * a + 255 * (1 - a))) <= 1, 'x ' + x + ' y ' + y)
    assert.equal(r.data[o + 3], rgba[i + 3])
  }
})

test('hors de l\'image, le bord se prolonge ; une image opaque ne fait qu\'une passe', async () => {
  const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255])
  const e = entreeTuile(rgba, 2, 1, -1, 0, 4, 1)
  assert.deepEqual([...e.subarray(0, 4)], [1, 1, 0, 0])
  assert.deepEqual([...e.subarray(8, 12)], [0, 0, 1, 1])
  const parts = []
  await nettoyerParTuiles(rgba, 2, 1, auPlusProche(4), p => parts.push(p))
  assert.deepEqual(parts, [1])
})

/* Une lettre de 8 × 8 : un trait vertical noir de 2 pixels sur blanc. */
const trait = () => {
  const d = new Uint8ClampedArray(8 * 8 * 4).fill(255)
  for (let y = 0; y < 8; y++) for (const x of [3, 4]) d.set([0, 0, 0, 255], (y * 8 + x) * 4)
  return d
}
const gris = (d, L, x, y) => d[(y * L + x) * 4]

test('agrandir : le bord reste à sa place, en douceur', () => {
  const a = agrandir(trait(), 8, 8, 32, 32)
  /* Le trait couvre x = 12 à 19 : noir au milieu, blanc loin, le bord à
     mi-chemin juste là où il était. */
  assert.ok(gris(a, 32, 15, 10) < 10)
  assert.ok(gris(a, 32, 4, 10) > 245)
  assert.ok(Math.abs(gris(a, 32, 11, 10) - 128) < 70)
})

test('raffermir : le bord devient franc, au même endroit', () => {
  const r = raffermir(agrandir(trait(), 8, 8, 32, 32), 32, 32)
  for (let x = 0; x < 32; x++) {
    const v = gris(r, 32, x, 16)
    if (x >= 13 && x <= 18) assert.ok(v < 20, 'dedans ' + x + ' : ' + v)
    if (x <= 10 || x >= 21) assert.ok(v > 235, 'dehors ' + x + ' : ' + v)
  }
})

test('agrandir, bande par bande : les mêmes lignes que d\'un coup', () => {
  const tout = agrandir(trait(), 8, 8, 32, 32)
  const bande = agrandir(trait(), 8, 8, 32, 32, 10, 19)
  assert.deepEqual(bande, tout.subarray(10 * 32 * 4, 19 * 32 * 4))
})

/* Le dessin net d'un bord vertical à la colonne fine `X` : blanc à gauche,
   noir à droite. */
const bordNet = (L, H, X) => {
  const d = new Uint8ClampedArray(L * H * 4).fill(255)
  for (let y = 0; y < H; y++) for (let x = X; x < L; x++) d.set([0, 0, 0, 255], (y * L + x) * 4)
  return d
}

test('fidele : un bord flou du fichier, affûté par le modèle, passe tel quel', () => {
  /* Le fichier : un bord étalé sur trois pixels, centré entre x = 3 et 4. */
  const rampe = [255, 255, 235, 175, 80, 20, 0, 0]
  const src = new Uint8ClampedArray(8 * 8 * 4)
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) src.set([rampe[x], rampe[x], rampe[x], 255], (y * 8 + x) * 4)
  const ia = bordNet(32, 32, 16)
  assert.deepEqual(fidele(new Uint8ClampedArray(ia), 32, 32, src, 8, 8), ia)
})

test('fidele : une lettre réinventée ne passe pas, le fichier reste', () => {
  const src = trait()
  /* Le modèle a bien fait le trait (x = 12 à 19)… et bouché le blanc à
     droite en bas (un « l » devenu « b »). */
  const ia = new Uint8ClampedArray(32 * 32 * 4).fill(255)
  for (let y = 0; y < 32; y++) for (let x = 12; x < 20; x++) ia.set([0, 0, 0, 255], (y * 32 + x) * 4)
  for (let y = 16; y < 32; y++) for (let x = 20; x < 28; x++) ia.set([0, 0, 0, 255], (y * 32 + x) * 4)
  const f = fidele(ia, 32, 32, src, 8, 8)
  assert.ok(gris(f, 32, 24, 26) > 235, 'le blanc revient : ' + gris(f, 32, 24, 26))
  assert.ok(gris(f, 32, 15, 26) < 20)
  /* Loin de là, le dessin du modèle n'a pas bougé. */
  assert.equal(gris(f, 32, 15, 2), 0)
  assert.equal(gris(f, 32, 30, 2), 255)
})

test('fidele : bande par bande, le même dessin', () => {
  const src = trait()
  const ia = new Uint8ClampedArray(32 * 32 * 4).fill(255)
  for (let y = 0; y < 32; y++) for (let x = 12; x < 20; x++) ia.set([0, 0, 0, 255], (y * 32 + x) * 4)
  for (let y = 16; y < 32; y++) for (let x = 20; x < 28; x++) ia.set([0, 0, 0, 255], (y * 32 + x) * 4)
  assert.deepEqual(fidele(new Uint8ClampedArray(ia), 32, 32, src, 8, 8, { bande: 5 }), fidele(new Uint8ClampedArray(ia), 32, 32, src, 8, 8))
})

test('fidele : un fichier plus grand que ce qu\'a vu le modèle sert de juge', () => {
  /* Le modèle a vu 8 × 8 et rendu 32 × 32 ; le fichier en faisait 16 × 16 :
     c'est contre lui que le dessin se juge (rapport non entier compris). */
  const src = new Uint8ClampedArray(16 * 16 * 4).fill(255)
  for (let y = 0; y < 16; y++) for (const x of [6, 7, 8, 9]) src.set([0, 0, 0, 255], (y * 16 + x) * 4)
  const ia = new Uint8ClampedArray(32 * 32 * 4).fill(255)
  for (let y = 0; y < 32; y++) for (let x = 12; x < 20; x++) ia.set([0, 0, 0, 255], (y * 32 + x) * 4)
  assert.deepEqual(fidele(new Uint8ClampedArray(ia), 32, 32, src, 16, 16), ia)
  const src12 = new Uint8ClampedArray(12 * 12 * 4).fill(255)
  for (let y = 0; y < 12; y++) for (const x of [5, 6]) src12.set([0, 0, 0, 255], (y * 12 + x) * 4)
  const f = fidele(new Uint8ClampedArray(ia), 32, 32, src12, 12, 12)
  assert.equal(f.length, ia.length)
})

/* L'ULTRA (30 septembre 2026) : chaque tuile passe retournée, pivotée ;
   remis droits, les dessins retombent exactement l'un sur l'autre. */
test('orienter puis redresser : chaque orientation revient à sa place', async () => {
  const l = 5, h = 3, e = new Float32Array(3 * l * h).map((_, i) => i)
  assert.deepEqual([...ORIENTATIONS].sort(), [0, 1, 2, 3, 4, 5, 6, 7])
  for (const k of ORIENTATIONS) {
    const o = orienter(e, l, h, k)
    assert.equal(o.l * o.h, l * h)
    assert.equal(o.l, k & 4 ? h : l)
    /* Un « modèle » qui agrandit au plus proche : remis droit, le même
       dessin que la tuile droite agrandie. */
    const s = await auPlusProche(2)(o.e, o.l, o.h)
    assert.deepEqual([...redresser(s, 2 * l, 2 * h, k)], [...await auPlusProche(2)(e, l, h)], 'k ' + k)
  }
  /* Le demi-tour : le premier pixel devient le dernier. */
  assert.equal(orienter(e, l, h, 3).e[l * h - 1], e[0])
})

test('enOrientations : un modèle fidèle rend le même dessin, un modèle qui penche est moyenné', async () => {
  const rgba = new Uint8ClampedArray(9 * 7 * 4)
  for (let p = 0; p < 63; p++) rgba.set([p * 37 % 256, p * 11 % 256, p * 53 % 256, 255], p * 4)
  const droit = await nettoyerParTuiles(rgba, 9, 7, auPlusProche(4), () => {}, { tuile: 4, marge: 2 })
  const huit = await nettoyerParTuiles(rgba, 9, 7, enOrientations(auPlusProche(4)), () => {}, { tuile: 4, marge: 2 })
  assert.deepEqual(huit.data, droit.data)
  /* Un modèle qui assombrit toujours le pixel en haut à gauche de ce qu'il
     voit : dans les huit orientations, ce n'est jamais le même coin — le
     défaut se dilue. */
  const penche = async (e, l, h) => { const s = Float32Array.from(e); s[0] = s[l * h] = s[2 * l * h] = 0; return auPlusProche(1)(s, l, h) }
  const blanc = new Float32Array(3 * 16).fill(1)
  const un = await enOrientations(penche, [0], 1)(blanc, 4, 4)
  const tous = await enOrientations(penche, ORIENTATIONS, 1)(blanc, 4, 4)
  assert.equal(un[0], 0)
  assert.equal(tous[0], 0.75, 'deux orientations sur huit ont ce coin en haut à gauche')
  assert.equal(tous[5], 1)
})

test('aireTuiles : chaque tuile compte avec ses marges', () => {
  assert.equal(aireTuiles(10, 10, { tuile: 10, marge: 2 }), 14 * 14)
  /* Deux colonnes (10 et 3), une rangée. */
  assert.equal(aireTuiles(13, 10, { tuile: 10, marge: 2 }), 14 * 14 + 7 * 14)
})

test('recaler : un dessin éclairci revient aux teintes du fichier, ses bords nets gardés', () => {
  /* Le fichier : un fond crème, un carré presque noir. Le dessin ×4 : le
     même, net, mais éclairci (le fond à 255, le noir à 40). */
  const l = 16, src = new Uint8ClampedArray(l * l * 4)
  for (let y = 0; y < l; y++) for (let x = 0; x < l; x++) {
    const dedans = x >= 5 && x < 11 && y >= 5 && y < 11
    src.set(dedans ? [28, 27, 32, 255] : [246, 242, 239, 255], (y * l + x) * 4)
  }
  const L = 64, ia = new Uint8ClampedArray(L * L * 4)
  for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
    const dedans = x >= 20 && x < 44 && y >= 20 && y < 44
    ia.set(dedans ? [40, 39, 44, 255] : [255, 251, 248, 255], (y * L + x) * 4)
  }
  recaler(ia, L, L, src, l, l)
  const px = (x, y) => [...ia.subarray((y * L + x) * 4, (y * L + x) * 4 + 3)]
  px(2, 2).forEach((v, c) => assert.ok(Math.abs(v - [246, 242, 239][c]) <= 1, 'le fond : ' + px(2, 2)))
  px(32, 32).forEach((v, c) => assert.ok(Math.abs(v - [28, 27, 32][c]) <= 1, 'le carré : ' + px(32, 32)))
  /* Le bord reste où il était, franc. */
  assert.ok(px(19, 32)[0] > 200 && px(20, 32)[0] < 60)
})

test('recaler : sans aplat, rien ne bouge', () => {
  /* Un damier d'un pixel : aucun voisinage uni. */
  const l = 8, src = new Uint8ClampedArray(l * l * 4)
  for (let p = 0; p < l * l; p++) src.set((p % l + (p / l | 0)) % 2 ? [0, 0, 0, 255] : [255, 255, 255, 255], p * 4)
  const ia = new Uint8ClampedArray(32 * 32 * 4).fill(200)
  assert.deepEqual(recaler(new Uint8ClampedArray(ia), 32, 32, src, l, l), ia)
})

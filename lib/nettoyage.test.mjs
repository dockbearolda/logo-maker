/* LE NETTOYAGE IA (lib/nettoyage.js), sans le modèle : les tuiles se
   recollent sans couture, l'opacité suit, l'avancement se dit. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { entreeTuile, nettoyerParTuiles, agrandir, raffermir, fidele } from './nettoyage.js'

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

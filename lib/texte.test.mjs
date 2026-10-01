import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Font, Glyph, Path } from '../vendor/opentype.min.mjs'
import { binariser, lignesImage, poseLigne, zonesDe, poserZone, tailleLecture, margeEffacement, grasPx, GRAS_MAX } from './texte.js'
import { polygones, remplir, lettresLues, glyphesDe, cadreLigne, noter } from './polices.js'
import { vectoriserLisse } from './vecteur-lisse.js'
import { lireSvg } from './pdf-vectoriel.js'

/* UNE POLICE EN BÂTONS (comme lib/polices.test.mjs) : 700 de capitale. */
function police(e = 110) {
  const rect = (p, x0, y0, x1, y1) => { p.moveTo(x0, y0); p.lineTo(x1, y0); p.lineTo(x1, y1); p.lineTo(x0, y1); p.close() }
  const dessins = {
    I: p => rect(p, 50, 0, 50 + e, 700),
    L: p => { rect(p, 50, 0, 50 + e, 700); rect(p, 50, 0, 450, e) },
    T: p => { rect(p, 250 - e / 2, 0, 250 + e / 2, 700); rect(p, 50, 700 - e, 450, 700) },
    E: p => { rect(p, 50, 0, 50 + e, 700); rect(p, 50, 0, 430, e); rect(p, 50, 350 - e / 2, 350, 350 + e / 2); rect(p, 50, 700 - e, 430, 700) },
    H: p => { rect(p, 50, 0, 50 + e, 700); rect(p, 470 - e, 0, 470, 700); rect(p, 50, 350 - e / 2, 470, 350 + e / 2) },
  }
  const glyphes = [new Glyph({ name: '.notdef', advanceWidth: 500, path: new Path() })]
  for (const [c, d] of Object.entries(dessins)) {
    const p = new Path()
    d(p)
    glyphes.push(new Glyph({ name: c, unicode: c.charCodeAt(0), advanceWidth: 560, path: p }))
  }
  const f = new Font({ familyName: 'Essai', styleName: 'Regular', unitsPerEm: 1000, ascender: 800, descender: -200, glyphs: glyphes })
  glyphes.forEach((g, i) => { g.index = i })
  return f
}
const P = police()

/* UNE IMAGE RVBA, `fond` partout (null : transparent). */
function image(l, h, fond = [255, 255, 255]) {
  const d = new Uint8ClampedArray(l * h * 4)
  if (fond) for (let p = 0; p < l * h; p++) d.set([...fond, 255], p * 4)
  return { data: d, largeur: l, hauteur: h }
}
/* Un texte peint dans l'image, anticrénelé (seize sous-pixels), à
   `taille` pixels de capitale ; rend le cadre de chaque lettre. */
function ecrire(img, texte, { x = 20, base = 80, taille = 40, couleur = [20, 40, 90], ecart = 1.3 } = {}) {
  const s = taille / 700, SS = 4, cadres = []
  for (const c of texte) {
    if (c === ' ') { x += 300 * s; continue }
    const gl = P.charToGlyph(c)
    const polys = polygones(gl.getPath(x, base, s * 1000).commands)
    const l = Math.ceil(560 * s) + 2, h = taille + 2, x0 = Math.floor(x), y0 = Math.floor(base - taille) - 1
    const m = remplir(polys.map(p => p.map(([u, v]) => [(u - x0) * SS, (v - y0) * SS])), 0, 0, l * SS, h * SS)
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < l; xx++) {
        let k = 0
        for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) k += m[(yy * SS + j) * l * SS + xx * SS + i]
        if (!k) continue
        const a = k / (SS * SS), q = ((y0 + yy) * img.largeur + x0 + xx) * 4, da = img.data[q + 3] / 255, oa = a + da * (1 - a)
        for (let ch = 0; ch < 3; ch++) img.data[q + ch] = (couleur[ch] * a + img.data[q + ch] * da * (1 - a)) / oa
        img.data[q + 3] = 255 * oa
      }
    }
    cadres.push([x, base - taille])
    x += 560 * s * ecart
  }
  return cadres
}

test('l\'encre : le bord à mi-chemin, et le cœur d\'un trait épais reste de l\'encre', () => {
  const W = 200, H = 100
  const lum = new Uint8Array(W * H).fill(250)
  for (let y = 20; y < 80; y++) for (let x = 20; x < 30; x++) lum[y * W + x] = 20
  for (let y = 10; y < 90; y++) for (let x = 60; x < 180; x++) lum[y * W + x] = 30
  const e = binariser(lum, W, H, 4)
  assert.equal(e[50 * W + 25], 1)
  assert.equal(e[50 * W + 40], 0)
  /* Le cœur d'un aplat de 120 × 80 : aucun voisinage proche n'y voit de
     bord, un plus grand, si. */
  assert.equal(e[50 * W + 120], 1)
  assert.equal(e[5 * W + 5], 0)
})

test('les lignes d\'une image : un texte foncé sur un sticker blanc d\'un PNG transparent, un texte clair sur un aplat foncé', () => {
  const img = image(900, 400, null)
  /* Le sticker blanc, et son texte. */
  for (let y = 20; y < 180; y++) for (let x = 20; x < 880; x++) img.data.set([255, 255, 255, 255], (y * 900 + x) * 4)
  ecrire(img, 'HELLE TILT', { x: 60, base: 120, taille: 40 })
  /* Un bandeau foncé, et son texte blanc. */
  for (let y = 230; y < 380; y++) for (let x = 20; x < 880; x++) img.data.set([30, 60, 40, 255], (y * 900 + x) * 4)
  ecrire(img, 'TITLE', { x: 80, base: 330, taille: 40, couleur: [250, 250, 250] })
  const t = lignesImage(img.data, img.largeur, img.hauteur)
  /* Une ligne refaite d'une chaîne de lettres, rivale d'une autre, attend
     la lecture qui les départage (lib/detourage-travail.js). */
  const lignes = t.lignes.filter(l => !(l.chaine && l.rivales)).map(l => ({ n: l.length, polarite: l.polarite, entiere: l.entiere, y: cadreLigne(l)[1] / t.f }))
  const foncee = lignes.find(l => l.polarite === 0 && l.y > 60 && l.y < 100)
  const claire = lignes.find(l => l.polarite === 1 && l.y > 270 && l.y < 310)
  assert.ok(foncee && foncee.n === 9 && foncee.entiere, JSON.stringify(lignes))
  assert.ok(claire && claire.n === 5 && claire.entiere, JSON.stringify(lignes))
  /* Pas de ligne faite des jours des lettres. */
  assert.equal(lignes.filter(l => l.n >= 3).length, 2, JSON.stringify(lignes))
})

test('une lettre collée à un dessin : la ligne n\'est pas entière', () => {
  const img = image(700, 200)
  ecrire(img, 'HELLE', { x: 120, base: 120, taille: 40 })
  /* Un grand dessin foncé qui touche le premier H. */
  for (let y = 60; y < 190; y++) for (let x = 20; x < 125; x++) img.data.set([20, 40, 90, 255], (y * 700 + x) * 4)
  const t = lignesImage(img.data, img.largeur, img.hauteur)
  const l = t.lignes.find(l => l.length >= 3)
  assert.ok(l)
  assert.equal(l.length, 4)
  assert.equal(l.entiere, false)
})

test('des lettres collées se coupent entre les cadres des caractères lus', () => {
  const W = 200
  const forme = (x0, x1, y0 = 10, y1 = 40) => {
    const pixels = []
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) pixels.push(y * W + x)
    return { x0, x1, y0, y1, pixels: Int32Array.from(pixels), formes: [] }
  }
  /* « TIE » : T et I d'un seul tenant, puis E. */
  const ligne = [forme(10, 49), forme(60, 80)]
  const hm = 31, f = 40 / hm, m = Math.round(0.5 * hm)
  const sym = (c, a, b) => ({ c, x0: (a - 10 + m) * f, x1: (b - 10 + m) * f })
  const lues = lettresLues(ligne, ['T', 'I', 'E'], [sym('T', 10, 28), sym('I', 32, 50), sym('E', 60, 81)], W)
  assert.deepEqual(lues.map(l => [l.c, l.x0, l.x1]), [['T', 10, 29], ['I', 30, 49], ['E', 60, 80]])
  /* Les caractères lus doivent être ceux du texte. */
  assert.equal(lettresLues(ligne, ['T', 'I'], [sym('T', 10, 28), sym('I', 32, 50)], W), null)
  /* glyphesDe s'en sert quand les formes ne se comptent pas. */
  assert.equal(glyphesDe(ligne, 'TIE', W), null)
  assert.equal(glyphesDe(ligne, 'TIE', W, [sym('T', 10, 28), sym('I', 32, 50), sym('E', 60, 81)]).length, 3)
})

test('le Détouré repeint : les lettres d\'origine partent, celles de la police se peignent, le reste ne bouge pas', () => {
  const img = image(600, 200, null)
  for (let y = 10; y < 190; y++) for (let x = 10; x < 590; x++) img.data.set([255, 255, 255, 255], (y * 600 + x) * 4)
  /* Des lettres d'origine un peu plus grasses que la police. */
  const avant = Uint8ClampedArray.from(img.data)
  ecrire(img, 'HELLE', { x: 60, base: 130, taille: 60, couleur: [20, 40, 90] })
  const t = lignesImage(img.data, img.largeur, img.hauteur)
  const ligne = t.lignes.find(l => l.length === 5)
  assert.ok(ligne)
  const pose = poseLigne(ligne, t.W, t.f, { texte: 'HELLE', police: P })
  assert.ok(pose && pose.lettres.length === 5)
  const zones = zonesDe([pose], t.f, img.largeur, img.hauteur)
  assert.equal(zones.length, 1)
  const z = zones[0]
  const data = new Uint8ClampedArray(z.l * z.h * 4)
  for (let y = 0; y < z.h; y++) data.set(img.data.subarray(((z.y + y) * 600 + z.x) * 4, ((z.y + y) * 600 + z.x + z.l) * 4), y * z.l * 4)
  poserZone({ x: z.x, y: z.y, l: z.l, h: z.h, data }, [pose], { f: t.f, W: t.W, encres: t.encres })
  const px = (x, y) => [...data.subarray(((y - z.y) * z.l + x - z.x) * 4, ((y - z.y) * z.l + x - z.x) * 4 + 4)]
  /* Le fût du H, plein, de la couleur de la lettre ; entre deux lettres,
     le blanc du sticker. */
  const h = pose.lettres[0]
  const ys = h.commandes.filter(c => c.y !== undefined).map(c => c.y), xs = h.commandes.filter(c => c.x !== undefined).map(c => c.x)
  const cx = Math.round(Math.min(...xs) + 4), cy = Math.round((Math.min(...ys) + Math.max(...ys)) / 2)
  px(cx, cy).forEach((v, i) => assert.ok(Math.abs(v - [20, 40, 90, 255][i]) <= 3, px(cx, cy).join(',')))
  const ex = Math.round(Math.max(...xs) + 6)
  assert.deepEqual(px(ex, cy), [255, 255, 255, 255])
  /* Au bord de la zone (hors des lettres et de leur marge), rien n'a bougé. */
  assert.ok(margeEffacement(t.f) >= 2)
  for (const [x, y] of [[z.x, z.y], [z.x + z.l - 1, z.y + z.h - 1]]) assert.deepEqual(px(x, y), [...avant.subarray((y * 600 + x) * 4, (y * 600 + x) * 4 + 4)])
})

test('le gras autour d\'une ligne : ses lettres s\'épaississent, dans le Détouré comme dans le vecteur', () => {
  const img = image(600, 200)
  ecrire(img, 'HELLE', { x: 60, base: 130, taille: 60, couleur: [20, 40, 90] })
  const t = lignesImage(img.data, img.largeur, img.hauteur)
  const ligne = t.lignes.find(l => l.length === 5)
  /* Le curseur à fond : 6 % de la hauteur des lettres, tout autour. */
  assert.ok(Math.abs(grasPx(100, ligne.hauteur, t.f) - GRAS_MAX * ligne.hauteur / t.f) < 1e-9)
  assert.equal(grasPx(0, ligne.hauteur, t.f), 0)
  assert.equal(grasPx(250, 10, 1), grasPx(100, 10, 1))
  const g = grasPx(100, ligne.hauteur, t.f)
  assert.ok(g > 3 && g < 4.5, 'environ 3,6 pixels pour une capitale de 60 : ' + g)
  const fine = poseLigne(ligne, t.W, t.f, { texte: 'HELLE', police: P })
  const grasse = poseLigne(ligne, t.W, t.f, { texte: 'HELLE', police: P, gras: g })
  /* Le fût du I de chaque lettre : plus large de 2 × g ; le cadre suit. */
  const largeur = l => { const xs = polygones(l.commandes).flat().map(([x]) => x); return Math.max(...xs) - Math.min(...xs) }
  assert.ok(Math.abs(largeur(grasse.lettres[0]) - largeur(fine.lettres[0]) - 2 * g) < 0.01)
  /* Le cadre (ce qui se repeint) tient les lettres épaissies. */
  const xs = grasse.lettres.flatMap(l => polygones(l.commandes).flat().map(([x]) => x))
  assert.ok(grasse.cadre[0] <= Math.min(...xs) && grasse.cadre[2] >= Math.max(...xs))
  assert.ok(grasse.cadre[0] <= fine.cadre[0] && grasse.cadre[2] >= fine.cadre[2])
  /* Le vecteur : les lettres de la police au nombre d'enroulements — deux
     lettres épaissies qui se touchent se fondent. */
  const v = vectoriserLisse(img.data, img.largeur, img.hauteur, { fonds: [[255, 255, 255]], texte: { f: t.f, W: t.W }, remplacements: [grasse] })
  assert.match(v.lettres, /fill-rule="nonzero"/)
  assert.ok(v.couches.some(c => c.aplat && c.nonzero))
})

test('la taille de lecture : 2 000 à 3 200 pixels de grand côté', () => {
  assert.equal(tailleLecture(1000, 500).W, 2000)
  assert.equal(tailleLecture(5000, 2500).W, 3200)
  assert.equal(tailleLecture(2500, 1000).f, 1)
})

test('le vecteur reprend les lettres posées : la police à la place du tracé, de la couleur de la ligne', () => {
  const img = image(600, 200)
  ecrire(img, 'HELLE', { x: 60, base: 130, taille: 60, couleur: [20, 40, 90] })
  const t = lignesImage(img.data, img.largeur, img.hauteur)
  const ligne = t.lignes.find(l => l.length === 5)
  const pose = poseLigne(ligne, t.W, t.f, { texte: 'HELLE', police: P })
  const v = vectoriserLisse(img.data, img.largeur, img.hauteur, { fonds: [[255, 255, 255]], texte: { f: t.f, W: t.W }, remplacements: [pose] })
  const lettres = lireSvg(v.svg.replace(/<path[\s\S]*<\/svg>$/, v.lettres + '</svg>')).formes
  assert.equal(lettres.length, 1, 'une forme par couleur')
  /* La couleur des lettres d'origine, pas une autre teinte du tracé. */
  lettres[0].couleur.forEach((c, i) => assert.ok(Math.abs(c - [20, 40, 90][i]) <= 12, lettres[0].couleur.join(',')))
  assert.ok(v.couches.some(c => c.aplat), 'la version image les peint d\'un aplat')
  assert.ok(v.efface && v.efface.masque.some(Boolean), 'et sait ce qu\'elles ont effacé')
  /* Sans lettres posées : rien de tout ça. */
  const brut = vectoriserLisse(img.data, img.largeur, img.hauteur, { fonds: [[255, 255, 255]] })
  assert.equal(brut.lettres, '')
})

test('un dessin d\'une autre couleur posé tout contre : la ligne s\'en coupe et reste entière', () => {
  const img = image(800, 200)
  /* Deux « lettres » vertes (le dessin, à la hauteur du texte), collées
     presque au texte bleu marine. */
  for (let y = 70; y < 130; y++) for (let x = 20; x < 50; x++) img.data.set([40, 150, 60, 255], (y * 800 + x) * 4)
  for (let y = 75; y < 130; y++) for (let x = 56; x < 84; x++) img.data.set([40, 150, 60, 255], (y * 800 + x) * 4)
  ecrire(img, 'HELLE', { x: 90, base: 130, taille: 60, couleur: [20, 40, 90] })
  const t = lignesImage(img.data, img.largeur, img.hauteur)
  const l = t.lignes.find(l => l.length >= 5)
  assert.ok(l, t.lignes.map(l => l.length).join(','))
  assert.equal(l.length, 5, 'les formes vertes n\'en sont plus')
  assert.equal(l.entiere, true)
})

/* Un texte peint le long d'un arc (centre `cx`, `cy`, rayon `r` jusqu'au
   pied des lettres), chaque lettre tournée avec lui, de `a0` à `a1`
   (radians depuis le haut). */
function ecrireArc(img, texte, { cx, cy, r, a0, a1, taille = 60, couleur = [20, 40, 90] }) {
  const s = taille / 700, SS = 4, n = texte.length
  for (let i = 0; i < n; i++) {
    const a = a0 + (a1 - a0) * i / (n - 1)
    const px = cx + r * Math.sin(a), py = cy - r * Math.cos(a)
    const gl = P.charToGlyph(texte[i])
    /* La lettre posée pied au centre (0, 0), puis tournée et placée. */
    const polys = polygones(gl.getPath(-280 * s, 0, s * 1000).commands).map(p => p.map(([u, v]) => [px + u * Math.cos(a) - v * Math.sin(a), py + u * Math.sin(a) + v * Math.cos(a)]))
    const xs = polys.flat().map(p => p[0]), ys = polys.flat().map(p => p[1])
    const x0 = Math.floor(Math.min(...xs)) - 1, y0 = Math.floor(Math.min(...ys)) - 1, l = Math.ceil(Math.max(...xs)) + 2 - x0, h = Math.ceil(Math.max(...ys)) + 2 - y0
    const m = remplir(polys.map(p => p.map(([u, v]) => [(u - x0) * SS, (v - y0) * SS])), 0, 0, l * SS, h * SS)
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < l; xx++) {
        let k = 0
        for (let j = 0; j < SS; j++) for (let q = 0; q < SS; q++) k += m[(yy * SS + j) * l * SS + xx * SS + q]
        if (!k) continue
        const al = k / (SS * SS), o = ((y0 + yy) * img.largeur + x0 + xx) * 4
        for (let ch = 0; ch < 3; ch++) img.data[o + ch] = couleur[ch] * al + img.data[o + ch] * (1 - al)
      }
    }
  }
}

test('un texte en arc se trouve, se redresse, et sa police se pose le long de l\'arc', () => {
  const img = image(1400, 900)
  ecrireArc(img, 'TITLE', { cx: 700, cy: 800, r: 500, a0: -0.25, a1: 0.25, taille: 70 })
  /* Une ligne droite dessous, qui reste une ligne droite. */
  ecrire(img, 'HELLE', { x: 560, base: 700, taille: 40 })
  const t = lignesImage(img.data, img.largeur, img.hauteur)
  const courbe = t.lignes.find(l => l.courbe)
  assert.ok(courbe, t.lignes.map(l => l.length).join())
  assert.equal(courbe.length, 5)
  assert.ok(courbe.entiere)
  assert.ok(courbe.courbe.alpha > 0.8, 'tournée : ' + courbe.courbe.alpha)
  const droite = t.lignes.find(l => !l.courbe && l.length === 5)
  assert.ok(droite && droite.entiere)
  /* Redressée, la police s'y reconnaît aussi bien que sur une ligne droite. */
  const glyphes = glyphesDe(courbe, 'TITLE', courbe.courbe.W)
  assert.ok(glyphes && noter(glyphes, P).note > 0.85, 'note ' + (glyphes && noter(glyphes, P).note))
  /* Posée, chaque lettre revient sur la sienne : rendue dans l'image, elle
     recouvre la lettre d'origine. */
  const pose = poseLigne(courbe, t.W, t.f, { texte: 'TITLE', police: P })
  assert.equal(pose.lettres.length, 5)
  for (const [i, le] of pose.lettres.entries()) {
    const m = remplir(polygones(le.commandes), 0, 0, img.largeur, img.hauteur)
    const orig = new Set()
    for (const p of le.pixels) { const x = p % t.W, y = (p - x) / t.W; orig.add(Math.floor((y + 0.5) / t.f) * img.largeur + Math.floor((x + 0.5) / t.f)) }
    let inter = 0, n = 0
    for (let q = 0; q < m.length; q++) if (m[q]) { n++; if (orig.has(q)) inter++ }
    const iou = inter / (n + orig.size - inter)
    assert.ok(iou > 0.75, 'lettre ' + i + ' : ' + iou.toFixed(2))
  }
})

test('une ombre portée se voit ; un fond uni, un cerne, non', async () => {
  const { ombrePortee } = await import('./texte.js')
  const { lab } = await import('./lab.js')
  /* Trois lettres en blocs (noires), 40 px de haut, sur une image de 300 × 120
     lue telle quelle (f = 1). */
  const W = 300, H = 120
  const faire = (fond, autour) => {
    const data = new Uint8ClampedArray(W * H * 4)
    for (let p = 0; p < W * H; p++) data.set(fond, p * 4)
    const lettres = [40, 120, 200].map(x0 => {
      const pixels = []
      for (let y = 40; y < 80; y++) for (let x = x0; x < x0 + 30; x++) pixels.push(y * W + x)
      return { pixels, x0, x1: x0 + 29, y0: 40, y1: 79 }
    })
    autour(data, lettres)
    for (const l of lettres) for (const p of l.pixels) data.set([0, 0, 0, 255], p * 4)
    const ligne = Object.assign(lettres, { couleur: lab([0, 0, 0]), hauteur: 40 })
    return ombrePortee(ligne, W, H, { data, largeur: W, hauteur: H, f: 1 })
  }
  const peindre = (data, x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < W && y < H) data.set(c, (y * W + x) * 4) }
  /* L'ombre : les mêmes blocs décalés de 6 px en bas à droite, turquoise pâle. */
  assert.equal(faire([255, 255, 255, 255], (d, ls) => ls.forEach(l => peindre(d, l.x0 + 6, l.y0 + 6, l.x1 + 6, l.y1 + 6, [150, 220, 210, 255]))), true)
  /* Un texte sur un badge bleu : une seule teinte autour. */
  assert.equal(faire([20, 60, 160, 255], () => {}), false)
  /* Un cerne de 4 px tout autour (rouge), du blanc au-delà. */
  assert.equal(faire([255, 255, 255, 255], (d, ls) => ls.forEach(l => peindre(d, l.x0 - 4, l.y0 - 4, l.x1 + 4, l.y1 + 4, [200, 30, 30, 255]))), false)
})

test('une ombre collée aux lettres (une seule forme pour la lecture) se voit aussi', async () => {
  const { ombrePortee } = await import('./texte.js')
  const { lab } = await import('./lab.js')
  const W = 300, H = 120
  const data = new Uint8ClampedArray(W * H * 4)
  const lettres = [40, 120, 200].map(x0 => {
    const pixels = []
    /* La lettre (noire) et son ombre collée (turquoise), décalée de 8 px. */
    for (let y = 40; y < 88; y++) for (let x = x0; x < x0 + 38; x++) {
      const lettre = x < x0 + 30 && y < 80, ombre = x >= x0 + 8 && y >= 48
      if (!lettre && !ombre) continue
      pixels.push(y * W + x)
      data.set(lettre ? [0, 0, 0, 255] : [150, 220, 210, 255], (y * W + x) * 4)
    }
    return { pixels, x0, x1: x0 + 37, y0: 40, y1: 87 }
  })
  const ligne = Object.assign(lettres, { couleur: lab([0, 0, 0]), hauteur: 48 })
  assert.equal(ombrePortee(ligne, W, H, { data, largeur: W, hauteur: H, f: 1 }), true)
})

test('un dessin posé à côté du texte n\'est pas une ombre', async () => {
  const { ombrePortee } = await import('./texte.js')
  const { lab } = await import('./lab.js')
  const W = 300, H = 120
  const data = new Uint8ClampedArray(W * H * 4).fill(255)
  const lettres = [40, 100, 160].map(x0 => {
    const pixels = []
    for (let y = 40; y < 80; y++) for (let x = x0; x < x0 + 30; x++) { pixels.push(y * W + x); data.set([0, 0, 0, 255], (y * W + x) * 4) }
    return { pixels, x0, x1: x0 + 29, y0: 40, y1: 79 }
  })
  /* Un rond rouge à droite, tout contre la dernière lettre. */
  for (let y = 30; y < 90; y++) for (let x = 195; x < 255; x++) if (Math.hypot(x - 225, y - 60) < 28) data.set([220, 30, 30, 255], (y * W + x) * 4)
  const ligne = Object.assign(lettres, { couleur: lab([0, 0, 0]), hauteur: 40 })
  assert.equal(ombrePortee(ligne, W, H, { data, largeur: W, hauteur: H, f: 1 }), false)
})

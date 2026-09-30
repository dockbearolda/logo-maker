import { test } from 'node:test'
import assert from 'node:assert/strict'
import { vectoriserLisse, contours, aire, pointes, jours } from './vecteur-lisse.js'
import { estOmbre } from './vectoriser.js'
import { lireSvg } from './pdf-vectoriel.js'

/* Un anneau rouge sur un fond transparent, bords anticrénelés. */
function anneau(n = 200) {
  const d = new Uint8ClampedArray(n * n * 4)
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const r = Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2)
    const a = Math.max(0, Math.min(1, 80 - r + 0.5)) * Math.max(0, Math.min(1, r - 40 + 0.5))
    d.set([200, 30, 60, Math.round(a * 255)], (y * n + x) * 4)
  }
  return d
}

test('le contour passe au demi-pixel, en boucles fermées', () => {
  const n = 40, carte = new Float32Array(n * n)
  for (let y = 10; y < 30; y++) for (let x = 10; x < 30; x++) carte[y * n + x] = 1
  const b = contours(carte, n, n)
  assert.equal(b.length, 1)
  assert.ok(Math.abs(Math.abs(aire(b[0])) - 20 * 20) < 25, 'aire ' + aire(b[0]))
})

test('un anneau devient un rond lisse, avec son trou', () => {
  const v = vectoriserLisse(anneau(), 200, 200)
  assert.equal(v.formes, 2, 'le bord et le trou')
  assert.deepEqual(v.couleurs, [[200, 30, 60]])
  assert.ok(/fill-rule="evenodd"/.test(v.svg))
  const { formes } = lireSvg(v.svg)
  assert.equal(formes.length, 1)
  /* Des courbes, peu nombreuses : pas de marches. */
  const courbes = (formes[0].d.match(/C/g) || []).length
  assert.ok(courbes >= 2 && courbes <= 24, courbes + ' courbes')
  /* Chaque point d'arrivée tombe sur le vrai cercle (80 ou 40 px). */
  for (const m of formes[0].d.matchAll(/C[^C]*?(-?[\d.]+) (-?[\d.]+)(?=C|Z|M)/g)) {
    const r = Math.hypot(Number(m[1]) - 100, Number(m[2]) - 100)
    assert.ok(Math.abs(r - 80) < 1 || Math.abs(r - 40) < 1, 'rayon ' + r)
  }
  assert.deepEqual(v.cadre, { x: 20, y: 20, largeur: 160, hauteur: 160 })
})

test('un carré garde ses quatre pointes', () => {
  const pts = []
  for (let i = 0; i < 40; i++) pts.push([i, 0])
  for (let i = 0; i < 40; i++) pts.push([40, i])
  for (let i = 0; i < 40; i++) pts.push([40 - i, 40])
  for (let i = 0; i < 40; i++) pts.push([0, 40 - i])
  assert.deepEqual(pointes(pts), [0, 40, 80, 120])
})

test('l\'ombre portée est le fond assombri, pas une teinte du logo', () => {
  const fond = [152, 205, 219]
  assert.ok(estOmbre([94, 138, 149], [fond]))
  assert.ok(estOmbre([118, 168, 182], [fond]))
  assert.ok(!estOmbre([251, 252, 252], [fond]))
  assert.ok(!estOmbre([200, 30, 60], [fond]))
})

test('sur un fond blanc, un gris ou un vert sauge est une teinte du logo, jamais une ombre', () => {
  /* « LA PISCINE » en vert sauge, « DIB » en gris : ils partaient avec le fond. */
  assert.ok(!estOmbre([149, 171, 153], [[254, 254, 254]]))
  assert.ok(!estOmbre([128, 128, 128], [[255, 255, 255]]))
  assert.ok(!estOmbre([200, 200, 200], [[20, 20, 20]]))
  /* Un bleu marine sur un fond bleu ciel : du dessin, pas l'ombre du fond. */
  assert.ok(!estOmbre([40, 60, 70], [[152, 205, 219]]))
})

test('rien de dessiné : rien à vectoriser', () => {
  const v = vectoriserLisse(new Uint8ClampedArray(20 * 20 * 4), 20, 20)
  assert.equal(v.formes, 0)
})

test('les nuances d\'un doré n\'en font qu\'une ; un noir et un blanc restent deux', async () => {
  const { memeFamille } = await import('./vecteur-lisse.js')
  assert.ok(memeFamille([188, 142, 62], [149, 114, 52]))
  assert.ok(memeFamille([252, 252, 252], [215, 218, 220]))
  assert.ok(!memeFamille([20, 20, 20], [250, 250, 250]))
  assert.ok(!memeFamille([200, 30, 60], [30, 60, 200]))
})

test('un filet pâle est remonté, une grande forme ne bouge pas', async () => {
  const { renforcer } = await import('./vecteur-lisse.js')
  const n = 20, c = new Float32Array(n * n)
  for (let y = 0; y < n; y++) { c[y * n + 5] = 0.4; for (let x = 12; x < n; x++) c[y * n + x] = 1 }
  c[10 * n + 11] = 0.5
  const r = renforcer(c, n, n, 2)
  assert.ok(r[3 * n + 5] > 0.55, 'le filet : ' + r[3 * n + 5])
  assert.equal(r[3 * n + 1], 0)
  assert.equal(r[10 * n + 11], 0.5, 'le bord d\'une grande forme reste où il est')
  /* Une trace (un sommet sous le seuil donné) ne devient pas un filet. */
  const t = new Float32Array(n * n)
  for (let y = 0; y < n; y++) t[y * n + 5] = 0.15
  assert.equal(renforcer(t, n, n, 2, 0.25)[3 * n + 5], Math.fround(0.15))
  assert.ok(renforcer(t, n, n, 2)[3 * n + 5] > 0.55)
})

test('une plage à demi couverte n\'est pas un filet : un anneau d\'or sombre ne se fend pas', async () => {
  const { renforcer, flou } = await import('./vecteur-lisse.js')
  /* À gauche un filet d'un pixel, que le flou éteint ; à droite une plage
     au quart (le vide d'un doré sombre, lu aux trois quarts doré). */
  const n = 40, avant = new Float32Array(n * n)
  for (let y = 0; y < n; y++) { avant[y * n + 5] = 1; for (let x = 15; x < 35; x++) avant[y * n + x] = 0.25 }
  const B = flou(avant, n, n, 1.6)
  const r = renforcer(B, n, n, 5, 0.05, avant)
  assert.ok(r[20 * n + 5] > 0.55, 'le filet remonte : ' + r[20 * n + 5])
  assert.equal(r[20 * n + 25], B[20 * n + 25], 'la plage garde sa valeur')
})

test('un dégradé se reconnaît, un aplat non', async () => {
  const { estDegrade } = await import('./vecteur-lisse.js')
  const n = 100, plat = new Uint8ClampedArray(n * n * 4), degrade = new Uint8ClampedArray(n * n * 4)
  for (let p = 0; p < n * n; p++) {
    plat.set([200, 30, 60, 255], p * 4)
    degrade.set([240 - (p % n), 80 + (p % n), 40, 255], p * 4)
  }
  assert.equal(estDegrade(plat, [[200, 30, 60]]), false)
  assert.equal(estDegrade(degrade, [[190, 130, 40]]), true)
})

test('dans le contour, l\'image devient pleine : le bord prend la couleur du logo', async () => {
  const { remplir } = await import('./vecteur-lisse.js')
  const d = new Uint8ClampedArray(3 * 1 * 4)
  d.set([200, 160, 60, 255, 90, 70, 30, 120, 0, 0, 0, 0])
  const r = remplir(d, 3, 1, [[200, 160, 60]], [[0, 0, 0]])
  assert.deepEqual([...r], [200, 160, 60, 255, 200, 160, 60, 255, 200, 160, 60, 255])
})

test('le contour devient un chemin de découpe PDF', async () => {
  const { decoupePdf } = await import('./pdf-vectoriel.js')
  const svg = '<svg width="10" height="10" viewBox="0 0 10 10"><path fill="rgb(0,0,0)" d="M0 0L10 0L10 10Z"/></svg>'
  assert.match(decoupePdf(svg, 10, 10), /0 10 m\n10 10 l\n10 0 l\nh\nW\* n$/)
})

test('un angle arrondi par le flou redevient vif', async () => {
  const { aiguiser, pointes, flou } = await import('./vecteur-lisse.js')
  const n = 200, c = new Float32Array(n * n)
  for (let y = 51; y < 150; y++) for (let x = 51; x < 150; x++) c[y * n + x] = 1
  const b = contours(flou(c, n, n, 3.8), n, n, 0.5)[0]
  const v = aiguiser(b, pointes(b, 50, 10), 10)
  assert.equal(v.coins.length, 4)
  for (const i of v.coins) {
    const [x, y] = v.pts[i]
    assert.ok(Math.min(Math.abs(x - 51), Math.abs(x - 150)) < 1 && Math.min(Math.abs(y - 51), Math.abs(y - 150)) < 1, x + ',' + y)
  }
})

test('le plus grand du voisinage, vite et juste', async () => {
  const { maxLocal } = await import('./vecteur-lisse.js')
  for (const [w, h, r] of [[37, 23, 3], [10, 10, 7], [9, 31, 4]]) {
    const c = Float32Array.from({ length: w * h }, (_, i) => (i * 7919 % 101) / 100)
    const m = maxLocal(c, w, h, r)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let v = 0
      for (let yy = Math.max(0, y - r); yy <= Math.min(h - 1, y + r); yy++) for (let xx = Math.max(0, x - r); xx <= Math.min(w - 1, x + r); xx++) v = Math.max(v, c[yy * w + xx])
      assert.equal(m[y * w + x], v)
    }
  }
})

test('« Extérieur seulement » : un dégradé qui pâlit vers le blanc n\'est pas percé', async () => {
  /* Un disque orange dont le centre pâlit jusqu'au blanc (un reflet), sur
     du blanc ; le détourage l'a gardé entier, opaque. */
  const n = 160, source = new Uint8ClampedArray(n * n * 4), detoure = new Uint8ClampedArray(n * n * 4)
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = (y * n + x) * 4, d = Math.hypot(x - 80, y - 80)
    const blanc = Math.max(0, 1 - d / 40)
    const c = d < 60 ? [230, 90, 50].map(v => Math.round(v + (255 - v) * blanc)) : [255, 255, 255]
    source.set([...c, 255], i)
    detoure.set([...c, d < 60 ? 255 : 0], i)
  }
  const plein = vectoriserLisse(detoure, n, n, { fonds: [[255, 255, 255]], source, alpha: true, mono: true, trouer: false })
  const perce = vectoriserLisse(detoure, n, n, { fonds: [[255, 255, 255]], source, alpha: true, mono: true, trouer: true })
  const { formes: fp } = lireSvg(plein.svg), { formes: ft } = lireSvg(perce.svg)
  assert.equal((fp[0].d.match(/M/g) || []).length, 1, 'un seul contour : pas de trou')
  assert.ok((ft[0].d.match(/M/g) || []).length >= 2, '« Intérieur du logo aussi » : le blanc du centre part')
})

/* 27 septembre 2026, « quand je choisis une de nos couleurs, ça ne
   fonctionne pas du tout » : en une couleur, le blanc enfermé dans le foncé
   reste un jour, le blanc posé sur le vide reste du dessin. */
test('les jours : un clair enfermé dans le foncé, pas un clair qui borde le vide', () => {
  const l = 60, h = 20, clair = new Float32Array(l * h), fonce = new Float32Array(l * h)
  for (let y = 2; y < 18; y++) for (let x = 2; x < 26; x++) fonce[y * l + x] = 1
  for (let y = 7; y < 13; y++) for (let x = 8; x < 20; x++) { clair[y * l + x] = 1; fonce[y * l + x] = 0 }
  for (let y = 7; y < 13; y++) for (let x = 38; x < 54; x++) clair[y * l + x] = 1
  const j = jours(clair, fonce, l, h)
  assert.equal(j[10 * l + 14], 1, 'le blanc dans le disque est un jour')
  assert.equal(j[10 * l + 45], 0, 'le blanc sur le vide est du dessin')
})

test('en une couleur, un texte blanc à côté du logo reste ; le blanc enfermé reste un jour', () => {
  /* Un disque noir percé d'une barre blanche, et une barre blanche seule,
     sur du transparent. */
  const l = 200, h = 120, d = new Uint8ClampedArray(l * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) {
    const dansDisque = Math.hypot(x - 60, y - 60) < 45
    const barreDedans = x >= 42 && x < 78 && y >= 54 && y < 66
    const barreSeule = x >= 130 && x < 190 && y >= 48 && y < 72
    const c = barreSeule || (dansDisque && barreDedans) ? [255, 255, 255, 255] : dansDisque ? [20, 20, 20, 255] : [0, 0, 0, 0]
    d.set(c, (y * l + x) * 4)
  }
  const v = vectoriserLisse(d, l, h, { alpha: true, mono: 'fonce' })
  assert.ok(v.cadre.x + v.cadre.largeur > 185, 'la barre seule est dans le dessin : ' + JSON.stringify(v.cadre))
  assert.equal((lireSvg(v.svg).formes[0].d.match(/M/g) || []).length, 3, 'le disque, son jour, la barre seule')
})

/* 27 septembre 2026, « le résultat pendant la vectorisation est parfait,
   l'intérieur des lettres, les couleurs, mais une fois terminé… » : le
   blanc entre le O noir et sa pastille jaune virait au gris-bleu, un
   reflet de l'aile tournait à la tache. Dans le contour, le dedans du
   logo garde les couleurs du fichier ; seul le bord, teinté de fond, se
   reprend. */
test('dans le contour, le dedans garde ses couleurs : un blanc enfermé reste blanc', async () => {
  const { remplir } = await import('./vecteur-lisse.js')
  const n = 11, d = new Uint8ClampedArray(n * n * 4)
  for (let y = 1; y < 10; y++) for (let x = 1; x < 10; x++) {
    const blanc = x >= 4 && x <= 6 && y >= 4 && y <= 6
    d.set(blanc ? [255, 255, 255, 255] : [230, 90, 50, 255], (y * n + x) * 4)
  }
  const r = remplir(d, n, n, [[230, 90, 50]], [[255, 255, 255]])
  assert.deepEqual([...r.slice((5 * n + 5) * 4, (5 * n + 5) * 4 + 4)], [255, 255, 255, 255])
  assert.deepEqual([...r.slice((5 * n + 3) * 4, (5 * n + 3) * 4 + 4)], [230, 90, 50, 255])
})

test('au bord du vide, un pixel teinté de fond prend la couleur du logo', async () => {
  const { remplir } = await import('./vecteur-lisse.js')
  const d = new Uint8ClampedArray(4 * 1 * 4)
  d.set([230, 90, 50, 255, 230, 90, 50, 255, 240, 200, 190, 255, 0, 0, 0, 0])
  const r = remplir(d, 4, 1, [[230, 90, 50]], [[255, 255, 255]])
  assert.deepEqual([...r.slice(8, 12)], [230, 90, 50, 255])
})

/* Un PNG déjà transparent (ChatGPT, Canva) : ses pixels vides valent
   0, 0, 0, 0 — un noir invisible, pas la couleur d'un fond. Lu comme un
   fond noir, il se confondait avec un texte noir, et le tracé rongeait
   chaque lettre de trois pixels (« I'M HIS FAVORITE EX », 27 septembre). */
test('le fond d\'un PNG transparent n\'a pas de couleur', async () => {
  const { fondsLus } = await import('./vecteur-lisse.js')
  const src = new Uint8ClampedArray(100 * 4)
  assert.deepEqual(fondsLus(src, new Uint8ClampedArray(100 * 4)), [])
})

test('un texte noir sur un PNG transparent garde son épaisseur', () => {
  const n = 400, d = new Uint8ClampedArray(n * n * 4)
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const a = Math.max(0, Math.min(1, 60.5 - Math.hypot(x + 0.5 - 200, y + 0.5 - 200)))
    if (a) d.set([0, 0, 0, Math.round(a * 255)], (y * n + x) * 4)
  }
  const v = vectoriserLisse(d, n, n, { source: d, alpha: true, coteTravail: n, trouer: false })
  assert.ok(Math.abs(v.cadre.largeur - 121) <= 2, 'largeur ' + v.cadre.largeur)
})

/* Des filets dorés qui brillent sur un grand disque noir (27 septembre
   2026) : le noir, à plat, faisait passer tout le logo pour des aplats —
   le reflet du doré sortait en taches blanches. Le dégradé se juge aussi
   hors de la teinte qui domine. */
test('un filet doré dégradé sur un grand aplat noir reste un dégradé', async () => {
  const { estDegrade } = await import('./vecteur-lisse.js')
  const n = 100, d = new Uint8ClampedArray(n * n * 4)
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const filet = y >= 45 && y < 55
    d.set(filet ? [190 + (x >> 1), 170 + (x >> 1), 120 + x, 255] : [8, 8, 8, 255], (y * n + x) * 4)
  }
  assert.equal(estDegrade(d, [[8, 8, 8], [215, 195, 170]]), true)
  const net = new Uint8ClampedArray(d)
  for (let y = 45; y < 55; y++) for (let x = 0; x < n; x++) net.set([200, 30, 60, 255], (y * n + x) * 4)
  assert.equal(estDegrade(net, [[8, 8, 8], [200, 30, 60]]), false)
})

test('un aplat, une teinte : la panse rouge d\'un R ne se partage plus entre deux tons, et garde son rouge', async () => {
  const { aplatsUnis } = await import('./vecteur-lisse.js')
  /* Deux teintes (le rouge sombre et l'orange d'un phénix) ; à gauche un
     aplat rouge vif, que les couvertures partagent pixel à pixel entre
     elles ; à droite un dégradé, qui doit garder ses tons. */
  const l = 40, h = 20, n = l * h
  const rvb = new Uint8ClampedArray(n * 4)
  const teintes = [[201, 42, 50], [232, 122, 67]]
  const cartes = teintes.map(() => new Float32Array(n))
  for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) {
    const p = y * l + x
    if (x < 20) { rvb.set([229, 57, 53, 255], p * 4); cartes[(x + y) % 2][p] = 1 }
    else { const t = (x - 20) / 19; rvb.set([201 + 31 * t, 42 + 80 * t, 50 + 17 * t, 255], p * 4); cartes[t < 0.5 ? 0 : 1][p] = 1 }
  }
  aplatsUnis(cartes, teintes, rvb, l, h, { aireTeinte: 50 })
  assert.equal(teintes.length, 3, 'une teinte exacte de plus')
  assert.deepEqual(teintes[2], [229, 57, 53])
  for (const p of [0, 5 * l + 7, 19 * l + 19]) assert.equal(cartes[2][p], 1, 'l\'aplat est à sa teinte')
  assert.equal(cartes[0][10 * l + 21], 1, 'le dégradé garde son ton sombre')
  assert.equal(cartes[1][10 * l + 38], 1, 'et son ton clair')
})

test('un ton relié en douceur rejoint son dégradé ; une couleur voisine au bord net reste la sienne', async () => {
  const { nuancesGroupees } = await import('./vecteur-lisse.js')
  /* Le rouge sombre d'un phénix qui monte en douceur vers un rouge vif,
     et, à côté, un aplat orange au bord franc. */
  const pal = [[232, 122, 67], [201, 42, 50], [228, 60, 55]]
  const l = 60, h = 20, data = new Uint8ClampedArray(l * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) {
    const t = Math.min(1, Math.max(0, (x - 10) / 20))
    const c = x >= 40 ? pal[0] : [201 + 27 * t, 42 + 18 * t, 50 + 5 * t]
    data.set([...c, 255], (y * l + x) * 4)
  }
  const { teintes, groupe } = nuancesGroupees(data, pal, 1, l)
  assert.equal(groupe[2], groupe[1], 'le rouge vif va au rouge')
  assert.notEqual(groupe[0], groupe[1])
  assert.equal(teintes.length, 2)
  /* Sans l'image, deux rouges distincts pour l'œil restent deux. */
  assert.equal(nuancesGroupees(data, pal).teintes.length, 3)
})

test('le vert sauge et le vert du texte, le rose et le pêche restent distincts', async () => {
  const { nuancesGroupees, memeFamille } = await import('./vecteur-lisse.js')
  const pal = [[174, 196, 177], [118, 142, 124], [249, 185, 181], [253, 209, 168]]
  /* Quatre aplats séparés par du blanc. */
  const l = 90, h = 10, data = new Uint8ClampedArray(l * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) data.set([...(x % 22 < 18 ? pal[Math.floor(x / 22) % 4] : [255, 255, 255]), 255], (y * l + x) * 4)
  assert.equal(nuancesGroupees(data, pal, 1, l).teintes.length, 4)
  assert.ok(memeFamille([188, 142, 62], [149, 114, 52]), 'deux ors voisins sont de la même famille')
})

test('les tons votent avant leur fusion ; un point sans vote prend le vote voisin', async () => {
  const { voisinageTons } = await import('./vecteur-lisse.js')
  /* Trois teintes ; une bande d'un ton loin de la moyenne de sa teinte (à
     plus de 24 niveaux) mais tout près d'un ton qui s'y est fondu. */
  const l = 30, h = 10, n = l * h
  const src = new Uint8ClampedArray(n * 4)
  for (let p = 0; p < n; p++) { const x = p % l; src.set(x < 10 ? [10, 10, 10, 255] : x < 20 ? [229, 57, 53, 255] : [20, 140, 220, 255], p * 4) }
  const logo = [[10, 10, 10], [196, 40, 48], [20, 140, 220]]
  const votants = { tons: [[10, 10, 10], [196, 40, 48], [229, 57, 53], [20, 140, 220]], groupe: [0, 1, 1, 2] }
  const m = voisinageTons(src, src, l, h, l, h, logo, 1, votants)
  assert.ok(m[5 * l + 15] & 2, 'le rouge vif vote pour sa teinte, le rouge')
  assert.ok(!(m[5 * l + 15] & 4), 'pas pour le bleu, trop loin')
  /* Sans votants, ce rouge vif (à 33 niveaux de la moyenne) vote encore, à
     48 niveaux ; et tout point a au moins une teinte. */
  const m2 = voisinageTons(src, src, l, h, l, h, logo, 1)
  assert.ok(m2[5 * l + 15] & 2)
  for (let p = 0; p < n; p++) assert.ok(m2[p] > 0, 'point sans teinte en ' + p)
})

/* ------------------------------------------ 29 septembre 2026, le patron */

test('une petite lettre n\'a qu\'une couleur, celle de sa ligne', async () => {
  const { rangs } = await import('./vecteur-lisse.js')
  /* Douze lettres fines : deux couches, le gris (0) et l'encre (1) ; la
     lettre 4 est encrée pour moitié, les autres un peu. */
  const l = 400, h = 60, n = l * h
  const gris = new Float32Array(n), encre = new Float32Array(n), tout = new Float32Array(n), rvb = new Uint8ClampedArray(n * 4)
  for (let k = 0; k < 12; k++) {
    const x0 = 20 + k * 30
    for (let y = 15; y < 45; y++) for (let x = x0; x < x0 + 5; x++) {
      const p = y * l + x, fonce = k === 4 ? x < x0 + 3 : x === x0 + 2
      if (fonce) encre[p] = 1; else gris[p] = 1
      tout[p] = 1
      rvb.set(fonce ? [40, 40, 42, 255] : [145, 145, 147, 255], p * 4)
    }
  }
  const couleurs = [[145, 145, 147], [40, 40, 42]]
  const r = rangs([gris, encre], tout, l, h, 0.5, { couleurs, petit: 60, voisins: 25, rvb, mince: 8 })
  for (let k = 0; k < 12; k++) for (const x of [20 + k * 30, 22 + k * 30]) assert.equal(r[30 * l + x], 0, 'la lettre ' + k + ' est grise')
  /* Sans la règle, la lettre 4 garde son encre. */
  assert.equal(rangs([gris, encre], tout, l, h)[30 * l + 22 + 4 * 30], 1)
})

test('deux mots en deux couleurs restent deux ; un accent prend la couleur de sa lettre', async () => {
  const { rangs } = await import('./vecteur-lisse.js')
  const l = 400, h = 80, n = l * h
  const bleu = new Float32Array(n), gris = new Float32Array(n), tout = new Float32Array(n)
  /* « ORTHOPÉ » en bleu (six lettres), « DIB » en gris (trois), des lettres
     grasses ; l'accent du É, gris par erreur. */
  for (let k = 0; k < 9; k++) {
    const x0 = 10 + k * 40, c = k < 6 ? bleu : gris
    for (let y = 30; y < 70; y++) for (let x = x0; x < x0 + 25; x++) { c[y * l + x] = 1; tout[y * l + x] = 1 }
  }
  for (let y = 20; y < 26; y++) for (let x = 212; x < 222; x++) { gris[y * l + x] = 1; tout[y * l + x] = 1 }
  const couleurs = [[51, 104, 171], [144, 143, 146]]
  const r = rangs([bleu, gris], tout, l, h, 0.5, { couleurs, petit: 80, voisins: 25, mince: 4 })
  assert.equal(r[50 * l + 20], 0, 'le O reste bleu')
  assert.equal(r[50 * l + 20 + 7 * 40], 1, 'le I reste gris')
  /* Un accent bleu sur gris n'est pas deux gris : il reste gris. */
  assert.equal(r[22 * l + 215], 1)
})

test('les miettes d\'une lettre partagée entre deux gris restent dans la lettre', async () => {
  const { sansMiettes } = await import('./vecteur-lisse.js')
  /* Un trait de 3 px, alterné gris clair / gris foncé tous les 2 px : tous
     ses morceaux sont des miettes, que le vide ne doit pas reprendre. */
  const n = 60, N = n * n
  const a = new Float32Array(N), b = new Float32Array(N)
  for (let y = 10; y < 50; y++) for (let x = 20; x < 23; x++) ((y >> 1) % 2 ? a : b)[y * n + x] = 1
  const { cartes } = sansMiettes([a, b], n, n, { aireMax: 9, epaisseurMin: 2 })
  let reste = 0
  for (let p = 0; p < N; p++) reste += cartes[0][p] + cartes[1][p]
  assert.equal(reste, 40 * 3, 'le trait est entier')
})

test('le modelé perdu : un dégradé tranché en aplats se voit, un logo à plat non', async () => {
  const { modelePerdu } = await import('./vecteur-lisse.js')
  const l = 200, h = 60, n = l * h
  const tout = new Float32Array(n).fill(1), rang = new Int8Array(n)
  const degrade = new Uint8ClampedArray(n * 4), plat = new Uint8ClampedArray(n * 4)
  for (let p = 0; p < n; p++) {
    const x = p % l
    rang[p] = x < 100 ? 0 : 1
    const v = Math.round(120 + x * 0.6)
    degrade.set([v, v * 0.8, 40, 255], p * 4)
    plat.set(x < 100 ? [150, 120, 40, 255] : [210, 168, 40, 255], p * 4)
  }
  const couleurs = [[150, 120, 40], [210, 168, 40]]
  assert.ok(modelePerdu(rang, tout, degrade, couleurs, l, h, 3).faux > 0.9)
  assert.equal(modelePerdu(rang, tout, plat, couleurs, l, h, 3).faux, 0)
})

test('un logo à plat en plusieurs couleurs s\'ouvre sur le vecteur', () => {
  /* Trois pastilles franches sur du blanc, un léger grain : à plat. */
  const l = 300, h = 120, d = new Uint8ClampedArray(l * h * 4)
  const c = [[174, 196, 177], [118, 142, 124], [253, 167, 128]]
  let g = 3
  const grain = () => ((g = (g * 16807) % 2147483647) / 2147483647 - 0.5) * 6
  for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) {
    const k = Math.floor(x / 100), r = Math.hypot(x - (50 + 100 * k), y - 60)
    d.set(r < 35 ? [...c[k].map(v => v + grain()), 255] : [0, 0, 0, 0], (y * l + x) * 4)
  }
  const v = vectoriserLisse(d, l, h, { alpha: true, nuances: true })
  assert.equal(v.degrade, false)
  assert.equal(v.couleurs.length, 3, JSON.stringify(v.couleurs))
})

test('une lettre tracée s\'efface : le vide revient autour, pas les voisines', async () => {
  const { effacerLettre } = await import('./vecteur-lisse.js')
  const W = 40, H = 20, n = W * H
  const rang = new Int8Array(n).fill(-1), tout = new Float32Array(n)
  const pixels = []
  for (let y = 5; y < 15; y++) for (let x = 5; x < 10; x++) { const p = y * W + x; rang[p] = 0; tout[p] = 1; pixels.push(p) }
  /* Un liseré pâle autour, et une voisine à trois pixels. */
  for (let y = 5; y < 15; y++) { tout[y * W + 10] = 0.3; rang[y * W + 10] = 0 }
  for (let y = 5; y < 15; y++) for (let x = 13; x < 18; x++) { const p = y * W + x; rang[p] = 0; tout[p] = 1 }
  const voisine = new Uint8Array(n)
  for (let y = 5; y < 15; y++) for (let x = 13; x < 18; x++) voisine[y * W + x] = 1
  effacerLettre({ x0: 5, y0: 5, x1: 9, y1: 14, pixels }, rang, tout, W, H, voisine)
  assert.equal(tout[10 * W + 7], 0, 'la lettre est partie')
  assert.equal(tout[10 * W + 10], 0, 'son liseré aussi')
  assert.equal(tout[10 * W + 15], 1, 'la voisine reste')
})

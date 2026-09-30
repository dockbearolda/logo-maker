import { test } from 'node:test'
import assert from 'node:assert/strict'
import { palette, couleursAuto, aplatir, reduire, vectoriser, nettoyerSvg, optionsTrace } from './vectoriser.js'
import { detourer } from './detourage.js'

/* imagetracer.js se pose sur `self`, comme dans le fil de calcul du studio. */
globalThis.self = globalThis
await import('../vendor/imagetracer.js')
const tracer = globalThis.ImageTracer

function image(l, h, peindre) {
  const data = new Uint8ClampedArray(l * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) data.set([...peindre(x, y), 255].slice(0, 4), (y * l + x) * 4)
  return data
}
const ROUGE = [200, 20, 30]
const JAUNE = [250, 200, 20]
const BLANC = [255, 255, 255]

/* Un disque rouge, un anneau blanc dedans (le « O »), un cœur jaune. */
const logo = () => image(120, 120, (x, y) => {
  const r = Math.hypot(x - 60, y - 60)
  return r < 12 ? JAUNE : r < 24 ? BLANC : r < 50 ? ROUGE : BLANC
})

test('les teintes se trouvent, les plus présentes d\'abord', () => {
  const d = detourer(logo(), 120, 120, { interieur: true }).data
  const pal = palette(d, 2)
  assert.equal(pal.length, 2)
  assert.ok(Math.abs(pal[0][0] - 200) < 12 && pal[0][1] < 40, 'rouge ' + pal[0])
  assert.ok(pal[1][0] > 235 && pal[1][1] > 185, 'jaune ' + pal[1])
  assert.equal(couleursAuto(d), 2)
})

test('le transparent reste vide, le reste prend sa teinte', () => {
  const d = new Uint8ClampedArray([10, 10, 10, 255, 250, 0, 0, 200, 0, 0, 0, 20])
  assert.deepEqual([...aplatir(d, [[0, 0, 0], [255, 0, 0]])], [0, 0, 0, 255, 255, 0, 0, 255, 0, 0, 0, 0])
})

test('réduire garde la couleur au bord du transparent', () => {
  const d = new Uint8ClampedArray([200, 20, 30, 255, 0, 0, 0, 0, 200, 20, 30, 255, 0, 0, 0, 0])
  const r = reduire(d, 2, 2, 1)
  assert.equal(r.largeur, 1)
  assert.deepEqual([...r.data], [200, 20, 30, 128])
})

test('le SVG : pas une forme pour le vide, pas de blanc dans le « O »', () => {
  const d = detourer(logo(), 120, 120, { interieur: true }).data
  const { svg, couleurs } = vectoriser(tracer, d, 120, 120, { details: 0 })
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" version="1\.1" width="120" height="120" viewBox="0 0 1600 1600">/)
  assert.equal(couleurs.length, 2)
  const remplis = [...svg.matchAll(/fill="rgb\((\d+),(\d+),(\d+)\)"/g)].map(m => m.slice(1).map(Number))
  assert.ok(remplis.length >= 2)
  for (const c of remplis) assert.ok(!(c[0] > 240 && c[1] > 240 && c[2] > 240), 'du blanc dessiné : ' + c)
  assert.doesNotMatch(svg, /opacity="0"|stroke|desc=/)
})

test('le blanc gardé (« depuis les bords ») se vectorise, lui', () => {
  const d = detourer(logo(), 120, 120, { interieur: false }).data
  const { svg } = vectoriser(tracer, d, 120, 120, { couleurs: 3, details: 0 })
  assert.match(svg, /fill="rgb\(25[0-5],25[0-5],25[0-5]\)"/)
})

test('un grand logo se trace réduit, mais garde ses dimensions', () => {
  const svg = nettoyerSvg('<svg viewBox="0 0 800 400"><path fill="rgb(1,2,3)" stroke="rgb(1,2,3)" stroke-width="0" opacity="1" d="M 0 0 Z" /></svg>', 3200, 1600, 800, 400)
  assert.equal(svg, '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="3200" height="1600" viewBox="0 0 800 400"><title>Logo vectorisé — OLDA Print Studio</title><path fill="rgb(1,2,3)" d="M 0 0 Z"/></svg>')
})

test('les curseurs du tracé vont d\'un bout à l\'autre', () => {
  assert.equal(optionsTrace(0, 0).pathomit, 0)
  assert.equal(optionsTrace(100, 100).pathomit, 120)
  /* Lisser : moins de droites, plus de courbes. */
  assert.ok(optionsTrace(100, 0).ltres < optionsTrace(0, 0).ltres)
  assert.ok(optionsTrace(100, 0).qtres > optionsTrace(0, 0).qtres)
  assert.deepEqual([optionsTrace().ltres, optionsTrace().qtres], [0.55, 3])
})

test('un petit logo s\'agrandit avant le tracé, sans noircir ses bords', async () => {
  const { agrandir } = await import('./vectoriser.js')
  const d = new Uint8ClampedArray([200, 20, 30, 255, 0, 0, 0, 0])
  const g = agrandir(d, 2, 1, 8)
  assert.equal(g.largeur, 8)
  assert.equal(g.hauteur, 4)
  for (let x = 0; x < 8; x++) {
    const i = x * 4
    if (g.data[i + 3]) assert.deepEqual([...g.data.slice(i, i + 3)], [200, 20, 30])
  }
  assert.equal(g.data[3], 255)
  assert.equal(g.data[7 * 4 + 3], 0)
})

/* LE COUP DE PROPRE (25 septembre 2026) : un logo pixellisé redessiné net. */
test('adoucir : un bord en marches devient une pente, sans noircir le transparent', async () => {
  const { adoucir } = await import('./vectoriser.js')
  const d = image(20, 1, x => (x < 10 ? [...ROUGE, 255] : [0, 0, 0, 0]))
  const a = adoucir(d, 20, 1, 3)
  assert.equal(a[0 * 4 + 3], 255)
  assert.equal(a[19 * 4 + 3], 0)
  const milieu = a[10 * 4 + 3]
  assert.ok(milieu > 40 && milieu < 215, 'pente ' + milieu)
  assert.deepEqual([...a.slice(9 * 4, 9 * 4 + 3)], ROUGE)
  assert.equal(adoucir(d, 20, 1, 0), d)
})

test('un logo en gros pixels se redessine en courbe', () => {
  /* Un disque de 16 px agrandi ×8 au plus proche : des marches de 8 px. */
  const petit = r => image(128, 128, (x, y) => (Math.hypot(Math.floor(x / 8) * 8 + 4 - 64, Math.floor(y / 8) * 8 + 4 - 64) < 44 ? ROUGE : [0, 0, 0, 0]))
  const marches = s => (s.match(/ L /g) || []).length
  const brut = vectoriser(tracer, petit(), 128, 128, { couleurs: 1, escaliers: 0 }).svg
  const net = vectoriser(tracer, petit(), 128, 128, { couleurs: 1, escaliers: 100 }).svg
  assert.ok(marches(net) < marches(brut) / 2, marches(net) + ' droites contre ' + marches(brut))
})

test('les mélanges du bord ne sont pas des couleurs du logo', async () => {
  const { paletteAuto, aplatir } = await import('./vectoriser.js')
  /* Du rouge, du marine, et leurs mélanges avec le blanc du fond : du rose
     et du gris, comme au bord d'un logo pixellisé. */
  const couleurs = [[225, 29, 72], [15, 23, 42], [240, 142, 163], [135, 139, 148], [230, 90, 115]]
  const poids = [5000, 3000, 600, 500, 400]
  const pts = []
  couleurs.forEach((c, i) => { for (let n = 0; n < poids[i]; n++) pts.push(...c, 255) })
  const d = new Uint8ClampedArray(pts)
  const pal = paletteAuto(d, [[255, 255, 255]])
  assert.equal(pal.length, 2, JSON.stringify(pal))
  /* Le rose le plus pâle tombe dans le vide, le rose soutenu reste rouge. */
  const plat = aplatir(new Uint8ClampedArray([250, 200, 210, 255, 230, 90, 115, 255]), pal, [[255, 255, 255]])
  assert.equal(plat[3], 0)
  assert.equal(plat[7], 255)
})

test('un fil d\'une autre couleur au bord d\'un aplat disparaît', async () => {
  const { nettoyerEtiquettes } = await import('./vectoriser.js')
  /* Un aplat marine, un fil rouge d'un pixel, puis le vide. */
  const d = image(12, 12, x => (x < 6 ? [15, 23, 42, 255] : x === 6 ? [225, 29, 72, 255] : [0, 0, 0, 0]))
  const n = nettoyerEtiquettes(d, 12, 12, 1)
  for (let y = 0; y < 12; y++) assert.notDeepEqual([...n.slice((y * 12 + 6) * 4, (y * 12 + 6) * 4 + 3)], [225, 29, 72])
  /* Un trait de trois pixels, lui, reste. */
  const t = image(12, 12, x => (x >= 4 && x < 7 ? [225, 29, 72, 255] : [15, 23, 42, 255]))
  assert.deepEqual([...nettoyerEtiquettes(t, 12, 12, 1).slice((6 * 12 + 5) * 4, (6 * 12 + 5) * 4 + 3)], [225, 29, 72])
})

test('la taille des pixels d\'un logo agrandi se devine', async () => {
  const { taillePixel, escaliersPour } = await import('./vectoriser.js')
  const bloc = k => image(240, 240, (x, y) => ((Math.floor(x / k) * 7 + Math.floor(y / k) * 3) % 5 < 2 ? [225, 29, 72] : [15, 23, 42]))
  assert.equal(taillePixel(bloc(8), 240, 240), 8)
  assert.equal(taillePixel(bloc(6), 240, 240), 6)
  /* Un logo net : des bords partout, au hasard. */
  const net = image(240, 240, (x, y) => (Math.hypot(x - 120, y - 120) % 23 < 11 ? ROUGE : [15, 23, 42]))
  assert.equal(taillePixel(net, 240, 240), 1)
  assert.equal(escaliersPour(1, 1024, 1024), 25)
  assert.ok(escaliersPour(8, 768, 768) > 60)
})

test('le gris entre le marine et le blanc ne devient pas rouge', async () => {
  const { aplatir } = await import('./vectoriser.js')
  const pal = [[225, 29, 72], [15, 23, 42]]
  /* Plus près du marine que du blanc sur leur trajet : marine. Plus près du
     blanc : le vide. Jamais le rouge. */
  const d = new Uint8ClampedArray([110, 114, 125, 255, 175, 178, 184, 255])
  const plat = aplatir(d, pal, [[255, 255, 255]])
  assert.deepEqual([...plat.slice(0, 4)], [15, 23, 42, 255])
  assert.equal(plat[7], 0)
})

/* « Les petites écritures deviennent illisibles » (26 septembre 2026). */
test('un trait fin et pâle d\'une petite écriture reste dans le tracé', async () => {
  const { COUVERTURE, coteTrace } = await import('./vectoriser.js')
  /* Un aplat vert (pour la teinte) et, loin de lui, un trait d'un pixel
     que le JPEG a pâli à 45 % : du vert mêlé de blanc. */
  const VERT = [15, 61, 46]
  const pale = VERT.map(c => Math.round(c * 0.45 + 255 * 0.55))
  const d = image(200, 200, (x, y) => (x < 60 && y < 60 ? [...VERT, 255] : y === 150 && x > 20 && x < 180 ? [...pale, 255] : [0, 0, 0, 0]))
  const trait = svg => (svg.match(/<path /g) || []).length
  const avant = vectoriser(tracer, d, 200, 200, { couverture: 0.5, cote: 1600, details: 0, fonds: [[255, 255, 255]] }).svg
  const apres = vectoriser(tracer, d, 200, 200, { details: 0, fonds: [[255, 255, 255]] }).svg
  assert.equal(trait(avant), 1, 'à 50 %, le trait disparaissait')
  assert.equal(trait(apres), 2, 'à ' + COUVERTURE * 100 + ' %, il reste')
  assert.equal(coteTrace(1024, 1024), 3072)
  assert.equal(coteTrace(1024, 1024, 2400), 2400)
  assert.equal(coteTrace(300, 200), 1600)
  assert.equal(coteTrace(5000, 3000), 3200)
})

test('une petite écriture d\'une autre couleur garde sa teinte', async () => {
  const { paletteAuto } = await import('./vectoriser.js')
  /* 99,8 % de vert, 0,2 % d'or : un sous-titre minuscule. */
  const pts = []
  for (let n = 0; n < 9980; n++) pts.push(15, 61, 46, 255)
  for (let n = 0; n < 20; n++) pts.push(232, 176, 74, 255)
  assert.equal(paletteAuto(new Uint8ClampedArray(pts), [[255, 255, 255]]).length, 2)
})

test('un logo en aplats n\'est pas une illustration ; un dégradé en est une', async () => {
  const { estIllustration } = await import('./vectoriser.js')
  const aplats = image(120, 120, (x, y) => (Math.hypot(x - 60, y - 60) < 24 ? JAUNE : Math.hypot(x - 60, y - 60) < 50 ? ROUGE : [0, 0, 0, 0]))
  assert.equal(estIllustration(aplats), false)
  /* Un ciel en dégradé, une mer en dégradé, une tortue tachetée. */
  const peinture = image(120, 120, (x, y) => [Math.round(x * 2), Math.round(80 + y), Math.round(255 - x - y / 2)])
  assert.equal(estIllustration(peinture), true)
})

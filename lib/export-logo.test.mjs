import { test } from 'node:test'
import assert from 'node:assert/strict'
import { recolorer, svgFinal, svgVersEps, nomExport, tailleCm, zip, recadrer } from './export-logo.js'
import { crc32 } from './png.js'

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="600" height="300" viewBox="0 0 600 300"><title>x</title>'
  + '<path fill="rgb(20,30,160)" fill-rule="evenodd" d="M0 0L600 0L600 300L0 300Z"/>'
  + '<path fill="rgb(255,255,255)" fill-rule="evenodd" d="M100 100C150 50 200 50 250 100Z"/></svg>'

test('une couleur changée à la main, les autres restent', () => {
  const s = recolorer(SVG, { '255,255,255': [198, 40, 40] })
  assert.match(s, /fill="rgb\(20,30,160\)"/)
  assert.match(s, /fill="rgb\(198,40,40\)"/)
  assert.ok(!/255,255,255/.test(s))
  assert.equal(recolorer(SVG, {}), SVG)
})

test('la taille : à la largeur choisie, ou à 300 dpi', () => {
  assert.deepEqual(tailleCm(600, 300, 10), [10, 5])
  const [l, h] = tailleCm(600, 300)
  assert.ok(Math.abs(l - 5.08) < 1e-9 && Math.abs(h - 2.54) < 1e-9)
})

test('le SVG final : en millimètres, en hexadécimal, le dessin intact', () => {
  const s = svgFinal(SVG, { largeurCm: 8 })
  assert.match(s, /width="80mm" height="40mm" viewBox="0 0 600 300"/)
  assert.match(s, /fill="#141ea0"/)
  assert.match(s, /fill="#ffffff"/)
  assert.match(s, /d="M100 100C150 50 200 50 250 100Z"/)
  assert.equal((s.match(/<title>/g) || []).length, 1)
})

test('l\'EPS : des tracés PostScript, à la taille, en CMJN', () => {
  const e = svgVersEps(SVG, { largeurCm: 2.54 * 6 })
  assert.match(e, /^%!PS-Adobe-3\.0 EPSF-3\.0\n/)
  assert.match(e, /%%BoundingBox: 0 0 432 216\n/)
  assert.match(e, /0\.999 0\.895 0\.035 0\.001 setcmykcolor\nnewpath\n0 216 moveto\n432 216 lineto/)
  assert.match(e, /%%DocumentProcessColors: Cyan Magenta Yellow Black\n/)
  assert.ok(!/setrgbcolor/.test(e))
  assert.match(e, /curveto\nclosepath\neofill/)
  assert.match(e, /%%EOF\n$/)
  const c = svgVersEps(SVG, { cmjn: [0, 100, 100, 0] })
  assert.match(c, /0 1 1 0 setcmykcolor/)
  assert.ok(!/setrgbcolor/.test(c))
})

test('l\'EPS garde la couche de blanc Spot_1, en surimpression', () => {
  const e = svgVersEps(SVG, { blanc: SVG })
  assert.match(e, /true setoverprint\n\[\/Separation \/Spot_1 \/DeviceCMYK \{0 exch 0 0\}\] setcolorspace 1 setcolor/)
})

test('le nom du fichier', () => {
  assert.equal(nomExport('logo client.jpeg', 'pdf'), 'logo client-vectoriel.pdf')
  assert.equal(nomExport('', 'svg', '-rouge'), 'logo-vectoriel-rouge.svg')
})

test('le kit : un zip que tout le monde ouvre', () => {
  const a = new TextEncoder().encode('%PDF-1.4 bonjour')
  const b = new Uint8Array([137, 80, 78, 71, 0, 1, 2, 3])
  const z = zip([{ nom: 'logo-vectoriel.pdf', octets: a }, { nom: 'logo-vectoriel.png', octets: b }], new Date(2026, 8, 27, 14, 30, 10))
  const v = new DataView(z.buffer)
  assert.equal(v.getUint32(0, true), 0x04034b50)
  assert.equal(v.getUint32(14, true), crc32(a))
  assert.equal(new TextDecoder().decode(z.subarray(30, 30 + 18)), 'logo-vectoriel.pdf')
  assert.deepEqual([...z.subarray(48, 48 + a.length)], [...a], 'le fichier, tel quel')
  const fin = z.length - 22
  assert.equal(v.getUint32(fin, true), 0x06054b50)
  assert.equal(v.getUint16(fin + 10, true), 2)
  const rep = v.getUint32(fin + 16, true)
  assert.equal(v.getUint32(rep, true), 0x02014b50)
  assert.equal(v.getUint16(rep + 14, true), ((2026 - 1980) << 9) | (9 << 5) | 27)
})

test('Détouré : le nom dit « detoure »', () => {
  assert.equal(nomExport('logo client.jpg', 'png', '', 'detoure'), 'logo client-detoure.png')
})

test('Détouré : recadré au logo, les pixels intacts', () => {
  const L = 5, H = 4
  const rgba = new Uint8ClampedArray(L * H * 4)
  const poser = (x, y, v) => rgba.set([v, v, v, 200], (y * L + x) * 4)
  poser(1, 1, 10); poser(3, 2, 20)
  const r = recadrer(rgba, L, H)
  assert.deepEqual([r.largeur, r.hauteur, r.x, r.y], [3, 2, 1, 1])
  assert.deepEqual([...r.data.subarray(0, 4)], [10, 10, 10, 200])
  assert.deepEqual([...r.data.subarray((1 * 3 + 2) * 4, (1 * 3 + 2) * 4 + 4)], [20, 20, 20, 200])
  assert.equal(recadrer(new Uint8ClampedArray(16), 2, 2), null)
})

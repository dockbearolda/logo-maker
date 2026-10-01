import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lireSvg, cheminPdf, svgVersPdf, centimetres, blancPdf, decoupePdf, dessinPdf, encrePdf, RESSOURCES_BLANC } from './pdf-vectoriel.js'
import { imageVersPdf } from './pdf-image.js'
import { vectoriser } from './vectoriser.js'
import { detourer } from './detourage.js'

globalThis.self = globalThis
await import('../vendor/imagetracer.js')

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 1600 800">'
  + '<path fill="rgb(255,0,0)" d="M 0 0 L 100 0 Q 200 0 200 100 Z M 10 10 L 20 10 L 20 20 Z"/>'
  + '<path fill="rgb(0,0,0)" opacity="0" d="M 0 0 L 1 1 Z"/></svg>'

test('le SVG se lit : sa boîte, ses formes, pas le vide', () => {
  const l = lireSvg(SVG)
  assert.deepEqual(l.boite, [0, 0, 1600, 800])
  assert.equal(l.largeur, 600)
  assert.equal(l.formes.length, 1)
  assert.deepEqual(l.formes[0].couleur, [255, 0, 0])
  assert.equal(l.formes[0].regle, 'evenodd')
  assert.equal(lireSvg(SVG.replace('<path fill', '<path fill-rule="nonzero" fill')).formes[0].regle, 'nonzero')
})

test('la courbe quadratique s\'écrit en cubique, aux deux tiers', () => {
  const c = cheminPdf('M 0 0 L 100 0 Q 200 0 200 100 Z', (x, y) => [x, y])
  assert.equal(c, '0 0 m\n100 0 l\n166.667 0 200 33.333 200 100 c\nh')
})

test('un PDF bien formé : une page à 300 dpi, sa table des objets juste', () => {
  const pdf = svgVersPdf(SVG)
  assert.match(pdf, /^%PDF-1\.4\n/)
  assert.match(pdf, /\/MediaBox \[0 0 144 72\]/)
  /* En encres (Coated FOGRA39) : le rouge vif, du magenta et du jaune. */
  assert.equal(encrePdf([255, 0, 0]), '0 0.9529 0.9176 0 k')
  assert.ok(pdf.includes('\n' + encrePdf([255, 0, 0]) + '\n') || pdf.includes('stream\n' + encrePdf([255, 0, 0]) + '\n'))
  assert.doesNotMatch(pdf, / rg\n/)
  assert.match(pdf, / c\n/)
  assert.match(pdf, /\nf\*/)
  assert.match(pdf, /%%EOF\n$/)
  /* Chaque entrée de la table pointe sur son objet. */
  const xref = Number(/startxref\n(\d+)/.exec(pdf)[1])
  assert.equal(pdf.slice(xref, xref + 4), 'xref')
  const lignes = pdf.slice(xref).split('\n').slice(3, 8)
  lignes.forEach((l, k) => assert.equal(pdf.slice(Number(l.slice(0, 10)), Number(l.slice(0, 10)) + String(k + 1).length + 6), (k + 1) + ' 0 obj'))
  /* La longueur du flux est la bonne. */
  const flux = /\/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/.exec(pdf)
  assert.equal(Number(flux[1]), flux[2].length)
  /* Le haut du SVG est le haut de la page. */
  assert.match(pdf, /\n0 72 m\n/)
  assert.ok(/^[\x00-\x7f]*$/.test(pdf), 'un octet non ASCII décalerait la table')
})

test('la page prend la largeur demandée, la hauteur suit', () => {
  assert.match(svgVersPdf(SVG, { largeurCm: 25.4 }), /\/MediaBox \[0 0 720 360\]/)
})

test('un logo détouré devient un PDF vectoriel sans aucune forme blanche', () => {
  const l = 120
  const data = new Uint8ClampedArray(l * l * 4)
  for (let y = 0; y < l; y++) for (let x = 0; x < l; x++) {
    const r = Math.hypot(x - 60, y - 60)
    data.set(r < 24 ? [255, 255, 255, 255] : r < 50 ? [200, 20, 30, 255] : [255, 255, 255, 255], (y * l + x) * 4)
  }
  const { svg } = vectoriser(globalThis.ImageTracer, detourer(data, l, l).data, l, l, { details: 0 })
  const pdf = svgVersPdf(svg)
  const couleurs = [...pdf.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) k\n/g)].map(m => m.slice(1).map(Number))
  assert.ok(couleurs.length >= 1)
  for (const c of couleurs) assert.ok(c.some(v => v > 0.05), 'du blanc dans le PDF')
  assert.equal(centimetres(3543), 30)
})

test('la couche de blanc DTF : Spot_1 (magenta à l\'écran), en surimpression, par-dessus le logo', async () => {
  const silhouette = SVG.replace(/fill="rgb\(255,0,0\)"/, 'fill="rgb(1,2,3)"')
  const pdf = svgVersPdf(SVG, { blanc: silhouette })
  assert.ok(pdf.includes('/Resources << ' + RESSOURCES_BLANC + ' >>'))
  assert.match(pdf, /\/Blanc \[\/Separation \/Spot_1 \/DeviceCMYK << \/FunctionType 2 \/Domain \[0 1\] \/C0 \[0 0 0 0\] \/C1 \[0 1 0 0\] \/N 1 >>\]/)
  assert.match(pdf, /\/Surimp << \/Type \/ExtGState \/OP true \/op true \/OPM 1 >>/)
  /* Le logo d'abord, le blanc ensuite, au même endroit. */
  const flux = /stream\n([\s\S]*?)\nendstream/.exec(pdf)[1]
  const [logo, blanc] = flux.split('\nq\n/Surimp gs\n/Blanc cs 1 scn\n')
  assert.equal(blanc, logo.replace(encrePdf([255, 0, 0]) + '\n', '') + '\nQ')
  assert.equal(Number(/\/Length (\d+) >>/.exec(pdf)[1]), flux.length)
  /* Sans blanc : rien de tout ça. */
  assert.doesNotMatch(svgVersPdf(SVG), /Spot_1|Surimp/)
  /* Le PDF d'un dégradé (l'image dans son contour) le porte aussi. */
  const img = Buffer.from(await imageVersPdf(new Uint8Array(16).fill(255), 2, 2, { blanc: (W, H) => blancPdf(silhouette, W, H), ressources: RESSOURCES_BLANC })).toString('latin1')
  assert.ok(img.includes('/XObject << /Im0 5 0 R >> ' + RESSOURCES_BLANC + ' >>'))
  assert.match(img, /\/Im0 Do Q\nq\n\/Surimp gs\n\/Blanc cs 1 scn\n[\s\S]*f\*\nQ\nendstream/)
})

test('la version image : les lettres des polices peintes par-dessus l\'image, hors de sa découpe', async () => {
  const contour = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10"><path fill="rgb(0,0,0)" d="M 0 0 L 5 0 L 5 5 Z"/></svg>'
  const lettres = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10"><path fill="rgb(255,0,0)" d="M 6 6 L 9 6 L 9 9 Z"/></svg>'
  assert.equal(dessinPdf(lettres, 10, 10), '0 0.9529 0.9176 0 k\n6 4 m\n9 4 l\n9 1 l\nh\nf*')
  /* Les lettres des polices (épaissies, elles peuvent se toucher) : au
     nombre d'enroulements, elles se fondent. */
  assert.match(dessinPdf(lettres.replace('<path fill', '<path fill-rule="nonzero" fill'), 10, 10), /h\nf$/)
  const pdf = Buffer.from(await imageVersPdf(new Uint8Array(16).fill(255), 2, 2, { decoupe: (W, H) => decoupePdf(contour, W, H), dessus: (W, H) => dessinPdf(lettres, W, H) })).toString('latin1')
  /* L'image dans sa découpe (fermée), puis les lettres, peintes. */
  assert.match(pdf, /W\* n\nq [\d. ]+ cm \/Im0 Do Q\nQ\n0 0\.9529 0\.9176 0 k\n[\s\S]*\nf\*\nendstream/)
  /* Sans forme, la découpe ne laisse rien passer (et reste un PDF valide). */
  assert.equal(decoupePdf(lettres.replace(/<path[^>]*\/>/, ''), 10, 10), '0 0 m h\nW n')
})

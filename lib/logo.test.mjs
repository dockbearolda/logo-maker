import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatDe, formatParNom, cadreUtile, IMPASSES, imageSeule } from './logo.js'

const octets = (...valeurs) => new Uint8Array([...valeurs, ...new Array(16).fill(0)])
const texte = s => new TextEncoder().encode(s)

test('le format se lit dans les octets, pas dans le nom', () => {
  assert.equal(formatDe(texte('%PDF-1.7\n…')), 'pdf')
  assert.equal(formatDe(octets(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), 'png')
  assert.equal(formatDe(octets(0xff, 0xd8, 0xff, 0xe0)), 'jpg')
  assert.equal(formatDe(texte('GIF89a……')), 'gif')
  assert.equal(formatDe(texte('RIFF\0\0\0\0WEBPVP8 ')), 'webp')
  assert.equal(formatDe(octets(0x49, 0x49, 0x2a, 0x00)), 'tif')
  assert.equal(formatDe(octets(0x4d, 0x4d, 0x00, 0x2a)), 'tif')
  assert.equal(formatDe(octets(0x42, 0x4d, 0x36, 0x00)), 'bmp')
})

test('HEIC d\'iPhone et AVIF partagent leur boîte : la marque tranche', () => {
  assert.equal(formatDe(texte('\0\0\0\x18ftypheic\0\0\0\0')), 'heic')
  assert.equal(formatDe(texte('\0\0\0\x18ftypmif1\0\0\0\0')), 'heic')
  assert.equal(formatDe(texte('\0\0\0\x1cftypavif\0\0\0\0')), 'avif')
})

test('un SVG se reconnaît à sa balise, même après la déclaration XML', () => {
  assert.equal(formatDe(texte('<?xml version="1.0"?>\n<!-- logo -->\n<svg xmlns="http://www.w3.org/2000/svg">')), 'svg')
})

test('EPS et Photoshop sont reconnus pour dire quoi faire', () => {
  assert.equal(formatDe(texte('%!PS-Adobe-3.0 EPSF-3.0')), 'eps')
  assert.equal(formatDe(octets(0x38, 0x42, 0x50, 0x53)), 'psd')
  assert.match(IMPASSES.eps, /PDF/)
  assert.match(IMPASSES.psd, /PNG/)
})

test('un fichier inconnu rend null, et le nom ne sert qu\'en dernier recours', () => {
  assert.equal(formatDe(texte('bonjour, ceci est un texte')), null)
  assert.equal(formatDe(new Uint8Array([1, 2])), null)
  assert.equal(formatParNom('LOGO.AI'), 'pdf')
  assert.equal(formatParNom('photo.HEIF'), 'heic')
  assert.equal(formatParNom('scan.tiff'), 'tif')
  assert.equal(formatParNom('sans-extension'), null)
})

test('le cadre utile serre ce qui est dessiné', () => {
  const l = 10
  const h = 8
  const data = new Uint8ClampedArray(l * h * 4)
  assert.equal(cadreUtile(data, l, h), null)
  const allumer = (x, y, a = 255) => { data[(y * l + x) * 4 + 3] = a }
  allumer(3, 2)
  allumer(6, 5)
  assert.deepEqual(cadreUtile(data, l, h), { x: 3, y: 2, largeur: 4, hauteur: 4 })
})

test('un voile presque transparent ne compte pas comme dessin', () => {
  const data = new Uint8ClampedArray(4 * 4 * 4)
  data[3] = 5
  assert.equal(cadreUtile(data, 4, 4), null)
  data[(2 * 4 + 1) * 4 + 3] = 200
  assert.deepEqual(cadreUtile(data, 4, 4), { x: 1, y: 2, largeur: 1, hauteur: 1 })
})

/* Les codes d'opérations de pdf.js (lib.OPS), ceux qui servent ici. */
const OPS = { save: 10, restore: 11, transform: 12, fill: 22, stroke: 20, showText: 44, constructPath: 91, clip: 29, endPath: 28, paintFormXObjectBegin: 74, paintFormXObjectEnd: 75, paintImageXObject: 85, paintInlineImageXObject: 86, dependency: 1 }

test('un PDF qui n\'est qu\'une image se lit à la taille de son image', () => {
  /* La sortie d'ImageMagick : q 1254 0 0 1254 0 0 cm /Im0 Do Q. */
  const fns = [OPS.save, OPS.transform, OPS.dependency, OPS.paintImageXObject, OPS.restore]
  const args = [null, [1254, 0, 0, 1254, 0, 0], ['img'], ['img', 1254, 1254], null]
  assert.deepEqual(imageSeule(fns, args, OPS), { largeur: 1254, hauteur: 1254, rect: [0, 0, 1254, 1254] })
  /* Posée à 2 cm du bord, deux fois plus petite que ses pixels, dans une
     forme : sa place sur la page suit. */
  const fns2 = [OPS.paintFormXObjectBegin, OPS.save, OPS.transform, OPS.transform, OPS.paintImageXObject, OPS.restore, OPS.paintFormXObjectEnd]
  const args2 = [[[1, 0, 0, 1, 56.7, 0], null], null, [1, 0, 0, 1, 0, 100], [300, 0, 0, 200, 0, 0], ['img', 600, 400], null, null]
  assert.deepEqual(imageSeule(fns2, args2, OPS), { largeur: 600, hauteur: 400, rect: [56.7, 100, 356.7, 300] })
  /* Un détourage (chemin de découpe) ne dessine rien : l'image reste seule. */
  const fns3 = [OPS.save, OPS.constructPath, OPS.clip, OPS.endPath, OPS.transform, OPS.paintImageXObject, OPS.restore]
  const args3 = [null, [], null, null, [500, 0, 0, 500, 0, 0], ['img', 1000, 1000], null]
  assert.equal(imageSeule(fns3, args3, OPS).largeur, 1000)
})

test('un PDF avec du texte, des tracés, deux images ou une image tournée se rend comme avant', () => {
  const image = [OPS.transform, OPS.paintImageXObject]
  const argsImage = [[100, 0, 0, 100, 0, 0], ['img', 400, 400]]
  assert.equal(imageSeule([...image, OPS.showText], [...argsImage, [[]]], OPS), null)
  assert.equal(imageSeule([...image, OPS.constructPath, OPS.fill], [...argsImage, [], null], OPS), null)
  assert.equal(imageSeule([...image, ...image], [...argsImage, ...argsImage], OPS), null)
  assert.equal(imageSeule([OPS.transform, OPS.paintImageXObject], [[0, 100, -100, 0, 100, 0], ['img', 400, 400]], OPS), null)
  assert.equal(imageSeule([OPS.save, OPS.restore], [null, null], OPS), null)
})

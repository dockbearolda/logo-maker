import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inflateSync } from 'node:zlib'
import { imageVersPdf, centimetres, masqueBlanc } from './pdf-image.js'
import { imageCmjn } from './cmjn.js'
import { RESSOURCES_BLANC } from './pdf-vectoriel.js'

test('la taille imprimée à 300 dpi', () => {
  assert.equal(centimetres(3543), 30)
  assert.equal(centimetres(1181), 10)
})

test('le PDF pleine qualité emporte l\'image, en CMJN, et sa transparence, sans rien perdre', async () => {
  /* 4 × 2 pixels : du rouge opaque, du bleu à moitié, du vide. */
  const rgba = new Uint8Array([
    200, 20, 30, 255, 200, 20, 30, 255, 0, 0, 255, 128, 0, 0, 0, 0,
    200, 20, 30, 255, 200, 20, 30, 255, 0, 0, 255, 128, 0, 0, 0, 0,
  ])
  const pdf = await imageVersPdf(rgba, 4, 2)
  const latin = Buffer.from(pdf).toString('latin1')
  assert.match(latin, /^%PDF-1\.4\n/)
  assert.match(latin, /\/MediaBox \[0 0 0\.96 0\.48\]/)
  assert.match(latin, /\/Subtype \/Image \/Width 4 \/Height 2 \/ColorSpace \/DeviceCMYK/)
  assert.doesNotMatch(latin, /DeviceRGB/)
  assert.match(latin, /\/SMask 6 0 R/)
  assert.match(latin, /\/DecodeParms << \/Predictor 15 \/Colors 4 \/BitsPerComponent 8 \/Columns 4 >>/)
  /* Les flux se décompressent, puis se « dé-prédisent » (PNG, octet de
     filtre en tête de ligne), en l'image exacte. */
  const lire = (z, canaux) => {
    const brut = inflateSync(z)
    const ligne = 4 * canaux
    const sortie = []
    for (let y = 0; y < 2; y++) {
      const f = brut[y * (ligne + 1)]
      for (let x = 0; x < ligne; x++) {
        const a = x >= canaux ? sortie[y * ligne + x - canaux] : 0
        const b = y ? sortie[(y - 1) * ligne + x] : 0
        const c = x >= canaux && y ? sortie[(y - 1) * ligne + x - canaux] : 0
        const p = a + b - c
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        assert.equal(f, 4)
        sortie.push((brut[y * (ligne + 1) + 1 + x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255)
      }
    }
    return sortie
  }
  const flux = [...latin.matchAll(/\/Length (\d+) >>\nstream\n/g)].map(m => {
    const debut = m.index + m[0].length
    return Buffer.from(pdf.subarray(debut, debut + Number(m[1])))
  })
  const encres = [...imageCmjn(new Uint8Array([200, 20, 30, 200, 20, 30, 0, 0, 255, 0, 0, 0]))]
  assert.deepEqual(lire(flux[1], 4), encres.concat(encres))
  assert.deepEqual(lire(flux[2], 1), [255, 255, 128, 0, 255, 255, 128, 0])
  /* La table des objets pointe en octets. */
  const xref = Number(/startxref\n(\d+)/.exec(latin)[1])
  assert.equal(latin.slice(xref, xref + 4), 'xref')
  const lignes = latin.slice(xref).split('\n').slice(3, 10)
  lignes.forEach((l, k) => {
    const pos = Number(l.slice(0, 10))
    if (pos) assert.equal(latin.slice(pos, pos + String(k + 1).length + 6), (k + 1) + ' 0 obj')
  })
  /* Tout opaque : pas de masque. */
  const plein = await imageVersPdf(new Uint8Array([1, 2, 3, 255]), 1, 1, { largeurCm: 2.54 })
  const texte = Buffer.from(plein).toString('latin1')
  assert.doesNotMatch(texte, /SMask/)
  assert.match(texte, /\/MediaBox \[0 0 72 72\]/)
})

test('Détouré : le masque du blanc DTF, un bit par pixel, là où c\'est opaque', () => {
  const rgba = new Uint8Array(3 * 2 * 4)
  rgba[3] = 255; rgba[(1 * 3 + 2) * 4 + 3] = 200; rgba[(1 * 3 + 0) * 4 + 3] = 40
  /* Bit à 0 : l'encre passe ; les bits de bourrage restent à 1. */
  assert.deepEqual([...masqueBlanc(rgba, 3, 2)], [0b01111111, 0b11011111])
})

test('Détouré : le PDF porte le Spot_1 en masque de pixels, en surimpression', async () => {
  const rgba = new Uint8Array(4 * 4 * 4)
  for (let i = 0; i < 16; i++) rgba.set([200, 150, 40, i % 2 ? 255 : 0], i * 4)
  const sans = new TextDecoder('latin1').decode(await imageVersPdf(rgba, 4, 4))
  assert.doesNotMatch(sans, /ImageMask|Spot_1/)
  const pdf = new TextDecoder('latin1').decode(await imageVersPdf(rgba, 4, 4, { blancMasque: true, ressources: RESSOURCES_BLANC }))
  assert.match(pdf, /\/ImageMask true \/BitsPerComponent 1/)
  assert.match(pdf, /\/Separation \/Spot_1/)
  assert.match(pdf, /\/XObject << \/Im0 5 0 R \/Im1 8 0 R >>/)
  assert.match(pdf, /\/Surimp gs\n\/Blanc cs 1 scn\n[\d.]+ 0 0 [\d.]+ 0 0 cm \/Im1 Do/)
  assert.match(pdf, /\/Size 9 /)
})

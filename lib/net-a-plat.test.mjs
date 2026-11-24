import { test } from 'node:test'
import assert from 'node:assert/strict'
import { netAPlat, sansMelanges } from './net-a-plat.js'

const BLEU = [27, 76, 147], BLANC = [235, 238, 244]
/* Une image floue : `dedans(x, y)` donne la part de bleu (0 à 1), plus un
   bruit de JPEG. */
function image(l, h, dedans, bruit = 6) {
  const d = new Uint8ClampedArray(l * h * 4)
  let s = 7
  const alea = () => { s = (s * 16807) % 2147483647; return (s / 2147483647 - 0.5) * 2 * bruit }
  for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) {
    const t = dedans(x, y), i = (y * l + x) * 4
    for (let c = 0; c < 3; c++) d[i + c] = t * BLEU[c] + (1 - t) * BLANC[c] + alea()
    d[i + 3] = 255
  }
  return d
}
const flouDisque = (cx, cy, r, w) => (x, y) => Math.max(0, Math.min(1, 0.5 - (Math.hypot(x - cx, y - cy) - r) / w))
const pal = [BLEU, BLANC]

test('un disque flou ressort net : aplats purs, bord d\'un pixel', () => {
  const L = 120, d = image(L, L, flouDisque(60, 60, 35, 9))
  const rep = netAPlat(d, L, L, { echelle: 4, palette: pal })
  assert.equal(rep.change, true)
  let purs = 0, melanges = 0
  for (let i = 0; i < d.length; i += 4) {
    const bleu = d[i] === BLEU[0] && d[i + 1] === BLEU[1] && d[i + 2] === BLEU[2]
    const blanc = d[i] === BLANC[0] && d[i + 1] === BLANC[1] && d[i + 2] === BLANC[2]
    if (bleu || blanc) purs++; else melanges++
  }
  /* Le tour du disque fait ~220 pixels : le bord tient en un ou deux. */
  assert.ok(melanges < 2 * 2 * Math.PI * 35, 'mélanges : ' + melanges)
  assert.ok(purs > 0.95 * L * L)
  /* Le centre bleu, le coin blanc. */
  assert.deepEqual([...d.slice((60 * L + 60) * 4, (60 * L + 60) * 4 + 3)], BLEU)
  assert.deepEqual([...d.slice(0, 3)], BLANC)
})

test('le bord reste à sa place', () => {
  const L = 120, d = image(L, L, flouDisque(60, 60, 35, 9), 0)
  netAPlat(d, L, L, { echelle: 4, palette: pal })
  /* Sur la ligne du centre, le bleu commence à 60 − 35 = 25 (à un pixel). */
  let x0 = -1
  for (let x = 0; x < L; x++) { const i = (60 * L + x) * 4; if (d[i + 2] < (BLEU[2] + BLANC[2]) / 2) { x0 = x; break } }
  assert.ok(Math.abs(x0 - 25) <= 1, 'bord à ' + x0)
})

test('un trait fin d\'un pixel du fichier (4 à ×4) reste', () => {
  const L = 80, d = image(L, L, (x) => Math.max(0, Math.min(1, 1 - Math.abs(x - 40) / 3)))
  netAPlat(d, L, L, { echelle: 4, palette: pal })
  const i = (40 * L + 40) * 4
  assert.deepEqual([...d.slice(i, i + 3)], BLEU)
})

test('un dégradé (pas un logo à plat) ne change pas', () => {
  const L = 60, d = new Uint8ClampedArray(L * L * 4)
  for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) { const i = (y * L + x) * 4; d[i] = x * 4; d[i + 1] = 255 - y * 4; d[i + 2] = (x * y) % 255; d[i + 3] = 255 }
  const avant = d.slice()
  const rep = netAPlat(d, L, L, { echelle: 4 })
  assert.equal(rep.change, false)
  assert.deepEqual(d, avant)
})

test('le vide ne bouge pas', () => {
  const L = 60, d = image(L, L, flouDisque(30, 30, 15, 6))
  for (let y = 0; y < 10; y++) for (let x = 0; x < L; x++) d[(y * L + x) * 4 + 3] = 0
  const avant = d.slice()
  netAPlat(d, L, L, { echelle: 4, palette: pal })
  for (let i = 0; i < 10 * L * 4; i++) assert.equal(d[i], avant[i])
})

test('les mélanges de deux teintes ne sont pas des teintes', () => {
  const l = sansMelanges([[231, 235, 241], [27, 76, 147], [131, 139, 157], [103, 111, 131], [75, 83, 103], [40, 48, 68]])
  assert.deepEqual(l, [[231, 235, 241], [27, 76, 147], [40, 48, 68]])
  /* Trois vraies teintes restent trois. */
  assert.equal(sansMelanges([[255, 0, 0], [0, 128, 0], [0, 0, 255]]).length, 3)
})

test('un trait gris fin sur du blanc reste gris, même près d\'un bleu', () => {
  const GRIS = [40, 48, 68]
  const L = 80, d = new Uint8ClampedArray(L * L * 4)
  for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
    const i = (y * L + x) * 4
    /* À gauche un aplat bleu ; à droite, un trait gris pâli (fin, anticrénelé). */
    const t = x < 20 ? 1 : 0
    const g = Math.max(0, Math.min(1, 0.6 - Math.abs(x - 55) / 4))
    for (let c = 0; c < 3; c++) d[i + c] = t ? BLEU[c] : g * GRIS[c] + (1 - g) * BLANC[c]
    d[i + 3] = 255
  }
  netAPlat(d, L, L, { echelle: 4, palette: [BLEU, BLANC, GRIS] })
  const i = (40 * L + 55) * 4
  assert.deepEqual([...d.slice(i, i + 3)], GRIS)
})

/* Le bord d'un aplat bleu sur du blanc avec, entre les deux, une bande
   bleu nuit de `w` pixels (à ×4). */
const NUIT = [40, 50, 68]
function bande(w) {
  const L = 80, d = new Uint8ClampedArray(L * L * 4)
  for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
    const i = (y * L + x) * 4
    const c = x < 40 ? BLEU : x < 40 + w ? NUIT : BLANC
    d.set([...c, 255], i)
  }
  netAPlat(d, L, L, { echelle: 4, palette: [BLEU, BLANC, NUIT] })
  const nuit = []
  for (let x = 30; x < 50; x++) { const i = (40 * L + x) * 4; if (d[i] === NUIT[0] && d[i + 1] === NUIT[1] && d[i + 2] === NUIT[2]) nuit.push(x) }
  return nuit
}

test('le liseré de l\'IA entre deux aplats part (24 novembre 2026)', () => {
  assert.deepEqual(bande(2), [])
})

test('un vrai contour d\'un pixel du fichier entre deux aplats reste', () => {
  assert.ok(bande(6).length >= 4, 'contour : ' + bande(6))
})

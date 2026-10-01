import { test } from 'node:test'
import assert from 'node:assert/strict'
import { distanceEncre, elargir, deplacerChemin } from './contour.js'

test('la distance à l\'encre, exacte (au carré)', () => {
  const l = 9, h = 9, e = new Uint8Array(l * h)
  e[4 * l + 4] = 1
  const d = distanceEncre(e, l, h)
  assert.equal(d[4 * l + 4], 0)
  assert.equal(d[4 * l + 7], 9)
  assert.equal(d[0], 32)
})

test('l\'encre élargie : un disque autour d\'un point, un creux étroit comblé, un grand creux gardé', () => {
  const l = 41, h = 41, e = new Uint8Array(l * h)
  e[20 * l + 20] = 1
  const r = elargir(e, l, h, 5)
  const op = (x, y) => r[(y * l + x) * 4 + 3] === 255
  assert.ok(op(25, 20) && op(20, 15) && op(23, 24))
  assert.ok(!op(26, 20) && !op(24, 24))
  /* Un anneau : jour de 4 pixels (comblé par 3), jour de 20 (gardé). */
  const anneau = (L, rin, rout) => { const a = new Uint8Array(L * L); for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) { const q = Math.hypot(x - L / 2, y - L / 2); if (q >= rin && q <= rout) a[y * L + x] = 1 } return a }
  const petit = elargir(anneau(41, 2, 10), 41, 41, 3)
  assert.equal(petit[(20 * 41 + 20) * 4 + 3], 255, 'le petit jour se comble')
  const grand = elargir(anneau(81, 20, 30), 81, 81, 3)
  assert.equal(grand[(40 * 81 + 40) * 4 + 3], 0, 'le grand jour reste')
})

test('un chemin ramené de la toile à l\'image', () => {
  assert.equal(deplacerChemin('M10 20L30 40C1 2 3 4 5 6Z', 2, 100, -50), 'M120 -10L160 30C102 -46 106 -42 110 -38Z')
  assert.equal(deplacerChemin('M0.5 1.25Z', 1, 0, 0), 'M0.5 1.25Z')
})

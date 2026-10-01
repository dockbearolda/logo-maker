import { test } from 'node:test'
import assert from 'node:assert/strict'
import { elementsDu } from './elements.js'

/* Une image de `l` × `h` : `peindre(x, y)` rend 1 pour du dessin. */
function image(l, h, peindre) {
  const data = new Uint8ClampedArray(l * h * 4), hors = new Uint8Array(l * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) {
    const d = peindre(x, y)
    data.set(d ? [20, 20, 20, 255] : [255, 255, 255, 255], (y * l + x) * 4)
    hors[y * l + x] = d ? 0 : 1
  }
  return { data, hors }
}
const anneau = (x, y, x0, y0, c, t) => x >= x0 && x < x0 + c && y >= y0 && y < y0 + c && !(x >= x0 + t && x < x0 + c - t && y >= y0 + t && y < y0 + c - t)

test('les formes d\'un seul tenant, et les lettres rangées en ligne', () => {
  /* Trois « O » sur une ligne, un grand carré à part, une poussière. */
  const { data, hors } = image(120, 60, (x, y) => anneau(x, y, 5, 20, 16, 3) || anneau(x, y, 25, 20, 16, 3) || anneau(x, y, 45, 20, 16, 3) || (x >= 70 && x < 115 && y >= 5 && y < 55) || (x === 2 && y === 2))
  const el = elementsDu(data, 120, 60, hors)
  assert.equal(el.formes.length, 5)
  assert.ok(el.lettres, 'des lettres')
  assert.equal(el.lettres[25 * 120 + 6], 1, 'le trait du premier O est une lettre')
  assert.equal(el.lettres[25 * 120 + 46], 1, 'le troisième aussi')
  assert.equal(el.lettres[30 * 120 + 90], 0, 'le carré n\'en est pas une')
  assert.equal(el.lettres[2 * 120 + 2], 0, 'la poussière non plus')
  assert.equal(el.composante[30 * 120 + 90], el.composante[6 * 120 + 72], 'le carré est une seule forme')
  assert.equal(el.composante[0], -1)
})

test('une forme seule ne fait pas une ligne', () => {
  const { data, hors } = image(60, 60, (x, y) => anneau(x, y, 10, 10, 30, 5))
  const el = elementsDu(data, 60, 60, hors)
  assert.equal(el.formes.length, 1)
  assert.equal(el.lettres, null)
})

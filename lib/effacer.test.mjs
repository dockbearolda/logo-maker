import { test } from 'node:test'
import assert from 'node:assert/strict'
import { effacer, encreSous } from './effacer.js'

/* Une image de `l` × `h`, des rectangles d'encre opaque. */
function image(l, h, rects) {
  const d = new Uint8ClampedArray(l * h * 4)
  for (const [x0, y0, x1, y1] of rects) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) d.set([0, 0, 0, 255], (y * l + x) * 4)
  return d
}
const encre = (d, l, x, y) => d[(y * l + x) * 4 + 3] > 0

test('un point retire la forme qu\'il touche, et elle seule', () => {
  const d = image(100, 100, [[10, 10, 30, 30], [50, 50, 70, 70]])
  effacer(d, 100, 100, [{ u: 0.2, v: 0.2 }])
  assert.ok(!encre(d, 100, 20, 20) && !encre(d, 100, 10, 30))
  assert.ok(encre(d, 100, 60, 60))
})

test('un clic tombé juste à côté d\'un trait fin le trouve ; loin, rien ne part', () => {
  const d = image(400, 400, [[100, 0, 100, 399]])
  effacer(d, 400, 400, [{ u: 101.5 / 400, v: 0.5 }])
  assert.ok(!encre(d, 400, 100, 200))
  const e = image(400, 400, [[100, 0, 100, 399]])
  effacer(e, 400, 400, [{ u: 0.5, v: 0.5 }])
  assert.ok(encre(e, 400, 100, 200))
})

test('un cadre retire ce qui y tient pour moitié, pas l\'anneau autour', () => {
  /* Deux lettres dans le cadre, une barre qui en dépasse largement. */
  const d = image(200, 100, [[20, 40, 30, 60], [40, 40, 50, 60], [0, 0, 199, 4], [10, 45, 15, 50]])
  effacer(d, 200, 100, [{ cadre: [0.05, 0.35, 0.3, 0.65] }])
  assert.ok(!encre(d, 200, 25, 50) && !encre(d, 200, 45, 50) && !encre(d, 200, 12, 47))
  assert.ok(encre(d, 200, 100, 2), 'la barre reste')
})

test('rien à effacer : l\'image ne bouge pas', () => {
  const d = image(10, 10, [[0, 0, 4, 4]])
  const avant = d.slice()
  effacer(d, 10, 10, [])
  effacer(d, 10, 10, null)
  assert.deepEqual(d, avant)
})

test('de l\'encre sous un point, à deux pixels près', () => {
  const d = image(50, 50, [[20, 20, 22, 22]])
  assert.ok(encreSous(d, 50, 50, 21, 21))
  assert.ok(encreSous(d, 50, 50, 24, 21))
  assert.ok(!encreSous(d, 50, 50, 40, 40))
})

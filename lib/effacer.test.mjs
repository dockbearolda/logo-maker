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

test('un polygone (une ligne en rond) : seul ce qui y tient part, pas le dessin du milieu', () => {
  /* Une lettre en haut à gauche, un dessin au centre — tous deux dans le
     cadre du polygone, seule la lettre dedans. */
  const d = image(100, 100, [[10, 10, 16, 16], [45, 45, 55, 55]])
  effacer(d, 100, 100, [{ cadre: [0, 0, 1, 1], poly: [[0, 0], [0.3, 0], [0.3, 0.3], [0, 0.3]] }])
  assert.ok(!encre(d, 100, 12, 12))
  assert.ok(encre(d, 100, 50, 50))
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

test('une forme gardée par un cadre se retire encore d\'un clic', () => {
  const d = image(200, 100, [[0, 0, 199, 4], [20, 40, 30, 60]])
  effacer(d, 200, 100, [{ cadre: [0.05, 0, 0.2, 0.7] }, { u: 0.5, v: 0.02 }])
  assert.ok(!encre(d, 200, 100, 2), 'la barre part au clic')
  assert.ok(!encre(d, 200, 25, 50), 'la lettre part avec le cadre')
})

test('un clic dont la forme a changé de taille (le dessin soudé) ne retire rien', () => {
  const d = image(100, 100, [[10, 10, 30, 30]])
  effacer(d, 100, 100, [{ u: 0.2, v: 0.2, aire: 0.01 }])
  assert.ok(encre(d, 100, 20, 20), '441 px ne sont pas 100')
  effacer(d, 100, 100, [{ u: 0.2, v: 0.2, aire: 0.044 }])
  assert.ok(!encre(d, 100, 20, 20))
})

test('le liseré presque transparent d\'une forme retirée part avec elle', () => {
  const d = image(50, 50, [[10, 10, 20, 20]])
  d.set([0, 0, 0, 10], (15 * 50 + 21) * 4)
  effacer(d, 50, 50, [{ u: 0.3, v: 0.3 }])
  assert.equal(d[(15 * 50 + 21) * 4 + 3], 0)
})

/* Les calques (12 octobre 2026) : un élément recoloré. */
import { recolorer } from './effacer.js'

test('un élément recoloré prend la couleur sur chacun de ses pixels, l\'opacité gardée ; les autres restent', () => {
  const d = image(100, 100, [[10, 10, 30, 30], [50, 50, 70, 70]])
  d.set([0, 0, 0, 40], (31 * 100 + 20) * 4)
  recolorer(d, 100, 100, [{ u: 0.2, v: 0.2, rvb: [200, 30, 30] }])
  assert.deepEqual([...d.subarray((20 * 100 + 20) * 4, (20 * 100 + 20) * 4 + 4)], [200, 30, 30, 255])
  assert.deepEqual([...d.subarray((31 * 100 + 20) * 4, (31 * 100 + 20) * 4 + 4)], [200, 30, 30, 40], 'le liseré doux aussi, à son opacité')
  assert.deepEqual([...d.subarray((60 * 100 + 60) * 4, (60 * 100 + 60) * 4 + 4)], [0, 0, 0, 255])
})

test('un élément recoloré dont la forme a changé de taille ne bouge pas', () => {
  const d = image(100, 100, [[10, 10, 30, 30]])
  recolorer(d, 100, 100, [{ u: 0.2, v: 0.2, aire: 0.001, rvb: [1, 2, 3] }])
  assert.deepEqual([...d.subarray((20 * 100 + 20) * 4, (20 * 100 + 20) * 4 + 3)], [0, 0, 0])
  recolorer(d, 100, 100, [{ u: 0.2, v: 0.2, aire: 0.044, rvb: [1, 2, 3] }])
  assert.deepEqual([...d.subarray((20 * 100 + 20) * 4, (20 * 100 + 20) * 4 + 3)], [1, 2, 3])
})

test('sans consigne, ni encre sous le point : rien ne bouge', () => {
  const d = image(20, 20, [[2, 2, 5, 5]])
  const avant = d.slice()
  recolorer(d, 20, 20, [])
  recolorer(d, 20, 20, [{ u: 0.9, v: 0.9, rvb: [9, 9, 9] }])
  assert.deepEqual(d, avant)
})

test('un lasso qui coupe retire l\'encre dedans, pixel par pixel, pas la forme entière', () => {
  const d = image(100, 100, [[10, 10, 60, 60]])
  effacer(d, 100, 100, [{ poly: [[0.2, 0.2], [0.4, 0.2], [0.4, 0.4], [0.2, 0.4]], cadre: [0.2, 0.2, 0.4, 0.4], coupe: true }])
  assert.ok(!encre(d, 100, 30, 30))
  assert.ok(encre(d, 100, 50, 50), 'le reste de la forme est là')
  assert.ok(encre(d, 100, 15, 15))
})

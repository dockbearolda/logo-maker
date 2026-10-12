import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formesDe, estLettre, AIRE_MIN } from './calques.js'

/* Une image de `l` × `h`, des rectangles d'encre [x0, y0, x1, y1, rvb]. */
function image(l, h, rects) {
  const d = new Uint8ClampedArray(l * h * 4)
  for (const [x0, y0, x1, y1, c] of rects) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) d.set([...(c || [0, 0, 0]), 255], (y * l + x) * 4)
  return d
}

test('les formes d\'un seul tenant, de la plus grande à la plus petite, avec leur adresse et leur couleur', () => {
  const d = image(100, 100, [[10, 10, 30, 30, [200, 30, 30]], [50, 50, 90, 90, [10, 10, 200]], [95, 2, 96, 3, [0, 0, 0]]])
  const { formes } = formesDe(d, 100, 100)
  assert.equal(formes.length, 2, 'la poussière de 4 pixels n\'est pas listée')
  assert.equal(formes[0].id, 0)
  assert.deepEqual(formes[0].rvb, [10, 10, 200])
  assert.ok(Math.abs(formes[0].u - 0.705) < 0.02 && Math.abs(formes[0].v - 0.705) < 0.02, 'son centre')
  assert.ok(Math.abs(formes[0].aire - 41 * 41 / 10000) < 1e-9)
  assert.deepEqual(formes[0].cadre, [0.5, 0.5, 0.91, 0.91])
  assert.deepEqual(formes[1].rvb, [200, 30, 30])
})

test('le point d\'une forme en anneau tombe sur l\'anneau, pas dans son jour', () => {
  const d = image(100, 100, [[20, 20, 80, 80, [0, 0, 0]]])
  for (let y = 30; y <= 70; y++) for (let x = 30; x <= 70; x++) d[(y * 100 + x) * 4 + 3] = 0
  const { formes } = formesDe(d, 100, 100)
  assert.equal(formes.length, 1)
  const x = Math.floor(formes[0].u * 100), y = Math.floor(formes[0].v * 100)
  assert.ok(d[(y * 100 + x) * 4 + 3] === 255, 'de l\'encre sous le point')
})

test('les consignes retrouvent leur forme, à la tolérance d\'aire près', () => {
  const d = image(100, 100, [[10, 10, 30, 30], [50, 50, 90, 90]])
  const { touchees } = formesDe(d, 100, 100, [{ u: 0.2, v: 0.2 }, { u: 0.7, v: 0.7, aire: 0.17 }, { u: 0.7, v: 0.7, aire: 0.01 }, { u: 0.98, v: 0.02 }, { cadre: [0, 0, 1, 1] }])
  assert.deepEqual(touchees, [1, 0, -1, -1, -1])
})

test('une lettre dans le cadre de sa ligne ne se liste pas à part ; un badge dessous, si', () => {
  const ligne = [0.1, 0.4, 0.6, 0.5]
  assert.ok(estLettre({ cadre: [0.12, 0.41, 0.16, 0.49] }, [ligne]))
  assert.ok(!estLettre({ cadre: [0.05, 0.3, 0.7, 0.6] }, [ligne]), 'le badge')
  assert.ok(!estLettre({ cadre: [0.7, 0.41, 0.75, 0.49] }, [ligne]), 'à côté')
  assert.ok(!estLettre({ cadre: [0.12, 0.41, 0.16, 0.49] }, []))
})

test('le seuil d\'aire : juste en dessous, pas listée ; juste au-dessus, si', () => {
  const n = 200 * 200
  const cote = Math.ceil(Math.sqrt(AIRE_MIN * n))
  const d = image(200, 200, [[10, 10, 10 + cote, 10 + cote]])
  assert.equal(formesDe(d, 200, 200).formes.length, 1)
  const e = image(200, 200, [[10, 10, 10 + cote - 3, 10 + cote - 3]])
  assert.equal(formesDe(e, 200, 200).formes.length, 0)
})

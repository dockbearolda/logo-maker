import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lab, ecartLab, ecart } from './lab.js'

test('CIEDE2000 rend les écarts de référence (Sharma, 2005)', () => {
  const paires = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 0, 0], [50, -1, 2], 2.3669],
    [[50, 2.5, 0], [73, 25, -18], 27.1492],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
    [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373],
  ]
  for (const [a, b, e] of paires) assert.ok(Math.abs(ecartLab(a, b) - e) < 1e-3, ecartLab(a, b) + ' ≠ ' + e)
})

test('le blanc, le noir, et ce que voit l\'œil', () => {
  assert.ok(Math.abs(lab([255, 255, 255])[0] - 100) < 0.01)
  assert.ok(Math.abs(lab([0, 0, 0])[0]) < 0.01)
  assert.equal(ecart([200, 30, 60], [200, 30, 60]), 0)
  /* Le vert sauge d'un crabe et le vert du texte : deux couleurs. */
  assert.ok(ecart([174, 196, 177], [118, 142, 124]) > 10)
  /* Le grain d'un JPEG : pareil pour l'œil. */
  assert.ok(ecart([118, 142, 124], [121, 144, 126]) < 2)
})

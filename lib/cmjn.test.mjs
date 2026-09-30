import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cmjn, imageCmjn } from './cmjn.js'

/* Les valeurs de littleCMS (`transicc -t1 -b`, sRGB → Coated FOGRA39), en
   pour cent : ce que donnent Illustrator et Photoshop en Europe. */
const REFERENCES = [
  [[255, 0, 0], [0, 95.26, 91.95, 0]],
  [[30, 58, 95], [96.17, 76.75, 35.72, 28.03]],
  [[128, 128, 128], [48.25, 38.91, 38.76, 20.6]],
  [[0, 0, 0], [89.23, 78.44, 61.82, 97.11]],
  [[242, 193, 61], [5.17, 25.52, 83.72, 0.18]],
]

test('une couleur en encres, comme Illustrator (Coated FOGRA39) — à un point près', () => {
  for (const [rvb, attendu] of REFERENCES) {
    const e = cmjn(rvb)
    e.forEach((v, k) => assert.ok(Math.abs(v * 100 - attendu[k]) < 1.5, rvb + ' : ' + e.map(x => (x * 100).toFixed(1)) + ' pour ' + attendu))
  }
})

test('le blanc n\'a pas d\'encre ; le noir est un noir riche', () => {
  assert.deepEqual(cmjn([255, 255, 255]), [0, 0, 0, 0])
  const [c, m, j, n] = cmjn([0, 0, 0])
  assert.ok(n > 0.95 && c > 0.8 && m > 0.7 && j > 0.5)
  /* Hors bornes, ramené aux bornes. */
  assert.deepEqual(cmjn([300, 300, -4]), cmjn([255, 255, 0]))
})

test('une image : chaque pixel comme sa couleur seule, quatre octets', () => {
  const rvb = new Uint8Array([200, 20, 30, 0, 0, 255, 255, 255, 255, 17, 128, 240])
  const e = imageCmjn(rvb)
  assert.equal(e.length, 16)
  for (let p = 0; p < 4; p++) {
    const seule = cmjn([...rvb.subarray(p * 3, p * 3 + 3)])
    for (let k = 0; k < 4; k++) assert.ok(Math.abs(e[p * 4 + k] - seule[k] * 255) <= 0.5)
  }
  /* En RVBA, la transparence ne compte pas. */
  const rvba = new Uint8Array([200, 20, 30, 0, 0, 0, 255, 255, 255, 255, 255, 7, 17, 128, 240, 128])
  assert.deepEqual([...imageCmjn(rvba, 4)], [...e])
})

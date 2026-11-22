import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reteindre } from './reteindre.js'

const BLEU = [30, 70, 160], BLANC = [250, 250, 250], VERT = [20, 150, 60]
const px = (...l) => new Uint8ClampedArray(l.flat())

test('sans changement, les mêmes octets', () => {
  const d = px([...BLEU, 255], [...BLANC, 255], [100, 100, 100, 128])
  const avant = d.slice()
  reteindre(d, 3, 1, { palette: [BLEU, BLANC], vers: {} })
  assert.deepEqual(d, avant)
  reteindre(d, 3, 1, null)
  assert.deepEqual(d, avant)
})

test('le bleu passe en vert, le blanc ne bouge pas', () => {
  const d = px([...BLEU, 255], [...BLANC, 255])
  reteindre(d, 2, 1, { palette: [BLEU, BLANC], vers: { [BLEU.join(',')]: VERT } })
  assert.deepEqual([...d], [...VERT, 255, ...BLANC, 255])
})

test('le blanc devient transparent, le bleu reste', () => {
  const d = px([...BLEU, 255], [...BLANC, 255])
  reteindre(d, 2, 1, { palette: [BLEU, BLANC], vers: { [BLANC.join(',')]: null } })
  assert.equal(d[3], 255)
  assert.deepEqual([...d.slice(0, 3)], BLEU)
  assert.equal(d[7], 0)
})

test("l'anticrénelage bleu-blanc garde un bord doux quand le blanc part", () => {
  const mi = BLEU.map((v, k) => Math.round((v + BLANC[k]) / 2))
  const d = px([...mi, 255])
  reteindre(d, 1, 1, { palette: [BLEU, BLANC], vers: { [BLANC.join(',')]: null } })
  assert.ok(d[3] > 100 && d[3] < 160, 'opacité ~ la moitié : ' + d[3])
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(d[k] - BLEU[k]) <= 2)
})

test('le grain suit la teinte changée', () => {
  const d = px([BLEU[0] + 6, BLEU[1] - 4, BLEU[2] + 2, 255])
  reteindre(d, 1, 1, { palette: [BLEU, BLANC], vers: { [BLEU.join(',')]: VERT } })
  const voulu = [VERT[0] + 6, VERT[1] - 4, VERT[2] + 2]
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(d[k] - voulu[k]) <= 2, d[k] + ' / ' + voulu[k])
  assert.equal(d[3], 255)
})

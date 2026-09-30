/* LA NETTETÉ (lib/nettete.js) : le flou mesuré sur les bords retrouve le
   flou gaussien posé sur un dessin franc. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { flouDe, adoucir } from './nettete.js'

/* Un anneau, une barre, un rond, anti-crénelés. */
function dessin(l, h) {
  const S = 4, v = new Float32Array(l * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) {
    let s = 0
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const X = x + (i + 0.5) / S, Y = y + (j + 0.5) / S, d = Math.hypot(X - l * 0.3, Y - h * 0.4)
      s += (d < h * 0.2 && d > h * 0.12) || (X > l * 0.55 && X < l * 0.6 && Y > h * 0.2 && Y < h * 0.8) || Math.hypot(X - l * 0.75, Y - h * 0.6) < h * 0.1 ? 30 : 240
    }
    v[y * l + x] = s / (S * S)
  }
  return v
}
const rvba = v => {
  const o = new Uint8ClampedArray(v.length * 4)
  for (let p = 0; p < v.length; p++) { o[p * 4] = o[p * 4 + 1] = o[p * 4 + 2] = Math.round(v[p]); o[p * 4 + 3] = 255 }
  return o
}

test('le flou mesuré retrouve le flou posé, de net à 8 pixels', () => {
  const l = 800, h = 600, base = dessin(l, h)
  for (const s of [0, 1, 2, 4, 8]) {
    const r = flouDe(rvba(adoucir(base, l, h, s)), l, h)
    assert.ok(r, 'σ ' + s)
    assert.ok(Math.abs(r.sigma - Math.max(s, 0.45)) < 0.35 + 0.08 * s, 'σ ' + s + ' → ' + r.sigma)
  }
})

test('une image unie n\'a pas de flou à mesurer', () => {
  assert.equal(flouDe(new Uint8ClampedArray(64 * 64 * 4).fill(200), 64, 64), null)
})

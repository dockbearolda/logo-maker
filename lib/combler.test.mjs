import { test } from 'node:test'
import assert from 'node:assert/strict'
import { combler, masquePolygone, elargirMasque } from './combler.js'

/* Une image de `l` × `h` peinte par `peindre(x, y)` → [r, g, b, a]. */
function image(l, h, peindre) {
  const d = new Uint8ClampedArray(l * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) d.set(peindre(x, y), (y * l + x) * 4)
  return d
}
const rect = (l, h, x0, y0, x1, y1) => { const m = new Uint8Array(l * h); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m[y * l + x] = 1; return m }
const px = (d, l, x, y) => [...d.subarray((y * l + x) * 4, (y * l + x) * 4 + 4)]

test('un trou dans un aplat prend la couleur de l\'aplat, d\'un bloc', () => {
  const d = image(60, 60, (x, y) => x >= 20 && x <= 40 && y >= 20 && y <= 40 ? [200, 30, 30, 255] : [250, 250, 250, 255])
  combler(d, 60, 60, rect(60, 60, 18, 18, 42, 42))
  assert.deepEqual(px(d, 60, 30, 30), [250, 250, 250, 255])
  assert.deepEqual(px(d, 60, 19, 19), [250, 250, 250, 255])
  assert.deepEqual(px(d, 60, 5, 5), [250, 250, 250, 255], 'le reste ne bouge pas')
})

test('un trou dans le vide reste vide', () => {
  const d = image(40, 40, (x, y) => x >= 15 && x <= 25 && y >= 15 && y <= 25 ? [0, 0, 0, 255] : [0, 0, 0, 0])
  combler(d, 40, 40, rect(40, 40, 14, 14, 26, 26))
  assert.equal(px(d, 40, 20, 20)[3], 0)
})

test('un trou dans un dégradé se comble de proche en proche, sans marche', () => {
  const d = image(80, 20, (x, y) => [Math.round(x * 3), 100, 100, 255])
  combler(d, 80, 20, rect(80, 20, 30, 5, 50, 15))
  const a = px(d, 80, 32, 10)[0], b = px(d, 80, 48, 10)[0]
  assert.ok(a < b, 'le rouge monte encore de gauche à droite')
  assert.ok(Math.abs(a - 90) < 20 && Math.abs(b - 150) < 20)
  for (let x = 30; x < 50; x++) assert.ok(Math.abs(px(d, 80, x + 1, 10)[0] - px(d, 80, x, 10)[0]) <= 12, 'pas de marche à ' + x)
})

test('un trou au bord de l\'image se comble aussi', () => {
  const d = image(30, 30, () => [10, 200, 10, 255])
  combler(d, 30, 30, rect(30, 30, 0, 0, 8, 8))
  assert.deepEqual(px(d, 30, 0, 0), [10, 200, 10, 255])
})

test('sans masque, rien ne bouge', () => {
  const d = image(10, 10, () => [1, 2, 3, 255])
  const avant = d.slice()
  combler(d, 10, 10, new Uint8Array(100))
  assert.deepEqual(d, avant)
})

test('le masque d\'un polygone, pair-impair, en fractions', () => {
  const m = masquePolygone([[0.1, 0.1], [0.5, 0.1], [0.5, 0.5], [0.1, 0.5]], 100, 100)
  assert.equal(m[30 * 100 + 30], 1)
  assert.equal(m[70 * 100 + 70], 0)
  assert.equal(m[30 * 100 + 5], 0)
  assert.equal(masquePolygone([[0, 0], [1, 0]], 10, 10).reduce((a, b) => a + b), 0, 'deux points : rien')
})

test('un masque élargi d\'un pixel couvre ses huit voisins', () => {
  const m = new Uint8Array(25)
  m[12] = 1
  const e = elargirMasque(m, 5, 5, 1)
  assert.equal(e.reduce((a, b) => a + b), 9)
  assert.equal(elargirMasque(m, 5, 5, 0), m)
})

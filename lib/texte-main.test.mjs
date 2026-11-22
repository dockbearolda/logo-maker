import { test } from 'node:test'
import assert from 'node:assert/strict'
import { poserTextes, cleFace } from './texte-main.js'

/* Une police d'essai : chaque lettre, un pavé de 0,6 × 0,7 corps. */
const pave = {
  unitsPerEm: 1000, ascender: 800, descender: -200,
  getPath(texte, x, y, taille) {
    const commands = []
    let n = 0
    for (const ch of texte) {
      if (ch !== ' ') {
        const a = x + n * 0.7 * taille, b = a + 0.6 * taille
        commands.push({ type: 'M', x: a, y: y - 0.7 * taille }, { type: 'L', x: b, y: y - 0.7 * taille }, { type: 'L', x: b, y }, { type: 'L', x: a, y }, { type: 'Z' })
      }
      n++
    }
    return {
      commands,
      getBoundingBox() {
        const xs = commands.filter(c => c.x !== undefined).map(c => c.x), ys = commands.filter(c => c.y !== undefined).map(c => c.y)
        return xs.length ? { x1: Math.min(...xs), x2: Math.max(...xs), y1: Math.min(...ys), y2: Math.max(...ys) } : { x1: 0, x2: 0, y1: 0, y2: 0 }
      },
    }
  },
}
const POLICE = { id: 'essai', graisse: 400, style: 'normal' }
const polices = new Map([[cleFace(POLICE), pave]])
const image = (l, h, rvba) => { const d = new Uint8ClampedArray(l * h * 4); for (let i = 0; i < d.length; i += 4) d.set(rvba, i); return d }
const px = (d, l, x, y) => [...d.slice((y * l + x) * 4, (y * l + x) * 4 + 4)]

test('sans consigne, les mêmes octets', () => {
  const d = image(10, 10, [10, 20, 30, 255]), avant = d.slice()
  poserTextes(d, 10, 10, [], polices)
  poserTextes(d, 10, 10, undefined, polices)
  assert.deepEqual(d, avant)
})

test('le cadre se vide (transparent), ou prend la couleur du bandeau', () => {
  const d = image(20, 10, [200, 0, 0, 255])
  poserTextes(d, 20, 10, [{ cadre: [0, 0, 0.5, 1], fond: null }], polices)
  assert.equal(px(d, 20, 2, 5)[3], 0)
  assert.deepEqual(px(d, 20, 15, 5), [200, 0, 0, 255])
  poserTextes(d, 20, 10, [{ cadre: [0.5, 0, 1, 1], fond: [0, 0, 255] }], polices)
  assert.deepEqual(px(d, 20, 15, 5), [0, 0, 255, 255])
})

test("'garder' n'efface rien", () => {
  const d = image(20, 10, [200, 0, 0, 255]), avant = d.slice()
  poserTextes(d, 20, 10, [{ cadre: [0, 0, 1, 1], fond: 'garder' }], polices)
  assert.deepEqual(d, avant)
})

test('le texte se pose dans le cadre, de sa couleur, sans en sortir', () => {
  const L = 200, H = 60
  const d = image(L, H, [0, 0, 0, 0])
  poserTextes(d, L, H, [{ cadre: [0.1, 0.2, 0.9, 0.8], fond: null, texte: 'AB', police: POLICE, couleur: [0, 160, 60] }], polices)
  let encre = 0, dehors = 0
  for (let y = 0; y < H; y++) for (let x = 0; x < L; x++) {
    const [r, g, b, a] = px(d, L, x, y)
    if (!a) continue
    encre++
    if (x < 20 || x >= 180 || y < 12 || y >= 48) dehors++
    if (a === 255) assert.deepEqual([r, g, b], [0, 160, 60])
  }
  assert.ok(encre > 1500, 'de l\'encre : ' + encre)
  assert.equal(dehors, 0)
})

test('une police absente : le cadre s\'efface, rien ne se pose', () => {
  const d = image(20, 10, [200, 0, 0, 255])
  poserTextes(d, 20, 10, [{ cadre: [0, 0, 1, 1], fond: null, texte: 'X', police: { id: 'aucune', graisse: 400 } }], polices)
  assert.ok([...d].every((v, i) => i % 4 !== 3 || v === 0))
})

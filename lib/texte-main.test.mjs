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

/* Le cadre de l'encre posée. */
const encreDe = (d, L, H) => {
  let x0 = L, y0 = H, x1 = -1, y1 = -1, n = 0
  for (let y = 0; y < H; y++) for (let x = 0; x < L; x++) if (px(d, L, x, y)[3] > 127) { n++; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
  return { x0, y0, x1, y1, l: x1 - x0 + 1, h: y1 - y0 + 1, n }
}
const poser = (L, H, t) => { const d = image(L, H, [0, 0, 0, 0]); poserTextes(d, L, H, [Object.assign({ cadre: [0, 0, 1, 1], fond: null, police: POLICE, couleur: [0, 0, 0] }, t)], polices); return d }

test('montant ou descendant : le texte tourne d\'un quart et remplit un cadre en hauteur', () => {
  const L = 40, H = 200
  const plat = encreDe(poser(L, H, { texte: 'ABCDE' }), L, H)
  for (const sens of ['monte', 'descend']) {
    const e = encreDe(poser(L, H, { texte: 'ABCDE', sens }), L, H)
    assert.ok(e.h > 4 * e.l, sens + ' : ' + e.l + ' × ' + e.h)
    assert.ok(e.h > 160, sens + ' remplit la hauteur : ' + e.h)
    assert.ok(e.n > 3 * plat.n, sens + ' plus grand qu\'à plat')
  }
})

test('montant se lit de bas en haut, descendant de haut en bas', () => {
  /* La lettre courte (le blanc de l'espace) dit le sens : « A  BCDE »,
     le trou près du début. */
  const L = 40, H = 200
  /* Le plus grand blanc entre deux pavés, en part de la hauteur encrée. */
  const trou = d => {
    const e = encreDe(d, L, H)
    let best = -1, bl = 0, debut = -1
    for (let y = e.y0; y <= e.y1; y++) {
      let n = 0
      for (let x = 0; x < L; x++) n += px(d, L, x, y)[3] > 127
      if (!n && debut < 0) debut = y
      if (n && debut >= 0) { if (y - debut > bl) { bl = y - debut; best = (debut + y) / 2 }; debut = -1 }
    }
    return (best - e.y0) / e.h
  }
  const monte = trou(poser(L, H, { texte: 'A  BCDEFG', sens: 'monte' }))
  const descend = trou(poser(L, H, { texte: 'A  BCDEFG', sens: 'descend' }))
  assert.ok(monte > 0.6, 'monte : le début en bas (' + monte + ')')
  assert.ok(descend > 0 && descend < 0.4, 'descend : le début en haut (' + descend + ')')
})

test('empilé : les lettres droites l\'une sous l\'autre', () => {
  const L = 40, H = 200
  const d = poser(L, H, { texte: 'ABC', sens: 'empile' })
  const e = encreDe(d, L, H)
  assert.ok(e.h > 2.5 * e.l, e.l + ' × ' + e.h)
  /* Trois pavés séparés par des bandes vides. */
  let pavés = 0, dans = false
  for (let y = 0; y < H; y++) { let n = 0; for (let x = 0; x < L; x++) n += px(d, L, x, y)[3] > 127; if (n && !dans) pavés++; dans = n > 0 }
  assert.equal(pavés, 3)
})

test('une inclinaison tient dans le cadre', () => {
  const L = 200, H = 120
  const e = encreDe(poser(L, H, { texte: 'ABCD', angle: 30 }), L, H)
  assert.ok(e.x0 >= 0 && e.y0 >= 0 && e.x1 < L && e.y1 < H)
  assert.ok(e.n > 1000)
})

test('les lignes s\'alignent à gauche, au centre ou à droite', () => {
  const L = 200, H = 100
  const gauche = d => { for (let x = 0; x < L; x++) for (let y = 60; y < H; y++) if (px(d, L, x, y)[3] > 127) return x; return -1 }
  const g = gauche(poser(L, H, { texte: 'ABCDEF\nAB', aligner: 'gauche' }))
  const c = gauche(poser(L, H, { texte: 'ABCDEF\nAB' }))
  const dr = gauche(poser(L, H, { texte: 'ABCDEF\nAB', aligner: 'droite' }))
  assert.ok(g < c && c < dr, g + ' < ' + c + ' < ' + dr)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chainer, ajuster, pointA, projeter, redresser, versImage, contourCourbe, boucher } from './courbes.js'

/* Une lettre carrée de `c` pixels de côté, tournée de `t` radians autour
   de (cx, cy), dans une image de `W` de large : ses pixels et son cadre.
   `trou` : un carré vide au milieu, de ce côté. */
function lettre(cx, cy, c, t, W, trou = 0) {
  const pixels = []
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1
  const R = Math.ceil(c)
  for (let y = Math.floor(cy - R); y <= cy + R; y++) {
    for (let x = Math.floor(cx - R); x <= cx + R; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy
      const a = dx * Math.cos(t) + dy * Math.sin(t), b = -dx * Math.sin(t) + dy * Math.cos(t)
      if (Math.abs(a) > c / 2 || Math.abs(b) > c / 2) continue
      if (trou && Math.abs(a) < trou / 2 && Math.abs(b) < trou / 2) continue
      pixels.push(y * W + x)
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
    }
  }
  return { x0, y0, x1, y1, pixels: Int32Array.from(pixels), formes: [{ id: 0 }] }
}
/* Des lettres le long d'un arc (centre, rayon, de `a0` à `a1`, angles
   depuis le haut, dans le sens des aiguilles d'une montre). */
function arc(n, { cx = 600, cy = 700, r = 500, a0 = -0.6, a1 = 0.6, c = 60, W = 1200 } = {}) {
  return Array.from({ length: n }, (_, i) => {
    const a = a0 + (a1 - a0) * i / (n - 1)
    return lettre(cx + r * Math.sin(a), cy - r * Math.cos(a), c, a, W)
  })
}

test('la chaîne : des lettres en arc, de gauche à droite ; pas les lettres d\'une autre ligne', () => {
  const lettres = arc(9)
  /* Une ligne droite bien plus bas, de lettres plus petites. */
  const autres = Array.from({ length: 6 }, (_, i) => lettre(300 + i * 40, 900, 30, 0, 1200))
  const chaines = chainer([...autres, ...lettres].sort(() => 0.5 - Math.random()))
  const arcs = chaines.filter(ch => ch.length === 9)
  assert.equal(arcs.length, 1, chaines.map(ch => ch.length).join())
  assert.deepEqual(arcs[0], lettres)
  assert.ok(chaines.every(ch => ch.every(l => lettres.includes(l)) || ch.every(l => autres.includes(l))))
})

test('la courbe : un arc de cercle, ses tangentes, la projection d\'un point', () => {
  const centres = Array.from({ length: 9 }, (_, i) => { const a = -0.6 + 1.2 * i / 8; return [600 + 500 * Math.sin(a), 700 - 500 * Math.cos(a)] })
  const c = ajuster(centres, { marge: 50 })
  assert.ok(c.residu < 0.5, 'résidu ' + c.residu)
  const { u, n } = projeter(c, centres[4][0], centres[4][1] - 20)
  assert.ok(Math.abs(n + 20) < 0.5, 'écart ' + n)
  const [x, y, tx, ty] = pointA(c, u)
  assert.ok(Math.abs(x - 600) < 1 && Math.abs(y - 200) < 1 && Math.abs(ty) < 0.01 && tx > 0.99)
  /* Au bout de gauche, la tangente monte vers la droite. */
  const [, , tx0, ty0] = pointA(c, projeter(c, ...centres[0]).u)
  assert.ok(Math.abs(Math.atan2(ty0, tx0) + 0.6) < 0.03)
})

test('le redressement : chaque lettre tournée remise droite, et de retour sur la courbe', () => {
  const W = 1200
  const lettres = arc(9, { W })
  const courbe = ajuster(lettres.map(l => [(l.x0 + l.x1 + 1) / 2, (l.y0 + l.y1 + 1) / 2]), { marge: 120 })
  const ligne = redresser(lettres, courbe, W)
  assert.equal(ligne.length, 9)
  /* Tournées : la part mesurée sur leurs bords. */
  assert.ok(ligne.courbe.alpha > 0.8, 'part tournée ' + ligne.courbe.alpha)
  /* Droites et alignées : 60 × 60 à un pixel près, sur une même ligne. */
  for (const l of ligne) {
    assert.ok(Math.abs(l.x1 - l.x0 + 1 - 60) <= 2 && Math.abs(l.y1 - l.y0 + 1 - 60) <= 2, [l.x0, l.y0, l.x1, l.y1].join())
    assert.ok(Math.abs(l.y0 - ligne[0].y0) <= 1)
  }
  /* Le centre de chaque lettre redressée revient au sien. */
  for (const l of ligne) {
    const [x, y] = versImage(ligne, l.X, l.Y, l)
    assert.ok(Math.hypot(x - l.cx, y - l.cy) < 0.01)
  }
  /* Le contour suit la courbe : il entoure chaque lettre. */
  const poly = contourCourbe(ligne, 4)
  const dedans = (x, y) => { let d = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [ax, ay] = poly[j], [bx, by] = poly[i]; if ((ay > y) !== (by > y) && x < ax + (y - ay) * (bx - ax) / (by - ay)) d = !d } return d }
  assert.ok(ligne.every(l => dedans(l.cx, l.cy)))
  /* Et pas le centre de l'arc, qu'enjambe le cadre de la ligne. */
  assert.equal(dedans(600, 500), false)
})

test('cisaillé : un ruban dont les jambages restent droits ne se tourne pas', () => {
  const W = 1200
  /* Des barres verticales dont le pied suit une pente de 20° : colonnes
     décalées, pas tournées. */
  const lettres = Array.from({ length: 7 }, (_, i) => {
    const cx = 200 + i * 70, cy = 300 + Math.tan(0.35) * i * 70
    const pixels = []
    for (let y = Math.round(cy - 30); y < cy + 30; y++) for (let x = Math.round(cx - 8); x < cx + 8; x++) pixels.push(Math.round(y + Math.tan(0.35) * (x - cx)) * W + x)
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1
    for (const p of pixels) { const x = p % W, y = (p - x) / W; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
    return { x0, y0, x1, y1, pixels: Int32Array.from(pixels), formes: [{ id: 0 }] }
  })
  const courbe = ajuster(lettres.map(l => [(l.x0 + l.x1 + 1) / 2, (l.y0 + l.y1 + 1) / 2]), { marge: 100 })
  const ligne = redresser(lettres, courbe, W)
  assert.ok(ligne.courbe.alpha < 0.2, 'part tournée ' + ligne.courbe.alpha)
  /* Remises à plat, les barres sont étroites (pas penchées). */
  for (const l of ligne) assert.ok(l.x1 - l.x0 + 1 <= 18, String(l.x1 - l.x0 + 1))
})

test('les piqûres d\'une lettre tramée se bouchent, pas son creux', () => {
  const W = 400
  const l = lettre(200, 200, 100, 0, W, 40)
  /* Trois piqûres de 2 × 2. */
  const sans = new Set([[170, 170], [175, 230], [230, 175]].flatMap(([x, y]) => [y * W + x, y * W + x + 1, (y + 1) * W + x, (y + 1) * W + x + 1]))
  const ligne = Object.assign([Object.assign({}, l, { pixels: Int32Array.from([...l.pixels].filter(p => !sans.has(p))) })], { courbe: { W } })
  boucher(ligne)
  const pris = new Set(ligne[0].pixels)
  assert.ok([...sans].every(p => pris.has(p)))
  assert.equal(pris.has(200 * W + 200), false)
})

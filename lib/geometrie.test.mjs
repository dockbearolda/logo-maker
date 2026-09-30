import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cercle, rondParfait, droites, formesParfaites } from './geometrie.js'
import { vectoriserLisse, sansMiettes, pure, ajuster } from './vecteur-lisse.js'
import { lireSvg } from './pdf-vectoriel.js'

/* Un bruit toujours le même : les tests ne tremblent pas d'un passage à
   l'autre. */
const bruit = (() => { let s = 7; return a => { s = (s * 16807) % 2147483647; return (s / 2147483647 - 0.5) * 2 * a } })()

const rond = (cx, cy, r, n = 400, a = 0) => Array.from({ length: n }, (_, i) => {
  const t = i / n * 2 * Math.PI
  return [cx + (r + bruit(a)) * Math.cos(t), cy + (r + bruit(a)) * Math.sin(t)]
})

/* Un polygone, un point par pixel le long de ses côtés, et ses sommets. */
function polygone(sommets, a = 0) {
  const pts = [], coins = []
  sommets.forEach((p, i) => {
    const q = sommets[(i + 1) % sommets.length]
    const L = Math.round(Math.hypot(q[0] - p[0], q[1] - p[1]))
    coins.push(pts.length)
    for (let k = 0; k < L; k++) pts.push([p[0] + (q[0] - p[0]) * k / L + (k ? bruit(a) : 0), p[1] + (q[1] - p[1]) * k / L + (k ? bruit(a) : 0)])
  })
  return { pts, coins }
}

test('le cercle le plus proche : son centre et son rayon', () => {
  const c = cercle(rond(50, 60, 30, 200, 0.2))
  assert.ok(Math.abs(c.cx - 50) < 0.1 && Math.abs(c.cy - 60) < 0.1 && Math.abs(c.r - 30) < 0.1, JSON.stringify(c))
})

test('un rond qui tremble devient quatre arcs ; un carré, jamais', () => {
  const a = rondParfait(rond(100, 100, 80, 500, 0.6), 1)
  assert.equal(a.length, 4)
  for (const c of a) assert.ok(Math.abs(Math.hypot(c[0][0] - 100, c[0][1] - 100) - 80) < 0.5, 'le départ de chaque arc est sur le cercle')
  assert.equal(rondParfait(polygone([[0, 0], [100, 0], [100, 100], [0, 100]]).pts, 1), null)
})

test('une ellipse droite reste une ellipse', () => {
  const pts = Array.from({ length: 500 }, (_, i) => { const t = i / 500 * 2 * Math.PI; return [200 + 120 * Math.cos(t) + bruit(0.4), 100 + 60 * Math.sin(t) + bruit(0.4)] })
  const a = rondParfait(pts, 1)
  assert.equal(a.length, 4)
  const xs = a.map(c => c[0][0]), ys = a.map(c => c[0][1])
  assert.ok(Math.abs(Math.max(...xs) - 320) < 1 && Math.abs(Math.min(...ys) - 40) < 1, JSON.stringify(a.map(c => c[0])))
})

test('une droite bruitée est une droite ; un arc, même ouvert, non', () => {
  const ligne = Array.from({ length: 200 }, (_, i) => [i, 50 + bruit(0.3)])
  assert.deepEqual(droites(ligne, 1, 20), [[0, 199]])
  /* Un arc de 90° d'un cercle de 300 px : aucune corde n'en fait une droite. */
  const arc = Array.from({ length: 470 }, (_, i) => { const t = i / 470 * Math.PI / 2; return [300 * Math.cos(t), 300 * Math.sin(t)] })
  assert.deepEqual(droites(arc, 1, 20), [])
})

test('un carré de travers d\'un demi-degré se redresse : quatre droites, à l\'équerre', () => {
  const r = 0.5 * Math.PI / 180
  const tourne = ([x, y]) => [150 + (x - 150) * Math.cos(r) - (y - 150) * Math.sin(r), 150 + (x - 150) * Math.sin(r) + (y - 150) * Math.cos(r)]
  const { pts, coins } = polygone([[100, 100], [200, 100], [200, 200], [100, 200]].map(tourne), 0.2)
  const f = formesParfaites(pts, coins, { tol: 1, longMin: 20, erreur: 0.5, ajuster })
  assert.equal(f.length, 4)
  for (const s of f) {
    assert.equal(s.length, 2, 'une droite, sans poignées')
    assert.ok(Math.abs(s[0][0] - s[1][0]) < 1e-9 || Math.abs(s[0][1] - s[1][1]) < 1e-9, 'horizontale ou verticale : ' + JSON.stringify(s))
  }
})

test('un losange de travers d\'un demi-degré se redresse : quatre droites à 45°', () => {
  const r = 0.5 * Math.PI / 180
  const tourne = ([x, y]) => [150 + (x - 150) * Math.cos(r) - (y - 150) * Math.sin(r), 150 + (x - 150) * Math.sin(r) + (y - 150) * Math.cos(r)]
  const { pts, coins } = polygone([[150, 80], [220, 150], [150, 220], [80, 150]].map(tourne), 0.2)
  const f = formesParfaites(pts, coins, { tol: 1, longMin: 20, erreur: 0.5, ajuster })
  assert.equal(f.length, 4)
  for (const s of f) {
    assert.equal(s.length, 2, 'une droite, sans poignées')
    const dx = Math.abs(s[1][0] - s[0][0]), dy = Math.abs(s[1][1] - s[0][1])
    assert.ok(Math.abs(dx - dy) < 1e-6, 'à 45° : ' + JSON.stringify(s))
  }
  /* À trois degrés de la diagonale, elle reste de travers. */
  const r3 = 3 * Math.PI / 180
  const tourne3 = ([x, y]) => [150 + (x - 150) * Math.cos(r3) - (y - 150) * Math.sin(r3), 150 + (x - 150) * Math.sin(r3) + (y - 150) * Math.cos(r3)]
  const g = formesParfaites(...Object.values(polygone([[150, 80], [220, 150], [150, 220], [80, 150]].map(tourne3), 0.2)), { tol: 1, longMin: 20, erreur: 0.5, ajuster })
  assert.ok(g.some(s => s.length === 2 && Math.abs(Math.abs(s[1][0] - s[0][0]) - Math.abs(s[1][1] - s[0][1])) > 1), 'de travers, elle le reste')
})

test('un octogone garde ses huit angles vifs, trop doux pour des pointes', () => {
  const s = []
  for (let i = 0; i < 8; i++) { const t = (i + 0.5) / 8 * 2 * Math.PI; s.push([200 + 150 * Math.cos(t), 200 + 150 * Math.sin(t)]) }
  const { pts } = polygone(s, 0.15)
  /* Le flou arrondit chaque angle : on le simule en lissant la boucle. */
  const doux = pts.map((p, i) => { const a = pts[(i - 2 + pts.length) % pts.length], b = pts[(i + 2) % pts.length]; return [(a[0] + 2 * p[0] + b[0]) / 4, (a[1] + 2 * p[1] + b[1]) / 4] })
  const f = formesParfaites(doux, [], { tol: 1, longMin: 20, pli: 8, erreur: 0.5, ajuster })
  assert.equal(f.filter(c => c.length === 2).length, 8, JSON.stringify(f.map(c => c.length)))
})

/* Une image : un fond transparent, des formes pleines, bords anticrénelés. */
function image(n, couleur) {
  const d = new Uint8ClampedArray(n * n * 4)
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const c = couleur(x + 0.5, y + 0.5)
    if (c) d.set(c, (y * n + x) * 4)
  }
  return d
}

test('le vecteur d\'un rectangle : quatre nœuds, à l\'équerre ; d\'un anneau : deux cercles', () => {
  const rect = image(200, (x, y) => x > 40 && x < 160 && y > 50 && y < 150 ? [20, 30, 160, 255] : null)
  const v = vectoriserLisse(rect, 200, 200)
  assert.equal(v.noeuds, 4)
  assert.match(v.svg, / d="M40 50L40 150L160 150L160 50Z"| d="M40 50L160 50L160 150L40 150Z"/)
  const anneau = image(200, (x, y) => { const r = Math.hypot(x - 100, y - 100); return r < 80 && r > 40 ? [200, 30, 60, 255] : null })
  const a = vectoriserLisse(anneau, 200, 200)
  assert.equal(a.noeuds, 8)
  const d = lireSvg(a.svg).formes[0].d
  assert.equal((d.match(/C/g) || []).length, 8)
})

test('sans la géométrie, le tracé redevient tout en courbes', () => {
  const rect = image(200, (x, y) => x > 40 && x < 160 && y > 50 && y < 150 ? [20, 30, 160, 255] : null)
  const v = vectoriserLisse(rect, 200, 200, { geometrie: false })
  assert.ok(!/L/.test(v.svg.match(/ d="([^"]*)"/)[1]))
})

test('les miettes partent : le fil sombre le long d\'un bord, l\'éclat isolé', () => {
  const n = 120, N = n * n
  const bleu = new Float32Array(N), noir = new Float32Array(N), rouge = new Float32Array(N)
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const p = y * n + x, r = Math.hypot(x - 60, y - 60)
    if (r < 40) bleu[p] = 1
    else if (r < 41.2 && y < 60) noir[p] = 1
    if (x >= 100 && x < 103 && y >= 10 && y < 13) { rouge[p] = 1 }
  }
  /* Un vrai morceau noir, loin : il reste. */
  for (let y = 100; y < 115; y++) for (let x = 5; x < 30; x++) noir[y * n + x] = 1
  const { cartes, miettes } = sansMiettes([bleu, noir, rouge], n, n, { aireMax: 16, epaisseurMin: 2, isole: { aire: 16, rayon: 8 } })
  assert.ok(miettes >= 2, miettes + ' miettes')
  let fil = 0, bloc = 0
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = cartes[1][y * n + x]; if (y < 90) fil += v; else bloc += v }
  assert.equal(fil, 0, 'le fil noir est parti')
  assert.equal(bloc, 15 * 25, 'le bloc noir est resté')
  assert.equal(cartes[2].reduce((s, v) => s + v, 0), 0, 'l\'éclat rouge est parti')
  assert.equal(cartes[0][60 * n + 60], 1)
})

test('les couleurs pures : le noir et le blanc d\'un JPEG redeviennent francs', () => {
  assert.deepEqual(pure([14, 14, 14]), [0, 0, 0])
  assert.deepEqual(pure([250, 251, 249]), [255, 255, 255])
  assert.deepEqual(pure([200, 30, 60]), [200, 30, 60])
  assert.deepEqual(pure([128, 128, 128]), [128, 128, 128])
  assert.deepEqual(pure([40, 20, 20]), [40, 20, 20])
})

test('une couleur retirée à la main laisse un jour', () => {
  const img = image(200, (x, y) => x > 60 && x < 140 && y > 60 && y < 140 ? [200, 30, 30, 255] : x > 20 && x < 180 && y > 20 && y < 180 ? [20, 30, 160, 255] : null)
  const tout = vectoriserLisse(img, 200, 200)
  assert.equal(tout.couleurs.length, 2)
  const v = vectoriserLisse(img, 200, 200, { sans: [[200, 30, 30]] })
  assert.deepEqual(v.couleurs, [[20, 30, 160]])
  /* Le bleu a son trou : deux boucles, le bord et le jour. */
  assert.equal(v.formes, 2)
})

test('un hexagone anticrénelé : six nœuds, pile sur ses sommets', () => {
  const S = [[350, 60], [500, 150], [500, 320], [350, 410], [200, 320], [200, 150]]
  const dedans = (x, y) => { let c = false; for (let i = 0, j = S.length - 1; i < S.length; j = i++) { const [xi, yi] = S[i], [xj, yj] = S[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c } return c }
  const L = 700, H = 500
  const d = new Uint8ClampedArray(L * H * 4)
  for (let y = 0; y < H; y++) for (let x = 0; x < L; x++) {
    let k = 0
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) if (dedans(x + (a + 0.5) / 4, y + (b + 0.5) / 4)) k++
    if (k) d.set([15, 118, 110, Math.round(k / 16 * 255)], (y * L + x) * 4)
  }
  const v = vectoriserLisse(d, L, H)
  assert.equal(v.noeuds, 6)
  const pts = [...v.svg.match(/ d="([^"]*)"/)[1].matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(m => [Number(m[1]), Number(m[2])])
  for (const p of pts) assert.ok(S.some(s => Math.hypot(s[0] - p[0], s[1] - p[1]) < 0.5), 'un nœud hors d\'un sommet : ' + p)
})

test('un anneau cassé, bordé d\'éclats, redevient un anneau exact', async () => {
  const { anneaux } = await import('./geometrie.js')
  /* Un anneau gris (couche 1) de rayon 150 à 158 autour d'un disque blanc
     (couche 0) qui porte un personnage (couche 2), coupé d'un reflet, avec
     des éclats d'arc au-dehors. */
  const L = 400, n = L * L, cx = 200.3, cy = 199.6
  const rang = new Int8Array(n).fill(-1), tout = new Float32Array(n)
  for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
    const p = y * L + x, d = Math.hypot(x - cx, y - cy), a = Math.atan2(y - cy, x - cx)
    const bord = 150 + bruit(1.2), reflet = a > 1 && a < 1.6 && d > 153 && d < 155
    if (d < bord) { rang[p] = 0; tout[p] = 1 }
    if (d >= bord && d < 158 + bruit(1.2) && !reflet) { rang[p] = 1; tout[p] = 1 }
    if (d > 163 && d < 165 && a > -2 && a < -1.2) { rang[p] = 1; tout[p] = 1 }
    if (Math.abs(x - cx) < 30 && Math.abs(y - cy) < 60) { rang[p] = 2; tout[p] = 1 }
  }
  const r = anneaux(rang, tout, L, L, 3, { tol: 1.5, rayonMin: 20 })
  assert.equal(r.length, 1)
  assert.ok(Math.abs(r[0].cx - cx) < 1 && Math.abs(r[0].cy - cy) < 1, JSON.stringify(r[0]))
  /* L'éclat est parti, le reflet est comblé, le disque est intact. */
  const at = (d, a) => { const p = Math.round(cy + d * Math.sin(a)) * L + Math.round(cx + d * Math.cos(a)); return tout[p] < 0.5 ? -1 : rang[p] }
  assert.equal(at(164, -1.6), -1)
  assert.equal(at(154, 1.3), 1)
  assert.equal(at(100, 0), 0)
  assert.ok(r[0].geometrique, 'un rond abîmé redevient deux cercles')
})

test('un anneau au dessin irrégulier garde son dessin, net', async () => {
  const { anneaux } = await import('./geometrie.js')
  /* « C'est le logo qui est fait comme ça » : comme l'anneau
     d'Orthopédib, épais à droite (14 pixels), fin à gauche (4), qui
     ondule en grand — et, comme lui, abîmé : un bord qui grésille, une
     bosse, une encoche, un reflet, un éclat au large. */
  const L = 400, n = L * L, cx = 200, cy = 200
  const rang = new Int8Array(n).fill(-1), tout = new Float32Array(n)
  const dehors = t => 159 + 5 * Math.cos(t) + 2 * Math.sin(2 * t) + 1.5 * Math.cos(3 * t), dedans = () => 150
  for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
    const p = y * L + x, d = Math.hypot(x - cx, y - cy), t = Math.atan2(y - cy, x - cx)
    if (d < dedans(t)) { rang[p] = 0; tout[p] = 1 }
    const reflet = t > 1 && t < 1.4 && d > 152 && d < 154
    const bosse = Math.abs(t - Math.PI / 2) < 0.02 && d < dehors(t) + 3
    const encoche = Math.abs(t + Math.PI / 2) < 0.03 && d > dehors(t) - 3
    if ((d >= dedans(t) && d < dehors(t) + bruit(1) && !reflet && !encoche) || bosse) { rang[p] = 1; tout[p] = 1 }
    if (d > 180 && d < 182 && t > -2.6 && t < -2.2) { rang[p] = 1; tout[p] = 1 }
    if (Math.abs(x - cx) < 30 && Math.abs(y - cy) < 60) { rang[p] = 2; tout[p] = 1 }
  }
  const r = anneaux(rang, tout, L, L, 3, { tol: 1.5, rayonMin: 20 })
  assert.equal(r.length, 1)
  assert.ok(!r[0].geometrique, 'pas au compas')
  const at = (d, t) => { const p = Math.round(cy + d * Math.sin(t)) * L + Math.round(cx + d * Math.cos(t)); return tout[p] < 0.5 ? -1 : rang[p] }
  /* Épais à droite, fin à gauche : un cercle le ferait partout pareil. */
  assert.equal(at(dehors(0) - 2, 0), 1)
  assert.equal(at(dehors(Math.PI) + 2, Math.PI), -1)
  assert.equal(at(dehors(Math.PI) - 2, Math.PI), 1)
  /* La bosse, l'encoche, le reflet, l'éclat : partis. */
  assert.equal(at(dehors(Math.PI / 2) + 2, Math.PI / 2), -1)
  assert.equal(at(dehors(-Math.PI / 2) - 1.5, -Math.PI / 2), 1)
  assert.equal(at(153, 1.2), 1)
  assert.equal(at(181, -2.4), -1)
  assert.equal(at(100, 0), 0)
})

test('un anneau garde ce qui est posé dessus et ce qui le coupe vraiment', async () => {
  const { anneaux } = await import('./geometrie.js')
  /* Un anneau épais (20 pixels) qui porte trois « lettres » d'une autre
     couleur et un reflet plus clair le long de son tour, croisé par un
     bras qui passe ; au milieu, un anneau ouvert — un C. Les lettres
     restent, le bras aussi ; le reflet rentre dans l'anneau ; le C reste
     ouvert. */
  const L = 400, n = L * L, cx = 200, cy = 200
  const rang = new Int8Array(n).fill(-1), tout = new Float32Array(n)
  const lettres = [0.3, 1.9, -2.5]
  for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
    const p = y * L + x, d = Math.hypot(x - cx, y - cy), t = Math.atan2(y - cy, x - cx)
    if (d >= 150 && d < 170) {
      const lettre = lettres.some(u => Math.abs(t - u) * 160 < 5) && d > 155 && d < 165
      const reflet = t > -1.6 && t < -0.6 && d > 158 && d < 161
      rang[p] = lettre ? 2 : reflet ? 3 : 1; tout[p] = 1
    }
    if (d >= 80 && d < 88 && Math.abs(t) > 0.5) { rang[p] = 0; tout[p] = 1 }
    if (Math.abs(y - 330) < 6 && x > 20 && x < 140) { rang[p] = 4; tout[p] = 1 }
  }
  anneaux(rang, tout, L, L, 5, { tol: 1.5, rayonMin: 20 })
  const at = (d, t) => { const p = Math.round(cy + d * Math.sin(t)) * L + Math.round(cx + d * Math.cos(t)); return tout[p] < 0.5 ? -1 : rang[p] }
  for (const u of lettres) assert.equal(at(160, u), 2)
  assert.equal(at(160, 1), 1)
  assert.equal(at(159.5, -1.1), 1)
  /* Le bras, là où il croise l'anneau (à 160 du centre) et au-delà. */
  assert.equal(rang[330 * L + 107], 4)
  assert.equal(rang[330 * L + 60], 4)
  assert.equal(at(84, 0), -1)
  assert.equal(at(84, Math.PI), 0)
})

test('un O d\'imprimerie, gras sur les côtés, n\'est pas un anneau', async () => {
  const { anneaux } = await import('./geometrie.js')
  const L = 300, n = L * L
  const rang = new Int8Array(n).fill(-1), tout = new Float32Array(n)
  for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
    const u = (x - 150) / 100, v = (y - 150) / 100, d = Math.hypot(u, v)
    /* Le trait : 30 % du rayon sur les côtés, 6 % en haut et en bas. */
    const e = 0.06 + 0.24 * Math.abs(u) / (d || 1)
    if (d <= 1 && d >= 1 - e) { rang[y * L + x] = 0; tout[y * L + x] = 1 }
  }
  assert.equal(anneaux(rang, tout, L, L, 1, { tol: 1.5, rayonMin: 20 }).length, 0)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matriceDe, inverse, appliquer, estIdentite, decomposer, transformer, creuser, anneauOpaque, transformerPose, transformerCommandes, IDENTITE } from './transformer.js'

/* Une image de `l` × `h`, des rectangles d'encre [x0, y0, x1, y1, rvb]. */
function image(l, h, rects) {
  const d = new Uint8ClampedArray(l * h * 4)
  for (const [x0, y0, x1, y1, c] of rects) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) d.set([...(c || [0, 0, 0]), 255], (y * l + x) * 4)
  return d
}
const px = (d, l, x, y) => [...d.subarray((y * l + x) * 4, (y * l + x) * 4 + 4)]
/* Le cadre de l'encre (alpha ≥ 128), [x0, y0, x1, y1], ou null. */
function cadreEncre(d, l) {
  const h = d.length / 4 / l
  let x0 = l, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) if (d[(y * l + x) * 4 + 3] >= 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  return x1 < 0 ? null : [x0, y0, x1, y1]
}
const compterEncre = (d, l, x0 = 0, y0 = 0, x1 = Infinity, y1 = Infinity) => {
  const h = d.length / 4 / l
  let k = 0
  for (let y = Math.max(0, y0); y <= Math.min(h - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(l - 1, x1); x++) if (d[(y * l + x) * 4 + 3] >= 128) k++
  return k
}
const L = 120
/* Le point sûr d'un carré [x0, y0, x1, y1] et son aire, en fractions. */
const adresse = ([x0, y0, x1, y1]) => ({ u: ((x0 + x1) / 2 + 0.5) / L, v: ((y0 + y1) / 2 + 0.5) / L, aire: (x1 - x0 + 1) * (y1 - y0 + 1) / (L * L), pivot: [((x0 + x1 + 1) / 2) / L, ((y0 + y1 + 1) / 2) / L] })

test('la matrice : l\'échelle dans les axes propres, puis la rotation, puis la translation', () => {
  const M = matriceDe({ pivot: [0.5, 0.5], d: [0.1, 0], angle: 90, s: [2, 1] }, 100)
  const [x, y] = appliquer(M, 50, 50)
  assert.ok(Math.abs(x - 60) < 1e-9 && Math.abs(y - 50) < 1e-9, 'le pivot ne fait que se déplacer')
  const [x2, y2] = appliquer(M, 60, 50)
  assert.ok(Math.abs(x2 - 60) < 1e-9 && Math.abs(y2 - 70) < 1e-9, '(10, 0) : ×2 en x → (20, 0), puis 90° → (0, 20)')
})

test('l\'inverse ramène le point, retourné, tourné, à l\'échelle non uniforme', () => {
  const M = matriceDe({ pivot: [0.3, 0.6], d: [-0.2, 0.05], angle: 37, s: [-1.4, 0.6] }, 250)
  const Mi = inverse(M)
  for (const [x, y] of [[0, 0], [100, 30], [250, 250], [12.5, 199]]) {
    const [X, Y] = appliquer(M, x, y), [x2, y2] = appliquer(Mi, X, Y)
    assert.ok(Math.abs(x2 - x) < 1e-7 && Math.abs(y2 - y) < 1e-7)
  }
  assert.ok(estIdentite(IDENTITE) && estIdentite({ pivot: [0.5, 0.5], d: [0, 0], angle: 360, s: [1, 1] }) && !estIdentite({ d: [0.01, 0], angle: 0, s: [1, 1] }))
  assert.deepEqual(decomposer({ s: [-1.4, 0.6], angle: 37 }), { echelle: [1.4, 0.6], angle: 37, retourne: true })
})

test('un carré déplacé d\'un nombre entier de pixels arrive pixel pour pixel, et laisse le vide', () => {
  const d = image(L, L, [[10, 10, 29, 29, [200, 30, 30]]])
  transformer(d, L, L, [Object.assign(adresse([10, 10, 29, 29]), { d: [0.5, 0], angle: 0, s: [1, 1] })])
  assert.deepEqual(cadreEncre(d, L), [70, 10, 89, 29])
  assert.deepEqual(px(d, L, 70, 10), [200, 30, 30, 255])
  assert.deepEqual(px(d, L, 89, 29), [200, 30, 30, 255])
  assert.equal(compterEncre(d, L), 400, 'les 400 pixels, tous')
  assert.equal(px(d, L, 10, 10)[3], 0, 'sa place d\'origine est vide')
})

test('agrandi ×2 autour de son centre : un carré deux fois plus grand, centré pareil', () => {
  const d = image(L, L, [[40, 40, 59, 59, [10, 10, 200]]])
  transformer(d, L, L, [Object.assign(adresse([40, 40, 59, 59]), { d: [0, 0], angle: 0, s: [2, 2] })])
  const c = cadreEncre(d, L)
  assert.ok(Math.abs(c[0] - 30) <= 1 && Math.abs(c[1] - 30) <= 1 && Math.abs(c[2] - 69) <= 1 && Math.abs(c[3] - 69) <= 1, String(c))
  assert.deepEqual(px(d, L, 50, 50), [10, 10, 200, 255], 'plein au milieu')
})

test('tourné de 90° : le rectangle se dresse', () => {
  const d = image(L, L, [[40, 50, 79, 59, [0, 0, 0]]])
  transformer(d, L, L, [Object.assign(adresse([40, 50, 79, 59]), { d: [0, 0], angle: 90, s: [1, 1] })])
  const c = cadreEncre(d, L)
  assert.ok(Math.abs(c[0] - 55) <= 1 && Math.abs(c[2] - 64) <= 1 && Math.abs(c[1] - 35) <= 1 && Math.abs(c[3] - 74) <= 1, String(c))
})

test('retourné (sx < 0) : la gauche passe à droite', () => {
  const d = image(L, L, [[20, 20, 39, 39, [255, 0, 0]], [40, 20, 59, 39, [0, 0, 255]]])
  const a = Object.assign(adresse([20, 20, 59, 39]), { d: [0, 0], angle: 0, s: [-1, 1] })
  transformer(d, L, L, [a])
  assert.deepEqual(px(d, L, 25, 30), [0, 0, 255, 255])
  assert.deepEqual(px(d, L, 55, 30), [255, 0, 0, 255])
})

test('deux carrés qui échangent leurs places se lisent chacun sur l\'image d\'origine', () => {
  const d = image(L, L, [[10, 10, 29, 29, [255, 0, 0]], [70, 10, 89, 29, [0, 0, 255]]])
  transformer(d, L, L, [
    Object.assign(adresse([10, 10, 29, 29]), { d: [0.5, 0], angle: 0, s: [1, 1] }),
    Object.assign(adresse([70, 10, 89, 29]), { d: [-0.5, 0], angle: 0, s: [1, 1] }),
  ])
  assert.deepEqual(px(d, L, 15, 15), [0, 0, 255, 255])
  assert.deepEqual(px(d, L, 75, 15), [255, 0, 0, 255])
  assert.equal(compterEncre(d, L), 800)
})

test('un élément posé sur un badge (un filet de vide entre eux) laisse le badge entier derrière lui ; sur le vide, du vide', () => {
  const d = image(L, L, [[20, 20, 79, 79, [10, 10, 200]], [100, 100, 109, 109, [0, 0, 0]]])
  /* Un carré noir dans le badge, cerné d'un pixel de vide (le liseré du
     fichier) : une forme à part. */
  for (let y = 39; y <= 50; y++) for (let x = 39; x <= 50; x++) d[(y * L + x) * 4 + 3] = 0
  for (let y = 40; y <= 49; y++) for (let x = 40; x <= 49; x++) d.set([0, 0, 0, 255], (y * L + x) * 4)
  transformer(d, L, L, [
    Object.assign(adresse([40, 40, 49, 49]), { d: [0, 0.4], angle: 0, s: [1, 1] }),
    Object.assign(adresse([100, 100, 109, 109]), { d: [-0.5, 0], angle: 0, s: [1, 1] }),
  ])
  assert.deepEqual(px(d, L, 45, 45), [10, 10, 200, 255], 'le trou dans le badge a sa couleur')
  assert.deepEqual(px(d, L, 39, 39), [10, 10, 200, 255], 'le filet de vide aussi')
  assert.deepEqual(px(d, L, 45, 93), [0, 0, 0, 255], 'le carré noir posé plus bas, hors du badge')
  assert.deepEqual(px(d, L, 105, 105), [0, 0, 0, 0], 'sur le vide, le trou reste vide')
  assert.deepEqual(px(d, L, 45, 105), [0, 0, 0, 255], 'l\'autre carré est arrivé')
})

test('une ligne (son cadre) : ses trois lettres bougent ensemble, le dessin à côté reste', () => {
  const d = image(L, L, [[10, 75, 109, 79, [255, 255, 0]], [20, 60, 29, 69, [0, 0, 0]], [40, 60, 49, 69, [0, 0, 0]], [60, 60, 69, 69, [0, 0, 0]]])
  transformer(d, L, L, [{ ligne: { cx: 0.37, cy: 0.54, h: 0.1 }, cadre: [0.15, 0.48, 0.6, 0.6], pivot: [0.37, 0.54], d: [0, -0.4], angle: 0, s: [1, 1] }])
  assert.equal(px(d, L, 25, 65)[3], 0, 'l\'ancienne place des lettres est vide')
  assert.deepEqual(px(d, L, 25, 17), [0, 0, 0, 255])
  assert.deepEqual(px(d, L, 65, 17), [0, 0, 0, 255])
  assert.equal(compterEncre(d, L, 0, 0, L, 30), 300, 'trois lettres de 100 pixels en haut')
  assert.deepEqual(px(d, L, 50, 77), [255, 255, 0, 255], 'le filet jaune n\'a pas bougé')
})

test('l\'identité, une adresse sans encre, une aire qui a triplé : rien ne bouge', () => {
  const d = image(L, L, [[10, 10, 29, 29, [200, 30, 30]]])
  const avant = d.slice()
  transformer(d, L, L, [
    Object.assign(adresse([10, 10, 29, 29]), { d: [0, 0], angle: 0, s: [1, 1] }),
    { u: 0.9, v: 0.9, aire: 0.01, pivot: [0.9, 0.9], d: [0.1, 0], angle: 0, s: [1, 1] },
    Object.assign(adresse([10, 10, 29, 29]), { aire: 4 * 400 / (L * L), d: [0.5, 0], angle: 0, s: [1, 1] }),
  ])
  assert.deepEqual(d, avant)
  transformer(d, L, L, [])
  assert.deepEqual(d, avant)
})

test('poussé à moitié dehors : la moitié visible est là, sans erreur', () => {
  const d = image(L, L, [[100, 50, 119, 69, [0, 0, 0]]])
  transformer(d, L, L, [Object.assign(adresse([100, 50, 119, 69]), { d: [10 / L, 0], angle: 0, s: [1, 1] })])
  assert.deepEqual(cadreEncre(d, L), [110, 50, 119, 69])
  assert.equal(compterEncre(d, L), 200)
})

test('rétréci de moitié : un carré de moitié, sans crénelage grossier', () => {
  const d = image(L, L, [[20, 20, 59, 59, [0, 0, 0]]])
  transformer(d, L, L, [Object.assign(adresse([20, 20, 59, 59]), { d: [0, 0], angle: 0, s: [0.5, 0.5] })])
  const c = cadreEncre(d, L)
  assert.ok(Math.abs(c[0] - 30) <= 1 && Math.abs(c[2] - 49) <= 1, String(c))
  assert.deepEqual(px(d, L, 40, 40), [0, 0, 0, 255])
  assert.deepEqual(px(d, L, 22, 22), [0, 0, 0, 0])
})

test('creuser : le trou d\'un élément sur un aplat se rebouche de l\'aplat, celui sur le vide reste vide', () => {
  const d = image(60, 60, [[0, 0, 59, 59, [0, 120, 0]]])
  const m = new Uint8Array(60 * 60)
  for (let y = 20; y < 40; y++) for (let x = 20; x < 40; x++) m[y * 60 + x] = 1
  assert.equal(creuser(d, 60, 60, m).rebouche, true)
  assert.deepEqual(px(d, 60, 30, 30), [0, 120, 0, 255])
  const d2 = image(60, 60, [[20, 20, 39, 39, [0, 0, 0]]])
  assert.equal(creuser(d2, 60, 60, m).rebouche, false)
  assert.deepEqual(px(d2, 60, 30, 30), [0, 0, 0, 0])
})

test('une pose transformée : ses courbes passent par la matrice, son cadre couvre les deux places, son cerne suit l\'échelle', () => {
  const pose = { lettres: [{ commandes: [{ type: 'M', x: 10, y: 10 }, { type: 'L', x: 20, y: 10 }, { type: 'Q', x1: 20, y1: 20, x: 10, y: 20 }, { type: 'Z' }], pixels: new Int32Array(0) }], cadre: [10, 10, 20, 20], cerne: { couleur: [0, 0, 0], interieur: [255, 255, 255], epaisseur: 2 }, hauteur: 10 }
  const t = { pivot: [0.15, 0.15], d: [0.5, 0], angle: 0, s: [2, 2] }
  const p = transformerPose(pose, t, 100)
  /* Le pivot (15, 15) : (10, 10) → 15 + 2 × (10 − 15) = 5, puis + 50 en x. */
  assert.deepEqual(p.lettres[0].commandes[0], { type: 'M', x: 55, y: 5 })
  assert.deepEqual(p.lettres[0].commandes[1], { type: 'L', x: 75, y: 5 })
  assert.deepEqual(p.lettres[0].commandes[2], { type: 'Q', x1: 75, y1: 25, x: 55, y: 25 })
  assert.deepEqual(p.cadre, [10, 5, 75, 25])
  assert.equal(p.cerne.epaisseur, 4)
  assert.equal(pose.lettres[0].commandes[0].x, 10, 'la pose reçue ne bouge pas')
  assert.equal(transformerPose(pose, { d: [0, 0], angle: 0, s: [1, 1] }, 100), pose, 'l\'identité rend la même pose')
  assert.deepEqual(transformerCommandes([{ type: 'Z' }], [1, 0, 0, 1, 5, 5]), [{ type: 'Z' }])
})

test('deux voisins sur un badge, déplacés ensemble : chacun se juge avant les coupes, les deux trous prennent le badge', () => {
  const d = image(L, L, [[10, 10, 109, 59, [10, 10, 200]]])
  /* Deux carrés noirs côte à côte dans le badge, chacun cerné d'un pixel de vide. */
  for (const x0 of [30, 50]) {
    for (let y = 29; y <= 40; y++) for (let x = x0 - 1; x <= x0 + 10; x++) d[(y * L + x) * 4 + 3] = 0
    for (let y = 30; y <= 39; y++) for (let x = x0; x <= x0 + 9; x++) d.set([0, 0, 0, 255], (y * L + x) * 4)
  }
  transformer(d, L, L, [
    Object.assign(adresse([30, 30, 39, 39]), { d: [0, 0.5], angle: 0, s: [1, 1] }),
    Object.assign(adresse([50, 30, 59, 39]), { d: [0, 0.5], angle: 0, s: [1, 1] }),
  ])
  assert.deepEqual(px(d, L, 35, 35), [10, 10, 200, 255], 'le premier trou a la couleur du badge')
  assert.deepEqual(px(d, L, 55, 35), [10, 10, 200, 255], 'le second aussi (il ne voit pas le premier en trou)')
  assert.deepEqual(px(d, L, 35, 95), [0, 0, 0, 255])
  assert.deepEqual(px(d, L, 55, 95), [0, 0, 0, 255])
  const m = new Uint8Array(L * L)
  for (let y = 30; y <= 39; y++) for (let x = 30; x <= 39; x++) m[y * L + x] = 1
  assert.equal(anneauOpaque(image(L, L, [[10, 10, 109, 59, [10, 10, 200]]]), L, L, m, [30, 30, 39, 39]), true)
})

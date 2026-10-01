/* LA NETTETÉ (lib/nettete.js) : le flou mesuré sur les bords retrouve le
   flou gaussien posé sur un dessin franc. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { flouDe, adoucir, deflouer, rendreNet, SIGMA_MAX } from './nettete.js'

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

/* 1er octobre 2026 : le flou VU (les trois quarts des bords) juge si le
   fichier est flou ; il ne lit jamais moins que celui à retirer (la
   médiane), et un dessin net reste sous le seuil du graphiste. */
test('le flou vu : jamais sous le flou à retirer, et sous le seuil quand le dessin est net', async () => {
  const { FLOU_NET } = await import('./graphiste.js')
  const l = 800, h = 600, base = dessin(l, h)
  for (const s of [0, 1, 2, 4, 8]) {
    const r = flouDe(rvba(adoucir(base, l, h, s)), l, h)
    assert.ok(r.vu >= r.sigma, 'σ ' + s + ' : vu ' + r.vu + ' < ' + r.sigma)
    if (s === 0) assert.ok(r.vu < FLOU_NET, 'net : vu ' + r.vu)
    if (s >= 2) assert.ok(r.vu >= FLOU_NET, 'σ ' + s + ' : vu ' + r.vu)
  }
})

test('une image unie n\'a pas de flou à mesurer', () => {
  assert.equal(flouDe(new Uint8ClampedArray(64 * 64 * 4).fill(200), 64, 64), null)
})

/* L'écart moyen (en niveaux) entre deux images, sur les trois couleurs. */
const ecart = (a, b) => {
  let s = 0
  for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])
  return s / (a.length / 4 * 3)
}

/* La largeur d'un bord (de 10 à 90 % du saut), le long de la ligne `y`,
   à partir de `x0`. */
const bord = (img, l, y, x0, x1) => {
  const v = x => img[(y * l + x) * 4]
  const haut = v(x0), bas = v(x1)
  let k = 0
  for (let x = x0; x <= x1; x++) { const t = (v(x) - bas) / (haut - bas); if (t > 0.1 && t < 0.9) k++ }
  return k
}

test('défloutée, l\'image se rapproche du dessin net : bords resserrés, flou mesuré qui tombe', () => {
  const l = 400, h = 300, base = dessin(l, h)
  const net = rvba(base), flou = rvba(adoucir(base, l, h, 2))
  const d = deflouer(flou, l, h, 2)
  assert.ok(ecart(d, net) < 0.85 * ecart(flou, net), ecart(flou, net) + ' → ' + ecart(d, net))
  assert.ok(flouDe(d, l, h).sigma < 0.6 * flouDe(flou, l, h).sigma, 'flou restant : ' + flouDe(d, l, h).sigma)
  /* Le bord gauche de la barre (x = 220) : 5 px de rampe floue, 2 nette. */
  assert.ok(bord(d, l, 120, 205, 235) <= 3 && bord(flou, l, 120, 205, 235) >= 5, bord(flou, l, 120, 205, 235) + ' → ' + bord(d, l, 120, 205, 235))
})

test('un logo détouré flou : son bord transparent redevient franc, sa couleur reste la sienne', () => {
  const l = 120, h = 120, n = l * h
  const a = new Float32Array(n)
  for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) a[y * l + x] = Math.hypot(x - 60, y - 60) < 35 ? 255 : 0
  const b = adoucir(a, l, h, 2)
  const flou = new Uint8ClampedArray(n * 4)
  for (let p = 0; p < n; p++) flou.set([200, 20, 40, Math.round(b[p])], p * 4)
  const d = deflouer(flou, l, h, 2)
  /* La rampe de l'opacité, le long d'un rayon : plus courte. */
  const rampe = img => { let k = 0; for (let x = 60; x < l; x++) { const v = img[(60 * l + x) * 4 + 3]; if (v > 25 && v < 230) k++ } return k }
  assert.ok(rampe(d) < rampe(flou), rampe(flou) + ' → ' + rampe(d))
  for (let x = 60; x < 94; x++) {
    const i = (60 * l + x) * 4
    if (d[i + 3] < 64) continue
    assert.ok(Math.abs(d[i] - 200) < 16 && d[i + 1] < 40 && Math.abs(d[i + 2] - 40) < 16, 'x ' + x + ' : ' + [...d.subarray(i, i + 4)])
  }
})

test('rendre net : trop peu de flou ne touche rien ; un grand flou se réduit d\'abord, jamais sous le minimum', () => {
  const img = { data: rvba(dessin(200, 150)), largeur: 200, hauteur: 150 }
  const rien = rendreNet(img, 0.4)
  assert.equal(rien.sigma, 0)
  assert.equal(rien.data, img.data)
  const grand = rendreNet(img, 12)
  assert.ok(grand.largeur < 200 && Math.abs(grand.sigma - SIGMA_MAX) < 0.1, grand.largeur + ' px, σ ' + grand.sigma)
  const borne = rendreNet(img, 12, { min: 150 })
  assert.equal(borne.largeur, 150)
})

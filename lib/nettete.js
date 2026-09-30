/* ================================================================ LA NETTETÉ
   30 septembre 2026 : « sur le site PicWish, il y a une feature qui passe
   une image floue à une image nette — j'aimerais l'ajouter à mon app ».
   Ce module mesure le flou d'une image : l'écart type σ, en pixels, du flou
   gaussien qui l'aurait adoucie (une photo mise au point à côté, un logo
   agrandi dix fois de capture en capture). */

/* L'ADOUCI GAUSSIEN d'un plan de `l` × `h` valeurs : `sigma` pixels, en
   largeur puis en hauteur ; hors de l'image, le bord se prolonge. */
export function adoucir(v, l, h, sigma) {
  if (!(sigma > 0)) return Float32Array.from(v)
  const R = Math.max(1, Math.ceil(3 * sigma)), k = new Float32Array(2 * R + 1)
  let somme = 0
  for (let i = -R; i <= R; i++) somme += (k[i + R] = Math.exp(-i * i / (2 * sigma * sigma)))
  for (let i = 0; i < k.length; i++) k[i] /= somme
  const t = new Float32Array(l * h), o = new Float32Array(l * h)
  for (let y = 0; y < h; y++) {
    const ligne = y * l
    for (let x = 0; x < l; x++) {
      let s = 0
      for (let i = -R; i <= R; i++) s += k[i + R] * v[ligne + Math.min(l - 1, Math.max(0, x + i))]
      t[ligne + x] = s
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      let s = 0
      for (let i = -R; i <= R; i++) s += k[i + R] * t[Math.min(h - 1, Math.max(0, y + i)) * l + x]
      o[y * l + x] = s
    }
  }
  return o
}

/* LA LUMINOSITÉ d'une image RVBA, posée sur du blanc. */
export function luminosite(rgba, n) {
  const L = new Float32Array(n)
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    const a = rgba[i + 3] / 255
    L[p] = (0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]) * a + 255 * (1 - a)
  }
  return L
}

/* Le plan réduit de moitié (moyenne de 2 × 2). */
function moitie(v, l, h) {
  const L = l >> 1, H = h >> 1, o = new Float32Array(L * H)
  for (let y = 0; y < H; y++) for (let x = 0; x < L; x++) {
    const p = 2 * y * l + 2 * x
    o[y * L + x] = (v[p] + v[p + 1] + v[p + l] + v[p + l + 1]) / 4
  }
  return { v: o, l: L, h: H }
}

/* LE FLOU MESURÉ SUR LES BORDS (Zhuo et Sim, 2011, « Defocus map estimation
   from a single image ») : un bord franc adouci de σ a une pente
   A / (σ √2π) ; adouci encore de σ0, sa pente baisse d'autant plus que le
   bord était franc. Le rapport R des deux pentes donne σ :
   σ² = σ0² / (R² − 1) − ce que la mesure adoucit elle-même (la dérivée,
   `SIGMA_D`, et la différence centrée, un tiers de pixel²). Seuls comptent
   les bords : le haut d'une pente (le long de sa direction), pente assez
   forte — le grain du JPEG, le bruit, un dégradé n'en sont pas —, et la
   médiane de leurs σ, chacun compté selon sa pente. `null` : pas assez de
   bords pour en juger (une image unie). */
export const SIGMA_D = 1
export const SIGMA_0 = 2
export const PENTE_MIN = 3
export const BORDS_MIN = 200
function flouDuPlan(L, l, h) {
  const g1 = adoucir(L, l, h, SIGMA_D)
  const g2 = adoucir(L, l, h, Math.hypot(SIGMA_D, SIGMA_0))
  const n = l * h
  const m1 = new Float32Array(n), dir = new Uint8Array(n)
  let haut = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < l - 1; x++) {
      const p = y * l + x
      const gx = (g1[p + 1] - g1[p - 1]) / 2, gy = (g1[p + l] - g1[p - l]) / 2
      const m = Math.hypot(gx, gy)
      m1[p] = m
      if (m > haut) haut = m
      /* La direction de la pente, en quatre : 0 → , 1 ↘ , 2 ↓ , 3 ↙ . */
      const a = Math.atan2(gy, gx) * 4 / Math.PI
      dir[p] = ((Math.round(a) % 4) + 4) % 4
    }
  }
  const PAS = [1, l + 1, l, l - 1]
  const bords = []
  /* Les bords qui comptent : au moins le quart des plus francs de l'image. */
  const seuil = Math.max(PENTE_MIN, haut / 4)
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < l - 2; x++) {
      const p = y * l + x, m = m1[p]
      if (m < seuil) continue
      const d = PAS[dir[p]]
      if (m < m1[p - d] || m < m1[p + d]) continue
      const gx = (g2[p + 1] - g2[p - 1]) / 2, gy = (g2[p + l] - g2[p - l]) / 2
      const R = m / Math.hypot(gx, gy)
      if (!(R > 1.0001)) continue
      const s2 = SIGMA_0 * SIGMA_0 / (R * R - 1) - SIGMA_D * SIGMA_D - 1 / 3
      bords.push([Math.sqrt(Math.max(0, s2)), m])
    }
  }
  if (bords.length < BORDS_MIN) return null
  bords.sort((a, b) => a[0] - b[0])
  let total = 0
  for (const b of bords) total += b[1]
  let cumul = 0
  for (const b of bords) if ((cumul += b[1]) >= total / 2) return { sigma: b[0], bords: bords.length }
  return null
}

/* LE FLOU D'UNE IMAGE (RVBA, `largeur` × `hauteur`), en pixels de cette
   image. Mesuré au plus sur `COTE_MESURE` pixels de grand côté : un flou
   qui ne s'y voit pas ne se verra pas non plus imprimé. Un grand flou se
   mesure mal (les deux pentes se ressemblent) : au-delà de `LOIN`, l'image
   se réduit de moitié et se mesure encore — son σ aussi. */
export const COTE_MESURE = 2048
export const LOIN = 2.5
export function flouDe(rgba, largeur, hauteur) {
  let v = luminosite(rgba, largeur * hauteur), l = largeur, h = hauteur, f = 1
  while (Math.max(l, h) > COTE_MESURE) { ({ v, l, h } = moitie(v, l, h)); f *= 2 }
  let r = flouDuPlan(v, l, h)
  while (r && r.sigma > LOIN && Math.min(l, h) >= 128) {
    ({ v, l, h } = moitie(v, l, h)); f *= 2
    const s = flouDuPlan(v, l, h)
    if (!s) break
    r = s
  }
  return r && { sigma: r.sigma * f, bords: r.bords }
}

/* ================================================================ LA NETTETÉ
   30 septembre 2026 : « sur le site PicWish, il y a une feature qui passe
   une image floue à une image nette — j'aimerais l'ajouter à mon app ».
   Ce module mesure le flou d'une image — l'écart type σ, en pixels, du
   flou gaussien qui l'aurait adoucie : une photo mise au point à côté, un
   logo agrandi dix fois de capture en capture — et le retire (`deflouer`,
   `rendreNet`). */
import { reduire } from './vectoriser.js'

/* L'ADOUCI GAUSSIEN d'un plan de `l` × `h` valeurs : `sigma` pixels, en
   largeur puis en hauteur ; hors de l'image, le bord se prolonge. `o` et
   `t` : la sortie et un plan de passage, pour ne pas en refaire à chaque
   appel (la déconvolution en fait des dizaines). */
export function adoucir(v, l, h, sigma, o = new Float32Array(l * h), t = new Float32Array(l * h)) {
  if (!(sigma > 0)) { o.set(v); return o }
  const R = Math.max(1, Math.ceil(3 * sigma)), k = new Float32Array(2 * R + 1)
  let somme = 0
  for (let i = -R; i <= R; i++) somme += (k[i + R] = Math.exp(-i * i / (2 * sigma * sigma)))
  for (let i = 0; i < k.length; i++) k[i] /= somme
  for (let y = 0; y < h; y++) {
    const ligne = y * l
    for (let x = 0; x < l; x++) {
      let s = 0
      if (x >= R && x < l - R) for (let i = -R, q = ligne + x - R; i <= R; i++, q++) s += k[i + R] * v[q]
      else for (let i = -R; i <= R; i++) s += k[i + R] * v[ligne + Math.min(l - 1, Math.max(0, x + i))]
      t[ligne + x] = s
    }
  }
  for (let y = 0; y < h; y++) {
    const dedans = y >= R && y < h - R
    for (let x = 0; x < l; x++) {
      let s = 0
      if (dedans) for (let i = -R, q = (y - R) * l + x; i <= R; i++, q += l) s += k[i + R] * t[q]
      else for (let i = -R; i <= R; i++) s += k[i + R] * t[Math.min(h - 1, Math.max(0, y + i)) * l + x]
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
  const n = l * h, m1 = new Float32Array(n)
  let haut = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < l - 1; x++) {
      const p = y * l + x
      const gx = g1[p + 1] - g1[p - 1], gy = g1[p + l] - g1[p - l]
      const m = Math.sqrt(gx * gx + gy * gy) / 2
      m1[p] = m
      if (m > haut) haut = m
    }
  }
  /* Adoucie encore de σ0 — seulement autour des bords retenus : sur toute
     l'image, c'était les trois quarts du temps de la mesure, faite sur la
     page à l'ouverture d'un fichier. */
  const R0 = Math.ceil(3 * SIGMA_0), k0 = new Float32Array(2 * R0 + 1)
  let somme = 0
  for (let i = -R0; i <= R0; i++) somme += (k0[i + R0] = Math.exp(-i * i / (2 * SIGMA_0 * SIGMA_0)))
  for (let i = 0; i < k0.length; i++) k0[i] /= somme
  const g2 = q => {
    let s = 0
    for (let j = -R0; j <= R0; j++) {
      let r = 0
      for (let i = -R0, b = q + j * l - R0; i <= R0; i++, b++) r += k0[i + R0] * g1[b]
      s += k0[j + R0] * r
    }
    return s
  }
  /* La direction de la pente, en quatre : → , ↘ , ↓ , ↙ . */
  const T = Math.tan(Math.PI / 8)
  const bords = []
  /* Les bords qui comptent : au moins le quart des plus francs de l'image. */
  const seuil = Math.max(PENTE_MIN, haut / 4)
  for (let y = R0 + 1; y < h - R0 - 1; y++) {
    for (let x = R0 + 1; x < l - R0 - 1; x++) {
      const p = y * l + x, m = m1[p]
      if (m < seuil) continue
      const gx = g1[p + 1] - g1[p - 1], gy = g1[p + l] - g1[p - l], ax = Math.abs(gx), ay = Math.abs(gy)
      const d = ay <= T * ax ? 1 : ax <= T * ay ? l : gx * gy > 0 ? l + 1 : l - 1
      if (m < m1[p - d] || m < m1[p + d]) continue
      const hx = (g2(p + 1) - g2(p - 1)) / 2, hy = (g2(p + l) - g2(p - l)) / 2
      const R = m / Math.sqrt(hx * hx + hy * hy)
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

/* ============================================================ LE DÉFLOUTAGE
   Richardson et Lucy (1972, 1974) : l'image nette u dont le flou redonne le
   fichier f, cherchée pas à pas — u ← u · G ∗ (f / G ∗ u), G le flou
   gaussien mesuré (`flouDe`). Chaque pas rapproche le flou de u du
   fichier : ce qui en sort se vérifie contre lui, rien ne s'invente (ni
   lettre, ni couleur qui n'y soit pas déjà, étalée). Les couleurs se
   défloutent prémultipliées par leur opacité — le flou mêle le dessin au
   transparent, pas au blanc —, l'opacité à part : le bord adouci d'un logo
   détouré redevient franc. `iterations` : au-delà, le grain du JPEG
   remonte avec le détail. Chaque pas est poussé plus loin dans la
   direction des deux derniers (Biggs et Andrews, 1997) : douze pas font
   ce que trente faisaient (mesuré sur deux logos flous, 30 septembre
   2026 : le même écart au logo net, deux fois et demie plus vite). */
export const ITERATIONS = 12

/* Un pas de Richardson–Lucy, poussé de `a` : `u` (l'estimation) et
   `avant` (la précédente) avancent ; `g`, le dernier déplacement, est
   remplacé par le nouveau — `d` reçoit ce qu'il faut pour le pas suivant
   (le produit du nouveau par l'ancien, et le carré de l'ancien). `tv` :
   le poids de la variation totale (`variation`). `t` : quatre plans de
   passage. */
function pas(f, u, avant, g, l, h, sigma, a, t, d, tv) {
  const n = l * h, [y, flou, passe, cor] = t
  for (let p = 0; p < n; p++) y[p] = Math.max(1e-3, u[p] + a * (u[p] - avant[p]))
  adoucir(y, l, h, sigma, flou, passe)
  for (let p = 0; p < n; p++) flou[p] = f[p] / flou[p]
  adoucir(flou, l, h, sigma, cor, passe)
  if (tv > 0) variation(y, l, h, tv, cor, flou, passe)
  avant.set(u)
  for (let p = 0; p < n; p++) {
    const v = y[p] * cor[p], nouveau = v - y[p]
    d[0] += nouveau * g[p]; d[1] += g[p] * g[p]
    g[p] = nouveau; u[p] = v
  }
}

/* LA VARIATION TOTALE (Dey et al., 2006) : chaque pas se divise par
   1 − λ div(∇u / |∇u|) — la courbure des lignes de niveau. Un aplat qui
   ondule (l'écho d'un bord : un creux sombre dans la lettre, un liseré
   dans le fond, que les couleurs bornées ne voient pas — ils restent
   entre les deux couleurs du bord) se calme, un bord franc reste franc :
   ce qu'est un logo, des aplats et des bords. Jugé à l'œil le 30
   septembre 2026 sur le t-shirt, AUTOMAX et 6e3 : à λ = 0,004 le contour
   sombre des lettres reste, à 0,016 il part ; `TV_EPS` (en niveaux) laisse
   le grain fin tranquille — à 1, les aplats se hachuraient en
   diagonale. Sur un flou exactement gaussien, elle coûte de 0,3 à 0,9 dB
   sur quatre images (il en reste jusqu'à 4 de gagnés) : le prix d'un bord
   sans écho. `cor` est modifié sur place ; `nx`, `ny` : deux plans de
   passage. */
export const TV = 0.016
export const TV_EPS = 4
function variation(u, l, h, lambda, cor, nx, ny) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      const p = y * l + x
      const dx = x < l - 1 ? u[p + 1] - u[p] : 0, dy = y < h - 1 ? u[p + l] - u[p] : 0
      const m = Math.sqrt(dx * dx + dy * dy + TV_EPS * TV_EPS)
      nx[p] = dx / m; ny[p] = dy / m
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      const p = y * l + x
      const div = nx[p] - (x > 0 ? nx[p - 1] : 0) + ny[p] - (y > 0 ? ny[p - l] : 0)
      cor[p] /= Math.max(0.5, 1 - lambda * div)
    }
  }
}
export function deflouer(rgba, largeur, hauteur, sigma, { iterations = ITERATIONS, progres = () => {}, tv = TV } = {}) {
  const n = largeur * hauteur
  const sortie = new Uint8ClampedArray(rgba)
  if (!(sigma > 0) || !iterations) return sortie
  let transparent = false
  for (let i = 3; i < rgba.length && !transparent; i += 4) transparent = rgba[i] < 255
  /* Un plan : un canal prémultiplié, décalé d'un niveau (ni zéro ni
     division par zéro). */
  const plans = []
  for (let c = 0; c < (transparent ? 4 : 3); c++) {
    const f = new Float32Array(n)
    for (let p = 0, i = c; p < n; p++, i += 4) f[p] = (c === 3 ? rgba[i] : rgba[i] * rgba[i - c + 3] / 255) + 1
    plans.push({ f, u: Float32Array.from(f), avant: Float32Array.from(f), g: new Float32Array(n) })
  }
  const t = [0, 1, 2, 3].map(() => new Float32Array(n))
  /* Tous les plans avancent du même pas : une couleur et son opacité,
     proportionnelles dans le fichier, le restent — divisée par l'opacité,
     la couleur ne déborde pas. */
  let a = 0
  for (let k = 0; k < iterations; k++) {
    const d = [0, 0]
    for (const P of plans) pas(P.f, P.u, P.avant, P.g, largeur, hauteur, sigma, a, t, d, tv)
    a = k > 0 && d[1] > 0 ? Math.min(0.95, Math.max(0, d[0] / d[1])) : 0
    progres((k + 1) / iterations)
  }
  const nets = plans.map(P => P.u)
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    /* L'opacité défloutée peut sonner au-delà de 255 : la couleur se
       divise par elle telle quelle (la sienne sonne d'autant). */
    const brute = transparent ? nets[3][p] - 1 : 255, a = Math.min(255, Math.max(0, brute))
    sortie[i + 3] = a
    /* Presque transparent : la couleur du fichier reste (divisée par
       presque rien, elle ne dirait rien). */
    if (a < 8) continue
    /* Au bord d'un dessin détouré, la couleur du fichier est déjà la
       bonne — le flou n'y a mêlé que du transparent — et la diviser par
       une opacité qui sonne la ferait déborder : elle reste, et laisse la
       place à la couleur défloutée à mesure que le fichier devient
       opaque. */
    const w = Math.min(1, Math.max(0, (rgba[i + 3] - 64) / 128))
    for (let c = 0; c < 3; c++) sortie[i + c] = w * (nets[c][p] - 1) * 255 / brute + (1 - w) * rgba[i + c]
  }
  /* L'ÉCHO DU BORD. Un bord déflouté sonne : un liseré plus clair que la
     lettre le long de son bord, un plus sombre que le fond de l'autre côté
     — que l'IA redessine ensuite en contour de néon (30 septembre 2026, le
     t-shirt « I'M HIS FAVORITE EX » : des lettres rouges cerclées de rose
     et de noir). Canal par canal, chaque pixel reste entre le plus sombre
     et le plus clair du fichier à deux flous alentour — là où le bord
     flou atteint ses deux couleurs —, comme le dessin de l'IA
     (lib/nettoyage.js, `borner`) : le bord se resserre, aucune couleur
     ne naît. */
  borner(sortie, rgba, largeur, hauteur, Math.max(1, Math.ceil(2 * sigma)))
  return sortie
}

/* LES COULEURS BORNÉES : chaque canal de `img` entre le plus petit et le
   plus grand du même canal dans `src` à `rayon` pixels alentour. Les
   couleurs vraies, pas posées sur du blanc : seuls comptent les pixels du
   fichier assez opaques pour en avoir une (le bord d'un logo détouré n'a
   pas à pâlir vers le blanc) ; sans aucun alentour, le pixel reste. */
export function borner(img, src, l, h, rayon) {
  const n = l * h
  for (let c = 0; c < 3; c++) {
    let lo = new Uint8Array(n), hi = new Uint8Array(n)
    for (let p = 0, i = c; p < n; p++, i += 4) {
      const vu = src[i - c + 3] >= 32
      lo[p] = vu ? src[i] : 255; hi[p] = vu ? src[i] : 0
    }
    /* Le plus petit et le plus grand sur (2 rayon + 1)², en largeur puis
       en hauteur. */
    for (const [pas, long, lignes, saut] of [[1, l, h, l], [l, h, l, 1]]) {
      const lo2 = new Uint8Array(n), hi2 = new Uint8Array(n)
      for (let a = 0; a < lignes; a++) {
        for (let b = 0; b < long; b++) {
          let m = 255, M = 0
          for (let d = Math.max(0, b - rayon); d <= Math.min(long - 1, b + rayon); d++) {
            const q = a * saut + d * pas
            if (lo[q] < m) m = lo[q]
            if (hi[q] > M) M = hi[q]
          }
          lo2[a * saut + b * pas] = m; hi2[a * saut + b * pas] = M
        }
      }
      lo = lo2; hi = hi2
    }
    for (let p = 0, i = c; p < n; p++, i += 4) {
      if (lo[p] > hi[p]) continue
      if (img[i] < lo[p]) img[i] = lo[p]
      else if (img[i] > hi[p]) img[i] = hi[p]
    }
  }
  return img
}

/* ================================================= L'IMAGE RENDUE NETTE
   Ce que fait « Rendre net » (lib/detourage-travail.js) : l'image que va
   voir le modèle de l'Amélioration IA, défloutée d'abord — le modèle la
   redessine ensuite ×4, et son dessin se juge contre elle.
   - Le flou mesuré (`flouDe`) est un peu trop grand sur un fichier passé
     en JPEG (son grain compte pour du flou) : déflouté du flou entier, un
     bord sonne — un liseré clair le long d'un filet, que le modèle
     redessine en trait. D'où `SOUS` : 85 % du flou mesuré (sur le logo
     AUTOMAX flouté de 2 px, mesuré 2,4 : +3,0 dB à 2,4, +5,6 à 2).
   - Au-delà de `SIGMA_MAX` pixels, l'image se réduit d'abord jusque-là :
     un flou pareil ne laisse aucun détail plus fin, et la déconvolution
     coûte comme la largeur du flou.
     Jamais sous `min` pixels de grand côté : le modèle la redessine ×4,
     et le logo ne doit pas en sortir plus petit que le fichier reçu (sa
     taille imprimée en dépend).
   `img` : l'image RVBA ; `sigma` : son flou, en ses pixels. Rend l'image
   nette (peut-être réduite) et le flou retiré, en ses pixels à elle — 0 :
   rien à retirer, l'image telle quelle. */
export const SOUS = 0.85
export const SIGMA_MAX = 3
export const SIGMA_UTILE = 0.5
export function rendreNet(img, sigma, { iterations = ITERATIONS, progres = () => {}, min = 16 } = {}) {
  let s = sigma * SOUS
  if (!(s >= SIGMA_UTILE)) return { ...img, sigma: 0 }
  let r = img
  const cote = Math.max(img.largeur, img.hauteur), vise = Math.max(min, Math.round(cote * SIGMA_MAX / s))
  if (vise < cote) {
    r = reduire(img.data, img.largeur, img.hauteur, vise)
    s *= r.largeur / img.largeur
  }
  return { data: deflouer(r.data, r.largeur, r.hauteur, s, { iterations, progres }), largeur: r.largeur, hauteur: r.hauteur, sigma: s }
}

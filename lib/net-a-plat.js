/* DES BORDS NETS POUR UN LOGO À PLAT (23 novembre 2026, « je ne comprends
   toujours pas pourquoi les lignes du logo refait via Logo maker sont aussi
   moches, floues et pixelisées : il faut de belles lignes »).

   L'IA agrandit un JPEG de WhatsApp de 900 px : ses bords sortent mous, en
   aquarelle, un liseré pâle autour des traits foncés (le bloc du JPEG,
   agrandi), et `fidele` la tient à ce fichier. Un logo à plat n'a pourtant
   que quelques teintes, et chaque bord sépare deux d'entre elles. Alors :
   - chaque pixel se lit comme le mélange de ses deux teintes les plus
     proches (comme lib/reteindre.js) — sa part de chacune ;
   - ces parts, teinte par teinte, sont lissées d'un flou léger (σ ≈ 0,3
     pixel du fichier reçu : l'escalier et le bruit du JPEG partent, un
     trait d'un pixel du fichier reste) ;
   - chaque pixel prend la teinte qui l'emporte, et le bord se redessine à
     sa place exacte — là où les deux parts s'égalent —, anticrénelé sur un
     pixel (la part divisée par sa pente : une distance au bord).
   Les aplats sortent pleins, de la teinte du fichier ; les bords nets et
   doux à toutes les tailles. Des PIXELS, rien n'est tracé (Détouré et Image
   le gardent). Seulement si le logo est vraiment à plat : plus de 6 % de
   pixels loin de toute paire de teintes (une illustration, un dégradé, une
   photo), ou plus de 8 teintes, et rien ne change. Le vide (transparent ou
   presque) ne bouge pas. */
import { paletteAuto } from './vectoriser.js'

const OPAQUE = 250
const LOIN = 56 * 56
export const HORS_MAX = 0.06
export const TEINTES_MAX = 8
export const DETAIL = 0.6

export function netAPlat(data, largeur, hauteur, { echelle = 4, palette } = {}) {
  const N = largeur * hauteur
  const pal = sansMelanges(palette && palette.length ? palette : paletteAuto(data)).slice(0, TEINTES_MAX + 1)
  if (pal.length < 2 || pal.length > TEINTES_MAX) return { change: false, raison: 'teintes', teintes: pal.length }
  const K = pal.length
  /* Les parts de chaque teinte (0 à 255), et la paire de chaque pixel. */
  const parts = Array.from({ length: K }, () => new Uint8ClampedArray(N))
  const memo = new Map()
  let opaques = 0, hors = 0, tous = true
  for (let p = 0, i = 0; p < N; p++, i += 4) {
    if (data[i + 3] < OPAQUE) { tous = false; continue }
    opaques++
    const cle = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]
    let m = memo.get(cle)
    if (m === undefined) memo.set(cle, m = melange(data[i], data[i + 1], data[i + 2], pal))
    if (m.loin) hors++
    parts[m.k1][p] += Math.round(255 * (1 - m.t))
    parts[m.k2][p] += Math.round(255 * m.t)
  }
  if (!opaques || hors > HORS_MAX * opaques) return { change: false, raison: 'pas-a-plat', hors: opaques ? hors / opaques : 0 }
  /* Le flou, puis une part du détail d'origine rendue (`DETAIL`) : un
     trait fin et pâle (60 % d'encre sur quatre pixels) ne passe pas sous
     la moitié — il reste ; l'escalier et le bruit, eux, s'adoucissent. */
  const sigma = Math.max(0.8, 0.3 * echelle)
  for (const u of parts) {
    const brut = u.slice()
    flouter(u, largeur, hauteur, sigma)
    for (let p = 0; p < N; p++) u[p] += DETAIL * (brut[p] - u[p])
  }
  /* Le poids de l'opaque, flouté pareil : près du vide, les parts se
     rapportent à ce qui est opaque autour (sinon le bord du vide mangerait
     les teintes). */
  let poids = null
  if (!tous) {
    poids = new Uint8ClampedArray(N)
    for (let p = 0; p < N; p++) poids[p] = data[p * 4 + 3] >= OPAQUE ? 255 : 0
    flouter(poids, largeur, hauteur, sigma)
  }
  const ecart = (p, a, b) => parts[a][p] - parts[b][p]
  /* La teinte qui l'emporte, pixel par pixel (VIDE : le vide, intouché). */
  const gagnant = new Uint8Array(N).fill(VIDE)
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      const p = y * largeur + x, i = p * 4
      if (data[i + 3] < OPAQUE) continue
      let k1 = 0, k2 = 1, u1 = -1, u2 = -1
      for (let k = 0; k < K; k++) {
        const u = parts[k][p]
        if (u > u1) { u2 = u1; k2 = k1; u1 = u; k1 = k } else if (u > u2) { u2 = u; k2 = k }
      }
      if (poids && !poids[p]) continue
      gagnant[p] = k1
      /* La distance au bord : l'écart des deux parts sur sa pente. */
      const D = u1 - u2
      const gx = (x > 0 && x < largeur - 1) ? (ecart(p + 1, k1, k2) - ecart(p - 1, k1, k2)) / 2 : 0
      const gy = (y > 0 && y < hauteur - 1) ? (ecart(p + largeur, k1, k2) - ecart(p - largeur, k1, k2)) / 2 : 0
      const g = Math.hypot(gx, gy)
      const f = g > 0 ? Math.min(1, 0.5 + D / g) : 1
      const a = pal[k1], b = pal[k2]
      data[i] = f * a[0] + (1 - f) * b[0]
      data[i + 1] = f * a[1] + (1 - f) * b[1]
      data[i + 2] = f * a[2] + (1 - f) * b[2]
    }
  }
  const liseres = sansLiseres(data, largeur, hauteur, gagnant, pal, LISERE * echelle)
  return { change: true, teintes: K, hors: hors / opaques, sigma, liseres }
}

/* LES LISERÉS (24 novembre 2026, essai sur le logo New Balance) : l'IA
   laisse au bord d'un aplat bleu sur du blanc une ligne d'un pixel plus
   sombre que le bleu — son écho, pas le dessin —, et la passe la rendait
   bleu nuit franc : un cerne partout où le fichier n'en a pas. Une bande
   d'une teinte plus fine que `LISERE` pixel du fichier reçu, prise entre
   deux AUTRES teintes, en est un : elle devient le fondu de ses deux
   voisines, au prorata de leur distance (le bord reste doux). Un vrai
   contour fait au moins un pixel du fichier ; un trait fin sur UN fond
   (du gris sur du blanc des deux côtés) n'est pas pris entre deux
   teintes : il reste. */
export const LISERE = 0.8
const VIDE = 255
function sansLiseres(data, largeur, hauteur, gagnant, pal, epaisseur) {
  const R = Math.ceil(epaisseur)
  if (R < 1) return 0
  const K = pal.length
  const dist = new Float32Array(K)
  /* Huit sondes à la distance R : toutes de la même teinte, le pixel est
     loin de tout bord assez proche pour faire une bande fine. */
  const sondes = []
  for (let a = 0; a < 8; a++) sondes.push([Math.round(R * Math.cos(a * Math.PI / 4)), Math.round(R * Math.sin(a * Math.PI / 4))])
  const fenetre = []
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const d = Math.hypot(dx, dy)
    if (d && d <= R + 0.5) fenetre.push([dx, dy, d])
  }
  let n = 0
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      const p = y * largeur + x, g = gagnant[p]
      if (g === VIDE) continue
      let pres = true
      for (const [dx, dy] of sondes) {
        const xx = Math.min(largeur - 1, Math.max(0, x + dx)), yy = Math.min(hauteur - 1, Math.max(0, y + dy))
        if (gagnant[yy * largeur + xx] !== g) { pres = false; break }
      }
      if (pres) continue
      dist.fill(Infinity)
      for (const [dx, dy, d] of fenetre) {
        const xx = x + dx, yy = y + dy
        if (xx < 0 || yy < 0 || xx >= largeur || yy >= hauteur) continue
        const t = gagnant[yy * largeur + xx]
        if (t !== VIDE && t !== g && d < dist[t]) dist[t] = d
      }
      let a = -1, b = -1
      for (let k = 0; k < K; k++) {
        if (k === g || dist[k] === Infinity) continue
        if (a < 0 || dist[k] < dist[a]) { b = a; a = k } else if (b < 0 || dist[k] < dist[b]) b = k
      }
      if (b < 0 || dist[a] + dist[b] - 1 >= epaisseur) continue
      const f = dist[b] / (dist[a] + dist[b]), A = pal[a], B = pal[b], i = p * 4
      data[i] = f * A[0] + (1 - f) * B[0]
      data[i + 1] = f * A[1] + (1 - f) * B[1]
      data[i + 2] = f * A[2] + (1 - f) * B[2]
      n++
    }
  }
  return n
}

/* LES TEINTES FRANCHES : un trait fin a plus de pixels de bord que de
   pixels pleins, et paletteAuto garde ses mélanges avec le fond (le gris
   d'un trait marine sur du blanc) comme des teintes. Ici, toute teinte
   posée sur le segment de deux autres (entre 12 et 88 %, à moins de 22
   niveaux du trait) part, quel que soit son poids : la plus alignée
   d'abord, jusqu'à ce qu'il n'en reste aucune. */
export function sansMelanges(pal) {
  const l = pal.map(c => c.slice())
  for (;;) {
    let pire = -1, mieux = 22 * 22
    for (let i = 0; i < l.length; i++) {
      for (let a = 0; a < l.length; a++) for (let b = a + 1; b < l.length; b++) {
        if (a === i || b === i) continue
        const A = l[a], B = l[b], C = l[i]
        const ab = [B[0] - A[0], B[1] - A[1], B[2] - A[2]]
        const l2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2
        if (!l2) continue
        const t = ((C[0] - A[0]) * ab[0] + (C[1] - A[1]) * ab[1] + (C[2] - A[2]) * ab[2]) / l2
        if (t < 0.12 || t > 0.88) continue
        const d = (C[0] - A[0] - t * ab[0]) ** 2 + (C[1] - A[1] - t * ab[1]) ** 2 + (C[2] - A[2] - t * ab[2]) ** 2
        if (d < mieux) { mieux = d; pire = i }
      }
    }
    if (pire < 0) return l
    l.splice(pire, 1)
  }
}

/* LA PAIRE DONT LE PIXEL EST LE MÉLANGE : de toutes les paires de
   teintes, celle dont le segment passe le plus près (un trait gris foncé
   fin sur du blanc est un mélange de gris et de blanc, même si le bleu
   est plus près de lui), et la part `t` de la seconde. `loin` : trop loin
   de tout segment pour en être un mélange. */
function melange(r, g, b, pal) {
  let k1 = 0, k2 = 0, t1 = 0, best = Infinity
  for (let i = 0; i < pal.length; i++) {
    for (let j = i + 1; j < pal.length; j++) {
      const a = pal[i], c = pal[j]
      const ab0 = c[0] - a[0], ab1 = c[1] - a[1], ab2 = c[2] - a[2]
      const l2 = ab0 * ab0 + ab1 * ab1 + ab2 * ab2
      let t = l2 ? ((r - a[0]) * ab0 + (g - a[1]) * ab1 + (b - a[2]) * ab2) / l2 : 0
      t = Math.max(0, Math.min(1, t))
      const d = (r - a[0] - t * ab0) ** 2 + (g - a[1] - t * ab1) ** 2 + (b - a[2] - t * ab2) ** 2
      if (d < best) { best = d; k1 = i; k2 = j; t1 = t }
    }
  }
  /* La teinte qui l'emporte en premier. */
  if (t1 > 0.5) return { k1: k2, k2: k1, t: 1 - t1, loin: best > LOIN }
  return { k1, k2, t: t1, loin: best > LOIN }
}

/* Un flou gaussien approché par trois moyennes glissantes (en place). */
function flouter(u, l, h, sigma) {
  const n = 3
  const wIdeal = Math.sqrt(12 * sigma * sigma / n + 1)
  let wl = Math.floor(wIdeal); if (wl % 2 === 0) wl--
  const wu = wl + 2
  const m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4))
  const tmp = new Float32Array(Math.max(l, h))
  for (let k = 0; k < n; k++) {
    const r = ((k < m ? wl : wu) - 1) / 2
    if (r < 1) continue
    boite(u, l, h, r, tmp)
  }
}
function boite(u, l, h, r, tmp) {
  const w = 2 * r + 1
  for (let y = 0; y < h; y++) {
    const o = y * l
    let s = 0
    for (let x = -r; x <= r; x++) s += u[o + Math.min(l - 1, Math.max(0, x))]
    for (let x = 0; x < l; x++) {
      tmp[x] = s / w
      s += u[o + Math.min(l - 1, x + r + 1)] - u[o + Math.max(0, x - r)]
    }
    for (let x = 0; x < l; x++) u[o + x] = tmp[x]
  }
  for (let x = 0; x < l; x++) {
    let s = 0
    for (let y = -r; y <= r; y++) s += u[Math.min(h - 1, Math.max(0, y)) * l + x]
    for (let y = 0; y < h; y++) {
      tmp[y] = s / w
      s += u[Math.min(h - 1, y + r + 1) * l + x] - u[Math.max(0, y - r) * l + x]
    }
    for (let y = 0; y < h; y++) u[y * l + x] = tmp[y]
  }
}

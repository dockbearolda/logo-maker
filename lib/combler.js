/* ================================================================ COMBLER
   12 octobre 2026 (les calques : « supprimer un objet qui me plaît pas »,
   sur un logo à plat). Un trou dans une image (RVBA) se rebouche de ce
   qui l'entoure, du calcul seul — la règle du fond remis uni sous une
   police posée (lib/texte.js, `poserZone`) :
   - l'anneau juste au-delà du trou (de 0 à `ANNEAU` pixels) dit le fond :
     sa couleur la plus fréquente à seize niveaux près, ou le vide ; si
     les trois cinquièmes de l'anneau en sont (à ΔE `UNI` — serré : un
     dégradé doux en avait trois cinquièmes à ΔE 10, et sortait en
     marche), le trou prend cette couleur d'un aplat — un fond blanc, un
     aplat de couleur, le vide d'un PNG ;
   - sinon (un dégradé, un fond qui change), il se comble de proche en
     proche depuis son bord : chaque pixel prend la moyenne (prémultipliée,
     le vide reste vide) de ses voisins connus, couche après couche — puis
     se détend (`RELAXATIONS` passes de Gauss–Seidel : chaque pixel du
     trou, la moyenne de ses quatre voisins) jusqu'à ne plus bouger d'un
     demi-niveau : le dégradé traverse le trou sans marche.
   Une photo ne se rebouche pas ici : c'est l'IA (MI-GAN,
   lib/detourage-travail.js, `comblerIA`). Pur : des pixels qui entrent,
   des pixels qui sortent. */
import { lab, ecartLab } from './lab.js'

export const ANNEAU = 6
const PART_UNIE = 0.6
export const UNI = 5
export const RELAXATIONS = 400

const mediane = v => { const t = v.slice().sort((a, b) => a - b); return t[t.length >> 1] }

/* LE TROU COMBLÉ : `masque`, 1 sur les pixels à refaire (`largeur` ×
   `hauteur`). `data` est modifié sur place et rendu. */
export function combler(data, largeur, hauteur, masque, { relaxations = RELAXATIONS } = {}) {
  const n = largeur * hauteur
  let x0 = largeur, y0 = hauteur, x1 = -1, y1 = -1, k = 0
  for (let p = 0; p < n; p++) {
    if (!masque[p]) continue
    const x = p % largeur, y = (p - x) / largeur
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
    k++
  }
  if (!k) return data
  /* La distance au trou (chanfrein 3-4, en tiers de pixel), dans le cadre
     élargi de l'anneau. */
  const X0 = Math.max(0, x0 - ANNEAU - 1), Y0 = Math.max(0, y0 - ANNEAU - 1), X1 = Math.min(largeur - 1, x1 + ANNEAU + 1), Y1 = Math.min(hauteur - 1, y1 + ANNEAU + 1)
  const l = X1 - X0 + 1, h = Y1 - Y0 + 1
  const d = new Uint32Array(l * h).fill(1e9)
  for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) if (masque[(Y0 + y) * largeur + X0 + x]) d[y * l + x] = 0
  for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) {
    const q = y * l + x
    if (x > 0) d[q] = Math.min(d[q], d[q - 1] + 3)
    if (y > 0) { d[q] = Math.min(d[q], d[q - l] + 3); if (x > 0) d[q] = Math.min(d[q], d[q - l - 1] + 4); if (x < l - 1) d[q] = Math.min(d[q], d[q - l + 1] + 4) }
  }
  for (let y = h - 1; y >= 0; y--) for (let x = l - 1; x >= 0; x--) {
    const q = y * l + x
    if (x < l - 1) d[q] = Math.min(d[q], d[q + 1] + 3)
    if (y < h - 1) { d[q] = Math.min(d[q], d[q + l] + 3); if (x < l - 1) d[q] = Math.min(d[q], d[q + l + 1] + 4); if (x > 0) d[q] = Math.min(d[q], d[q + l - 1] + 4) }
  }
  /* L'anneau : la couleur la plus fréquente, à seize niveaux près, ou le
     vide. */
  const cases = new Map()
  let anneau = 0
  for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) {
    const q = y * l + x
    if (d[q] === 0 || d[q] > 3 * ANNEAU) continue
    const p = (Y0 + y) * largeur + X0 + x, i = p * 4
    anneau++
    const c = data[i + 3] < 128 ? 'vide' : (data[i] >> 4) + ',' + (data[i + 1] >> 4) + ',' + (data[i + 2] >> 4)
    const e = cases.get(c) || []
    e.push(p)
    cases.set(c, e)
  }
  let tete = null, nb = 0
  for (const [c, ps] of cases) if (ps.length > nb) { nb = ps.length; tete = c }
  let fond = null, uni = false
  if (tete === 'vide') { fond = 'vide'; uni = nb >= PART_UNIE * anneau }
  else if (tete) {
    const ps = cases.get(tete)
    fond = [0, 1, 2].map(c => mediane(ps.map(p => data[p * 4 + c])))
    const lf = lab(fond)
    let proches = 0
    for (const ps2 of cases.values()) for (const p of ps2) if (data[p * 4 + 3] >= 128 && ecartLab(lab([data[p * 4], data[p * 4 + 1], data[p * 4 + 2]]), lf) <= UNI) proches++
    uni = proches >= PART_UNIE * anneau
  }
  if (uni && fond) {
    for (let p = 0; p < n; p++) {
      if (!masque[p]) continue
      const i = p * 4
      if (fond === 'vide') data[i + 3] = 0
      else { data[i] = fond[0]; data[i + 1] = fond[1]; data[i + 2] = fond[2]; data[i + 3] = 255 }
    }
    return data
  }
  /* De proche en proche depuis le bord : la moyenne prémultipliée des
     voisins connus, couche après couche. */
  const connu = new Uint8Array(n)
  let front = []
  for (let p = 0; p < n; p++) { if (masque[p]) front.push(p); else connu[p] = 1 }
  while (front.length) {
    const prets = [], reste = []
    for (const p of front) {
      const x = p % largeur, y = (p - x) / largeur
      let r = 0, g = 0, b = 0, a = 0, m = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const X = x + dx, Y = y + dy
          if ((!dx && !dy) || X < 0 || Y < 0 || X >= largeur || Y >= hauteur) continue
          const v = Y * largeur + X
          if (!connu[v]) continue
          const i = v * 4, al = data[i + 3] / 255
          r += data[i] * al; g += data[i + 1] * al; b += data[i + 2] * al; a += al; m++
        }
      }
      if (!m) { reste.push(p); continue }
      prets.push([p, a ? r / a : 0, a ? g / a : 0, a ? b / a : 0, 255 * a / m])
    }
    if (!prets.length) {
      for (const p of reste) data[p * 4 + 3] = 0
      break
    }
    for (const [p, r, g, b, a] of prets) { const i = p * 4; data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a; connu[p] = 1 }
    front = reste
  }
  /* La détente : en flottant, prémultiplié, sur les pixels du trou. */
  const trou = []
  for (let p = 0; p < n; p++) if (masque[p]) trou.push(p)
  const v = new Float32Array(n * 4)
  for (let p = 0; p < n; p++) { const i = p * 4, a = data[i + 3] / 255; v[i] = data[i] * a; v[i + 1] = data[i + 1] * a; v[i + 2] = data[i + 2] * a; v[i + 3] = a }
  for (let tour = 0; tour < relaxations; tour++) {
    let bouge = 0
    for (const p of trou) {
      const x = p % largeur, y = (p - x) / largeur, i = p * 4
      let r = 0, g = 0, b = 0, a = 0, m = 0
      if (x > 0) { r += v[i - 4]; g += v[i - 3]; b += v[i - 2]; a += v[i - 1]; m++ }
      if (x < largeur - 1) { r += v[i + 4]; g += v[i + 5]; b += v[i + 6]; a += v[i + 7]; m++ }
      if (y > 0) { const j = i - largeur * 4; r += v[j]; g += v[j + 1]; b += v[j + 2]; a += v[j + 3]; m++ }
      if (y < hauteur - 1) { const j = i + largeur * 4; r += v[j]; g += v[j + 1]; b += v[j + 2]; a += v[j + 3]; m++ }
      if (!m) continue
      r /= m; g /= m; b /= m; a /= m
      bouge = Math.max(bouge, Math.abs(r - v[i]), Math.abs(g - v[i + 1]), Math.abs(b - v[i + 2]), 255 * Math.abs(a - v[i + 3]))
      v[i] = r; v[i + 1] = g; v[i + 2] = b; v[i + 3] = a
    }
    if (bouge < 0.5) break
  }
  for (const p of trou) {
    const i = p * 4, a = v[i + 3]
    data[i] = a ? v[i] / a : 0; data[i + 1] = a ? v[i + 1] / a : 0; data[i + 2] = a ? v[i + 2] / a : 0; data[i + 3] = 255 * a
  }
  return data
}

/* LE MASQUE D'UN POLYGONE (`poly` : [[u, v]…] en fractions de l'image),
   1 sur les pixels dont le centre est dedans (pair-impair). */
export function masquePolygone(poly, largeur, hauteur) {
  const m = new Uint8Array(largeur * hauteur)
  if (!poly || poly.length < 3) return m
  const pts = poly.map(([u, v]) => [u * largeur, v * hauteur])
  let x0 = largeur, y0 = hauteur, x1 = -1, y1 = -1
  for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(hauteur - 1, Math.ceil(y1)); y++) {
    /* Les croisements de la rangée, triés : dedans entre deux. */
    const xs = []
    const cy = y + 0.5
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [ax, ay] = pts[j], [bx, by] = pts[i]
      if ((ay > cy) !== (by > cy)) xs.push(ax + (cy - ay) * (bx - ax) / (by - ay))
    }
    xs.sort((a, b) => a - b)
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x <= Math.min(largeur - 1, Math.floor(xs[k + 1] - 0.5)); x++) m[y * largeur + x] = 1
    }
  }
  return m
}

/* LE MASQUE ÉLARGI de `r` pixels (un carré de 2r + 1), pour que la marge
   d'un trou (l'anticrénelage de ce qui est parti) parte avec lui. */
export function elargirMasque(m, largeur, hauteur, r) {
  if (!(r > 0)) return m
  const t = new Uint8Array(m.length), d = new Uint8Array(m.length)
  for (let y = 0; y < hauteur; y++) {
    const o = y * largeur
    for (let x = 0; x < largeur; x++) {
      let v = 0
      for (let i = Math.max(0, x - r); i <= Math.min(largeur - 1, x + r) && !v; i++) v = m[o + i]
      t[o + x] = v
    }
  }
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      let v = 0
      for (let j = Math.max(0, y - r); j <= Math.min(hauteur - 1, y + r) && !v; j++) v = t[j * largeur + x]
      d[y * largeur + x] = v
    }
  }
  return d
}

/* ============================================================ TRANSFORMER
   12 octobre 2026 (les calques déplacés : « déplacer ou redimensionner un
   calque, au niveau de Photoshop, démonter un logo comme je le souhaite »).
   Un élément du logo — une forme d'un seul tenant, ou les lettres d'une
   ligne (lib/effacer.js, `selection`) — se DÉPLACE, se REDIMENSIONNE, se
   TOURNE, se RETOURNE. Sa transformation est dans les réglages, relative
   à sa place d'origine, en LARGEURS D'IMAGE (x / L, y / L pour les deux
   axes : un espace isotrope, une rotation y reste une rotation, et le
   même nombre vaut pour l'aperçu, l'image pleine et l'image agrandie
   par l'IA) :

     { pivot: [px, py], d: [dx, dy], angle, s: [sx, sy] }
     p' = pivot + d + R(angle) · S(sx, sy) · (p − pivot)

   — le modèle de Photoshop : l'échelle dans les axes propres du calque,
   la rotation, puis la translation. Cette forme est fermée sous tous les
   gestes (déplacer : d ; tourner : angle ; redimensionner : s, et d
   recalculé pour que le point fixe ne bouge pas ; retourner : sx < 0) et
   ne cisaille jamais.

   LES PIXELS (`transformer`) : en deux temps, pour que chaque élément se
   lise sur l'image d'origine (deux éléments qui échangent leurs places ne
   se gênent pas) — chaque sélection devient un sprite et se coupe ; le
   trou se rebouche quand l'élément était posé sur du dessin (`creuser` :
   la moitié de l'anneau opaque → lib/combler.js), sinon reste
   transparent ; puis chaque sprite se pose à sa nouvelle place, dans
   l'ordre (le dernier dessus), rééchantillonné par l'antécédent de chaque
   pixel d'arrivée — bicubique (Catmull-Rom, alpha prémultiplié, borné)
   quand il grandit ou tourne, bilinéaire sur-échantillonné quand il
   rétrécit. Déterministe, indépendant de la résolution.

   LES LETTRES D'UNE POLICE (`transformerPose`) : leurs courbes passent par
   la même matrice — exactes à toute taille et tout angle. Pur. */
import { selection } from './effacer.js'
import { combler, elargirMasque } from './combler.js'

export const IDENTITE = Object.freeze({ d: Object.freeze([0, 0]), angle: 0, s: Object.freeze([1, 1]) })

/* Une transformation qui ne fait rien (à un millionième près). */
export function estIdentite(t) {
  if (!t) return true
  const d = t.d || [0, 0], s = t.s || [1, 1]
  return Math.abs(d[0]) < 1e-6 && Math.abs(d[1]) < 1e-6 && Math.abs(((t.angle || 0) % 360 + 360) % 360) < 1e-6 && Math.abs(s[0] - 1) < 1e-6 && Math.abs(s[1] - 1) < 1e-6
}

/* LA MATRICE en pixels d'une image de `L` de large : [a, b, c, d, e, f],
   x' = a x + b y + e, y' = c x + d y + f. */
export function matriceDe(t, L = 1) {
  const [px, py] = t.pivot || [0, 0], [dx, dy] = t.d || [0, 0], [sx, sy] = t.s || [1, 1]
  const r = (t.angle || 0) * Math.PI / 180, co = Math.cos(r), si = Math.sin(r)
  const a = co * sx, b = -si * sy, c = si * sx, d = co * sy
  return [a, b, c, d, (px + dx - a * px - b * py) * L, (py + dy - c * px - d * py) * L]
}
export function inverse(M) {
  const [a, b, c, d, e, f] = M, det = a * d - b * c || 1e-12
  return [d / det, -b / det, -c / det, a / det, (b * f - d * e) / det, (c * e - a * f) / det]
}
export const appliquer = (M, x, y) => [M[0] * x + M[1] * y + M[4], M[2] * x + M[3] * y + M[5]]
/* Ce qu'une transformation fait, pour le dire : l'échelle (positive),
   l'angle, retournée ou non. */
export function decomposer(t) {
  const s = (t && t.s) || [1, 1]
  return { echelle: [Math.abs(s[0]), Math.abs(s[1])], angle: (t && t.angle) || 0, retourne: s[0] * s[1] < 0 }
}

/* LE TROU D'UN ÉLÉMENT COUPÉ : `masque`, 1 sur ses pixels. Ils
   deviennent transparents ; si la moitié au moins de l'anneau à deux
   pixels autour est opaque (l'élément était posé sur du dessin : un texte
   sur un badge), le trou — élargi d'un pixel, le liseré — se rebouche de
   ce qui l'entoure (lib/combler.js) ; sinon (sur le vide) il reste vide.
   Rend { rebouche }. */
export function creuser(data, largeur, hauteur, masque) {
  let opaques = 0, anneau = 0, x0 = largeur, y0 = hauteur, x1 = -1, y1 = -1
  for (let p = 0; p < largeur * hauteur; p++) {
    if (!masque[p]) continue
    const x = p % largeur, y = (p - x) / largeur
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
  }
  if (x1 < 0) return { rebouche: false }
  for (let y = Math.max(0, y0 - 2); y <= Math.min(hauteur - 1, y1 + 2); y++) {
    for (let x = Math.max(0, x0 - 2); x <= Math.min(largeur - 1, x1 + 2); x++) {
      const p = y * largeur + x
      if (masque[p]) continue
      let pres = false
      for (let dy = -2; dy <= 2 && !pres; dy++) {
        const Y = y + dy
        if (Y < 0 || Y >= hauteur) continue
        for (let dx = -2; dx <= 2; dx++) {
          const X = x + dx
          if (X < 0 || X >= largeur) continue
          if (masque[Y * largeur + X]) { pres = true; break }
        }
      }
      if (!pres) continue
      anneau++
      if (data[p * 4 + 3] >= 128) opaques++
    }
  }
  for (let p = 0; p < largeur * hauteur; p++) if (masque[p]) data[p * 4 + 3] = 0
  const rebouche = anneau > 0 && opaques >= 0.5 * anneau
  if (rebouche) combler(data, largeur, hauteur, elargirMasque(masque, largeur, hauteur, 1))
  return { rebouche }
}

/* UN SPRITE POSÉ : `sprite` { data (RVBA), largeur, hauteur, x, y } — ses
   pixels à (x, y) de l'image —, par la matrice `M` (pixels). Chaque pixel
   d'arrivée prend son antécédent, échantillonné dans le sprite en alpha
   prémultiplié, et se compose dessus. */
export function poserSprite(data, largeur, hauteur, sprite, M) {
  const { data: sd, largeur: sl, hauteur: sh, x: sx0, y: sy0 } = sprite
  if (!sl || !sh) return
  const coins = [[sx0, sy0], [sx0 + sl, sy0], [sx0, sy0 + sh], [sx0 + sl, sy0 + sh]].map(([x, y]) => appliquer(M, x, y))
  const X0 = Math.max(0, Math.floor(Math.min(...coins.map(c => c[0])) - 1)), X1 = Math.min(largeur - 1, Math.ceil(Math.max(...coins.map(c => c[0])) + 1))
  const Y0 = Math.max(0, Math.floor(Math.min(...coins.map(c => c[1])) - 1)), Y1 = Math.min(hauteur - 1, Math.ceil(Math.max(...coins.map(c => c[1])) + 1))
  if (X1 < X0 || Y1 < Y0) return
  const Mi = inverse(M)
  /* Le sprite en alpha prémultiplié (0 à 1). */
  const pm = new Float32Array(sl * sh * 4)
  for (let q = 0; q < sl * sh; q++) {
    const a = sd[q * 4 + 3] / 255
    pm[q * 4] = sd[q * 4] / 255 * a; pm[q * 4 + 1] = sd[q * 4 + 1] / 255 * a; pm[q * 4 + 2] = sd[q * 4 + 2] / 255 * a; pm[q * 4 + 3] = a
  }
  /* L'échelle de la matrice sur chaque axe : rétrécie, on sur-échantillonne. */
  const ex = Math.hypot(M[0], M[2]), ey = Math.hypot(M[1], M[3])
  const k = Math.min(8, Math.max(1, Math.ceil(1 / Math.max(1e-6, Math.min(ex, ey)))))
  /* Déplacé, agrandi ou tourné : bicubique ; rétréci : bilinéaire sur
     k × k points par pixel d'arrivée. */
  const bicubique = k === 1
  const sortie = new Float32Array(4)
  const lire = (u, v, o) => {
    /* (u, v) : en pixels du sprite, le centre du pixel (i, j) en (i + 0.5, j + 0.5). */
    const fx = u - 0.5, fy = v - 0.5
    if (bicubique) {
      const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy
      const wx = poids(tx), wy = poids(ty)
      for (let ch = 0; ch < 4; ch++) o[ch] = 0
      for (let j = -1; j <= 2; j++) {
        const y = iy + j
        if (y < 0 || y >= sh) continue
        for (let i = -1; i <= 2; i++) {
          const x = ix + i
          if (x < 0 || x >= sl) continue
          const w = wx[i + 1] * wy[j + 1], q = (y * sl + x) * 4
          o[0] += pm[q] * w; o[1] += pm[q + 1] * w; o[2] += pm[q + 2] * w; o[3] += pm[q + 3] * w
        }
      }
      o[3] = Math.min(1, Math.max(0, o[3]))
      for (let ch = 0; ch < 3; ch++) o[ch] = Math.min(o[3], Math.max(0, o[ch]))
      return
    }
    const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy
    for (let ch = 0; ch < 4; ch++) o[ch] = 0
    for (let j = 0; j <= 1; j++) {
      const y = iy + j
      if (y < 0 || y >= sh) continue
      for (let i = 0; i <= 1; i++) {
        const x = ix + i
        if (x < 0 || x >= sl) continue
        const w = (i ? tx : 1 - tx) * (j ? ty : 1 - ty), q = (y * sl + x) * 4
        o[0] += pm[q] * w; o[1] += pm[q + 1] * w; o[2] += pm[q + 2] * w; o[3] += pm[q + 3] * w
      }
    }
  }
  const acc = new Float32Array(4)
  for (let Y = Y0; Y <= Y1; Y++) {
    for (let X = X0; X <= X1; X++) {
      if (k === 1) {
        const [u, v] = appliquer(Mi, X + 0.5, Y + 0.5)
        lire(u - sx0, v - sy0, acc)
      } else {
        for (let ch = 0; ch < 4; ch++) acc[ch] = 0
        for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) {
          const [u, v] = appliquer(Mi, X + (i + 0.5) / k, Y + (j + 0.5) / k)
          lire(u - sx0, v - sy0, sortie)
          for (let ch = 0; ch < 4; ch++) acc[ch] += sortie[ch]
        }
        for (let ch = 0; ch < 4; ch++) acc[ch] /= k * k
      }
      const a = acc[3]
      if (a <= 1 / 510) continue
      const i = (Y * largeur + X) * 4, da = data[i + 3] / 255, oa = a + da * (1 - a)
      for (let ch = 0; ch < 3; ch++) data[i + ch] = Math.round((acc[ch] + data[i + ch] / 255 * da * (1 - a)) / oa * 255)
      data[i + 3] = Math.round(oa * 255)
    }
  }
}
/* Les poids de Catmull-Rom pour les quatre pixels autour de `t`. */
function poids(t) {
  const t2 = t * t, t3 = t2 * t
  return [-0.5 * t3 + t2 - 0.5 * t, 1.5 * t3 - 2.5 * t2 + 1, -1.5 * t3 + 2 * t2 + 0.5 * t, 0.5 * t3 - 0.5 * t2]
}

/* LES ÉLÉMENTS TRANSFORMÉS d'une image détourée (RVBA, `largeur` ×
   `hauteur`) : `transformations`, chaque consigne avec son adresse
   (lib/effacer.js : un point { u, v, aire } ou un cadre { cadre, poly })
   et sa transformation (pivot, d, angle, s). `data` est modifié sur place
   et rendu. */
export function transformer(data, largeur, hauteur, transformations) {
  if (!transformations || !transformations.length) return data
  const n = largeur * hauteur
  const etat = { pris: new Uint8Array(n), pile: new Int32Array(1024) }
  /* 1. Chaque sélection, lue sur l'image telle qu'elle est reçue. */
  const sprites = []
  for (const t of transformations) {
    if (!t || estIdentite(t)) continue
    const sel = selection(data, largeur, hauteur, t, etat)
    if (!sel || !sel.pixels.length) continue
    let x0 = largeur, y0 = hauteur, x1 = -1, y1 = -1
    const tous = [sel.pixels, sel.bord]
    for (const ps of tous) for (const p of ps) { const x = p % largeur, y = (p - x) / largeur; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
    const sl = x1 - x0 + 1, sh = y1 - y0 + 1
    const sd = new Uint8ClampedArray(sl * sh * 4)
    for (const ps of tous) for (const p of ps) {
      const x = p % largeur, y = (p - x) / largeur, i = p * 4, q = ((y - y0) * sl + x - x0) * 4
      sd[q] = data[i]; sd[q + 1] = data[i + 1]; sd[q + 2] = data[i + 2]; sd[q + 3] = data[i + 3]
    }
    sprites.push({ t, sprite: { data: sd, largeur: sl, hauteur: sh, x: x0, y: y0 }, pixels: sel.pixels, bord: sel.bord })
  }
  if (!sprites.length) return data
  /* 2. Tout se coupe, puis chaque trou se juge et se rebouche. */
  const masque = new Uint8Array(n)
  for (const s of sprites) { for (const p of s.pixels) data[p * 4 + 3] = 0; for (const p of s.bord) data[p * 4 + 3] = 0 }
  for (const s of sprites) {
    for (const p of s.pixels) masque[p] = 1
    for (const p of s.bord) masque[p] = 1
    creuser(data, largeur, hauteur, masque)
    for (const p of s.pixels) masque[p] = 0
    for (const p of s.bord) masque[p] = 0
  }
  /* 3. Chaque sprite se pose, dans l'ordre : le dernier dessus. */
  for (const s of sprites) poserSprite(data, largeur, hauteur, s.sprite, matriceDe(s.t, largeur))
  return data
}

/* LES COURBES D'UN CHEMIN (lib/polices.js : { type, x, y, x1, y1, x2, y2 })
   passées par la matrice. */
export function transformerCommandes(commandes, M) {
  return commandes.map(c => {
    const o = { type: c.type }
    for (const [kx, ky] of [['x', 'y'], ['x1', 'y1'], ['x2', 'y2']]) {
      if (c[kx] === undefined) continue
      const [x, y] = appliquer(M, c[kx], c[ky])
      o[kx] = x
      o[ky] = y
    }
    return o
  })
}

/* UNE LIGNE POSÉE (lib/texte.js, `poseLigne`) transformée : ses lettres
   de police (`commandes`, en pixels de l'image de `L` de large) passent
   par la matrice ; ses anciens pixels restent où ils sont (ils s'effacent
   à leur place) ; le cadre couvre les deux places ; l'épaisseur d'un
   cerne suit l'échelle moyenne. Rend une nouvelle pose. */
export function transformerPose(pose, t, L) {
  if (!pose || !t || estIdentite(t)) return pose
  const M = matriceDe(t, L)
  const lettres = pose.lettres.map(le => Object.assign({}, le, { commandes: transformerCommandes(le.commandes, M) }))
  let [x0, y0, x1, y1] = pose.cadre
  for (const le of lettres) for (const c of le.commandes) for (const [kx, ky] of [['x', 'y'], ['x1', 'y1'], ['x2', 'y2']]) {
    if (c[kx] === undefined) continue
    x0 = Math.min(x0, c[kx]); x1 = Math.max(x1, c[kx]); y0 = Math.min(y0, c[ky]); y1 = Math.max(y1, c[ky])
  }
  const { echelle } = decomposer(t)
  const cerne = pose.cerne ? Object.assign({}, pose.cerne, { epaisseur: pose.cerne.epaisseur * Math.sqrt(echelle[0] * echelle[1]) }) : null
  return Object.assign({}, pose, { lettres, cadre: [x0, y0, x1, y1], cerne })
}

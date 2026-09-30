/* ============================================================== LE VECTORIEL
   25 septembre 2026 : « si j'ai besoin d'un logo vectoriel, le blanc dans
   les lettres doit aussi être supprimé ». Le logo détouré se redessine en
   formes pleines — un SVG qui s'agrandit sans flou, que l'atelier ouvre dans
   Illustrator ou pose sur la presse.
   LA RECETTE : les couleurs du logo se ramènent à quelques teintes franches
   (les k-moyennes), chaque pixel prend la plus proche — ou le vide, s'il est
   transparent —, et imagetracer.js (vendor/, domaine public) suit les
   contours de chaque teinte. Ce qui est transparent n'est dessiné par
   AUCUNE forme : le creux d'un O est un vrai trou, pas un rond blanc posé
   dessus. */
import { ecart } from './lab.js'

/* L'opacité sous laquelle un pixel est du vide. */
const OPAQUE = 128
/* Le SVG se trace sur au moins 1 600 px de grand côté (voir `coteTrace`) —
   un logo plus petit s'y agrandit (ses courbes et ses petites écritures y
   gagnent), un très grand s'y réduit (le contour n'y gagne plus rien et le
   calcul traîne). Ses dimensions, elles, restent celles de l'image. */
export const TRACE_MAX = 1600

/* LA TAILLE DU TRACÉ (26 septembre 2026 : « les petites écritures deviennent
   illisibles »). Une écriture de 12 px a des traits d'un pixel : tracés à
   1 600 px, ils tombaient sous les mailles. Le tracé se fait désormais à
   trois fois la taille du logo — de 1 600 à 3 200 px de grand côté —, et
   `plafond` le retient plus bas pour l'aperçu, qui doit répondre vite. */
export function coteTrace(largeur, hauteur, plafond = 3200) {
  return Math.min(plafond, Math.max(TRACE_MAX, 3 * Math.max(largeur, hauteur)))
}

/* UN TRAIT FIN N'EST JAMAIS PLEIN : le JPEG étale une lettre de 12 px en
   gris pâle, couvert à 40 % à peine. Coupé à mi-chemin (50 %), il
   disparaissait ; il reste dès qu'il couvre 40 % du pixel. Les grandes
   formes n'y gagnent qu'un dixième de pixel. */
export const COUVERTURE = 0.4

const distance2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2

/* LES PIXELS PLEINS, échantillonnés : 60 000 suffisent à trouver des
   teintes, même sur une image de dix millions de pixels. */
function echantillon(data) {
  const n = data.length / 4
  const pas = Math.max(1, Math.floor(n / 60000))
  const pts = []
  for (let p = 0; p < n; p += pas) {
    const i = p * 4
    if (data[i + 3] >= OPAQUE) pts.push([data[i], data[i + 1], data[i + 2]])
  }
  return pts
}

/* LES TEINTES DU LOGO : k-moyennes, départ déterministe (le plus éloigné
   d'abord) — le même logo rend toujours les mêmes couleurs. */
export function palette(data, k) {
  const pts = echantillon(data)
  if (!pts.length || k < 1) return []
  const centres = [moyenne(pts)]
  const loin = pts.map(p => distance2(p, centres[0]))
  while (centres.length < k) {
    let m = -1, im = -1
    for (let j = 0; j < pts.length; j++) if (loin[j] > m) { m = loin[j]; im = j }
    if (m <= 0) break
    centres.push(pts[im].slice())
    for (let j = 0; j < pts.length; j++) loin[j] = Math.min(loin[j], distance2(pts[j], pts[im]))
  }
  const etiquette = new Int32Array(pts.length)
  for (let tour = 0; tour < 12; tour++) {
    const somme = centres.map(() => [0, 0, 0, 0])
    for (let j = 0; j < pts.length; j++) {
      const c = plusProche(pts[j], centres)
      etiquette[j] = c
      const s = somme[c]
      s[0] += pts[j][0]; s[1] += pts[j][1]; s[2] += pts[j][2]; s[3]++
    }
    let bouge = false
    somme.forEach((s, c) => {
      if (!s[3]) return
      const neuf = [Math.round(s[0] / s[3]), Math.round(s[1] / s[3]), Math.round(s[2] / s[3])]
      if (distance2(neuf, centres[c])) bouge = true
      centres[c] = neuf
    })
    if (!bouge) break
  }
  /* Les plus présentes d'abord : le fond du logo, puis ses détails. */
  const compte = centres.map(() => 0)
  for (let j = 0; j < pts.length; j++) compte[etiquette[j]]++
  return centres.map((c, i) => ({ c, n: compte[i] })).filter(x => x.n).sort((a, b) => b.n - a.n).map(x => x.c)
}

function moyenne(pts) {
  const s = [0, 0, 0]
  for (const p of pts) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2] }
  return s.map(v => Math.round(v / pts.length))
}

function plusProche(p, centres) {
  let m = Infinity, im = 0
  for (let c = 0; c < centres.length; c++) {
    const d = distance2(p, centres[c])
    if (d < m) { m = d; im = c }
  }
  return im
}

/* UN LOGO OU UNE ILLUSTRATION ? (26 septembre 2026, une île pleine de
   dégradés, de poissons et de petites écritures). Un logo tient en
   quelques teintes franches ; une illustration, non. On ramène l'image à
   douze teintes et l'on compte les pixels qu'elles rendent mal (à plus de
   30 niveaux) : mesuré, un logo ChatGPT, même pixellisé ou passé en JPEG,
   n'en a pas 2 % ; l'illustration, 30 %. Au-delà de 10 %, c'est une
   illustration : la vectoriser la ramènerait à une affiche en aplats. */
export function estIllustration(data) {
  const pal = palette(data, 12)
  if (!pal.length) return false
  const pts = echantillon(data)
  let loin = 0
  for (const p of pts) if (distance2(p, pal[plusProche(p, pal)]) > 30 * 30) loin++
  return loin / pts.length > 0.1
}

/* LES TEINTES VRAIES, d'office : on en cherche douze, puis on oublie
   celles qui ne pèsent presque rien, on fond celles qui se ressemblent, et
   surtout on écarte LES MÉLANGES (25 septembre 2026, un logo de 96 px
   agrandi en gros pixels) : le rose du bord d'un disque rouge sur fond
   blanc, le gris d'un texte marine, ne sont pas des couleurs du logo mais
   l'anticrénelage entre deux d'entre elles — ou entre une d'elles et le
   fond (`fonds`). Gardés, ils dessinaient un anneau autour de chaque forme.
   Un mélange est une teinte posée sur le segment qui relie deux autres, et
   moins présente qu'elles. */
export function paletteAuto(data, fonds = []) {
  const pts = echantillon(data)
  if (!pts.length) return []
  const centres = palette(data, 12)
  const poids = centres.map(() => 0)
  for (const p of pts) poids[plusProche(p, centres)]++
  let gardes = []
  centres.map((c, i) => ({ c, n: poids[i] })).sort((a, b) => b.n - a.n).forEach(x => {
    /* Un millième suffit : une petite écriture d'une autre couleur (le
       sous-titre doré d'un logo) ne couvre presque rien, et c'est pourtant
       une teinte du logo. Les mélanges, eux, s'écartent plus bas. */
    if (x.n < pts.length * 0.001) return
    /* Pareilles pour l'œil (lib/lab.js) : une seule. Un rose et un pêche,
       un vert sauge et un vert plus sombre restent deux. */
    if (gardes.some(g => ecart(g.c, x.c) < 8)) return
    gardes.push(x)
  })
  /* Les mélanges, des moins présents aux plus présents. */
  for (let i = gardes.length - 1; i >= 0; i--) {
    const x = gardes[i]
    const bouts = gardes.filter(g => g !== x && g.n > x.n).map(g => g.c).concat(fonds)
    if (bouts.some((a, j) => bouts.some((b, k) => k > j && estMelange(x.c, a, b)))) gardes.splice(i, 1)
  }
  if (!gardes.length) gardes = [{ c: centres[0] }]
  return gardes.slice(0, 12).map(g => g.c)
}

/* `c` est-il un mélange de `a` et de `b` ? Sur leur segment, loin des deux
   bouts, à moins de 22 niveaux du trait. */
function estMelange(c, a, b) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const l2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2
  if (l2 < 60 ** 2) return false
  const t = ((c[0] - a[0]) * ab[0] + (c[1] - a[1]) * ab[1] + (c[2] - a[2]) * ab[2]) / l2
  if (t < 0.1 || t > 0.9) return false
  const proj = [a[0] + t * ab[0], a[1] + t * ab[1], a[2] + t * ab[2]]
  return Math.sqrt(distance2(proj, c)) < 22
}

/* UNE OMBRE PORTÉE : le fond, assombri — chaque canal baissé d'autant
   (un bleu ciel devient un bleu gris, pas une autre couleur).
   Seulement sur un fond DE COULEUR, et tout près de lui (29 septembre
   2026 : « des qu'il passe l'IA ça fait disparaître des lettres »). Sur un
   fond blanc, gris ou noir, « le fond assombri » est n'importe quel gris —
   le vert sauge de « LA PISCINE », le gris de « DIB » —, et ces lettres
   partaient avec le fond : là, rien n'est une ombre. */
export function estOmbre(c, fonds = []) {
  return fonds.some(f => {
    if (Math.min(...f) < 20 || Math.max(...f) - Math.min(...f) < 30) return false
    const k = [0, 1, 2].map(i => c[i] / f[i])
    const m = (k[0] + k[1] + k[2]) / 3
    return m > 0.5 && m < 0.97 && Math.max(...k) - Math.min(...k) < 0.14
  })
}

export const couleursAuto = (data, fonds = []) => Math.max(1, paletteAuto(data, fonds).length)

/* CHAQUE PIXEL PREND SA TEINTE, ou le vide : un pixel transparent, ou plus
   proche d'une couleur du fond que de toute teinte du logo.
   LE BORD SE COUPE SUR SON TRAJET, pas au plus proche : le gris qui fond
   un texte marine dans le blanc est, en RVB, plus près du rouge d'à côté
   que du marine — il dessinait un fil rouge autour des lettres. Un pixel
   qui tombe sur le segment entre deux teintes (ou entre une teinte et le
   fond) est rangé du côté dont il est le plus près SUR CE SEGMENT : le
   contour tombe à mi-chemin, là où il était. */
export function aplatir(data, pal, fonds = [], couverture = 0.5) {
  const sortie = new Uint8ClampedArray(data.length)
  if (!pal.length) return sortie
  const bouts = pal.map((c, i) => ({ c, id: i })).concat(fonds.map(c => ({ c, id: -1 })))
  const segments = []
  for (let i = 0; i < bouts.length; i++) {
    for (let j = i + 1; j < bouts.length; j++) {
      if (bouts[i].id < 0 && bouts[j].id < 0) continue
      /* Entre teintes du logo : seulement quand elles sont peu nombreuses. */
      if (bouts[i].id >= 0 && bouts[j].id >= 0 && pal.length > 6) continue
      segments.push([bouts[i], bouts[j]])
    }
  }
  const memoire = new Map()
  const classer = (r, g, b) => {
    const cle = (r >> 2) << 12 | (g >> 2) << 6 | (b >> 2)
    let id = memoire.get(cle)
    if (id !== undefined) return id
    let m = Infinity
    id = 0
    for (const bo of bouts) {
      const d = (r - bo.c[0]) ** 2 + (g - bo.c[1]) ** 2 + (b - bo.c[2]) ** 2
      if (d < m) { m = d; id = bo.id }
    }
    for (const [A, B] of segments) {
      const a = A.c, v0 = B.c[0] - a[0], v1 = B.c[1] - a[1], v2 = B.c[2] - a[2]
      const l2 = v0 * v0 + v1 * v1 + v2 * v2
      if (!l2) continue
      const t = Math.max(0, Math.min(1, ((r - a[0]) * v0 + (g - a[1]) * v1 + (b - a[2]) * v2) / l2))
      const d = (r - a[0] - t * v0) ** 2 + (g - a[1] - t * v1) ** 2 + (b - a[2] - t * v2) ** 2
      if (d < m) {
        m = d
        /* Entre le fond et une teinte, le trait reste dès qu'il couvre
           `couverture` du pixel ; entre deux teintes, à mi-chemin. */
        if (A.id < 0) id = t >= couverture ? B.id : -1
        else if (B.id < 0) id = 1 - t >= couverture ? A.id : -1
        else id = t < 0.5 ? A.id : B.id
      }
    }
    memoire.set(cle, id)
    return id
  }
  const opaque = Math.round(couverture * 255)
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < opaque) continue
    const k = classer(data[i], data[i + 1], data[i + 2])
    if (k < 0) continue
    const c = pal[k]
    sortie[i] = c[0]; sortie[i + 1] = c[1]; sortie[i + 2] = c[2]; sortie[i + 3] = 255
  }
  return sortie
}

/* LES LISERÉS D'UN PIXEL OU DEUX (le JPEG bave ses couleurs au bord des
   lettres : un fil rouge autour d'un texte marine). Chaque pixel regarde
   ses voisins (un carré de 2 × rayon + 1) : si sa teinte y est trop rare —
   un fil de `rayon` pixels de large ou moins —, il prend celle qui y
   domine. Deux passes. */
export function nettoyerEtiquettes(plat, largeur, hauteur, rayon = 1) {
  const n = largeur * hauteur
  const cles = new Map()
  const etiquette = new Int16Array(n)
  const couleurs = [null]
  for (let p = 0; p < n; p++) {
    const i = p * 4
    if (!plat[i + 3]) { etiquette[p] = 0; continue }
    const cle = plat[i] << 16 | plat[i + 1] << 8 | plat[i + 2]
    let e = cles.get(cle)
    if (e === undefined) { e = couleurs.length; cles.set(cle, e); couleurs.push([plat[i], plat[i + 1], plat[i + 2]]) }
    etiquette[p] = e
  }
  const cote = 2 * rayon + 1
  const seuil = rayon * cote + 1
  const compte = new Int32Array(couleurs.length)
  let lu = etiquette
  for (let tour = 0; tour < 2; tour++) {
    const ecrit = lu.slice()
    for (let y = 0; y < hauteur; y++) {
      for (let x = 0; x < largeur; x++) {
        const p = y * largeur + x
        compte.fill(0)
        for (let dy = -rayon; dy <= rayon; dy++) {
          const yy = Math.min(hauteur - 1, Math.max(0, y + dy)) * largeur
          for (let dx = -rayon; dx <= rayon; dx++) compte[lu[yy + Math.min(largeur - 1, Math.max(0, x + dx))]]++
        }
        if (compte[lu[p]] >= seuil) continue
        let m = 0
        for (let e = 1; e < compte.length; e++) if (compte[e] > compte[m]) m = e
        ecrit[p] = m
      }
    }
    lu = ecrit
  }
  const sortie = new Uint8ClampedArray(n * 4)
  for (let p = 0; p < n; p++) {
    const c = couleurs[lu[p]]
    if (!c) continue
    const i = p * 4
    sortie[i] = c[0]; sortie[i + 1] = c[1]; sortie[i + 2] = c[2]; sortie[i + 3] = 255
  }
  return sortie
}

/* LA TAILLE D'UN PIXEL DU LOGO D'ORIGINE. Un logo de 96 px agrandi « au
   plus proche » à 768 est fait de carrés de 8 : ses couleurs ne changent
   que tous les 8 pixels, au même pas. On relève, ligne par ligne, où la
   couleur change franchement, et l'on cherche le plus grand pas k qui tombe
   juste pour la plupart des changements. Un logo net rend 1. */
export function taillePixel(data, largeur, hauteur) {
  const changements = []
  const pasLigne = Math.max(1, Math.floor(hauteur / 300))
  for (let y = 0; y < hauteur; y += pasLigne) {
    for (let x = 1; x < largeur; x++) {
      const i = (y * largeur + x) * 4
      const j = i - 4
      if (data[i + 3] < OPAQUE && data[j + 3] < OPAQUE) continue
      const d = Math.max(Math.abs(data[i] - data[j]), Math.abs(data[i + 1] - data[j + 1]), Math.abs(data[i + 2] - data[j + 2]), Math.abs(data[i + 3] - data[j + 3]))
      if (d > 48) changements.push(x)
    }
  }
  if (changements.length < 40) return 1
  for (let k = 24; k >= 2; k--) {
    const cases = new Int32Array(k)
    for (const x of changements) cases[x % k]++
    /* Le JPEG décale un bord d'un pixel : dès 4, la case voisine compte
       aussi (sous 4, deux cases, c'est déjà la moitié du hasard). */
    let meilleur = 0
    for (let c = 0; c < k; c++) meilleur = Math.max(meilleur, cases[c] + (k >= 4 ? cases[(c + 1) % k] : 0))
    if (meilleur / changements.length > (k >= 4 ? 0.7 : 0.85)) return k
  }
  return 1
}

/* LE LISSAGE QU'IL FAUT pour fondre des pixels de `k` (0 à 100, le curseur
   « Lisser les escaliers ») : un flou de 70 % d'un pixel d'origine, au pas
   du tracé. Jamais sous 25 : le bruit du JPEG a toujours besoin d'un peu. */
export function escaliersPour(k, largeur, hauteur, cote = TRACE_MAX) {
  const s = cote / Math.max(largeur, hauteur)
  return Math.round(Math.max(25, Math.min(100, 0.7 * k * s / (cote * 0.01) * 100)))
}

/* RÉDUIRE UNE IMAGE (moyenne des pixels, pondérée par l'opacité : un bord
   transparent ne noircit pas la couleur). */
export function reduire(data, largeur, hauteur, maxCote) {
  const f = Math.max(largeur, hauteur) / maxCote
  if (f <= 1) return { data, largeur, hauteur }
  const l = Math.max(1, Math.round(largeur / f))
  const h = Math.max(1, Math.round(hauteur / f))
  const sortie = new Uint8ClampedArray(l * h * 4)
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * hauteur / h), y1 = Math.max(y0 + 1, Math.floor((y + 1) * hauteur / h))
    for (let x = 0; x < l; x++) {
      const x0 = Math.floor(x * largeur / l), x1 = Math.max(x0 + 1, Math.floor((x + 1) * largeur / l))
      let r = 0, g = 0, b = 0, a = 0, n = 0
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * largeur + xx) * 4
          const al = data[i + 3]
          r += data[i] * al; g += data[i + 1] * al; b += data[i + 2] * al; a += al; n++
        }
      }
      const o = (y * l + x) * 4
      if (a) { sortie[o] = r / a; sortie[o + 1] = g / a; sortie[o + 2] = b / a }
      sortie[o + 3] = a / n
    }
  }
  return { data: sortie, largeur: l, hauteur: h }
}

/* AGRANDIR UNE IMAGE (bilinéaire, sur les couleurs prémultipliées). Un logo
   de 1 000 px se trace mieux à 2 000 : le seuil d'opacité tombe entre deux
   pixels au lieu de suivre leur escalier, et les courbes s'arrondissent. */
export function agrandir(data, largeur, hauteur, cote) {
  const f = cote / Math.max(largeur, hauteur)
  if (f <= 1) return { data, largeur, hauteur }
  const l = Math.round(largeur * f)
  const h = Math.round(hauteur * f)
  const sortie = new Uint8ClampedArray(l * h * 4)
  /* Les colonnes sources et leurs poids, une fois pour toutes les lignes. */
  const X0 = new Int32Array(l), X1 = new Int32Array(l), TX = new Float64Array(l)
  for (let x = 0; x < l; x++) {
    const sx = Math.min(largeur - 1, Math.max(0, (x + 0.5) / f - 0.5))
    X0[x] = Math.floor(sx)
    X1[x] = Math.min(largeur - 1, X0[x] + 1)
    TX[x] = sx - X0[x]
  }
  for (let y = 0; y < h; y++) {
    const sy = Math.min(hauteur - 1, Math.max(0, (y + 0.5) / f - 0.5))
    const y0 = Math.floor(sy), y1 = Math.min(hauteur - 1, y0 + 1), ty = sy - y0
    const l0 = y0 * largeur, l1 = y1 * largeur
    for (let x = 0; x < l; x++) {
      const tx = TX[x]
      const i0 = (l0 + X0[x]) * 4, i1 = (l0 + X1[x]) * 4, i2 = (l1 + X0[x]) * 4, i3 = (l1 + X1[x]) * 4
      const a0 = data[i0 + 3] * ((1 - tx) * (1 - ty)), a1 = data[i1 + 3] * (tx * (1 - ty))
      const a2 = data[i2 + 3] * ((1 - tx) * ty), a3 = data[i3 + 3] * (tx * ty)
      const a = 0 + a0 + a1 + a2 + a3
      const o = (y * l + x) * 4
      if (a) {
        sortie[o] = (0 + data[i0] * a0 + data[i1] * a1 + data[i2] * a2 + data[i3] * a3) / a
        sortie[o + 1] = (0 + data[i0 + 1] * a0 + data[i1 + 1] * a1 + data[i2 + 1] * a2 + data[i3 + 1] * a3) / a
        sortie[o + 2] = (0 + data[i0 + 2] * a0 + data[i1 + 2] * a1 + data[i2 + 2] * a2 + data[i3 + 2] * a3) / a
      }
      sortie[o + 3] = a
    }
  }
  return { data: sortie, largeur: l, hauteur: h }
}

/* LISSER LES ESCALIERS (25 septembre 2026 : « si le logo est pixellisé, lui
   passer un coup de propre »). Un flou de rayon `rayon`, trois passes de
   boîte (presque une gaussienne), sur les couleurs prémultipliées : le
   bord d'un logo pixellisé ou d'un JPEG écrasé devient une pente douce, et
   quand chaque pixel reprend sa teinte franche (`aplatir`), la frontière
   tombe au milieu de la pente — une courbe, là où il y avait des marches.
   Le bruit du JPEG, lui, se fond dans l'aplat. */
export function adoucir(data, largeur, hauteur, rayon) {
  const r = Math.round(rayon)
  if (r < 1) return data
  const n = largeur * hauteur
  /* Prémultiplié, en flottants : un bord transparent ne noircit rien. */
  let a = new Float32Array(n * 4)
  for (let p = 0; p < n; p++) {
    const i = p * 4
    const al = data[i + 3] / 255
    a[i] = data[i] * al; a[i + 1] = data[i + 1] * al; a[i + 2] = data[i + 2] * al; a[i + 3] = data[i + 3]
  }
  let b = new Float32Array(n * 4)
  const passe = (src, dst, long, court, pas, ligne) => {
    const fen = 2 * r + 1
    for (let j = 0; j < court; j++) {
      const base = j * ligne
      for (let c = 0; c < 4; c++) {
        let somme = 0
        for (let k = -r; k <= r; k++) somme += src[base + Math.min(long - 1, Math.max(0, k)) * pas + c]
        for (let x = 0; x < long; x++) {
          dst[base + x * pas + c] = somme / fen
          somme += src[base + Math.min(long - 1, x + r + 1) * pas + c] - src[base + Math.max(0, x - r) * pas + c]
        }
      }
    }
  }
  for (let tour = 0; tour < 3; tour++) {
    passe(a, b, largeur, hauteur, 4, largeur * 4)
    passe(b, a, hauteur, largeur, largeur * 4, 4)
  }
  const sortie = new Uint8ClampedArray(n * 4)
  for (let p = 0; p < n; p++) {
    const i = p * 4
    const al = a[i + 3]
    if (al > 0.5) {
      const f = 255 / al
      sortie[i] = a[i] * f; sortie[i + 1] = a[i + 1] * f; sortie[i + 2] = a[i + 2] * f
    }
    sortie[i + 3] = al
  }
  return sortie
}

/* LES RÉGLAGES DU TRACÉ, de 0 à 100 comme les curseurs du studio.
   - `lissage` : imagetracer pose une droite quand l'écart reste sous
     `ltres`, une courbe quand il reste sous `qtres`. Lisser, c'est refuser
     les droites (sinon un O devient un polygone) et accepter les courbes ;
     à 0, le tracé suit chaque pixel. Essayé sur un logo JPEG de ChatGPT :
     50 (droites sous 0,5 px, courbes sous 3 px) rend les arrondis nets sans
     facettes et garde les angles francs ;
   - `details` : 0 garde les plus petits morceaux, 100 ne garde que les
     formes d'une certaine taille. */
export function optionsTrace(lissage = 50, details = 30) {
  const l = Math.max(0, Math.min(100, lissage)) / 100
  const d = Math.max(0, Math.min(100, details)) / 100
  return {
    ltres: Math.max(0.1, 1 - l * 0.9),
    qtres: 0.5 + l * 5,
    pathomit: Math.round(d * d * 120),
    rightangleenhance: true,
    colorquantcycles: 1,
    strokewidth: 0,
    linefilter: true,
    roundcoords: 1,
    viewbox: true,
    blurradius: 0,
  }
}

/* LE SVG DE L'IMAGEUR, remis au propre : sans ses formes transparentes, sans
   trait, sans l'attribut `desc` qui n'est pas du SVG, et aux dimensions de
   l'image (le tracé a pu se faire plus petit). */
export function nettoyerSvg(svg, largeur, hauteur, largeurTrace, hauteurTrace) {
  const formes = [...svg.matchAll(/<path [^>]*\/>/g)]
    .map(m => m[0])
    .filter(p => !/opacity="0"/.test(p))
    .map(p => p
      .replace(/ stroke="[^"]*"/, '')
      .replace(/ stroke-width="[^"]*"/, '')
      .replace(/ opacity="1"/, '')
      .replace(/\s+\/>$/, '/>'))
  return '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="' + largeur + '" height="' + hauteur
    + '" viewBox="0 0 ' + largeurTrace + ' ' + hauteurTrace + '">'
    + '<title>Logo vectorisé — OLDA Print Studio</title>'
    + formes.join('') + '</svg>'
}

/* TOUT LE VECTORIEL : `tracer` est imagetracer.js (passé en argument : ce
   module reste sans navigateur). Rend le SVG et les teintes gardées. */
export function vectoriser(tracer, data, largeur, hauteur, { couleurs = 0, lissage = 50, details = 30, escaliers = 0, fonds = [], cote = coteTrace(largeur, hauteur), couverture = COUVERTURE, fils = true } = {}) {
  const petit = Math.max(largeur, hauteur) > cote ? reduire(data, largeur, hauteur, cote) : agrandir(data, largeur, hauteur, cote)
  /* Les teintes se lisent AVANT le flou (il invente des mélanges), sur
     l'image telle qu'elle arrive (agrandie, un échantillon y attrapait moins
     bien une petite écriture) ; les frontières, APRÈS. `escaliers` va de 0
     à 100 : à 100, un flou de 1 % du grand côté — de quoi fondre les
     marches d'un logo de 128 px agrandi. */
  const pal = couleurs > 0 ? palette(data, couleurs) : paletteAuto(data, fonds)
  const rayon = Math.max(0, Math.min(100, escaliers)) / 100 * Math.max(petit.largeur, petit.hauteur) * 0.01
  const aplat = aplatir(adoucir(petit.data, petit.largeur, petit.hauteur, rayon), pal, fonds, couverture)
  const plat = fils ? nettoyerEtiquettes(aplat, petit.largeur, petit.hauteur, escaliers > 0 ? 2 : 1) : aplat
  const options = Object.assign(optionsTrace(lissage, details), {
    pal: [{ r: 0, g: 0, b: 0, a: 0 }].concat(pal.map(c => ({ r: c[0], g: c[1], b: c[2], a: 255 }))),
  })
  const brut = tracer.imagedataToSVG({ width: petit.largeur, height: petit.hauteur, data: plat }, options)
  return { svg: nettoyerSvg(brut, largeur, hauteur, petit.largeur, petit.hauteur), couleurs: pal, auto: couleurs > 0 ? null : pal.length }
}

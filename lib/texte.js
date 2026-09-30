/* =================================================================== LE TEXTE
   30 septembre 2026 : « j'ai un problème de police d'écriture, ça doit être
   parfait : les polices sont censées s'ajouter seules, et en Détouré et en
   Image aussi ». Le texte se lisait sur le tracé, à sa taille de travail
   (1 600 px pour un dégradé) : un petit texte y collait à ses voisins
   (« Option » lu « tion », « DE LA BIODIVERSITÉ » coupé à « BIOD », la fin
   effacée), et sur un PNG transparent, rien de ce qui était écrit sur le
   blanc d'un sticker n'était vu. Il se lit maintenant sur l'image
   elle-même, une fois par image, quelle que soit la version :
   1. L'ENCRE, à la taille de lecture (2 000 à 3 200 px de grand côté) :
      chaque pixel comparé au plus clair et au plus foncé de son voisinage,
      le bord au milieu des deux (Bernsen), au plus petit rayon qui voit un
      contraste — le texte foncé sur fond clair ou transparent, puis le
      texte clair sur fond foncé ;
   2. LES LIGNES : les formes d'un seul tenant, en lettres et en lignes
      (lib/polices.js) ; le jour d'une lettre (le creux clair d'un O foncé)
      n'en est pas une ;
   3. ENTIÈRE ou pas : une lettre collée à autre chose manque à sa ligne —
      de l'encre étrangère dans sa bande, entre ses lettres ou tout contre :
      la ligne ne se remplace pas (« tion » en police, « Op » resté tracé).
   Puis la lecture (lib/lecture.js), la police (lib/polices.js), et les
   lettres posées (`poseLigne`) que chaque version reprend : le Détouré
   dans ses pixels (`poserZone`), le vecteur et l'image dans leurs couches
   (lib/vecteur-lisse.js). Du calcul pur : des pixels qui entrent, des
   pixels qui sortent (lib/detourage-travail.js le fait tourner hors de la
   page). */
import { formesDe, lignesDe, cadreLigne, glyphesDe, noter, cheminPose, polygones, remplir, dilater } from './polices.js'
import { encreLigne, poserTexte, cheminEcriture } from './ecriture.js'
import { lab, ecartLab } from './lab.js'

/* La taille de lecture : le petit texte d'un fichier de 1 200 px y prend
   seize pixels de haut ; un fichier agrandi quatre fois par l'IA y garde
   ses lettres nettes, sans y passer des secondes. */
export const COTE_MIN = 2000
export const COTE_MAX = 3200
/* Sous cet écart (sur 255) entre le plus clair et le plus foncé, le
   voisinage est uni : ni texte ni bord — le grain d'un JPEG, un dégradé. */
const CONTRASTE = 48

export function tailleLecture(largeur, hauteur) {
  const g = Math.max(largeur, hauteur)
  const f = Math.min(COTE_MAX, Math.max(COTE_MIN, g)) / g
  return { f, W: Math.max(1, Math.round(largeur * f)), H: Math.max(1, Math.round(hauteur * f)) }
}

/* LES DEUX LUMIÈRES de l'image à la taille de lecture : `sombre`, sa
   luminance posée sur du blanc (le vide est blanc, le texte foncé reste
   foncé) ; `clair`, posée sur du noir puis retournée (le texte clair
   devient foncé, le vide blanc). Agrandie, l'image se lit au bilinéaire ;
   réduite, chaque pixel de lecture fait la moyenne de ce qu'il couvre (un
   trait fin ne se perd pas entre deux échantillons). */
export function luminances(data, largeur, hauteur, f, W, H) {
  const n = W * H
  const sombre = new Uint8Array(n), clair = new Uint8Array(n)
  const poser = (p, a, l) => {
    sombre[p] = Math.round(l + (1 - a) * 255)
    clair[p] = Math.round(255 - l)
  }
  if (f < 1) {
    const sa = new Float32Array(n), sl = new Float32Array(n), nb = new Uint32Array(n)
    for (let y = 0; y < hauteur; y++) {
      const Y = Math.min(H - 1, Math.floor((y + 0.5) * f))
      for (let x = 0; x < largeur; x++) {
        const i = (y * largeur + x) * 4, p = Y * W + Math.min(W - 1, Math.floor((x + 0.5) * f))
        const a = data[i + 3] / 255
        sa[p] += a
        sl[p] += a * (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
        nb[p]++
      }
    }
    for (let p = 0; p < n; p++) if (nb[p]) poser(p, sa[p] / nb[p], sl[p] / nb[p]); else poser(p, 0, 0)
    return { sombre, clair }
  }
  for (let Y = 0; Y < H; Y++) {
    const v = Math.max(0, Math.min(hauteur - 1, (Y + 0.5) / f - 0.5))
    const y0 = Math.floor(v), y1 = Math.min(hauteur - 1, y0 + 1), ty = v - y0
    for (let X = 0; X < W; X++) {
      const u = Math.max(0, Math.min(largeur - 1, (X + 0.5) / f - 0.5))
      const x0 = Math.floor(u), x1 = Math.min(largeur - 1, x0 + 1), tx = u - x0
      let a = 0, l = 0
      const lire = (x, y, w) => {
        const i = (y * largeur + x) * 4, al = data[i + 3] / 255
        a += w * al
        l += w * al * (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
      }
      lire(x0, y0, (1 - tx) * (1 - ty)); lire(x1, y0, tx * (1 - ty)); lire(x0, y1, (1 - tx) * ty); lire(x1, y1, tx * ty)
      poser(Y * W + X, a, l)
    }
  }
  return { sombre, clair }
}

/* LE PLUS FONCÉ OU LE PLUS CLAIR sur une fenêtre de 2r + 1, le long d'une
   rangée ou d'une colonne (van Herk – Gil-Werman : trois comparaisons par
   pixel, quel que soit le rayon). Hors de l'image, rien ne compte. */
function glissant(src, o, pas, n, r, max, dst, g, h) {
  const w = 2 * r + 1, N = n + 2 * r, neutre = max ? 0 : 255
  for (let i = 0; i < N; i++) {
    const j = i - r, v = j < 0 || j >= n ? neutre : src[o + j * pas]
    g[i] = i % w === 0 ? v : max ? (g[i - 1] > v ? g[i - 1] : v) : (g[i - 1] < v ? g[i - 1] : v)
  }
  for (let i = N - 1; i >= 0; i--) {
    const j = i - r, v = j < 0 || j >= n ? neutre : src[o + j * pas]
    h[i] = i === N - 1 || (i + 1) % w === 0 ? v : max ? (h[i + 1] > v ? h[i + 1] : v) : (h[i + 1] < v ? h[i + 1] : v)
  }
  for (let j = 0; j < n; j++) {
    const a = h[j], b = g[j + 2 * r]
    dst[o + j * pas] = max ? (a > b ? a : b) : (a < b ? a : b)
  }
}
export function filtreExtreme(src, W, H, r, max) {
  const tmp = new Uint8Array(W * H), dst = new Uint8Array(W * H)
  const g = new Uint8Array(Math.max(W, H) + 2 * r + 1), h = new Uint8Array(g.length)
  for (let y = 0; y < H; y++) glissant(src, y * W, 1, W, r, max, tmp, g, h)
  for (let x = 0; x < W; x++) glissant(tmp, x, W, H, r, max, dst, g, h)
  return dst
}
/* Le plus foncé (ou le plus clair) de chaque bloc de `b` × `b`. */
function parBlocs(src, W, H, b, max) {
  const w = Math.ceil(W / b), h = Math.ceil(H / b), d = new Uint8Array(w * h).fill(max ? 0 : 255)
  for (let y = 0; y < H; y++) {
    const o = ((y / b) | 0) * w
    for (let x = 0; x < W; x++) {
      const q = o + ((x / b) | 0), v = src[y * W + x]
      if (max ? v > d[q] : v < d[q]) d[q] = v
    }
  }
  return { d, w, h }
}

/* L'ENCRE FONCÉE de `lum` (1 : encre) : au plus petit des trois voisinages
   (2r + 1 pixels, puis quatre et seize fois plus grands, sur l'image
   réduite par blocs) où le plus clair et le plus foncé s'écartent de
   `contraste`, le pixel est de l'encre s'il est plus foncé que leur
   milieu — le bord d'une lettre y tombe à mi-chemin de son anticrénelage.
   Uni partout : foncé ou non, à la moitié. */
export function binariser(lum, W, H, r, contraste = CONTRASTE) {
  const n = W * H
  const encre = new Uint8Array(n), decide = new Uint8Array(n)
  let mnS = lum, mxS = lum, w = W, h = H, b = 1
  for (let niveau = 0; niveau < 3; niveau++) {
    if (niveau) {
      const a = parBlocs(mnS, w, h, 4, false), c = parBlocs(mxS, w, h, 4, true)
      mnS = a.d; mxS = c.d; w = a.w; h = a.h; b *= 4
    }
    const mn = filtreExtreme(mnS, w, h, r, false), mx = filtreExtreme(mxS, w, h, r, true)
    for (let y = 0; y < H; y++) {
      const o = ((y / b) | 0) * w
      for (let x = 0; x < W; x++) {
        const p = y * W + x
        if (decide[p]) continue
        const q = o + ((x / b) | 0), lo = mn[q], hi = mx[q]
        if (hi - lo < contraste) continue
        decide[p] = 1
        encre[p] = 2 * lum[p] < lo + hi ? 1 : 0
      }
    }
  }
  for (let p = 0; p < n; p++) if (!decide[p]) encre[p] = lum[p] < 128 ? 1 : 0
  return encre
}

const mediane = v => { const t = v.slice().sort((a, b) => a - b); return t[t.length >> 1] }
const aire = f => (f.x1 - f.x0 + 1) * (f.y1 - f.y0 + 1)

/* LE JOUR D'UNE LETTRE : une forme de l'autre encre (le creux clair d'un O
   foncé, le trou foncé d'un O clair) posée dans le cadre d'une forme à
   peine plus grande qu'elle. Un texte dans un badge, lui, est bien plus
   petit que son badge : il reste ; et une lettre vue dans les deux encres
   (vert foncé sur du vide : plus foncée que le blanc, plus claire que le
   noir) n'est pas le jour d'elle-même — le même cadre. */
function sansJours(formes, autres) {
  const C = 64, grille = new Map()
  for (const y of autres) {
    for (let cy = (y.y0 / C) | 0; cy <= (y.y1 / C) | 0; cy++) {
      for (let cx = (y.x0 / C) | 0; cx <= (y.x1 / C) | 0; cx++) {
        const k = cy * 100000 + cx
        if (!grille.has(k)) grille.set(k, [])
        grille.get(k).push(y)
      }
    }
  }
  return formes.filter(x => {
    const k = (((x.y0 + x.y1) / 2 / C) | 0) * 100000 + (((x.x0 + x.x1) / 2 / C) | 0)
    return !(grille.get(k) || []).some(y => y.x0 <= x.x0 && y.y0 <= x.y0 && y.x1 >= x.x1 && y.y1 >= x.y1 && aire(y) >= 1.8 * aire(x) && aire(y) <= 12 * aire(x) && y.y1 - y.y0 <= 3 * (x.y1 - x.y0) + 2)
  })
}

/* LA COULEUR D'UNE LETTRE dans l'image (`image` : { data, largeur,
   hauteur, f }) : la médiane de sa moitié la plus marquée — la plus foncée
   d'un texte foncé, la plus claire d'un texte clair —, en CIELAB ; null
   pour une miette. */
export function couleurLettre(l, W, image, polarite = 0) {
  const { data, largeur, hauteur, f } = image
  const pris = []
  const pas = Math.max(1, Math.floor(l.pixels.length / 400))
  for (let j = 0; j < l.pixels.length; j += pas) {
    const p = l.pixels[j], tx = p % W, ty = (p - tx) / W
    const o = (Math.min(hauteur - 1, Math.floor((ty + 0.5) / f)) * largeur + Math.min(largeur - 1, Math.floor((tx + 0.5) / f))) * 4
    if (data[o + 3] < 128) continue
    pris.push([data[o], data[o + 1], data[o + 2], 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]])
  }
  if (pris.length < 4) return null
  pris.sort((a, b) => polarite ? b[3] - a[3] : a[3] - b[3])
  const moitie = pris.slice(0, Math.max(1, pris.length >> 1))
  return lab([0, 1, 2].map(c => mediane(moitie.map(v => v[c]))))
}

/* UNE LIGNE D'UNE COULEUR : un texte l'est ; le dessin posé tout contre
   (le sac et la bouteille à gauche d'« Option Environnement »), non. La
   ligne se coupe où la couleur de ses lettres change franchement (« 6e3 »
   en bleu, « AME » en vert, deux lignes). Rend les morceaux d'au moins
   deux lettres, chacun avec sa couleur (`couleur`, CIELAB). */
export function parCouleur(ligne, W, image, polarite = 0) {
  const morceaux = []
  let cour = [], ref = null
  for (const l of ligne) {
    const c = l.ponctuation ? null : couleurLettre(l, W, image, polarite)
    if (c && ref && ecartLab(c, ref) > 25) { morceaux.push(Object.assign(cour, { couleur: ref })); cour = []; ref = null }
    cour.push(l)
    if (c && !ref) ref = c
  }
  morceaux.push(Object.assign(cour, { couleur: ref }))
  return morceaux.filter(m => m.filter(x => !x.ponctuation).length >= 2)
}

/* ENTIÈRE : dans la bande du milieu de la ligne (sa moitié centrale), de
   ses premières lettres à ses dernières et à 0,6 hauteur de part et
   d'autre, pas d'encre qui ne soit à elle — de sa couleur (`couleur`,
   CIELAB, avec `image`) : une lettre collée au dessin, à sa voisine du
   dessus ou à un filet décoratif y laisse la sienne ; le dessin d'une
   autre couleur posé tout contre n'est pas une lettre qui manque. */
export function entiere(ligne, encre, num, W, couleur = null, image = null) {
  const [x0, , x1] = cadreLigne(ligne)
  const h = mediane(ligne.map(l => l.y1 - l.y0 + 1))
  const ya = mediane(ligne.map(l => l.y0)), yb = mediane(ligne.map(l => l.y1))
  const a = Math.round(ya + 0.25 * (yb - ya)), b = Math.round(yb - 0.25 * (yb - ya))
  const m = Math.round(0.6 * h)
  const siens = new Set()
  for (const l of ligne) for (const f of l.formes) siens.add(f.id)
  let etranger = 0
  for (let y = a; y <= b; y++) {
    for (let x = Math.max(0, x0 - m); x <= Math.min(W - 1, x1 + m); x++) {
      const p = y * W + x
      if (!encre[p] || siens.has(num[p])) continue
      if (couleur && image) {
        const o = (Math.min(image.hauteur - 1, Math.floor((y + 0.5) / image.f)) * image.largeur + Math.min(image.largeur - 1, Math.floor((x + 0.5) / image.f))) * 4
        if (ecartLab(lab([image.data[o], image.data[o + 1], image.data[o + 2]]), couleur) > 25) continue
      }
      etranger++
    }
  }
  return etranger < Math.max(4, 0.05 * h * h)
}

/* LES LIGNES DE TEXTE D'UNE IMAGE (RVBA, `largeur` × `hauteur`) : à la
   taille de lecture (`f` : pixels de lecture par pixel de l'image), les
   deux encres (`encres` : la foncée, la claire) et les lignes — chacune la
   liste de ses lettres (lib/polices.js, `lignes`), avec `polarite` (0 :
   foncée, 1 : claire), `entiere` et `hauteur` (médiane, en pixels de
   lecture). Rangées de haut en bas. */
export function lignesImage(data, largeur, hauteur) {
  const { f, W, H } = tailleLecture(largeur, hauteur)
  const { sombre, clair } = luminances(data, largeur, hauteur, f, W, H)
  const r = Math.max(4, Math.round(Math.max(W, H) / 300))
  const encres = [binariser(sombre, W, H, r), binariser(clair, W, H, r)]
  const minPixels = Math.max(6, Math.round(6 * (Math.max(W, H) / COTE_MIN) ** 2))
  const lues = encres.map(e => formesDe(e, W, H))
  const petites = lues.map(({ formes }) => formes.filter(fo => fo.pixels.length >= minPixels && fo.y1 - fo.y0 < 0.45 * H && fo.x1 - fo.x0 < 0.5 * W))
  const gardees = [sansJours(petites[0], petites[1]), sansJours(petites[1], petites[0])]
  const image = { data, largeur, hauteur, f }
  let lignes = []
  gardees.forEach((formes, polarite) => {
    for (const toute of lignesDe(formes)) {
      for (const l of parCouleur(toute, W, image, polarite)) {
        l.polarite = polarite
        l.entiere = entiere(l, encres[polarite], lues[polarite].num, W, l.couleur, image)
        l.hauteur = mediane(l.map(x => x.y1 - x.y0 + 1))
        lignes.push(l)
      }
    }
  })
  /* Une ligne vue dans les deux encres (un texte vert foncé sur du vide :
     plus foncé que le blanc, plus clair que le noir) : l'entière, puis la
     plus longue, puis la foncée. */
  const cadres = lignes.map(cadreLigne)
  const rang = l => (l.entiere ? 1e6 : 0) + 2 * l.length + (l.polarite ? 0 : 1)
  lignes = lignes.filter((l, i) => !lignes.some((o, j) => {
    if (j === i || o.polarite === l.polarite) return false
    const a = cadres[i], b = cadres[j]
    const commun = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]) + 1) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]) + 1)
    return commun > 0.5 * Math.min((a[2] - a[0] + 1) * (a[3] - a[1] + 1), (b[2] - b[0] + 1) * (b[3] - b[1] + 1)) && rang(o) > rang(l)
  }))
  lignes.sort((u, v) => { const a = cadreLigne(u), b = cadreLigne(v); return a[1] - b[1] || a[0] - b[0] })
  return { f, W, H, encres, lignes }
}

/* ------------------------------------------------------ LES LETTRES POSÉES
   Une ligne (à la taille de lecture, `W` de large, `f` pixels de lecture
   par pixel de l'image) et sa police choisie (`texte`, `police` lue par
   opentype.js, `ecriture`) : pour chaque lettre remplacée, le chemin de la
   police (`commandes`, en pixels de l'image) et les pixels de la lettre du
   logo qu'elle remplace (`pixels`, à la taille de lecture) — `symboles` :
   les caractères lus et leurs cadres (lib/polices.js, `lettresLues`). La
   ponctuation (une puce) garde son dessin. Une écriture (lib/ecriture.js)
   se pose d'un tenant. Rend { ecriture, lettres, cadre } (le cadre, en
   pixels de l'image, de tout ce qui bouge) et `polarite` (celle de la
   ligne), ou null. */
export function poseLigne(ligne, W, f, { texte, police, ecriture = false, symboles = null }) {
  const echelle = commandes => commandes.map(c => {
    const o = { type: c.type }
    for (const k of ['x', 'y', 'x1', 'y1', 'x2', 'y2']) if (c[k] !== undefined) o[k] = c[k] / f
    return o
  })
  let lettres = []
  if (ecriture) {
    const obs = encreLigne(ligne, W)
    const brute = poserTexte(police, texte, obs)
    const fine = brute && poserTexte(police, texte, obs, { autour: brute })
    const pose = fine && fine.note >= brute.note ? fine : brute
    if (!pose) return null
    lettres = [{ commandes: echelle(cheminEcriture(pose, obs)), pixels: Int32Array.from(ligne.flatMap(l => [...l.pixels])) }]
  } else {
    const glyphes = glyphesDe(ligne, texte, W, symboles)
    if (!glyphes) return null
    const pose = noter(glyphes, police)
    if (!pose.poses) return null
    glyphes.forEach((g, i) => {
      const ps = pose.poses[i]
      if (g.ponctuation || !ps) return
      lettres.push({ commandes: echelle(cheminPose(ps, pose.echelle, pose.base, police)), pixels: g.pixels })
    })
  }
  if (!lettres.length) return null
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const l of lettres) {
    for (const c of l.commandes) {
      for (const [kx, ky] of [['x', 'y'], ['x1', 'y1'], ['x2', 'y2']]) {
        if (c[kx] === undefined) continue
        x0 = Math.min(x0, c[kx]); x1 = Math.max(x1, c[kx]); y0 = Math.min(y0, c[ky]); y1 = Math.max(y1, c[ky])
      }
    }
    for (const p of l.pixels) {
      const x = p % W, y = (p - x) / W
      x0 = Math.min(x0, x / f); x1 = Math.max(x1, (x + 1) / f); y0 = Math.min(y0, y / f); y1 = Math.max(y1, (y + 1) / f)
    }
  }
  return { ecriture: !!ecriture, polarite: ligne.polarite || 0, lettres, cadre: [x0, y0, x1, y1] }
}

/* LA MARGE D'EFFACEMENT, en pixels de l'image : l'anticrénelage de la
   lettre d'origine, et l'escalier de son masque ramené de la taille de
   lecture. */
export const margeEffacement = f => Math.max(2, Math.ceil(1.5 / f) + 1)

/* LES ZONES À REPEINDRE : le cadre de chaque ligne posée, élargi de sa
   marge, dans l'image (`largeur` × `hauteur`) ; deux zones qui se
   touchent n'en font qu'une (une ligne repeinte ne défait pas sa
   voisine). Rend [{ x, y, l, h, poses : [indices] }]. */
export function zonesDe(poses, f, largeur, hauteur) {
  const m = margeEffacement(f) + 3
  let zones = poses.map((p, i) => p && {
    x0: Math.max(0, Math.floor(p.cadre[0]) - m), y0: Math.max(0, Math.floor(p.cadre[1]) - m),
    x1: Math.min(largeur - 1, Math.ceil(p.cadre[2]) + m), y1: Math.min(hauteur - 1, Math.ceil(p.cadre[3]) + m), poses: [i],
  }).filter(Boolean)
  for (let fusion = true; fusion;) {
    fusion = false
    for (let i = 0; i < zones.length && !fusion; i++) {
      for (let j = i + 1; j < zones.length && !fusion; j++) {
        const a = zones[i], b = zones[j]
        if (a.x0 > b.x1 || b.x0 > a.x1 || a.y0 > b.y1 || b.y0 > a.y1) continue
        zones[i] = { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1), poses: a.poses.concat(b.poses) }
        zones.splice(j, 1)
        fusion = true
      }
    }
  }
  return zones.map(z => ({ x: z.x0, y: z.y0, l: z.x1 - z.x0 + 1, h: z.y1 - z.y0 + 1, poses: z.poses }))
}

/* ------------------------------------------------- LE DÉTOURÉ REPEINT
   Une zone de l'image détourée (`zone` : { x, y, l, h, data }, RVBA) et
   les lignes posées qui y tombent : leurs lettres d'origine partent — et
   ce qu'elles couvraient revient, repris de proche en proche de ce qui
   les entoure : le blanc d'un sticker, le vide transparent, un aplat de
   couleur —, puis les lettres de la police s'y peignent, nettes (seize
   sous-pixels par pixel), chacune de la couleur de la sienne. L'encre qui
   n'est pas à elles (un dessin tout contre, `encre` à la taille de
   lecture) ne s'efface pas. Rend la zone, repeinte sur place. */
export function poserZone(zone, poses, { f, W, encres }) {
  const { x: zx, y: zy, l, h, data } = zone
  const n = l * h
  const Wt = W, Ht = encres[0].length / W
  /* 1. Les lettres d'origine, à la taille de l'image : pour chaque pixel,
        la lettre (1…) qui le couvre. */
  const lettre = new Int32Array(n)
  const toutes = []
  for (const p of poses) for (const le of p.lettres) toutes.push({ pose: p, le })
  toutes.forEach(({ le }, k) => {
    for (const p of le.pixels) {
      const tx = p % Wt, ty = (p - tx) / Wt
      let xa, xb, ya, yb
      if (f >= 1) { xa = xb = Math.floor((tx + 0.5) / f); ya = yb = Math.floor((ty + 0.5) / f) }
      else { xa = Math.ceil(tx / f - 0.5); xb = Math.ceil((tx + 1) / f - 0.5) - 1; ya = Math.ceil(ty / f - 0.5); yb = Math.ceil((ty + 1) / f - 0.5) - 1 }
      for (let y = Math.max(ya, zy); y <= Math.min(yb, zy + h - 1); y++) {
        for (let x = Math.max(xa, zx); x <= Math.min(xb, zx + l - 1); x++) lettre[(y - zy) * l + x - zx] = k + 1
      }
    }
  })
  /* 2. La couleur de chaque lettre : la médiane de sa moitié la plus
        marquée (la plus foncée d'un texte foncé, la plus claire d'un texte
        clair) — pas les pixels de son bord, mêlés au fond. */
  const couleurs = toutes.map(({ pose }, k) => {
    const pris = []
    for (let q = 0; q < n; q++) {
      if (lettre[q] !== k + 1 || data[q * 4 + 3] < 128) continue
      const i = q * 4
      pris.push([data[i], data[i + 1], data[i + 2], 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]])
    }
    if (!pris.length) return null
    pris.sort((a, b) => pose.polarite ? b[3] - a[3] : a[3] - b[3])
    const moitie = pris.slice(0, Math.max(1, pris.length >> 1))
    return [0, 1, 2].map(c => mediane(moitie.map(v => v[c])))
  })
  /* 3. Ce qui s'efface : les lettres, et leur bord jusqu'à la marge — sauf
        l'encre étrangère, de la même encre que la ligne (l'encre claire
        d'un texte foncé, c'est son fond). */
  const tx0 = Math.floor(zx * f), ty0 = Math.floor(zy * f)
  const tl = Math.min(Wt, Math.ceil((zx + l) * f) + 1) - tx0, th = Math.min(Ht, Math.ceil((zy + h) * f) + 1) - ty0
  const siens = new Uint8Array(tl * th)
  for (const { le } of toutes) {
    for (const p of le.pixels) {
      const tx = p % Wt - tx0, ty = (p - p % Wt) / Wt - ty0
      if (tx >= 0 && ty >= 0 && tx < tl && ty < th) siens[ty * tl + tx] = 1
    }
  }
  const efface = new Uint8Array(n)
  for (const polarite of [0, 1]) {
    const masque = new Uint8Array(n)
    let vu = false
    for (let q = 0; q < n; q++) if (lettre[q] && toutes[lettre[q] - 1].pose.polarite === polarite) { masque[q] = 1; vu = true }
    if (!vu) continue
    let bord = masque
    for (let k = margeEffacement(f); k > 0; k--) bord = dilater(bord, l, h)
    const encre = encres[polarite]
    for (let q = 0; q < n; q++) {
      if (!bord[q]) continue
      if (!masque[q]) {
        const x = q % l, y = (q - x) / l
        const tx = Math.min(Wt - 1, Math.floor((x + zx + 0.5) * f)), ty = Math.min(Ht - 1, Math.floor((y + zy + 0.5) * f))
        if (encre[ty * Wt + tx] && !siens[(ty - ty0) * tl + tx - tx0]) continue
      }
      efface[q] = 1
    }
  }
  /* 4. Ce qu'elles couvraient revient, couche par couche depuis le bord : la
        moyenne (prémultipliée : le vide reste vide) des voisins connus. */
  const connu = Uint8Array.from(efface, v => v ? 0 : 1)
  let front = []
  for (let q = 0; q < n; q++) if (efface[q]) front.push(q)
  while (front.length) {
    const prets = [], reste = []
    for (const q of front) {
      const x = q % l, y = (q - x) / l
      let r = 0, g = 0, b = 0, a = 0, k = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const X = x + dx, Y = y + dy
          if ((!dx && !dy) || X < 0 || Y < 0 || X >= l || Y >= h) continue
          const v = Y * l + X
          if (!connu[v]) continue
          const i = v * 4, al = data[i + 3] / 255
          r += data[i] * al; g += data[i + 1] * al; b += data[i + 2] * al; a += al; k++
        }
      }
      if (!k) { reste.push(q); continue }
      prets.push([q, a ? r / a : 0, a ? g / a : 0, a ? b / a : 0, 255 * a / k])
    }
    if (!prets.length) {
      for (const q of reste) data[q * 4 + 3] = 0
      break
    }
    for (const [q, r, g, b, a] of prets) { const i = q * 4; data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a; connu[q] = 1 }
    front = reste
  }
  /* 5. Les lettres de la police, peintes par-dessus : leur couverture sur
        seize sous-pixels, leur couleur fondue sur ce qu'il y a dessous. */
  toutes.forEach(({ le }, k) => {
    const c = couleurs[k]
    if (!c) return
    const polys = polygones(le.commandes, 16)
    let X0 = Infinity, Y0 = Infinity, X1 = -Infinity, Y1 = -Infinity
    for (const p of polys) for (const [x, y] of p) { X0 = Math.min(X0, x); Y0 = Math.min(Y0, y); X1 = Math.max(X1, x); Y1 = Math.max(Y1, y) }
    const gx0 = Math.max(zx, Math.floor(X0)), gy0 = Math.max(zy, Math.floor(Y0))
    const gl = Math.min(zx + l, Math.ceil(X1) + 1) - gx0, gh = Math.min(zy + h, Math.ceil(Y1) + 1) - gy0
    if (gl <= 0 || gh <= 0) return
    /* Une très grande lettre se contente de quatre sous-pixels : son bord
       y est aussi doux, en quatre fois moins de calcul. */
    const SS = gh > 300 ? 2 : 4
    const fin = remplir(polys.map(p => p.map(([x, y]) => [(x - gx0) * SS, (y - gy0) * SS])), 0, 0, gl * SS, gh * SS)
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gl; x++) {
        let s = 0
        for (let j = 0; j < SS; j++) { const o = (y * SS + j) * gl * SS + x * SS; for (let i = 0; i < SS; i++) s += fin[o + i] }
        if (!s) continue
        const al = s / (SS * SS), q = ((gy0 + y - zy) * l + gx0 + x - zx) * 4
        const da = data[q + 3] / 255, oa = al + da * (1 - al)
        for (let ch = 0; ch < 3; ch++) data[q + ch] = (c[ch] * al + data[q + ch] * da * (1 - al)) / oa
        data[q + 3] = 255 * oa
      }
    }
  })
  return zone
}

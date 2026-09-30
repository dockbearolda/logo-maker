/* ================================================================ LE SUJET
   25 septembre 2026 : « je ne veux pas de vectorisation ou autre, je veux
   uniquement mettre une image, photo par exemple — on peut imprimer une
   photo sans problème, c'est le seul produit non vectoriel qu'on accepte,
   mais la photo doit être en HD. Cette photo, on doit pouvoir supprimer le
   fond, qu'il soit blanc ou autre, pour mettre la forme du logo parfaite ».
   Un fond uni — blanc, noir, de couleur — part à la couleur près
   (lib/detourage.js). Un vrai décor n'a pas de couleur à retirer : une
   pièce, un jardin, une rue, le flou d'un arrière-plan. Il faut savoir où
   est le sujet : c'est le travail d'un modèle, ISNet
   (vendor/isnet-general-int8.onnx), qui rend pour chaque pixel la
   probabilité d'être le sujet. Il tourne dans le fil de calcul du studio
   (lib/detourage-travail.js).
   Ici, tout ce qui l'entoure, sans navigateur :
   1. L'ENTRÉE (`entreeModele`) : la photo à 1 024 × 1 024, en moyenne des
      pixels qu'elle couvre — une photo de 4 000 px n'y crénelle pas.
   2. LE BORD À LA TAILLE DE LA PHOTO (`affinerMasque`) : le masque sort en
      1 024 px, la photo en fait 4 000. Agrandi tel quel, son bord serait une
      rampe floue de quatre pixels qui déborde sur le décor. Un filtre guidé
      (He et Sun) le recale sur la photo elle-même : sur chaque petit
      voisinage, le masque devient une fonction des couleurs de la photo, et
      le bord tombe là où la couleur change, mèches de cheveux comprises.
   3. LA COUPE (`poserSujet`, le seuil) : ce que le modèle ne croit qu'à
      moitié — le voile autour d'une mèche, une ombre au sol — part sous le
      seuil ; au-dessus, l'opacité reste celle de la photo. (Durcie aussi
      vers le haut, elle dessinait un liseré sombre autour du sujet : un
      pixel à 80 % sujet y devenait opaque avec 20 % de décor dedans.)
   4. LES COULEURS DU BORD : un pixel du bord est un mélange du sujet et du
      décor. Sa part de décor s'en retire (« blur-fusion », Forte et Pitié,
      2021) : un chien sur de l'herbe ne garde pas un fil vert.
   Mesuré sur douze photos (animaux, voitures, portraits, une basket sur
   fond rouge) : le bord colle au sujet au pixel près en pleine taille, sans
   halo sur fond noir ni sur fond blanc. */

/* Le côté de l'image que le modèle attend : il a appris sur des photos
   ramenées à 1 024 × 1 024. */
export const COTE_MODELE = 1024
/* La grille où le bord se recale : celle du modèle, qui ne voit pas plus
   fin. La pleine taille ne vient qu'au tout dernier passage. */
const GRILLE = 1024
/* Le seuil d'origine, de 0 à 90 : ce que le modèle croit à moins de 20 %
   est du décor. */
export const SEUIL = 20
export const SEUIL_MAX = 90
/* La douceur du filtre guidé : plus petit, le bord suit le moindre écart de
   couleur (le grain d'un JPEG compris) ; plus grand, il s'arrondit. */
const EPS = 1e-3

const borne = v => (v < 0 ? 0 : v > 1 ? 1 : v)

/* ------------------------------------------------------ RÉÉCHANTILLONNER */

/* LES POIDS, colonne par colonne : un triangle, élargi à la réduction
   (chaque pixel d'arrivée prend la moyenne de ceux qu'il couvre),
   bilinéaire à l'agrandissement. */
function poids(entree, sortie) {
  const echelle = entree / sortie
  const support = Math.max(1, echelle)
  const debut = new Int32Array(sortie + 1)
  const index = []
  const valeurs = []
  for (let x = 0; x < sortie; x++) {
    const centre = (x + 0.5) * echelle - 0.5
    const x0 = Math.max(0, Math.floor(centre - support))
    const x1 = Math.min(entree - 1, Math.ceil(centre + support))
    debut[x] = index.length
    let total = 0
    for (let s = x0; s <= x1; s++) {
      const w = 1 - Math.abs(s - centre) / support
      if (w <= 0) continue
      index.push(s)
      valeurs.push(w)
      total += w
    }
    if (!total) {
      index.push(Math.min(entree - 1, Math.max(0, Math.round(centre))))
      valeurs.push(1)
      total = 1
    }
    for (let k = debut[x]; k < index.length; k++) valeurs[k] /= total
  }
  debut[sortie] = index.length
  return { debut, index: Int32Array.from(index), valeurs: Float32Array.from(valeurs) }
}

/* RÉÉCHANTILLONNER `canaux` canaux, lus tous les `pas` octets (4 pour le
   RVB d'un RGBA) : les lignes, puis les colonnes, en flottants. */
export function reechantillonner(src, largeur, hauteur, L, H, canaux = 1, pas = canaux) {
  const fx = poids(largeur, L)
  const fy = poids(hauteur, H)
  const lignes = new Float32Array(L * hauteur * canaux)
  for (let y = 0; y < hauteur; y++) {
    const base = y * largeur * pas
    const o = y * L * canaux
    for (let x = 0; x < L; x++) {
      const k0 = fx.debut[x], k1 = fx.debut[x + 1]
      for (let c = 0; c < canaux; c++) {
        let s = 0
        for (let k = k0; k < k1; k++) s += src[base + fx.index[k] * pas + c] * fx.valeurs[k]
        lignes[o + x * canaux + c] = s
      }
    }
  }
  const sortie = new Float32Array(L * H * canaux)
  const n = L * canaux
  for (let y = 0; y < H; y++) {
    const o = y * n
    for (let k = fy.debut[y]; k < fy.debut[y + 1]; k++) {
      const w = fy.valeurs[k]
      const b = fy.index[k] * n
      for (let i = 0; i < n; i++) sortie[o + i] += lignes[b + i] * w
    }
  }
  return sortie
}

/* UNE IMAGE DÉJÀ EN PARTIE TRANSPARENTE se pose sur du blanc : c'est ainsi
   qu'on la voit, et ainsi que le modèle la comprend. Opaque — une photo —,
   elle passe telle quelle, sans copie. */
export function surBlanc(rgba) {
  let opaque = true
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] !== 255) { opaque = false; break }
  if (opaque) return rgba
  const sortie = new Uint8ClampedArray(rgba.length)
  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3] / 255
    sortie[i] = rgba[i] * a + 255 * (1 - a)
    sortie[i + 1] = rgba[i + 1] * a + 255 * (1 - a)
    sortie[i + 2] = rgba[i + 2] * a + 255 * (1 - a)
    sortie[i + 3] = 255
  }
  return sortie
}

/* ------------------------------------------------------------ LE MODÈLE */

/* L'ENTRÉE DU MODÈLE : la photo en 1 024 × 1 024 (étirée : c'est ainsi
   qu'il a appris), chaque canal centré — (valeur − 128) / 256 —, les trois
   plans l'un après l'autre : un tenseur 1 × 3 × 1 024 × 1 024. */
export function entreeModele(rgba, largeur, hauteur, cote = COTE_MODELE) {
  const rvb = reechantillonner(surBlanc(rgba), largeur, hauteur, cote, cote, 3, 4)
  const n = cote * cote
  const t = new Float32Array(3 * n)
  for (let p = 0; p < n; p++) {
    t[p] = (rvb[p * 3] - 128) / 256
    t[n + p] = (rvb[p * 3 + 1] - 128) / 256
    t[2 * n + p] = (rvb[p * 3 + 2] - 128) / 256
  }
  return t
}

/* LA SORTIE DU MODÈLE, des probabilités de 0 à 1, en octets : un
   mégaoctet à passer d'un fil à l'autre au lieu de quatre. Un modèle qui
   n'est sûr de rien (au plus 60 %) voit tout de même son meilleur sujet
   remonter à 1 — la coupe se règle ensuite au seuil. */
export function masqueEnOctets(probabilites) {
  let haut = 0
  for (let i = 0; i < probabilites.length; i++) if (probabilites[i] > haut) haut = probabilites[i]
  const k = haut > 0.05 ? 1 / Math.min(1, haut) : 1
  const m = new Uint8Array(probabilites.length)
  for (let i = 0; i < m.length; i++) m[i] = Math.round(borne(probabilites[i] * k) * 255)
  return m
}

/* ---------------------------------------------------- LE FILTRE GUIDÉ */

/* LA MOYENNE SUR UN CARRÉ de 2r + 1, bords répliqués : lignes puis
   colonnes, une somme glissante — un grand rayon ne coûte pas plus. */
export function boite(src, L, H, r) {
  const tmp = new Float32Array(src.length)
  const sortie = new Float32Array(src.length)
  const fen = 2 * r + 1
  for (let y = 0; y < H; y++) {
    const base = y * L
    let s = 0
    for (let k = -r; k <= r; k++) s += src[base + Math.min(L - 1, Math.max(0, k))]
    for (let x = 0; x < L; x++) {
      tmp[base + x] = s / fen
      s += src[base + Math.min(L - 1, x + r + 1)] - src[base + Math.max(0, x - r)]
    }
  }
  for (let x = 0; x < L; x++) {
    let s = 0
    for (let k = -r; k <= r; k++) s += tmp[Math.min(H - 1, Math.max(0, k)) * L + x]
    for (let y = 0; y < H; y++) {
      sortie[y * L + x] = s / fen
      s += tmp[Math.min(H - 1, y + r + 1) * L + x] - tmp[Math.max(0, y - r) * L + x]
    }
  }
  return sortie
}

/* LE FILTRE GUIDÉ EN COULEUR (He, Sun et Tang). `I` : les trois plans de
   la photo, de 0 à 1 ; `p` : le masque. Sur chaque carré, le masque le
   plus proche de la forme a · couleur + b ; rend a (trois plans) et b,
   moyennés à leur tour. */
export function filtreGuide(I, p, L, H, r, eps = EPS) {
  const n = L * H
  const [R, G, B] = I
  const m = I.map(c => boite(c, L, H, r))
  const mp = boite(p, L, H, r)
  const produit = (u, v) => {
    const t = new Float32Array(n)
    for (let q = 0; q < n; q++) t[q] = u[q] * v[q]
    return boite(t, L, H, r)
  }
  const [cr, cg, cb] = I.map((c, k) => {
    const cov = produit(c, p)
    for (let q = 0; q < n; q++) cov[q] -= m[k][q] * mp[q]
    return cov
  })
  const vrr = produit(R, R), vrg = produit(R, G), vrb = produit(R, B)
  const vgg = produit(G, G), vgb = produit(G, B), vbb = produit(B, B)
  const ar = new Float32Array(n), ag = new Float32Array(n), ab = new Float32Array(n), b = new Float32Array(n)
  for (let q = 0; q < n; q++) {
    const mr = m[0][q], mg = m[1][q], mb = m[2][q]
    /* La covariance des couleurs, et son inverse (symétrique, 3 × 3). */
    const rr = vrr[q] - mr * mr + eps, rg = vrg[q] - mr * mg, rb = vrb[q] - mr * mb
    const gg = vgg[q] - mg * mg + eps, gb = vgb[q] - mg * mb, bb = vbb[q] - mb * mb + eps
    const i00 = gg * bb - gb * gb, i01 = gb * rb - rg * bb, i02 = rg * gb - gg * rb
    const i11 = rr * bb - rb * rb, i12 = rb * rg - rr * gb, i22 = rr * gg - rg * rg
    const det = rr * i00 + rg * i01 + rb * i02
    const x = (i00 * cr[q] + i01 * cg[q] + i02 * cb[q]) / det
    const y = (i01 * cr[q] + i11 * cg[q] + i12 * cb[q]) / det
    const z = (i02 * cr[q] + i12 * cg[q] + i22 * cb[q]) / det
    ar[q] = x; ag[q] = y; ab[q] = z
    b[q] = mp[q] - x * mr - y * mg - z * mb
  }
  return { a: [boite(ar, L, H, r), boite(ag, L, H, r), boite(ab, L, H, r)], b: boite(b, L, H, r) }
}

/* LE BORD À LA TAILLE DE LA PHOTO, première moitié : le filtre guidé sur
   la grille de 1 024 px. Ses coefficients ne dépendent ni du seuil ni de
   la taille où l'on posera le sujet (l'aperçu, la pleine taille) : ils se
   calculent une fois par photo. `masque` : les octets du modèle, en
   `cote` × `cote`. */
export function affinerMasque(rgba, largeur, hauteur, masque, cote = COTE_MODELE) {
  const e = Math.min(1, GRILLE / Math.max(largeur, hauteur))
  const L = Math.max(1, Math.round(largeur * e))
  const H = Math.max(1, Math.round(hauteur * e))
  const rvb = reechantillonner(surBlanc(rgba), largeur, hauteur, L, H, 3, 4)
  const n = L * H
  const I = [new Float32Array(n), new Float32Array(n), new Float32Array(n)]
  for (let q = 0; q < n; q++) {
    I[0][q] = rvb[q * 3] / 255
    I[1][q] = rvb[q * 3 + 1] / 255
    I[2][q] = rvb[q * 3 + 2] / 255
  }
  const p = reechantillonner(masque, cote, cote, L, H, 1)
  for (let q = 0; q < n; q++) p[q] /= 255
  /* Un rayon de 6 sur la grille de 1 024 : de quoi voir le sujet et le
     décor de part et d'autre d'un bord que le modèle a posé un peu large. */
  const rayon = Math.max(2, Math.round(Math.max(L, H) / 170))
  const { a, b } = filtreGuide(I, p, L, H, rayon)
  return { L, H, I, a, b }
}

/* ------------------------------------------------------------ LA COUPE */

/* Sous le seuil, du décor ; au-dessus, l'opacité monte avec la
   probabilité jusqu'à 97 % (le haut n'est presque pas durci). */
export function coupe(seuil = SEUIL) {
  const bas = Math.max(0, Math.min(SEUIL_MAX, seuil)) / 100
  const haut = Math.max(bas + 0.05, 0.97)
  return v => borne((v - bas) / (haut - bas))
}

/* LES COULEURS DU SUJET ET DU DÉCOR, de part et d'autre du bord
   (« blur-fusion », Forte et Pitié) : la moyenne, sur un grand carré, de
   la couleur du sujet pondérée par l'opacité — et du décor, par son
   contraire —, puis la part qui manque au pixel pour être ce mélange. */
function fusion(I, al, L, H, r, F0, B0) {
  const n = L * H
  const mA = boite(al, L, H, r)
  const F = [], B = []
  for (let c = 0; c < 3; c++) {
    const fa = new Float32Array(n)
    const ba = new Float32Array(n)
    for (let q = 0; q < n; q++) {
      fa[q] = F0[c][q] * al[q]
      ba[q] = B0[c][q] * (1 - al[q])
    }
    const mfa = boite(fa, L, H, r)
    const mba = boite(ba, L, H, r)
    const Fc = new Float32Array(n)
    const Bc = new Float32Array(n)
    for (let q = 0; q < n; q++) {
      const f = mfa[q] / (mA[q] + 1e-5)
      const d = mba[q] / (1 - mA[q] + 1e-5)
      const a = al[q]
      Bc[q] = d
      Fc[q] = borne(f + a * (I[c][q] - a * f - (1 - a) * d))
    }
    F.push(Fc)
    B.push(Bc)
  }
  return { F, B }
}

/* L'INTERPOLATION D'UNE GRILLE vers `taille` pixels : pour chaque pixel
   d'arrivée, les deux cases qui l'entourent et le poids de la seconde. */
function travee(grille, taille) {
  const i0 = new Int32Array(taille), i1 = new Int32Array(taille), t = new Float32Array(taille)
  const e = grille / taille
  for (let x = 0; x < taille; x++) {
    const f = Math.min(grille - 1, Math.max(0, (x + 0.5) * e - 0.5))
    i0[x] = Math.floor(f)
    i1[x] = Math.min(grille - 1, i0[x] + 1)
    t[x] = f - i0[x]
  }
  return { i0, i1, t }
}

/* POSER LE SUJET à la taille de `rgba` (l'aperçu ou la pleine taille) :
   l'opacité recalée sur ses pixels, coupée au seuil, et les couleurs du
   bord débarrassées du décor. `affine` vient d'`affinerMasque`, sur la même
   photo à n'importe quelle taille. Rend un RGBA neuf ; la source ne bouge
   pas. */
export function poserSujet(rgba, largeur, hauteur, affine, { seuil = SEUIL } = {}) {
  const { L, H, I, a, b } = affine
  const couper = coupe(seuil)
  const n = L * H
  const al = new Float32Array(n)
  for (let q = 0; q < n; q++) al[q] = couper(a[0][q] * I[0][q] + a[1][q] * I[1][q] + a[2][q] * I[2][q] + b[q])
  /* Un grand carré d'abord (30 cases sur 1 024) pour des couleurs sûres,
     puis un petit pour les détails. */
  const r1 = Math.max(2, Math.round(Math.max(L, H) / 34))
  const f1 = fusion(I, al, L, H, r1, I, I)
  const f2 = fusion(I, al, L, H, Math.max(1, Math.round(r1 / 15)), f1.F, f1.B)

  const src = surBlanc(rgba)
  const sortie = new Uint8ClampedArray(largeur * hauteur * 4)
  const tx = travee(L, largeur)
  const ty = travee(H, hauteur)
  /* Les dix plans (a, b, sujet, décor), ramenés à la ligne en cours. */
  const plans = [a[0], a[1], a[2], b, f2.F[0], f2.F[1], f2.F[2], f2.B[0], f2.B[1], f2.B[2]]
  const ligne = plans.map(() => new Float32Array(L))
  for (let y = 0; y < hauteur; y++) {
    const o0 = ty.i0[y] * L, o1 = ty.i1[y] * L, v = ty.t[y]
    for (let k = 0; k < plans.length; k++) {
      const P = plans[k], D = ligne[k]
      for (let x = 0; x < L; x++) D[x] = P[o0 + x] + (P[o1 + x] - P[o0 + x]) * v
    }
    const [lar, lag, lab, lb, lfr, lfg, lfb, ldr, ldg, ldb] = ligne
    for (let x = 0; x < largeur; x++) {
      const x0 = tx.i0[x], x1 = tx.i1[x], u = tx.t[x]
      const i = (y * largeur + x) * 4
      const r = src[i] / 255, g = src[i + 1] / 255, bl = src[i + 2] / 255
      const q = (lar[x0] + (lar[x1] - lar[x0]) * u) * r
        + (lag[x0] + (lag[x1] - lag[x0]) * u) * g
        + (lab[x0] + (lab[x1] - lab[x0]) * u) * bl
        + lb[x0] + (lb[x1] - lb[x0]) * u
      const alpha = couper(q) * rgba[i + 3] / 255
      if (alpha < 0.5 / 255) continue
      sortie[i + 3] = Math.round(alpha * 255)
      if (alpha > 0.995) {
        sortie[i] = src[i]; sortie[i + 1] = src[i + 1]; sortie[i + 2] = src[i + 2]
        continue
      }
      /* Le sujet F et le décor D autour de ce pixel : sa couleur C est
         αF + (1 − α)D ; il garde F, corrigé de ce qui manque. */
      const fr = lfr[x0] + (lfr[x1] - lfr[x0]) * u, fg = lfg[x0] + (lfg[x1] - lfg[x0]) * u, fb = lfb[x0] + (lfb[x1] - lfb[x0]) * u
      const dr = ldr[x0] + (ldr[x1] - ldr[x0]) * u, dg = ldg[x0] + (ldg[x1] - ldg[x0]) * u, db = ldb[x0] + (ldb[x1] - ldb[x0]) * u
      sortie[i] = Math.round(255 * borne(fr + alpha * (r - alpha * fr - (1 - alpha) * dr)))
      sortie[i + 1] = Math.round(255 * borne(fg + alpha * (g - alpha * fg - (1 - alpha) * dg)))
      sortie[i + 2] = Math.round(255 * borne(fb + alpha * (bl - alpha * fb - (1 - alpha) * db)))
    }
  }
  return sortie
}

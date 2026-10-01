/* ========================================================= LE NETTOYAGE IA
   27 septembre 2026 : « je n'arrive toujours pas à obtenir des résultats
   exploitables avec des logos de mauvaise qualité » — et « tout doit être
   gratuit ». Un logo petit, flou, écrasé par le JPEG : le tracé
   (lib/vecteur-lisse.js) suit ses pixels, il ressort flou et cassé — un
   cercle fin en pointillés, un script dont les boucles tombent.
   Real-ESRGAN (le modèle « anime video v3 », vendor/, appris sur les aplats
   et les traits nets du dessin animé — ceux d'un logo) le redessine net et
   quatre fois plus grand, sur le poste, sans rien payer : les blocs du JPEG
   et le flou partent, les bords redeviennent francs, les filets fins
   restent entiers. Le fond, le tracé et le PDF partent ensuite de cette
   image-là.
   L'image passe par tuiles : le modèle y garde une mémoire raisonnable, et
   l'avancement se voit. Chaque tuile déborde de `marge` pixels sur ses
   voisines (le modèle regarde autour de chaque point) et seul son centre
   se garde : pas de couture. Une tuile toute d'une couleur (le fond d'un
   PNG transparent, d'un logo propre) ne passe qu'une fois au modèle : les
   suivantes, identiques, reprennent son dessin (`cleUnie`) — le même, au
   bit près (la carte graphique rend toujours le même dessin d'une même
   entrée). */

/* L'IMAGE QUE VOIT LE MODÈLE. Sur la carte graphique, le fichier entier
   jusqu'à 1 280 px de grand côté — il sort à 5 120 px, 43 cm à 300 dpi.
   Réduit, un fichier perd ses petites lettres avant même que le modèle
   les voie (29 septembre 2026 : réduit à 768 px, « OFFICE FRANÇAIS DE LA
   BIODIVERSITÉ » ressortait « OFFICF FRANCAIS DF LA RIODIVFRSITÉ »). Sur
   le processeur, dix fois plus lent, 768 px : le garde-fou (`fidele`)
   rattrape ce que la réduction a perdu. */
export const COTE_NETTOYAGE = 1280
export const COTE_PROCESSEUR = 768
export const FACTEUR = 4
/* 384 px (192 jusqu'au 1er octobre 2026) : les marges que le modèle voit
   en double pèsent 17 % du calcul au lieu de 36 %. L'Ultra va 10 à 18 %
   plus vite ; mesuré sur six logos réduits ×4 et passés en JPEG, son
   dessin reste à ±0,01 dB de la vérité, et à 68–78 dB de celui en tuiles
   de 192 (une couture de moins, rien d'autre). */
export const TUILE = 384
export const MARGE = 16

/* L'ENTRÉE DU MODÈLE POUR UNE TUILE : rouge, vert, bleu en plans, de 0 à 1.
   Hors de l'image, le bord se prolonge ; l'opacité se pose sur du blanc
   (le fond d'un logo). `alpha` : l'opacité seule, en gris — ses bords se
   nettoient comme ceux du dessin. */
export function entreeTuile(rgba, largeur, hauteur, x0, y0, l, h, alpha = false) {
  const n = l * h
  const e = new Float32Array(3 * n)
  for (let y = 0; y < h; y++) {
    const sy = Math.min(hauteur - 1, Math.max(0, y0 + y))
    for (let x = 0; x < l; x++) {
      const sx = Math.min(largeur - 1, Math.max(0, x0 + x))
      const i = (sy * largeur + sx) * 4
      const p = y * l + x
      const a = rgba[i + 3] / 255
      if (alpha) {
        e[p] = e[n + p] = e[2 * n + p] = a
      } else {
        e[p] = (rgba[i] * a + 255 * (1 - a)) / 255
        e[n + p] = (rgba[i + 1] * a + 255 * (1 - a)) / 255
        e[2 * n + p] = (rgba[i + 2] * a + 255 * (1 - a)) / 255
      }
    }
  }
  return e
}

/* L'IMAGE NETTOYÉE, tuile après tuile. `calculer(entree, l, h)` rend la
   sortie du modèle (trois plans de 0 à 1, `facteur` fois plus grands) ;
   `progres(part)` suit l'avancement. L'opacité, quand l'image en a une,
   passe au modèle à son tour. */
export const transparente = rgba => {
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] < 255) return true
  return false
}
/* LA CLÉ D'UNE TUILE TOUTE D'UNE COULEUR (`e` : ses trois plans de `l` ×
   `h`) — ses dimensions et sa couleur ; '' pour une tuile qui a du dessin. */
export function cleUnie(e, l, h) {
  const n = l * h
  for (let c = 0; c < 3; c++) {
    const v = e[c * n]
    for (let i = c * n + 1; i < (c + 1) * n; i++) if (e[i] !== v) return ''
  }
  return l + 'x' + h + ':' + e[0] + ',' + e[n] + ',' + e[2 * n]
}

/* Les tuiles de l'image, passe après passe (la couleur, puis l'opacité
   quand l'image en a une) : leur place, leur taille, marges comprises. */
function tuilesDe(rgba, largeur, hauteur, tuile, marge) {
  const passes = transparente(rgba) ? [false, true] : [false]
  const tuiles = []
  for (const alpha of passes) {
    for (let ty = 0; ty < hauteur; ty += tuile) {
      for (let tx = 0; tx < largeur; tx += tuile) {
        const tl = Math.min(tuile, largeur - tx), th = Math.min(tuile, hauteur - ty)
        tuiles.push({ alpha, tx, ty, tl, th, l: tl + 2 * marge, h: th + 2 * marge })
      }
    }
  }
  return tuiles
}

/* RENDRE LA MAIN AU FIL (2 octobre 2026) : un passage lancé sur la carte
   graphique n'y part qu'au tour suivant de la boucle d'événements — sans
   ça, il attendrait que le processeur ait rangé le précédent. Deux tours :
   mesuré sur la carte d'un Mac, le rangement (150 ms) se cache alors
   presque entier derrière le passage (300 ms). */
const unTour = () => new Promise(ok => setTimeout(ok, 0))
const ceder = () => unTour().then(unTour)

/* Un seul passage en vol à la fois (deux passages lancés ensemble sur une
   même session bloquent le moteur ONNX) : le suivant part quand le
   précédent a rendu son dessin, et celui-ci se range pendant que la carte
   calcule. Le dessin ne change pas d'un octet. */
export async function nettoyerParTuiles(rgba, largeur, hauteur, calculer, progres = () => {}, { tuile = TUILE, marge = MARGE, facteur = FACTEUR } = {}) {
  const L = largeur * facteur, H = hauteur * facteur
  const sortie = new Uint8ClampedArray(L * H * 4)
  const tuiles = tuilesDe(rgba, largeur, hauteur, tuile, marge)
  /* Le dessin d'une tuile toute d'une couleur, par passe et par clé : en
     octets (le centre seulement), pas la sortie du modèle, trois fois plus
     lourde. */
  const unies = new Map()
  /* La tuile `j` : sa clé, et son passage lancé s'il faut le calculer —
     pas une couleur déjà vue, ni celle du passage encore en vol. */
  const lancer = (j, cleEnVol) => {
    const t = tuiles[j]
    const e = entreeTuile(rgba, largeur, hauteur, t.tx - marge, t.ty - marge, t.l, t.h, t.alpha)
    const unie = cleUnie(e, t.l, t.h), cle = unie && unie + t.alpha
    const calcul = cle && (unies.has(cle) || cle === cleEnVol) ? null : (async () => calculer(e, t.l, t.h))()
    if (calcul) calcul.catch(() => {})
    return { cle, calcul }
  }
  let suivante = tuiles.length ? lancer(0, '') : null
  let faites = 0
  for (let j = 0; j < tuiles.length; j++) {
    const { alpha, tx, ty, tl, th, l, h } = tuiles[j]
    const { cle, calcul } = suivante
    const d = calcul && await calcul
    if (j + 1 < tuiles.length) {
      suivante = lancer(j + 1, calcul ? cle : '')
      if (suivante.calcul) await ceder()
    }
    let bloc = cle && unies.get(cle)
    const bl = tl * facteur, bh = th * facteur, k = alpha ? 1 : 4
    if (!bloc) {
      const lo = l * facteur, plan = lo * h * facteur
      bloc = new Uint8ClampedArray(bl * bh * k)
      for (let y = 0; y < bh; y++) {
        const src = (y + marge * facteur) * lo + marge * facteur
        for (let x = 0; x < bl; x++) {
          const s = src + x, o = (y * bl + x) * k
          if (alpha) {
            bloc[o] = Math.round((d[s] + d[plan + s] + d[2 * plan + s]) / 3 * 255)
          } else {
            bloc[o] = Math.round(d[s] * 255)
            bloc[o + 1] = Math.round(d[plan + s] * 255)
            bloc[o + 2] = Math.round(d[2 * plan + s] * 255)
            bloc[o + 3] = 255
          }
        }
      }
      if (cle) unies.set(cle, bloc)
    }
    for (let y = 0; y < bh; y++) {
      const dst = ((ty * facteur + y) * L + tx * facteur) * 4
      if (alpha) for (let x = 0; x < bl; x++) sortie[dst + x * 4 + 3] = bloc[y * bl + x]
      else sortie.set(bloc.subarray(y * bl * 4, (y + 1) * bl * 4), dst)
    }
    progres(++faites / tuiles.length)
  }
  return { data: sortie, largeur: L, hauteur: H }
}

/* ================================================================== L'ULTRA
   30 septembre 2026 : « une qualité encore meilleure sur un logo que
   j'ouvre, le haut de gamme maximum de l'IA, tout en restant gratuit » —
   « et même sur les PC Windows de base du travail ? ». Le plus gros modèle
   n'est pas le meilleur : Real-ESRGAN « x4plus anime 6B » (18 Mo, dix fois
   le calcul) pose un trait noir de dessin animé autour des lettres grises,
   et perd sur quatre logos sur six. Mesuré sur six logos nets, réduits
   quatre fois et passés en JPEG (le fichier d'un client), puis agrandis et
   comparés à l'original, là où le tracé les suit — leurs bords :
   - « anime video v3 », le nettoyage : 15,9 dB ;
   - Real-ESRGAN « general » (vendor/, celui de la matière : le même
     dessin, deux fois plus profond, appris sur des photos), chaque tuile
     passée aussi retournée, pivotée, et les dessins remis droits
     moyennés — ce que le modèle invente dans un sens ne revient pas dans
     l'autre, le vrai bord reste : 17,6 dB en deux orientations, 17,9 en
     huit, jamais pire que le nettoyage sur les six. Un JPEG plus écrasé
     encore : 16,7 dB contre 15,3.
   Ses teintes recalées sur celles du fichier (`recaler`), le garde-fou
   (`fidele`) et les couleurs bornées (`borner`) restent. Le calcul fait 4
   (deux orientations) à 16 fois (huit) celui du nettoyage : sur la carte
   graphique seulement, au nombre d'orientations que le poste tient
   (lib/detourage-travail.js).
   1er octobre 2026, « encore plus de puissance » : la MATIÈRE y passe
   aussi — c'est déjà le « general », passé une fois. Sur sept matières
   et photos (la broderie, le lapin, le t-shirt photographié, « Strong
   Together », le ruban, l'Atabey, le 6e3), réduites ×4 et passées en
   JPEG : + 0,17 à + 0,53 dB, jamais pire ; à l'œil, le grain et les fils
   restent, les taches de couleur du modèle partent. */

/* LES ORIENTATIONS d'une tuile, `k` de 0 à 7 : 1, retournée de gauche à
   droite ; 2, de haut en bas ; 4, transposée (lignes et colonnes
   échangées). Dans l'ordre où elles servent : les deux premières (droite,
   et le demi-tour) donnent l'essentiel, puis les retournements, puis les
   transposées. */
export const ORIENTATIONS = [0, 3, 1, 2, 4, 7, 5, 6]

/* La tuile `e` (plans de `l` × `h`) dans l'orientation `k` : { e, l, h }. */
export function orienter(e, l, h, k) {
  if (!k) return { e, l, h }
  const t = k & 4, L = t ? h : l, H = t ? l : h, n = l * h
  const d = new Float32Array(3 * n)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < L; x++) {
      let sx = t ? y : x, sy = t ? x : y
      if (k & 1) sx = l - 1 - sx
      if (k & 2) sy = h - 1 - sy
      const s = sy * l + sx, o = y * L + x
      d[o] = e[s]; d[n + o] = e[n + s]; d[2 * n + o] = e[2 * n + s]
    }
  }
  return { e: d, l: L, h: H }
}

/* LE DESSIN REMIS DROIT : `s`, ce que rend le modèle d'une tuile orientée
   par `k`, ramené à `l` × `h` (la tuile droite, agrandie). */
export function redresser(s, l, h, k) {
  return k ? remettre(s, l, h, k, null) : s
}
/* Le même, ajouté point à point à `somme` quand elle est donnée (sans
   tableau entre les deux) : sur une tuile, la ligne du dessin droit lit
   celle du dessin orienté d'un pas fixe. */
function remettre(s, l, h, k, somme) {
  const t = k & 4, L = t ? h : l, n = l * h
  const d = somme || new Float32Array(3 * n)
  const pas = t ? (k & 1 ? -L : L) : (k & 1 ? -1 : 1)
  for (let y = 0; y < h; y++) {
    const oy = k & 2 ? h - 1 - y : y
    let q = t ? oy + (k & 1 ? (l - 1) * L : 0) : oy * L + (k & 1 ? l - 1 : 0)
    const fin = (y + 1) * l
    if (somme) for (let o = y * l; o < fin; o++, q += pas) { d[o] += s[q]; d[n + o] += s[n + q]; d[2 * n + o] += s[2 * n + q] }
    else for (let o = y * l; o < fin; o++, q += pas) { d[o] = s[q]; d[n + o] = s[n + q]; d[2 * n + o] = s[2 * n + q] }
  }
  return d
}

/* `calculer` (lib/nettoyage.js, `nettoyerParTuiles`) passé dans chacune des
   `orientations`, les dessins remis droits et moyennés. L'orientation
   suivante part sur la carte graphique pendant que la précédente
   s'additionne (un seul passage en vol, voir `ceder`). */
export function enOrientations(calculer, orientations = ORIENTATIONS, facteur = FACTEUR) {
  return async (entree, l, h) => {
    const L = l * facteur, H = h * facteur
    const lancer = k => {
      const o = orienter(entree, l, h, k)
      const calcul = (async () => calculer(o.e, o.l, o.h))()
      calcul.catch(() => {})
      return calcul
    }
    let somme = null
    let enVol = lancer(orientations[0])
    for (let j = 0; j < orientations.length; j++) {
      const k = orientations[j]
      const s = await enVol
      if (j + 1 < orientations.length) {
        enVol = lancer(orientations[j + 1])
        await ceder()
      }
      if (!somme) somme = k ? remettre(s, L, H, k, null) : Float32Array.from(s)
      else remettre(s, L, H, k, somme)
    }
    if (orientations.length > 1) for (let i = 0; i < somme.length; i++) somme[i] /= orientations.length
    return somme
  }
}

/* CE QUE VOIT LE MODÈLE, en pixels, pour une image passée par tuiles
   (marges comprises) : le temps d'une tuile, rapporté à cette aire, dit le
   temps de l'image. */
export function aireTuiles(largeur, hauteur, { tuile = TUILE, marge = MARGE } = {}) {
  let aire = 0
  for (let ty = 0; ty < hauteur; ty += tuile) {
    for (let tx = 0; tx < largeur; tx += tuile) aire += (Math.min(tuile, largeur - tx) + 2 * marge) * (Math.min(tuile, hauteur - ty) + 2 * marge)
  }
  return aire
}

/* CE QUE LE MODÈLE CALCULERA VRAIMENT pour `rgba` : toutes ses passes
   (l'opacité aussi), une tuile toute d'une couleur une seule fois. */
export function aireACalculer(rgba, largeur, hauteur, { tuile = TUILE, marge = MARGE } = {}) {
  const vues = new Set()
  let aire = 0
  for (const { alpha, tx, ty, l, h } of tuilesDe(rgba, largeur, hauteur, tuile, marge)) {
    const unie = cleUnie(entreeTuile(rgba, largeur, hauteur, tx - marge, ty - marge, l, h, alpha), l, h)
    if (unie) {
      if (vues.has(unie + alpha)) continue
      vues.add(unie + alpha)
    }
    aire += l * h
  }
  return aire
}

/* ===================================================== LE GARDE-FOU DES LETTRES
   29 septembre 2026 : « l'amélioration IA défonce les lettres, ça devient
   illisible — elle doit parfaitement conserver les formes des lettres ».
   Le modèle redessine ce qu'il croit voir : là où le fichier ne dit pas
   assez, il invente (un e bouché, un jambage rongé, une lettre qui fond
   dans sa voisine). Le garde-fou le juge contre le FICHIER REÇU, entier —
   pas l'image réduite que le modèle a vue : son dessin ramené à la taille
   du fichier (`moyenner`) et le fichier lui-même, adoucis tous deux au
   niveau de détail qu'avait l'image du modèle (`flouter`), doivent se
   superposer. Un bord affûté se superpose : adoucis, un bord franc et un
   bord flou se confondent — le grain du JPEG parti aussi. Une forme
   ajoutée, retirée ou déplacée, non : là, c'est le fichier qui reste,
   agrandi en douceur (`agrandir`, la courbe de Catmull-Rom) puis raffermi
   (`raffermir`) — ses bords francs, à leur place.
   (La première version, le même jour, jugeait sans adoucir et contre
   l'image du modèle : un fichier flou y perdait tout son affûtage, et une
   image réduite y laissait passer ses lettres inventées.) */

/* Catmull-Rom : les quatre poids d'un point à `t` (0 à 1) de son voisin. */
const poids = t => {
  const t2 = t * t, t3 = t2 * t
  return [(-t3 + 2 * t2 - t) / 2, (3 * t3 - 5 * t2 + 2) / 2, (-3 * t3 + 4 * t2 + t) / 2, (t3 - t2) / 2]
}
/* Pour chaque point de sortie : son premier voisin et ses quatre poids. */
function noyau(n, N) {
  const i0 = new Int32Array(N), w = new Float32Array(N * 4)
  for (let X = 0; X < N; X++) {
    const s = (X + 0.5) * n / N - 0.5
    const b = Math.floor(s)
    i0[X] = b - 1
    w.set(poids(s - b), X * 4)
  }
  return { i0, w }
}

/* LE FICHIER AGRANDI EN DOUCEUR à `L` × `H`, posé sur du blanc comme
   l'entrée du modèle, son opacité à part — seulement les lignes `y0` à
   `y1` (exclue) : le dessin se garde bande par bande. */
export function agrandir(rgba, largeur, hauteur, L, H, y0 = 0, y1 = H) {
  const kx = noyau(largeur, L), ky = noyau(hauteur, H)
  /* Les lignes du fichier que lisent ces lignes-là. */
  const r0 = Math.max(0, ky.i0[y0]), r1 = Math.min(hauteur - 1, ky.i0[y1 - 1] + 3)
  const mid = new Float32Array(L * (r1 - r0 + 1) * 4)
  for (let y = r0; y <= r1; y++) {
    for (let X = 0; X < L; X++) {
      const o = ((y - r0) * L + X) * 4
      for (let k = 0; k < 4; k++) {
        const x = Math.min(largeur - 1, Math.max(0, kx.i0[X] + k))
        const w = kx.w[X * 4 + k], i = (y * largeur + x) * 4, a = rgba[i + 3] / 255, blanc = 255 * (1 - a)
        mid[o] += w * (rgba[i] * a + blanc); mid[o + 1] += w * (rgba[i + 1] * a + blanc); mid[o + 2] += w * (rgba[i + 2] * a + blanc); mid[o + 3] += w * rgba[i + 3]
      }
    }
  }
  const sortie = new Uint8ClampedArray(L * (y1 - y0) * 4)
  for (let Y = y0; Y < y1; Y++) {
    for (let X = 0; X < L; X++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let k = 0; k < 4; k++) {
        const y = Math.min(hauteur - 1, Math.max(0, ky.i0[Y] + k)) - r0
        const w = ky.w[Y * 4 + k], i = (y * L + X) * 4
        r += w * mid[i]; g += w * mid[i + 1]; b += w * mid[i + 2]; a += w * mid[i + 3]
      }
      const o = ((Y - y0) * L + X) * 4
      sortie[o] = r; sortie[o + 1] = g; sortie[o + 2] = b; sortie[o + 3] = a
    }
  }
  return sortie
}

/* Ce que chaque pixel du fichier couvre de pixels fins (`N` fins pour `n`
   pixels du fichier) : le premier, combien, et la part de chacun. */
function couverture(N, n) {
  const r = N / n, debut = new Int32Array(n), nb = new Int32Array(n), off = new Int32Array(n), parts = []
  for (let t = 0; t < n; t++) {
    const a = t * r, b = (t + 1) * r
    const i0 = Math.floor(a), i1 = Math.min(N, Math.ceil(b - 1e-9))
    debut[t] = i0; nb[t] = i1 - i0; off[t] = parts.length
    for (let i = i0; i < i1; i++) parts.push((Math.min(b, i + 1) - Math.max(a, i)) / r)
  }
  return { debut, nb, off, parts: Float32Array.from(parts) }
}

/* LE DESSIN RAMENÉ À LA TAILLE DU FICHIER : chaque pixel du fichier prend
   la moyenne exacte des pixels fins qu'il couvre. */
function moyenner(img, L, H, l, h) {
  const cx = couverture(L, l), cy = couverture(H, h)
  const sortie = new Float32Array(l * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let j = 0; j < cy.nb[y]; j++) {
        const wy = cy.parts[cy.off[y] + j], ligne = (cy.debut[y] + j) * L
        for (let i = 0; i < cx.nb[x]; i++) {
          const w = wy * cx.parts[cx.off[x] + i], q = (ligne + cx.debut[x] + i) * 4
          r += w * img[q]; g += w * img[q + 1]; b += w * img[q + 2]; a += w * img[q + 3]
        }
      }
      const o = (y * l + x) * 4
      sortie[o] = r; sortie[o + 1] = g; sortie[o + 2] = b; sortie[o + 3] = a
    }
  }
  return sortie
}

/* L'ADOUCI : un flou gaussien de `sigma` pixels, en largeur puis en
   hauteur ; hors de l'image, le bord se prolonge. */
function flouter(v, l, h, sigma) {
  if (!(sigma > 0)) return v
  const R = Math.max(1, Math.ceil(3 * sigma)), k = new Float32Array(2 * R + 1)
  let somme = 0
  for (let i = -R; i <= R; i++) somme += (k[i + R] = Math.exp(-i * i / (2 * sigma * sigma)))
  for (let i = 0; i < k.length; i++) k[i] /= somme
  const t = new Float32Array(v.length), o = new Float32Array(v.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      const d = (y * l + x) * 4
      for (let i = -R; i <= R; i++) {
        const q = (y * l + Math.min(l - 1, Math.max(0, x + i))) * 4, w = k[i + R]
        t[d] += w * v[q]; t[d + 1] += w * v[q + 1]; t[d + 2] += w * v[q + 2]; t[d + 3] += w * v[q + 3]
      }
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      const d = (y * l + x) * 4
      for (let i = -R; i <= R; i++) {
        const q = (Math.min(h - 1, Math.max(0, y + i)) * l + x) * 4, w = k[i + R]
        o[d] += w * t[q]; o[d + 1] += w * t[q + 1]; o[d + 2] += w * t[q + 2]; o[d + 3] += w * t[q + 3]
      }
    }
  }
  return o
}

/* L'ACCORD, pixel du fichier par pixel : 1, le modèle passe ; 0, le
   fichier reste ; entre les deux, un fondu. L'écart — le plus grand des
   quatre canaux, les deux images adoucies de `flou` pixels du fichier —,
   élargi d'un pixel (une lettre entière, pas sa moitié) : sous `ACCORD`
   le modèle passe, au-delà de `DESACCORD` c'est le fichier. Sur le logo
   du 29 septembre, le dessin du modèle fait sur le fichier entier passe
   à 99,99 % ; ses lettres inventées sur l'image réduite, non. `ia` : le
   dessin du modèle, `L` × `H` ; `src` : le fichier, `largeur` ×
   `hauteur`, pas plus grand que le dessin. */
export const FLOU = 0.7
export const ACCORD = 40
export const DESACCORD = 72
/* Le fichier se juge jusqu'à une fois et demie la taille de l'image du
   modèle : au-delà, il ne dit rien de plus sur les formes, et un fichier de
   5 000 px jugé entier demanderait des centaines de mégaoctets. */
export const JUGE = 1.5
export function accords(ia, L, H, src, largeur, hauteur, flou = FLOU, accord = ACCORD, desaccord = DESACCORD) {
  const n = largeur * hauteur
  const a = flouter(moyenner(ia, L, H, largeur, hauteur), largeur, hauteur, flou)
  let b = new Float32Array(n * 4)
  for (let i = 0; i < n * 4; i += 4) {
    const t = src[i + 3] / 255, blanc = 255 * (1 - t)
    b[i] = src[i] * t + blanc; b[i + 1] = src[i + 1] * t + blanc; b[i + 2] = src[i + 2] * t + blanc; b[i + 3] = src[i + 3]
  }
  b = flouter(b, largeur, hauteur, flou)
  const e = new Float32Array(n)
  for (let p = 0, i = 0; p < n; p++, i += 4) e[p] = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]), Math.abs(a[i + 3] - b[i + 3]))
  /* Élargi d'un pixel : le plus grand écart des voisins, en largeur puis
     en hauteur. */
  const g = new Float32Array(n), w = new Float32Array(n)
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      const p = y * largeur + x
      g[p] = Math.max(e[p], x > 0 ? e[p - 1] : 0, x < largeur - 1 ? e[p + 1] : 0)
    }
  }
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      const p = y * largeur + x
      const d = Math.max(g[p], y > 0 ? g[p - largeur] : 0, y < hauteur - 1 ? g[p + largeur] : 0)
      w[p] = d <= accord ? 1 : d >= desaccord ? 0 : (desaccord - d) / (desaccord - accord)
    }
  }
  return w
}

/* LE DESSIN GARDÉ : le modèle là où il s'accorde avec le fichier, le
   fichier agrandi et raffermi ailleurs, en fondu (le poids de chaque pixel
   fin se lit en douceur entre les pixels du fichier qui l'entourent).
   Bande par bande (`bande` lignes fines) : un dessin de 5 000 px ne tient
   pas trois fois en mémoire — et une bande où tout s'accorde ne se touche
   pas. `ia` est modifié sur place, et rendu. */
export const BANDE = 256
export function fidele(ia, L, H, src, largeur, hauteur, { flou = FLOU, accord = ACCORD, desaccord = DESACCORD, bande = BANDE } = {}) {
  const w = accords(ia, L, H, src, largeur, hauteur, flou, accord, desaccord)
  /* Le raffermi regarde un pixel et demi du fichier alentour. */
  const rayon = Math.max(2, Math.round(1.5 * L / largeur))
  const fx = largeur / L, fy = hauteur / H
  const place = (X, f, n) => Math.min(n - 1, Math.max(0, (X + 0.5) * f - 0.5))
  for (let Y0 = 0; Y0 < H; Y0 += bande) {
    const Y1 = Math.min(H, Y0 + bande)
    const s0 = Math.floor(place(Y0, fy, hauteur)), s1 = Math.min(hauteur - 1, Math.floor(place(Y1 - 1, fy, hauteur)) + 1)
    let tout = true
    for (let p = s0 * largeur; p < (s1 + 1) * largeur; p++) if (w[p] < 1) { tout = false; break }
    if (tout) continue
    const m0 = Math.max(0, Y0 - rayon), m1 = Math.min(H, Y1 + rayon)
    const net = raffermir(agrandir(src, largeur, hauteur, L, H, m0, m1), L, m1 - m0, rayon)
    for (let Y = Y0; Y < Y1; Y++) {
      const sy = place(Y, fy, hauteur), y0 = Math.floor(sy), y1 = Math.min(hauteur - 1, y0 + 1), ty = sy - y0
      for (let X = 0; X < L; X++) {
        const sx = place(X, fx, largeur), x0 = Math.floor(sx), x1 = Math.min(largeur - 1, x0 + 1), tx = sx - x0
        const k = (w[y0 * largeur + x0] * (1 - tx) + w[y0 * largeur + x1] * tx) * (1 - ty) + (w[y1 * largeur + x0] * (1 - tx) + w[y1 * largeur + x1] * tx) * ty
        if (k >= 1) continue
        const o = (Y * L + X) * 4, q = ((Y - m0) * L + X) * 4
        for (let c = 0; c < 4; c++) ia[o + c] = net[q + c] + k * (ia[o + c] - net[q + c])
      }
    }
  }
  return ia
}

/* LE FICHIER AGRANDI, RAFFERMI : l'agrandissement doux met chaque bord à
   sa place, mais flou — sa rampe fait tout un pixel du fichier. Chaque
   pixel fin se range du côté de la teinte claire ou de la teinte sombre
   de son voisinage (`rayon` pixels fins alentour), selon qu'il est d'un
   côté ou de l'autre du milieu de la rampe : le bord devient franc, posé
   exactement sur la ligne où le fichier passait d'une teinte à l'autre —
   la forme des lettres, ni rongée ni bouchée. Un voisinage presque uni
   (moins de `CONTRASTE` d'écart) ne bouge pas : un dégradé reste un
   dégradé. `raideur` : la finesse du bord (1, la rampe telle quelle). */
export const CONTRASTE = 48
const lum = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
export function raffermir(img, L, H, rayon = FACTEUR, raideur = 4, contraste = CONTRASTE) {
  const n = L * H
  /* Au-delà de 16 millions de pixels, la place ne tient plus dans la clé. */
  if (n > 0x1000000) return img
  /* LA CLÉ d'un pixel : sa luminosité en tête, sa place ensuite — le plus
     petit et le plus grand du voisinage se lisent d'une comparaison, et
     leur place avec (un nombre à virgule : exact jusqu'à 2^53). */
  const P = 0x1000000
  const cle = new Float64Array(n)
  for (let p = 0; p < n; p++) cle[p] = Math.round(lum(img, p * 4)) * P + p
  /* Le plus sombre ou le plus clair de `rayon` pixels alentour, en largeur
     (`pas` 1) puis en hauteur (`pas` L) — par blocs de la taille de la
     fenêtre (van Herk) : trois comparaisons par pixel, quel que soit le
     rayon. */
  const w = 2 * rayon + 1
  const passe = (src, long, lignes, pas, saut, clair) => {
    const sortie = new Float64Array(n)
    const g = new Float64Array(long), h = new Float64Array(long), ligne = new Float64Array(long)
    const s = clair ? -1 : 1
    for (let a = 0; a < lignes; a++) {
      const base = a * saut
      /* Le plus clair se cherche comme le plus sombre, de signe inversé. */
      for (let b = 0; b < long; b++) ligne[b] = s * src[base + b * pas]
      for (let b = 0; b < long; b++) g[b] = b % w && g[b - 1] < ligne[b] ? g[b - 1] : ligne[b]
      for (let b = long - 1; b >= 0; b--) h[b] = b % w !== w - 1 && b !== long - 1 && h[b + 1] < ligne[b] ? h[b + 1] : ligne[b]
      /* La fenêtre [lo, hi], rognée aux bords : au début, `g` seul (du
         début du bloc à hi) ; dans un même bloc, `h` seul (de lo à la
         fin) — `h[0]` prenait tout le premier bloc, `g[long - 1]` le
         dernier depuis son début. */
      for (let b = 0; b < long; b++) {
        const lo = b > rayon ? b - rayon : 0, hi = b + rayon < long ? b + rayon : long - 1
        const v = lo === 0 ? g[hi] : (lo / w | 0) === (hi / w | 0) ? h[lo] : h[lo] < g[hi] ? h[lo] : g[hi]
        sortie[base + b * pas] = s * v
      }
    }
    return sortie
  }
  const bas = passe(passe(cle, L, H, 1, L, false), H, L, L, 1, false)
  const haut = passe(passe(cle, L, H, 1, L, true), H, L, L, 1, true)
  const sortie = new Uint8ClampedArray(img)
  for (let p = 0; p < n; p++) {
    const lo = Math.floor(bas[p] / P), hi = Math.floor(haut[p] / P)
    if (hi - lo < contraste) continue
    const t = ((Math.floor(cle[p] / P) - lo) / (hi - lo) - 0.5) * raideur + 0.5
    const s = t < 0 ? 0 : t > 1 ? 1 : t
    const i = p * 4, a = (bas[p] % P) * 4, b = (haut[p] % P) * 4
    for (let c = 0; c < 3; c++) sortie[i + c] = img[a + c] + s * (img[b + c] - img[a + c])
  }
  return sortie
}

/* ======================================================= LES COULEURS BORNÉES
   29 septembre 2026 : « des qu'il passe l'IA magique ça fait disparaître
   des lettres ». Le modèle a appris sur des dessins animés, qui ont un
   trait noir autour de chaque forme : il en pose un — un liseré bleu nuit
   autour d'une main bleue, le cœur des petites lettres grises foncé
   jusqu'au noir, des reflets violets et verts dans un gris. Ce sont des
   couleurs que le fichier n'a pas, là. Chaque pixel du dessin garde donc sa
   netteté mais pas sa couleur inventée : canal par canal, il reste entre
   le plus sombre et le plus clair du fichier autour de lui (`rayon` pixels
   du fichier), à `marge` niveaux près. Un bord devient franc — ses deux
   couleurs sont là, autour —, aucune ne naît. `ia` : le dessin du modèle,
   `L` × `H`, modifié sur place ; `src` : le fichier, `largeur` × `hauteur`,
   posé sur du blanc comme l'entrée du modèle. */
export const MARGE_COULEUR = 10
/* Le plus petit (ou le plus grand, `plus`) de chaque canal de `v` (RVB) sur
   (2 rayon + 1)², en largeur puis en hauteur — rangée après rangée, dans
   l'ordre de la mémoire (2 octobre 2026 : la passe en hauteur la lisait
   colonne par colonne). */
function extremes(v, largeur, hauteur, rayon, plus) {
  const t = new Uint8ClampedArray(v.length), s = new Uint8ClampedArray(v.length)
  for (let y = 0; y < hauteur; y++) {
    const o = y * largeur * 3
    for (let x = 0; x < largeur; x++) {
      const j0 = Math.max(0, x - rayon), j1 = Math.min(largeur - 1, x + rayon)
      for (let c = 0; c < 3; c++) {
        let m = v[o + j0 * 3 + c]
        for (let j = j0 + 1; j <= j1; j++) { const w = v[o + j * 3 + c]; if (plus ? w > m : w < m) m = w }
        t[o + x * 3 + c] = m
      }
    }
  }
  const l3 = largeur * 3
  for (let y = 0; y < hauteur; y++) {
    const j0 = Math.max(0, y - rayon), j1 = Math.min(hauteur - 1, y + rayon), o = y * l3
    s.set(t.subarray(j0 * l3, j0 * l3 + l3), o)
    for (let j = j0 + 1; j <= j1; j++) {
      const q = j * l3
      if (plus) { for (let k = 0; k < l3; k++) { const w = t[q + k]; if (w > s[o + k]) s[o + k] = w } }
      else for (let k = 0; k < l3; k++) { const w = t[q + k]; if (w < s[o + k]) s[o + k] = w }
    }
  }
  return s
}
export function borner(ia, L, H, src, largeur, hauteur, { rayon = 1, marge = MARGE_COULEUR } = {}) {
  const n = largeur * hauteur
  /* Le fichier sur du blanc, puis le plus petit et le plus grand de chaque
     canal sur (2 rayon + 1)², en largeur puis en hauteur. */
  const bas = new Uint8ClampedArray(n * 3), haut = new Uint8ClampedArray(n * 3)
  for (let p = 0; p < n; p++) {
    const a = src[p * 4 + 3] / 255, blanc = 255 * (1 - a)
    for (let c = 0; c < 3; c++) bas[p * 3 + c] = haut[p * 3 + c] = src[p * 4 + c] * a + blanc
  }
  const mini = extremes(bas, largeur, hauteur, rayon, false)
  const maxi = extremes(haut, largeur, hauteur, rayon, true)
  const fx = largeur / L, fy = hauteur / H
  const colonne = new Int32Array(L)
  for (let X = 0; X < L; X++) colonne[X] = Math.min(largeur - 1, Math.floor((X + 0.5) * fx)) * 3
  for (let Y = 0; Y < H; Y++) {
    const sy = Math.min(hauteur - 1, Math.floor((Y + 0.5) * fy))
    for (let X = 0; X < L; X++) {
      const s = sy * largeur * 3 + colonne[X], o = (Y * L + X) * 4
      for (let c = 0; c < 3; c++) {
        const lo = mini[s + c] - marge, hi = maxi[s + c] + marge
        if (ia[o + c] < lo) ia[o + c] = lo
        else if (ia[o + c] > hi) ia[o + c] = hi
      }
    }
  }
  return ia
}

/* ===================================================== LES TEINTES RECALÉES
   30 septembre 2026. Le modèle de l'Ultra éclaircit un fond crème de neuf
   niveaux et fonce un noir de trois ; celui du nettoyage, un doré de
   quelques-uns. C'est sous la marge de `borner`, mais une teinte lue sur
   l'image nettoyée part à la presse : elle doit être celle du fichier.
   Canal par canal, la droite y = a x + b qui ramène le dessin, réduit à la
   taille du fichier (`moyenner`), sur le fichier, là où le fichier est uni
   (moins de `UNI` niveaux d'écart sur 3 × 3 pixels, dans les trois canaux :
   un aplat, pas un bord), s'applique au dessin entier — `a` entre 0,8 et
   1,25 : un recalage, pas une autre image. Sur les six logos de l'Ultra, le
   fond crème revient (+ 2,7 dB sur ce logo-là, + 0,6 en moyenne), le
   monogramme doré du nettoyage aussi (+ 1,4 dB). `ia` : le dessin, `L` ×
   `H`, modifié sur place ; `src` : le fichier, `largeur` × `hauteur`. */
export const UNI = 12
export function recaler(ia, L, H, src, largeur, hauteur, { uni = UNI } = {}) {
  const n = largeur * hauteur
  const bas = moyenner(ia, L, H, largeur, hauteur)
  const blanc = new Float32Array(n * 3)
  for (let p = 0; p < n; p++) {
    const a = src[p * 4 + 3] / 255
    for (let c = 0; c < 3; c++) blanc[p * 3 + c] = src[p * 4 + c] * a + 255 * (1 - a)
  }
  const s = new Float64Array(15)
  for (let y = 1; y < hauteur - 1; y++) {
    for (let x = 1; x < largeur - 1; x++) {
      let plat = true
      for (let c = 0; c < 3 && plat; c++) {
        let lo = 255, hi = 0
        for (let j = -1; j <= 1; j++) {
          for (let i = -1; i <= 1; i++) {
            const v = blanc[((y + j) * largeur + x + i) * 3 + c]
            if (v < lo) lo = v
            if (v > hi) hi = v
          }
        }
        plat = hi - lo <= uni
      }
      if (!plat) continue
      const p = y * largeur + x
      for (let c = 0; c < 3; c++) {
        const X = bas[p * 4 + c], Y = blanc[p * 3 + c]
        s[c * 5] += 1; s[c * 5 + 1] += X; s[c * 5 + 2] += Y; s[c * 5 + 3] += X * X; s[c * 5 + 4] += X * Y
      }
    }
  }
  /* Moins d'un pixel sur cent d'uni : rien de sûr à quoi se recaler. */
  if (s[0] < n / 100) return ia
  const droites = [0, 1, 2].map(c => {
    const [m, sx, sy, sxx, sxy] = s.subarray(c * 5, c * 5 + 5)
    const vx = sxx / m - (sx / m) ** 2
    const a = Math.min(1.25, Math.max(0.8, vx > 1 ? (sxy / m - sx / m * sy / m) / vx : 1))
    return [a, sy / m - a * sx / m]
  })
  for (let o = 0; o < L * H * 4; o += 4) {
    for (let c = 0; c < 3; c++) ia[o + c] = droites[c][0] * ia[o + c] + droites[c][1]
  }
  return ia
}

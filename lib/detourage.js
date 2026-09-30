/* ================================================================ LE DÉTOURAGE
   25 septembre 2026 : « ma vendeuse ajoute le logo ChatGPT pourri avec un
   fond blanc ». Un logo sorti de ChatGPT arrive sur un fond blanc (ou
   blanc cassé, ou le faux damier gris et blanc qui imite la transparence) :
   imprimé tel quel en DTF, le blanc part sur le textile.
   Ici, le calcul seul — des pixels qui entrent, des pixels qui sortent, sans
   navigateur. Le studio qui s'en sert (lib/studio-detourage.js) a sa propre
   entrée dans la barre, au-dessus de Réglages.
   DEUX FAÇONS DE RETIRER UN FOND. Un fond UNI — blanc, noir, de couleur —
   part à la couleur près, ici. Un vrai décor (une photo prise dans une
   pièce, un jardin) n'a pas de couleur à retirer : c'est un modèle qui
   trouve le sujet (lib/sujet.js). Le studio choisit seul en ouvrant le
   fichier (`methodeConseillee`) ; on passe de l'une à l'autre d'un geste.
   LA RÈGLE DU FOND UNI : le fond, c'est la couleur qui borde l'image. On part des bords
   et on efface tout ce qui y ressemble et qui s'y rattache ; le blanc
   ENFERMÉ dans le dessin (un texte blanc sur un badge rouge) reste, sauf si
   on demande aussi « l'intérieur » (le creux d'un O, d'un A). Le liseré qui
   borde le dessin se fond à moitié transparent au lieu de garder un halo
   blanc. Puis les réglages fins : resserrer le bord, balayer les
   poussières, et les coups de pinceau — effacer, restaurer — posés à la
   main. */

import { cadreUtile } from './logo.js'

/* Écart, sur le canal le plus éloigné, sous lequel un pixel est du fond :
   assez pour le bruit d'un JPEG passé par WhatsApp, pas assez pour manger
   un gris clair voulu. */
export const TOLERANCE = 28
export const LISERE = 2
const TRANSPARENT = 16

/* LES RÉGLAGES D'ORIGINE, ceux qui conviennent à un logo ChatGPT ordinaire.
   Le blanc enfermé dans les lettres part d'office (25 septembre 2026 : « le
   blanc dans les lettres doit aussi être supprimé ») ; « Depuis les bords »
   le garde, pour un texte blanc voulu sur un badge. */
export const REGLAGES = Object.freeze({ tolerance: TOLERANCE, lisere: LISERE, resserrer: 0, poussieres: 0, ombres: 0, interieur: true })

/* LES COULEURS DU FOND, lues sur le pourtour. Une ou deux (le faux damier en
   a deux) ; aucune quand le bord est déjà transparent ou que le dessin le
   remplit. */
export function fondsDuBord(data, largeur, hauteur) {
  const cases = new Map()
  let total = 0
  const compter = i => {
    total++
    if (data[i + 3] < TRANSPARENT) return
    const cle = (data[i] >> 4) << 8 | (data[i + 1] >> 4) << 4 | data[i + 2] >> 4
    const c = cases.get(cle) || { n: 0, r: 0, g: 0, b: 0 }
    c.n++; c.r += data[i]; c.g += data[i + 1]; c.b += data[i + 2]
    cases.set(cle, c)
  }
  for (let x = 0; x < largeur; x++) {
    compter(x * 4)
    if (hauteur > 1) compter(((hauteur - 1) * largeur + x) * 4)
  }
  for (let y = 1; y < hauteur - 1; y++) {
    compter(y * largeur * 4)
    if (largeur > 1) compter((y * largeur + largeur - 1) * 4)
  }
  const fonds = [...cases.values()]
    .filter(c => c.n >= total * 0.15)
    .sort((a, b) => b.n - a.n)
    .slice(0, 2)
    .map(c => [Math.round(c.r / c.n), Math.round(c.g / c.n), Math.round(c.b / c.n)])
  /* Une seconde couleur n'est du fond que si les deux sont des gris — le
     damier. Un dessin coloré qui touche le bord reste du dessin. */
  const lus = fonds.length === 2 && !fonds.every(gris) ? fonds.slice(0, 1) : fonds
  /* UN FOND CLAIR EMMÈNE LE BLANC PUR (25 septembre 2026, « le blanc des
     lettres ne fonctionne pas toujours bien ») : ChatGPT pose volontiers
     ses lettres blanc pur sur un fond crème, ou sur un dégradé qui fonce
     vers les bords. L'écart entre les deux frôlait le seuil : les lettres ne
     partaient qu'à moitié, en dentelle. */
  if (lus.length && Math.min(...lus[0]) >= 200 && !lus.some(c => Math.min(...c) >= 248)) lus.push([255, 255, 255])
  return lus
}

const gris = c => Math.max(...c) - Math.min(...c) < 24

/* LA COULEUR SOUS LA PIPETTE : la moyenne d'un carré de 3 × 3, pour ne pas
   tomber sur le seul pixel bruité d'un JPEG. */
export function couleurA(data, largeur, hauteur, x, y) {
  let r = 0, g = 0, b = 0, n = 0
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const xx = Math.round(x) + dx
      const yy = Math.round(y) + dy
      if (xx < 0 || yy < 0 || xx >= largeur || yy >= hauteur) continue
      const i = (yy * largeur + xx) * 4
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n++
    }
  }
  return n ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)] : null
}

export const hexa = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('')

const ecart = (data, i, f) => Math.max(Math.abs(data[i] - f[0]), Math.abs(data[i + 1] - f[1]), Math.abs(data[i + 2] - f[2]))

/* RETIRER LE FOND, sur le RGBA d'un canevas, en place.
   - `fonds` : les couleurs à retirer ; absent, elles se lisent sur le bord.
     Une liste vide ne retire que ce qui est déjà transparent.
   - `tolerance` : l'écart sous lequel un pixel est du fond.
   - `interieur` : le fond enfermé dans le dessin part aussi ; sans lui, le
     fond vu à travers les formes posées dehors part quand même — le creux
     des lettres d'un texte à côté du logo (`lettresDehors`) —, sauf
     `lettres: false`.
   - `lisere` : sur combien de pixels le bord se fond (0 : bord franc).
   - `resserrer` : le fond mord de tant de pixels sur le dessin — le dernier
     halo clair d'un JPEG part avec.
   - `poussieres` : les îlots du dessin plus petits que tant de pixels
     s'effacent (les points de bruit restés dans le fond).
   - `ombres` (0 à 100) : l'ombre portée grise qui touche le fond part avec
     lui — un gris sans couleur, d'autant plus foncé que le curseur monte.
     Seulement depuis le fond : un gris enfermé dans le dessin reste.
   Rend les couleurs prises pour le fond et le nombre de pixels effacés. */
export function retirerFond(data, largeur, hauteur, options = {}) {
  const {
    tolerance = TOLERANCE, interieur = false, lettres = true, lisere = LISERE, resserrer = 0, poussieres = 0, ombres = 0,
  } = options
  const fonds = Array.isArray(options.fonds) ? options.fonds : fondsDuBord(data, largeur, hauteur)
  const n = largeur * hauteur

  /* L'écart de chaque pixel au fond le plus proche, et lequel. */
  const proche = new Uint8Array(n)
  const passe = new Uint8Array(n)
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    if (data[i + 3] < TRANSPARENT) { passe[p] = 1; continue }
    let d = 256
    for (let k = 0; k < fonds.length; k++) {
      const dk = ecart(data, i, fonds[k])
      if (dk < d) { d = dk; proche[p] = k }
    }
    if (d < tolerance) passe[p] = 1
    /* 2 : une ombre, qui ne part qu'avec le fond qu'elle touche. */
    else if (ombres > 0 && fonds.length && estOmbre(data, i, ombres)) passe[p] = 2
  }

  /* Depuis les bords, de proche en proche. 1 : le fond. */
  const fond = new Uint8Array(n)
  const pile = new Int32Array(n)
  let haut = 0
  const semer = p => { if (!fond[p] && passe[p]) { fond[p] = 1; pile[haut++] = p } }
  for (let x = 0; x < largeur; x++) { semer(x); semer((hauteur - 1) * largeur + x) }
  for (let y = 0; y < hauteur; y++) { semer(y * largeur); semer(y * largeur + largeur - 1) }
  while (haut) {
    const p = pile[--haut]
    const x = p % largeur
    if (x > 0) semer(p - 1)
    if (x < largeur - 1) semer(p + 1)
    if (p >= largeur) semer(p - largeur)
    if (p < n - largeur) semer(p + largeur)
  }
  if (interieur) {
    /* Seuls les creux partent, pas les reflets (voir `creux`). */
    const candidat = new Uint8Array(n)
    for (let p = 0; p < n; p++) {
      if (passe[p] !== 1 || fond[p]) continue
      if (data[p * 4 + 3] < TRANSPARENT) fond[p] = 1
      else candidat[p] = 1
    }
    const trous = creux(data, largeur, hauteur, candidat, fonds, { hors: passe, file: pile, tolerance })
    for (let p = 0; p < n; p++) if (trous[p]) fond[p] = 1
    /* L'ombre tombée dans le creux d'un B ou d'un O part avec ce creux. */
    if (ombres > 0) {
      for (const p of bordure(fond, largeur, hauteur, 1)) pile[haut++] = p
      while (haut) {
        const p = pile[--haut]
        const x = p % largeur
        if (x > 0) semer(p - 1)
        if (x < largeur - 1) semer(p + 1)
        if (p >= largeur) semer(p - largeur)
        if (p < n - largeur) semer(p + largeur)
      }
    }
  } else if (lettres && fonds.length) {
    const trous = lettresDehors(data, largeur, hauteur, fond, passe, fonds, { file: pile, tolerance })
    for (let p = 0; p < n; p++) if (trous[p]) fond[p] = 1
  }

  /* Resserrer : le fond gagne d'un pixel par tour. */
  let front = bordure(fond, largeur, hauteur, 1)
  for (let tour = 0; tour < resserrer && front.length; tour++) {
    const suivant = []
    voisins(front, largeur, hauteur, q => { if (!fond[q]) { fond[q] = 1; suivant.push(q) } })
    front = suivant
  }

  /* Les poussières : un îlot du dessin trop petit rejoint le fond. */
  if (poussieres > 0) balayer(data, fond, largeur, hauteur, poussieres)

  let retires = 0
  for (let p = 0; p < n; p++) {
    if (fond[p] !== 1) continue
    const i = p * 4
    if (data[i + 3] >= TRANSPARENT) retires++
    data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0
  }
  if (!fonds.length) return { fonds, retires }

  /* LE LISERÉ : les pixels du dessin qui touchent le fond sont un mélange
     du dessin et du fond (l'anticrénelage, le flou du JPEG). On en retire la
     part de fond — il reste la couleur du dessin, à moitié transparente. */
  if (lisere > 0) {
    const lisereListe = []
    front = bordure(fond, largeur, hauteur, 1)
    for (let tour = 0; tour < lisere && front.length; tour++) {
      const suivant = []
      voisins(front, largeur, hauteur, q => { if (!fond[q]) { fond[q] = 2; suivant.push(q); lisereListe.push(q) } })
      front = suivant
    }
    const avant = data.slice()
    for (const q of lisereListe) fondre(avant, data, q, largeur, hauteur, fond, fonds[proche[q]], lisere + 1)
  }
  miettes(data, largeur, hauteur, fonds, tolerance)
  return { fonds, retires }
}

/* LES CREUX, PAS LES REFLETS (27 septembre 2026, un phénix en dégradé :
   « ça creuse toujours les logos que ça ne devrait pas creuser à
   l'intérieur »). « Intérieur du logo aussi » retirait tout ce qui avait la
   couleur du fond, jusqu'aux reflets pâles du dessin. Un morceau couleur de
   fond enfermé dans le dessin est un CREUX — le fond vu à travers, le creux
   d'un O, le blanc d'une lettre sur un badge — quand le dessin l'arrête
   net : à `s` pixels de son bord, le dessin a déjà sa couleur. Un REFLET
   pâlit en douceur : à `s` pixels, le dessin s'éloigne encore du fond.
   Chaque pixel du dessin autour du morceau (jusqu'à 4 `s`) dit son écart au
   fond ; ceux à `s` pixels sont « arrivés » à 80 % du plus grand écart
   moyen plus loin. Deux sur trois arrivés : un creux (dans le doute, le
   dessin reste plein). Rien autour (un
   trait plus fin que `s`) : un creux aussi. Mais un dessin à peine plus
   loin du fond que le seuil (un gris clair, et son grain de JPEG qui passe
   pour du fond par endroits) ne fait pas de creux — à moins de deux fois
   le seuil, on y percerait des piqûres ; une miette de moins de `s`²
   pixels non plus.
   `candidat` : les pixels couleur de fond enfermés ; `hors` : ce qui n'est
   pas du dessin ; `file` : une réserve de n entiers, si on en a une ;
   `miette` : la taille sous laquelle un morceau ne se creuse pas (`s`²
   d'office). Rend 1 sur les pixels des creux. */
export function creux(data, largeur, hauteur, candidat, fonds, { hors = null, file = null, tolerance = TOLERANCE, miette = null } = {}) {
  const n = largeur * hauteur
  const sortie = new Uint8Array(n)
  const s = Math.max(2, Math.round(Math.max(largeur, hauteur) / 700))
  const petit = miette === null ? s * s : miette
  const D = 4 * s
  const vu = new Uint8Array(n)
  if (!file || file.length < n) file = new Int32Array(n)
  const somme = new Float64Array(D + 1), compte = new Float64Array(D + 1)
  const pres = []
  const ecartFond = q => {
    let e = 256
    for (const f of fonds) { const d = ecart(data, q * 4, f); if (d < e) e = d }
    return e
  }
  for (let p0 = 0; p0 < n; p0++) {
    if (!candidat[p0] || vu[p0]) continue
    /* Le morceau (quatre voisins). */
    let tete = 0, queue = 0
    file[queue++] = p0
    vu[p0] = 1
    while (tete < queue) {
      const p = file[tete++]
      const x = p % largeur
      if (x > 0 && candidat[p - 1] && !vu[p - 1]) { vu[p - 1] = 1; file[queue++] = p - 1 }
      if (x < largeur - 1 && candidat[p + 1] && !vu[p + 1]) { vu[p + 1] = 1; file[queue++] = p + 1 }
      if (p >= largeur && candidat[p - largeur] && !vu[p - largeur]) { vu[p - largeur] = 1; file[queue++] = p - largeur }
      if (p < n - largeur && candidat[p + largeur] && !vu[p + largeur]) { vu[p + largeur] = 1; file[queue++] = p + largeur }
    }
    const taille = queue
    if (taille < petit) continue
    /* Le dessin autour, pixel par pixel en s'éloignant. */
    somme.fill(0)
    compte.fill(0)
    pres.length = 0
    let debut = 0, fin = taille
    for (let d = 1; d <= D && debut < fin; d++) {
      for (let k = debut; k < fin; k++) {
        const p = file[k]
        const x = p % largeur
        for (let v = 0; v < 4; v++) {
          const q = v === 0 ? (x > 0 ? p - 1 : -1) : v === 1 ? (x < largeur - 1 ? p + 1 : -1) : v === 2 ? p - largeur : p + largeur
          if (q < 0 || q >= n || vu[q] || candidat[q] || (hors && hors[q]) || data[q * 4 + 3] < TRANSPARENT) continue
          vu[q] = 2
          file[queue++] = q
          const e = ecartFond(q)
          somme[d] += e
          compte[d]++
          if (d === s) pres.push(e)
        }
      }
      debut = fin
      fin = queue
    }
    let loin = 0
    for (let d = 2 * s; d <= D; d++) if (compte[d]) loin = Math.max(loin, somme[d] / compte[d])
    const arrives = pres.filter(e => e >= 0.8 * loin).length
    if (!pres.length || !loin || (loin >= 2 * tolerance && arrives * 3 >= pres.length * 2)) for (let k = 0; k < taille; k++) sortie[file[k]] = 1
    for (let k = taille; k < queue; k++) vu[file[k]] = 0
  }
  return sortie
}

/* LES LETTRES DU DEHORS (29 septembre 2026, un sticker d'île dont le pied
   porte « Réserve Naturelle NATIONALE de Saint-Martin », en vert, posé sur
   le fond blanc : « quand il y a à l'extérieur des lettrages, ça doit
   absolument vider l'intérieur des lettres »). « Autour » ne retirait que
   le fond relié au bord : le blanc des R, des e, des a d'un texte posé
   dehors restait — sur un textile foncé, des taches blanches. Le fond vu à
   travers une forme posée DEHORS part donc aussi ; pas le blanc voulu du
   logo lui-même — la marge blanche du sticker, son titre sur fond blanc, le
   plumage d'un oiseau, le texte blanc d'un badge.
   Les formes du dessin (d'un seul tenant, par les huit voisins) se rangent :
   - DEDANS, celles qui ne touchent pas le fond (le dessin dans la marge du
     sticker, le texte d'un badge) — sauf une poussière, qui ne compte pas ;
   - LE CORPS, la plus grande forme qui touche le fond quand elle fait plus
     de la moitié du dessin (le sticker, le badge, le logo d'un seul tenant) ;
   - LES LETTRES, les autres formes qui touchent le fond ; à côté d'un
     corps, seulement les petites (moins de `PETITES` de la hauteur de
     l'image) : une île du sticker, un grand pictogramme posés dehors gardent
     leur blanc.
   Un morceau couleur de fond enfermé part quand il touche une lettre, ni
   le corps ni le dedans, qu'il n'enferme rien lui-même (l'anneau blanc
   autour d'une île garde l'île) et que le dessin l'arrête net (`creux` :
   un reflet reste).
   « Couleur de fond », ici, au double et quart du seuil (`LETTRES`) : le
   creux d'une petite lettre floue n'est jamais tout à fait blanc — le vert
   du trait y déborde (le triangle d'un A de 20 px, vert très pâle). Et le
   pâle relié au fond qui ne touche que des lettres part aussi : le halo
   clair autour d'un petit texte, le jour entre un t et un u que le fond
   pur n'atteignait pas.
   `fond` : 1 sur le fond relié au bord ; `passe` : 1 sur ce qui a la
   couleur du fond ; `file` : une réserve de n entiers, si on en a une.
   Rend 1 sur les pixels à vider. */
export const LETTRES = 2.25
export const PETITES = 0.05
export function lettresDehors(data, largeur, hauteur, fond, passe, fonds, { file = null, tolerance = TOLERANCE } = {}) {
  const n = largeur * hauteur
  if (!file || file.length < n) file = new Int32Array(n)
  const s = Math.max(2, Math.round(Math.max(largeur, hauteur) / 700))
  /* LE PÂLE : transparent, ou à `LETTRES` seuils du fond au plus. Celui
     qui touche le fond de proche en proche en est le halo ; l'autre est
     enfermé. Le reste est du dessin. */
  const large = Math.round(LETTRES * tolerance)
  const pale = new Uint8Array(n)
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    if (passe[p] === 1 || data[i + 3] < TRANSPARENT) { pale[p] = 1; continue }
    for (const f of fonds) if (ecart(data, i, f) < large) { pale[p] = 1; break }
  }
  const dehors = new Uint8Array(n)
  let haut = 0
  for (let p = 0; p < n; p++) if (fond[p] === 1) { dehors[p] = 1; file[haut++] = p }
  while (haut) {
    const p = file[--haut]
    const x = p % largeur
    for (let v = 0; v < 4; v++) {
      const q = v === 0 ? (x > 0 ? p - 1 : -1) : v === 1 ? (x < largeur - 1 ? p + 1 : -1) : v === 2 ? p - largeur : p + largeur
      if (q >= 0 && q < n && pale[q] && !dehors[q]) { dehors[q] = 1; file[haut++] = q }
    }
  }
  const enfermes = new Uint8Array(n)
  let aucun = true
  for (let p = 0; p < n; p++) if (pale[p] && !dehors[p]) { enfermes[p] = 1; aucun = false }
  if (aucun) return new Uint8Array(n)
  /* UNE FORME, de proche en proche par les huit voisins : sa taille, sa
     hauteur, et si elle touche le fond (par un côté) ou le bord de l'image. */
  const forme = (p0, marque, valeur) => {
    let tete = 0, queue = 0, touche = false, y0 = hauteur, y1 = -1
    file[queue++] = p0
    marque[p0] = valeur
    while (tete < queue) {
      const p = file[tete++]
      const x = p % largeur, y = (p - x) / largeur
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= hauteur) { touche = true; continue }
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue
          const xx = x + dx
          if (xx < 0 || xx >= largeur) { touche = true; continue }
          const q = yy * largeur + xx
          if (dehors[q]) { if (!dx || !dy) touche = true; continue }
          if (marque[q] || enfermes[q]) continue
          marque[q] = valeur
          file[queue++] = q
        }
      }
    }
    return { taille: queue, touche, haut: y1 - y0 + 1 }
  }
  /* Premier passage : les formes, dans l'ordre où on les rencontre. */
  const vu = new Uint8Array(n)
  const formes = []
  let total = 0
  for (let p = 0; p < n; p++) {
    if (dehors[p] || enfermes[p] || vu[p]) continue
    const f = forme(p, vu, 1)
    formes.push(f)
    total += f.taille
  }
  let corps = -1
  for (let k = 0; k < formes.length; k++) if (formes[k].touche && (corps < 0 || formes[k].taille > formes[corps].taille)) corps = k
  if (corps >= 0 && formes[corps].taille * 2 <= total) corps = -1
  /* Second passage, le même ordre : 1 sur les lettres, 2 sur ce qui
     protège (le corps, le dedans, une grande forme du dehors à côté d'un
     corps), 3 sur une poussière du dedans — moins d'un carré de 2 `s` de
     côté, un grain laissé dans le creux d'une lettre —, qui ne compte pas. */
  const poussiere = 4 * s * s
  const petite = PETITES * hauteur
  const rang = new Uint8Array(n)
  for (let p = 0, k = 0; p < n; p++) {
    if (dehors[p] || enfermes[p] || rang[p]) continue
    const f = formes[k]
    forme(p, rang, k === corps ? 2 : !f.touche ? (f.taille >= poussiere ? 2 : 3) : corps >= 0 && f.haut > petite ? 2 : 1)
    k++
  }
  /* N'ENFERME-T-IL RIEN ? Dans son cadre élargi d'un pixel, ce qui n'est
     pas lui et qu'on n'atteint pas depuis le bord du cadre (huit voisins)
     est enfermé ; une poussière n'y compte pas. */
  const enferme = (taille, x0, y0, x1, y1) => {
    const L = x1 - x0 + 3, H = y1 - y0 + 3
    const g = new Uint8Array(L * H)
    for (let k = 0; k < taille; k++) {
      const p = file[k], x = p % largeur, y = (p - x) / largeur
      g[(y - y0 + 1) * L + (x - x0 + 1)] = 1
    }
    const pile = new Int32Array(L * H)
    let haut = 0
    for (let x = 0; x < L; x++) { g[x] = 2; pile[haut++] = x; g[(H - 1) * L + x] = 2; pile[haut++] = (H - 1) * L + x }
    for (let y = 1; y < H - 1; y++) { g[y * L] = 2; pile[haut++] = y * L; g[y * L + L - 1] = 2; pile[haut++] = y * L + L - 1 }
    while (haut) {
      const c = pile[--haut], x = c % L, y = (c - x) / L
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= H) continue
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= L) continue
          const q = yy * L + xx
          if (!g[q]) { g[q] = 2; pile[haut++] = q }
        }
      }
    }
    let dedans = 0
    for (let c = 0; c < L * H; c++) if (!g[c]) dedans++
    return dedans >= poussiere
  }
  /* Les morceaux enfermés (quatre voisins) : ceux qui touchent une lettre,
     rien qui protège, et n'enferment rien sont candidats. */
  const libres = new Uint8Array(n)
  vu.fill(0)
  for (let p0 = 0; p0 < n; p0++) {
    if (!enfermes[p0] || vu[p0]) continue
    let tete = 0, queue = 0, protege = false, lettre = false
    let x0 = largeur, y0 = hauteur, x1 = -1, y1 = -1
    file[queue++] = p0
    vu[p0] = 1
    while (tete < queue) {
      const p = file[tete++]
      const x = p % largeur, y = (p - x) / largeur
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      for (let v = 0; v < 4; v++) {
        const q = v === 0 ? (x > 0 ? p - 1 : -1) : v === 1 ? (x < largeur - 1 ? p + 1 : -1) : v === 2 ? p - largeur : p + largeur
        if (q < 0 || q >= n) continue
        if (enfermes[q]) { if (!vu[q]) { vu[q] = 1; file[queue++] = q } } else if (rang[q] === 2) protege = true
        else if (rang[q] === 1) lettre = true
      }
    }
    if (protege || !lettre || enferme(queue, x0, y0, x1, y1)) continue
    for (let k = 0; k < queue; k++) libres[file[k]] = 1
  }
  /* Entre deux lettres qui se touchent, le jour d'un pixel ou deux compte
     aussi : il ne touche que des lettres, ce n'est pas du grain. */
  const trous = creux(data, largeur, hauteur, libres, fonds, { hors: pale, file, tolerance: large, miette: 2 })
  /* LE HALO DES LETTRES : chaque morceau du pâle relié au fond (sans le fond
     pur), s'il touche une lettre et rien qui protège. */
  vu.fill(0)
  for (let p0 = 0; p0 < n; p0++) {
    if (!dehors[p0] || fond[p0] === 1 || vu[p0]) continue
    let tete = 0, queue = 0, protege = false, lettre = false
    file[queue++] = p0
    vu[p0] = 1
    while (tete < queue) {
      const p = file[tete++]
      const x = p % largeur
      for (let v = 0; v < 4; v++) {
        const q = v === 0 ? (x > 0 ? p - 1 : -1) : v === 1 ? (x < largeur - 1 ? p + 1 : -1) : v === 2 ? p - largeur : p + largeur
        if (q < 0 || q >= n || fond[q] === 1) continue
        if (dehors[q]) { if (!vu[q]) { vu[q] = 1; file[queue++] = q } } else if (rang[q] === 2) protege = true
        else if (rang[q] === 1) lettre = true
      }
    }
    if (lettre && !protege) for (let k = 0; k < queue; k++) trous[file[k]] = 1
  }
  return trous
}

/* LES MIETTES (25 septembre 2026, un logo passé en JPEG, et plus d'Ultra HD
   pour le débruiter) : la compression sème, autour du dessin, des pixels
   isolés qu'aucun seuil n'emporte — un peu trop loin du blanc pour partir,
   ou à demi fondus par le liseré. Imprimés, ce sont des points sur le
   textile. Un îlot de quelques pixels part s'il est pâle (jamais à moitié
   opaque), de la couleur du fond au double du seuil près, ou d'un ou deux
   pixels seulement (un dixième de millimètre à 300 dpi) ; le point d'un i,
   opaque et d'une vraie couleur, reste. */
function miettes(data, largeur, hauteur, fonds, tolerance) {
  const n = largeur * hauteur
  const taille = Math.max(8, Math.round(n / 100000))
  const vu = new Uint8Array(n)
  const pile = new Int32Array(n)
  const ilot = []
  for (let depart = 0; depart < n; depart++) {
    if (vu[depart] || data[depart * 4 + 3] < TRANSPARENT) continue
    ilot.length = 0
    let compte = 0
    let haut = 0
    pile[haut++] = depart
    vu[depart] = 1
    while (haut) {
      const p = pile[--haut]
      if (++compte <= taille) ilot.push(p)
      const x = p % largeur
      const y = (p - x) / largeur
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= hauteur) continue
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= largeur) continue
          const q = yy * largeur + xx
          if (vu[q] || data[q * 4 + 3] < TRANSPARENT) continue
          vu[q] = 1
          pile[haut++] = q
        }
      }
    }
    if (compte > taille) continue
    const pale = ilot.every(p => data[p * 4 + 3] < 128)
    const commeLeFond = ilot.every(p => fonds.some(f => ecart(data, p * 4, f) < 2 * tolerance))
    if (compte <= 2 || pale || commeLeFond) for (const p of ilot) data[p * 4] = data[p * 4 + 1] = data[p * 4 + 2] = data[p * 4 + 3] = 0
  }
}

/* UN GRIS D'OMBRE : sans couleur (les trois canaux proches), et plus clair
   qu'un seuil qui descend quand le curseur monte — à 100, jusqu'au gris
   moyen. Le noir d'un contour, lui, ne passe jamais. */
function estOmbre(data, i, ombres) {
  const r = data[i], g = data[i + 1], b = data[i + 2]
  const haut = Math.max(r, g, b)
  return haut - Math.min(r, g, b) <= 26 && haut >= 250 - ombres * 1.7
}

/* Les pixels marqués `valeur` qui touchent un pixel qui ne l'est pas. */
function bordure(marque, largeur, hauteur, valeur) {
  const liste = []
  const n = largeur * hauteur
  for (let p = 0; p < n; p++) {
    if (marque[p] !== valeur) continue
    const x = p % largeur
    if ((x > 0 && marque[p - 1] !== valeur) || (x < largeur - 1 && marque[p + 1] !== valeur)
      || (p >= largeur && marque[p - largeur] !== valeur) || (p < n - largeur && marque[p + largeur] !== valeur)) liste.push(p)
  }
  return liste
}

/* Les huit voisins de chaque pixel d'une liste. */
function voisins(liste, largeur, hauteur, faire) {
  for (const p of liste) {
    const x = p % largeur
    const y = (p - x) / largeur
    for (let dy = -1; dy <= 1; dy++) {
      const yy = y + dy
      if (yy < 0 || yy >= hauteur) continue
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx
        if ((dx || dy) && xx >= 0 && xx < largeur) faire(yy * largeur + xx)
      }
    }
  }
}

/* Les îlots du dessin (huit voisins) de moins de `seuil` pixels. */
function balayer(data, fond, largeur, hauteur, seuil) {
  const n = largeur * hauteur
  const vu = new Uint8Array(n)
  const pile = new Int32Array(n)
  const ilot = []
  for (let depart = 0; depart < n; depart++) {
    if (vu[depart] || fond[depart] || data[depart * 4 + 3] < TRANSPARENT) continue
    ilot.length = 0
    let haut = 0
    pile[haut++] = depart
    vu[depart] = 1
    while (haut) {
      const p = pile[--haut]
      if (ilot.length < seuil) ilot.push(p)
      const x = p % largeur
      const y = (p - x) / largeur
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= hauteur) continue
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= largeur) continue
          const q = yy * largeur + xx
          if (vu[q] || fond[q] || data[q * 4 + 3] < TRANSPARENT) continue
          vu[q] = 1
          pile[haut++] = q
        }
      }
    }
    if (ilot.length < seuil) for (const p of ilot) fond[p] = 1
  }
}

/* LA PART DE FOND D'UN PIXEL DU LISERÉ. Le dessin d'à côté — le voisin le
   plus éloigné du fond — dit la couleur pure ; le pixel est sur le trait qui
   va du fond à elle, et sa place sur ce trait est son opacité. Un aplat
   rouge qui borde le blanc reste donc opaque : seul le mélange devient
   transparent. */
function fondre(avant, data, q, largeur, hauteur, fond, f, rayon) {
  const i = q * 4
  const x = q % largeur
  const y = (q - x) / largeur
  let pur = -1
  let loin = 0
  for (let dy = -rayon; dy <= rayon; dy++) {
    const yy = y + dy
    if (yy < 0 || yy >= hauteur) continue
    for (let dx = -rayon; dx <= rayon; dx++) {
      const xx = x + dx
      if (xx < 0 || xx >= largeur) continue
      const r = yy * largeur + xx
      if (fond[r] === 1 || avant[r * 4 + 3] < TRANSPARENT) continue
      const d = ecart(avant, r * 4, f)
      if (d > loin) { loin = d; pur = r * 4 }
    }
  }
  if (pur < 0 || loin < TOLERANCE) return
  /* Le canal où le dessin s'écarte le plus du fond est le plus sûr. */
  let k = 0
  for (let c = 1; c < 3; c++) if (Math.abs(avant[pur + c] - f[c]) > Math.abs(avant[pur + k] - f[k])) k = c
  const a = Math.max(0, Math.min(1, (avant[i + k] - f[k]) / (avant[pur + k] - f[k])))
  if (a >= 0.98) return
  if (a < 0.04) { data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0; return }
  for (let c = 0; c < 3; c++) data[i + c] = Math.max(0, Math.min(255, Math.round(f[c] + (avant[i + c] - f[c]) / a)))
  data[i + 3] = Math.round(avant[i + 3] * a)
}

/* LES COUPS DE PINCEAU, posés après le calcul. Un trait porte son mode
   (`effacer` ou `restaurer`), son rayon et ses points, en fractions de la
   largeur et de la hauteur : le même trait se pose sur l'aperçu et sur
   l'image pleine. Restaurer rend le pixel d'origine, fond compris. */
export function peindre(data, source, largeur, hauteur, trait) {
  const r = Math.max(0.5, trait.rayon * largeur)
  const pts = trait.points.map(([u, v]) => [u * largeur, v * hauteur])
  if (!pts.length) return
  if (pts.length === 1) pts.push(pts[0])
  const effacer = trait.mode === 'effacer'
  for (let s = 1; s < pts.length; s++) {
    const [ax, ay] = pts[s - 1]
    const [bx, by] = pts[s]
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - r - 1))
    const x1 = Math.min(largeur - 1, Math.ceil(Math.max(ax, bx) + r + 1))
    const y0 = Math.max(0, Math.floor(Math.min(ay, by) - r - 1))
    const y1 = Math.min(hauteur - 1, Math.ceil(Math.max(ay, by) + r + 1))
    const vx = bx - ax
    const vy = by - ay
    const l2 = vx * vx + vy * vy
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5 - ax
        const py = y + 0.5 - ay
        const t = l2 ? Math.max(0, Math.min(1, (px * vx + py * vy) / l2)) : 0
        const dx = px - t * vx
        const dy = py - t * vy
        /* Un pixel de fondu au bord du pinceau. */
        const couvre = Math.max(0, Math.min(1, r + 0.5 - Math.sqrt(dx * dx + dy * dy)))
        if (!couvre) continue
        const i = (y * largeur + x) * 4
        if (effacer) {
          data[i + 3] = Math.round(data[i + 3] * (1 - couvre))
        } else {
          for (let c = 0; c < 4; c++) data[i + c] = Math.round(data[i + c] + (source[i + c] - data[i + c]) * couvre)
        }
      }
    }
  }
}

/* TOUT LE DÉTOURAGE, d'une image source vers une image neuve. Les réglages
   en pixels (liseré, resserrer) sont ceux de l'image pleine : `echelle` les
   ramène à la taille de l'aperçu. `poussieres` va de 0 à 100 — à 100, un
   îlot de moins de 1 % de l'image part. */
export function detourer(source, largeur, hauteur, reglages = {}, echelle = 1) {
  const r = Object.assign({}, REGLAGES, reglages)
  const data = new Uint8ClampedArray(source)
  const px = v => Math.round(v * echelle)
  const bilan = retirerFond(data, largeur, hauteur, {
    fonds: r.fonds,
    tolerance: r.tolerance,
    interieur: r.interieur,
    lettres: r.lettres !== false,
    lisere: r.lisere > 0 ? Math.max(1, px(r.lisere)) : 0,
    resserrer: px(r.resserrer),
    poussieres: seuilPoussieres(r.poussieres, largeur * hauteur),
    ombres: r.ombres,
  })
  for (const trait of r.traits || []) peindre(data, source, largeur, hauteur, trait)
  return { data, fonds: bilan.fonds, retires: bilan.retires }
}

export const seuilPoussieres = (niveau, aire) => Math.round(aire * 0.01 * Math.pow(Math.max(0, Math.min(100, niveau || 0)) / 100, 2))

/* LE CADRE DE SORTIE : rogné au dessin (plus de marge blanche à recadrer
   dans l'outil de la presse), puis une marge transparente autour si on en
   veut une. Rend null quand rien n'est dessiné. */
export function cadrer(data, largeur, hauteur, { rogner = true, marge = 0 } = {}) {
  const cadre = rogner ? cadreUtile(data, largeur, hauteur) : { x: 0, y: 0, largeur, hauteur }
  if (!cadre) return null
  const m = Math.max(0, Math.round(marge))
  const l = cadre.largeur + 2 * m
  const h = cadre.hauteur + 2 * m
  const sortie = new Uint8ClampedArray(l * h * 4)
  for (let y = 0; y < cadre.hauteur; y++) {
    const de = ((cadre.y + y) * largeur + cadre.x) * 4
    sortie.set(data.subarray(de, de + cadre.largeur * 4), ((y + m) * l + m) * 4)
  }
  return { data: sortie, largeur: l, hauteur: h, cadre }
}

/* LA PART DE L'IMAGE DEVENUE TRANSPARENTE, pour le dire. */
export function partTransparente(data) {
  let t = 0
  for (let i = 3; i < data.length; i += 4) if (data[i] < TRANSPARENT) t++
  return data.length ? t / (data.length / 4) : 0
}

/* LA TAILLE D'IMPRESSION À 300 DPI, celle d'un transfert DTF net. */
export const centimetres = px => Math.round(px / 300 * 2.54 * 10) / 10

/* « logo chatgpt.jpeg » → « logo chatgpt-sans-fond.png ». */
export function nomSansFond(nom) {
  const base = String(nom || '').replace(/\.[^./\\]*$/, '').trim() || 'logo'
  return base + '-sans-fond.png'
}

/* ------------------------------------------- FOND UNI OU VRAI DÉCOR ? */

/* LE FOND SUR LE POURTOUR : la part qu'il en couvre (ses couleurs,
   fondsDuBord, au seuil près) et son écart moyen à ces couleurs — 0 pour
   l'aplat d'un logo, même passé en JPEG ; 3 et plus pour un mur, un ciel,
   un fond de jungle, qu'une photo a toujours grainés ou dégradés. Un
   pourtour déjà transparent est couvert : il n'y a rien à retirer. */
export function bordDuFond(data, largeur, hauteur, tolerance = TOLERANCE) {
  const fonds = fondsDuBord(data, largeur, hauteur)
  let total = 0
  let couverts = 0
  let somme = 0
  const compter = i => {
    total++
    if (data[i + 3] < TRANSPARENT) { couverts++; return }
    let e = 256
    for (const f of fonds) e = Math.min(e, ecart(data, i, f))
    if (e < tolerance) { couverts++; somme += e }
  }
  for (let x = 0; x < largeur; x++) {
    compter(x * 4)
    if (hauteur > 1) compter(((hauteur - 1) * largeur + x) * 4)
  }
  for (let y = 1; y < hauteur - 1; y++) {
    compter(y * largeur * 4)
    if (largeur > 1) compter((y * largeur + largeur - 1) * 4)
  }
  return { fonds, part: total ? couverts / total : 1, ecart: couverts ? somme / couverts : 0 }
}

export const partUnie = (data, largeur, hauteur) => bordDuFond(data, largeur, hauteur).part

/* LA PART EN APLATS de ce qui n'est pas le fond : les pixels dont les
   voisins de droite et du dessous, à `pas` pixels, ne s'écartent pas de
   plus de `pres` niveaux (2 niveaux, le voisin d'à côté, d'office). Un
   logo, même dégradé par endroits : plus de la moitié ; une photo : son
   grain la laisse sous un dixième. */
export function partEnAplats(data, largeur, hauteur, fonds = [], pres = 2, pas = 1) {
  let plats = 0
  let total = 0
  for (let y = 0; y < hauteur - pas; y++) {
    for (let x = 0; x < largeur - pas; x++) {
      const i = (y * largeur + x) * 4
      if (data[i + 3] < TRANSPARENT || fonds.some(f => ecart(data, i, f) < TOLERANCE)) continue
      total++
      const j = i + 4 * pas
      const k = i + largeur * 4 * pas
      if (Math.max(Math.abs(data[i] - data[j]), Math.abs(data[i + 1] - data[j + 1]), Math.abs(data[i + 2] - data[j + 2]),
        Math.abs(data[i] - data[k]), Math.abs(data[i + 1] - data[k + 1]), Math.abs(data[i + 2] - data[k + 2])) <= pres) plats++
    }
  }
  return total ? plats / total : 1
}

/* LA MÉTHODE, choisie en ouvrant le fichier — mesurée sur sept logos
   (PNG, JPEG, fond blanc, noir, crème, vert, ombre portée) et douze photos
   (animaux, voitures, portraits, une basket sur fond rouge, des sushis) :
   - à la couleur quand le fond est propre et borde presque tout (90 % du
     pourtour, un écart de 2 niveaux au plus : un logo, une illustration sur
     le blanc d'un autocollant, un produit sur un fond de studio) ;
   - encore à la couleur quand il ne borde que la moitié, s'il reste propre
     (4 niveaux) et que le dessin n'a pas le grain d'une photo : un logo
     dont les lettres touchent le bord ;
   - au modèle, tout le reste — un tigre sur une jungle sombre, une photo
     entre deux bandes noires, une basket sur un fond rouge dégradé.
   `logo` : un fond uni, des aplats et peu de teintes — « Partout »
   d'office, le blanc des lettres part aussi. Une illustration, une photo
   gardent leur blanc (« Depuis les bords »), même passées à la couleur à
   la main : le museau blanc d'un chien, une chemise blanche.
   Le logo se juge à six niveaux près, d'un pixel à celui d'après le
   suivant (27 septembre 2026) : agrandi quatre fois par l'IA, un petit
   JPEG a des bords en pente douce et un grain de quelques niveaux — jugé au
   voisin à deux niveaux près, « Le temps des Cerises » passait pour une
   illustration et le creux de ses lettres restait blanc. Le grain ne
   s'additionne pas d'un pixel à l'autre, un dégradé si. */
export function methodeConseillee(data, largeur, hauteur) {
  const { fonds, part, ecart: bord } = bordDuFond(data, largeur, hauteur)
  const aplats = partEnAplats(data, largeur, hauteur, fonds)
  /* Un fond qui borde TOUT le pourtour passe aussi avec le grain d'un
     petit JPEG (29 septembre 2026, « AutoMax » en 263 px sur du noir :
     trois niveaux de grain, pas un aplat de deux niveaux — il partait au
     modèle, qui rongeait ses lettres, et l'IA ne le nettoyait pas). */
  const uni = (part >= 0.9 && bord <= 2) || (part >= 0.97 && bord <= 5) || (part >= 0.5 && bord <= 4 && aplats >= 0.1)
  const logo = uni && partEnAplats(data, largeur, hauteur, fonds, 6, 2) >= 0.5 && !estIllustration(data, fonds)
  return { methode: uni ? 'uni' : 'ia', logo, part, bord, aplats, fonds }
}

/* LES TEINTES D'UNE IMAGE : k-moyennes sur 60 000 pixels pleins au plus,
   départ déterministe (le plus éloigné d'abord) — la même image rend
   toujours les mêmes couleurs, les plus présentes d'abord. */
const distance2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2

function echantillon(data, sauf = []) {
  const n = data.length / 4
  const pas = Math.max(1, Math.floor(n / 60000))
  const pts = []
  for (let p = 0; p < n; p += pas) {
    const i = p * 4
    if (data[i + 3] >= 128 && !sauf.some(f => ecart(data, i, f) < TOLERANCE)) pts.push([data[i], data[i + 1], data[i + 2]])
  }
  return pts
}

function plusProche(p, centres) {
  let m = Infinity, im = 0
  for (let c = 0; c < centres.length; c++) {
    const d = distance2(p, centres[c])
    if (d < m) { m = d; im = c }
  }
  return im
}

export function palette(data, k, sauf = []) {
  const pts = echantillon(data, sauf)
  if (!pts.length || k < 1) return []
  const somme = [0, 0, 0]
  for (const p of pts) { somme[0] += p[0]; somme[1] += p[1]; somme[2] += p[2] }
  const centres = [somme.map(v => Math.round(v / pts.length))]
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
    const sommes = centres.map(() => [0, 0, 0, 0])
    for (let j = 0; j < pts.length; j++) {
      const c = plusProche(pts[j], centres)
      etiquette[j] = c
      const s = sommes[c]
      s[0] += pts[j][0]; s[1] += pts[j][1]; s[2] += pts[j][2]; s[3]++
    }
    let bouge = false
    sommes.forEach((s, c) => {
      if (!s[3]) return
      const neuf = [Math.round(s[0] / s[3]), Math.round(s[1] / s[3]), Math.round(s[2] / s[3])]
      if (distance2(neuf, centres[c])) bouge = true
      centres[c] = neuf
    })
    if (!bouge) break
  }
  const compte = centres.map(() => 0)
  for (let j = 0; j < pts.length; j++) compte[etiquette[j]]++
  return centres.map((c, i) => ({ c, n: compte[i] })).filter(x => x.n).sort((a, b) => b.n - a.n).map(x => x.c)
}

/* UN LOGO OU UNE PHOTO ? (26 septembre 2026, une île pleine de dégradés et
   de petites écritures.) Un logo tient en quelques teintes franches ; une
   illustration, une photo, non. On ramène l'image à douze teintes et l'on
   compte les pixels qu'elles rendent mal (à plus de 30 niveaux) : mesuré,
   un logo ChatGPT, même pixellisé ou passé en JPEG, n'en a pas 2 % ;
   l'illustration, 30 %. Au-delà de 10 %, ce n'est pas un logo : « Partout »
   y effacerait tout ce qui a la couleur du fond — le ventre blanc d'une
   baleine, une chemise blanche. `sauf` : les couleurs du fond, qui ne
   comptent pas — le grand mur uni derrière quelqu'un faisait passer sa
   photo pour un logo. */
export function estIllustration(data, sauf = []) {
  const pal = palette(data, 12, sauf)
  if (!pal.length) return false
  const pts = echantillon(data, sauf)
  let loin = 0
  for (const p of pts) if (distance2(p, pal[plusProche(p, pal)]) > 30 * 30) loin++
  return loin / pts.length > 0.1
}

/* ------------------------------------------- LA PHOTO EST-ELLE EN HD ?
   25 septembre 2026 : « c'est le seul produit non vectoriel qu'on accepte,
   mais la photo doit être en HD ». Elle se juge sur ce qui s'imprimera —
   le sujet détouré, pas la photo entière — et aux tailles de l'atelier
   (lib/tailles-dtf.js) : un dos fait jusqu'à 30 cm de large, un cœur 8.
   - HD : son grand côté fait au moins 1 800 px — un dos de 30 cm à
     150 dpi, le moins qu'une photo supporte sur un textile ; c'est aussi
     le « Full HD » d'un écran ;
   - un cœur seulement : au moins 945 px, un cœur de 8 cm à 300 dpi ;
   - en dessous, même un cœur serait flou : il faut au client la photo
     d'origine (une capture d'écran, un envoi par WhatsApp la réduisent).
   `cm` : la taille nette, à 300 dpi ; `cmMax` : la plus grande correcte,
   à 150 dpi. */
export const HD_PX = 1800
export const COEUR_PX = 945

export function qualiteImpression(largeur, hauteur) {
  const grand = Math.max(largeur, hauteur)
  return {
    niveau: grand >= HD_PX ? 'hd' : grand >= COEUR_PX ? 'coeur' : 'faible',
    cm: [centimetres(largeur), centimetres(hauteur)],
    cmMax: [centimetres(2 * largeur), centimetres(2 * hauteur)],
  }
}

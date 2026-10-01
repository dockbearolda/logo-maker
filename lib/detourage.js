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
import { elementsDu } from './elements.js'
import { lab, ecartLab } from './lab.js'

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
export const REGLAGES = Object.freeze({ tolerance: TOLERANCE, lisere: LISERE, resserrer: 0, poussieres: 0, ombres: 0, interieur: true, ombre: false })

/* LES COULEURS DU FOND, lues sur le pourtour. Une ou deux (le faux damier en
   a deux) ; aucune quand le bord est déjà transparent ou que le dessin le
   remplit. */
export function fondsDuBord(data, largeur, hauteur) {
  return couleursDuPourtour(data, largeur, cadreDuFond(data, largeur, hauteur))
}

/* CHAQUE PIXEL DU POURTOUR du cadre `c` ({ x0, y0, x1, y1 }, bords
   compris), une fois : `f` reçoit son indice dans le RGBA. */
function pourtour(c, largeur, f) {
  for (let x = c.x0; x <= c.x1; x++) {
    f((c.y0 * largeur + x) * 4)
    if (c.y1 > c.y0) f((c.y1 * largeur + x) * 4)
  }
  for (let y = c.y0 + 1; y < c.y1; y++) {
    f((y * largeur + c.x0) * 4)
    if (c.x1 > c.x0) f((y * largeur + c.x1) * 4)
  }
}

/* OÙ SE LIT LE FOND (30 septembre 2026, deux fichiers d'une cliente : « je
   ne peux pas supprimer le fond »). Une image collée sur une toile
   transparente plus grande — un ruban sur son carré blanc, posé dans
   Canva — arrive en PNG avec un pourtour déjà transparent : le fond s'y
   lisait, il n'y avait « rien à retirer », et le carré blanc restait.
   Quand ce qui se voit remplit un rectangle à angles vifs (ses quatre coins
   pleins, son pourtour plein à 97 %), c'est l'image : son fond se lit sur
   son bord à lui, à `RETRAIT` pixels (le bord que la réduction de l'aperçu
   adoucit). Seulement un fond clair, le blanc ou le crème d'une image
   ChatGPT : un badge noir, rouge, déjà détouré, reste un dessin. Un
   autocollant déjà détouré, ses coins arrondis, garde sa marge blanche.
   Sinon, le pourtour de l'image entière.
   LE RETRAIT SUIT LA TAILLE (30 septembre 2026, « quand je zoome, le fond
   carré blanc réapparaît ») : `RETRAIT` pixels d'un aperçu du studio
   (`APERCU_MAX`). L'image pleine, agrandie ×4 par l'IA, a ses bords et ses
   coins adoucis sur trois pixels : à deux, elle n'était plus collée, et
   son détourage — le plan zoomé, l'export — gardait la carte. */
export const APERCU_MAX = 1400
const RETRAIT = 2
const PLEIN = 255 - TRANSPARENT
const retraitDe = (largeur, hauteur) => Math.max(RETRAIT, Math.round(RETRAIT * Math.max(largeur, hauteur) / APERCU_MAX))
const retrait = (vu, r) => ({ x0: vu.x + r, y0: vu.y + r, x1: vu.x + vu.largeur - 1 - r, y1: vu.y + vu.hauteur - 1 - r })
function cadreDuFond(data, largeur, hauteur) {
  const vu = imageCollee(data, largeur, hauteur)
  return vu ? retrait(vu, retraitDe(largeur, hauteur)) : { x0: 0, y0: 0, x1: largeur - 1, y1: hauteur - 1 }
}

/* L'IMAGE COLLÉE sur la toile transparente, s'il y en a une : son cadre
   ({ x, y, largeur, hauteur }), sinon null. */
export function imageCollee(data, largeur, hauteur) {
  const vu = cadreUtile(data, largeur, hauteur, TRANSPARENT)
  if (!vu || (vu.largeur === largeur && vu.hauteur === hauteur)) return null
  const r = retraitDe(largeur, hauteur)
  const c = retrait(vu, r)
  if (c.x1 - c.x0 < 4 * r || c.y1 - c.y0 < 4 * r) return null
  const plein = i => data[i + 3] >= PLEIN
  if (![[c.x0, c.y0], [c.x1, c.y0], [c.x0, c.y1], [c.x1, c.y1]].every(([x, y]) => plein((y * largeur + x) * 4))) return null
  let total = 0, pleins = 0
  pourtour(c, largeur, i => { total++; if (plein(i)) pleins++ })
  if (pleins < 0.97 * total) return null
  const fonds = couleursDuPourtour(data, largeur, c)
  return fonds.length && Math.min(...fonds[0]) >= 200 ? vu : null
}

function couleursDuPourtour(data, largeur, cadre) {
  const cases = new Map()
  let total = 0
  pourtour(cadre, largeur, i => {
    total++
    if (data[i + 3] < TRANSPARENT) return
    const cle = (data[i] >> 4) << 8 | (data[i + 1] >> 4) << 4 | data[i + 2] >> 4
    const c = cases.get(cle) || { n: 0, r: 0, g: 0, b: 0 }
    c.n++; c.r += data[i]; c.g += data[i + 1]; c.b += data[i + 2]
    cases.set(cle, c)
  })
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
const mediane = v => { const t = Array.from(v).sort((a, b) => a - b); return t[t.length >> 1] }

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
    if (d < tolerance || (options.tissu && options.tissu(p))) passe[p] = 1
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
    /* LES ÉLÉMENTS DU DESSIN (30 septembre 2026, lib/elements.js) : ses
       lettres, dont le jour se vide sans exception ; et, dans une
       ILLUSTRATION (`estIllustration` : des couleurs à n'en plus finir),
       le blanc peint d'un élément — l'aigrette, le ventre de la baleine,
       l'écume du 6e3 AME — qui reste là où « Partout » le prenait pour du
       fond. Un logo à plat se creuse comme avant : tout ce qui a la
       couleur du fond et un bord net. `elements` : forcé vrai ou faux. */
    const el = elementsDu(data, largeur, hauteur, passe, pile)
    const illustration = options.elements === undefined ? fonds.length > 0 && estIllustration(data, fonds) : !!options.elements
    const trous = creux(data, largeur, hauteur, candidat, fonds, { hors: passe, file: pile, tolerance, lettres: el.lettres, elements: illustration ? el : null, peints: !!options.tissu })
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
   LE CREUX OMBRÉ (30 septembre 2026, un ruban rose à carreaux : « ce logo
   là, impossible de supprimer l'intérieur »). La boucle d'un ruban, le
   dedans d'un anneau en relief : le fond vu à travers y porte une ombre
   douce, un gris (rosé) de quelques pixels, puis vient le liseré du
   dessin — plus clair, souvent, que ce qu'il borde. Jugée comme un
   reflet, la boucle restait blanche, même dans « Partout ». Un morceau
   qui n'est pas un creux net a donc une seconde chance : son ombre — les
   pixels sans couleur à lui, un peu plus sombres qu'un fond clair (`OMBRE`),
   sur un quart de sa largeur au plus (de quatre voisins en quatre
   voisins : √2 de plus en biais) ; au-delà, c'est un aplat gris voulu —
   se prend avec lui. Elle doit être une vraie ombre, d'un
   demi-`s` de large en moyenne tout autour (la boucle : 3 pixels sur
   l'aperçu ; le reflet blanc d'une bouteille d'eau, du logo 6e3 AME :
   aucune) ; et `s` pixels plus loin, le dessin doit être d'une vraie
   couleur et déjà loin du fond (`LOIN_CREUX`), deux fois sur trois. Le
   morceau part alors avec son ombre. Un reflet qui fonce en douceur n'y
   est pas si loin ; un reflet blanc sur du noir ou du gris est sans
   couleur : ni l'un ni l'autre ne passe.
   `candidat` : les pixels couleur de fond enfermés ; `hors` : ce qui n'est
   pas du dessin ; `file` : une réserve de n entiers, si on en a une ;
   `miette` : la taille sous laquelle un morceau ne se creuse pas (`s`²
   d'office). Rend 1 sur les pixels des creux (et de leur ombre).
   LES ÉLÉMENTS (30 septembre 2026, le 6e3 AME, lib/elements.js). `lettres`
   (1 sur les pixels des lettres rangées en lignes de texte) : un morceau
   qui touche une lettre est son jour — il part sans exception, quelle que
   soit sa taille (le creux d'un « e » de deux pixels) et même sans bord
   net. `elements` ({ composante, formes }, une illustration) : un morceau
   net qui n'est ni grand (`GRAND` de l'image), ni une bonne part de
   l'élément qui l'enferme (`PART` de son cadre : le creux d'un monogramme,
   le jour d'un anneau) n'est pas forcément le fond vu à travers — c'est
   peut-être le blanc peint d'un élément, le plumage d'une aigrette, le
   ventre d'une baleine, une écume : il reste. */
const OMBRE = 3 * TOLERANCE
const LOIN_CREUX = 4 * TOLERANCE
export const PEINT = 5
/* La couleur médiane des `taille` premiers pixels de `file` (400 au plus),
   à plus de `PEINT` de chaque fond. */
function peint(data, file, taille, fonds) {
  const pas = Math.max(1, Math.floor(taille / 400)), pris = [[], [], []]
  for (let k = 0; k < taille; k += pas) { const i = file[k] * 4; for (let c = 0; c < 3; c++) pris[c].push(data[i + c]) }
  const m = lab(pris.map(mediane))
  return fonds.every(f => ecartLab(m, lab(f)) > PEINT)
}
const NEUTRE = 26
export const GRAND = 0.01
export const PART = 0.08
export function creux(data, largeur, hauteur, candidat, fonds, { hors = null, file = null, tolerance = TOLERANCE, miette = null, lettres = null, elements = null, peints = false } = {}) {
  const n = largeur * hauteur
  const sortie = new Uint8Array(n)
  const s = Math.max(2, Math.round(Math.max(largeur, hauteur) / 700))
  const petit = miette === null ? s * s : miette
  const D = 4 * s
  const vu = new Uint8Array(n)
  if (!file || file.length < n) file = new Int32Array(n)
  const somme = new Float64Array(D + 1), compte = new Float64Array(D + 1)
  const pres = []
  const votes = new Map()
  const ecartFond = q => {
    let e = 256
    for (const f of fonds) { const d = ecart(data, q * 4, f); if (d < e) e = d }
    return e
  }
  /* Ce que le fond `f` perd sur chaque canal : les trois à peu près
     autant (`NEUTRE` près), un gris, une ombre ; sinon une couleur. */
  const teinte = (q, f) => {
    const i = q * 4
    const a = f[0] - data[i], b = f[1] - data[i + 1], c = f[2] - data[i + 2]
    return { haut: Math.max(a, b, c), bas: Math.min(a, b, c) }
  }
  /* Une ombre ne se voit que sur un fond clair : sur du noir, ce serait
     le trait noir du dessin. */
  const clairs = fonds.filter(f => Math.min(...f) >= 200)
  const ombreDuFond = q => clairs.some(f => {
    const t = teinte(q, f)
    return t.bas >= -8 && t.haut < OMBRE && t.haut - t.bas <= NEUTRE
  })
  const enCouleur = q => fonds.every(f => { const t = teinte(q, f); return t.haut - t.bas > NEUTRE })
  const libre = q => q >= 0 && q < n && !vu[q] && !candidat[q] && !(hors && hors[q]) && data[q * 4 + 3] >= TRANSPARENT
  /* De couche en couche autour de file[debut..fin), `max` couches au
     plus : `garder` choisit, `couche` voit chaque pixel pris avec sa
     distance. Rend la fin de la file, et si des pixels se prenaient
     encore au-delà (`deborde`). */
  const couches = (debut, fin, max, garder, marque, couche) => {
    let queue = fin
    for (let d = 1; debut < fin; d++) {
      for (let k = debut; k < fin; k++) {
        const p = file[k]
        const x = p % largeur
        for (let v = 0; v < 4; v++) {
          const q = v === 0 ? (x > 0 ? p - 1 : -1) : v === 1 ? (x < largeur - 1 ? p + 1 : -1) : v === 2 ? p - largeur : p + largeur
          if (!libre(q) || !garder(q)) continue
          if (d > max) return { fin: queue, deborde: true }
          vu[q] = marque
          file[queue++] = q
          if (couche) couche(q, d)
        }
      }
      debut = fin
      fin = queue
    }
    return { fin: queue, deborde: false }
  }
  /* La seconde chance : la fin de la file (le morceau et son ombre) si
     c'est un creux ombré, sinon 0. */
  const ombre = taille => {
    const zone = couches(0, taille, Math.max(D, Math.round(Math.sqrt(taille / 8))), ombreDuFond, 3)
    let queue = zone.fin
    let total = 0, arrives = 0
    if (!zone.deborde && zone.fin > taille) {
      queue = couches(0, zone.fin, s, () => true, 2, (q, d) => {
        if (d !== s) return
        total++
        if (ecartFond(q) >= LOIN_CREUX && enCouleur(q)) arrives++
      }).fin
    }
    for (let k = taille; k < queue; k++) vu[file[k]] = 0
    return total && zone.fin - taille >= total * s / 2 && arrives * 3 >= total * 2 ? zone.fin : 0
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
    if (taille < petit && !lettres) continue
    /* PEINT, PAS VU À TRAVERS (30 septembre 2026, le ruban crème de « THE
       FRIENDLY ISLAND » sur un t-shirt crème) : un grand morceau (`GRAND`
       de l'image) dont la couleur s'écarte du fond de plus de `PEINT` à
       l'œil est un aplat du dessin — le fond vu à travers a sa couleur
       exacte (une fois son ombre retirée : `sansOmbre`). Il reste, même
       s'il touche des lettres. Sur un tissu photographié (`peints`), tout
       morceau : agrandi par l'IA, le ruban se coupait en poches entre ses
       lettres, et le creux d'un R y est du ruban, pas du tissu. */
    if ((peints || taille >= GRAND * n) && peint(data, file, taille, fonds)) continue
    /* Le dessin autour, pixel par pixel en s'éloignant — et, tout contre
       (d = 1), les lettres qu'il touche et l'élément qui l'enferme. */
    somme.fill(0)
    compte.fill(0)
    pres.length = 0
    votes.clear()
    let debut = 0, fin = taille, bord = 0, lettre = 0
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
          if (d === 1) {
            bord++
            if (lettres && lettres[q]) lettre++
            if (elements) { const c = elements.composante[q]; if (c >= 0) votes.set(c, (votes.get(c) || 0) + 1) }
          }
        }
      }
      debut = fin
      fin = queue
    }
    let loin = 0
    for (let d = 2 * s; d <= D; d++) if (compte[d]) loin = Math.max(loin, somme[d] / compte[d])
    const arrives = pres.filter(e => e >= 0.8 * loin).length
    for (let k = taille; k < queue; k++) vu[file[k]] = 0
    /* LE JOUR D'UNE LETTRE : il part, sans exception. */
    if (lettre && lettre * 5 >= bord * 2) { for (let k = 0; k < taille; k++) sortie[file[k]] = 1; continue }
    if (taille < petit) continue
    const net = !pres.length || !loin || (loin >= 2 * tolerance && arrives * 3 >= pres.length * 2)
    if (!net) { const c = ombre(taille); for (let k = 0; k < c; k++) sortie[file[k]] = 1; continue }
    if (elements) {
      /* LE FOND VU À TRAVERS, ou le blanc peint d'un élément ? */
      let c = -1, m = 0
      for (const [id, k] of votes) if (k > m) { m = k; c = id }
      const f = c >= 0 ? elements.formes[c] : null
      const cadre = f ? (f.x1 - f.x0 + 1) * (f.y1 - f.y0 + 1) : 0
      /* Ni l'un ni l'autre : de la peinture, qui reste. (Un filet plus
         fin que l'anticrénelage pour relier le morceau au fond — le trait
         d'un cadre — a été essayé et écarté : il traversait les contours
         noirs de l'illustration, et rongeait l'écume de la mer.) */
      if (taille < GRAND * n && !(cadre && taille >= PART * cadre)) continue
    }
    for (let k = 0; k < taille; k++) sortie[file[k]] = 1
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
   UN CREUX QUI LAISSE VOIR LE FOND part aussi quand « Partout » le
   viderait (30 septembre 2026, « la piscine », « POOL • BAR •
   RESTAURANT » en rose pâle : le premier O de POOL gardait un disque
   blanc, le second non). Jugé au double et quart du seuil, le dessin
   devait s'écarter du fond de plus de deux fois autant (`creux`) — ce
   rose ne le fait qu'au cœur de son trait, et d'un O à l'autre, selon un
   pixel d'épaisseur, la mesure tombait dedans ou dehors. Son cœur, la
   couleur du fond au seuil près, se juge donc comme dans « Partout » :
   si c'est un creux, le morceau part en entier, son pâle compris. Pas
   le seuil élargi pour tout le morceau : le reflet blanc d'une poêle
   dessinée, avec son pâle autour, y passait pour un creux net.
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
     rien qui protège, et n'enferment rien sont candidats. Ceux qui
     laissent voir le fond gardent leurs pixels (`francs`), et leur cœur
     se marque (`coeurs`). */
  const libres = new Uint8Array(n)
  const coeurs = new Uint8Array(n)
  const francs = []
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
    let coeur = 0
    for (let k = 0; k < queue; k++) {
      libres[file[k]] = 1
      if (passe[file[k]] === 1) { coeurs[file[k]] = 1; coeur++ }
    }
    if (coeur) francs.push(file.slice(0, queue))
  }
  /* Entre deux lettres qui se touchent, le jour d'un pixel ou deux compte
     aussi : il ne touche que des lettres, ce n'est pas du grain. */
  const trous = creux(data, largeur, hauteur, libres, fonds, { hors: pale, file, tolerance: large, miette: 2 })
  /* Le cœur jugé comme dans « Partout » (`retirerFond`, `interieur`) : un
     creux pour la moitié de ses pixels au moins, et le morceau part. */
  if (francs.length) {
    const vus = creux(data, largeur, hauteur, coeurs, fonds, { hors: passe, file, tolerance })
    for (const morceau of francs) {
      let c = 0, v = 0
      for (const p of morceau) if (coeurs[p]) { c++; if (vus[p]) v++ }
      if (2 * v >= c) for (const p of morceau) trous[p] = 1
    }
  }
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

/* ------------------------------------------------------- LE FOND OMBRÉ
   30 septembre 2026, le t-shirt « SAINT MARTIN » photographié à plat :
   « les fonds en couleurs doivent être propres ; l'app doit faire la
   différence entre une couleur unie et une texture ». Le tissu crème est
   UNE couleur — ses plis l'assombrissent en douceur, son grain le pique —,
   pas un décor : à la couleur près, ses plis restaient (il fallait monter
   le seuil à 86) ; au modèle, des pans de tissu restaient collés au
   dessin. Le fond se lit donc comme le ferait l'œil :
   1. SA TEINTE : sur le pourtour (l'image réduite à `OMBRE_COTE` pixels,
      son grain moyenné), la teinte (a, b de CIELAB) la plus fréquente ; ses
      clartés peuvent varier, pas elle ;
   2. SON ÉTENDUE : depuis le bord, de proche en proche, ce qui garde cette
      teinte (`OMBRE_TEINTE` près) et ne change de clarté qu'en douceur
      (`OMBRE_PAS` d'un pixel réduit à l'autre) — le dessin, lui, l'arrête
      net ;
   3. SA LUMIÈRE : sur une grille, la couleur du fond de chaque case, les
      cases du dessin comblées par leurs voisines — la lumière qui passe
      sous le dessin.
   Rend null quand le fond n'a pas d'ombre à retirer (moins de `OMBRE_MIN`
   de clarté d'une case à l'autre : il est déjà uni), qu'il ne borde pas
   le tiers du pourtour ou ne couvre pas le dixième de l'image ; sinon
   { grille (RVB par case), gw, gh, ref (la couleur du fond éclairé à
   plat), part (du pourtour) }. `sansOmbre` éclaire l'image à plat : ce
   qui reste se détoure à la couleur, comme un fond uni. */
const OMBRE_COTE = 200
const OMBRE_TEINTE = 10
const OMBRE_PAS = 4
const OMBRE_MIN = 5
const OMBRE_CASES = 28
export function fondOmbre(data, largeur, hauteur) {
  const k = Math.max(1, Math.ceil(Math.max(largeur, hauteur) / OMBRE_COTE))
  const w = Math.ceil(largeur / k), h = Math.ceil(hauteur / k), n = w * h
  const rvb = new Float32Array(n * 3), nb = new Float32Array(n)
  for (let y = 0; y < hauteur; y++) {
    const o = Math.floor(y / k) * w
    for (let x = 0; x < largeur; x++) {
      const i = (y * largeur + x) * 4
      if (data[i + 3] < 250) continue
      const q = o + Math.floor(x / k)
      rvb[q * 3] += data[i]; rvb[q * 3 + 1] += data[i + 1]; rvb[q * 3 + 2] += data[i + 2]; nb[q]++
    }
  }
  const L = new Float32Array(n), A = new Float32Array(n), B = new Float32Array(n)
  for (let q = 0; q < n; q++) {
    if (!nb[q]) { L[q] = -1; continue }
    for (let c = 0; c < 3; c++) rvb[q * 3 + c] /= nb[q]
    const v = lab([rvb[q * 3], rvb[q * 3 + 1], rvb[q * 3 + 2]])
    L[q] = v[0]; A[q] = v[1]; B[q] = v[2]
  }
  /* 1. La teinte du pourtour. */
  const bord = []
  for (let x = 0; x < w; x++) bord.push(x, (h - 1) * w + x)
  for (let y = 1; y < h - 1; y++) bord.push(y * w, y * w + w - 1)
  const votes = new Map()
  for (const q of bord) if (L[q] >= 0) { const c = Math.round(A[q] / 3) + ',' + Math.round(B[q] / 3); votes.set(c, (votes.get(c) || 0) + 1) }
  if (!votes.size) return null
  const [mode] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]
  let [ma, mb] = mode.split(',').map(v => 3 * Number(v))
  const teinte = q => L[q] >= 0 && Math.hypot(A[q] - ma, B[q] - mb) <= OMBRE_TEINTE
  const graines = bord.filter(teinte)
  if (graines.length < bord.length / 3) return null
  ma = mediane(graines.map(q => A[q])); mb = mediane(graines.map(q => B[q]))
  /* 2. Son étendue, de proche en proche. */
  const fond = new Uint8Array(n)
  const pile = []
  for (const q of graines) if (teinte(q)) { fond[q] = 1; pile.push(q) }
  while (pile.length) {
    const q = pile.pop(), x = q % w
    for (const v of [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, q - w, q + w]) {
      if (v < 0 || v >= n || fond[v] || !teinte(v) || Math.abs(L[v] - L[q]) > OMBRE_PAS) continue
      fond[v] = 1
      pile.push(v)
    }
  }
  let surBord = 0, total = 0
  for (const q of bord) if (fond[q]) surBord++
  for (let q = 0; q < n; q++) if (fond[q]) total++
  if (surBord < bord.length / 3 || total < 0.1 * n) return null
  /* 3. Sa lumière, case par case. */
  const gw = Math.max(2, Math.round(OMBRE_CASES * w / Math.max(w, h))), gh = Math.max(2, Math.round(OMBRE_CASES * h / Math.max(w, h)))
  const cases = Array.from({ length: gw * gh }, () => [])
  for (let q = 0; q < n; q++) {
    if (!fond[q]) continue
    const x = q % w, y = (q - x) / w
    cases[Math.min(gh - 1, Math.floor(y * gh / h)) * gw + Math.min(gw - 1, Math.floor(x * gw / w))].push(q)
  }
  const grille = new Float32Array(gw * gh * 3)
  const connue = new Uint8Array(gw * gh)
  const clartes = []
  cases.forEach((qs, c) => {
    if (qs.length < 3) return
    for (let k3 = 0; k3 < 3; k3++) grille[c * 3 + k3] = mediane(qs.map(q => rvb[q * 3 + k3]))
    connue[c] = 1
    clartes.push(mediane(qs.map(q => L[q])))
  })
  clartes.sort((a, b) => a - b)
  if (clartes.length < 4 || clartes[Math.floor(0.9 * (clartes.length - 1))] - clartes[Math.floor(0.1 * (clartes.length - 1))] < OMBRE_MIN) return null
  /* Les cases du dessin : la moyenne de leurs voisines connues, de proche
     en proche, puis lissées. */
  for (let tour = 0; tour < gw + gh; tour++) {
    let reste = false
    const neuf = connue.slice()
    for (let c = 0; c < gw * gh; c++) {
      if (connue[c]) continue
      const x = c % gw, y = (c - x) / gw
      let s0 = 0, s1 = 0, s2 = 0, m = 0
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const X = x + dx, Y = y + dy
        if (X < 0 || Y < 0 || X >= gw || Y >= gh || !connue[Y * gw + X]) continue
        const v = Y * gw + X
        s0 += grille[v * 3]; s1 += grille[v * 3 + 1]; s2 += grille[v * 3 + 2]; m++
      }
      if (!m) { reste = true; continue }
      grille[c * 3] = s0 / m; grille[c * 3 + 1] = s1 / m; grille[c * 3 + 2] = s2 / m
      neuf[c] = 2
    }
    connue.set(neuf)
    if (!reste) break
  }
  const lisse = grille.slice()
  for (let c = 0; c < gw * gh; c++) {
    const x = c % gw, y = (c - x) / gw
    for (let k3 = 0; k3 < 3; k3++) {
      let s = 0, m = 0
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = x + dx, Y = y + dy
        if (X < 0 || Y < 0 || X >= gw || Y >= gh) continue
        s += grille[(Y * gw + X) * 3 + k3] * (dx || dy ? 1 : 2); m += dx || dy ? 1 : 2
      }
      lisse[c * 3 + k3] = s / m
    }
  }
  /* Le fond éclairé à plat : le plus clair de ses cases (là où le tissu
     est à plat sous la lumière). */
  const ordre = [...Array(gw * gh).keys()].filter(c => connue[c] === 1).sort((a, b) => (lisse[b * 3] + lisse[b * 3 + 1] + lisse[b * 3 + 2]) - (lisse[a * 3] + lisse[a * 3 + 1] + lisse[a * 3 + 2]))
  const haut = ordre.slice(0, Math.max(1, Math.ceil(ordre.length / 5)))
  const ref = [0, 1, 2].map(k3 => mediane(haut.map(c => lisse[c * 3 + k3])))
  return { grille: lisse, gw, gh, ref, part: surBord / bord.length, masque: fond, k, w, h, teinte: [ma, mb] }
}

/* LE TISSU, PIXEL PAR PIXEL : dans une case réduite que le fond ombré a
   gagnée (`masque`), un pixel de sa teinte en est — un pli trop sombre
   pour le seuil, contre le bord de la photo, part avec lui. Rend une
   fonction (p, son indice) → vrai pour l'image `source` (`largeur` de
   large, à la taille où le fond a été lu, ou une autre : `k` suit). */
export function tissu({ masque, k, w, h, teinte }, source, largeur, hauteur) {
  const fx = w / Math.ceil(largeur / k) / k, fy = h / Math.ceil(hauteur / k) / k
  return p => {
    const x = p % largeur, y = (p - x) / largeur
    if (!masque[Math.min(h - 1, Math.floor(y * fy)) * w + Math.min(w - 1, Math.floor(x * fx))]) return false
    const i = p * 4, c = lab([source[i], source[i + 1], source[i + 2]])
    return Math.hypot(c[1] - teinte[0], c[2] - teinte[1]) <= OMBRE_TEINTE + 2
  }
}

/* UN DESSIN CERNÉ : le pourtour de ce qui reste une fois le fond retiré
   (« Autour ») a, la moitié du temps au moins, un trait foncé (clarté
   sous 35) à quatre pixels dedans — l'illustration d'un imprimé, ses
   éléments cernés de noir. Une photo (des gens devant un mur, mesuré sur
   deux photos de l'atelier : 34 et 9 %) ne l'est pas ; le t-shirt
   « SAINT MARTIN », à 77 %. `plat` : l'image éclairée à plat. Mesuré le
   30 septembre 2026 sur les 70 fichiers de ~/Downloads : seul le t-shirt
   passe (un fond clair : sur le dégradé marine du logo doré « RUN&SENS »,
   le bord sombre de ses lettres passait pour un cerne). */
const CERNE = 0.5
function cerne(plat, largeur, hauteur, fonds, ombre) {
  const d = new Uint8ClampedArray(plat)
  retirerFond(d, largeur, hauteur, { fonds, interieur: false, lettres: false, lisere: 0, tissu: tissu(ombre, plat, largeur, hauteur) })
  const n = largeur * hauteur
  const fonce = new Uint8Array(n)
  /* Un trait foncé, pas un reste du fond (le coin sombre d'un dégradé). */
  const labs = fonds.map(f => lab(f))
  for (let p = 0; p < n; p++) {
    if (d[p * 4 + 3] < 128) continue
    const c = lab([plat[p * 4], plat[p * 4 + 1], plat[p * 4 + 2]])
    if (c[0] < 35 && labs.every(f => ecartLab(c, f) > 15)) fonce[p] = 1
  }
  let contour = 0, cernes = 0
  for (let p = 0; p < n; p++) {
    if (d[p * 4 + 3] < 128) continue
    const x = p % largeur, y = (p - x) / largeur
    const vide = q => d[q * 4 + 3] < 128
    if (!((x > 0 && vide(p - 1)) || (x < largeur - 1 && vide(p + 1)) || (y > 0 && vide(p - largeur)) || (y < hauteur - 1 && vide(p + largeur)))) continue
    contour++
    let trait = false
    for (let k = 0; k <= 4 && !trait; k++) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx * k, Y = y + dy * k
        if (X >= 0 && Y >= 0 && X < largeur && Y < hauteur && fonce[Y * largeur + X]) { trait = true; break }
      }
    }
    if (trait) cernes++
  }
  /* Et le fond parti en entier : ce qui reste ne touche presque pas le bord
     de la photo (un coin de dégradé resté collé au bord n'est pas un
     dessin cerné). */
  let auBord = 0, bord = 0
  for (let x = 0; x < largeur; x++) for (const y of [0, hauteur - 1]) { bord++; if (d[(y * largeur + x) * 4 + 3] >= 128) auBord++ }
  for (let y = 1; y < hauteur - 1; y++) for (const x of [0, largeur - 1]) { bord++; if (d[(y * largeur + x) * 4 + 3] >= 128) auBord++ }
  return contour > 0 && cernes >= CERNE * contour && auBord <= 0.1 * bord
}

/* L'IMAGE ÉCLAIRÉE À PLAT : chaque pixel multiplié, canal par canal, par
   ce que la lumière lui a pris (la couleur de référence sur celle du fond
   à sa place, la grille lue en bilinéaire). `rendre` : l'inverse — la
   lumière rendue (le détourage, fait sur l'image éclairée à plat, rend
   au dessin les couleurs du fichier : rien ne s'invente, un doré sur un
   dégradé marine ne s'éclaircit pas). */
export function sansOmbre(data, largeur, hauteur, ombre, rendre = false) {
  const { grille, gw, gh, ref } = ombre
  const sortie = new Uint8ClampedArray(data.length)
  const gain = new Float32Array(gw * gh * 3)
  for (let c = 0; c < gw * gh; c++) for (let k3 = 0; k3 < 3; k3++) gain[c * 3 + k3] = rendre ? Math.max(8, grille[c * 3 + k3]) / ref[k3] : ref[k3] / Math.max(8, grille[c * 3 + k3])
  for (let y = 0; y < hauteur; y++) {
    const v = Math.max(0, Math.min(gh - 1, (y + 0.5) * gh / hauteur - 0.5))
    const y0 = Math.floor(v), y1 = Math.min(gh - 1, y0 + 1), ty = v - y0
    for (let x = 0; x < largeur; x++) {
      const u = Math.max(0, Math.min(gw - 1, (x + 0.5) * gw / largeur - 0.5))
      const x0 = Math.floor(u), x1 = Math.min(gw - 1, x0 + 1), tx = u - x0
      const i = (y * largeur + x) * 4
      for (let k3 = 0; k3 < 3; k3++) {
        const g = (gain[(y0 * gw + x0) * 3 + k3] * (1 - tx) + gain[(y0 * gw + x1) * 3 + k3] * tx) * (1 - ty) + (gain[(y1 * gw + x0) * 3 + k3] * (1 - tx) + gain[(y1 * gw + x1) * 3 + k3] * tx) * ty
        sortie[i + k3] = data[i + k3] * g
      }
      sortie[i + 3] = data[i + 3]
    }
  }
  return sortie
}

/* TOUT LE DÉTOURAGE, d'une image source vers une image neuve. Les réglages
   en pixels (liseré, resserrer) sont ceux de l'image pleine : `echelle` les
   ramène à la taille de l'aperçu. `poussieres` va de 0 à 100 — à 100, un
   îlot de moins de 1 % de l'image part. */
export function detourer(source, largeur, hauteur, reglages = {}, echelle = 1) {
  const r = Object.assign({}, REGLAGES, reglages)
  /* Un fond ombré (un tissu, un papier photographiés : `fondOmbre`, que le
     graphiste a reconnu — `ombre`) est d'abord éclairé à plat — le dessin
     avec lui —, ses plis contre le bord partent avec lui (`tissu`). */
  const ombre = r.ombre && !r.fonds ? fondOmbre(source, largeur, hauteur) : null
  const base = ombre ? sansOmbre(source, largeur, hauteur, ombre) : source
  const data = new Uint8ClampedArray(base)
  const px = v => Math.round(v * echelle)
  const bilan = retirerFond(data, largeur, hauteur, {
    tissu: ombre ? tissu(ombre, source, largeur, hauteur) : null,
    fonds: r.fonds,
    tolerance: r.tolerance,
    interieur: r.interieur,
    lettres: r.lettres !== false,
    lisere: r.lisere > 0 ? Math.max(1, px(r.lisere)) : 0,
    resserrer: px(r.resserrer),
    poussieres: seuilPoussieres(r.poussieres, largeur * hauteur),
    ombres: r.ombres,
    elements: r.elements,
  })
  for (const trait of r.traits || []) peindre(data, base, largeur, hauteur, trait)
  return { data: ombre ? sansOmbre(data, largeur, hauteur, ombre, true) : data, fonds: bilan.fonds, retires: bilan.retires, ombre: !!ombre }
}

export const seuilPoussieres = (niveau, aire) => Math.round(aire * 0.01 * Math.pow(Math.max(0, Math.min(100, niveau || 0)) / 100, 2))

/* LES VOILES (30 septembre 2026, « Sea View Villas », un PNG de Canva) :
   l'ombre des lettres y est un calque à 40 % d'opacité. Détouré la garde
   telle quelle ; le tracé, lui, ne retenait que l'opaque — l'ombre partait,
   des filets restaient. Le vecteur et l'image la prennent comme elle se
   voyait sur la page blanche où elle a été dessinée (`aplatirVoiles`).
   Un voile, c'est une opacité à la fois partielle et ÉGALE sur une vraie
   surface — un carré de cinq pixels où elle ne bouge pas de plus de
   `VOILE_PLAT` —, pas la rampe d'un bord anticrénelé ni celle d'un masque
   doux : il se lit sur le fichier reçu, jamais sur un détourage (le masque
   d'une IA, sur une photo, en a de larges). Au-delà de 88 % (`VOILE_MAX`),
   ce n'est plus un voile : l'illustration entière que ChatGPT sort à 94 %
   (« Strong Together ») s'aplatissait par plaques — seule parmi les
   quatorze PNG transparents de ~/Downloads, avec l'ombre de Sea View
   Villas. Autour, le voile gagne ses voisins d'opacité proche, et sa
   propre rampe sur `VOILE_BORD` pixels.
   Rend, pour chaque pixel, l'opacité du voile qui le couvre (0 : aucun),
   ou null quand le fichier n'en a pas. */
const VOILE_MIN = 16
const VOILE_MAX = 224
const VOILE_PLAT = 8
const VOILE_BORD = 4
export function voiles(source, largeur, hauteur) {
  const n = largeur * hauteur
  const partiel = p => { const a = source[p * 4 + 3]; return a >= VOILE_MIN && a <= VOILE_MAX }
  let partiels = 0
  for (let p = 0; p < n; p++) if (partiel(p)) partiels++
  if (partiels < 64) return null
  const opacite = new Uint8Array(n)
  const bord = new Uint8Array(n)
  const file = []
  for (let y = 2; y < hauteur - 2; y++) {
    for (let x = 2; x < largeur - 2; x++) {
      const p = y * largeur + x
      if (!partiel(p)) continue
      const a = source[p * 4 + 3]
      let plat = true
      for (let dy = -2; dy <= 2 && plat; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(source[(p + dy * largeur + dx) * 4 + 3] - a) > VOILE_PLAT) { plat = false; break }
      }
      if (plat) { opacite[p] = a; file.push(p) }
    }
  }
  if (file.length < 64) return null
  for (let t = 0; t < file.length; t++) {
    const p = file[t]
    const v = opacite[p]
    voisins([p], largeur, hauteur, q => {
      const a = source[q * 4 + 3]
      if (opacite[q] || !a || a >= 250) return
      /* D'opacité proche : le voile continue ; sinon sa rampe, bornée. */
      const loin = Math.abs(a - v) > 2 * VOILE_PLAT
      if (loin && bord[p] >= VOILE_BORD) return
      opacite[q] = v
      bord[q] = loin ? bord[p] + 1 : 0
      file.push(q)
    })
  }
  return opacite
}

/* LE VOILE APLATI SUR LE BLANC : sa couleur mêlée au blanc de la page selon
   son opacité, pleine ; sa rampe (le bord qui s'efface dans le vide) garde
   sa douceur, à la couleur du voile. Le reste ne bouge pas ; `rgba` non
   plus (une copie sort). */
export function aplatirVoiles(rgba, opacite) {
  const sortie = new Uint8ClampedArray(rgba)
  for (let p = 0; p < opacite.length; p++) {
    const v = opacite[p]
    if (!v) continue
    const i = p * 4, a = rgba[i + 3]
    if (!a) continue
    const t = Math.max(a, v) / 255
    for (let c = 0; c < 3; c++) sortie[i + c] = Math.round(rgba[i + c] * t + 255 * (1 - t))
    sortie[i + 3] = a >= v ? 255 : Math.round(a * 255 / v)
  }
  return sortie
}

/* ------------------------------------------- FOND UNI OU VRAI DÉCOR ? */

/* LE FOND SUR LE POURTOUR : la part qu'il en couvre (ses couleurs,
   fondsDuBord, au seuil près) et son écart moyen à ces couleurs — 0 pour
   l'aplat d'un logo, même passé en JPEG ; 3 et plus pour un mur, un ciel,
   un fond de jungle, qu'une photo a toujours grainés ou dégradés. Un
   pourtour déjà transparent est couvert : il n'y a rien à retirer. Une
   image collée sur une toile transparente se juge sur son bord à elle
   (`cadreDuFond`). */
export function bordDuFond(data, largeur, hauteur, tolerance = TOLERANCE) {
  const cadre = cadreDuFond(data, largeur, hauteur)
  const fonds = couleursDuPourtour(data, largeur, cadre)
  let total = 0
  let couverts = 0
  let somme = 0
  pourtour(cadre, largeur, i => {
    total++
    if (data[i + 3] < TRANSPARENT) { couverts++; return }
    let e = 256
    for (const f of fonds) e = Math.min(e, ecart(data, i, f))
    if (e < tolerance) { couverts++; somme += e }
  })
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
  let { fonds, part, ecart: bord } = bordDuFond(data, largeur, hauteur)
  const aplats = partEnAplats(data, largeur, hauteur, fonds)
  /* Un fond qui borde TOUT le pourtour passe aussi avec le grain d'un
     petit JPEG (29 septembre 2026, « AutoMax » en 263 px sur du noir :
     trois niveaux de grain, pas un aplat de deux niveaux — il partait au
     modèle, qui rongeait ses lettres, et l'IA ne le nettoyait pas). */
  let uni = (part >= 0.9 && bord <= 2) || (part >= 0.97 && bord <= 5) || (part >= 0.5 && bord <= 4 && aplats >= 0.1)
  /* UN FOND OMBRÉ (30 septembre 2026, le t-shirt « SAINT MARTIN »
     photographié : `fondOmbre`) : éclairé à plat, il borde la moitié du
     pourtour, et le dessin n'a pas la matière d'une photo — un imprimé, un
     dessin sur du papier, pas un décor : à la couleur. */
  let ombre = false
  if (!uni) {
    const o = fondOmbre(data, largeur, hauteur)
    /* Un fond clair seulement (un tissu, un papier) : sur un fond foncé, le
       bord anticrénelé de n'importe quel dessin passe pour un cerne. */
    if (o && o.part >= 0.5 && lab(o.ref)[0] >= 60) {
      const plat = sansOmbre(data, largeur, hauteur, o)
      const b = bordDuFond(plat, largeur, hauteur)
      if (b.part >= 0.5 && !aDeLaMatiere(plat, largeur, hauteur, b.fonds) && cerne(plat, largeur, hauteur, b.fonds, o)) {
        uni = ombre = true
        fonds = b.fonds; part = b.part; bord = b.ecart
        data = plat
      }
    }
  }
  const logo = uni && partEnAplats(data, largeur, hauteur, fonds, 6, 2) >= 0.5 && !estIllustration(data, fonds)
  return { methode: uni ? 'uni' : 'ia', logo, part, bord, aplats, fonds, ombre }
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

/* LA MATIÈRE (29 septembre 2026, « BEA-16 BEIGE BRODERIE », un logo qui
   représente de la broderie : « ça doit s'appliquer pour tout, si c'est du
   cuir ou autre — de l'eau, du feu, des paillettes, un ballon »). L'IA des
   logos (lib/nettoyage.js) a appris sur le dessin animé : elle fait de ses
   fils des coups de pinceau en plastique. Ce qui a de la matière passe à
   l'IA des photos. Elle se lit au DEDANS des formes, à `BORD` pixels au
   moins du fond — là où ni l'anticrénelage ni le halo d'un JPEG
   n'arrivent. Un pixel y est À PLAT quand ses voisins de part et d'autre
   ne s'écartent pas de plus de `GRAIN` niveaux (un fil, le grain d'un cuir,
   une paillette, si) et qu'à `LOIN` pixels de lui, rien ne s'écarte de
   plus de `PLAT` (un dégradé, l'eau, un ballon, si). Mesuré sur dix-huit
   fichiers de l'atelier : le dedans de la broderie, de l'eau de Larimar,
   n'est pas à plat à 2 % ; celui d'un logo à plat l'est pour moitié au
   moins, même en JPEG. De la matière : un dedans qui fait `DEDANS` du
   dessin au moins, à plat à moins de `A_PLAT`. Dans le doute — des filets
   trop fins pour avoir un dedans, le petit JPEG d'AutoMax —, c'est à plat :
   les logos pourris gardent l'IA qui les nettoie. `fonds` : les couleurs du
   fond, qui ne comptent pas. */
const BORD = 4
const GRAIN = 20
const PLAT = 8
const LOIN = 6
const DEDANS = 0.3
const A_PLAT = 0.05
export function aDeLaMatiere(data, largeur, hauteur, fonds = []) {
  const n = largeur * hauteur
  const dessin = new Uint8Array(n)
  let nd = 0
  for (let p = 0; p < n; p++) {
    const i = p * 4
    if (data[i + 3] >= 250 && !fonds.some(f => ecart(data, i, f) < TOLERANCE)) { dessin[p] = 1; nd++ }
  }
  /* Le dessin rogné de `BORD` pixels : plein sur toute la fenêtre, en
     largeur puis en hauteur (`suite` : les pixels pleins d'affilée). */
  const w = 2 * BORD + 1
  const rogne = new Uint8Array(n)
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0, suite = 0; x < largeur; x++) {
      suite = dessin[y * largeur + x] ? suite + 1 : 0
      if (suite >= w) rogne[y * largeur + x - BORD] = 1
    }
  }
  const e = (i, j) => Math.max(Math.abs(data[i] - data[j]), Math.abs(data[i + 1] - data[j + 1]), Math.abs(data[i + 2] - data[j + 2]))
  let dedans = 0, plat = 0
  for (let x = LOIN; x < largeur - LOIN; x++) {
    for (let y = 0, suite = 0; y < hauteur; y++) {
      suite = rogne[y * largeur + x] ? suite + 1 : 0
      const yc = y - BORD
      if (suite < w || yc < LOIN || yc >= hauteur - LOIN) continue
      dedans++
      const p = yc * largeur + x, i = p * 4, L = largeur * 4
      if (Math.max(e(i - 4, i + 4), e(i - L, i + L)) > GRAIN) continue
      if (Math.max(e(i - LOIN * 4, i), e(i + LOIN * 4, i), e(i - LOIN * L, i), e(i + LOIN * L, i)) <= PLAT) plat++
    }
  }
  return dedans > 0 && dedans >= DEDANS * nd && plat < A_PLAT * dedans
}

/* ------------------------------------------- LA PHOTO EST-ELLE EN HD ?
   25 septembre 2026 : « c'est le seul produit non vectoriel qu'on accepte,
   mais la photo doit être en HD » : son grand côté fait au moins 1 800 px
   — un dos de 30 cm à 150 dpi, le moins qu'une photo supporte sur un
   textile ; c'est aussi le « Full HD » d'un écran. En dessous, une
   matière s'agrandit d'office (lib/graphiste.js, `PETITE_MATIERE`). */
export const HD_PX = 1800

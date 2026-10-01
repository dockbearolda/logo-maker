/* ============================================================= L'HISTORIQUE
   30 septembre 2026 (« une barre fine au-dessus du studio, et un historique
   des gestes »). Une pile de PHOTOS DES RÉGLAGES, jamais des pixels : la
   version, le fond retiré, le seuil, le lissage, les nuances, les teintes
   (changées, retirées, une couleur), les polices et le gras de chaque
   ligne, le blanc DTF, l'Amélioration IA, « Rendre
   net ». Revenir à une photo, c'est la reposer et relancer le calcul comme
   si on avait touché le réglage (lib/studio-detourage.js, `remettre`).

   LES POINTS DE LA PILE SONT DES ÉTATS : le 0, l'ouverture du fichier (la
   décision du graphiste) ; le k, l'état juste après le k-ième geste ;
   `ici`, celui à l'écran. Le point qu'on quitte est d'abord repris sur
   l'état vivant (`aller`) : ce que le graphiste a décidé après coup (la
   version d'un logo nettoyé, les polices lues) y entre. 50 points au plus :
   le plus vieux geste part, l'ouverture reste.

   UNE PHOTO (`photo`, lib/studio-detourage.js) : { version, vueChoisie,
   methode, fondChoisi, creuxChoisi, reglages: { tolerance, interieur,
   seuil }, lissage, nuances, teinte, uneCouleur, teintes: { pleine,
   recolor, sans }, polices: { cle, lignes, report }, blanc, ia:
   'non' | 'oui' | 'ultra', net }. Ce module ne touche pas à la page : il se
   teste seul (historique.test.mjs). */

export const MAX = 50
export const OUVERT = 'Ouvert · décision du graphiste'

export function creer(photo, quand = Date.now()) {
  return { points: [{ libelle: OUVERT, quand, photo }], ici: 0 }
}

/* Un geste : les gestes annulés (ceux de Rétablir) partent, le nouveau
   devient le point à l'écran. */
export function noter(h, libelle, photo, quand = Date.now()) {
  h.points.splice(h.ici + 1)
  h.points.push({ libelle, quand, photo })
  if (h.points.length > MAX) h.points.splice(1, h.points.length - MAX)
  h.ici = h.points.length - 1
}

/* Aller au point `k` : celui qu'on quitte prend l'état vivant, rend la
   photo à reposer (null : rien à faire). */
export function aller(h, k, vivant) {
  if (!h || !(k >= 0 && k < h.points.length) || k === h.ici) return null
  h.points[h.ici].photo = vivant
  h.ici = k
  return h.points[k].photo
}
export const reculer = (h, vivant) => aller(h, h.ici - 1, vivant)
export const avancer = (h, vivant) => aller(h, h.ici + 1, vivant)

/* Le point à l'écran reprend l'état vivant, juste avant un geste. */
export function rafraichir(h, vivant) {
  if (h) h.points[h.ici].photo = vivant
}

/* DEUX PHOTOS PAREILLES : rien n'a bougé, pas de geste. Les polices
   proposées et les choix à reporter ne comptent pas — ils suivent le
   reste ; l'ordre des clés non plus. */
export const signature = p => JSON.stringify(p, (k, v) => k === 'props' || k === 'report' ? undefined
  : v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([x], [y]) => x < y ? -1 : x > y ? 1 : 0)) : v)
export const pareil = (a, b) => signature(a) === signature(b)

/* « à l'instant », « il y a 2 min », « il y a 1 h ». */
export function quandDit(quand, maintenant = Date.now()) {
  const s = Math.max(0, (maintenant - quand) / 1000)
  if (s < 60) return 'à l\'instant'
  const m = Math.floor(s / 60)
  return m < 60 ? 'il y a ' + m + ' min' : 'il y a ' + Math.floor(m / 60) + ' h'
}

/* LE NOM D'UNE TEINTE, pour un libellé : celui du nuancier OLDA quand
   c'est elle, sinon sa famille (« Rouge », « Bleu foncé », « Gris
   clair »). */
export function nomTeinte(rvb, nuancier = []) {
  const c = nuancier.find(n => n.rvb.every((v, k) => v === Math.round(rvb[k])))
  if (c) return c.nom
  const [r, g, b] = rvb.map(v => v / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2
  const ton = nom => nom + (l < 0.3 ? ' foncé' : l > 0.72 ? ' clair' : '')
  if (max < 0.16) return 'Noir'
  if (d < 0.08 || d / (1 - Math.abs(2 * l - 1)) < 0.15) return l > 0.9 ? 'Blanc' : ton('Gris')
  const h = ((max === r ? (g - b) / d : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 + 360) % 360
  if (h < 15 || h >= 345) return l > 0.75 ? 'Rose' : ton('Rouge')
  if (h < 40) return l < 0.35 ? 'Marron' : ton('Orange')
  if (h < 65) return ton('Jaune')
  if (h < 160) return ton('Vert')
  if (h < 195) return ton('Turquoise')
  if (h < 255) return ton('Bleu')
  if (h < 290) return ton('Violet')
  return ton('Rose')
}

/* ----------------------------------------------------------- LE LIBELLÉ
   Ce qu'un geste a changé, lu entre la photo d'avant et celle d'après :
   « Rouge retiré », « Seuil 24 → 32 », « Fond : Partout », « Police :
   Montserrat ». Le premier changement trouvé, du plus lourd au plus
   léger (une version qui change pose aussi ses creux : on dit la
   version). */
const VERSIONS = { detoure: 'Détouré', vecteur: 'Vecteur', image: 'Image' }
const fond = p => p.methode === 'ia' ? 'Sujet' : p.reglages.interieur ? 'Partout' : 'Autour'
const seuilDe = p => p.methode === 'ia' ? p.reglages.seuil : p.reglages.tolerance
const nuance = v => v === 50 ? 'Auto' : String(v)

export function decrire(a, b, nom = nomTeinte) {
  if (a.ia !== b.ia) return b.ia === 'non' ? 'Amélioration IA coupée' : b.ia === 'ultra' ? 'IA Ultra' : 'Amélioration IA'
  if (a.net !== b.net && b.ia !== 'non') return b.net ? 'Rendre net' : 'Rendre net coupé'
  if (a.version !== b.version) return 'Version : ' + VERSIONS[b.version]
  if (fond(a) !== fond(b)) return 'Fond : ' + fond(b)
  if (seuilDe(a) !== seuilDe(b)) return 'Seuil ' + seuilDe(a) + ' → ' + seuilDe(b)
  if (a.lissage !== b.lissage) return 'Lissage ' + a.lissage + ' → ' + b.lissage
  if (a.nuances !== b.nuances) return 'Nuances ' + nuance(a.nuances) + ' → ' + nuance(b.nuances)
  if (a.teinte.type !== b.teinte.type || a.teinte.nom !== b.teinte.nom) return b.teinte.type === 'multi' ? 'Couleurs d\'origine' : 'Une couleur : ' + b.teinte.nom
  const t = a.teintes.pleine === b.teintes.pleine ? teintes(a.teintes, b.teintes, nom) : ''
  if (t) return t
  const p = polices(a.polices, b.polices)
  if (p) return p
  if (a.blanc !== b.blanc) return b.blanc ? 'Blanc DTF' : 'Blanc DTF coupé'
  return 'Réglage'
}

/* Les teintes : retirée, remise, changée — une couleur de la palette est
   « r,g,b », sa nouvelle teinte [r, g, b]. */
function teintes(a, b, nom) {
  const cle = c => c.join(',')
  const sansA = new Set(a.sans.map(cle)), sansB = new Set(b.sans.map(cle))
  const retirees = b.sans.filter(c => !sansA.has(cle(c)))
  const remises = a.sans.filter(c => !sansB.has(cle(c)))
  if (retirees.length + remises.length > 1) return (retirees.length + remises.length) + ' teintes ' + (remises.length ? 'remises ou retirées' : 'retirées')
  if (retirees.length) return nom(retirees[0]) + ' retiré'
  if (remises.length) return nom(remises[0]) + ' remis'
  const changees = [...new Set(Object.keys(a.recolor).concat(Object.keys(b.recolor)))].filter(k => String(a.recolor[k]) !== String(b.recolor[k]))
  if (changees.length > 1) return changees.length + ' teintes changées'
  if (!changees.length) return ''
  const k = changees[0], origine = k.split(',').map(Number)
  const de = nom(a.recolor[k] || origine), vers = nom(b.recolor[k] || origine)
  return de === vers ? de + ' ajusté' : de + ' → ' + vers
}

/* Les polices, ligne par ligne, sur la même lecture du texte. */
function polices(a, b) {
  if (!a.lignes || !b.lignes || a.cle !== b.cle || a.lignes.length !== b.lignes.length) return ''
  for (let i = 0; i < b.lignes.length; i++) {
    const x = a.lignes[i], y = b.lignes[i]
    if (x.texte !== y.texte) return 'Texte : ' + y.texte
    if (x.choix !== y.choix || x.police !== y.police) return 'Police : ' + (y.police || 'dessin d\'origine')
    if (x.gras !== y.gras) return 'Gras ' + x.gras + ' → ' + y.gras
  }
  return ''
}

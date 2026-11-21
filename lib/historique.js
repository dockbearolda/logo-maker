/* ============================================================= L'HISTORIQUE
   30 septembre 2026 (« une barre fine au-dessus du studio, et un historique
   des gestes »). Une pile de PHOTOS DES RÉGLAGES, jamais des pixels : la
   version, le fond retiré, le seuil, le lissage, les nuances, les teintes
   (changées, retirées, une couleur), les polices, le gras et la couleur
   de chaque ligne, les éléments retirés, comblés ou recolorés (les
   calques, 12 octobre 2026), « Améliorer l'image »,
   « Améliorer la netteté ».
   Revenir à une photo, c'est la reposer et relancer le calcul comme si on
   avait touché le réglage (lib/studio-detourage.js, `remettre`).

   LES POINTS DE LA PILE SONT DES ÉTATS : le 0, l'ouverture du fichier (la
   décision du graphiste) ; le k, l'état juste après le k-ième geste ;
   `ici`, celui à l'écran. Le point qu'on quitte est d'abord repris sur
   l'état vivant (`aller`) : ce que le graphiste a décidé après coup (la
   version d'un logo nettoyé, les polices lues) y entre. 50 points au plus :
   le plus vieux geste part, l'ouverture reste.

   UNE PHOTO (`photo`, lib/studio-detourage.js) : { version, vueChoisie,
   methode, fondChoisi, creuxChoisi, reglages: { tolerance, interieur,
   seuil }, lissage, nuances, teinte, uneCouleur, teintes: { pleine,
   recolor, sans }, polices: { cle, lignes, report }, ia:
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
const fond = p => p.methode === 'ia' ? 'Sujet' : p.methode === 'entier' ? 'Entier' : p.reglages.interieur ? 'Partout' : 'Autour'
const seuilDe = p => p.methode === 'ia' ? p.reglages.seuil : p.reglages.tolerance
const nuance = v => v === 50 ? 'Auto' : String(v)

export function decrire(a, b, nom = nomTeinte) {
  if (a.ia !== b.ia) return b.ia === 'non' ? 'Sans amélioration de l\'image' : b.ia === 'ultra' ? 'IA Ultra' : 'Améliorer l\'image'
  if (a.net !== b.net && b.ia !== 'non') return b.net ? 'Améliorer la netteté' : 'Sans amélioration de la netteté'
  if (a.version !== b.version) return 'Version : ' + VERSIONS[b.version]
  if (fond(a) !== fond(b)) return 'Fond : ' + fond(b)
  if (seuilDe(a) !== seuilDe(b)) return 'Seuil ' + seuilDe(a) + ' → ' + seuilDe(b)
  if (a.lissage !== b.lissage) return 'Lissage ' + a.lissage + ' → ' + b.lissage
  if (a.nuances !== b.nuances) return 'Nuances ' + nuance(a.nuances) + ' → ' + nuance(b.nuances)
  /* Un élément retiré du logo (lib/effacer.js), ou remis ; comblé (les
     calques : le fond rebouché dessous). */
  const ea = (a.reglages && a.reglages.effaces) || [], eb = (b.reglages && b.reglages.effaces) || []
  if (ea.length !== eb.length) {
    const nouveau = eb.length > ea.length ? eb.find(e => !ea.includes(e)) || eb[eb.length - 1] : ea.find(e => !eb.includes(e)) || ea[ea.length - 1]
    if (eb.length > ea.length) return nouveau.coupe ? 'Lasso retiré' : nouveau.ligne ? 'Ligne retirée' : 'Élément retiré'
    return nouveau.coupe ? 'Lasso remis' : nouveau.ligne ? 'Ligne remise' : 'Élément remis'
  }
  /* Le fond rebouché sous un lasso (les calques, `comblements`). */
  const ka = a.comblements || [], kb = b.comblements || []
  if (ka.length !== kb.length) return kb.length > ka.length ? 'Comblé' : 'Comblé, annulé'
  /* Un élément recoloré (les calques, lib/effacer.js `recolorer`). */
  const ta = (a.reglages && a.reglages.teintesElements) || [], tb = (b.reglages && b.reglages.teintesElements) || []
  if (ta.length !== tb.length || ta.some((t, i) => String(t.rvb) !== String(tb[i].rvb) || t.u !== tb[i].u || t.v !== tb[i].v)) {
    const nouveau = tb.find(t => !ta.some(x => x.u === t.u && x.v === t.v && String(x.rvb) === String(t.rvb)))
    return nouveau ? 'Élément : ' + nom(nouveau.rvb) : 'Élément : couleur d\'origine'
  }
  /* Un élément déplacé, redimensionné, tourné, retourné, replacé (les
     calques déplacés, lib/transformer.js `transformations`). */
  const x = transformations((a.reglages && a.reglages.transformations) || [], (b.reglages && b.reglages.transformations) || [])
  if (x) return x
  /* Le contour (lib/contour.js) : son épaisseur, sa couleur. */
  const ca = a.contour || { mm: 0 }, cb = b.contour || { mm: 0 }
  if (ca.mm !== cb.mm || (cb.mm > 0 && ca.nom !== cb.nom)) return cb.mm > 0 ? 'Contour ' + String(cb.mm).replace('.', ',') + ' mm · ' + cb.nom : 'Sans contour'
  if (a.teinte.type !== b.teinte.type || a.teinte.nom !== b.teinte.nom) return b.teinte.type === 'multi' ? 'Couleurs d\'origine' : 'Une couleur : ' + b.teinte.nom
  const t = a.teintes.pleine === b.teintes.pleine ? teintes(a.teintes, b.teintes, nom) : ''
  if (t) return t
  const p = polices(a.polices, b.polices, nom)
  if (p) return p
  return 'Réglage'
}

/* LES TRANSFORMATIONS : la même adresse (un point { u, v }, ou une ligne
   { ligne: { cx, cy } }) d'une photo à l'autre ; ce qui a bougé en
   premier, dans l'ordre : le sens, l'angle, la taille, la place. Une
   entrée partie : « replacé » ; plusieurs : leur nombre. */
const memeAdresse = (x, y) => x.ligne && y.ligne ? Math.abs(x.ligne.cx - y.ligne.cx) < 1e-9 && Math.abs(x.ligne.cy - y.ligne.cy) < 1e-9 : !x.ligne && !y.ligne && x.u === y.u && x.v === y.v
const pres = (p, q) => Math.abs(p - q) < 1e-9
const RIEN = { d: [0, 0], angle: 0, s: [1, 1] }
function motTransformation(avant, apres) {
  if (!apres) return 'replacé'
  const a = avant || RIEN, b = apres
  if ((a.s[0] * a.s[1] < 0) !== (b.s[0] * b.s[1] < 0)) return 'retourné'
  if (!pres(a.angle || 0, b.angle || 0)) return 'tourné'
  if (!pres(Math.abs(a.s[0]), Math.abs(b.s[0])) || !pres(Math.abs(a.s[1]), Math.abs(b.s[1]))) return Math.abs(b.s[0] * b.s[1]) > Math.abs(a.s[0] * a.s[1]) ? 'agrandi' : 'réduit'
  return 'déplacé'
}
const feminin = mot => mot.replace(/é$/, 'ée').replace(/i$/, 'ie').replace(/t$/, 'te')
function transformations(ta, tb) {
  const changees = []
  for (const y of tb) {
    const x = ta.find(e => memeAdresse(e, y))
    if (!x || JSON.stringify([x.d, x.angle, x.s]) !== JSON.stringify([y.d, y.angle, y.s])) changees.push([x, y])
  }
  for (const x of ta) if (!tb.some(e => memeAdresse(e, x))) changees.push([x, null])
  if (!changees.length) return ''
  if (changees.length > 1) {
    const mots = new Set(changees.map(([x, y]) => motTransformation(x, y)))
    return changees.length + ' éléments ' + (mots.size === 1 ? [...mots][0] + 's' : 'déplacés')
  }
  const [x, y] = changees[0], ligne = !!((y || x).ligne), mot = motTransformation(x, y)
  return ligne ? 'Ligne ' + feminin(mot) : 'Élément ' + mot
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
function polices(a, b, nom) {
  if (!a.lignes || !b.lignes || a.cle !== b.cle || a.lignes.length !== b.lignes.length) return ''
  for (let i = 0; i < b.lignes.length; i++) {
    const x = a.lignes[i], y = b.lignes[i]
    if (x.texte !== y.texte) return 'Texte : ' + y.texte
    if (x.choix !== y.choix || x.police !== y.police) return 'Police : ' + (y.police || 'dessin d\'origine')
    if (x.gras !== y.gras) return 'Gras ' + x.gras + ' → ' + y.gras
    if (String(x.couleur || '') !== String(y.couleur || '')) return 'Couleur du texte : ' + (y.couleur ? nom(y.couleur) : 'd\'origine')
  }
  return ''
}

/* ========================================================= LA TAILLE DTF
   1er octobre 2026, Charlie : « pouvoir choisir la taille du DTF » —
   « toutes les tailles doivent être en mm ». Le logo sort à la taille où
   il s'imprime — en largeur, ou en hauteur pour un logo tout en
   hauteur —, l'autre côté suit ses proportions. Sans choix, il sort à
   300 dpi de ses pixels (« Taille du fichier »). Tout se dit et se tape
   en millimètres.

   LES PRÉRÉGLAGES sont les largeurs du tableau d'OLDA (« tailles-logos-
   dtf.csv », 23 septembre 2026, repris par le comptoir dans
   lib/tailles-dtf.js) : le cœur et la poitrine de 55 à 80 mm, le dos de
   200 à 340 mm, le bébé de 110 à 140 mm, le tote bag en 205 (l'Optimisée)
   ou 250 mm (la Classique). Pur : ni page, ni fil. */

export const TAILLES_DTF = [
  { emplacement: 'Cœur, poitrine', mm: [55, 60, 65, 70, 75, 80] },
  { emplacement: 'Dos', mm: [200, 220, 240, 260, 280, 300, 320, 340] },
  { emplacement: 'Bébé', mm: [110, 120, 130, 140] },
  { emplacement: 'Tote bag', mm: [205, 250] },
]

/* Les bornes d'une taille tapée : 5 mm, deux mètres (un film DTF se
   déroule ; aucun logo n'y va au-delà). */
export const MM_MIN = 5
export const MM_MAX = 2000

/* LA TAILLE IMPRIMÉE, en mm, d'un dessin de `l` × `h` pixels : `choix`
   ({ cote: 'largeur' | 'hauteur', mm }) ou rien — 300 dpi de ses pixels
   (`auto`). null sans dessin. */
export function tailleImprimee(l, h, choix, dpi = 300) {
  if (!(l > 0) || !(h > 0)) return null
  if (!choix || !(choix.mm > 0)) return { l: l / dpi * 25.4, h: h / dpi * 25.4, auto: true }
  return choix.cote === 'hauteur'
    ? { l: choix.mm * l / h, h: choix.mm, auto: false }
    : { l: choix.mm, h: choix.mm * h / l, auto: false }
}

/* LA RÉSOLUTION de `px` pixels imprimés sur `mm` millimètres. */
export const dpiA = (px, mm) => mm > 0 ? px / (mm / 25.4) : 0

/* « 322 », « 78,5 » : au dixième de millimètre, à la française, sans zéro
   inutile. */
export const mmDit = v => (Math.round(v * 10) / 10).toLocaleString('fr-FR', { maximumFractionDigits: 1 })

/* UNE TAILLE TAPÉE : « 280 », « 78,5 », « 78.5 mm » — null si ce n'en
   est pas une ; ramenée dans les bornes, au dixième de millimètre. */
export function lireMm(texte) {
  const t = String(texte ?? '').trim().replace(/\s*mm$/i, '').replace(',', '.')
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(t)) return null
  const v = Number(t)
  if (!(v > 0)) return null
  return Math.round(Math.min(MM_MAX, Math.max(MM_MIN, v)) * 10) / 10
}

/* LE PRÉRÉGLAGE d'une taille choisie (« Dos »), s'il y en a un : une
   largeur du tableau. */
export function prereglage(choix) {
  if (!choix || choix.cote !== 'largeur') return null
  for (const t of TAILLES_DTF) if (t.mm.includes(choix.mm)) return t.emplacement
  return null
}

/* ========================================================= LA TAILLE DTF
   1er octobre 2026, Charlie : « pouvoir choisir la taille du DTF ». Le
   logo sort à la taille où il s'imprime — en largeur, ou en hauteur pour
   un logo tout en hauteur —, l'autre côté suit ses proportions. Sans
   choix, il sort à 300 dpi de ses pixels (« Taille du fichier »).

   LES PRÉRÉGLAGES sont les largeurs du tableau d'OLDA (« tailles-logos-
   dtf.csv », 23 septembre 2026, repris par le comptoir dans
   lib/tailles-dtf.js) : le cœur et la poitrine de 5,5 à 8 cm, le dos de
   20 à 34 cm, le bébé de 11 à 14 cm, le tote bag en 20,5 (l'Optimisée)
   ou 25 cm (la Classique). Pur : ni page, ni fil. */

export const TAILLES_DTF = [
  { emplacement: 'Cœur, poitrine', cm: [5.5, 6, 6.5, 7, 7.5, 8] },
  { emplacement: 'Dos', cm: [20, 22, 24, 26, 28, 30, 32, 34] },
  { emplacement: 'Bébé', cm: [11, 12, 13, 14] },
  { emplacement: 'Tote bag', cm: [20.5, 25] },
]

/* Les bornes d'une taille tapée : un demi-centimètre, deux mètres (un
   film DTF se déroule ; aucun logo n'y va au-delà). */
export const CM_MIN = 0.5
export const CM_MAX = 200

/* LA TAILLE IMPRIMÉE, en cm, d'un dessin de `l` × `h` pixels : `choix`
   ({ cote: 'largeur' | 'hauteur', cm }) ou rien — 300 dpi de ses pixels
   (`auto`). null sans dessin. */
export function tailleImprimee(l, h, choix, dpi = 300) {
  if (!(l > 0) || !(h > 0)) return null
  if (!choix || !(choix.cm > 0)) return { l: l / dpi * 2.54, h: h / dpi * 2.54, auto: true }
  return choix.cote === 'hauteur'
    ? { l: choix.cm * l / h, h: choix.cm, auto: false }
    : { l: choix.cm, h: choix.cm * h / l, auto: false }
}

/* LA RÉSOLUTION de `px` pixels imprimés sur `cm` centimètres. */
export const dpiA = (px, cm) => cm > 0 ? px / (cm / 2.54) : 0

/* « 19,3 » : au millimètre, à la française, sans zéro inutile. */
export const cmDit = v => (Math.round(v * 10) / 10).toLocaleString('fr-FR', { maximumFractionDigits: 1 })

/* UNE TAILLE TAPÉE : « 19,3 », « 19.3 », « 19,3 cm » — null si ce n'en est
   pas une ; ramenée dans les bornes, au millimètre. */
export function lireCm(texte) {
  const t = String(texte ?? '').trim().replace(/\s*cm$/i, '').replace(',', '.')
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(t)) return null
  const v = Number(t)
  if (!(v > 0)) return null
  return Math.round(Math.min(CM_MAX, Math.max(CM_MIN, v)) * 10) / 10
}

/* LE PRÉRÉGLAGE d'une taille choisie (« Dos · 28 cm »), s'il y en a un :
   une largeur du tableau. */
export function prereglage(choix) {
  if (!choix || choix.cote !== 'largeur') return null
  for (const t of TAILLES_DTF) if (t.cm.includes(choix.cm)) return t.emplacement
  return null
}

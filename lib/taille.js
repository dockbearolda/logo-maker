/* ================================================= LA TAILLE D'IMPRESSION
   1er octobre 2026 (« toutes les tailles doivent être en mm ») ; 15
   octobre 2026 : plus de préréglages (ils étaient ceux du DTF d'un
   atelier — c'est un logiciel pour tout imprimeur). Le logo sort à la
   taille où il s'imprime — en largeur, ou en hauteur pour un logo tout en
   hauteur —, l'autre côté suit ses proportions. Sans choix, il sort à
   300 dpi de ses pixels (« Taille du fichier »). Tout se dit et se tape
   en millimètres. Pur : ni page, ni fil. */

/* Les bornes d'une taille tapée : 5 mm, deux mètres — au-delà, ce n'est
   plus un logo. */
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

/* « 322 », « 78,5 », « 1200 » : au dixième de millimètre, à la française,
   sans zéro inutile ni espace des milliers (elle passait dans les noms de
   fichiers, et « 1 200 » retouché ne se relisait plus). */
export const mmDit = v => (Math.round(v * 10) / 10).toLocaleString('fr-FR', { maximumFractionDigits: 1, useGrouping: false })

/* UNE TAILLE TAPÉE : « 280 », « 78,5 », « 78.5 mm » — null si ce n'en
   est pas une ; ramenée dans les bornes, au dixième de millimètre. */
export function lireMm(texte) {
  const t = String(texte ?? '').trim().replace(/\s*mm$/i, '').replace(/[\s\u00a0\u202f]/g, '').replace(',', '.')
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(t)) return null
  const v = Number(t)
  if (!(v > 0)) return null
  return Math.round(Math.min(MM_MAX, Math.max(MM_MIN, v)) * 10) / 10
}

/* ========================================================== LE PDF VECTORIEL
   25 septembre 2026 : « ce que je souhaite est un PDF vectoriel en
   finalité ». Le logo redessiné (lib/vectoriser.js) sort en PDF : de vrais
   tracés PDF, pas une image posée dans une page. Il s'ouvre dans Illustrator,
   s'agrandit sans flou, et passe tel quel au RIP de la presse DTF.
   UN PDF ÉCRIT À LA MAIN, sans bibliothèque : une page à la taille du logo,
   un flux de dessin, et chaque forme du SVG y devient un chemin rempli.
   Le SVG d'imagetracer ne parle que quatre mots — M, L, Q, Z, en
   coordonnées absolues — ; le PDF ne connaît pas la courbe quadratique, elle
   s'y écrit en cubique (même courbe, points de contrôle aux deux tiers).
   Les trous des lettres sont des sous-chemins de leur forme : remplis en
   pair-impair (`f*`), ils restent vides quel que soit leur sens.
   LA TAILLE : 300 dpi, celle d'un transfert DTF net — un logo de 3 543 px
   fait 30 cm —, ou la largeur qu'on demande (`largeurCm`) : un tracé
   s'agrandit sans rien perdre. */

export const DPI = 300
const PT_PAR_PX = 72 / DPI

const nombre = v => {
  const r = Math.round(v * 1000) / 1000
  return Object.is(r, -0) ? '0' : String(r)
}

/* LES FORMES D'UN SVG : leur couleur et leur chemin, et la boîte du dessin. */
export function lireSvg(svg) {
  const vb = /viewBox="\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)\s*"/.exec(svg)
  const l = /\swidth="([\d.]+)"/.exec(svg)
  const h = /\sheight="([\d.]+)"/.exec(svg)
  const boite = vb ? vb.slice(1).map(Number) : [0, 0, Number(l && l[1]) || 0, Number(h && h[1]) || 0]
  const formes = []
  for (const m of svg.matchAll(/<path\b([^>]*)\/?>/g)) {
    const attrs = m[1]
    const d = /\sd="([^"]*)"/.exec(attrs)
    const fill = /\sfill="rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)"/.exec(attrs)
    const opacite = /\sopacity="([\d.]+)"/.exec(attrs)
    if (!d || !fill || (opacite && Number(opacite[1]) === 0)) continue
    formes.push({ couleur: fill.slice(1).map(Number), d: d[1] })
  }
  return {
    boite,
    largeur: Number(l && l[1]) || boite[2],
    hauteur: Number(h && h[1]) || boite[3],
    formes,
  }
}

/* UN CHEMIN SVG (M L Q C Z absolus) EN OPÉRATEURS PDF. `f` passe du repère du
   SVG à celui de la page. `ops` : les mots de l'opérateur — ceux du
   PostScript pour un EPS (lib/export-logo.js). */
const OPS_PDF = { m: 'm', l: 'l', c: 'c', h: 'h' }
export function cheminPdf(d, f, ops = OPS_PDF) {
  const jetons = d.match(/[MLQCZmlqcz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || []
  const sortie = []
  let i = 0
  let cmd = null
  let x = 0, y = 0, x0 = 0, y0 = 0
  const lire = () => Number(jetons[i++])
  const point = (a, b) => { const [u, v] = f(a, b); return nombre(u) + ' ' + nombre(v) }
  while (i < jetons.length) {
    if (/[A-Za-z]/.test(jetons[i])) cmd = jetons[i++].toUpperCase()
    if (cmd === 'M') {
      x = x0 = lire(); y = y0 = lire()
      sortie.push(point(x, y) + ' ' + ops.m)
      cmd = 'L'
    } else if (cmd === 'L') {
      x = lire(); y = lire()
      sortie.push(point(x, y) + ' ' + ops.l)
    } else if (cmd === 'Q') {
      const qx = lire(), qy = lire(), ex = lire(), ey = lire()
      const c1x = x + 2 / 3 * (qx - x), c1y = y + 2 / 3 * (qy - y)
      const c2x = ex + 2 / 3 * (qx - ex), c2y = ey + 2 / 3 * (qy - ey)
      sortie.push(point(c1x, c1y) + ' ' + point(c2x, c2y) + ' ' + point(ex, ey) + ' ' + ops.c)
      x = ex; y = ey
    } else if (cmd === 'C') {
      const a = lire(), b = lire(), c = lire(), e = lire()
      x = lire(); y = lire()
      sortie.push(point(a, b) + ' ' + point(c, e) + ' ' + point(x, y) + ' ' + ops.c)
    } else if (cmd === 'Z') {
      sortie.push(ops.h)
      x = x0; y = y0
      cmd = null
    } else {
      i++
    }
  }
  return sortie.join('\n')
}

/* LE CONTOUR D'UN SVG EN CHEMIN DE DÉCOUPE PDF, sur une page de W × H
   points (toutes ses formes, en pair-impair). */
export function decoupePdf(svg, W, H) {
  const { boite, formes } = lireSvg(svg)
  const sx = W / (boite[2] || 1), sy = H / (boite[3] || 1)
  const f = (a, b) => [(a - boite[0]) * sx, H - (b - boite[1]) * sy]
  return formes.map(fo => cheminPdf(fo.d, f)).join('\n') + '\nW* n'
}

/* LA COUCHE DE BLANC DTF (27 septembre 2026, le raccourci Illustrator de
   l'atelier, « SPOT_1 DTF ») : la silhouette du logo, remplie du ton direct
   « Spot_1 » — ce que le RIP imprime en encre blanche —, posée AU-DESSUS du
   logo en surimpression : elle ne l'efface pas, elle s'y ajoute. Sa couleur
   d'affichage est le magenta 100 % du raccourci : rose à l'écran, pour le
   contrôle. Illustrator la rouvre en nuance « Spot_1 », surimpression cochée. */
export const SPOT_BLANC = 'Spot_1'
export const RESSOURCES_BLANC = '/ColorSpace << /Blanc [/Separation /' + SPOT_BLANC
  + ' /DeviceCMYK << /FunctionType 2 /Domain [0 1] /C0 [0 0 0 0] /C1 [0 1 0 0] /N 1 >>] >>'
  + ' /ExtGState << /Surimp << /Type /ExtGState /OP true /op true /OPM 1 >> >>'

/* Les formes de `svg`, en Spot_1, sur une page de W × H points. */
export function blancPdf(svg, W, H) {
  const { boite, formes } = lireSvg(svg)
  const sx = W / (boite[2] || 1), sy = H / (boite[3] || 1)
  const f = (a, b) => [(a - boite[0]) * sx, H - (b - boite[1]) * sy]
  return 'q\n/Surimp gs\n/Blanc cs 1 scn\n' + formes.map(fo => cheminPdf(fo.d, f) + '\nf*').join('\n') + '\nQ'
}

/* LE PDF ENTIER, en texte (tout y est ASCII : un caractère, un octet — les
   positions de la table des objets se comptent donc en caractères).
   `blanc` : le SVG des formes à couvrir (même cadre que `svg`), en couche
   de blanc DTF par-dessus. */
export function svgVersPdf(svg, { titre = 'Logo vectorise - OLDA Print Studio', largeurCm = 0, cmjn = null, blanc = null } = {}) {
  const { boite, largeur, hauteur, formes } = lireSvg(svg)
  const W = largeurCm > 0 ? largeurCm / 2.54 * 72 : largeur * PT_PAR_PX
  const H = W * hauteur / (largeur || 1)
  const sx = W / (boite[2] || 1)
  const sy = H / (boite[3] || 1)
  /* Le SVG descend, le PDF monte. */
  const f = (a, b) => [(a - boite[0]) * sx, H - (b - boite[1]) * sy]
  /* `cmjn` (quatre valeurs de 0 à 100) : toutes les formes en quadrichromie,
     écrites telles quelles pour l'imprimeur (l'opérateur « k » du PDF). */
  const encre = cmjn ? cmjn.map(v => nombre(Math.max(0, Math.min(100, v)) / 100)).join(' ') + ' k' : null
  const dessin = formes.map(fo => {
    const [r, g, b] = fo.couleur.map(c => nombre(c / 255))
    return (encre || r + ' ' + g + ' ' + b + ' rg') + '\n' + cheminPdf(fo.d, f) + '\nf*'
  }).join('\n') + (blanc ? '\n' + blancPdf(blanc, W, H) : '')
  const titrePdf = String(titre).replace(/[^\x20-\x7e]/g, '').replace(/[()\\]/g, '\\$&')
  const objets = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + nombre(W) + ' ' + nombre(H) + '] /Resources << ' + (blanc ? RESSOURCES_BLANC + ' ' : '') + '>> /Contents 4 0 R >>',
    '<< /Length ' + dessin.length + ' >>\nstream\n' + dessin + '\nendstream',
    '<< /Title (' + titrePdf + ') /Producer (OLDA Print Studio) >>',
  ]
  let pdf = '%PDF-1.4\n'
  const positions = []
  objets.forEach((o, k) => {
    positions.push(pdf.length)
    pdf += (k + 1) + ' 0 obj\n' + o + '\nendobj\n'
  })
  const xref = pdf.length
  pdf += 'xref\n0 ' + (objets.length + 1) + '\n0000000000 65535 f \n'
    + positions.map(p => String(p).padStart(10, '0') + ' 00000 n \n').join('')
    + 'trailer\n<< /Size ' + (objets.length + 1) + ' /Root 1 0 R /Info 5 0 R >>\nstartxref\n' + xref + '\n%%EOF\n'
  return pdf
}

/* La taille imprimée, en centimètres, d'une page de `px` pixels. */
export const centimetres = px => Math.round(px / DPI * 2.54 * 10) / 10

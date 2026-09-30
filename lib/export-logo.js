/* ================================================================ LES EXPORTS
   27 septembre 2026 : « un logo vectorisé parfaitement utilisable, haut de
   gamme et professionnel ». Le PDF (lib/pdf-vectoriel.js) part au RIP de la
   presse DTF ; le reste du monde veut aussi le logo :
   - SVG : le web, Canva, Figma, la brodeuse, le plotter de découpe — à sa
     taille d'impression, en millimètres, couleurs en hexadécimal ;
   - EPS : Illustrator, CorelDRAW, les vieux RIP — les mêmes tracés en
     PostScript, la couche de blanc Spot_1 comprise ;
   - PNG : 300 dpi, fond transparent, rendu dans la page (lib/studio-
     detourage.js), écrit par lib/png.js.
   Tout sort À LA TAILLE CHOISIE (`largeurCm`) : un tracé s'agrandit sans
   rien perdre. Écrit à la main, sans bibliothèque. */
import { lireSvg, cheminPdf, DPI } from './pdf-vectoriel.js'
import { crc32 } from './png.js'

const nombre = v => {
  const r = Math.round(v * 1000) / 1000
  return Object.is(r, -0) ? '0' : String(r)
}
const hex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')

/* LA TAILLE IMPRIMÉE d'un dessin de `largeur` × `hauteur` px : à la
   largeur choisie, ou à 300 dpi. */
export function tailleCm(largeur, hauteur, largeurCm = 0) {
  const l = largeurCm > 0 ? largeurCm : largeur / DPI * 2.54
  return [l, largeur ? l * hauteur / largeur : 0]
}

/* UNE COULEUR CHANGÉE À LA MAIN (la palette du Logo maker) : `table` va de
   « r,g,b » à la nouvelle couleur. */
export function recolorer(svg, table = {}) {
  if (!Object.keys(table).length) return svg
  return svg.replace(/fill="rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)"/g, (m, r, g, b) => {
    const c = table[r + ',' + g + ',' + b]
    return c ? 'fill="rgb(' + c.map(Math.round).join(',') + ')"' : m
  })
}

/* LE SVG FINAL : sa taille en millimètres, ses couleurs en hexadécimal, un
   titre. Le dessin, lui, ne bouge pas (le viewBox garde ses pixels). */
export function svgFinal(svg, { largeurCm = 0, titre = 'Logo vectorisé — OLDA Print Studio' } = {}) {
  const { boite } = lireSvg(svg)
  const [l, h] = tailleCm(boite[2], boite[3], largeurCm)
  const mm = v => nombre(v * 10) + 'mm'
  return svg
    .replace(/<svg\b[^>]*>/, '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="' + mm(l) + '" height="' + mm(h) + '" viewBox="' + boite.map(nombre).join(' ') + '">')
    .replace(/<title>[^<]*<\/title>/, '')
    .replace(/(<svg\b[^>]*>)/, '$1<title>' + titre.replace(/[<&]/g, '') + '</title>')
    .replace(/fill="rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)"/g, (m, r, g, b) => 'fill="' + hex([r, g, b].map(Number)) + '"')
    /* L'image d'un dégradé : l'adresse à l'ancienne, qu'Illustrator lit. */
    .replace(/<image href=/g, '<image xlink:href=')
}

/* L'EPS : chaque forme remplie en pair-impair (`eofill`), en RVB — ou en
   CMJN tel quel (`cmjn`, de 0 à 100). `blanc` : le SVG des formes à couvrir
   de blanc DTF, en ton direct Spot_1 et en surimpression (voir `blancPdf`,
   lib/pdf-vectoriel.js). */
export function svgVersEps(svg, { largeurCm = 0, cmjn = null, blanc = null, titre = 'Logo vectorise - OLDA Print Studio' } = {}) {
  const { boite, largeur, formes } = lireSvg(svg)
  const [lc, hc] = tailleCm(largeur, lireSvg(svg).hauteur, largeurCm)
  const W = lc / 2.54 * 72, H = hc / 2.54 * 72
  const sx = W / (boite[2] || 1), sy = H / (boite[3] || 1)
  const f = (a, b) => [(a - boite[0]) * sx, H - (b - boite[1]) * sy]
  const ops = { m: 'moveto', l: 'lineto', c: 'curveto', h: 'closepath' }
  const encre = cmjn ? cmjn.map(v => nombre(Math.max(0, Math.min(100, v)) / 100)).join(' ') + ' setcmykcolor' : null
  const dessin = formes.map(fo => (encre || fo.couleur.map(c => nombre(c / 255)).join(' ') + ' setrgbcolor')
    + '\nnewpath\n' + cheminPdf(fo.d, f, ops) + '\neofill').join('\n')
  let couche = ''
  if (blanc) {
    const b = lireSvg(blanc)
    const kx = W / (b.boite[2] || 1), ky = H / (b.boite[3] || 1)
    const g = (a, c) => [(a - b.boite[0]) * kx, H - (c - b.boite[1]) * ky]
    couche = '\ngsave\ntrue setoverprint\n[/Separation /Spot_1 /DeviceCMYK {0 exch 0 0}] setcolorspace 1 setcolor\n'
      + b.formes.map(fo => 'newpath\n' + cheminPdf(fo.d, g, ops) + '\neofill').join('\n') + '\ngrestore'
  }
  const titreEps = String(titre).replace(/[^\x20-\x7e]/g, '')
  return '%!PS-Adobe-3.0 EPSF-3.0\n'
    + '%%BoundingBox: 0 0 ' + Math.ceil(W) + ' ' + Math.ceil(H) + '\n'
    + '%%HiResBoundingBox: 0 0 ' + nombre(W) + ' ' + nombre(H) + '\n'
    + '%%Title: ' + titreEps + '\n'
    + '%%Creator: OLDA Print Studio\n'
    + '%%LanguageLevel: 2\n'
    + '%%Pages: 1\n'
    + '%%EndComments\n'
    + '%%Page: 1 1\n'
    + 'gsave\n' + dessin + couche + '\ngrestore\nshowpage\n%%EOF\n'
}

/* LE NOM DU FICHIER : « logo client.jpeg » → « logo client-vectoriel.pdf ». */
export function nomExport(nom, extension, suffixe = '', sorte = 'vectoriel') {
  const base = String(nom || '').replace(/\.[^./\\]*$/, '').trim() || 'logo'
  return base + '-' + sorte + suffixe + '.' + extension
}

/* LE RECADRAGE D'UNE IMAGE DÉTOURÉE (RVBA) : au plus petit rectangle qui
   tient tout ce qui n'est pas transparent — le logo, sans le vide autour.
   null : il ne reste rien. */
export function recadrer(rgba, largeur, hauteur) {
  let x0 = largeur, y0 = hauteur, x1 = -1, y1 = -1
  for (let y = 0; y < hauteur; y++) {
    const o = y * largeur * 4
    for (let x = 0; x < largeur; x++) {
      if (!rgba[o + x * 4 + 3]) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      y1 = y
    }
  }
  if (x1 < 0) return null
  const l = x1 - x0 + 1, h = y1 - y0 + 1
  const data = new Uint8ClampedArray(l * h * 4)
  for (let y = 0; y < h; y++) data.set(rgba.subarray(((y0 + y) * largeur + x0) * 4, ((y0 + y) * largeur + x1 + 1) * 4), y * l * 4)
  return { data, largeur: l, hauteur: h, x: x0, y: y0 }
}

/* LE KIT COMPLET (.zip) : tous les formats d'un coup, rangés tels quels
   (« stockés », sans compression : un PDF, un PNG le sont déjà). Écrit à la
   main — l'en-tête de chaque fichier, puis le répertoire. `date` : l'heure
   inscrite (celle de l'export). */
export function zip(fichiers, date = new Date()) {
  const texte = new TextEncoder()
  const heure = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)
  const jour = ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  const morceaux = [], repertoire = []
  let position = 0
  for (const f of fichiers) {
    const nom = texte.encode(f.nom)
    const octets = f.octets
    const crc = crc32(octets)
    const tete = new Uint8Array(30 + nom.length)
    const t = new DataView(tete.buffer)
    t.setUint32(0, 0x04034b50, true)
    t.setUint16(4, 20, true)
    t.setUint16(6, 0x0800, true)
    t.setUint16(10, heure, true)
    t.setUint16(12, jour, true)
    t.setUint32(14, crc, true)
    t.setUint32(18, octets.length, true)
    t.setUint32(22, octets.length, true)
    t.setUint16(26, nom.length, true)
    tete.set(nom, 30)
    const c = new Uint8Array(46 + nom.length)
    const v = new DataView(c.buffer)
    v.setUint32(0, 0x02014b50, true)
    v.setUint16(4, 20, true)
    v.setUint16(6, 20, true)
    v.setUint16(8, 0x0800, true)
    v.setUint16(12, heure, true)
    v.setUint16(14, jour, true)
    v.setUint32(16, crc, true)
    v.setUint32(20, octets.length, true)
    v.setUint32(24, octets.length, true)
    v.setUint16(28, nom.length, true)
    v.setUint32(42, position, true)
    c.set(nom, 46)
    morceaux.push(tete, octets)
    repertoire.push(c)
    position += tete.length + octets.length
  }
  const tailleRep = repertoire.reduce((s, c) => s + c.length, 0)
  const fin = new Uint8Array(22)
  const e = new DataView(fin.buffer)
  e.setUint32(0, 0x06054b50, true)
  e.setUint16(8, fichiers.length, true)
  e.setUint16(10, fichiers.length, true)
  e.setUint32(12, tailleRep, true)
  e.setUint32(16, position, true)
  const tout = morceaux.concat(repertoire, [fin])
  const sortie = new Uint8Array(tout.reduce((s, m) => s + m.length, 0))
  let o = 0
  for (const m of tout) { sortie.set(m, o); o += m.length }
  return sortie
}

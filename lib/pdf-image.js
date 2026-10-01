/* ================================================================ LE PDF IMAGE
   Le détourage sort aussi en PDF : l'image détourée ELLE-MÊME, pixel pour
   pixel, avec sa transparence (un masque doux), à 300 dpi — c'est ce que
   la presse DTF imprime, et rien ne s'y perd. (26 septembre 2026, une
   illustration pleine de dégradés : aucune vectorisation ne la rendait ;
   25 septembre 2026, « je ne veux pas de vectorisation » : il n'y a plus
   que ce PDF-là, à côté du PNG de lib/png.js.)
   UN PDF ÉCRIT À LA MAIN, sans bibliothèque : une page à la taille de
   l'image, l'image posée dessus. Compressée par le navigateur
   (CompressionStream, « deflate » = le Flate du PDF). Le fichier est
   binaire — les positions de la table des objets se comptent en octets.
   LA TAILLE : 300 dpi, celle d'un transfert DTF net — une image de
   3 543 px fait 30 cm —, ou la largeur qu'on demande (`largeurCm`).
   EN CMJN (30 septembre 2026 : « tout ce qui sort en PDF doit être en
   CMJN ») : chaque pixel s'y écrit en encres, comme Illustrator le
   convertit (lib/cmjn.js) ; la transparence reste un masque à part. */
import { imageCmjn } from './cmjn.js'

export const DPI = 300
const PT_PAR_PX = 72 / DPI

const nombre = v => {
  const r = Math.round(v * 1000) / 1000
  return Object.is(r, -0) ? '0' : String(r)
}

/* La taille imprimée, en centimètres, de `px` pixels à 300 dpi. */
export const centimetres = px => Math.round(px / DPI * 2.54 * 10) / 10

/* LE PRÉDICTEUR PNG (Paeth), que le PDF sait défaire (`/Predictor 15`) et
   que le PNG utilise tel quel : chaque octet s'écrit comme son écart à ses
   voisins de gauche et du dessus, chaque ligne précédée de son filtre (4).
   Un ciel, un aplat deviennent des suites de zéros — le fichier fond d'un
   tiers. */
export function predire(octets, largeur, hauteur, canaux) {
  const ligne = largeur * canaux
  const sortie = new Uint8Array((ligne + 1) * hauteur)
  for (let y = 0; y < hauteur; y++) {
    const o = y * (ligne + 1)
    const i = y * ligne
    sortie[o] = 4
    for (let x = 0; x < ligne; x++) {
      const a = x >= canaux ? octets[i + x - canaux] : 0
      const b = y ? octets[i + x - ligne] : 0
      const c = x >= canaux && y ? octets[i + x - ligne - canaux] : 0
      const p = a + b - c
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
      sortie[o + 1 + x] = octets[i + x] - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)
    }
  }
  return sortie
}

/* LA COMPRESSION DU NAVIGATEUR (zlib : l'en-tête que le PDF et le PNG
   attendent tous les deux). */
export async function compresser(octets) {
  const flux = new Blob([octets]).stream().pipeThrough(new CompressionStream('deflate'))
  return new Uint8Array(await new Response(flux).arrayBuffer())
}

/* `decoupe(W, H)` : un chemin de découpe (lib/pdf-vectoriel.js) — l'image
   ne se montre qu'à l'intérieur du contour vectoriel : le bord est net à
   toute taille, les couleurs et les dégradés restent ceux de l'image.
   `dessus(W, H)` : des formes peintes par-dessus l'image, hors découpe (les
   lettres des polices d'un dégradé, lib/pdf-vectoriel.js, `dessinPdf`).
   `blanc(W, H)` : la couche de blanc DTF, par-dessus (lib/pdf-vectoriel.js,
   `blancPdf`) ; `ressources`, ce qu'elle demande à la page. */
/* `blancMasque` (29 septembre 2026, « propose le Spot_1 aussi sur
   Détouré ») : la couche de blanc DTF sans aucun tracé — un masque d'un
   bit par pixel (`/ImageMask`), là où l'image est opaque à moitié ou plus,
   peint en Spot_1 par-dessus, en surimpression ; `ressources` : celles de
   lib/pdf-vectoriel.js (`RESSOURCES_BLANC`). */
export const SEUIL_BLANC = 128
export function masqueBlanc(rgba, largeur, hauteur, seuil = SEUIL_BLANC) {
  const ligne = (largeur + 7) >> 3
  const bits = new Uint8Array(ligne * hauteur).fill(255)
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      /* Un bit à 0 : l'encre passe (le `/Decode [0 1]` d'office). */
      if (rgba[(y * largeur + x) * 4 + 3] >= seuil) bits[y * ligne + (x >> 3)] &= ~(0x80 >> (x & 7))
    }
  }
  return bits
}

/* LE DÉBORD (30 septembre 2026) : un pixel tout transparent n'a pas de
   couleur — le détourage l'écrit noir (0, 0, 0). Caché par le masque, ce
   noir revient dès qu'un logiciel lisse l'image (Acrobat à l'écran, un RIP
   qui l'agrandit) : il se mêle au bord, un liseré sombre entoure le logo.
   Ici, le vide qui touche le dessin prend la couleur de son bord, sur
   `rayon` pixels (la moyenne de ses voisins colorés) ; plus loin, du
   blanc — pas d'encre, même pour un lecteur qui ignorerait le masque. La
   transparence ne bouge pas ; `rgba` non plus (une copie sort). */
export function deborder(rgba, largeur, hauteur, rayon = 2) {
  const n = largeur * hauteur
  const sortie = new Uint8ClampedArray(rgba)
  /* 1 : une couleur du fichier ; 2 : débordée ; 3 : dans le rang en cours. */
  const etat = new Uint8Array(n)
  for (let p = 0; p < n; p++) if (rgba[p * 4 + 3]) etat[p] = 1
  const autour = (p, f) => {
    const x = p % largeur, y = (p - x) / largeur
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const X = x + dx, Y = y + dy
      if ((dx || dy) && X >= 0 && Y >= 0 && X < largeur && Y < hauteur) f(Y * largeur + X)
    }
  }
  let rang = []
  for (let p = 0; p < n; p++) {
    if (etat[p]) continue
    let touche = false
    autour(p, q => { if (etat[q] === 1) touche = true })
    if (touche) { etat[p] = 3; rang.push(p) }
  }
  for (let k = 0; k < rayon && rang.length; k++) {
    for (const p of rang) {
      let r = 0, g = 0, b = 0, m = 0
      autour(p, q => { if (etat[q] === 1 || etat[q] === 2) { r += sortie[q * 4]; g += sortie[q * 4 + 1]; b += sortie[q * 4 + 2]; m++ } })
      sortie[p * 4] = r / m; sortie[p * 4 + 1] = g / m; sortie[p * 4 + 2] = b / m
    }
    for (const p of rang) etat[p] = 2
    const suivant = []
    if (k + 1 < rayon) for (const p of rang) autour(p, q => { if (!etat[q]) { etat[q] = 3; suivant.push(q) } })
    rang = suivant
  }
  for (let p = 0; p < n; p++) if (!etat[p]) sortie[p * 4] = sortie[p * 4 + 1] = sortie[p * 4 + 2] = 255
  return sortie
}

export async function imageVersPdf(rgba, largeur, hauteur, { titre = 'Detourage - OLDA Print Studio', largeurCm = 0, decoupe = null, dessus = null, blanc = null, blancMasque = false, ressources = '' } = {}) {
  rgba = deborder(rgba, largeur, hauteur)
  const n = largeur * hauteur
  const alpha = new Uint8Array(n)
  let opaque = true
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    alpha[p] = rgba[i + 3]
    if (rgba[i + 3] !== 255) opaque = false
  }
  const [zCmjn, zAlpha, zMasque] = await Promise.all([
    compresser(predire(imageCmjn(rgba, 4), largeur, hauteur, 4)),
    opaque ? null : compresser(predire(alpha, largeur, hauteur, 1)),
    blancMasque ? compresser(masqueBlanc(rgba, largeur, hauteur)) : null,
  ])
  const parms = canaux => ' /DecodeParms << /Predictor 15 /Colors ' + canaux + ' /BitsPerComponent 8 /Columns ' + largeur + ' >>'
  const W = largeurCm > 0 ? largeurCm / 2.54 * 72 : largeur * PT_PAR_PX
  const H = W * hauteur / (largeur || 1)
  const dessin = (decoupe ? 'q\n' + decoupe(W, H) + '\n' : '') + 'q ' + nombre(W) + ' 0 0 ' + nombre(H) + ' 0 0 cm /Im0 Do Q' + (decoupe ? '\nQ' : '')
    + (dessus ? '\n' + dessus(W, H) : '')
    + (blanc ? '\n' + blanc(W, H) : '')
    + (zMasque ? '\nq\n/Surimp gs\n/Blanc cs 1 scn\n' + nombre(W) + ' 0 0 ' + nombre(H) + ' 0 0 cm /Im1 Do\nQ' : '')
  const avecBlanc = !!(blanc || zMasque)
  const titrePdf = String(titre).replace(/[^\x20-\x7e]/g, '').replace(/[()\\]/g, '\\$&')
  const image = '/Type /XObject /Subtype /Image /Width ' + largeur + ' /Height ' + hauteur
    + ' /ColorSpace /DeviceCMYK /BitsPerComponent 8 /Filter /FlateDecode'
  const objets = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + nombre(W) + ' ' + nombre(H) + '] /Resources << /XObject << /Im0 5 0 R' + (zMasque ? ' /Im1 8 0 R' : '') + ' >>' + (avecBlanc && ressources ? ' ' + ressources : '') + ' >> /Contents 4 0 R >>',
    ['<< /Length ' + dessin.length + ' >>\nstream\n' + dessin + '\nendstream'],
    ['<< ' + image + parms(4) + (zAlpha ? ' /SMask 6 0 R' : '') + ' /Length ' + zCmjn.length + ' >>\nstream\n', zCmjn, '\nendstream'],
    /* Opaque, pas de masque : l'objet 6 reste un objet (nul), pas un trou
       dans la table — un validateur strict veut une liste libre chaînée. */
    zAlpha ? ['<< /Type /XObject /Subtype /Image /Width ' + largeur + ' /Height ' + hauteur + ' /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode' + parms(1) + ' /Length ' + zAlpha.length + ' >>\nstream\n', zAlpha, '\nendstream'] : 'null',
    '<< /Title (' + titrePdf + ') /Producer (OLDA Print Studio) >>',
    zMasque ? ['<< /Type /XObject /Subtype /Image /Width ' + largeur + ' /Height ' + hauteur + ' /ImageMask true /BitsPerComponent 1 /Filter /FlateDecode /Length ' + zMasque.length + ' >>\nstream\n', zMasque, '\nendstream'] : null,
  ]
  if (!objets[7]) objets.pop()
  const texte = s => new TextEncoder().encode(s)
  const morceaux = []
  let taille = 0
  const ecrire = m => { const u = typeof m === 'string' ? texte(m) : m; morceaux.push(u); taille += u.length }
  ecrire('%PDF-1.4\n')
  ecrire(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]))
  const positions = []
  objets.forEach((o, k) => {
    positions.push(o ? taille : null)
    if (!o) return
    ecrire((k + 1) + ' 0 obj\n')
    for (const m of [].concat(o)) ecrire(m)
    ecrire('\nendobj\n')
  })
  const xref = taille
  ecrire('xref\n0 ' + (objets.length + 1) + '\n0000000000 65535 f \n'
    + positions.map(p => (p === null ? '0000000000 65535 f \n' : String(p).padStart(10, '0') + ' 00000 n \n')).join('')
    + 'trailer\n<< /Size ' + (objets.length + 1) + ' /Root 1 0 R /Info 7 0 R >>\nstartxref\n' + xref + '\n%%EOF\n')
  const pdf = new Uint8Array(taille)
  let o = 0
  for (const m of morceaux) { pdf.set(m, o); o += m.length }
  return pdf
}

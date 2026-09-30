/* ==================================================================== LE PNG HD
   25 septembre 2026 : le détourage d'une photo sort en PNG — l'image
   elle-même, pixel pour pixel, fond transparent : le format que la presse
   DTF, Photoshop et Illustrator ouvrent tous. Écrit ici plutôt que par le
   canevas du navigateur :
   - le canevas garde ses pixels « prémultipliés » : un bord de cheveux à
     10 % d'opacité y perd ses couleurs, arrondies au dixième ; ici, chaque
     octet sort tel qu'il a été calculé ;
   - il n'écrit pas de résolution : une photo de 3 543 px s'ouvrait à
     125 cm dans Photoshop (72 dpi). Ici, 300 dpi (le bloc `pHYs`) : elle
     s'ouvre à 30 cm, sa taille d'impression nette.
   Les lignes passent par le prédicteur (Paeth, lib/pdf-image.js), puis par
   la compression du navigateur (le zlib qu'attend le PNG) : aucune
   bibliothèque. */
import { predire, compresser, DPI } from './pdf-image.js'

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

const TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(octets) {
  let c = 0xffffffff
  for (let i = 0; i < octets.length; i++) c = TABLE[(c ^ octets[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/* UN BLOC : sa longueur, son nom, ses octets, et le contrôle (CRC) du nom
   et des octets. */
function bloc(nom, donnees) {
  const sortie = new Uint8Array(12 + donnees.length)
  const v = new DataView(sortie.buffer)
  v.setUint32(0, donnees.length)
  for (let i = 0; i < 4; i++) sortie[4 + i] = nom.charCodeAt(i)
  sortie.set(donnees, 8)
  v.setUint32(8 + donnees.length, crc32(sortie.subarray(4, 8 + donnees.length)))
  return sortie
}

/* Les points par mètre d'une résolution en dpi : 300 dpi → 11 811. */
export const parMetre = dpi => Math.round(dpi / 0.0254)

/* LE PNG d'un RGBA : 8 bits par canal, couleurs sRVB (celles du canevas
   d'où viennent les pixels), la résolution d'impression. */
export async function pngHd(rgba, largeur, hauteur, { dpi = DPI } = {}) {
  const entete = new Uint8Array(13)
  const e = new DataView(entete.buffer)
  e.setUint32(0, largeur)
  e.setUint32(4, hauteur)
  entete[8] = 8 /* bits par canal */
  entete[9] = 6 /* rouge, vert, bleu, opacité */
  const resolution = new Uint8Array(9)
  const r = new DataView(resolution.buffer)
  r.setUint32(0, parMetre(dpi))
  r.setUint32(4, parMetre(dpi))
  resolution[8] = 1 /* le mètre */
  const pixels = await compresser(predire(rgba, largeur, hauteur, 4))
  const morceaux = [
    new Uint8Array(SIGNATURE),
    bloc('IHDR', entete),
    bloc('sRGB', new Uint8Array([0])),
    bloc('pHYs', resolution),
    bloc('IDAT', pixels),
    bloc('IEND', new Uint8Array(0)),
  ]
  const png = new Uint8Array(morceaux.reduce((t, m) => t + m.length, 0))
  let o = 0
  for (const m of morceaux) { png.set(m, o); o += m.length }
  return png
}

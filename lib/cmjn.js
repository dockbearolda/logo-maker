/* ================================================================== LE CMJN
   30 septembre 2026 : « tout ce qui sort en PDF doit être en CMJN ». Le
   PDF, l'EPS partent à la presse : leurs couleurs s'y écrivent en encres —
   cyan, magenta, jaune, noir —, converties comme Illustrator le fait en
   Europe (profil Coated FOGRA39, relatif colorimétrique, point noir
   compensé). Pas de moteur de couleur dans la page : la conversion est
   calculée d'avance par littleCMS sur une grille de couleurs
   (lib/cmjn-fogra39.js, outils/table-cmjn.mjs) ; entre ses sommets, elle
   s'interpole dans le tétraèdre qui contient la couleur — la méthode des
   moteurs de couleur eux-mêmes. */
import { N, TABLE } from './cmjn-fogra39.js'

const T = Uint8Array.from(atob(TABLE), c => c.charCodeAt(0))
const P = 255 / (N - 1)
/* Pour chaque niveau (0 à 255) : son sommet de la grille, et sa place vers
   le suivant (0 à 1). */
const BAS = new Int32Array(256)
const PART = new Float32Array(256)
for (let v = 0; v < 256; v++) {
  const t = v / P
  BAS[v] = Math.min(N - 2, Math.floor(t))
  PART[v] = t - BAS[v]
}
const DR = N * N * 4, DG = N * 4, DB = 4

/* La couleur (r, g, b de 0 à 255) en encres, écrites dans `sortie` à
   partir de `o` (de 0 à 255 : 255, cent pour cent d'encre). */
function convertir(r, g, b, sortie, o) {
  const x = PART[r], y = PART[g], z = PART[b]
  const a = BAS[r] * DR + BAS[g] * DG + BAS[b] * DB
  /* Le tétraèdre : le coin du bas, le coin du haut, et les deux sommets
     entre eux que la couleur longe (dans l'ordre de ses trois parts). */
  let p1, p2, w1, w2, w3
  if (x >= y) {
    if (y >= z) { p1 = DR; p2 = DR + DG; w1 = x - y; w2 = y - z; w3 = z }
    else if (x >= z) { p1 = DR; p2 = DR + DB; w1 = x - z; w2 = z - y; w3 = y }
    else { p1 = DB; p2 = DR + DB; w1 = z - x; w2 = x - y; w3 = y }
  } else if (z >= y) { p1 = DB; p2 = DG + DB; w1 = z - y; w2 = y - x; w3 = x }
  else if (z >= x) { p1 = DG; p2 = DG + DB; w1 = y - z; w2 = z - x; w3 = x }
  else { p1 = DG; p2 = DR + DG; w1 = y - x; w2 = x - z; w3 = z }
  const w0 = 1 - w1 - w2 - w3, p3 = DR + DG + DB
  for (let k = 0; k < 4; k++) sortie[o + k] = w0 * T[a + k] + w1 * T[a + p1 + k] + w2 * T[a + p2 + k] + w3 * T[a + p3 + k]
}

/* UNE COULEUR sRVB ([r, g, b], de 0 à 255) en CMJN, chaque encre de 0 à 1. */
export function cmjn([r, g, b]) {
  const e = new Float32Array(4)
  const n = v => Math.max(0, Math.min(255, Math.round(v)))
  convertir(n(r), n(g), n(b), e, 0)
  return Array.from(e, v => v / 255)
}

/* LES PIXELS D'UNE IMAGE (RVB, ou RVBA : `canaux` octets chacun, la
   transparence ignorée) en CMJN, quatre octets chacun (255 : cent pour
   cent d'encre). */
export function imageCmjn(pixels, canaux = 3) {
  const n = Math.floor(pixels.length / canaux)
  const sortie = new Uint8ClampedArray(n * 4)
  for (let p = 0, i = 0; p < n; p++, i += canaux) convertir(pixels[i], pixels[i + 1], pixels[i + 2], sortie, p * 4)
  return new Uint8Array(sortie.buffer)
}

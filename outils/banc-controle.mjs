/* LE BANC DU CONTRÔLE PRESSE (lib/controle.js) : un PNG (8 bits, non
   entrelacé) détouré et tracé en Node comme dans le fil du vecteur, son
   contrôle — l'accord, les îles perdues ou ajoutées, le trait le plus fin —,
   et la carte des désaccords écrite à côté du fichier (`…-carte.png` :
   vert, l'encre d'accord ; rouge, attendue mais pas tracée ; bleu, tracée
   mais pas attendue). Pour juger un changement du tracé sur de vrais logos
   (CLAUDE.md) : avant, après, et regarder la carte.
     node outils/banc-controle.mjs <logo.png> [lissage]   (APLAT=1 : un logo à plat)
   Sans l'IA (le fichier reçu se trace tel quel) : les nombres ne sont pas
   ceux du panneau, qui trace l'image redessinée ×4 — la comparaison
   avant/après, elle, tient. */
import { writeFileSync } from 'node:fs'
import { lirePng } from './png-lire.mjs'
import { detourer } from '../lib/detourage.js'
import { vectoriserLisse } from '../lib/vecteur-lisse.js'
import { etiqueter } from '../lib/image-nette.js'
import { pngHd } from '../lib/png.js'
import { COTE_CONTROLE, controler } from '../lib/controle.js'

const chemin = process.argv[2]
const lissage = Number(process.argv[3] || 70)
const img = lirePng(chemin)
console.log('image', img.largeur, 'x', img.hauteur)
const t0 = performance.now()
const r = detourer(img.data, img.largeur, img.hauteur, { tolerance: 28, interieur: true }, 1)
const origine = Math.max(img.largeur, img.hauteur)
const options = { fonds: r.fonds || [], source: img.data, alpha: true, lissage, coteTravail: 0, trouer: false, geometrie: true, miettes: true, origine, sans: [], nuances: true, fusion: 1, texte: null, remplacements: [], mono: false, memo: {}, aPlat: process.env.APLAT === '1' }
const multi = vectoriserLisse(r.data, img.largeur, img.hauteur, options)
console.log('tracé en', Math.round(performance.now() - t0), 'ms ; formes', multi.formes, 'nœuds', multi.noeuds, 'dégradé', multi.degrade, 'couleurs', multi.couleurs.length, 'couches', multi.couches.length)
const t1 = performance.now()
const c = controler(r.data, img.largeur, img.hauteur, multi.cadre, multi.couches, { echelle: 1, efface: multi.efface })
console.log('contrôle en', Math.round(performance.now() - t1), 'ms', JSON.stringify({ accord: c.accord, ecart: c.ecart, manque: c.manque, ajout: c.ajout, teinte: c.teinte, fin: c.finesse.fin, L: c.L, H: c.H }))

/* La carte des désaccords, aux pixels de contrôle. */
const cadre = multi.cadre
const f = Math.min(1, COTE_CONTROLE / Math.max(cadre.largeur, cadre.hauteur))
const L = Math.round(cadre.largeur * f), H = Math.round(cadre.hauteur * f)
const trace = etiqueter(multi.couches, cadre.x, cadre.y, f, L, H)
const carte = new Uint8ClampedArray(L * H * 4)
for (let Y = 0; Y < H; Y++) for (let X = 0; X < L; X++) {
  const x = Math.min(img.largeur - 1, cadre.x + Math.floor((X + 0.5) / f)), y = Math.min(img.hauteur - 1, cadre.y + Math.floor((Y + 0.5) / f))
  const a = r.data[(y * img.largeur + x) * 4 + 3] >= 128, e = trace[Y * L + X] >= 0
  const o = (Y * L + X) * 4
  if (a && e) carte.set([200, 230, 200, 255], o)
  else if (a) carte.set([220, 0, 0, 255], o)
  else if (e) carte.set([0, 0, 220, 255], o)
  else carte.set([255, 255, 255, 255], o)
}
const sortie = chemin.replace(/\.png$/i, '') + '-carte.png'
writeFileSync(sortie, await pngHd(carte, L, H))
console.log('carte', sortie, L, 'x', H)

/* LE BANC DU CONTRÔLE PRESSE (lib/controle.js) : un PNG (8 bits, non
   entrelacé) détouré et tracé en Node comme dans le fil du vecteur, son
   contrôle — l'accord, les îles perdues ou ajoutées, le trait le plus fin —,
   et la carte des désaccords écrite à côté du fichier (`…-carte.png` :
   vert, l'encre d'accord ; rouge, attendue mais pas tracée ; bleu, tracée
   mais pas attendue). Pour juger un changement du tracé sur de vrais logos
   (CLAUDE.md) : avant, après, et regarder la carte.
     node outils/banc-controle.mjs <logo.png> [lissage]
   Sans l'IA (le fichier reçu se trace tel quel) : les nombres ne sont pas
   ceux du panneau, qui trace l'image redessinée ×4 — la comparaison
   avant/après, elle, tient. */
import { readFileSync, writeFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { detourer } from '../lib/detourage.js'
import { vectoriserLisse } from '../lib/vecteur-lisse.js'
import { etiqueter } from '../lib/image-nette.js'
import { pngHd } from '../lib/png.js'
import { COTE_CONTROLE, controler } from '../lib/controle.js'

function lirePng(chemin) {
  const b = readFileSync(chemin)
  let o = 8, l = 0, h = 0, type = 0, idat = [], pal = null, trns = null
  while (o < b.length) {
    const n = b.readUInt32BE(o), t = b.toString('latin1', o + 4, o + 8), d = b.subarray(o + 8, o + 8 + n)
    if (t === 'IHDR') { l = d.readUInt32BE(0); h = d.readUInt32BE(4); if (d[8] !== 8) throw new Error('8 bits seulement'); type = d[9]; if (d[12]) throw new Error('entrelacé') }
    else if (t === 'IDAT') idat.push(d)
    else if (t === 'PLTE') pal = d
    else if (t === 'tRNS') trns = d
    o += 12 + n
  }
  const canaux = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type]
  const raw = inflateSync(Buffer.concat(idat))
  const stride = l * canaux, out = new Uint8Array(h * stride)
  let p = 0
  for (let y = 0; y < h; y++) {
    const f = raw[p++], ligne = y * stride, avant = ligne - stride
    for (let x = 0; x < stride; x++) {
      const a = x >= canaux ? out[ligne + x - canaux] : 0, bb = y ? out[avant + x] : 0, c = y && x >= canaux ? out[avant + x - canaux] : 0
      let v = raw[p++]
      if (f === 1) v += a
      else if (f === 2) v += bb
      else if (f === 3) v += (a + bb) >> 1
      else if (f === 4) { const q = a + bb - c, pa = Math.abs(q - a), pb = Math.abs(q - bb), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? bb : c }
      out[ligne + x] = v & 255
    }
  }
  const rgba = new Uint8ClampedArray(l * h * 4)
  for (let i = 0; i < l * h; i++) {
    const s = i * canaux
    if (type === 6) rgba.set(out.subarray(s, s + 4), i * 4)
    else if (type === 2) { rgba.set(out.subarray(s, s + 3), i * 4); rgba[i * 4 + 3] = 255 }
    else if (type === 0) { rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = out[s]; rgba[i * 4 + 3] = 255 }
    else if (type === 4) { rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = out[s]; rgba[i * 4 + 3] = out[s + 1] }
    else { const k = out[s]; rgba.set(pal.subarray(k * 3, k * 3 + 3), i * 4); rgba[i * 4 + 3] = trns && k < trns.length ? trns[k] : 255 }
  }
  return { data: rgba, largeur: l, hauteur: h }
}

const chemin = process.argv[2]
const lissage = Number(process.argv[3] || 70)
const img = lirePng(chemin)
console.log('image', img.largeur, 'x', img.hauteur)
const t0 = performance.now()
const r = detourer(img.data, img.largeur, img.hauteur, { tolerance: 28, interieur: true }, 1)
const origine = Math.max(img.largeur, img.hauteur)
const options = { fonds: r.fonds || [], source: img.data, alpha: true, lissage, coteTravail: 0, trouer: false, geometrie: true, miettes: true, origine, sans: [], nuances: true, fusion: 1, texte: null, remplacements: [], mono: false, memo: {} }
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

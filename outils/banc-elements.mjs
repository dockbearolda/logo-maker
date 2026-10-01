/* LE BANC DES ÉLÉMENTS (lib/elements.js, lib/detourage.js `creux`) :
   chaque PNG donné (8 bits, non entrelacé — `sips -s format png` pour le
   reste) réduit à 1 400 px comme l'aperçu, détouré « Partout » sans la
   règle des éléments (un logo à plat, comme avant) et avec (ce que le
   studio fait : la règle ne s'applique qu'à une illustration) ; les
   pixels qui changent écrits dans _essais/out/el-<nom>.png — magenta :
   gardé en plus, cyan : retiré en plus. Pour juger un changement de
   `GRAND`, `PART` ou des lettres sur de vrais logos (CLAUDE.md).
     node outils/banc-elements.mjs <logo.png> [<logo2.png>…] */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { detourer, APERCU_MAX, estIllustration, fondsDuBord } from '../lib/detourage.js'
import { reduire } from '../lib/vectoriser.js'
import { pngHd } from '../lib/png.js'

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


const fichiers = process.argv.slice(2)
if (!fichiers.length) { console.log('node outils/banc-elements.mjs <logo.png> [<logo2.png>…]'); process.exit(1) }
mkdirSync('_essais/out', { recursive: true })
for (const chemin of fichiers) {
  let i0
  try { i0 = lirePng(chemin) } catch (e) { console.log(chemin, 'sauté :', e.message); continue }
  const img = Math.max(i0.largeur, i0.hauteur) > APERCU_MAX ? reduire(i0.data, i0.largeur, i0.hauteur, APERCU_MAX) : i0
  const fonds = fondsDuBord(img.data, img.largeur, img.hauteur)
  const illus = fonds.length > 0 && estIllustration(img.data, fonds)
  const t0 = performance.now()
  const avant = detourer(img.data, img.largeur, img.hauteur, { tolerance: 28, interieur: true, elements: false }, 1)
  const t1 = performance.now()
  const apres = detourer(img.data, img.largeur, img.hauteur, { tolerance: 28, interieur: true }, 1)
  const t2 = performance.now()
  const n = img.largeur * img.hauteur
  let gardes = 0, retires = 0
  const out = new Uint8ClampedArray(n * 4)
  for (let p = 0; p < n; p++) {
    const a = avant.data[p * 4 + 3] >= 128, b = apres.data[p * 4 + 3] >= 128
    const i = p * 4, al = apres.data[i + 3] / 255
    out[i] = apres.data[i] * al + 200 * (1 - al); out[i + 1] = apres.data[i + 1] * al + 30 * (1 - al); out[i + 2] = apres.data[i + 2] * al + 40 * (1 - al); out[i + 3] = 255
    if (a !== b) { if (b) { gardes++; out.set([255, 0, 255, 255], i) } else { retires++; out.set([0, 255, 255, 255], i) } }
  }
  const nom = chemin.replace(/^.*\//, '').replace(/\.png$/i, '')
  console.log(nom.padEnd(40), img.largeur + 'x' + img.hauteur, 'illustration', illus, '· gardés en plus', gardes, '· retirés en plus', retires, '·', Math.round(t1 - t0) + ' → ' + Math.round(t2 - t1) + ' ms')
  if (gardes || retires) writeFileSync('_essais/out/el-' + nom + '.png', await pngHd(out, img.largeur, img.hauteur))
}

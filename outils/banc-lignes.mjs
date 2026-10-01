/* LE BANC DES LIGNES (lib/texte.js, lib/courbes.js) : les lignes de texte
   entières (trois lettres au moins) que `lignesImage` trouve dans chaque
   PNG donné (8 bits, non entrelacé — `sips -s format png` pour le reste),
   avec le code d'aujourd'hui et avec celui d'un commit (`--avant=<ref>`,
   d'office HEAD : ses lib/ sortis par `git archive` dans _essais/avant/).
   Pour chaque fichier, les lignes perdues et les neuves — C : courbe,
   K : droite faite d'une chaîne, D : droite —, en pixels de lecture. Pour
   juger un changement des chaînes, des courbes ou du choix entre une
   droite et une courbe sur de vrais logos (CLAUDE.md) : une ligne droite
   d'un vrai texte ne doit pas disparaître.
     node outils/banc-lignes.mjs [--avant=<ref>] <logo.png> [<logo2.png>…] */
import { readFileSync, mkdirSync, rmSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { execSync } from 'node:child_process'
import { basename } from 'node:path'
import { lignesImage } from '../lib/texte.js'
import { boiteDe } from '../lib/polices.js'

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

const args = process.argv.slice(2)
const ref = (args.find(a => a.startsWith('--avant=')) || '--avant=HEAD').slice(8)
const fichiers = args.filter(a => !a.startsWith('--'))
const racine = new URL('../', import.meta.url).pathname
rmSync(racine + '_essais/avant', { recursive: true, force: true })
mkdirSync(racine + '_essais/avant', { recursive: true })
execSync('git archive ' + ref + ' lib vendor/opentype.min.mjs | tar -x --exclude="*.test.mjs" --exclude="*.gz" -C _essais/avant', { cwd: racine })
const avant = await import(racine + '_essais/avant/lib/texte.js')
const sorte = l => l.courbe ? 'C' : l.chaine ? 'K' : 'D'
const cle = l => boiteDe(l).map(v => Math.round(v / 6)).join(',') + '/' + l.length
let changes = 0
for (const f of fichiers) {
  let img
  try { img = lirePng(f) } catch (e) { console.log(basename(f), 'illisible :', e.message); continue }
  const a = avant.lignesImage(img.data, img.largeur, img.hauteur).lignes.filter(l => l.entiere && l.length >= 3)
  const n = lignesImage(img.data, img.largeur, img.hauteur).lignes.filter(l => l.entiere && l.length >= 3)
  const ka = new Set(a.map(cle)), kn = new Set(n.map(cle))
  const perdues = a.filter(l => !kn.has(cle(l))), neuves = n.filter(l => !ka.has(cle(l)))
  if (!perdues.length && !neuves.length) continue
  changes++
  console.log(basename(f).slice(0, 40).padEnd(40), 'perdues', perdues.map(l => sorte(l) + l.length + '@' + boiteDe(l).join(',')).join(' ') || '—', '| neuves', neuves.map(l => sorte(l) + l.length + '@' + boiteDe(l).join(',')).join(' ') || '—')
}
console.log(changes + ' fichier(s) sur ' + fichiers.length + ' changent')

/* UN PNG LU EN NODE (8 bits, non entrelacé) : ses pixels RGBA. Pour les
   bancs d'outils/, sans dépendance. */
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

export function lirePng(chemin) {
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

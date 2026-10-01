/* LE BANC DE L'ULTRA (1er octobre 2026), dans le navigateur : l'Ultra en
   huit orientations, en float32 et en float16, en tuiles de 192 et de 384,
   sur des logos réduits ×4 et passés en JPEG, agrandis, comparés à
   l'original — partout et sur leurs bords (PSNR, dB) —, son temps, et
   l'écart de chaque réglage au premier (`contreRef`). Juger un changement
   du modèle ou des tuiles avant de le faire (CLAUDE.md). Dans un Chromium
   visible (le volet caché bride tout), page du studio ouverte, les PNG
   copiés dans `_essais/ultra/` (ignoré par git) :
     await (await import('/outils/banc-ultra.mjs')).banc({ logos: ['logo.png'] }) */
import { nettoyerParTuiles, enOrientations, ORIENTATIONS } from '/lib/nettoyage.js'

/* Les six du 1er octobre 2026 (~/Downloads, convertis en PNG par `sips`). */
const LOGOS = ['1600w-A_O_h0NnARE.png', 'Logo_SSV__6_-1920w.png', 'LOGO_DIB_CHATGPT.png', 'unnamed-2.png', 'CD447BBB-87EF-40CD-AF45-1B8C23149BB5.png', '10_sans_ar.png']

async function pixels(url) {
  const b = await createImageBitmap(await (await fetch(url)).blob())
  const c = new OffscreenCanvas(b.width, b.height), x = c.getContext('2d')
  x.drawImage(b, 0, 0)
  return { data: x.getImageData(0, 0, b.width, b.height).data, largeur: b.width, hauteur: b.height, bitmap: b }
}
/* L'original sur blanc (comme l'entrée du modèle), un multiple de 4, et le
   même réduit ×4 puis passé en JPEG. */
async function preparer(nom) {
  const o = await pixels('/_essais/ultra/' + nom)
  const L = Math.floor(o.largeur / 4) * 4, H = Math.floor(o.hauteur / 4) * 4
  const c = new OffscreenCanvas(L, H), x = c.getContext('2d')
  x.fillStyle = '#fff'; x.fillRect(0, 0, L, H); x.drawImage(o.bitmap, 0, 0)
  const vrai = x.getImageData(0, 0, L, H).data
  const p = new OffscreenCanvas(L / 4, H / 4), px = p.getContext('2d')
  px.imageSmoothingQuality = 'high'
  px.drawImage(c, 0, 0, L / 4, H / 4)
  const jpeg = await createImageBitmap(await p.convertToBlob({ type: 'image/jpeg', quality: 0.75 }))
  const q = new OffscreenCanvas(L / 4, H / 4), qx = q.getContext('2d')
  qx.drawImage(jpeg, 0, 0)
  return { vrai, L, H, petit: { data: qx.getImageData(0, 0, L / 4, H / 4).data, largeur: L / 4, hauteur: H / 4 } }
}
/* Les bords de l'original : là où il change de plus de 24 niveaux sur deux
   pixels, élargis de deux. */
function bords(v, L, H) {
  const b = new Uint8Array(L * H)
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < L - 2; x++) {
    const i = (y * L + x) * 4
    let e = 0
    for (let c = 0; c < 3; c++) e = Math.max(e, Math.abs(v[i + c - 8] - v[i + c + 8]), Math.abs(v[i + c - 8 * L] - v[i + c + 8 * L]))
    if (e > 24) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) b[(y + dy) * L + x + dx] = 1
  }
  return b
}
function psnr(a, b, masque) {
  let s = 0, n = 0
  for (let p = 0; p < masque.length; p++) {
    if (masque && !masque[p]) continue
    for (let c = 0; c < 3; c++) { const d = a[p * 4 + c] - b[p * 4 + c]; s += d * d }
    n += 3
  }
  return 10 * Math.log10(255 * 255 / (s / n))
}

export async function banc({ configs = [['fp32', 192], ['fp16', 192], ['fp32', 384], ['fp16', 384]], logos = LOGOS } = {}) {
  const ort = await import('/vendor/ort.webgpu.min.mjs')
  ort.env.logLevel = 'error'
  const sessions = {}
  const session = async k => sessions[k] = sessions[k] || ort.InferenceSession.create(new Uint8Array(await (await fetch(k === 'fp16' ? '/vendor/realesr-general-x4v3-fp16.onnx' : '/vendor/realesr-general-x4v3.onnx')).arrayBuffer()), { executionProviders: ['webgpu'], graphOptimizationLevel: 'all' })
  const res = []
  for (const nom of logos) {
    const { vrai, L, H, petit } = await preparer(nom)
    const tout = new Uint8Array(L * H).fill(1), bord = bords(vrai, L, H)
    const ligne = { nom: nom.slice(0, 16), taille: petit.largeur + 'x' + petit.hauteur }
    let ref = null
    for (const [prec, tuile] of configs) {
      const s = await session(prec)
      const calculer = async (e, l, h) => {
        const o = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', e, [1, 3, h, l]) })
        const t = o[s.outputNames[0]]; const d = await t.getData(); if (t.dispose) t.dispose(); return d
      }
      const t0 = performance.now()
      const r = await nettoyerParTuiles(petit.data, petit.largeur, petit.hauteur, enOrientations(calculer, ORIENTATIONS), () => {}, { tuile })
      const ms = Math.round(performance.now() - t0)
      if (!ref) ref = r.data
      ligne[prec + '/' + tuile] = { ms, tout: +psnr(r.data, vrai, tout).toFixed(2), bords: +psnr(r.data, vrai, bord).toFixed(2), contreRef: +psnr(r.data, ref, tout).toFixed(1) }
    }
    res.push(ligne)
  }
  return res
}

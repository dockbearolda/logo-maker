/* LE BANC DES MODÈLES (12 octobre 2026, le modèle OLDA) : plusieurs
   modèles ×4 (leur URL), chacun en un passage et en huit orientations
   (l'Ultra), sur les six logos du banc de l'Ultra (`_essais/ultra/`,
   réduits ×4, JPEG 75), PSNR partout et sur les bords, temps — et des
   ensembles (deux modèles, quatre orientations chacun). Dans la page du
   studio (Chrome sans fenêtre, WebGPU ; le banc écrit chaque ligne dans la
   console) :
     await (await import('/outils/banc-modeles.mjs')).banc({ modeles: { general: '/vendor/realesr-general-x4v3.onnx', olda: '/_essais/modeles/olda.onnx' }, ensembles: { deux: ['general', 'olda'] } })
   Juger un changement de modèle avant de le faire (CLAUDE.md) : un
   modèle entre s'il gagne sur les bords sans perdre sur un seul logo. */
import { nettoyerParTuiles, enOrientations, ORIENTATIONS } from '/lib/nettoyage.js'

const LOGOS = ['1600w-A_O_h0NnARE.png', 'Logo_SSV__6_-1920w.png', 'LOGO_DIB_CHATGPT.png', 'unnamed-2.png', 'CD447BBB-87EF-40CD-AF45-1B8C23149BB5.png', '10_sans_ar.png']

async function pixels(url) {
  const b = await createImageBitmap(await (await fetch(url)).blob())
  const c = new OffscreenCanvas(b.width, b.height), x = c.getContext('2d')
  x.drawImage(b, 0, 0)
  return { data: x.getImageData(0, 0, b.width, b.height).data, largeur: b.width, hauteur: b.height, bitmap: b }
}
async function preparer(nom, qualite = 0.75) {
  const o = await pixels('/_essais/ultra/' + nom)
  const L = Math.floor(o.largeur / 4) * 4, H = Math.floor(o.hauteur / 4) * 4
  const c = new OffscreenCanvas(L, H), x = c.getContext('2d')
  x.fillStyle = '#fff'; x.fillRect(0, 0, L, H); x.drawImage(o.bitmap, 0, 0)
  const vrai = x.getImageData(0, 0, L, H).data
  const p = new OffscreenCanvas(L / 4, H / 4), px = p.getContext('2d')
  px.imageSmoothingQuality = 'high'
  px.drawImage(c, 0, 0, L / 4, H / 4)
  const jpeg = await createImageBitmap(await p.convertToBlob({ type: 'image/jpeg', quality: qualite }))
  const q = new OffscreenCanvas(L / 4, H / 4), qx = q.getContext('2d')
  qx.drawImage(jpeg, 0, 0)
  return { vrai, L, H, petit: { data: qx.getImageData(0, 0, L / 4, H / 4).data, largeur: L / 4, hauteur: H / 4 } }
}
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

/* `modeles` : { nom: url }. `ultra` : aussi en huit orientations.
   `ensembles` : { nom: [nomA, nomB] } — l'Ultra à deux modèles, une
   orientation sur deux à chacun (quatre et quatre), les dessins moyennés. */
/* `passes` : les nombres d'orientations à essayer pour chaque modèle (1 :
   un passage ; 4, 8 : l'Ultra à quatre ou huit orientations). */
export async function banc({ modeles, logos = LOGOS, ultra = true, qualite = 0.75, tuile = 384, ensembles = {}, passes = null } = {}) {
  const ort = await import('/vendor/ort.webgpu.min.mjs')
  ort.env.logLevel = 'error'
  const sessions = {}
  const session = async k => sessions[k] = sessions[k] || ort.InferenceSession.create(new Uint8Array(await (await fetch(modeles[k])).arrayBuffer()), { executionProviders: ['webgpu'], graphOptimizationLevel: 'all' })
  const res = []
  for (const nom of logos) {
    const { vrai, L, H, petit } = await preparer(nom, qualite)
    const tout = new Uint8Array(L * H).fill(1), bord = bords(vrai, L, H)
    const ligne = { nom: nom.slice(0, 16), taille: petit.largeur + 'x' + petit.hauteur }
    const calculDe = async k => {
      const s = await session(k)
      return async (e, l, h) => {
        const o = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', e, [1, 3, h, l]) })
        const t = o[s.outputNames[0]]; const d = await t.getData(); if (t.dispose) t.dispose(); return d
      }
    }
    for (const [nomE, [ka, kb]] of Object.entries(ensembles)) {
      const ca = await calculDe(ka), cb = await calculDe(kb)
      let j = 0
      const calculer = (e, l, h) => (j++ % 2 ? cb : ca)(e, l, h)
      const t0 = performance.now()
      let r
      try { r = await nettoyerParTuiles(petit.data, petit.largeur, petit.hauteur, enOrientations(calculer, ORIENTATIONS), () => {}, { tuile }) } catch (e) { ligne[nomE] = { erreur: e.message }; continue }
      ligne[nomE + '/ultra'] = { ms: Math.round(performance.now() - t0), tout: +psnr(r.data, vrai, tout).toFixed(2), bords: +psnr(r.data, vrai, bord).toFixed(2) }
      console.log('banc', nom, nomE + '/ultra', JSON.stringify(ligne[nomE + '/ultra']))
    }
    for (const k of Object.keys(modeles)) {
      const calculer = await calculDe(k)
      const essais = passes ? passes.map(n => [n === 1 ? '' : '/' + n, ORIENTATIONS.slice(0, n)]) : ultra ? [['', [0]], ['/ultra', ORIENTATIONS]] : [['', [0]]]
      for (const [suffixe, orientations] of essais) {
        const t0 = performance.now()
        let r
        try {
          r = await nettoyerParTuiles(petit.data, petit.largeur, petit.hauteur, enOrientations(calculer, orientations), () => {}, { tuile })
        } catch (e) { ligne[k + suffixe] = { erreur: e.message }; continue }
        const ms = Math.round(performance.now() - t0)
        ligne[k + suffixe] = { ms, tout: +psnr(r.data, vrai, tout).toFixed(2), bords: +psnr(r.data, vrai, bord).toFixed(2) }
        console.log('banc', nom, k + suffixe, JSON.stringify(ligne[k + suffixe]))
      }
    }
    res.push(ligne)
  }
  for (const s of Object.values(sessions)) (await s).release()
  return res
}

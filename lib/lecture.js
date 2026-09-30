/* ================================================================ LA LECTURE
   Le texte d'un logo, lu sur le poste (lib/polices.js s'en sert pour
   retrouver sa police). Tesseract (vendor/tesseract/, Apache-2.0), en
   français et en anglais, ne se charge qu'au premier logo qui a du texte —
   un logo sans lettres n'en tire pas un octet — et reste prêt ensuite.
   Chaque ligne arrive seule, déjà découpée et remise à 40 pixels de haut
   (`imageLigne`) : lue comme une seule ligne, un texte espacé
   (« L A  P I S C I N E ») ne se casse pas en lettres éparses. */
const VENDOR = new URL('../vendor/tesseract/', import.meta.url)

let lecteur = null
function charger() {
  lecteur = lecteur || (async () => {
    const mod = await import(new URL('tesseract.esm.min.js', VENDOR).href)
    const { createWorker } = mod.default || mod
    const w = await createWorker(['fra', 'eng'], 1, {
      workerPath: new URL('worker.min.js', VENDOR).href,
      corePath: VENDOR.href,
      langPath: VENDOR.href.replace(/\/$/, ''),
      gzip: true,
      workerBlobURL: false,
      cacheMethod: 'none',
    })
    await w.setParameters({ tessedit_pageseg_mode: '7', user_defined_dpi: '300' })
    return w
  })().catch(e => { lecteur = null; throw e })
  return lecteur
}

/* UNE IMAGE DE LIGNE (niveaux de gris, `l` × `h`) EN PNG : Tesseract lit
   les fichiers d'image. */
function enImage({ data, l, h }) {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(l, h) : Object.assign(document.createElement('canvas'), { width: l, height: h })
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(l, h)
  for (let p = 0; p < l * h; p++) { const v = data[p]; img.data.set([v, v, v, 255], p * 4) }
  ctx.putImageData(img, 0, 0)
  return c.convertToBlob ? c.convertToBlob({ type: 'image/png' }) : new Promise(ok => c.toBlob(ok, 'image/png'))
}

/* LES LIGNES LUES : pour chacune, { texte, confiance, mot } — la
   confiance de la ligne et celle de son mot le moins sûr (0 à 100) : un
   seul mot mal lu (« 1x » pour « aux »), et la ligne ne se retape pas. */
export async function lireLignes(images) {
  const w = await charger()
  const sortie = []
  for (const im of images) {
    try {
      const r = await w.recognize(await enImage(im), {}, { text: true, blocks: true })
      sortie.push({ texte: String(r.data.text || '').trim(), confiance: r.data.confidence || 0, mot: motMoinsSur(r.data) })
    } catch {
      sortie.push({ texte: '', confiance: 0, mot: 0 })
    }
  }
  return sortie
}

/* UNE ÉCRITURE PENCHÉE, relue redressée (lib/ecriture.js) : l'OCR lit
   mieux un script droit. Pour chaque ligne, ses lectures sous deux
   inclinaisons — [{ texte, confiance }]. */
export const PENTES = [0.25, 0.45]
export async function lireEcritures(images) {
  const w = await charger()
  const sortie = []
  for (const im of images) {
    const lues = []
    for (const s of PENTES) {
      try {
        const r = await w.recognize(await enImage(pencher(im, s)), {}, { text: true })
        lues.push({ texte: String(r.data.text || '').trim(), confiance: r.data.confidence || 0 })
      } catch {}
    }
    sortie.push(lues)
  }
  return sortie
}

/* L'image d'une ligne cisaillée : chaque rangée glissée de s·(y − h/2)
   vers la droite — le haut des lettres ramené vers la gauche, une écriture
   penchée à droite redressée. */
export function pencher({ data, l, h }, s) {
  const marge = Math.ceil(Math.abs(s) * h / 2) + 2, L = l + 2 * marge
  const sortie = new Uint8Array(L * h).fill(255)
  for (let y = 0; y < h; y++) {
    const d = s * (y - h / 2)
    for (let x = 0; x < L; x++) {
      const xs = x - marge - d, x0 = Math.floor(xs), f = xs - x0
      const a = x0 >= 0 && x0 < l ? data[y * l + x0] : 255, b = x0 + 1 >= 0 && x0 + 1 < l ? data[y * l + x0 + 1] : 255
      sortie[y * L + x] = Math.round(a * (1 - f) + b * f)
    }
  }
  return { data: sortie, l: L, h }
}

/* Le mot le moins sûr d'une lecture (la ponctuation seule ne compte pas). */
export function motMoinsSur(data) {
  let m = 100
  for (const b of data.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) for (const w of l.words || []) {
    if (/[\p{L}\p{N}]/u.test(w.text || '')) m = Math.min(m, w.confidence || 0)
  }
  return m
}

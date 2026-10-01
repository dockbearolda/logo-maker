/* ================================================================== LE LOGO
   UN LOGO CLIENT ARRIVE COMME IL ARRIVE : PDF vectoriel sorti d'Illustrator,
   PNG détouré, JPEG de messagerie, SVG, photo d'iPhone (HEIC), scan (TIFF),
   GIF, WebP, AVIF… TOUT SE DÉPOSE. Le format se lit dans les octets, jamais
   dans le nom — un logo passé par WhatsApp ou un courriel perd souvent le
   sien, ou en porte un faux.
   Chaque fichier ressort en canevas pour le studio :
   - un SVG se rend à 2 400 px de grand côté, comme un PDF : à sa taille
     « naturelle », il n'en avait que 120 à 300 (1er octobre 2026) ;
   - un PDF (et un .ai, qui en est un) se rend à 2 400 px sur fond
     transparent — un logo de 8 cm y gagne plus de 700 points par pouce ;
     un PDF qui n'est qu'une image (un JPEG « enregistré en PDF ») se lit
     à la taille de son image, pixel pour pixel (`imageSeule`) ;
   - le reste se décode tel quel.
   Les décodeurs lourds (pdf.js, libheif, UTIF) sont dans `vendor/` et ne se
   chargent qu'au premier fichier qui en a besoin : un PNG n'en tire pas un
   octet. */
export const COTE_MAX = 2400
/* Un PDF qui n'est qu'une image se lit à sa taille, jusqu'à celle-ci (le
   Logo maker travaille jusqu'à 5 000 px). */
export const IMAGE_PDF_MAX = 5000

/* LES DEUX FORMATS QU'ON NE SAIT PAS LIRE ICI. Plutôt que « format non
   reconnu » devant un fichier que le client sait valide, on dit quoi faire. */
export const IMPASSES = {
  eps: 'Fichier EPS : dans Illustrator, « Enregistrer sous » en PDF — le logo restera vectoriel.',
  psd: 'Fichier Photoshop : « Enregistrer sous » en PNG, fond transparent.',
}

const commence = (u8, octets) => octets.every((b, i) => u8[i] === b)
const ascii = (u8, de, a) => String.fromCharCode(...u8.subarray(de, a))

/* LE FORMAT, LU DANS LES PREMIERS OCTETS. Rend null quand rien ne ressemble
   à un format connu — le navigateur tentera quand même sa chance. */
export function formatDe(octets) {
  const u8 = octets instanceof Uint8Array ? octets : new Uint8Array(octets)
  if (u8.length < 4) return null
  if (commence(u8, [0x25, 0x50, 0x44, 0x46])) return 'pdf'
  if (commence(u8, [0x89, 0x50, 0x4e, 0x47])) return 'png'
  if (commence(u8, [0xff, 0xd8, 0xff])) return 'jpg'
  if (ascii(u8, 0, 4) === 'GIF8') return 'gif'
  if (commence(u8, [0x38, 0x42, 0x50, 0x53])) return 'psd'
  if (ascii(u8, 0, 4) === '%!PS' || commence(u8, [0xc5, 0xd0, 0xd3, 0xc6])) return 'eps'
  if (commence(u8, [0x49, 0x49, 0x2a, 0x00]) || commence(u8, [0x4d, 0x4d, 0x00, 0x2a])) return 'tif'
  if (u8.length >= 12 && ascii(u8, 0, 4) === 'RIFF' && ascii(u8, 8, 12) === 'WEBP') return 'webp'
  if (u8.length >= 12 && ascii(u8, 4, 8) === 'ftyp') {
    /* Même boîte pour AVIF et HEIC : la marque tranche. */
    const marque = ascii(u8, 8, 12)
    if (/avif|avis/.test(marque)) return 'avif'
    if (/heic|heix|hevc|hevx|heim|heis|hevm|hevs|mif1|msf1/.test(marque)) return 'heic'
  }
  if (commence(u8, [0x42, 0x4d])) return 'bmp'
  /* SVG : pas de nombre magique, on cherche la balise dans l'en-tête. */
  if (/<svg[\s>]/i.test(ascii(u8, 0, Math.min(u8.length, 2048)))) return 'svg'
  return null
}

/* Le nom ne sert qu'en dernier recours, quand les octets ne disent rien. */
const PAR_EXTENSION = { svg: 'svg', heic: 'heic', heif: 'heic', tif: 'tif', tiff: 'tif', ai: 'pdf', pdf: 'pdf', eps: 'eps' }
export const formatParNom = nom => PAR_EXTENSION[String(nom || '').split('.').pop().toLowerCase()] || null

/* LE CADRE UTILE : le plus petit rectangle qui contient un pixel visible.
   `data` est le RGBA d'un canevas ; rend null si tout est transparent. */
export function cadreUtile(data, largeur, hauteur, seuil = 8) {
  let x0 = largeur
  let y0 = hauteur
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < hauteur; y++) {
    const ligne = y * largeur * 4
    for (let x = 0; x < largeur; x++) {
      if (data[ligne + x * 4 + 3] > seuil) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, largeur: x1 - x0 + 1, hauteur: y1 - y0 + 1 }
}

/* ------------------------------------------------------------ LE NAVIGATEUR */

const ILLISIBLE = 'Ce fichier ne se lit pas comme un logo. Demande-le au client en PDF ou en PNG.'
const TYPES_NATIFS = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp', avif: 'image/avif' }
const vendor = fichier => new URL('../vendor/' + fichier, import.meta.url).href

function canevas(largeur, hauteur) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(largeur))
  c.height = Math.max(1, Math.round(hauteur))
  return c
}

/* pdf.js : la promesse est gardée — deux PDF déposés d'affilée ne le
   chargent qu'une fois ; un échec réseau peut se rejouer. */
let pdfjs = null
function chargerPdfjs() {
  pdfjs = pdfjs || import(vendor('pdf.min.mjs')).then(mod => {
    const lib = mod && mod.getDocument ? mod : globalThis.pdfjsLib
    if (!lib) throw new Error('Lecteur PDF indisponible.')
    lib.GlobalWorkerOptions.workerSrc = vendor('pdf.worker.min.mjs')
    return lib
  }).catch(e => { pdfjs = null; throw e })
  return pdfjs
}

/* UN PDF SE REND EN DEUX PASSES. Un logo de 5 cm posé au milieu d'une
   planche A4, rendu page entière à 2 400 px, ne garde que 450 px une fois
   rogné — trop peu pour l'impression. La première passe, petite, trouve où
   est le dessin ; la seconde ne rend QUE ce cadre, à 2 400 px sur son grand
   côté. Le canevas reste de la taille du logo, jamais de celle de la page. */
const PASSE_REPERE = 600

/* UN PDF QUI N'EST QU'UNE IMAGE (29 septembre 2026, un logo de 1 254 px
   sorti d'ImageMagick : rendu à 2 400 px, il était agrandi — flou — et
   « Améliorer l'image » partait de ce flou). La liste des opérations de la
   page (pdf.js) le dit : une seule image, droite, et rien d'autre de
   dessiné — ni trait, ni aplat, ni texte. Rend sa taille en pixels et son
   rectangle sur la page (en points PDF), ou null. `OPS` : les codes des
   opérations de pdf.js. */
const composer = (m, c) => [m[0] * c[0] + m[1] * c[2], m[0] * c[1] + m[1] * c[3], m[2] * c[0] + m[3] * c[2], m[2] * c[1] + m[3] * c[3], m[4] * c[0] + m[5] * c[2] + c[4], m[4] * c[1] + m[5] * c[3] + c[5]]
const DESSINS = ['stroke', 'closeStroke', 'fill', 'eoFill', 'fillStroke', 'eoFillStroke', 'closeFillStroke', 'closeEOFillStroke', 'shadingFill',
  'showText', 'showSpacedText', 'nextLineShowText', 'nextLineSetSpacingShowText', 'paintImageMaskXObject', 'paintImageMaskXObjectGroup',
  'paintSolidColorImageMask', 'paintImageMaskXObjectRepeat', 'paintImageXObjectRepeat', 'paintInlineImageXObjectGroup']
export function imageSeule(fns, args, OPS) {
  const dessins = new Set(DESSINS.map(n => OPS[n]).filter(v => v !== undefined))
  const IDENTITE = [1, 0, 0, 1, 0, 0]
  let ctm = IDENTITE
  const pile = []
  let image = null
  for (let i = 0; i < fns.length; i++) {
    const f = fns[i], a = args[i] || []
    if (f === OPS.save) pile.push(ctm)
    else if (f === OPS.restore) ctm = pile.pop() || IDENTITE
    else if (f === OPS.transform) ctm = composer(a, ctm)
    else if (f === OPS.paintFormXObjectBegin) { pile.push(ctm); if (Array.isArray(a[0]) && a[0].length === 6) ctm = composer(a[0], ctm) }
    else if (f === OPS.paintFormXObjectEnd) ctm = pile.pop() || IDENTITE
    else if (dessins.has(f)) return null
    else if (f === OPS.paintImageXObject || f === OPS.paintInlineImageXObject) {
      if (image) return null
      const l = f === OPS.paintImageXObject ? a[1] : a[0] && a[0].width
      const h = f === OPS.paintImageXObject ? a[2] : a[0] && a[0].height
      /* Tournée ou penchée : elle se rend comme un PDF ordinaire. */
      if (!(l > 0 && h > 0) || Math.abs(ctm[1]) > 1e-6 || Math.abs(ctm[2]) > 1e-6 || !ctm[0] || !ctm[3]) return null
      image = { largeur: l, hauteur: h, rect: [ctm[4], ctm[5], ctm[4] + ctm[0], ctm[5] + ctm[3]] }
    }
  }
  return image
}

async function rendrePdf(u8) {
  const lib = await chargerPdfjs()
  const tache = lib.getDocument({ data: u8.slice() })
  try {
    const doc = await tache.promise
    const page = await doc.getPage(1)
    const base = page.getViewport({ scale: 1 })
    /* Fond transparent, et intent « print » : le rendu ne s'arrête pas si
       l'onglet passe derrière pendant la lecture. */
    const rendre = async (vue, largeur, hauteur) => {
      const c = canevas(largeur, hauteur)
      await page.render({ canvasContext: c.getContext('2d'), viewport: vue, background: 'rgba(0,0,0,0)', intent: 'print' }).promise
      return c
    }
    /* Une image seule : sa taille, pixel pour pixel — son rectangle rendu
       au pixel près, sans rien agrandir. */
    const ops = await page.getOperatorList({ intent: 'print' })
    const seule = imageSeule(ops.fnArray, ops.argsArray, lib.OPS)
    if (seule) {
      const [ax, ay] = base.convertToViewportPoint(seule.rect[0], seule.rect[1])
      const [bx, by] = base.convertToViewportPoint(seule.rect[2], seule.rect[3])
      const l = Math.abs(bx - ax), h = Math.abs(by - ay)
      if (l > 0 && h > 0) {
        const echelle = Math.min(Math.max(seule.largeur / l, seule.hauteur / h), IMAGE_PDF_MAX / Math.max(l, h))
        const vue = page.getViewport({ scale: echelle, offsetX: -Math.min(ax, bx) * echelle, offsetY: -Math.min(ay, by) * echelle })
        return await rendre(vue, l * echelle, h * echelle)
      }
    }
    const echelleRepere = PASSE_REPERE / Math.max(base.width, base.height)
    const repere = page.getViewport({ scale: echelleRepere })
    const esquisse = await rendre(repere, repere.width, repere.height)
    const cadre = cadreUtile(esquisse.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, esquisse.width, esquisse.height).data, esquisse.width, esquisse.height)
    if (!cadre) return esquisse
    /* Deux pixels d'esquisse de marge : un filet fin peut y tomber sous le
       seuil. Le rognage final serre au pixel près. */
    const x = Math.max(0, cadre.x - 2) / echelleRepere
    const y = Math.max(0, cadre.y - 2) / echelleRepere
    const l = Math.min(esquisse.width, cadre.x + cadre.largeur + 2) / echelleRepere - x
    const h = Math.min(esquisse.height, cadre.y + cadre.hauteur + 2) / echelleRepere - y
    const echelle = COTE_MAX / Math.max(l, h)
    const vue = page.getViewport({ scale: echelle, offsetX: -x * echelle, offsetY: -y * echelle })
    return await rendre(vue, l * echelle, h * echelle)
  } finally {
    await tache.destroy()
  }
}

let heif = null
async function decoderHeic(u8) {
  heif = heif || import(vendor('libheif-bundle.mjs')).then(async mod => {
    const fait = (mod.default || mod)()
    return fait && typeof fait.then === 'function' ? await fait : fait
  }).catch(e => { heif = null; throw e })
  const lib = await heif
  const images = new lib.HeifDecoder().decode(u8)
  if (!images || !images.length) throw new Error(ILLISIBLE)
  const image = images[0]
  const donnees = new ImageData(image.get_width(), image.get_height())
  await new Promise((ok, ko) => image.display(donnees, sortie => (sortie ? ok() : ko(new Error(ILLISIBLE)))))
  images.forEach(im => im.free && im.free())
  const c = canevas(donnees.width, donnees.height)
  c.getContext('2d').putImageData(donnees, 0, 0)
  return c
}

let utif = null
async function decoderTiff(u8) {
  utif = utif || (async () => {
    /* UTIF est un script classique qui lit `pako` sur l'objet global au
       moment où il s'évalue : pako d'abord. */
    if (!globalThis.pako) {
      const p = await import(vendor('pako.mjs'))
      globalThis.pako = p.default || p
    }
    await import(vendor('UTIF.js'))
    if (!globalThis.UTIF) throw new Error('Lecteur TIFF indisponible.')
    return globalThis.UTIF
  })().catch(e => { utif = null; throw e })
  const UTIF = await utif
  const pages = UTIF.decode(u8)
  if (!pages || !pages.length) throw new Error(ILLISIBLE)
  /* Un TIFF porte souvent une vignette : la plus grande page est l'image. */
  const page = pages.reduce((a, b) => ((b.width || 0) * (b.height || 0) > (a.width || 0) * (a.height || 0) ? b : a))
  UTIF.decodeImage(u8, page, pages)
  const rgba = UTIF.toRGBA8(page)
  const c = canevas(page.width, page.height)
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.length), page.width, page.height), 0, 0)
  return c
}

/* LE NAVIGATEUR LIT LE RESTE — et tente sa chance sur ce qu'on n'a pas
   reconnu : une balise <img> renifle le contenu, elle rattrape les fichiers
   mal nommés. `cote` : le grand côté voulu (un SVG, qui se dessine à toute
   taille), sinon la taille du fichier. */
async function decoderImage(u8, type, cote = 0) {
  const url = URL.createObjectURL(new Blob([u8], type ? { type } : {}))
  try {
    const img = new Image()
    await new Promise((ok, ko) => { img.onload = ok; img.onerror = () => ko(new Error(ILLISIBLE)); img.src = url })
    if (!img.naturalWidth || !img.naturalHeight) throw new Error(ILLISIBLE)
    const k = cote ? cote / Math.max(img.naturalWidth, img.naturalHeight) : 1
    const c = canevas(img.naturalWidth * k, img.naturalHeight * k)
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    return c
  } finally {
    URL.revokeObjectURL(url)
  }
}

/* UN LOGO SVG EST UN DOCUMENT, PAS UNE IMAGE. Il arrive souvent du client
   (WhatsApp, mail) : un <script> ou un « onload » dedans ne fait rien dans
   une balise <img>, mais s'exécute dès que l'adresse `blob:` s'ouvre dans un
   onglet. On n'en garde que le dessin : ni script, ni objet étranger, ni
   gestionnaire, ni lien `javascript:`. Sans largeur ni hauteur (un viewBox
   seul, ou « 100 % »), le navigateur le lirait à 300 × 150 : il prend
   celles de son viewBox, à `COTE_MAX` de grand côté — à sa taille, un
   viewBox de « 12.4 3.3 » se lisait arrondi à 12 × 3, étiré. */
export function svgSain(texte) {
  if (typeof DOMParser === 'undefined') return texte
  const doc = new DOMParser().parseFromString(String(texte), 'image/svg+xml')
  if (doc.getElementsByTagName('parsererror').length) return texte
  doc.querySelectorAll('script, foreignObject, iframe, embed, object, handler, listener').forEach(n => n.remove())
  doc.querySelectorAll('*').forEach(n => {
    Array.from(n.attributes).forEach(a => {
      const nom = a.name.toLowerCase()
      const valeur = a.value.replace(/[\s\u0000-\u001f]/g, '').toLowerCase()
      if (nom.startsWith('on')) n.removeAttribute(a.name)
      else if (/(^|:)href$/.test(nom) && /^(javascript|vbscript|data:text\/html)/.test(valeur)) n.removeAttribute(a.name)
    })
  })
  const svg = doc.documentElement
  const vb = String(svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number)
  const fixe = nom => { const v = svg.getAttribute(nom); return !!v && !/%\s*$/.test(v) && parseFloat(v) > 0 }
  if (vb.length === 4 && vb[2] > 0 && vb[3] > 0 && !fixe('width') && !fixe('height')) {
    const k = COTE_MAX / Math.max(vb[2], vb[3])
    svg.setAttribute('width', String(Math.round(vb[2] * k * 1000) / 1000))
    svg.setAttribute('height', String(Math.round(vb[3] * k * 1000) / 1000))
  }
  return new XMLSerializer().serializeToString(doc)
}

function decoder(u8, format) {
  if (format === 'pdf') return rendrePdf(u8)
  if (format === 'heic') return decoderHeic(u8)
  if (format === 'tif') return decoderTiff(u8)
  if (format === 'svg') return decoderImage(new TextEncoder().encode(svgSain(new TextDecoder().decode(u8))), 'image/svg+xml', COTE_MAX)
  return decoderImage(u8, TYPES_NATIFS[format])
}

/* LIRE UN FICHIER EN CANEVAS, tel qu'il est — ni rogné ni réduit : le
   détourage (lib/detourage.js) travaille sur les pixels d'origine. */
export async function lireCanevas(fichier) {
  const u8 = new Uint8Array(await fichier.arrayBuffer())
  const format = formatDe(u8) || formatParNom(fichier.name)
  if (IMPASSES[format]) throw new Error(IMPASSES[format])
  return decoder(u8, format)
}

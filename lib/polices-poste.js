/* ===================================================== LES POLICES DU POSTE
   1er octobre 2026, Charlie : « le meilleur détecteur de police au
   monde ». La réserve de Google Fonts (vendor/polices/, 1 906 familles)
   ne connaît aucune police commerciale — Helvetica, Futura, Avenir, Gill
   Sans, Century Gothic, Cooper Black, Brush Script… —, celles des logos
   faits dans Word, Canva ou Illustrator. Le poste les a souvent : Chrome
   les prête à la page (`queryLocalFonts`, sur un clic, avec la permission
   du poste), chaque face en fichier à part. On peut aussi en déposer
   (TTF, OTF, WOFF, une collection TTC).

   Ici, une police lue (opentype.js) devient une entrée de l'index, avec
   les mesures de vendor/polices/index.json — ses lettres se reconnaissent
   alors comme celles de Google, par lib/polices.js, `choisirPolices` :
   - `decrireFace` : une face — sa famille, son style, sa graisse, les
     cadres d'encre de ses caractères, sa capitale, l'épaisseur de son
     trait (`e`) ; une écriture (panose « manuscrite », ou son nom),
     l'avance de ses lettres, son espace, son inclinaison
     (lib/ecriture.js) ;
   - `famillesPoste` : les faces d'une même famille réunies, comme
     `famillesDe` les rend — les cadres de la graisse la plus proche du
     Regular, la chasse de chaque graisse (`w`) ; chaque fichier garde sa
     face (`local`), deux faces de même graisse restant deux fichiers.
   Pur : ni page, ni fil. */
import { graissePolice, CARACTERES } from './polices.js'
import { penteDe } from './ecriture.js'

/* Une face sans l'alphabet latin (un symbole, une écriture d'ailleurs)
   ne dit rien d'un logo : il lui faut 40 de ses 52 lettres. */
const LETTRES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const LATINES_MIN = 40

/* LES ÉCRITURES par leur nom, quand leur panose ne le dit pas. */
const SCRIPT = /script|brush|hand(writ)?|signature|calligra|zapfino|snell|savoye|chancery|vivaldi|edwardian|kunstler|mistral|freestyle|corsiva|pristina|bradley|rage italic|palace|vladimir|lucida handwriting|signpainter|marker|chalk|noteworthy|segoe print|ink free|gabriola|pinyon|tangerine|allura|parisienne/i

/* Un nom de la table `name` : celui de Windows, sinon du Mac, en anglais
   d'abord. Selon sa version, opentype.js range les noms par plateforme ou
   à plat. */
function nomDe(police, ...cles) {
  const tables = police.names.windows || police.names.macintosh ? [police.names.windows, police.names.macintosh] : [police.names]
  for (const cle of cles) {
    for (const t of tables) {
      const v = t && t[cle]
      if (v) return String(v.en || Object.values(v)[0] || '').trim()
    }
  }
  return ''
}

/* LES FACES D'UNE COLLECTION (.ttc) : chacune réécrite en police à part
   (ses tables recopiées, leurs positions refaites). Une police seule
   revient telle quelle. */
export function facesTtc(octets) {
  const u = new Uint8Array(octets)
  const v = new DataView(u.buffer, u.byteOffset, u.byteLength)
  if (u.length < 12 || v.getUint32(0) !== 0x74746366) return [u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength)]
  const n = v.getUint32(8)
  const faces = []
  for (let k = 0; k < n; k++) {
    const o = v.getUint32(12 + 4 * k)
    const tables = v.getUint16(o + 4)
    const tete = 12 + 16 * tables
    const enregs = []
    let taille = tete
    for (let t = 0; t < tables; t++) {
      const r = o + 12 + 16 * t
      const longueur = v.getUint32(r + 12)
      enregs.push({ r, de: v.getUint32(r + 8), longueur, a: taille })
      taille += (longueur + 3) & ~3
    }
    const sortie = new Uint8Array(taille)
    const s = new DataView(sortie.buffer)
    sortie.set(u.subarray(o, o + 12), 0)
    for (const [t, e] of enregs.entries()) {
      sortie.set(u.subarray(e.r, e.r + 8), 12 + 16 * t)
      s.setUint32(12 + 16 * t + 8, e.a)
      s.setUint32(12 + 16 * t + 12, e.longueur)
      sortie.set(u.subarray(e.de, e.de + e.longueur), e.a)
    }
    faces.push(sortie.buffer)
  }
  return faces
}

/* LA FACE `postscript` dans des octets : Chrome rend parfois, pour une
   face d'une collection (Didot, Cochin, PT Sans sur un Mac), la
   collection entière. `parse` : celui d'opentype.js. Rend la police lue. */
export function lireFace(octets, postscript, parse) {
  const faces = facesTtc(octets)
  if (faces.length === 1) return parse(faces[0])
  let premiere = null
  for (const o of faces) {
    const police = parse(o)
    premiere = premiere || police
    if (!postscript || nomDe(police, 'postScriptName') === postscript) return police
  }
  return premiere
}

/* LA VERSION DES MESURES : changer `decrireFace` la monte — les mesures
   gardées sur le poste (lib/coffre.js) se refont. */
export const MESURE = 2

/* UNE FACE, mesurée comme l'index mesure celles de Google. `meta` : ce que
   le poste en dit (`cle`, sa clé — le nom PostScript —, `famille`,
   `style`). null : pas une police de texte latin. */
export function decrireFace(police, meta = {}) {
  let latines = 0
  for (const c of LETTRES) {
    const g = police.charToGlyph(c)
    if (g && g.index) latines++
  }
  if (latines < LATINES_MIN) return null
  const famille = meta.famille || nomDe(police, 'typographicFamily', 'preferredFamily', 'fontFamily')
  /* Les polices cachées du système (« .SF NS ») ne s'offrent pas. */
  if (!famille || famille.startsWith('.') || /^LastResort/i.test(famille)) return null
  const sous = meta.style || nomDe(police, 'typographicSubfamily', 'preferredSubfamily', 'fontSubfamily') || 'Regular'
  /* UNE CHASSE À PART (« Futura Condensed Medium ») fait sa famille, comme
     chez Google (Roboto Condensed) : le tri de l'index, qui ne prend
     qu'une graisse par famille, y retrouve ses lettres étroites. */
  const chasse = (sous.match(/\b((?:ultra|extra|semi)\s*)?(condensed|narrow|compressed|extended|expanded|wide)\b/i) || [''])[0]
  const os2 = police.tables.os2 || {}
  let graisse = os2.usWeightClass || 400
  if (graisse < 10) graisse *= 100
  graisse = Math.max(100, Math.min(900, Math.round(graisse / 100) * 100))
  const italique = !!(os2.fsSelection & 1) || /italic|oblique|kursiv|cursiva/i.test(sous)
  const boites = []
  for (const c of CARACTERES) {
    const g = police.charToGlyph(c)
    const b = g && g.index ? g.getBoundingBox() : null
    if (b && b.y2 > b.y1) boites.push(Math.round(b.x1), Math.round(b.y1), Math.round(b.x2), Math.round(b.y2))
    else boites.push(null, null, null, null)
  }
  const { e, cap } = graissePolice(police)
  const d = { cle: meta.cle || nomDe(police, 'postScriptName') || famille + ' ' + sous, famille: chasse && !famille.toLowerCase().includes(chasse.toLowerCase()) ? famille + ' ' + chasse : famille, sousFamille: sous, style: italique ? 'italic' : 'normal', graisse, upm: police.unitsPerEm, cap: Math.round(cap), e: Math.round(e * 10000) / 10000, boites }
  /* UNE ÉCRITURE : ses lettres liées se reconnaissent sur la ligne entière
     (lib/ecriture.js) — il lui faut l'avance de ses lettres, son espace,
     son inclinaison. */
  if ((os2.panose && os2.panose[0] === 3) || SCRIPT.test(famille)) {
    d.av = [...CARACTERES].map(c => {
      const g = police.charToGlyph(c)
      return g && g.index ? Math.round(g.advanceWidth) : null
    })
    const espace = police.charToGlyph(' ')
    d.esp = Math.round(espace && espace.advanceWidth ? espace.advanceWidth : police.unitsPerEm / 4)
    d.pente = Math.round(penteDe(police) * 1000) / 1000
  }
  return d
}

/* « Gill Sans » → « gill-sans ». */
export const slug = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'police'

/* LES FAMILLES de faces décrites (`decrireFace`), de la forme que rend
   `famillesDe` (lib/polices.js). `source` : 'poste' (installées) ou
   'ajout' (déposées) — le début de leur `id`, pour qu'aucune ne se prenne
   pour une famille de Google. */
export function famillesPoste(faces, source = 'poste') {
  const pos = new Map([...CARACTERES].map((c, i) => [c, i]))
  /* Les cadres d'encre d'une face, caractère par caractère, en unités. */
  const boiteDe = d => c => {
    const i = pos.get(c)
    if (i === undefined || d.boites[4 * i] === null) return null
    return { x1: d.boites[4 * i], y1: d.boites[4 * i + 1], x2: d.boites[4 * i + 2], y2: d.boites[4 * i + 3] }
  }
  const groupes = new Map()
  for (const d of faces) {
    if (!d) continue
    const k = d.famille.toLowerCase() + '|' + d.style
    if (!groupes.has(k)) groupes.set(k, [])
    /* La même face deux fois (installée pour l'utilisateur et pour tous) :
       une seule. */
    if (!groupes.get(k).some(f => f.cle === d.cle)) groupes.get(k).push(d)
  }
  const sortie = []
  for (const groupe of groupes.values()) {
    const ref = groupe.slice().sort((a, b) => Math.abs(a.graisse - 400) - Math.abs(b.graisse - 400) || a.graisse - b.graisse)[0]
    const id = source + '-' + slug(ref.famille)
    const largeur = (d, i) => d.boites[4 * i] === null ? 0 : (d.boites[4 * i + 2] - d.boites[4 * i]) / d.upm
    const fichiers = groupe.map(f => {
      let s = 0, n = 0
      for (const c of LETTRES) {
        const i = pos.get(c), a = largeur(f, i), b = largeur(ref, i)
        if (a > 0 && b > 0) { s += a / b; n++ }
      }
      /* Ses propres cadres : le tri de l'index (lib/polices.js) y lit la
         vraie largeur de chaque lettre dans cette graisse. */
      return { id, nom: ref.famille, style: ref.style, graisse: f.graisse, e: f.e, w: n ? Math.round(s / n * 1000) / 1000 : 1, local: f.cle, styleNom: f.sousFamille, source, boite: boiteDe(f) }
    }).sort((a, b) => a.graisse - b.graisse || (a.styleNom < b.styleNom ? -1 : 1))
    const boite = boiteDe(ref)
    const ecrit = ref.av ? ref : null
    sortie.push({
      cle: id + '|' + ref.style, id, nom: ref.famille, cat: ecrit ? 'handwriting' : source, style: ref.style, cap: ref.cap, boite, fichiers, source,
      avance: ecrit ? c => { const i = pos.get(c); return i === undefined || ecrit.av[i] === null ? null : ecrit.av[i] } : null,
      espace: ecrit ? ecrit.esp : undefined, pente: ecrit ? ecrit.pente : undefined,
    })
  }
  return sortie.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
}

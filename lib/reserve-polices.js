/* ======================================================= LA RÉSERVE DU POSTE
   (1er octobre 2026, lib/polices-poste.js) Côté page : les polices
   installées sur le poste, que Chrome prête sur un clic (`queryLocalFonts`,
   la permission « Polices » du site, gardée ensuite), et celles qu'on
   dépose (TTF, OTF, WOFF, TTC). Leurs mesures se calculent dans le fil
   (`decrire`, qui lit chaque face avec opentype.js) puis se gardent dans
   le coffre (lib/coffre.js) : une face déjà vue ne se relit plus. Les
   octets d'une face ne se lisent qu'au moment où le fil en a besoin
   (`octets`) — toutes ensemble, celles d'un Mac pèsent plus d'un
   gigaoctet (les écritures chinoises, les emoji). */
import * as C from './coffre.js'
import { facesTtc, MESURE } from './polices-poste.js'

/* Ce qui n'est pas du latin (ou pas du texte) ne se lit même pas : les
   écritures d'Asie, les symboles, les emoji, les polices du système. */
export const IGNOREES = /^\.|LastResort|Emoji|PingFang|Heiti|Songti|STSong|STHeiti|Hiragino|AppleGothic|AppleMyungjo|Apple SD Gothic|Apple Symbols|Apple Braille|Arial Unicode|GB18030|Wingdings|Webdings|Dingbats|^Symbol$|Bodoni Ornaments|Hoefler Text Ornaments|Kokonor|Noto (Sans|Serif) (?!Mono)|Sangam|\bMN$|Kohinoor|ITF Devanagari|Devanagari|Gujarati|Gurmukhi|Kannada|Malayalam|Oriya|Tamil|Telugu|Sinhala|Khmer|Lao |Myanmar|Thonburi|Ayuthaya|Krungthep|Silom|Sathu|Sukhumvit|Al Bayan|Al Nile|Al Tarikh|Baghdad|Beirut|Damascus|DecoType|Diwan|Farah|Farisi|Geeza|KufiStandard|Mishafi|Muna|Nadeem|Sana|Waseem|Raanana|New Peninim|Corsiva Hebrew|Arial Hebrew|Mshtakan|Kefa|Euphemia|Plantagenet|InaiMathi|Mukta Mahee|Shree|Galvji|Grantha|Noto Nastaliq|MS Gothic|MS Mincho|MS PGothic|SimSun|SimHei|NSimSun|Microsoft YaHei|Microsoft JhengHei|MingLiU|Malgun|Meiryo|Yu Gothic|Yu Mincho|Gulim|Batang|Dotum|Gungsuh|Segoe UI Emoji|Segoe UI Symbol|Segoe MDL2|Segoe Fluent|HoloLens|Marlett|Leelawadee|Nirmala|Ebrima|Gadugi|Javanese|Mongolian|Myanmar Text|Nyala|Sylfaen|Estrangelo|Iskoola|Kalinga|Raavi|Shruti|Tunga|Vrinda|Kartika|Latha|Mangal|Gautami|Vijaya|Aparajita|Kokila|Utsaah|DaunPenh|MoolBoran|Khmer UI|Lao UI|DokChampa|Euphemia|Mv Boli|Tahoma Bold Hebrew|David|Miriam|Narkisim|Rod|Aharoni|FrankRuehl|Levenim|Gisha|Simplified Arabic|Traditional Arabic|Arabic Typesetting|Sakkal|Urdu Typesetting|Andalus|Aldhabi|BIZ UD|UD Digi|Meiryo UI|HGGothic|HGMincho|HGSeikai|HGSoei|HGMaru|HGGyosho|HGKyokasho|HGPGothic|HGPMincho|HGSGothic|HGSMincho/i

/* Au-delà, une face n'est pas une police de logo (une écriture d'Asie
   cachée sous un nom latin). */
const TAILLE_MAX = 12e6

/* La permission « Polices » de ce site : 'granted', 'prompt', 'denied',
   ou 'absent' (un navigateur sans l'accès aux polices). */
export async function etatPoste() {
  if (typeof window === 'undefined' || !('queryLocalFonts' in window)) return 'absent'
  try { return (await navigator.permissions.query({ name: 'local-fonts' })).state } catch { return 'prompt' }
}

let facesDuPoste = null

/* LES POLICES DU POSTE, mesurées : chaque face pas encore vue est lue et
   décrite par le fil (`decrire(lot)` → les descriptions, null pour une
   face qui n'est pas une police de texte latin), par lots — `progres(part)`
   suit. Rend les descriptions de toutes les faces latines du poste.
   Demande la permission la première fois : à appeler sur un clic. */
export async function lirePoste(decrire, progres = () => {}) {
  const toutes = await window.queryLocalFonts()
  const faces = toutes.filter(f => f.postscriptName && !IGNOREES.test(f.family))
  facesDuPoste = new Map(faces.map(f => [f.postscriptName, f]))
  const memo = await C.tout('faces')
  const cle = f => 'poste|' + MESURE + '|' + f.postscriptName + '|' + f.fullName
  /* Les mesures d'une autre version (`MESURE`) ne servent plus. */
  const vieilles = [...memo.keys()].filter(k => k.startsWith('poste|') && !k.startsWith('poste|' + MESURE + '|'))
  if (vieilles.length) await C.poser('faces', vieilles.map(k => [k, undefined]))
  const neuves = faces.filter(f => !memo.has(cle(f)))
  const LOT = 12
  for (let i = 0; i < neuves.length; i += LOT) {
    const lot = []
    const entrees = []
    for (const f of neuves.slice(i, i + LOT)) {
      const b = await f.blob().catch(() => null)
      if (!b || b.size > TAILLE_MAX) { memo.set(cle(f), null); entrees.push([cle(f), null]); continue }
      lot.push({ f, cle: f.postscriptName, famille: f.family, style: f.style, octets: await b.arrayBuffer() })
    }
    const descr = lot.length ? await decrire(lot.map(({ cle, famille, style, octets }) => ({ cle, famille, style, octets })), lot.map(x => x.octets)) : []
    lot.forEach((x, k) => { memo.set(cle(x.f), descr[k] || null); entrees.push([cle(x.f), descr[k] || null]) })
    await C.poser('faces', entrees)
    progres(Math.min(1, (i + LOT) / neuves.length))
  }
  return faces.map(f => memo.get(cle(f))).filter(Boolean)
}

/* LES POLICES DÉPOSÉES : leurs mesures, gardées dans le coffre. */
export async function lireAjouts() {
  const memo = await C.tout('faces')
  return [...memo].filter(([k, d]) => k.startsWith('ajout|') && d).map(([, d]) => d)
}

/* DÉPOSER DES POLICES (des fichiers) : chaque face lue, décrite par le
   fil, gardée (ses octets et ses mesures). Rend { ajoutees, refusees }
   — refusée, une face qui n'est pas une police de texte latin, ou un
   WOFF2 (que opentype.js ne lit pas). */
export async function ajouterPolices(fichiers, decrire) {
  let ajoutees = 0
  const refusees = []
  for (const fichier of fichiers) {
    if (/\.woff2$/i.test(fichier.name)) { refusees.push(fichier.name + ' (WOFF2 : en TTF ou OTF)'); continue }
    let faces
    try { faces = facesTtc(await fichier.arrayBuffer()) } catch { refusees.push(fichier.name); continue }
    const lot = faces.map(octets => ({ octets }))
    let descr = []
    try { descr = await decrire(lot.map(x => ({ octets: x.octets.slice(0) })), []) } catch {}
    const entrees = [], octets = []
    lot.forEach((x, k) => {
      const d = descr[k]
      if (!d) return
      /* La clé de la face : son nom PostScript (sinon sa famille et son
         style). */
      d.cle = 'ajout:' + d.cle
      entrees.push(['ajout|' + d.cle, d])
      octets.push([d.cle, x.octets])
      ajoutees++
    })
    if (!entrees.length) refusees.push(fichier.name)
    await C.poser('ajouts', octets)
    await C.poser('faces', entrees)
  }
  return { ajoutees, refusees }
}

/* LES OCTETS D'UNE FACE, quand le fil en a besoin : du poste (Chrome les
   lit à la demande), ou du coffre (une police déposée). */
export async function octets(source, cle) {
  if (source === 'ajout') return (await C.lire('ajouts', cle)) || null
  const f = facesDuPoste && facesDuPoste.get(cle)
  if (!f) return null
  const b = await f.blob().catch(() => null)
  return b ? b.arrayBuffer() : null
}

/* LA POLICE DANS LA PAGE, pour la montrer dans son dessin : celle du
   poste par son nom (`local()`), une déposée par ses octets. Rend la
   source d'un FontFace, ou null. */
export async function sourceFontFace(source, cle) {
  if (source === 'poste') return 'local("' + String(cle).replace(/"/g, '') + '")'
  const o = await octets(source, cle)
  return o || null
}

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
/* Des familles entières (des écritures d'Asie, d'Arabie, d'Inde, des
   symboles, les polices cachées du système), par motif... */
const MOTIFS = /^\.|LastResort|Emoji|PingFang|Heiti|Songti|STSong|STHeiti|Hiragino|AppleGothic|AppleMyungjo|Apple SD Gothic|Apple Symbols|Apple Braille|Arial Unicode|GB18030|Wingdings|Webdings|Dingbats|Ornaments|^Noto (Sans|Serif) (?!Mono)|Sangam|\bMN$|Kohinoor|Devanagari|Gujarati|Gurmukhi|Kannada|Malayalam|Oriya|Tamil|Telugu|Sinhala|^Khmer|^Lao |Myanmar|^Al (Bayan|Nile|Tarikh)$|DecoType|^Diwan|KufiStandard|Mishafi|^New Peninim|Hebrew|Noto Nastaliq|^MS (Gothic|Mincho|PGothic|PMincho|UI Gothic)|SimSun|SimHei|Microsoft (YaHei|JhengHei)|MingLiU|^Meiryo|^Yu (Gothic|Mincho)|^Segoe (UI Emoji|UI Symbol|MDL2|Fluent)|^Leelawadee|^Nirmala|^HG(P|S)?(Gothic|Mincho|Seikai|Soei|Maru|Gyosho|Kyokasho)|^BIZ UD|^UD Digi|Arabic|Typesetting/i
/* ... et par leur nom exact — un nom court pris dans un autre ne compte
   pas (« Rod » n'écarte pas Rodeo, ni « Sana » Sana Sans). */
const NOMS = new Set(['symbol', 'kokonor', 'thonburi', 'ayuthaya', 'krungthep', 'silom', 'sathu', 'sukhumvit set', 'baghdad', 'beirut', 'damascus', 'farah', 'farisi', 'geeza pro', 'muna', 'nadeem', 'sana', 'waseem', 'raanana', 'mshtakan', 'kefa', 'kefa iii', 'euphemia ucas', 'plantagenet cherokee', 'inaimathi', 'mukta mahee', 'shree devanagari 714', 'grantha sangam mn', 'gulim', 'gulimche', 'batang', 'batangche', 'dotum', 'dotumche', 'gungsuh', 'gungsuhche', 'malgun gothic', 'marlett', 'holomdl2 assets', 'ebrima', 'gadugi', 'javanese text', 'mongolian baiti', 'nyala', 'sylfaen', 'estrangelo edessa', 'iskoola pota', 'kalinga', 'raavi', 'shruti', 'tunga', 'vrinda', 'kartika', 'latha', 'mangal', 'gautami', 'vijaya', 'aparajita', 'kokila', 'utsaah', 'daunpenh', 'moolboran', 'dokchampa', 'mv boli', 'david', 'miriam', 'miriam fixed', 'narkisim', 'rod', 'aharoni', 'frankruehl', 'levenim mt', 'gisha', 'sakkal majalla', 'andalus', 'aldhabi', 'nsimsun'])
export const ignoree = famille => MOTIFS.test(famille) || NOMS.has(String(famille).toLowerCase())

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
  const faces = toutes.filter(f => f.postscriptName && !ignoree(f.family))
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

/* LES POLICES DÉPOSÉES : leurs mesures, gardées dans le coffre — et,
   pour la visite, en mémoire (un coffre refusé, une navigation privée :
   elles servent quand même jusqu'à la fermeture de la page). Celles d'une
   autre version des mesures (`MESURE`) se remesurent sur leurs octets
   gardés (`decrire`). */
const enMemoire = { faces: new Map(), octets: new Map() }
const cleAjout = cle => 'ajout|' + MESURE + '|' + cle
export async function lireAjouts(decrire = null) {
  const memo = await C.tout('faces')
  const vieilles = [...memo.keys()].filter(k => k.startsWith('ajout|') && !k.startsWith('ajout|' + MESURE + '|'))
  if (vieilles.length && decrire) {
    const entrees = vieilles.map(k => [k, undefined])
    for (const k of vieilles) {
      const d = memo.get(k)
      const o = d && await C.lire('ajouts', d.cle)
      if (!o) continue
      const [neuve] = await decrire([{ octets: o.slice(0) }], []).catch(() => [null])
      if (neuve) { neuve.cle = d.cle; entrees.push([cleAjout(d.cle), neuve]); memo.set(cleAjout(d.cle), neuve) }
    }
    await C.poser('faces', entrees)
  }
  const sortie = new Map(enMemoire.faces)
  for (const [k, d] of memo) if (k.startsWith('ajout|' + MESURE + '|') && d) sortie.set(d.cle, d)
  return [...sortie.values()]
}

/* DÉPOSER DES POLICES (des fichiers) : chaque face lue, décrite par le
   fil, gardée (ses octets et ses mesures). Rend { ajoutees, refusees }
   — refusée, une face qui n'est pas une police de texte latin, ou un
   WOFF2 (que opentype.js ne lit pas) ; `gardees` : faux si le coffre
   les a refusées (elles servent pour cette visite seulement). */
export async function ajouterPolices(fichiers, decrire) {
  let ajoutees = 0, gardees = true
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
      entrees.push([cleAjout(d.cle), d])
      octets.push([d.cle, x.octets])
      enMemoire.faces.set(d.cle, d)
      enMemoire.octets.set(d.cle, x.octets)
      ajoutees++
    })
    if (!entrees.length) refusees.push(fichier.name)
    else if (!(await C.poser('ajouts', octets)) || !(await C.poser('faces', entrees))) gardees = false
  }
  return { ajoutees, refusees, gardees }
}

/* LES OCTETS D'UNE FACE, quand le fil en a besoin : du poste (Chrome les
   lit à la demande), ou du coffre (une police déposée). */
export async function octets(source, cle) {
  if (source === 'ajout') {
    const m = enMemoire.octets.get(cle)
    return m ? m.slice(0) : (await C.lire('ajouts', cle)) || null
  }
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

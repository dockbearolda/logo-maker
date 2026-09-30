/* LE FIL DE CALCUL DU STUDIO DE DÉTOURAGE (lib/studio-detourage.js).
   Le détourage d'une grande image prend une seconde, l'IA de une à quinze :
   ici, hors de la page, les curseurs restent fluides pendant que ça
   calcule. Un Worker de module ; sans Worker, le studio appelle `traiter`
   lui-même, dans la page.
   L'IA (le moteur ONNX et le modèle, vendor/) ne se charge qu'au premier
   message `ia` : un logo sur fond blanc n'en tire pas un octet. Elle tourne
   sur la carte graphique quand le navigateur en donne une (WebGPU : une
   seconde), sinon sur le processeur (WebAssembly : quinze). */
import { detourer, creux } from './detourage.js'
import { entreeModele, masqueEnOctets, affinerMasque, poserSujet, COTE_MODELE } from './sujet.js'
import { vectoriserLisse, fondsLus } from './vecteur-lisse.js'
import { svgVersPdf } from './pdf-vectoriel.js'
import { nettoyerParTuiles, COTE_NETTOYAGE, COTE_PROCESSEUR, fidele, borner, FLOU, JUGE } from './nettoyage.js'
import { reduire } from './vectoriser.js'
import { imageParCouches } from './image-nette.js'
import { famillesDe, choisirPolices, imageLigne, glyphesDe, ligneDe } from './polices.js'
import { choisirEcriture, ligneUnie } from './ecriture.js'

const VENDOR = new URL('../vendor/', import.meta.url)
const MODELE = 'isnet-general-int8.onnx'
/* Sa taille, pour l'avancement du téléchargement : compressé en route, le
   fichier n'annonce que sa taille compressée. */
const TAILLE_MODELE = 44229662
/* LE MODÈLE DU NETTOYAGE (lib/nettoyage.js) : Real-ESRGAN, 2,5 Mo. */
const MODELE_NETTOYAGE = 'realesr-animevideov3.onnx'
const TAILLE_NETTOYAGE = 2492908

/* LA CARTE GRAPHIQUE, s'il y en a une vraie. Une carte « de secours »
   (SwiftShader, dessinée par le processeur) mettrait des minutes : le
   WebAssembly va plus vite. */
async function carteGraphique() {
  try {
    if (typeof navigator === 'undefined' || !navigator.gpu) return false
    const a = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })
    if (!a) return false
    const info = a.info || {}
    if (a.isFallbackAdapter || info.isFallbackAdapter) return false
    return !/swiftshader|llvmpipe|software/i.test([info.vendor, info.architecture, info.description, info.device].join(' '))
  } catch {
    return false
  }
}

async function telecharger(url, progres, taille = TAILLE_MODELE) {
  const rep = await fetch(url, { credentials: 'same-origin' })
  if (!rep.ok) throw new Error('Le modèle de l\'IA ne se télécharge pas (' + rep.status + ').')
  if (!rep.body) return new Uint8Array(await rep.arrayBuffer())
  const annonce = rep.headers.get('Content-Encoding') ? 0 : Number(rep.headers.get('Content-Length')) || 0
  const attendu = annonce || taille
  const lecteur = rep.body.getReader()
  const morceaux = []
  let recu = 0
  for (;;) {
    const { done, value } = await lecteur.read()
    if (done) break
    morceaux.push(value)
    recu += value.length
    progres({ etape: 'telechargement', part: Math.min(1, recu / attendu) })
  }
  const octets = new Uint8Array(recu)
  let o = 0
  for (const m of morceaux) { octets.set(m, o); o += m.length }
  return octets
}

/* LE MOTEUR ONNX, chargé une fois par fil pour les deux modèles. */
let moteurOnnx = null
function onnx() {
  if (!moteurOnnx) {
    moteurOnnx = import(new URL('ort.webgpu.min.mjs', VENDOR).href).then(ort => {
      ort.env.wasm.wasmPaths = VENDOR.href
      /* Sans isolement de l'origine, le navigateur refuse les fils
         multiples : un seul, dit franchement (sinon un avertissement). */
      ort.env.wasm.numThreads = typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1
      ort.env.logLevel = 'error'
      return ort
    }).catch(e => { moteurOnnx = null; throw e })
  }
  return moteurOnnx
}

/* UN MODÈLE, chargé une fois par fil : sur la carte graphique quand il y en
   a une vraie, sinon sur le processeur. Un échec (réseau coupé) se rejoue
   au message suivant. */
function chargeur(nom, taille) {
  let chargement = null
  return (progres, { processeur = false } = {}) => {
    if (!chargement || processeur) {
      chargement = (async () => {
        const ort = await onnx()
        const octets = await telecharger(new URL(nom, VENDOR), progres, taille)
        progres({ etape: 'preparation' })
        const moteurs = !processeur && await carteGraphique() ? ['webgpu', 'wasm'] : ['wasm']
        for (const moteur of moteurs) {
          try {
            const session = await ort.InferenceSession.create(octets, { executionProviders: [moteur], graphOptimizationLevel: 'all' })
            return { ort, session, moteur }
          } catch (e) {
            if (moteur === 'wasm') throw e
          }
        }
      })().catch(e => { chargement = null; throw e })
    }
    return chargement
  }
}
const modele = chargeur(MODELE, TAILLE_MODELE)
const modeleNettoyage = chargeur(MODELE_NETTOYAGE, TAILLE_NETTOYAGE)

/* LE SUJET D'UNE IMAGE : ses probabilités, en octets, en `cote` × `cote`
   (1 024 : la taille où le modèle a appris ; les tests le font tourner
   plus petit). La carte graphique qui rendrait n'importe quoi (des « NaN »)
   laisse la place au processeur. */
async function trouverSujet(m, progres) {
  let { ort, session, moteur } = await modele(progres)
  const cote = m.cote || COTE_MODELE
  const entree = entreeModele(m.data, m.largeur, m.hauteur, cote)
  for (;;) {
    progres({ etape: 'calcul', moteur })
    const tenseur = new ort.Tensor('float32', entree, [1, 3, cote, cote])
    const nom = session.outputNames[0]
    const sortie = await session.run({ [session.inputNames[0]]: tenseur }, [nom])
    const probabilites = await sortie[nom].getData()
    if (sortie[nom].dispose) sortie[nom].dispose()
    if (moteur === 'webgpu' && probabilites.some(Number.isNaN)) {
      ({ ort, session, moteur } = await modele(progres, { processeur: true }))
      continue
    }
    return { masque: masqueEnOctets(probabilites), cote, moteur }
  }
}

/* LE LOGO NETTOYÉ (lib/nettoyage.js) : redessiné quatre fois plus grand,
   entier jusqu'à 1 280 px sur la carte graphique, réduit à 768 px sur le
   processeur ; puis jugé contre le fichier reçu (`fidele`) — les lettres
   gardent leur forme. La carte graphique qui rendrait n'importe quoi (des
   « NaN ») laisse la place au processeur. `entree` : le grand côté de
   l'image qu'a vue le modèle. */
async function nettoyer(m, progres) {
  for (let processeur = false; ; processeur = true) {
    const { ort, session, moteur } = await modeleNettoyage(progres, { processeur })
    const img = reduire(m.data, m.largeur, m.hauteur, moteur === 'webgpu' ? COTE_NETTOYAGE : COTE_PROCESSEUR)
    const calculer = async (entree, l, h) => {
      const nom = session.outputNames[0]
      const sortie = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', entree, [1, 3, h, l]) }, [nom])
      const d = await sortie[nom].getData()
      if (sortie[nom].dispose) sortie[nom].dispose()
      if (moteur === 'webgpu' && d.some(Number.isNaN)) throw Object.assign(new Error('NaN'), { nan: true })
      return d
    }
    progres({ etape: 'calcul', moteur, part: 0 })
    try {
      const r = await nettoyerParTuiles(img.data, img.largeur, img.hauteur, calculer, part => progres({ etape: 'calcul', moteur, part }))
      /* Le fichier reçu — jusqu'à une fois et demie l'image du modèle —,
         adouci au niveau de détail de l'image qu'a vue le modèle. */
      const src = reduire(m.data, m.largeur, m.hauteur, Math.round(JUGE * Math.max(img.largeur, img.hauteur)))
      fidele(r.data, r.largeur, r.hauteur, src.data, src.largeur, src.hauteur, { flou: FLOU * src.largeur / img.largeur })
      /* Puis aucune couleur inventée : ni liseré sombre, ni cœur noirci
         (lib/nettoyage.js, `borner`). */
      borner(r.data, r.largeur, r.hauteur, src.data, src.largeur, src.hauteur, { rayon: Math.max(1, Math.round(src.largeur / img.largeur)) })
      return Object.assign(r, { moteur, entree: Math.max(img.largeur, img.hauteur) })
    } catch (e) {
      if (!e.nan || processeur) throw e
    }
  }
}

/* LA RÉSERVE DE POLICES (lib/polices.js) : l'index (vendor/polices/), puis
   chaque fichier demandé au serveur (serveur/polices.mjs), lu une fois par
   opentype.js et gardé. Une police qui ne vient pas (pas de réseau) vaut
   null : on fait sans elle. */
let famillesPolices = null
function familles() {
  famillesPolices = famillesPolices || fetch(new URL('index.json', new URL('polices/', VENDOR))).then(r => {
    if (!r.ok) throw new Error('index des polices : ' + r.status)
    return r.json()
  }).then(famillesDe).catch(e => { famillesPolices = null; throw e })
  return famillesPolices
}
/* LE LEXIQUE (vendor/lexique/) : relire une écriture que l'OCR lit mal
   (lib/ecriture.js). Chargé à la première écriture ; sans lui, on fait
   avec ce qui a été lu. */
let lexique = null
function lireLexique() {
  lexique = lexique || fetch(new URL('lexique/mots.txt', VENDOR)).then(r => r.ok ? r.text() : '').then(t => t.split('\n').filter(Boolean)).catch(() => [])
  return lexique
}
/* Sous cette note, une écriture posée sur une ligne n'est pas proposée :
   ce n'était pas du texte (un morceau de dessin lu « of w »). */
const ECRITURE_MIN = 0.4
let opentype = null
const polices = new Map()
export function chargerPolice(f) {
  const cle = f.id + '/' + f.graisse + f.style
  if (!polices.has(cle)) {
    polices.set(cle, (async () => {
      opentype = opentype || import(new URL('opentype.min.mjs', VENDOR).href)
      const { parse } = await opentype
      const r = await fetch(new URL('https://cdn.jsdelivr.net/fontsource/fonts/' + f.id + '@latest/latin-' + f.graisse + '-' + f.style + '.woff', import.meta.url))
      if (!r.ok) return null
      return parse(await r.arrayBuffer())
    })().catch(() => null))
  }
  return polices.get(cle)
}
/* LE TEXTE CORRIGÉ, recousu sur celui qu'a lu l'OCR : ses espaces gardés,
   ses caractères remplacés un à un (sinon, les lettres corrigées seules). */
export function recoudreTexte(texte, lu) {
  let k = 0, sortie = ''
  for (const c of String(texte)) sortie += /\s/.test(c) ? c : k < lu.length ? lu[k++] : c
  return k === lu.length && [...String(texte).replace(/\s+/g, '')].length === lu.length ? sortie : lu
}

/* Les polices choisies d'un vecteur, lues : { boite, texte, police,
   ecriture (toute la ligne d'un tenant, lib/ecriture.js) }. */
async function remplacementsDe(choix = []) {
  const sortie = []
  for (const c of choix) {
    const police = await chargerPolice(c)
    if (police) sortie.push({ boite: c.boite, texte: c.texte, police, ecriture: !!c.ecriture })
  }
  return sortie
}

/* Les demandes au modèle passent l'une après l'autre : une session ne
   calcule qu'une image à la fois. */
let fileIA = Promise.resolve()

/* LE DÉTOURAGE D'UNE IMAGE, par la couleur ou par le sujet. `memoire`
   garde les coefficients du sujet (lib/sujet.js) d'un curseur à l'autre :
   ils ne dépendent que de l'image et du masque. */
function detourage(img, m, memoire) {
  if (m.methode !== 'ia') return detourer(img.data, img.largeur, img.hauteur, m.reglages, m.echelle || 1)
  if (!m.masque) throw new Error('Le sujet n\'est pas encore trouvé.')
  if (!memoire.affine || memoire.affine.image !== img || memoire.affine.cle !== m.cle) {
    memoire.affine = { image: img, cle: m.cle, coefficients: affinerMasque(img.data, img.largeur, img.hauteur, m.masque, m.cote || COTE_MODELE) }
  }
  const data = poserSujet(img.data, img.largeur, img.hauteur, memoire.affine.coefficients, { seuil: m.reglages.seuil })
  recoudre(data, img.data, img.largeur, img.hauteur, m.reglages.interieur !== false)
  return { data, fonds: [] }
}

/* L'INTÉRIEUR DU SUJET REVIENT (27 septembre 2026 : « ça enlève toujours
   l'intérieur du logo »). L'IA prend le creux d'un O pour du décor : la
   pastille jaune d'un O, le triangle bleu d'un A partaient avec. Seul le
   fond qui touche le bord de l'image est du décor sûr ; ce qu'il enferme
   revient tel quel — ou, avec « Intérieur du logo aussi », tout sauf les
   creux couleur de ce décor (le blanc du creux part, la pastille reste, le
   reflet pâle d'un dégradé aussi : lib/detourage.js, `creux`). */
export function recoudre(data, source, largeur, hauteur, interieur, tolerance = 28) {
  const n = largeur * hauteur
  const dehors = new Uint8Array(n)
  const pile = []
  const semer = p => { if (!dehors[p] && data[p * 4 + 3] < 128) { dehors[p] = 1; pile.push(p) } }
  for (let x = 0; x < largeur; x++) { semer(x); semer((hauteur - 1) * largeur + x) }
  for (let y = 0; y < hauteur; y++) { semer(y * largeur); semer(y * largeur + largeur - 1) }
  while (pile.length) {
    const p = pile.pop(), x = p % largeur
    if (x > 0) semer(p - 1)
    if (x < largeur - 1) semer(p + 1)
    if (p >= largeur) semer(p - largeur)
    if (p < n - largeur) semer(p + largeur)
  }
  const fonds = interieur ? fondsLus(source, data) : []
  const candidat = new Uint8Array(n)
  const revient = p => { const i = p * 4; data[i] = source[i]; data[i + 1] = source[i + 1]; data[i + 2] = source[i + 2]; data[i + 3] = 255 }
  for (let p = 0; p < n; p++) {
    const i = p * 4
    if (dehors[p] || data[i + 3] >= 250) continue
    if (fonds.some(f => Math.max(Math.abs(source[i] - f[0]), Math.abs(source[i + 1] - f[1]), Math.abs(source[i + 2] - f[2])) < tolerance)) candidat[p] = 1
    else revient(p)
  }
  if (!fonds.length) return
  const trous = creux(source, largeur, hauteur, candidat, fonds, { hors: dehors, tolerance })
  for (let p = 0; p < n; p++) if (candidat[p] && !trous[p]) revient(p)
}

/* UN MESSAGE, UNE RÉPONSE. `memoire` garde l'image d'un message à l'autre :
   elle ne traverse qu'une fois, les réglages seuls passent ensuite.
   `progres` reçoit l'avancement d'un long calcul (l'IA). */
export async function traiter(m, memoire, progres = () => {}) {
  if (m.type === 'source') {
    memoire.apercu = m
    memoire.affine = null
    return {}
  }
  if (m.type === 'calcul') {
    const r = detourage(memoire.apercu, m, memoire)
    return { reponse: { data: r.data, fonds: r.fonds }, transfert: [r.data.buffer] }
  }
  if (m.type === 'nettoyer') {
    const tache = fileIA.then(() => nettoyer(m, progres))
    fileIA = tache.catch(() => {})
    const r = await tache
    return { reponse: r, transfert: [r.data.buffer] }
  }
  if (m.type === 'ia') {
    const tache = fileIA.then(() => trouverSujet(m, progres))
    fileIA = tache.catch(() => {})
    const { masque, cote, moteur } = await tache
    return { reponse: { masque, cote, moteur }, transfert: [masque.buffer] }
  }
  /* LES POLICES DES LIGNES LUES (lib/polices.js) : pour chaque ligne du
     dernier vecteur dont on a le texte, la police et ses équivalents. */
  if (m.type === 'polices') {
    const garde = memoire.vecteur && memoire.vecteur.cle === m.memo ? memoire.vecteur : null
    if (!garde || !garde.lignes) throw new Error('sans-image')
    const fams = await familles()
    const lignes = []
    const n = Math.max(garde.lignes.length, (m.textes || []).length)
    for (let i = 0; i < n; i++) {
      /* `boites` : la ligne retrouvée à son cadre (le vecteur a pu être
         refait depuis la lecture). */
      const ligne = m.boites && m.boites[i] ? ligneDe(garde.lignes, m.boites[i], 8) : garde.lignes[i] || null
      if (!ligne) { lignes.push(null); continue }
      const glyphes = m.textes[i] ? glyphesDe(ligne, m.textes[i], garde.largeur) : null
      /* UNE ÉCRITURE (lib/ecriture.js) : ses lettres ne se découpent pas
         (liées), ou l'OCR l'a mal lue — la ligne entière, parmi les
         écritures de la réserve, sur ce qu'on en a lu. */
      /* Ce qu'on en a lu : ses relectures, ou sa lecture sûre (des lettres
         liées, bien lues, que la découpe lettre à lettre ne suit pas). */
      const lectures = m.lectures && m.lectures[i] && m.lectures[i].length ? m.lectures[i] : m.textes[i] ? [{ texte: m.textes[i], confiance: 90 }] : []
      /* D'une seule couleur (un dessin multicolore lu comme du texte n'a
         pas d'écriture), sauf si le texte a été tapé. */
      const unie = lectures.some(l => l.impose) || !garde.image || ligneUnie(ligne, garde.largeur, garde.r.data, garde.image.largeur, garde.image.hauteur)
      if (!glyphes && lectures.length && unie) {
        const r = await choisirEcriture(ligne, garde.largeur, lectures, fams.filter(f => f.avance), chargerPolice, await lireLexique())
        /* Un texte tapé à la main a toujours ses écritures : on les a
           demandées. */
        if (r && r.props[0] && (r.props[0].note >= ECRITURE_MIN || lectures.some(l => l.impose))) {
          lignes.push({
            texte: r.texte, ecriture: true,
            props: r.props.map(p => ({ id: p.fichier.id, nom: p.fichier.nom, graisse: p.fichier.graisse, style: p.fichier.style, note: Math.round(p.note * 1000) / 1000, pire: Math.round(p.note * 1000) / 1000 })),
          })
        } else lignes.push(null)
        progres({ etape: 'polices', part: (i + 1) / n })
        continue
      }
      if (!glyphes) { lignes.push(null); continue }
      const props = await choisirPolices(glyphes, fams, chargerPolice)
      /* Le texte, corrigé par la police s'il le faut (un « J » lu pour un
         « d »), ses espaces gardés. */
      const lu = props[0] && props[0].lu
      lignes.push({
        texte: lu ? recoudreTexte(m.textes[i], lu) : m.textes[i],
        props: props.map(p => ({ id: p.fichier.id, nom: p.fichier.nom, graisse: p.fichier.graisse, style: p.fichier.style, note: Math.round(p.note * 1000) / 1000, pire: Math.round((p.pire || 0) * 1000) / 1000 })),
      })
      progres({ etape: 'polices', part: (i + 1) / n })
    }
    return { reponse: { lignes } }
  }
  if (m.type === 'vecteur' || m.type === 'export') {
    /* `detoure` : l'image arrive déjà détourée (le plan zoomé du studio
       l'a calculée en pleine taille) — rien à refaire. `source` : l'image
       reçue, dont les bords nets guident le contour (lib/vecteur-lisse.js). */
    /* `memo` : le même détourage qu'au message d'avant (seul le lissage a
       bougé) — détourage et couvertures sont repris, seul le tracé se refait. */
    const garde = m.memo && memoire.vecteur && memoire.vecteur.cle === m.memo ? memoire.vecteur : null
    /* Le studio n'envoie l'image qu'une fois par détourage : un fil qui ne
       l'a plus (il a redémarré) la redemande. */
    if (!garde && !m.data) throw new Error('sans-image')
    const r = garde ? garde.r : m.detoure ? { data: m.data, fonds: m.fonds || [] } : detourage({ data: m.data, largeur: m.largeur, hauteur: m.hauteur }, m, {})
    const memo = garde ? garde.memo : {}
    if (m.memo) memoire.vecteur = { cle: m.memo, r, memo }
    /* L'aperçu du curseur se trace sur 800 px : il suit la main. */
    /* Le tracé ne perce rien de ce que le détourage a gardé : c'est lui
       qui fait les creux, et lui seul — il sait les distinguer d'un reflet
       (lib/detourage.js, `creux`). Percé par la couleur, le reflet d'un
       phénix sortait en cibles (27 septembre 2026). */
    /* La géométrie parfaite, les miettes, les teintes retirées à la main, et
       le grand côté du fichier d'origine (avant le nettoyage IA) : voir
       lib/vecteur-lisse.js. */
    /* Un dégradé se trace en tons, de vraies formes nettes à tous les zooms
       (lib/vecteur-lisse.js, `tons`) — le sujet trouvé par l'IA aussi ;
       seule une vraie photo garde son image dans le contour. */
    /* Les lettres des polices choisies (lib/polices.js), à la place des
       lettres tracées ; et les lignes de texte, pour les lire. */
    const remplacements = m.apercu ? [] : await remplacementsDe(m.polices)
    const options = { fonds: r.fonds || [], source: m.source || null, alpha: true, lissage: m.lissage, coteTravail: m.apercu ? 800 : 0, trouer: false, geometrie: m.geometrie !== false, miettes: m.miettes !== false, origine: m.origine || 0, sans: m.sans || [], nuances: m.nuances !== false, fusion: m.fusion ?? 1, texte: !m.apercu && m.type === 'vecteur', remplacements }
    if (m.type === 'vecteur') {
      /* Les couleurs à plat, et la silhouette de tout le dessin (le DTF
         d'une couleur, la découpe de la version image). */
      const multi = vectoriserLisse(r.data, m.largeur, m.hauteur, Object.assign({ mono: false, memo }, options))
      if (!multi.formes) throw new Error('Tout est parti avec le fond : il ne reste rien à vectoriser.')
      /* Les lignes de texte, gardées pour chercher leur police, et leur
         image pour les lire. */
      if (multi.lignes && m.memo) Object.assign(memoire.vecteur, { lignes: multi.lignes, largeur: multi.largeurTravail, image: { largeur: m.largeur, hauteur: m.hauteur } })
      const lignes = multi.lignes && m.lire ? multi.lignes.map(l => imageLigne(l, multi.largeurTravail)) : []
      /* La silhouette : tout le dessin d'une pièce (lib/vecteur-lisse.js). */
      const v = { svg: multi.silhouette ? multi.svg.replace(/<path[\s\S]*<\/svg>$/, multi.silhouette + '</svg>') : multi.svg.replace(/(<path[^>]*\/>)[\s\S]*<\/svg>$/, '$1</svg>'), cadre: multi.cadre }
      const c = v.cadre
      /* LA VERSION IMAGE, toujours (27 septembre 2026 : « les dégradés or, je
         les obtiens avec une image — ils ne doivent jamais être tronqués ») :
         les pixels du fichier dans le contour vectoriel. */
      const image = new Uint8ClampedArray(c.largeur * c.hauteur * 4)
      for (let y = 0; y < c.hauteur; y++) {
        const de = ((c.y + y) * m.largeur + c.x) * 4
        image.set(r.data.subarray(de, de + c.largeur * 4), y * c.largeur * 4)
      }
      const tete = /width="[^"]*" height="[^"]*" viewBox="[^"]*"/
      /* Le DTF d'une couleur : sans le blanc enfermé dans un logo foncé (le
         tissu le fait). Un dégradé (un doré qui brille jusqu'au blanc) n'a
         pas de jour : ses reflets sont du dessin, toute sa silhouette prend
         la couleur. Tracé seulement quand on le demande (`unie`) : en
         couleurs d'origine, il ne sert à rien. */
      const clair = !multi.degrade && multi.couleurs.some(c => Math.min(...c) > 215) && multi.couleurs.some(c => Math.min(...c) <= 215)
      const unie = !clair ? v.svg : m.unie ? vectoriserLisse(r.data, m.largeur, m.hauteur, Object.assign({ mono: 'fonce', memo }, options, { texte: false })).svg.replace(tete, v.svg.match(tete)[0]) : null
      /* NETTE (lib/image-nette.js) : deux fois plus fine — jusqu'à 4 096
         px —, découpée sur les couches du vecteur (ses bords sont les siens,
         au demi-pixel), les couleurs et les dégradés du fichier dedans.
         D'une teinte retirée à l'autre, elle ne change que si le vecteur
         bouge. L'aperçu du curseur n'en a pas besoin. */
      const cleImage = JSON.stringify([c, multi.couleurs, multi.formes, multi.noeuds])
      if (m.apercu) memo.image = { cle: '', nette: { data: new Uint8ClampedArray(4), largeur: 1, hauteur: 1 } }
      else if (memo.image?.cle !== cleImage) {
        const f = Math.min(2, Math.max(1, 4096 / Math.max(c.largeur, c.hauteur)))
        const cote = Math.max(m.largeur, m.hauteur)
        memo.image = { cle: cleImage, nette: imageParCouches(image, c.largeur, c.hauteur, c, multi.couches, f, cote / (m.origine || cote), r.fonds || []) }
      }
      const n = memo.image.nette
      const plein = n.data.slice()
      return { reponse: { svg: v.svg, unie, multi: multi.svg, degrade: multi.degrade, nuances: multi.nuances, cadre: c, couleurs: multi.couleurs, image: plein, imageLargeur: n.largeur, imageHauteur: n.hauteur, formes: multi.formes, noeuds: multi.noeuds, lignes }, transfert: [plein.buffer, ...lignes.map(l => l.data.buffer)] }
    }
    const v = vectoriserLisse(r.data, m.largeur, m.hauteur, Object.assign({ mono: true, memo }, options))
    if (!v.formes) throw new Error('Tout est parti avec le fond : il ne reste rien à vectoriser.')
    const fichier = new TextEncoder().encode(svgVersPdf(v.svg))
    return { reponse: { fichier, largeur: v.cadre.largeur, hauteur: v.cadre.hauteur }, transfert: [fichier.buffer] }
  }
  throw new Error('Message inconnu : ' + m.type)
}

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  const memoire = {}
  self.onmessage = async e => {
    try {
      const progres = p => self.postMessage({ id: e.data.id, progression: p })
      const { reponse, transfert } = await traiter(e.data, memoire, progres)
      if (reponse) self.postMessage(Object.assign({ id: e.data.id }, reponse), transfert || [])
    } catch (err) {
      self.postMessage({ id: e.data.id, erreur: (err && err.message) || String(err) })
    }
  }
}

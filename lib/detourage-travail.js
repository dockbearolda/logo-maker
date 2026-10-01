/* LE FIL DE CALCUL DU STUDIO DE DÉTOURAGE (lib/studio-detourage.js).
   Le détourage d'une grande image prend une seconde, l'IA de une à quinze :
   ici, hors de la page, les curseurs restent fluides pendant que ça
   calcule. Un Worker de module ; sans Worker, le studio appelle `traiter`
   lui-même, dans la page.
   L'IA (le moteur ONNX et le modèle, vendor/) ne se charge qu'au premier
   message `ia` : un logo sur fond blanc n'en tire pas un octet. Elle tourne
   sur la carte graphique quand le navigateur en donne une (WebGPU : une
   seconde), sinon sur le processeur (WebAssembly : quinze). */
import { detourer, creux, bordDuFond, imageCollee, voiles, aplatirVoiles, TOLERANCE } from './detourage.js'
import { entreeModele, masqueEnOctets, affinerMasque, poserSujet, rogner, replacer, COTE_MODELE, BIREFNET, PHOTO } from './sujet.js'
import { vectoriserLisse, fondsLus } from './vecteur-lisse.js'
import { nettoyerParTuiles, entreeTuile, enOrientations, aireACalculer, fidele, borner, recaler, COTE_NETTOYAGE, COTE_PROCESSEUR, ORIENTATIONS, TUILE, MARGE, FLOU, JUGE, FACTEUR } from './nettoyage.js'
import { reduire } from './vectoriser.js'
import { rendreNet } from './nettete.js'
import { imageParCouches } from './image-nette.js'
import { famillesDe, choisirPolices, essayerFamille, imageLigne, glyphesDe, ligneDe, harmoniser, boiteDe, largeurDe } from './polices.js'
import { decrireFace, famillesPoste, lireFace } from './polices-poste.js'
import { effacer } from './effacer.js'
import { elargir } from './contour.js'
import { lignesImage, poseLigne, zonesDe, poserZone, grasPx, ombrePortee } from './texte.js'
import { choisirEcriture, ligneUnie } from './ecriture.js'
import { lireLignes, lireDictionnaire, HAUT } from './lecture.js'

const VENDOR = new URL('../vendor/', import.meta.url)
const MODELE = 'isnet-general-int8.onnx'
/* Sa taille, pour l'avancement du téléchargement : compressé en route, le
   fichier n'annonce que sa taille compressée. */
const TAILLE_MODELE = 44229662
/* LE MODÈLE DU NETTOYAGE (lib/nettoyage.js) : Real-ESRGAN, 2,5 Mo. */
const MODELE_NETTOYAGE = 'realesr-animevideov3.onnx'
const TAILLE_NETTOYAGE = 2492908
/* CELUI DE LA MATIÈRE (lib/detourage.js, `aDeLaMatiere`) : Real-ESRGAN
   appris sur des photos, 4,9 Mo — les fils d'une broderie, le grain d'un
   cuir, l'eau restent ce qu'ils sont, là où celui des logos en fait des
   aplats. Il fait aussi l'ULTRA d'un logo à plat (lib/nettoyage.js) :
   passé jusqu'à huit fois, retourné et pivoté, ses dessins moyennés, il
   nettoie mieux que celui des logos (30 septembre 2026). */
const MODELE_MATIERE = 'realesr-general-x4v3.onnx'
const TAILLE_MATIERE = 4866428
/* LES MÊMES EN DEMI-PRÉCISION (outils/realesr-fp16.py, 1er octobre 2026) :
   sur une carte graphique qui calcule en float16, l'Ultra va 1,4 fois plus
   vite, son dessin à ±0,02 dB de celui en float32. */
const DEMI_NETTOYAGE = ['realesr-animevideov3-fp16.onnx', 1253359]
const DEMI_MATIERE = ['realesr-general-x4v3-fp16.onnx', 2445360]
/* CELUI DE LA LECTURE (lib/lecture.js) : PP-OCRv5 latin, 7,9 Mo, et ses
   caractères. Sur le processeur : ses lignes changent toutes de largeur,
   la carte graphique recompilerait ses calculs à chacune. */
const MODELE_LECTURE = 'ppocrv5-latin-rec.onnx'
const TAILLE_LECTURE = 7862832
const CARACTERES = 'ppocrv5-latin-dict.txt'
/* CELUI DU SUJET D'UNE PHOTO (lib/sujet.js) : BiRefNet « lite », 115 Mo, en
   deux morceaux (GitHub refuse un fichier de plus de 100 Mo), recollés au
   téléchargement. */
const MODELE_PHOTO = ['birefnet-lite-fp16.1.onnx', 'birefnet-lite-fp16.2.onnx']
const TAILLE_PHOTO = 114652036

/* LES ÉTAPES DE LA PRÉPARATION (lib/studio-detourage.js, `evenement`) :
   au milieu des messages d'avancement, chaque étape dit son début, sa fin
   — sa durée, mesurée ici — ou son échec : { etape, etat, part, ms }.
   `fin(r, ms)` y ajoute ce qu'elle a fait. Rien du calcul ne change. */
const duree = t0 => Math.round(performance.now() - t0)
async function etape(nom, progres, calcul, fin = () => ({})) {
  const t0 = performance.now()
  progres({ etape: nom, etat: 'debut', part: 0 })
  try {
    const r = await calcul()
    progres(Object.assign({ etape: nom, etat: 'fin', part: 1, ms: duree(t0) }, fin(r, performance.now() - t0)))
    return r
  } catch (e) {
    progres({ etape: nom, etat: 'echec', ms: duree(t0), message: (e && e.message) || String(e) })
    throw e
  }
}

/* LA CARTE GRAPHIQUE, s'il y en a une vraie. Une carte « de secours »
   (SwiftShader, dessinée par le processeur) mettrait des minutes : le
   WebAssembly va plus vite. `f16` : elle doit aussi calculer en
   demi-précision (« shader-f16 »). */
const cartes = {}
function carteGraphique({ f16 = false } = {}) {
  cartes[f16] = cartes[f16] || jauger(f16)
  return cartes[f16]
}
async function jauger(f16) {
  try {
    if (typeof navigator === 'undefined' || !navigator.gpu) return false
    const a = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })
    if (!a) return false
    const info = a.info || {}
    if (a.isFallbackAdapter || info.isFallbackAdapter) return false
    if (f16 && !a.features.has('shader-f16')) return false
    return !/swiftshader|llvmpipe|software/i.test([info.vendor, info.architecture, info.description, info.device].join(' '))
  } catch {
    return false
  }
}

/* LE MODÈLE TÉLÉCHARGÉ — en un ou plusieurs morceaux (`url` : une adresse,
   ou leur liste), recollés —, l'avancement sur `taille` octets en tout. */
async function telecharger(url, progres, taille = TAILLE_MODELE) {
  const morceaux = []
  let recu = 0
  for (const u of [].concat(url)) {
    const rep = await fetch(u, { credentials: 'same-origin' })
    if (!rep.ok) throw new Error('Le modèle de l\'IA ne se télécharge pas (' + rep.status + ').')
    if (!rep.body) {
      const o = new Uint8Array(await rep.arrayBuffer())
      morceaux.push(o)
      recu += o.length
      continue
    }
    const annonce = rep.headers.get('Content-Encoding') || Array.isArray(url) ? 0 : Number(rep.headers.get('Content-Length')) || 0
    const attendu = annonce || taille
    const lecteur = rep.body.getReader()
    for (;;) {
      const { done, value } = await lecteur.read()
      if (done) break
      morceaux.push(value)
      recu += value.length
      progres({ etape: 'telechargement', part: Math.min(1, recu / attendu) })
    }
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
      /* La carte graphique que `carteGraphique` a jaugée, pas une autre. */
      ort.env.webgpu.powerPreference = 'high-performance'
      return ort
    }).catch(e => { moteurOnnx = null; throw e })
  }
  return moteurOnnx
}

/* UN MODÈLE, chargé une fois par fil : sur la carte graphique quand il y en
   a une vraie (et que `carte` le permet) — en demi-précision quand elle
   sait (`demi` : [fichier, taille] du même modèle en float16) —, sinon sur
   le processeur. Un échec (réseau coupé) se rejoue au message suivant.
   `entier` : la carte graphique en float32 (la demi-précision a rendu des
   « NaN ») ; `processeur` : le processeur. `demi` vrai dans la réponse :
   la session calcule en float16. */
function chargeur(nom, taille, { carte = true, demi = null } = {}) {
  let chargement = null
  return (progres, { processeur = false, entier = false } = {}) => {
    if (!chargement || processeur || entier) {
      /* La session remplacée (la carte graphique en demi-précision, celle
         qui a lâché) rend sa mémoire tout de suite, pas à la fermeture du
         fil : les calculs passent un par un (`fileIA`), elle ne sert plus. */
      if (chargement) chargement.then(c => c && c.session && c.session.release && c.session.release()).catch(() => {})
      chargement = (async () => {
        const ort = await onnx()
        const essais = []
        if (carte && !processeur && await carteGraphique()) {
          if (demi && !entier && await carteGraphique({ f16: true })) essais.push(['webgpu', demi])
          essais.push(['webgpu', [nom, taille]])
        }
        essais.push(['wasm', [nom, taille]])
        const octets = {}
        for (const [moteur, [fichier, poids]] of essais) {
          octets[fichier] = octets[fichier] || await telecharger(new URL(fichier, VENDOR), progres, poids)
          progres({ etape: 'preparation' })
          try {
            const session = await ort.InferenceSession.create(octets[fichier], { executionProviders: [moteur], graphOptimizationLevel: 'all', logSeverityLevel: 3 })
            return { ort, session, moteur, demi: fichier !== nom }
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
const modeleNettoyage = chargeur(MODELE_NETTOYAGE, TAILLE_NETTOYAGE, { demi: DEMI_NETTOYAGE })
const modeleMatiere = chargeur(MODELE_MATIERE, TAILLE_MATIERE, { demi: DEMI_MATIERE })
const modeleLecture = chargeur(MODELE_LECTURE, TAILLE_LECTURE, { carte: false })

/* LES LIGNES LUES (lib/lecture.js), dans ce fil : le modèle et ses
   caractères chargés une fois. */
let caracteres = null
async function lire(images, progres) {
  const { ort, session } = await modeleLecture(progres)
  caracteres = caracteres || fetch(new URL(CARACTERES, VENDOR)).then(r => {
    if (!r.ok) throw new Error('les caractères de la lecture : ' + r.status)
    return r.text()
  }).then(lireDictionnaire).catch(e => { caracteres = null; throw e })
  const dict = await caracteres
  const entree = session.inputNames[0], nom = session.outputNames[0]
  return lireLignes(images, async (e, W) => {
    const sortie = await session.run({ [entree]: new ort.Tensor('float32', e, [1, 3, HAUT, W]) }, [nom])
    const [, T, C] = sortie[nom].dims
    const probs = await sortie[nom].getData()
    if (sortie[nom].dispose) sortie[nom].dispose()
    return { probs, T, C }
  }, dict)
}

/* LE SUJET D'UNE PHOTO par BiRefNet (lib/sujet.js), sur une carte
   graphique qui calcule en demi-précision, seulement : sinon null, et
   ISNet s'en charge — comme si la carte rend n'importe quoi (des « NaN »,
   ou partout la même valeur). Ses octets se gardent ; sa session, non :
   ses 400 Mo sur la carte graphique se rendent aussitôt (« Améliorer
   l'image » en a besoin après). */
let octetsPhoto = null
async function sujetPhoto(m, progres) {
  if (!await carteGraphique({ f16: true })) return null
  const ort = await onnx()
  octetsPhoto = octetsPhoto || telecharger(MODELE_PHOTO.map(n => new URL(n, VENDOR)), progres, TAILLE_PHOTO).catch(e => { octetsPhoto = null; throw e })
  const octets = await octetsPhoto
  progres({ etape: 'preparation' })
  const session = await ort.InferenceSession.create(octets, { executionProviders: ['webgpu'], graphOptimizationLevel: 'all', logSeverityLevel: 3 })
  try {
    progres({ etape: 'calcul', moteur: 'webgpu', modele: 'birefnet' })
    const entree = new ort.Tensor('float32', entreeModele(m.data, m.largeur, m.hauteur, COTE_MODELE, BIREFNET), [1, 3, COTE_MODELE, COTE_MODELE])
    const nom = session.outputNames[0]
    const sortie = await session.run({ [session.inputNames[0]]: entree }, [nom])
    const logits = await sortie[nom].getData()
    if (sortie[nom].dispose) sortie[nom].dispose()
    let bas = Infinity, haut = -Infinity
    for (const v of logits) { if (v < bas) bas = v; if (v > haut) haut = v }
    if (!(haut - bas >= 1)) return null
    return { masque: masqueEnOctets(logits, BIREFNET), cote: COTE_MODELE, moteur: 'webgpu', modele: 'birefnet' }
  } finally {
    await session.release()
  }
}

/* LE SUJET D'UNE IMAGE : ses probabilités, en octets, en `cote` × `cote`
   (1 024 : la taille où le modèle a appris ; les tests le font tourner
   plus petit). Une image collée sur une toile transparente se cherche sur
   elle seule (lib/sujet.js, `rogner`). */
async function trouverSujet(m, progres) {
  const colle = imageCollee(m.data, m.largeur, m.hauteur)
  if (!colle) return sujetDe(m, progres)
  const r = await sujetDe(Object.assign({}, m, { data: rogner(m.data, m.largeur, colle), largeur: colle.largeur, hauteur: colle.hauteur }), progres)
  return r.masque ? Object.assign(r, { masque: replacer(r.masque, r.cote, colle, m.largeur, m.hauteur) }) : r
}

/* Une photo passe d'abord à BiRefNet (`sujetPhoto`) — et ce qui a de la
   MATIÈRE (`m.matiere`, lib/detourage.js, `aDeLaMatiere`) : une
   illustration peinte, un ruban de tissu (30 septembre 2026 : ISNet y
   perdait le ruban de « Strong Together », BiRefNet trouve la femme, ses
   fleurs, son ruban, et la boucle vide). Un logo à plat, ou ce que
   BiRefNet n'a pas pu faire, passe à ISNet. BiRefNet en échec (la mémoire
   de la carte graphique, son délai) a pu emporter la carte : ISNet passe
   alors au processeur, et BiRefNet ne se retente plus dans ce fil
   (`photoKo`). La carte graphique qui rendrait n'importe quoi (des « NaN »)
   ou qui lâche laisse aussi la place au processeur. */
let photoKo = false
async function sujetDe(m, progres) {
  let processeur = false
  if (!m.cote && !photoKo && (m.matiere || bordDuFond(m.data, m.largeur, m.hauteur).part < PHOTO)) {
    try {
      const r = await sujetPhoto(m, progres)
      if (r) return r
    } catch (e) {
      console.warn('BiRefNet :', e)
      photoKo = processeur = true
    }
  }
  /* `exiger` : BiRefNet ou rien (lib/graphiste.js, `birefnet`). */
  if (m.exiger) return { masque: null, cote: 0, moteur: '', modele: '' }
  let { ort, session, moteur } = await modele(progres, { processeur })
  const cote = m.cote || COTE_MODELE
  const entree = entreeModele(m.data, m.largeur, m.hauteur, cote)
  for (;;) {
    progres({ etape: 'calcul', moteur, modele: 'isnet' })
    const tenseur = new ort.Tensor('float32', entree, [1, 3, cote, cote])
    const nom = session.outputNames[0]
    let probabilites
    try {
      const sortie = await session.run({ [session.inputNames[0]]: tenseur }, [nom])
      probabilites = await sortie[nom].getData()
      if (sortie[nom].dispose) sortie[nom].dispose()
    } catch (e) {
      if (moteur !== 'webgpu') throw e
      probabilites = [NaN]
    }
    if (moteur === 'webgpu' && probabilites.some(Number.isNaN)) {
      ({ ort, session, moteur } = await modele(progres, { processeur: true }))
      continue
    }
    return { masque: masqueEnOctets(probabilites), cote, moteur, modele: 'isnet' }
  }
}

/* UN PASSAGE DU MODÈLE sur une tuile : sa sortie, en plans. La carte
   graphique qui rendrait n'importe quoi (des « NaN »), ou qui lâche (sa
   mémoire, un autre modèle qui l'a emportée), se dit. */
const passage = (ort, session, moteur) => async (entree, l, h) => {
  const nom = session.outputNames[0]
  let d
  try {
    const sortie = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', entree, [1, 3, h, l]) }, [nom])
    d = await sortie[nom].getData()
    if (sortie[nom].dispose) sortie[nom].dispose()
  } catch (e) {
    if (moteur !== 'webgpu') throw e
    throw Object.assign(e, { nan: true })
  }
  if (moteur === 'webgpu' && d.some(Number.isNaN)) throw Object.assign(new Error('NaN'), { nan: true })
  return d
}

/* L'IMAGE QUE VOIT LE MODÈLE : le fichier réduit à `cote` pixels au plus —
   et, avec « Améliorer la netteté » (`m.flou` : le flou mesuré, en
   pixels du fichier ; lib/nettete.js), défloutée d'abord (`nette`).
   Jamais si petite que le dessin ×4 sortirait plus petit que le fichier.
   Gardée sur le message : l'Ultra jugée trop lente laisse la place au
   nettoyage, sur la même image. « Améliorer la netteté » est une étape de
   la préparation : sa durée (`m.msNet`) ne compte pas dans celle de
   l'IA. */
function imageDuModele(m, cote, progres) {
  if (m.vue && m.vue.cote === cote) return m.vue.img
  let img = reduire(m.data, m.largeur, m.hauteur, cote)
  if (m.flou > 0) {
    const t0 = performance.now()
    progres({ etape: 'net', etat: 'debut', part: 0 })
    progres({ etape: 'nettete', part: 0 })
    let n
    try {
      n = rendreNet(img, m.flou * img.largeur / m.largeur, { min: Math.ceil(Math.max(m.largeur, m.hauteur) / FACTEUR), progres: part => progres({ etape: 'nettete', part }) })
    } catch (e) {
      progres({ etape: 'net', etat: 'echec', ms: duree(t0), message: (e && e.message) || String(e) })
      throw e
    }
    if (n.sigma) img = Object.assign(n, { nette: true })
    m.msNet = (m.msNet || 0) + performance.now() - t0
    progres({ etape: 'net', etat: 'fin', part: 1, ms: duree(t0), nette: !!n.sigma })
  }
  m.vue = { cote, img }
  return img
}

/* LE DESSIN GARDÉ, jugé contre le fichier reçu — jusqu'à une fois et demie
   l'image du modèle, adouci au niveau de détail qu'elle avait : ses
   teintes ramenées à celles du fichier (`recaler`), ses lettres qui
   gardent leur forme (`fidele`), aucune couleur inventée — ni liseré
   sombre, ni cœur noirci (`borner`). `img` : l'image qu'a vue le modèle.
   Rendue nette, c'est contre elle qu'il se juge : adoucis de moins d'un
   pixel, un bord franc et un bord flou de trois ne se superposent pas —
   jugé contre le fichier flou, le garde-fou y ramènerait le flou. Elle,
   défloutée, reste tenue par le fichier (lib/nettete.js). */
function garder(r, img, m) {
  const src = img.nette ? img : reduire(m.data, m.largeur, m.hauteur, Math.round(JUGE * Math.max(img.largeur, img.hauteur)))
  recaler(r.data, r.largeur, r.hauteur, src.data, src.largeur, src.hauteur)
  fidele(r.data, r.largeur, r.hauteur, src.data, src.largeur, src.hauteur, { flou: FLOU * src.largeur / img.largeur })
  borner(r.data, r.largeur, r.hauteur, src.data, src.largeur, src.hauteur, { rayon: Math.max(1, Math.round(src.largeur / img.largeur)) })
  return Object.assign(r, { entree: Math.max(img.largeur, img.hauteur), nette: !!img.nette })
}

/* L'ULTRA (lib/nettoyage.js), sur la carte graphique seulement : le
   processeur y passerait des minutes. Le poste se jauge sur la première
   tuile — deux passages : le premier prépare la carte, le second se
   chronomètre — et l'Ultra prend le plus d'orientations qui tiennent dans
   `budget` millisecondes : huit, quatre ou deux. Aucune : `{ lent }`, et
   le temps qu'il faudrait en huit (`estime`), pour que la vendeuse
   choisisse. `budget` nul : huit, sans jauger. Sans carte graphique, ou
   si elle rend des « NaN » : null. Le temps jaugé part avec l'avancement
   (`estime`) : le temps qui reste, dans le panneau de la préparation.
   Une tuile toute d'une couleur ne passe qu'une fois (lib/nettoyage.js,
   `aireACalculer`) : le fond d'un PNG transparent ne compte pas dans le
   temps jaugé. La demi-précision qui rend des « NaN » laisse la place au
   float32 (`entier`). */
const PASSES_ULTRA = [8, 4, 2]
async function ultra(m, progres, entier = false) {
  if (!await carteGraphique()) return null
  const { ort, session, moteur, demi } = await modeleMatiere(progres, { entier })
  if (moteur !== 'webgpu') return null
  const img = imageDuModele(m, COTE_NETTOYAGE, progres)
  const calculer = passage(ort, session, moteur)
  try {
    let n = ORIENTATIONS.length
    let une = 0
    if (m.budget) {
      const l = Math.min(TUILE, img.largeur) + 2 * MARGE, h = Math.min(TUILE, img.hauteur) + 2 * MARGE
      const tuile = entreeTuile(img.data, img.largeur, img.hauteur, -MARGE, -MARGE, l, h)
      progres({ etape: 'preparation' })
      await calculer(tuile, l, h)
      const t0 = performance.now()
      await calculer(tuile, l, h)
      /* Une orientation sur toute l'image (l'opacité, s'il y en a une,
         passe à son tour). */
      une = (performance.now() - t0) / (l * h) * aireACalculer(img.data, img.largeur, img.hauteur)
      n = PASSES_ULTRA.find(k => k * une <= m.budget)
      if (!n) return { lent: true, estime: ORIENTATIONS.length * une }
    }
    progres({ etape: 'calcul', moteur, part: 0, ultra: n, estime: Math.round(n * une) })
    const r = await nettoyerParTuiles(img.data, img.largeur, img.hauteur, enOrientations(calculer, ORIENTATIONS.slice(0, n)), part => progres({ etape: 'calcul', moteur, part, ultra: n }))
    return Object.assign(garder(r, img, m), { moteur, ultra: n })
  } catch (e) {
    if (e.nan) return demi ? ultra(m, progres, true) : null
    throw e
  }
}

/* LE LOGO NETTOYÉ (lib/nettoyage.js) : redessiné quatre fois plus grand,
   entier jusqu'à 1 280 px sur la carte graphique, réduit à 768 px sur le
   processeur, puis gardé (`garder`). La carte graphique qui rendrait
   n'importe quoi laisse la place au processeur. `m.matiere` : l'IA des
   photos, pas celle des logos. `m.ultra` : l'Ultra d'abord — un logo à
   plat comme une matière, qui y passe aussi depuis le 1er octobre 2026
   (c'est déjà l'IA des photos, huit fois) —, si le poste la tient dans
   `m.budget` — sinon le nettoyage, et le temps qu'il aurait fallu à
   l'Ultra, son contrôle compris (`estimeUltra`). Une Ultra en échec
   laisse aussi la place au nettoyage.
   `entree` : le grand côté de l'image qu'a vue le modèle ; `ultra` : les
   orientations de l'Ultra (0 : pas d'Ultra). */
async function nettoyer(m, progres) {
  let estime = 0
  if (m.ultra) {
    const u = await ultra(m, progres).catch(e => { console.warn('Ultra :', e); return null })
    if (u && !u.lent) return u
    if (u) estime = u.estime
  }
  const charger = m.matiere ? modeleMatiere : modeleNettoyage
  /* La carte graphique, en demi-précision si elle sait ; ses « NaN » : en
     float32 ; encore : le processeur. */
  for (let essai = {}; ;) {
    const { ort, session, moteur, demi } = await charger(progres, essai)
    const img = imageDuModele(m, moteur === 'webgpu' ? COTE_NETTOYAGE : COTE_PROCESSEUR, progres)
    progres({ etape: 'calcul', moteur, part: 0, ultra: 0 })
    try {
      const r = await nettoyerParTuiles(img.data, img.largeur, img.hauteur, passage(ort, session, moteur), part => progres({ etape: 'calcul', moteur, part, ultra: 0 }))
      const t0 = performance.now()
      garder(r, img, m)
      return Object.assign(r, { moteur, ultra: 0, estimeUltra: estime && Math.round(estime + performance.now() - t0) })
    } catch (e) {
      if (!e.nan || essai.processeur) throw e
      essai = demi ? { entier: true } : { processeur: true }
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
/* LA RÉSERVE DU POSTE (lib/polices-poste.js, 1er octobre 2026) : les
   familles des polices installées sur le poste (`poste`) et des polices
   déposées (`ajout`), ajoutées à celles de Google — elles se
   reconnaissent pareil. Leurs octets ne sont pas ici : le fil les demande
   à la page quand il lui en faut une (`fournir`, lib/reserve-polices.js,
   `octets`). */
const reserve = { poste: [], ajout: [], liste: null }
async function toutes() {
  const g = await familles()
  return reserve.liste || (reserve.liste = g.concat(reserve.poste, reserve.ajout))
}
/* LES OCTETS D'UNE FACE DE LA RÉSERVE : dans un fil, demandés à la page
   (`besoin`, `fourni`) ; dans la page, à `fournisseur` (`fournirPolices`). */
let fournisseur = null
export function fournirPolices(f) { fournisseur = f }
const attenteOctets = new Map()
let nOctets = 0
const dansUnFil = typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' && self instanceof WorkerGlobalScope
function fournir(source, cle) {
  if (!dansUnFil) return fournisseur ? fournisseur(source, cle) : Promise.resolve(null)
  return new Promise(ok => {
    const n = ++nOctets
    attenteOctets.set(n, ok)
    self.postMessage({ besoin: { source, cle }, n })
  })
}
/* Le nom d'une police proposée, sa graisse, son style, sa note — et sa
   face, pour une police de la réserve. */
const millieme = v => Math.round((v || 0) * 1000) / 1000
function propDe(p, pire = p.pire) {
  const f = p.fichier
  return Object.assign({ id: f.id, nom: f.nom, graisse: f.graisse, style: f.style, note: millieme(p.note), pire: millieme(pire) }, f.local ? { local: f.local, source: f.source, styleNom: f.styleNom } : {})
}

/* LE LEXIQUE (vendor/lexique/) : relire une écriture que l'OCR lit mal
   (lib/ecriture.js). Chargé à la première écriture ; sans lui, on fait
   avec ce qui a été lu. */
let lexique = null
function lireLexique() {
  /* Un échec (le réseau) se rejoue à l'écriture suivante. */
  lexique = lexique || fetch(new URL('lexique/mots.txt', VENDOR)).then(r => {
    if (!r.ok) throw new Error('lexique ' + r.status)
    return r.text()
  }).then(t => t.split('\n').filter(Boolean)).catch(() => { lexique = null; return [] })
  return lexique
}
/* Sous cette note, une écriture posée sur une ligne n'est pas proposée :
   ce n'était pas du texte (un morceau de dessin lu « of w »). */
const ECRITURE_MIN = 0.4
let opentype = null
const polices = new Map()
export function chargerPolice(f) {
  const cle = f.local ? f.source + ':' + f.local : f.id + '/' + f.graisse + f.style
  /* Le fil du texte vit d'une image à l'autre : au-delà de 600 polices
     lues, il oublie les plus anciennes (une police lue pèse son poids
     d'objets) — pas toutes d'un coup, en pleine recherche ; une police
     reprise repasse en fin de liste. */
  const deja = polices.get(cle)
  if (deja) {
    polices.delete(cle)
    polices.set(cle, deja)
    return deja
  }
  if (polices.size >= 600) polices.delete(polices.keys().next().value)
  const lue = (async () => {
    opentype = opentype || import(new URL('opentype.min.mjs', VENDOR).href)
    const { parse } = await opentype
    if (f.local) {
      const o = await fournir(f.source, f.local)
      return o ? lireFace(o, f.source === 'poste' ? f.local : null, parse) : null
    }
    let o
    try {
      o = await octetsGoogle('https://cdn.jsdelivr.net/fontsource/fonts/' + f.id + '@latest/latin-' + f.graisse + '-' + f.style + '.woff')
    } catch {
      /* Le réseau coupé, le CDN qui sature : elle se redemandera — elle
         manquait sinon jusqu'à la fermeture du fil, logo après logo. */
      if (polices.get(cle) === lue) polices.delete(cle)
      return null
    }
    return o ? parse(o) : null
  })().catch(() => null)
  polices.set(cle, lue)
  return lue
}
/* LES POLICES DE GOOGLE GARDÉES SUR LE POSTE (1er octobre 2026) : la
   première fois, une ligne en essaie deux cents (les 4 lignes d'un logo :
   750 fichiers, 17 Mo) ; le cache du navigateur les revalide chaque jour
   et les oublie quand la place manque. Gardées ici (Cache Storage), elles
   ne repassent plus par le réseau. Sans lui, le réseau. */
const RESERVE_GOOGLE = 'olda-polices-google-1'
let cacheGoogle = null
/* null : la police n'existe pas (404, pour de bon) ; une erreur : le
   réseau ou le serveur, à rejouer. Un seul appel au réseau. */
async function octetsGoogle(url) {
  let cache = null
  try {
    cacheGoogle = cacheGoogle || caches.open(RESERVE_GOOGLE)
    cache = await cacheGoogle
    const deja = await cache.match(url)
    if (deja) return await deja.arrayBuffer()
  } catch {
    cache = null
  }
  const r = await fetch(url)
  if (r.status === 404) return null
  if (!r.ok) throw new Error('police ' + r.status)
  if (cache) cache.put(url, r.clone()).catch(() => {})
  return await r.arrayBuffer()
}

/* Une lecture sûre : la ligne et son mot le moins sûr au-dessus de `seuil`. */
const lue = (l, seuil) => l.confiance >= seuil && l.mot >= seuil
/* LE TEXTE CORRIGÉ, recousu sur celui qu'a lu l'OCR : ses espaces gardés,
   ses caractères remplacés un à un (sinon, les lettres corrigées seules). */
export function recoudreTexte(texte, lu) {
  let k = 0, sortie = ''
  for (const c of String(texte)) sortie += /\s/.test(c) ? c : k < lu.length ? lu[k++] : c
  return k === lu.length && [...String(texte).replace(/\s+/g, '')].length === lu.length ? sortie : lu
}

/* Les demandes au modèle passent l'une après l'autre : une session ne
   calcule qu'une image à la fois. */
let fileIA = Promise.resolve()

/* LE DÉTOURAGE D'UNE IMAGE, par la couleur ou par le sujet. `memoire`
   garde les coefficients du sujet (lib/sujet.js) d'un curseur à l'autre —
   ils ne dépendent que de l'image et du masque —, et le fond d'une image
   collée, à la couleur. */
/* LES ÉLÉMENTS RETIRÉS À LA MAIN (lib/effacer.js, `effaces` des
   réglages) partent ensuite, à la couleur comme au sujet. */
function detourage(img, m, memoire) {
  if (m.methode !== 'ia') {
    const r = detourer(img.data, img.largeur, img.hauteur, m.reglages, m.echelle || 1)
    effacer(r.data, img.largeur, img.hauteur, m.reglages.effaces)
    return r
  }
  if (!m.masque) throw new Error('Le sujet n\'est pas encore trouvé.')
  if (!memoire.affine || memoire.affine.image !== img || memoire.affine.cle !== m.cle) {
    memoire.affine = { image: img, cle: m.cle, coefficients: affinerMasque(img.data, img.largeur, img.hauteur, m.masque, m.cote || COTE_MODELE) }
  }
  const data = poserSujet(img.data, img.largeur, img.hauteur, memoire.affine.coefficients, { seuil: m.reglages.seuil })
  if (m.modele !== 'birefnet') recoudre(data, img.data, img.largeur, img.hauteur, m.reglages.interieur !== false)
  /* LE FOND CLAIR D'UNE IMAGE COLLÉE part aussi, comme à la couleur
     (30 septembre 2026, « Strong Together » : le modèle gardait le blanc
     de la carte sous le texte, relié à son bord). Seulement là : sur une
     vraie photo, le fond lu au bord mordrait une chemise blanche. Là où
     il part, ses pixels (le liseré fondu) remplacent ceux du sujet. */
  if (imageCollee(img.data, img.largeur, img.hauteur)) {
    const cle = [m.reglages.tolerance || TOLERANCE, m.echelle || 1].join()
    if (!memoire.autour || memoire.autour.image !== img || memoire.autour.cle !== cle) {
      memoire.autour = { image: img, cle, data: detourer(img.data, img.largeur, img.hauteur, { tolerance: m.reglages.tolerance || TOLERANCE, interieur: false }, m.echelle || 1).data }
    }
    const autour = memoire.autour.data
    for (let i = 0; i < data.length; i += 4) {
      if (autour[i + 3] < data[i + 3]) { data[i] = autour[i]; data[i + 1] = autour[i + 1]; data[i + 2] = autour[i + 2]; data[i + 3] = autour[i + 3] }
    }
  }
  effacer(data, img.largeur, img.hauteur, m.reglages.effaces)
  return { data, fonds: [] }
}

/* L'INTÉRIEUR DU SUJET REVIENT (27 septembre 2026 : « ça enlève toujours
   l'intérieur du logo »). L'IA prend le creux d'un O pour du décor : la
   pastille jaune d'un O, le triangle bleu d'un A partaient avec. Seul le
   fond qui touche le bord de l'image est du décor sûr ; ce qu'il enferme
   revient tel quel — ou, avec « Intérieur du logo aussi », tout sauf les
   creux couleur de ce décor (le blanc du creux part, la pastille reste, le
   reflet pâle d'un dégradé aussi : lib/detourage.js, `creux`).
   C'est l'erreur d'ISNet sur un logo. BiRefNet, qui ne voit que des
   photos et de la matière, ne se trompe pas de creux : la boucle d'un
   ruban, le jour entre un bras et le corps sont du décor (30 septembre
   2026) — son masque se garde tel quel. */
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
  /* LE BORD DU SUJET : le liseré doux que le modèle a rendu autour (alpha
     128 à 249), qui touche le décor, reste tel quel (`dehors` = 2) — compté
     « enfermé », il repassait opaque à la couleur brute du fichier, un fil
     du décor avec (l'herbe verte autour d'un sujet rouge). Quelques pixels
     au plus : le jour d'une lettre garde le sien et revient. */
  let rang = []
  const bord = p => { const a = data[p * 4 + 3]; if (!dehors[p] && a >= 128 && a < 250) { dehors[p] = 2; rang.push(p) } }
  for (let p = 0; p < n; p++) {
    if (dehors[p] !== 1) continue
    const x = p % largeur
    if (x > 0) bord(p - 1)
    if (x < largeur - 1) bord(p + 1)
    if (p >= largeur) bord(p - largeur)
    if (p < n - largeur) bord(p + largeur)
  }
  for (let k = 1; k < BORD_SUJET && rang.length; k++) {
    const avant = rang
    rang = []
    for (const p of avant) {
      const x = p % largeur
      if (x > 0) bord(p - 1)
      if (x < largeur - 1) bord(p + 1)
      if (p >= largeur) bord(p - largeur)
      if (p < n - largeur) bord(p + largeur)
    }
  }
  const fonds = interieur ? fondsLus(source, data) : []
  const enfermes = []
  const candidat = new Uint8Array(n)
  for (let p = 0; p < n; p++) {
    const i = p * 4
    if (dehors[p] || data[i + 3] >= 250) continue
    enfermes.push(p)
    if (fonds.some(f => Math.max(Math.abs(source[i] - f[0]), Math.abs(source[i + 1] - f[1]), Math.abs(source[i + 2] - f[2])) < tolerance)) candidat[p] = 1
  }
  /* Un creux et son ombre (lib/detourage.js, `creux`) restent vides ; le
     reste revient. */
  const trous = fonds.length ? creux(source, largeur, hauteur, candidat, fonds, { hors: dehors, tolerance }) : null
  /* Il revient tel qu'il est dans le fichier — un creux transparent d'un
     PNG reste transparent (il revenait opaque, du noir caché dessous). */
  for (const p of enfermes) {
    if (trous && trous[p]) continue
    const i = p * 4
    data[i] = source[i]; data[i + 1] = source[i + 1]; data[i + 2] = source[i + 2]; data[i + 3] = source[i + 3]
  }
}
/* La largeur du liseré doux d'un sujet, en pixels de l'aperçu. */
const BORD_SUJET = 6

/* UN MESSAGE, UNE RÉPONSE. `memoire` garde l'image d'un message à l'autre :
   elle ne traverse qu'une fois, les réglages seuls passent ensuite.
   `progres` reçoit l'avancement d'un long calcul (l'IA), et les étapes de
   la préparation (`etape`) : le détourage, l'IA — sans le temps de
   « Améliorer la netteté » —, le sujet, le texte (lu, ses polices
   cherchées, ses lettres posées), le tracé final et son contrôle. L'IA
   et le sujet commencent quand leur tour vient dans la file. */
const ETAPE_DU_MESSAGE = { calcul: 'detourage', texte: 'texte', polices: 'texte', poses: 'texte' }
export function traiter(m, memoire, progres = () => {}) {
  const nom = ETAPE_DU_MESSAGE[m.type]
  return nom ? etape(nom, progres, () => repondre(m, memoire, progres)) : repondre(m, memoire, progres)
}

async function repondre(m, memoire, progres) {
  if (m.type === 'source') {
    memoire.apercu = m
    memoire.affine = null
    /* Le tracé gardé de l'image d'avant (son détourage et son image en
       pleine taille, des centaines de Mo) part avec elle. */
    memoire.vecteur = null
    return {}
  }
  if (m.type === 'oublier') {
    memoire.vecteur = null
    return {}
  }
  if (m.type === 'calcul') {
    const r = detourage(memoire.apercu, m, memoire)
    return { reponse: { data: r.data, fonds: r.fonds }, transfert: [r.data.buffer] }
  }
  if (m.type === 'nettoyer') {
    const tache = fileIA.then(() => etape('ia', progres, () => nettoyer(m, progres), (r, ms) => ({ ms: Math.round(ms - (m.msNet || 0)), ultra: r.ultra })))
    fileIA = tache.catch(() => {})
    const r = await tache
    return { reponse: r, transfert: [r.data.buffer] }
  }
  if (m.type === 'ia') {
    const tache = fileIA.then(() => etape('sujet', progres, () => trouverSujet(m, progres), r => ({ modele: r.modele })))
    fileIA = tache.catch(() => {})
    const r = await tache
    return { reponse: r, transfert: r.masque ? [r.masque.buffer] : [] }
  }
  /* LE TEXTE DE L'IMAGE (lib/texte.js) : ses lignes, trouvées une fois par
     image, en pleine taille, quelle que soit la version, et lues ici
     (lib/lecture.js). Seules passent à la lecture celles qu'on pourrait
     remplacer : entières, et d'au moins dix pixels de lecture. `petite` :
     trop petite pour qu'une police s'y pose d'office (sous 14 pixels de
     lecture, ou 7 du fichier reçu — `origine`, son grand côté avant
     l'IA). */
  if (m.type === 'texte') {
    const t = lignesImage(m.data, m.largeur, m.hauteur)
    const cote = Math.max(m.largeur, m.hauteur)
    const haute = l => { const v = l.map(x => x.y1 - x.y0 + 1).sort((a, b) => a - b); return v[Math.min(v.length - 1, Math.floor(0.9 * v.length))] }
    t.lignes = t.lignes.filter(l => l.entiere && haute(l) >= 10)
    memoire.texte = Object.assign(t, { cle: m.cle, source: { data: m.data, largeur: m.largeur, hauteur: m.hauteur }, symboles: [] })
    let images = t.lignes.map(l => imageLigne(l, largeurDe(l, t.W)))
    let lus = images.length ? await lire(images, progres) : []
    /* Deux lectures d'un même texte (droite et courbe, lib/texte.js
       `rivales`) : la mieux lue reste — sûre d'abord ; sûres toutes deux,
       celle qui a le plus de lettres (« Réserve Naturelle de Saint-Martin »
       plutôt que « Réserve »), puis la courbe ; sinon la plus confiante. */
    const note = i => {
      const sure = lue(lus[i], 80), c = Math.min(lus[i].confiance, lus[i].mot)
      return (sure ? 1e6 + 1000 * t.lignes[i].filter(x => !x.ponctuation).length : 0) + c + (t.lignes[i].courbe ? 0.5 : 0)
    }
    const garder = t.lignes.map(() => true)
    t.lignes.forEach((l, i) => {
      for (const o of l.rivales || []) {
        const j = t.lignes.indexOf(o)
        if (j < 0 || !garder[i] || !garder[j]) continue
        if (note(j) > note(i)) garder[i] = false
        else garder[j] = false
      }
    })
    if (garder.includes(false)) {
      t.lignes = t.lignes.filter((_, i) => garder[i])
      images = images.filter((_, i) => garder[i])
      lus = lus.filter((_, i) => garder[i])
    }
    /* `grasMax` : le gras que son curseur à fond ajoute autour de ses
       lettres, en pixels de l'image (lib/texte.js, `grasPx`). */
    /* `contour` : le tour d'une ligne courbe sur le plan (lib/courbes.js),
       en pixels de lecture — le studio y dessine sa bande et y cherche la
       souris ; `chaine` : une ligne refaite d'une chaîne de lettres
       (lib/texte.js), proposée comme une courbe. */
    /* `ombre` : ses lettres ont une ombre portée (lib/texte.js) — sa police
       n'est pas posée d'office : elle l'effacerait. */
    const image = { data: m.data, largeur: m.largeur, hauteur: m.hauteur, f: t.f }
    const lignes = t.lignes.map((l, i) => {
      const petite = haute(l) < 14 || haute(l) / t.f * (m.origine || cote) / cote < 7
      /* L'ombre ne se cherche que là où une police pourrait se poser
         d'office : ni une petite ligne, ni une courbe, ni une chaîne. */
      return { boite: images[i].boite, contour: l.courbe ? l.courbe.contour.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]) : null, chaine: !!l.chaine, petite, grasMax: grasPx(100, l.hauteur, t.f), ombre: !petite && !l.courbe && !l.chaine && ombrePortee(l, t.W, t.H, image) }
    })
    return { reponse: { lignes, lus, f: t.f } }
  }
  /* LES POLICES DES LIGNES LUES (lib/polices.js) : pour chaque ligne du
     texte de l'image dont on a la lecture, la police et ses équivalents. */
  if (m.type === 'polices') {
    const t = memoire.texte && memoire.texte.cle === m.cle ? memoire.texte : null
    if (!t) throw new Error('sans-texte')
    const garde = { lignes: t.lignes, largeur: t.W, r: t.source, image: { largeur: t.source.largeur, hauteur: t.source.hauteur } }
    const fams = await toutes()
    const lignes = []
    const n = Math.max(garde.lignes.length, (m.textes || []).length)
    for (let i = 0; i < n; i++) {
      const ligne = garde.lignes[i] || null
      if (!ligne) { lignes.push(null); continue }
      /* Les caractères lus et leurs cadres (lib/lecture.js), gardés pour
         poser leurs lettres (`poses`). */
      if (m.symboles) t.symboles[i] = m.symboles[i] || null
      /* Des lettres dont aucune ne tient seule (toutes coupées dans une
         forme qui en porte plusieurs) : une écriture liée, bien lue (« St
         Martin ») — pas des lettres à découper. */
      let glyphes = m.textes[i] ? glyphesDe(ligne, m.textes[i], largeurDe(ligne, garde.largeur), t.symboles[i]) : null
      if (glyphes && glyphes.every(g => g.colle)) glyphes = null
      /* UNE ÉCRITURE (lib/ecriture.js) : ses lettres ne se découpent pas
         (liées), ou l'OCR l'a mal lue — la ligne entière, parmi les
         écritures de la réserve, sur ce qu'on en a lu. */
      /* Ce qu'on en a lu : sa lecture peu sûre, ou sa lecture sûre (des
         lettres liées, bien lues, que la découpe lettre à lettre ne suit
         pas). */
      const lectures = m.lectures && m.lectures[i] && m.lectures[i].length ? m.lectures[i] : m.textes[i] ? [{ texte: m.textes[i], confiance: 90 }] : []
      /* D'une seule couleur (un dessin multicolore lu comme du texte n'a
         pas d'écriture), sauf si le texte a été tapé. */
      const unie = lectures.some(l => l.impose) || !garde.image || ligneUnie(ligne.courbe ? ligne.map(l => ({ pixels: l.image })) : ligne, garde.largeur, garde.r.data, garde.image.largeur, garde.image.hauteur)
      if (!glyphes && lectures.length && unie) {
        const r = await choisirEcriture(ligne, largeurDe(ligne, garde.largeur), lectures, fams.filter(f => f.avance), chargerPolice, await lireLexique())
        /* Un texte tapé à la main a toujours ses écritures : on les a
           demandées. */
        if (r && r.props[0] && (r.props[0].note >= ECRITURE_MIN || lectures.some(l => l.impose))) {
          lignes.push({
            texte: r.texte, ecriture: true,
            props: r.props.map(p => propDe(p, p.note)),
          })
        } else lignes.push(null)
        progres({ etape: 'polices', part: (i + 1) / n })
        continue
      }
      if (!glyphes) { lignes.push(null); continue }
      /* Une lecture sûre (`sures` : chaque mot à 95 et plus) ne se corrige
         pas par la police : le « fi » lié d'un « financier » bien lu n'y
         devient pas « hi ». */
      const props = await choisirPolices(glyphes, fams, chargerPolice, { relu: !!(m.sures && m.sures[i]) })
      lignes.push(props.length ? { brut: { cadre: boiteDe(ligne), courbe: !!ligne.courbe, polarite: ligne.polarite || 0, glyphes, props }, lu: m.textes[i] } : null)
      progres({ etape: 'polices', part: (i + 1) / n })
    }
    /* Une famille par bloc de texte (lib/polices.js, `harmoniser`). */
    const bruts = lignes.filter(l => l && l.brut)
    if (bruts.length > 1) await harmoniser(bruts.map(l => l.brut), fams, chargerPolice)
    for (let i = 0; i < lignes.length; i++) {
      const l = lignes[i]
      if (!l || !l.brut) continue
      const props = l.brut.props
      /* Le texte, corrigé par la police s'il le faut (un « J » lu pour un
         « d »), ses espaces gardés. */
      const lu = props[0] && props[0].lu
      lignes[i] = {
        texte: lu ? recoudreTexte(l.lu, lu) : l.lu,
        props: props.map(p => propDe(p)),
      }
    }
    return { reponse: { lignes } }
  }
  /* LE FIL DU TEXTE SE PRÉPARE (1er octobre 2026), à l'ouverture de la
     page, pendant qu'on choisit le fichier : le modèle de la lecture,
     ses caractères et l'index des polices — le premier logo ne les attend
     plus. */
  if (m.type === 'prechauffer') {
    await Promise.all([modeleLecture(() => {}).catch(() => null), familles().catch(() => null)])
    return { reponse: { pret: true } }
  }
  /* LA RÉSERVE DU POSTE : des faces lues et mesurées (`decrire` : leurs
     octets → leurs descriptions, null pour une face qui n'est pas une
     police de texte latin), puis leurs familles posées à côté de celles
     de Google (`reserve`, sans rien attendre : la recherche qui suit les
     trouve). */
  if (m.type === 'decrire') {
    opentype = opentype || import(new URL('opentype.min.mjs', VENDOR).href)
    const { parse } = await opentype
    const faces = m.faces.map(f => {
      try { return decrireFace(lireFace(f.octets, f.cle, parse), { cle: f.cle, famille: f.famille, style: f.style }) } catch { return null }
    })
    return { reponse: { faces } }
  }
  if (m.type === 'reserve') {
    reserve[m.source === 'ajout' ? 'ajout' : 'poste'] = famillesPoste(m.faces || [], m.source === 'ajout' ? 'ajout' : 'poste')
    reserve.liste = null
    return { reponse: { familles: reserve[m.source === 'ajout' ? 'ajout' : 'poste'].length } }
  }
  /* LE CATALOGUE, pour la recherche d'une police par son nom : chaque
     famille (Google, le poste, les déposées), et la face qui la montre
     (la plus proche du Regular). */
  if (m.type === 'catalogue') {
    const fams = await toutes()
    return {
      reponse: {
        familles: fams.map(f => {
          const fi = f.fichiers.slice().sort((a, b) => Math.abs(a.graisse - 400) - Math.abs(b.graisse - 400))[0]
          return { id: f.id, nom: f.nom, style: f.style, cat: f.cat, source: f.source || 'google', face: Object.assign({ id: f.id, nom: f.nom, graisse: fi.graisse, style: fi.style }, fi.local ? { local: fi.local, source: fi.source } : {}) }
        }),
      },
    }
  }
  /* UNE FAMILLE CHOISIE À LA MAIN (la recherche de la bulle) : `famille`
     (son id — pas `id`, le numéro de la demande) et son `style`, sa
     meilleure graisse sur la ligne `ligne`, notée — une écriture, posée
     sur la ligne entière. null : elle ne s'y pose pas. */
  if (m.type === 'essayer') {
    const t = memoire.texte && memoire.texte.cle === m.cle ? memoire.texte : null
    if (!t) throw new Error('sans-texte')
    const fams = await toutes()
    const fam = fams.find(f => f.id === m.famille && (f.style || 'normal') === (m.style || 'normal')) || fams.find(f => f.id === m.famille)
    const ligne = t.lignes[m.ligne]
    if (!fam || !ligne) return { reponse: { prop: null } }
    let glyphes = m.ecriture ? null : glyphesDe(ligne, m.texte, largeurDe(ligne, t.W), t.symboles[m.ligne])
    if (glyphes && glyphes.every(g => g.colle)) glyphes = null
    if (glyphes) {
      const p = await essayerFamille(glyphes, fam, chargerPolice)
      return { reponse: { prop: p ? propDe(p) : null, ecriture: false } }
    }
    if (!fam.avance) return { reponse: { prop: null } }
    const r = await choisirEcriture(ligne, largeurDe(ligne, t.W), [{ texte: m.texte, confiance: 100, impose: true }], [fam], chargerPolice, await lireLexique())
    const p = r && r.props[0]
    return { reponse: { prop: p ? propDe(p, p.note) : null, ecriture: true } }
  }
  /* LE CONTOUR (lib/contour.js) : l'encre du dessin (`encre`, peinte par
     le studio dans une toile qui a sa marge) élargie de `px` pixels, puis
     tracée comme le reste — rend ses chemins et son cadre, en pixels de la
     toile. */
  if (m.type === 'contour') {
    const rgba = elargir(m.encre, m.largeur, m.hauteur, m.px)
    const v = vectoriserLisse(rgba, m.largeur, m.hauteur, { mono: true, alpha: true, lissage: m.lissage, miettes: false })
    const d = (v.svg.match(/ d="[^"]*"/g) || []).map(x => x.slice(4, -1)).join('')
    return { reponse: { d, cadre: v.cadre } }
  }
  /* LES LETTRES POSÉES (lib/texte.js) : pour chaque ligne dont la police
     est choisie (`polices` : { boite, texte, ecriture, id, graisse, style,
     gras }), le chemin de ses lettres — épaissies de son « Gras » — et ce
     qu'elles remplacent ; et les zones
     de l'image à repeindre pour le Détouré. */
  if (m.type === 'poses') {
    const t = memoire.texte && memoire.texte.cle === m.cle ? memoire.texte : null
    if (!t) throw new Error('sans-texte')
    const poses = []
    for (const c of m.polices || []) {
      const police = await chargerPolice(c)
      const ligne = police && ligneDe(t.lignes, c.boite)
      const p = ligne && poseLigne(ligne, t.W, t.f, { texte: c.texte, police, ecriture: c.ecriture, symboles: t.symboles[t.lignes.indexOf(ligne)], gras: grasPx(c.gras, ligne.hauteur, t.f) })
      if (p) poses.push(p)
    }
    return { reponse: { poses, texte: { f: t.f, W: t.W }, zones: zonesDe(poses, t.f, t.source.largeur, t.source.hauteur) } }
  }
  /* LE DÉTOURÉ REPEINT (lib/texte.js) : chaque zone de l'image détourée
     (`zones` : { x, y, l, h, data, poses }), ses lettres en police. */
  if (m.type === 'poser') {
    const t = memoire.texte && memoire.texte.cle === m.cle ? memoire.texte : null
    if (!t) throw new Error('sans-texte')
    const zones = m.zones.map(z => poserZone(z, z.poses.map(i => m.poses[i]), { f: t.f, W: t.W, encres: t.encres }))
    return { reponse: { zones }, transfert: zones.map(z => z.data.buffer) }
  }
  if (m.type === 'vecteur') {
    /* `detoure` : l'image arrive déjà détourée (le plan zoomé du studio
       l'a calculée en pleine taille) — rien à refaire. `source` : l'image
       reçue, dont les bords nets guident le contour (lib/vecteur-lisse.js). */
    /* `memo` : le même détourage qu'au message d'avant (seul le lissage a
       bougé) — détourage et couvertures sont repris, seul le tracé se refait. */
    const garde = m.memo && memoire.vecteur && memoire.vecteur.cle === m.memo ? memoire.vecteur : null
    /* Le studio n'envoie l'image qu'une fois par détourage : un fil qui ne
       l'a plus (il a redémarré) la redemande. */
    if (!garde && !m.data) throw new Error('sans-image')
    /* LE TRACÉ FINAL : une étape de la préparation (`etape`) — pas
       l'aperçu du curseur. */
    const suivi = !m.apercu ? progres : () => {}
    const t0 = performance.now()
    suivi({ etape: 'trace', etat: 'debut', part: 0 })
    /* Les voiles du fichier (une ombre à 40 % de Canva : lib/detourage.js,
       `voiles`) se tracent pleins, de la couleur qu'ils avaient sur la page
       blanche — le détourage comme l'image reçue qui guide le contour. */
    const voile = !garde && m.source ? voiles(m.source, m.largeur, m.hauteur) : null
    let r = garde ? garde.r : m.detoure ? { data: m.data, fonds: m.fonds || [] } : detourage({ data: m.data, largeur: m.largeur, hauteur: m.hauteur }, m, {})
    if (voile) r = Object.assign({}, r, { data: aplatirVoiles(r.data, voile), source: aplatirVoiles(m.source, voile) })
    /* L'image reçue se garde avec le détourage : repris (« Nuances », le
       lissage), le tracé se refaisait sans elle — sans ses fonds ni ses
       bords nets, d'autres formes et d'autres couleurs. */
    else if (!garde && m.source) r = Object.assign({}, r, { source: m.source })
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
    /* Les lettres des polices choisies, déjà posées (lib/texte.js), à la
       place des lettres tracées. */
    const remplacements = m.apercu || !m.texte ? [] : m.polices || []
    const options = { fonds: r.fonds || [], source: r.source || m.source || null, alpha: true, lissage: m.lissage, coteTravail: m.apercu ? 800 : 0, trouer: false, geometrie: m.geometrie !== false, miettes: m.miettes !== false, origine: m.origine || 0, sans: m.sans || [], nuances: m.nuances !== false, fusion: m.fusion ?? 1, texte: m.texte || null, remplacements }
    /* Les couleurs à plat, et la silhouette de tout le dessin (le DTF
       d'une couleur, la découpe de la version image). */
    const multi = vectoriserLisse(r.data, m.largeur, m.hauteur, Object.assign({ mono: false, memo }, options))
    if (!multi.formes) {
      const message = 'Tout est parti avec le fond : il ne reste rien à vectoriser.'
      suivi({ etape: 'trace', etat: 'echec', ms: duree(t0), message })
      throw new Error(message)
    }
    /* La silhouette : tout le dessin d'une pièce (lib/vecteur-lisse.js). */
    const v = { svg: multi.silhouette ? multi.svg.replace(/<path[\s\S]*<\/svg>$/, multi.silhouette + '</svg>') : multi.svg.replace(/(<path[^>]*\/>)[\s\S]*<\/svg>$/, '$1</svg>'), cadre: multi.cadre }
    /* Les lettres des polices seules, au même cadre : la version image les
       pose par-dessus son image. */
    const lettres = multi.lettres ? multi.svg.replace(/<path[\s\S]*<\/svg>$/, multi.lettres + '</svg>') : ''
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
    const unie = !clair ? v.svg : m.unie ? vectoriserLisse(r.data, m.largeur, m.hauteur, Object.assign({ mono: 'fonce', memo }, options)).svg.replace(tete, v.svg.match(tete)[0]) : null
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
      memo.image = { cle: cleImage, nette: imageParCouches(image, c.largeur, c.hauteur, c, multi.couches, f, cote / (m.origine || cote), r.fonds || [], multi.efface) }
    }
    const n = memo.image.nette
    const plein = n.data.slice()
    suivi({ etape: 'trace', etat: 'fin', part: 1, ms: duree(t0) })
    return { reponse: { svg: v.svg, lettres, unie, multi: multi.svg, degrade: multi.degrade, nuances: multi.nuances, cadre: c, couleurs: multi.couleurs, image: plein, imageLargeur: n.largeur, imageHauteur: n.hauteur, formes: multi.formes, noeuds: multi.noeuds }, transfert: [plein.buffer] }
  }
  throw new Error('Message inconnu : ' + m.type)
}

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  const memoire = {}
  self.onmessage = async e => {
    /* Les octets d'une face de la réserve, que la page apporte. */
    if (e.data && e.data.type === 'fourni') {
      const ok = attenteOctets.get(e.data.n)
      attenteOctets.delete(e.data.n)
      if (ok) ok(e.data.octets || null)
      return
    }
    try {
      const progres = p => self.postMessage({ id: e.data.id, progression: p })
      const { reponse, transfert } = await traiter(e.data, memoire, progres)
      if (reponse) self.postMessage(Object.assign({ id: e.data.id }, reponse), transfert || [])
    } catch (err) {
      self.postMessage({ id: e.data.id, erreur: (err && err.message) || String(err) })
    }
  }
}

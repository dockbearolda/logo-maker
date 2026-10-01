/* ============================================================== LE LOGO MAKER
   25 septembre 2026. Son entrée dans la barre, au-dessus de Réglages. Un
   logo, une photo : le fond part, et le logo ressort vectoriel, prêt pour
   la presse.
   27 septembre 2026, au soir : « c'est devenu une usine à gaz, j'aimerais un
   résultat plus simple — l'équivalent du meilleur graphiste au monde, qui
   prenne les décisions pour être fidèle au logo du client ». LE GRAPHISTE
   (lib/graphiste.js) lit le fichier et décide — l'IA pour un petit fichier,
   le fond, les creux, le tracé, la version (vecteur ou image). Il
   reste à l'écran :
   - LE LOGO, net à tous les zooms (les formes se dessinent elles-mêmes) ;
     pendant le calcul, l'image détourée ; « Comparer » glisse l'avant sous
     l'après ; le fond de l'aperçu (damier, blanc, noir, le textile) ;
   - EN HAUT À GAUCHE, SES DEUX VERSIONS (« le vectoriel sert pour le
     monogramme ; les dégradés or, je les obtiens avec une image — ils ne
     doivent jamais être tronqués ») : VECTEUR, de vraies formes, un
     dégradé tracé en tons ; IMAGE, les pixels du fichier dans le contour
     vectoriel, dégradés et textures intacts. Le graphiste ouvre sur Image
     un logo qui a du modelé, sur Vecteur un logo à plat ; le PDF emporte
     la version à l'écran ;
   - CE QUE LE GRAPHISTE A CHOISI, qu'un clic contredit — « il faut
     remettre la feature où je peux supprimer le fond » : l'AMÉLIORATION IA,
     le FOND (autour du logo, partout — le noir enfermé dans un cercle
     aussi —, ou le sujet d'une photo) ;
   - LES RÉGLAGES (28 septembre 2026 : « il faut absolument remettre les
     seuils de réglage ») : le SEUIL du fond, le LISSAGE du tracé, les
     NUANCES des couleurs, posés par le graphiste, que la vendeuse ajuste —
     le résultat suit en direct ;
   - SES COULEURS, que la vendeuse change ou retire d'un clic, ou le logo
     entier dans une couleur du nuancier OLDA — en PDF et en EPS, dans ses
     encres officielles ;
   - LE BLANC DTF et UN BOUTON : le PDF pour la presse. Les autres formats
     — SVG, PNG, EPS, tout en .zip — dans « Plus » ;
   - AU-DESSUS, UNE BARRE FINE (30 septembre 2026) : le fichier, Annuler,
     Rétablir, l'HISTORIQUE des gestes (lib/historique.js : des photos des
     réglages, jamais des pixels), Changer.
   Raccourcis : Ctrl + O ouvrir, Ctrl + V coller, Ctrl + S le PDF, Ctrl + Z
   annuler, Ctrl + Maj + Z et Ctrl + Y rétablir, V et I les versions, C
   comparer, Espace maintenu l'avant, 0 tout voir, 1 pour 100 %, + et −.
   Tout se calcule dans des fils à part (lib/detourage-travail.js) : le
   détourage de l'aperçu (1 400 px), celui de l'image pleine, le vecteur,
   l'IA. Rien ne quitte le poste, rien ne passe par le cahier.
   Le moteur de la page ne rend que la place (`[data-studio]`) : le studio
   s'y monte lui-même (voir `monter`) et garde son image d'une visite à
   l'autre de l'écran. */

import { lireCanevas } from './logo.js'
import * as D from './detourage.js'
import { SEUIL, SEUIL_MAX } from './sujet.js'
import { svgVersPdf, decoupePdf, dessinPdf, blancPdf, RESSOURCES_BLANC, lireSvg, DPI } from './pdf-vectoriel.js'
import { imageVersPdf, deborder } from './pdf-image.js'
import { pngHd } from './png.js'
import { COTE_NETTOYAGE } from './nettoyage.js'
import { recolorer, svgFinal, svgVersEps, nomExport, tailleCm, zip, recadrer } from './export-logo.js'
import { decider, LISSAGE } from './graphiste.js'
import { ecart } from './lab.js'
import { NUANCIER } from './nuancier.js'
import { cmjn as versCmjn } from './cmjn.js'
import { auNuancier, PROCHE } from './controle.js'
import * as H from './historique.js'

const APERCU_MAX = D.APERCU_MAX
/* L'ULTRA D'OFFICE (lib/nettoyage.js) : quand le poste la fait en moins de
   40 secondes ; au-delà, le nettoyage, et un bouton qui dit son temps. */
const ULTRA_AUTO = 40000
const PLEINE_MAX = 5000
const REPOS_IA = 60000
const PNG_MAX = 12000
const FORMATS = { pdf: 'PDF', svg: 'SVG', eps: 'EPS', png: 'PNG', kit: 'ZIP' }

/* ------------------------------------------------------------ CE QUI RESTE */
const lire = (cle, def) => { try { const v = localStorage.getItem(cle); return v === null ? def : v } catch { return def } }
const garder = (cle, v) => { try { localStorage.setItem(cle, v) } catch {} }

/* ------------------------------------------------------------------ L'ÉTAT */
const E = {
  racine: null,
  /* LA BARRE au-dessus du studio : le fichier, Annuler, Rétablir,
     l'historique, Changer. */
  barre: null,
  /* L'HISTORIQUE DES GESTES (lib/historique.js), vidé à l'ouverture d'un
     fichier ; `historique` : son menu ouvert ; `tenu` : le curseur qu'on
     glisse, noté quand on le lâche. */
  histo: null,
  historique: false,
  tenu: null,
  nom: '',
  /* Les dimensions du fichier reçu ; `pleine`, l'image de travail (réduite
     à 5 000 px au plus : 42 cm à 300 dpi). */
  fichier: null,
  pleine: null,
  apercu: null,
  source: null,
  /* Le détourage de l'image pleine, pour le plan zoomé et le vecteur. */
  fin: { toile: null, data: null, cle: '', pleine: null },
  fondVue: lireFondVue(),
  comparer: false,
  resultat: null,
  resultatImage: null,
  /* CE QUE LE GRAPHISTE A DÉCIDÉ (lib/graphiste.js) ; `methode` : 'uni', à
     la couleur, ou 'ia', le sujet trouvé par le modèle — `fondChoisi` : la
     vendeuse l'a contredit, il ne le rechoisit plus. */
  decision: null,
  methode: 'uni',
  fondChoisi: false,
  creuxChoisi: false,
  reglages: { tolerance: D.TOLERANCE, interieur: true, seuil: SEUIL },
  /* LE LISSAGE DU TRACÉ (0 à 100) : celui du graphiste, que le curseur
     ajuste. */
  lissage: LISSAGE,
  /* LES NUANCES (0 à 100, 50 d'office) : à gauche les nuances voisines se
     fondent en une teinte, à droite chacune reste la sienne. */
  nuances: 50,
  /* `pose` : le masque est là, le premier détourage pas encore. */
  ia: { n: 0, enCours: false, pose: false, etape: '', part: 0, moteur: '', masque: null, cote: 0, modele: '', cle: 0, duree: 0, erreur: '' },
  fondsLus: [],
  vue: { zoom: 1, ox: 0, oy: 0, ajuste: true },
  calcul: { enVol: false, aRefaire: false },
  glisse: null,
  lecture: false,
  exporte: '',
  /* Le dernier export parti, le temps que le bouton le dise. */
  fait: '',
  /* `split` : la place du curseur avant / après (0 à 1), null sans
     comparaison. */
  split: null,
  /* Le logo vectorisé (lib/vecteur-lisse.js) : ses SVG, son cadre en pixels
     de l'image pleine, ses teintes. */
  vecteur: null,
  vectorise: 0,
  /* LA VERSION À L'ÉCRAN : 'detoure', 'vecteur' ou 'image' ; `vueChoisie` :
     la vendeuse l'a choisie, le graphiste ne la rechoisit plus. DÉTOURÉ
     (29 septembre 2026 : « remettre la feature qui supprimait uniquement
     le fond extérieur sans rien vectoriser ») : le fond autour du logo
     part, les pixels du fichier restent tels quels, rien ne se trace.
     30 septembre 2026 (« que l'app devine le meilleur réglage pour un
     rendu optimal : une photo, une image, ou parfaitement vectoriel ») :
     LE GRAPHISTE CHOISIT LA VERSION à l'ouverture de chaque fichier
     (lib/graphiste.js, `version`) — une photo en Détouré, une image en
     Image, un logo à plat en Vecteur ; plus rien n'est retenu d'une visite
     à l'autre. */
  version: 'detoure',
  vueChoisie: false,
  /* LES COULEURS : les teintes retirées à la main, celles qu'on a changées
     (« r,g,b » → [r, g, b]). */
  sans: [],
  recolor: {},
  /* LE TEXTE ET SES POLICES (lib/texte.js, lib/lecture.js, lib/polices.js) :
     les lignes lues sur l'image de travail, pour chacune la police
     retrouvée et ses équivalents (`props`), celle qui remplace ses
     lettres (`choix`, -1 : le dessin d'origine) et le gras ajouté autour
     de ses lettres (`gras`, de 0 à 100) ; `poses`, leurs lettres
     posées. `cle` : l'image lue. `repeint` : le Détouré repeint de ces
     lettres (voir `repeindre`). */
  textes: null,
  repeint: null,
  /* 'multi' (les couleurs du logo) ou une couleur du nuancier OLDA. */
  teinte: { type: 'multi' },
  uneCouleur: { type: 'nuancier', nom: 'Noir' },
  /* LA COUCHE DE BLANC DTF (Spot_1, lib/pdf-vectoriel.js) : d'office,
     retenue d'une visite à l'autre sur ce poste. */
  blanc: lire('olda.detourage.blanc', '1') !== '0',
  /* La teinte dont la bulle est ouverte ; le menu « Plus ». */
  pop: null,
  menu: false,
  /* LE NETTOYAGE IA (lib/nettoyage.js) : l'image redessinée nette, ×4 ;
     `original`, l'image d'avant, pour y revenir d'un clic. `ultra` : les
     orientations de l'Ultra en cours (0, le nettoyage) ; `faite`, celles
     de l'image nettoyée ; `estime` : ce que l'Ultra prendrait ici, quand
     le poste ne la tient pas d'office ; `prevu` : ce que prend l'Ultra en
     cours (le temps jaugé dans le fil, ou `estime`) ; `flou` : celui
     qu'elle retire d'abord (« Rendre net »), en pixels du fichier.
     `demande` ('oui' ou 'ultra') et `demandeNet` : ce qui tourne ; `force`
     et `faiteNet` : ce qu'a reçu l'image nettoyée — l'historique les
     compare à sa photo. */
  nettoyage: { enCours: false, etape: '', part: 0, moteur: '', duree: 0, ultra: 0, faite: 0, estime: 0, nette: false, flou: 0, prevu: 0, demande: 'oui', demandeNet: false, force: false, faiteNet: false },
  /* « RENDRE NET » (lib/nettete.js, 30 septembre 2026 : « la feature de
     PicWish qui passe une image floue à une image nette ») : le flou du
     fichier retiré avant l'IA — voulu d'office par le graphiste quand le
     fichier est flou, d'un clic par la vendeuse ; `nettoyage.nette` :
     l'image de travail l'a été. */
  net: false,
  original: null,
  /* `sourcePleine` : le fichier reçu en pleine taille, pour que
     « Comparer » reste net au zoom. */
  sourcePleine: null,
  /* LA POLICE AU CLIC (30 septembre 2026, voir `majPolice`) : la ligne de
     texte survolée sur le plan, celle dont la bulle est ouverte (-1 :
     aucune) ; `planSurvole` : la souris est sur le plan. */
  ligneSurvol: -1,
  popPolice: -1,
  planSurvole: false,
}

/* LE FOND DE L'APERÇU, retenu d'une visite à l'autre sur ce poste. */
function lireFondVue() {
  try {
    const v = JSON.parse(localStorage.getItem('olda.detourage.fond') || 'null')
    if (v && ['damier', 'blanc', 'noir', 'couleur'].includes(v.type)) return { type: v.type, couleur: /^#[0-9a-f]{6}$/i.test(v.couleur) ? v.couleur : '#c62828' }
  } catch {}
  return { type: 'damier', couleur: '#c62828' }
}
function garderFondVue() {
  garder('olda.detourage.fond', JSON.stringify(E.fondVue))
}

/* ------------------------------------------------------------ LE FIL DE CALCUL */
let fil = null
let filKo = false
let numero = 0
const attentes = new Map()
const memoireLocale = {}

function ouvrirFil() {
  if (fil || filKo) return fil
  try {
    fil = new Worker(new URL('./detourage-travail.js', import.meta.url), { type: 'module' })
    fil.onmessage = e => {
      const a = attentes.get(e.data.id)
      if (!a) return
      if (e.data.progression !== undefined) return a.progres(e.data.progression)
      attentes.delete(e.data.id)
      if (e.data.erreur) a.ko(new Error(e.data.erreur))
      else a.ok(e.data)
    }
    fil.onerror = () => {
      /* Un navigateur sans Worker de module : on calcule dans la page. */
      filKo = true
      fil = null
      const encore = [...attentes.values()]
      attentes.clear()
      for (const a of encore) demander(a.message, a.progres).then(a.ok, a.ko)
    }
    if (E.apercu) fil.postMessage({ type: 'source', data: E.apercu.data, largeur: E.apercu.largeur, hauteur: E.apercu.hauteur })
  } catch {
    filKo = true
  }
  return fil
}

function demander(message, progres = () => {}) {
  const f = ouvrirFil()
  if (!f) return import('./detourage-travail.js').then(m => m.traiter(message, memoireLocale, progres)).then(r => r.reponse || {})
  return new Promise((ok, ko) => {
    const id = ++numero
    attentes.set(id, { ok, ko, message, progres })
    f.postMessage(Object.assign({ id }, message))
  })
}

/* UN FIL À SOI, pour un long calcul (l'IA, le détourage de l'image
   pleine, le vecteur) : le fil de l'aperçu reste libre, et le calcul
   s'annule d'un coup (`fermer`) quand un autre fichier arrive. Sans Worker
   de module, le calcul se fait dans la page. */
function filDedie() {
  let w = null
  try { w = new Worker(new URL('./detourage-travail.js', import.meta.url), { type: 'module' }) } catch {}
  const memoire = {}
  const dansLaPage = (m, progres) => import('./detourage-travail.js').then(mod => mod.traiter(m, memoire, progres)).then(r => r.reponse || {})
  let n = 0
  const attente = new Map()
  if (w) {
    w.onmessage = e => {
      const a = attente.get(e.data.id)
      if (!a) return
      if (e.data.progression !== undefined) return a.progres(e.data.progression)
      attente.delete(e.data.id)
      if (e.data.erreur) a.ko(new Error(e.data.erreur))
      else a.ok(e.data)
    }
    w.onerror = () => {
      w = null
      const encore = [...attente.values()]
      attente.clear()
      for (const a of encore) dansLaPage(a.m, a.progres).then(a.ok, a.ko)
    }
  }
  return {
    envoyer(m, transfert = []) {
      if (w) w.postMessage(m, transfert)
      else dansLaPage(m)
    },
    demander(m, progres = () => {}) {
      if (!w) return dansLaPage(m, progres)
      return new Promise((ok, ko) => {
        const id = ++n
        attente.set(id, { ok, ko, m, progres })
        w.postMessage(Object.assign({ id }, m))
      })
    },
    fermer() {
      if (w) w.terminate()
      w = null
      for (const a of attente.values()) a.ko(Object.assign(new Error('annulé'), { annule: true }))
      attente.clear()
    },
  }
}

/* LE FIL DE L'IA : il garde le modèle d'une photo à l'autre, puis se
   ferme après une minute de repos — le modèle y tient près d'un
   gigaoctet, que le WebAssembly ne rend jamais. */
let filIA = null
let minuteurIA = null
function ia() {
  clearTimeout(minuteurIA)
  if (!filIA) filIA = filDedie()
  return filIA
}
function fermerIA() {
  clearTimeout(minuteurIA)
  if (filIA) filIA.fermer()
  filIA = null
}
function reposerIA() {
  clearTimeout(minuteurIA)
  minuteurIA = setTimeout(() => { if (!E.ia.enCours && !E.nettoyage.enCours) fermerIA() }, REPOS_IA)
}

/* LE FIL DU VECTEUR (quelques secondes) : un tracé devenu inutile (un
   autre détourage) se coupe net. `connu` : le détourage que ce fil a déjà
   reçu — l'image ne retraverse pas. */
let filVect = null
let filVectCle = ''
let finalEnVol = 0
const connu = new Map()
function vecteurFil(cleF) {
  if (filVect && filVectCle !== cleF && finalEnVol) { filVect.fermer(); filVect = null }
  if (!filVect) { filVect = filDedie(); connu.delete('final') }
  filVectCle = cleF
  return filVect
}

/* ---------------------------------------------------------------- LE GABARIT */
const ic = nom => '<svg class="o-studio-ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#icone-' + nom + '"></use></svg>'

const hexVersRvb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
const rvbHex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')

/* LE NUANCIER OLDA (30 septembre 2026, « à la fin j'aimerais avoir le
   choix de ces couleurs full CMJN, voici mon nuancier officiel ») : ses
   couleurs, à l'écran comme Illustrator les montre (lib/nuancier.js) ; le
   PDF et l'EPS les sortent dans leurs encres officielles (lib/cmjn.js). */
const duNuancier = rvb => NUANCIER.find(c => c.rvb.every((v, k) => v === Math.round(rvb[k])))
/* UNE COULEUR À L'ÉCRAN : son nom (celui du nuancier, sinon son
   hexadécimal) et les encres où elle sort en PDF (celles du nuancier, sinon
   sa conversion, au point près). */
function fiche(rvb) {
  const c = duNuancier(rvb)
  return c ? { nom: c.nom, encres: c.cmjn, officielle: true } : { nom: rvbHex(rvb).toUpperCase(), encres: versCmjn(rvb).map(v => Math.round(v * 100)), officielle: false }
}
const encres = e => e.map((v, k) => 'CMJN'[k] + String(v).replace('.', ',')).join(' ')
const nomCouleur = rvb => { const f = fiche(rvb); return f.nom + ' · ' + encres(f.encres) }
/* Une pastille : sa couleur, que l'infobulle détaille au survol (`bulle`). */
const pastille = (rvb, note = '') => ' data-rvb="' + rvb.map(Math.round).join(',') + '"' + (note ? ' data-note="' + note + '"' : '') + ' aria-label="' + nomCouleur(rvb) + (note ? ' (' + note + ')' : '') + '"'

/* LE SVG À LA COULEUR CHOISIE : chaque forme prend la teinte. */
export function teinter(svg, rvb) {
  return rvb ? svg.replace(/fill="rgb\([^)]*\)"/g, 'fill="rgb(' + rvb.join(',') + ')"') : svg
}

const interrupteur = (action, titre) => '<button type="button" class="o-studio-inter" role="switch" aria-checked="false" data-a="' + action + '" aria-label="' + titre + '"><i></i></button>'
const ligne = (icone, mot, action, titre, detail = '') => '<div class="o-studio-ligne">'
  + (icone ? '<span class="o-studio-ligne-ic">' + ic(icone) + '</span>' : '')
  + '<span class="o-studio-ligne-mot">' + mot + (detail ? '<small data-r="' + detail + '"></small>' : '') + '</span>'
  + interrupteur(action, titre) + '</div>'

/* UN CURSEUR : son nom, sa valeur, et la glissière (bornes posées ici, ou
   plus tard par `majPanneau` quand elles dépendent du fond). */
const curseur = (id, mot, min, max, val) => '<div class="o-studio-curseur">'
  + '<div class="o-studio-curseur-tete"><label for="o-studio-' + id + '">' + mot + '</label><output data-r="val-' + id + '"></output></div>'
  + '<input type="range" id="o-studio-' + id + '" data-c="' + id + '" step="1"' + (min !== null ? ' min="' + min + '" max="' + max + '" value="' + val + '"' : '') + '></div>'

/* Une ligne du menu « Plus » : un format à exporter. */
const article = (action, valeur, mot, detail = '') => '<button type="button" role="menuitem" class="o-studio-article" data-a="' + action + '"' + (valeur ? ' data-v="' + valeur + '"' : '') + '>'
  + '<span class="o-studio-article-mot">' + mot + '</span>' + (detail ? '<small>' + detail + '</small>' : '') + '</button>'

function gabarit() {
  return ''
    + '<div class="o-studio-scene" data-r="scene" tabindex="-1">'
    + '  <canvas class="o-studio-toile" data-r="toile"></canvas>'
    + '  <div class="o-studio-accueil" data-r="accueil">'
    + '    <div class="o-studio-accueil-carte">'
    + '      <span class="o-studio-accueil-rond">' + ic('wand-sparkles') + '</span>'
    + '      <h3>Dépose le logo du client</h3>'
    + '      <button type="button" class="o-studio-bouton o-studio-plein" data-a="choisir">' + ic('upload') + '<span>Choisir un fichier</span></button>'
    + '      <div class="o-studio-puces-formats">' + ['JPEG', 'PNG', 'HEIC', 'WebP', 'TIFF', 'PDF'].map(f => '<span>' + f + '</span>').join('') + '<em></em><span class="o-studio-touches"><kbd>Ctrl</kbd><kbd>V</kbd></span></div>'
    + '    </div>'
    + '  </div>'
    + '  <div class="o-studio-depot"><span>' + ic('upload') + 'Lâche le logo</span></div>'
    + '  <div class="o-studio-modes" data-r="modes" role="radiogroup" aria-label="Version">'
    + '    <button type="button" role="radio" data-a="version" data-v="detoure" title="Le fond autour du logo retiré, les pixels du fichier tels quels, rien de vectorisé (D)">' + ic('scissors') + '<span>Détouré</span></button>'
    + '    <button type="button" role="radio" data-a="version" data-v="vecteur" title="De vraies formes, nettes à tous les zooms (V)">' + ic('shapes') + '<span>Vecteur</span></button>'
    + '    <button type="button" role="radio" data-a="version" data-v="image" title="Les pixels du fichier dans le contour : dégradés et textures intacts (I)">' + ic('image') + '<span>Image</span></button>'
    + '  </div>'
    + '  <div class="o-studio-split" data-r="split" hidden><span data-c="avant">Avant</span><span data-c="apres">Après</span><i>' + ic('columns-2') + '</i></div>'
    + '  <div class="o-studio-prep" data-r="prep" role="group" aria-label="Préparation" hidden><div data-r="prep-corps"></div><span class="o-studio-prep-dit" data-r="prep-dit" role="status"></span></div>'
    + '  <div class="o-studio-badge" data-r="badge" hidden>Avant</div>'
    + '  <div class="o-studio-vuebar" data-r="vuebar">'
    + '    <div class="o-studio-fonds" role="radiogroup" aria-label="Fond de l\'aperçu">'
    + '      <button type="button" role="radio" data-a="fond" data-v="damier" title="Transparent" aria-label="Damier"><i class="o-studio-pastille" data-p="damier"></i></button>'
    + '      <button type="button" role="radio" data-a="fond" data-v="blanc" title="Blanc" aria-label="Blanc"><i class="o-studio-pastille" data-p="blanc"></i></button>'
    + '      <button type="button" role="radio" data-a="fond" data-v="noir" title="Noir" aria-label="Noir"><i class="o-studio-pastille" data-p="noir"></i></button>'
    + '      <label role="radio" data-a="fond" data-v="couleur" title="Couleur du textile" aria-label="Couleur du textile"><i class="o-studio-pastille" data-p="couleur" data-r="pastille-couleur"></i><input type="color" data-c="fond-couleur"></label>'
    + '    </div>'
    + '    <span class="o-studio-sep" aria-hidden="true"></span>'
    + '    <button type="button" class="o-studio-outil" data-a="split" aria-pressed="false" title="Le fichier reçu sous le vecteur (C) — Espace maintenu : l\'avant seul">' + ic('columns-2') + '<span>Comparer</span></button>'
    + '    <button type="button" class="o-studio-outil" data-a="ajuster" title="Tout voir (0) · double-clic">' + ic('scan') + '<span data-r="zoom">100 %</span></button>'
    + '  </div>'
    + '  <div class="o-studio-toast" data-r="toast" role="status" aria-live="polite"></div>'
    + '  <div class="o-studio-pop o-studio-pop-police" data-r="pop-police" hidden></div>'
    + '  <input type="file" data-r="fichier" accept="image/*,.pdf,.ai,.svg,.heic,.heif,.tif,.tiff" hidden>'
    + '</div>'
    + '<aside class="o-studio-panneau">'
    + '  <div class="o-studio-defile">'
    + '    <section class="o-studio-bloc" data-besoin="image">'
    + ligne('sparkles', '<b>Amélioration IA</b>', 'nettoyer', 'Amélioration IA', 'ia-etat')
    + ligne('focus', '<b>Rendre net</b>', 'net', 'Rendre net', 'net-etat')
    + '      <button type="button" class="o-studio-bouton o-studio-discret" data-a="ultra" data-r="ultra" hidden title="Le modèle haut de gamme, passé huit fois : des bords plus fidèles — plus long sur ce poste">' + ic('wand-sparkles') + '<span data-r="ultra-mot"></span></button>'
    + '    </section>'
    + '    <section class="o-studio-bloc" data-besoin="image">'
    + '      <div class="o-studio-bloc-tete"><b>Fond</b><span data-r="res-fond"></span></div>'
    + '      <div class="o-studio-segment" role="radiogroup" aria-label="Le fond à retirer">'
    + '        <button type="button" role="radio" data-a="fond-retire" data-v="autour" title="Le fond autour du logo, et dans les lettres posées dehors">Autour</button>'
    + '        <button type="button" role="radio" data-a="fond-retire" data-v="partout" title="Le fond partout, même dans les lettres et les cercles">Partout</button>'
    + '        <button type="button" role="radio" data-a="fond-retire" data-v="sujet" title="Le sujet d\'une photo, trouvé par l\'IA">' + ic('sparkles') + 'Sujet</button>'
    + '      </div>'
    + curseur('seuil', 'Seuil', null)
    + '    </section>'
    + '    <section class="o-studio-bloc" data-besoin="image" data-trace>'
    + '      <div class="o-studio-bloc-tete"><b>Tracé</b><span data-r="res-trace"></span></div>'
    + curseur('lissage', 'Lissage', 0, 100, LISSAGE)
    + '    </section>'
    + '    <section class="o-studio-bloc" data-besoin="image" data-trace>'
    + '      <div class="o-studio-bloc-tete"><b>Couleurs</b><span data-r="res-couleurs"></span></div>'
    + curseur('nuances', 'Nuances', 0, 100, 50)
    + '      <div class="o-studio-palette" data-r="palette"></div>'
    + '      <div class="o-studio-segment" role="radiogroup" aria-label="Couleurs">'
    + '        <button type="button" role="radio" data-a="teinte-mode" data-v="multi">D\'origine</button>'
    + '        <button type="button" role="radio" data-a="teinte-mode" data-v="une">Une couleur</button>'
    + '      </div>'
    + '      <div class="o-studio-pastilles" role="radiogroup" aria-label="Couleur du nuancier" data-r="une" hidden>'
    + NUANCIER.map(c => '<button type="button" role="radio" data-a="teinte" data-v="' + c.nom + '"' + pastille(c.rvb) + '><i style="background:' + rvbHex(c.rvb) + '"></i></button>').join('')
    + '      </div>'
    + '    </section>'
    + '    <section class="o-studio-bloc" data-besoin="image" data-r="bloc-police" hidden>'
    + '      <div class="o-studio-bloc-tete"><b>Police</b><span data-r="res-police"></span></div>'
    + '      <div class="o-studio-textes" data-r="textes"></div>'
    + '    </section>'
    + '  </div>'
    + '  <footer class="o-studio-pied" data-besoin="image">'
    + ligne('', 'Blanc DTF <small class="o-studio-spot">Spot_1</small>', 'blanc', 'Couche de blanc DTF')
    + '    <div class="o-studio-pied-boutons">'
    + '    <button type="button" class="o-studio-bouton o-studio-plein o-studio-telecharger" data-a="enregistrer" data-v="pdf" title="Le PDF vectoriel pour la presse, blanc DTF compris (Ctrl S)"><span class="o-studio-ic-dl">' + ic('download') + '</span><span class="o-studio-ic-ok">' + ic('check') + '</span><span data-r="enregistrer-mot">Télécharger le PDF</span></button>'
    + '    <button type="button" class="o-studio-bouton o-studio-plus" data-a="menu" aria-haspopup="menu" aria-expanded="false" title="Les autres formats"><span>Plus</span>' + ic('chevron-down') + '</button>'
    + '    </div>'
    + '    <div class="o-studio-menu" data-r="menu" role="menu" hidden>'
    + '      <div class="o-studio-menu-titre">Autres formats</div>'
    + '<div data-trace>' + article('enregistrer', 'svg', 'SVG', 'vectoriel, en mm') + '</div>'
    + article('enregistrer', 'png', 'PNG', '300 dpi, fond transparent')
    + '<div data-trace>' + article('enregistrer', 'eps', 'EPS', 'Illustrator, CorelDRAW') + '</div>'
    + article('enregistrer', 'kit', 'Tout', 'PDF · SVG · PNG · EPS, en .zip')
    + '    </div>'
    + '  </footer>'
    + '  <div class="o-studio-pop" data-r="pop" hidden></div>'
    + '</aside>'
    + '<div class="o-studio-infobulle" data-r="infobulle" role="tooltip" hidden></div>'
}

/* LA BARRE (30 septembre 2026) : la marque, le fichier et ses dimensions
   (sortis de l'en-tête du panneau), puis Annuler, Rétablir, l'historique
   des gestes et Changer. */
function gabaritBarre() {
  return ''
    + '<div class="o-studio-marque"><b>OLDA</b><span>Logo maker</span></div>'
    + '<span class="o-studio-barre-filet" aria-hidden="true"></span>'
    + '<div class="o-studio-fichier"><b data-r="nom">Aucune image</b><span data-r="taille"></span></div>'
    + '<div class="o-studio-barre-actions">'
    + '  <button type="button" class="o-studio-barre-outil o-studio-carre" data-a="annuler" aria-label="Annuler" disabled>' + ic('undo-2') + '</button>'
    + '  <button type="button" class="o-studio-barre-outil o-studio-carre" data-a="retablir" aria-label="Rétablir" disabled>' + ic('redo-2') + '</button>'
    + '  <button type="button" class="o-studio-barre-outil" data-a="historique" aria-haspopup="menu" aria-expanded="false" title="Les gestes faits sur ce fichier : un clic y revient" disabled>' + ic('clock') + '<span>Historique</span></button>'
    + '  <span class="o-studio-barre-filet" aria-hidden="true"></span>'
    + '  <button type="button" class="o-studio-bouton o-studio-discret" data-a="choisir" title="Ouvrir un fichier (Ctrl O)">' + ic('upload') + '<span>Changer</span></button>'
    + '</div>'
    + '<div class="o-studio-menu o-studio-historique" data-r="historique" role="menu" aria-label="Historique" hidden></div>'
}

/* --------------------------------------------------------------- LE MONTAGE */
/* Un élément du studio, ou de sa barre. */
const r = nom => {
  if (!E.racine) return null
  const s = '[data-r="' + nom + '"]'
  return E.racine.querySelector(s) || (E.barre && E.barre.querySelector(s))
}

/* `barre` : sa place dans la page, au-dessus du studio ; sans elle, elle se
   pose juste avant. */
export function monter(hote, barre) {
  if (!hote || hote.dataset.monte) return
  hote.dataset.monte = '1'
  hote.classList.add('o-studio')
  hote.innerHTML = gabarit()
  E.racine = hote
  if (!barre) { barre = document.createElement('header'); hote.before(barre) }
  barre.classList.add('o-studio-barre')
  barre.innerHTML = gabaritBarre()
  E.barre = barre
  const scene = r('scene')
  const toile = r('toile')

  hote.addEventListener('click', clic)
  barre.addEventListener('click', clic)
  /* L'infobulle des couleurs : au survol, et au clavier. */
  hote.addEventListener('pointerover', e => bulle(e.target.closest('[data-rvb]')))
  hote.addEventListener('pointerleave', () => bulle(null))
  hote.addEventListener('pointerdown', () => bulle(null))
  hote.addEventListener('focusin', e => bulle(e.target.matches('[data-rvb]:focus-visible') ? e.target : null))
  hote.addEventListener('focusout', () => bulle(null))
  hote.addEventListener('change', e => {
    const c = e.target.dataset.c
    /* Le curseur lâché : le tracé final, à la pleine taille — et un seul
       geste dans l'historique, du début à la fin du glissé. */
    if (c === 'lissage' || c === 'nuances') { planifierVecteur(0); return finirGeste() }
    if (c === 'seuil') return finirGeste()
    /* Le texte d'une ligne corrigé (validé ou quitté). */
    if (c === 'texte-ligne' && E.textes) return geste(() => relireLigne(Number(e.target.dataset.v), e.target.value))
    /* Le gras d'une ligne, lâché : ses lettres se reposent, épaissies. */
    if (c === 'gras' && E.textes) {
      const l = E.textes.lignes[Number(e.target.dataset.v)]
      if (l) { l.gras = Number(e.target.value); l.main = true; majPolice(); poserPolices() }
      return finirGeste()
    }
    if (c === 'pop-couleur' && E.pop) {
      E.recolor[E.pop] = hexVersRvb(e.target.value)
      majCouleurs()
      finirGeste()
    }
  })
  hote.addEventListener('input', e => {
    const c = e.target.dataset.c
    /* Un curseur qu'on prend (ou la teinte qu'on cherche) : l'historique
       photographie l'avant, une fois. */
    if (TENUS.includes(c)) entamer(e.target)
    if (c === 'fond-couleur') {
      E.fondVue = { type: 'couleur', couleur: e.target.value }
      garderFondVue()
      return majPanneau()
    }
    if (c === 'pop-couleur' && E.pop) {
      E.recolor[E.pop] = hexVersRvb(e.target.value)
      majCouleurs(false)
    }
    /* LE GRAS D'UNE LIGNE : sa valeur suit la main ; les lettres se
       reposent quand on lâche. */
    if (c === 'gras' && E.textes) {
      const l = E.textes.lignes[Number(e.target.dataset.v)]
      if (l) { l.gras = Number(e.target.value); majGras(e.target, l) }
    }
    /* LE LISSAGE : un aperçu du tracé (800 px) suit la main ; le tracé final
       part quand on lâche. */
    if (c === 'lissage' || c === 'nuances') {
      E[c] = Number(e.target.value)
      apercuVecteur()
      return majPanneau()
    }
    /* LE SEUIL : à la couleur près (un fond uni), ou la confiance de l'IA
       (le sujet d'une photo) — le détourage suit en direct. */
    if (c === 'seuil') {
      if (E.methode === 'ia') E.reglages = Object.assign({}, E.reglages, { seuil: Number(e.target.value) })
      else E.reglages = Object.assign({}, E.reglages, { tolerance: Number(e.target.value) })
      majPanneau()
      recalculer()
      planifierFin()
    }
  })
  /* Un curseur ramené à sa place n'envoie pas de « change » : le geste se
     clôt quand même, au relâchement ou quand il perd la main — rien n'a
     bougé, rien n'est noté. */
  document.addEventListener('pointerup', () => { if (E.tenu) setTimeout(finirGeste, 0) })
  hote.addEventListener('focusout', e => { if (E.tenu === e.target) setTimeout(finirGeste, 0) })
  r('fichier').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0]
    e.target.value = ''
    if (f) charger(f)
  })

  scene.addEventListener('dragover', e => {
    if (!e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return
    e.preventDefault()
    scene.classList.add('o-studio-survol')
  })
  scene.addEventListener('dragleave', e => { if (!scene.contains(e.relatedTarget)) scene.classList.remove('o-studio-survol') })
  scene.addEventListener('drop', e => {
    scene.classList.remove('o-studio-survol')
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]
    if (!f) return
    e.preventDefault()
    charger(f)
  })

  /* LE COMPARATEUR : sa poignée se glisse, d'un bord à l'autre. */
  const split = r('split')
  split.addEventListener('pointerdown', e => {
    split.setPointerCapture(e.pointerId)
    split.classList.add('o-studio-saisi')
    e.stopPropagation()
  })
  split.addEventListener('pointermove', e => {
    if (!split.hasPointerCapture(e.pointerId)) return
    const b = scene.getBoundingClientRect()
    E.split = Math.max(0.02, Math.min(0.98, (e.clientX - b.left) / b.width))
    dessiner()
  })
  for (const t of ['pointerup', 'pointercancel']) split.addEventListener(t, () => split.classList.remove('o-studio-saisi'))

  /* Glisser pour déplacer, la molette pour zoomer, double-clic pour tout
     revoir : rien à apprendre, rien à l'écran. */
  toile.addEventListener('pointerdown', e => {
    if (!E.apercu) return
    toile.setPointerCapture(e.pointerId)
    E.glisse = { x: e.clientX, y: e.clientY, ox: E.vue.ox, oy: E.vue.oy, bouge: false }
    scene.classList.add('o-studio-saisi')
    fermerPop()
    fermerMenu()
    fermerHistorique()
    fermerPopPolice()
  })
  toile.addEventListener('pointermove', e => {
    const g = E.glisse
    if (!g) {
      /* LA SOURIS SUR UN TEXTE DU LOGO : la ligne se signale, un clic
         ouvre sa police (voir `majPolice`). */
      const b = toile.getBoundingClientRect()
      E.planSurvole = true
      survolerLigne(ligneSous(e.clientX - b.left, e.clientY - b.top))
      return
    }
    if (Math.abs(e.clientX - g.x) + Math.abs(e.clientY - g.y) > 3) g.bouge = true
    E.vue.ox = g.ox + e.clientX - g.x
    E.vue.oy = g.oy + e.clientY - g.y
    E.vue.ajuste = false
    dessiner()
  })
  const lache = e => {
    const g = E.glisse
    E.glisse = null
    scene.classList.remove('o-studio-saisi')
    /* Un clic sans glisser, sur une ligne de texte : sa bulle. */
    if (g && !g.bouge && e.type === 'pointerup') {
      const b = toile.getBoundingClientRect()
      const k = ligneSous(e.clientX - b.left, e.clientY - b.top)
      if (k >= 0) ouvrirPopPolice(k)
    }
  }
  toile.addEventListener('pointerup', lache)
  toile.addEventListener('pointercancel', lache)
  toile.addEventListener('pointerleave', () => { E.planSurvole = false; survolerLigne(-1) })
  toile.addEventListener('dblclick', () => { ajuster(); dessiner() })
  toile.addEventListener('wheel', e => {
    if (!E.apercu) return
    e.preventDefault()
    const b = toile.getBoundingClientRect()
    zoomer(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022)), e.clientX - b.left, e.clientY - b.top)
  }, { passive: false })

  new ResizeObserver(() => { dimensionner(); if (E.vue.ajuste) ajuster(); dessiner() }).observe(scene)

  dimensionner()
  majPanneau()
  if (E.apercu) ajuster()
  dessiner()
}

const visible = () => !!(E.racine && E.racine.isConnected && E.racine.offsetParent)

function voirAvant(v) {
  if (E.comparer === v || (v && !E.apercu)) return
  E.comparer = v
  majPanneau()
  dessiner()
}

/* ------------------------------------------------------------- LE CHARGEMENT */
async function charger(fichier) {
  if (E.lecture) return
  E.lecture = true
  /* Une préparation commence (voir `preparer`) : la lecture du fichier en
     est la première étape. */
  preparer(true)
  const p = prep, debut = performance.now()
  majEtat()
  try {
    const c = await lireCanevas(fichier)
    let l = c.width, h = c.height
    let pleineToile = c
    const f = Math.max(l, h) / PLEINE_MAX
    if (f > 1) {
      l = Math.round(l / f); h = Math.round(h / f)
      pleineToile = toileDe(l, h)
      const ctx = pleineToile.getContext('2d')
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(c, 0, 0, l, h)
    }
    const pleine = pleineToile.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, l, h)

    if (E.nettoyage.enCours) annulerNettoyage(false)
    E.chargement = (E.chargement || 0) + 1
    E.tenu = null
    fermerHistorique()
    Object.assign(E.nettoyage, { nette: false, force: false, faiteNet: false })
    E.nom = fichier.name || 'logo-colle.png'
    E.fichier = { largeur: c.width, hauteur: c.height, type: typeDe(fichier) }
    E.original = null
    E.teinte = { type: 'multi' }
    E.split = null
    E.fondChoisi = false
    E.creuxChoisi = false
    E.vueChoisie = false
    E.lissage = LISSAGE
    E.nuances = 50
    fermerMenu()
    remplacer({ data: pleine.data, largeur: l, hauteur: h }, pleineToile, () => {
      /* LE GRAPHISTE LIT LE FICHIER (lib/graphiste.js) : le fond, les
         creux, l'IA — et la version (30 septembre 2026) : une photo en
         Détouré, une image en Image, un logo à plat en Vecteur. */
      E.decision = decider(E.apercu, E.fichier)
      E.net = E.decision.net
      E.methode = E.decision.fond
      E.version = E.decision.version
      E.reglages = { tolerance: D.TOLERANCE, interieur: creuxVoulu(), seuil: SEUIL, ombre: E.decision.ombre }
    })
    /* UN PETIT FICHIER SE NETTOIE SEUL : le détourage de l'image reçue
       s'affiche tout de suite, celui de l'image nettoyée arrive quand l'IA
       a fini. Une matière (une broderie, du cuir, de l'eau) s'agrandit
       aussi dans Détouré : c'est là qu'elle sort, ses pixels jamais tracés
       (29 septembre 2026). Un logo à plat aussi (30 septembre 2026 : « j'ai
       l'impression de ne pas avoir l'Ultra IA » — le logo s'ouvre dans
       Détouré, et l'Ultra ne passait qu'en Vecteur ou en Image, choisis
       avant d'ouvrir le fichier) : ses pixels redessinés par l'Ultra, sous
       ses garde-fous, jamais tracés. « Amélioration IA », décochée, ramène
       le fichier reçu. */
    p.lu = true
    if (E.decision && E.decision.nettoyer) nettoyerImage()
    /* L'HISTORIQUE repart de la décision du graphiste : son entrée 0. */
    E.histo = H.creer(photo())
    majBarre()
  } catch (e) {
    echouer('fichier', (e && e.message) || 'Ce fichier ne se lit pas comme une image.')
  } finally {
    p.ms.fichier = performance.now() - debut
    E.lecture = false
    majEtat()
  }
}

const typeDe = f => {
  const ext = String(f.name || '').split('.').pop().toUpperCase()
  if (/^(JPE?G|PNG|WEBP|HEIC|HEIF|TIFF?|PDF|SVG|AI|GIF|BMP)$/.test(ext)) return ext === 'JPG' ? 'JPEG' : ext === 'TIF' ? 'TIFF' : ext === 'WEBP' ? 'WebP' : ext
  return (String(f.type || '').split('/')[1] || 'image').toUpperCase()
}

/* CE QUI A ÉTÉ CHOISI À LA MAIN, à reporter sur une autre image du même
   fichier (30 septembre 2026 : l'Amélioration IA décochée effaçait les
   teintes changées et les polices choisies). Les teintes, par leur
   couleur ; les polices, par la place de leur ligne dans l'image (de 0 à
   1 : l'IA l'agrandit quatre fois). */
const placeLigne = (l, t) => {
  const b = l.boite, W = t.largeur * t.f, H = t.hauteur * t.f
  return { cx: (b[0] + b[2]) / 2 / W, cy: (b[1] + b[3]) / 2 / H, h: (b[3] - b[1] + 1) / H }
}
function choixAReporter() {
  /* Ce qui attendait encore d'être reporté sur cette image (son tracé ou
     son texte n'était pas là) part tel quel sur la suivante. */
  const attente = E.report && E.report.pleine === E.pleine ? E.report : null
  const teintes = attente && attente.teintes ? attente.teintes : Object.keys(E.recolor).length || E.sans.length ? { recolor: E.recolor, sans: E.sans } : null
  const polices = attente && attente.polices ? attente.polices : policesAReporter()
  return teintes || polices.length ? { teintes, polices } : null
}
/* Les lignes choisies à la main, par leur place dans l'image. */
function policesAReporter() {
  const t = texteAJour() && E.textes.f ? E.textes : null
  return t ? t.lignes.filter(l => l.main).map(l => {
    const p = l.choix >= 0 && l.props[l.choix]
    return Object.assign(placeLigne(l, t), { texte: l.texte, edite: !!l.edite, gras: l.gras || 0, police: p ? { id: p.id, graisse: p.graisse, style: p.style } : null })
  }) : []
}

/* LES TEINTES REPORTÉES, au premier tracé de la nouvelle image : chacune
   sur la couleur la plus proche de son tracé (à moins de 12 d'écart que
   voit l'œil, lib/lab.js), une couleur n'en prenant qu'une. Une teinte
   retirée le reste : le tracé se refait sans elle. */
function reporterTeintes(p) {
  const r = E.report
  if (!r || !r.teintes || r.pleine !== p || !E.vecteur) return
  const { recolor, sans } = r.teintes
  r.teintes = null
  const libres = E.vecteur.couleurs.slice()
  const proche = c => {
    let k = -1, dk = 12
    libres.forEach((o, i) => { const d = ecart(c, o); if (d < dk) { dk = d; k = i } })
    return k < 0 ? null : libres.splice(k, 1)[0]
  }
  const retirees = sans.map(proche).filter(Boolean)
  for (const [cle, v] of Object.entries(recolor)) {
    const o = proche(cle.split(',').map(Number))
    if (o) E.recolor[o.join(',')] = v
  }
  if (retirees.length) { E.sans = retirees; planifierVecteur(0) }
}

/* LES POLICES REPORTÉES, quand le texte de la nouvelle image est lu :
   chaque ligne choisie à la main retrouve la ligne à sa place (à moins de
   0,6 hauteur), sa police si elle est encore proposée, « Dessin
   d'origine » s'il l'était, son gras. Un texte corrigé à la main se
   recherche : rend [ligne, texte] à relire. */
function reporterPolices(t) {
  const r = E.report
  if (!r || !r.polices || !r.polices.length || r.pleine !== E.pleine || !t.f) return []
  const choisies = r.polices
  r.polices = null
  const relire = []
  for (const a of choisies) {
    let k = -1, dk = Infinity
    t.lignes.forEach((l, i) => {
      const b = placeLigne(l, t), d = Math.hypot(b.cx - a.cx, b.cy - a.cy)
      if (d < 0.6 * Math.max(a.h, b.h) && d < dk) { dk = d; k = i }
    })
    if (k < 0) continue
    const l = t.lignes[k]
    l.main = true
    l.gras = a.gras
    if (a.edite && a.texte !== l.texte) { relire.push([k, a.texte]); continue }
    if (!a.police) { l.choix = -1; continue }
    const j = l.props.findIndex(p => p.id === a.police.id && p.graisse === a.police.graisse && p.style === a.police.style)
    if (j >= 0) l.choix = j
  }
  return relire
}

/* UNE AUTRE IMAGE DE TRAVAIL (un fichier ouvert, l'image nettoyée, ou
   l'originale qui revient) : l'IA et le détourage fin de la précédente
   s'arrêtent (une session du modèle ne s'interrompt pas : son fil se
   ferme), tout se recalcule. `avant` : ce qui se règle une fois l'aperçu
   fait (la décision du graphiste). `garderSource` : « Comparer » montre
   toujours le fichier reçu, pas l'image nettoyée. */
let nPleine = 0
function remplacer(pleine, toile, avant = () => {}, garderSource = false) {
  const recue = E.source, recuePleine = E.sourcePleine
  /* Le même fichier, une autre image (l'Amélioration IA cochée ou
     décochée, « Passer en Ultra ») : ce qui a été choisi à la main s'y
     reporte (`reporterTeintes`, `reporterPolices`). Un autre fichier
     repart de rien. */
  const report = E.pleine && pleine !== E.pleine && E.chargement === E.chargementPleine ? choixAReporter() : null
  if (E.ia.enCours) fermerIA()
  E.ia = { n: E.ia.n + 1, enCours: false, pose: false, etape: '', part: 0, moteur: E.ia.moteur, masque: null, cote: 0, modele: '', cle: E.ia.cle + 1, duree: 0, erreur: '' }
  E.pleine = { data: pleine.data, largeur: pleine.largeur, hauteur: pleine.hauteur, n: ++nPleine }
  E.chargementPleine = E.chargement
  E.report = report && Object.assign(report, { pleine: E.pleine })
  /* Les teintes se relisent sur la nouvelle image (leurs couleurs y
     bougent un peu) : ce qu'on y avait changé s'y reporte quand son tracé
     arrive. */
  E.sans = []
  E.recolor = {}
  fermerPop()
  fermerPopPolice()
  installer(E.pleine, toile)
  if (garderSource && recue) { E.source = recue; E.sourcePleine = recuePleine }
  avant()
  ajuster()
  majPanneau()
  recalculer()
  planifierTexte()
}

/* LE NETTOYAGE IA (lib/nettoyage.js) : dans le fil de l'IA, sur la carte
   graphique quand il y en a une. L'image nettoyée devient l'image de
   travail ; « Amélioration IA », décochée, ramène l'originale. Une matière
   passe à l'IA des photos (lib/graphiste.js, `matiere`).
   30 septembre 2026 : un logo à plat passe en ULTRA, quand le poste la
   fait en moins de `ULTRA_AUTO` ; sinon le nettoyage, et « Passer en
   Ultra » (`ultra` vrai : huit orientations, sans compter) — qui repart du
   fichier reçu, pas de l'image déjà nettoyée. */
let nNettoyage = 0
function nettoyerImage(ultra = 'auto') {
  if (!E.pleine || E.nettoyage.enCours) return
  const p = E.pleine
  const o = E.original, source = o ? o.pleine : p, fichier = o ? o.fichier : E.fichier
  const n = ++nNettoyage
  const debut = performance.now()
  const net = E.net
  /* Rendue nette : son flou, en pixels du fichier (lib/graphiste.js). */
  const flou = net && E.decision ? E.decision.flou : 0
  /* « Passer en Ultra » : le temps qu'elle annonçait, pour dire ce qui
     reste. `parti` : son tour est venu dans le fil de l'IA — le sujet de
     l'image reçue a pu y passer avant elle ; `netFait` : « Rendre net » a
     fini, dans cette passe. */
  Object.assign(E.nettoyage, { enCours: true, parti: false, netFait: false, etape: 'telechargement', part: 0, ultra: ultra === true ? 8 : 0, flou, prevu: ultra === true ? E.nettoyage.estime : 0, demande: ultra === true ? 'ultra' : 'oui', demandeNet: net })
  majPanneau()
  ia().demander({ type: 'nettoyer', data: source.data, largeur: source.largeur, hauteur: source.hauteur, matiere: !!(E.decision && E.decision.matiere), ultra: !!ultra, budget: ultra === true ? 0 : ULTRA_AUTO, flou }, pr => {
    if (E.pleine !== p || n !== nNettoyage) return
    if (pr.etat === 'debut' && pr.etape === 'ia') E.nettoyage.parti = true
    if (pr.etat === 'fin' && pr.etape === 'net') E.nettoyage.netFait = true
    if (pr.etat) return evenement(pr)
    E.nettoyage.etape = pr.etape
    if (pr.part !== undefined) E.nettoyage.part = pr.part
    if (pr.moteur) E.nettoyage.moteur = pr.moteur
    if (pr.ultra !== undefined) E.nettoyage.ultra = pr.ultra
    if (pr.estime) E.nettoyage.prevu = pr.estime
    majNettoyage()
  }).then(rep => {
    if (E.pleine !== p || n !== nNettoyage) return
    const toile = toileDe(rep.largeur, rep.hauteur)
    toile.getContext('2d').putImageData(new ImageData(rep.data, rep.largeur, rep.hauteur), 0, 0)
    E.original = { pleine: source, fichier, entree: rep.entree }
    E.fichier = Object.assign({}, fichier, { largeur: rep.largeur, hauteur: rep.hauteur })
    E.nettoyage.faite = rep.ultra || 0
    E.nettoyage.nette = !!rep.nette
    E.nettoyage.force = ultra === true
    E.nettoyage.faiteNet = net
    E.nettoyage.estime = rep.estimeUltra || 0
    E.nettoyage.duree = performance.now() - debut
    E.nettoyage.enCours = false
    remplacer(rep, toile, redecider, true)
  }).catch(e => {
    if (e && e.annule) return
    const mot = (e && e.message) || 'erreur inconnue.'
    const id = E.nettoyage.etape === 'nettete' ? 'net' : 'ia'
    /* L'IA tombée avant « Rendre net » : il n'a pas tourné, il ne s'affiche pas. */
    if (id === 'ia' && !E.nettoyage.netFait && prep) prep.vues.delete('net')
    echouer(id, mot, 'Le nettoyage n\'a pas pu se faire : ' + mot)
  }).finally(() => {
    if (n !== nNettoyage) return
    E.nettoyage.enCours = false
    reposerIA()
    /* L'IA n'a pas abouti : l'image reçue se trace, et se lit. */
    planifierVecteur()
    planifierTexte()
    majPanneau()
  })
}

function annulerNettoyage(sujet = true) {
  nNettoyage++
  fermerIA()
  E.nettoyage.enCours = false
  /* L'image nettoyée d'avant reste : « Rendre net » redit ce qu'elle a
     reçu, pas ce que voulait le calcul arrêté. */
  if (E.original) E.net = E.nettoyage.faiteNet
  /* Le fil fermé emporte aussi le sujet qu'il cherchait (celui d'une
     photo passe avant l'IA) : il repart — sauf pour un autre fichier. */
  if (sujet && E.ia.enCours) {
    E.ia.n++
    E.ia.enCours = false
    if (E.methode === 'ia') recalculer()
  }
  planifierVecteur()
  planifierTexte()
  majPanneau()
}

/* LE GRAPHISTE RELIT la nouvelle image (nettoyée, le grain du JPEG est
   parti : un logo sur fond blanc repasse « à la couleur », ses creux se
   vident) ; ce que la vendeuse a choisi d'un clic reste. */
function redecider() {
  /* La matière et le flou se lisent sur le fichier reçu : l'image
     nettoyée les garde. */
  /* Un imprimé photographié (le fond ombré d'un tissu) l'est encore une
     fois nettoyé : l'IA a pu lisser son grain, pas en faire une photo. */
  const recu = E.original && E.decision ? Object.assign({ matiere: E.decision.matiere, flou: E.decision.flou, net: E.decision.net }, E.decision.ombre ? { fond: 'uni', ombre: true, genre: E.decision.genre, version: E.decision.version } : {}) : {}
  E.decision = Object.assign({}, decider(E.apercu, E.original ? E.original.fichier : E.fichier), { nettoyer: !!E.original }, recu)
  if (!E.fondChoisi) E.methode = E.decision.fond
  if (!E.vueChoisie) E.version = E.decision.version
  if (!E.creuxChoisi) E.reglages.interieur = creuxVoulu()
  E.reglages.ombre = E.decision.ombre
}

/* LES CREUX : Détouré ne retire que le fond autour du logo ; les versions
   tracées suivent le graphiste. */
const creuxVoulu = () => E.version !== 'detoure' && !!(E.decision && E.decision.creux)

function revenirOriginal() {
  const o = E.original
  if (!o) return
  E.original = null
  E.fichier = o.fichier
  const toile = toileDe(o.pleine.largeur, o.pleine.hauteur)
  toile.getContext('2d').putImageData(new ImageData(o.pleine.data, o.pleine.largeur, o.pleine.hauteur), 0, 0)
  remplacer(o.pleine, toile, redecider)
}

/* L'IMAGE DE TRAVAIL arrive : son aperçu d'au plus 1 400 px se fait, et
   tout ce qui en dépend s'efface. `toile` : l'image déjà peinte dans un
   canevas. */
function installer(pleine, toile) {
  const { largeur: l, hauteur: h } = pleine
  const echelle = Math.min(1, APERCU_MAX / Math.max(l, h))
  const al = Math.max(1, Math.round(l * echelle))
  const ah = Math.max(1, Math.round(h * echelle))
  const source = toileDe(al, ah)
  const sctx = source.getContext('2d', { willReadFrequently: true })
  sctx.imageSmoothingQuality = 'high'
  sctx.drawImage(toile, 0, 0, al, ah)
  const apercu = sctx.getImageData(0, 0, al, ah)
  /* `echelle` : de l'image pleine à l'aperçu. */
  E.apercu = { data: apercu.data, largeur: al, hauteur: ah, echelle: al / l }
  E.source = source
  E.sourcePleine = toile
  E.resultat = toileDe(al, ah)
  E.resultatImage = null
  E.fondsLus = []
  E.vecteur = null
  E.repeint = null
  /* Le tracé de l'image d'avant ne sert plus : il se coupe, celui de
     celle-ci part dès que son détourage se pose. */
  if (filVect && finalEnVol) { filVect.fermer(); filVect = null }
  oublierFin()
  connu.clear()
  memoireLocale.apercu = { data: apercu.data, largeur: al, hauteur: ah }
  memoireLocale.affine = null
  const f2 = ouvrirFil()
  if (f2) f2.postMessage({ type: 'source', data: apercu.data, largeur: al, hauteur: ah })
}

function toileDe(l, h) {
  const c = document.createElement('canvas')
  c.width = l
  c.height = h
  return c
}

/* ------------------------------------------------------------------ L'IA */
/* LE SUJET DE LA PHOTO, cherché une fois par image — sur l'aperçu : le
   modèle la ramène de toute façon à 1 024 px. Le masque sert ensuite au
   détourage de l'aperçu, de l'image pleine et du vecteur. */
function lancerIA() {
  if (!E.apercu || E.ia.masque || E.ia.enCours) return
  const n = ++E.ia.n
  const apercu = E.apercu
  const debut = performance.now()
  /* `parti` : son tour est venu dans le fil de l'IA (voir `etatEtape`). */
  Object.assign(E.ia, { enCours: true, parti: false, etape: 'telechargement', part: 0, erreur: '' })
  majPanneau()
  dessiner()
  /* Le sujet d'une illustration collée, choisi par le graphiste : BiRefNet
     ou rien (lib/graphiste.js, `birefnet`) — rien, et le fond repasse à la
     couleur. Choisi d'un clic, ISNet fait l'affaire. */
  const exiger = !E.fondChoisi && !!(E.decision && E.decision.birefnet)
  ia().demander({ type: 'ia', data: apercu.data, largeur: apercu.largeur, hauteur: apercu.hauteur, matiere: !!(E.decision && E.decision.matiere), exiger }, p => {
    if (n !== E.ia.n) return
    /* Le modèle qui cherche (BiRefNet, ISNet) se dit dans la préparation. */
    if (p.etat === 'debut') E.ia.parti = true
    if (p.etat || p.modele !== undefined) evenement(p)
    if (p.etat) return
    E.ia.etape = p.etape
    if (p.part !== undefined) E.ia.part = p.part
    if (p.moteur) E.ia.moteur = p.moteur
    majEtat()
  }).then(rep => {
    if (n !== E.ia.n || E.apercu !== apercu) return
    if (!rep.masque) {
      E.decision = Object.assign({}, E.decision, { fond: 'uni', birefnet: false })
      if (!E.fondChoisi && E.methode === 'ia') { E.methode = 'uni'; recalculer() }
      return
    }
    Object.assign(E.ia, { masque: rep.masque, cote: rep.cote, modele: rep.modele, cle: E.ia.cle + 1, moteur: rep.moteur, duree: performance.now() - debut, pose: true })
    if (E.methode === 'ia') recalculer()
  }).catch(e => {
    if (n !== E.ia.n || e.annule) return
    E.ia.erreur = (e && e.message) || 'L\'IA n\'a pas pu tourner.'
    echouer('sujet', E.ia.erreur, 'L\'IA n\'a pas pu tourner : ' + E.ia.erreur)
  }).finally(() => {
    if (n !== E.ia.n) return
    E.ia.enCours = false
    reposerIA()
    majPanneau()
    dessiner()
  })
}

/* -------------------------------------------------------------- LE CALCUL */
/* Le message d'un détourage, à la couleur ou par le sujet. */
function messageCalcul(echelle) {
  const m = { type: 'calcul', methode: E.methode, reglages: Object.assign({}, E.reglages), echelle }
  if (E.methode === 'ia') Object.assign(m, { masque: E.ia.masque, cote: E.ia.cote, modele: E.ia.modele, cle: E.ia.cle })
  return m
}

function recalculer() {
  if (!E.apercu) return
  if (E.methode === 'ia' && !E.ia.masque) return lancerIA()
  const c = E.calcul
  if (c.enVol) { c.aRefaire = true; return }
  c.enVol = true
  majEtat()
  const { largeur: l, hauteur: h, data: source } = E.apercu
  /* Un résultat d'une autre méthode (on a changé pendant le calcul) ne
     s'affiche pas : le calcul suivant arrive. */
  const methode = E.methode
  const cleIA = E.ia.cle
  demander(messageCalcul(E.apercu.echelle), evenement).then(rep => {
    if (!E.apercu || E.apercu.data !== source || methode !== E.methode || (methode === 'ia' && cleIA !== E.ia.cle)) return
    E.fondsLus = rep.fonds || []
    if (methode === 'ia') E.ia.pose = false
    E.resultatImage = new ImageData(rep.data, l, h)
    if (E.resultat.width !== l || E.resultat.height !== h) E.resultat = toileDe(l, h)
    E.resultat.getContext('2d').putImageData(E.resultatImage, 0, 0)
    if (E.repeint) E.repeint.surApercu = false
    planifierFin()
    planifierVecteur()
    repeindre()
    majPanneau()
    dessiner()
  }).catch(e => echouer('detourage', e.message)).finally(() => {
    c.enVol = false
    majEtat()
    if (c.aRefaire) { c.aRefaire = false; recalculer() }
  })
}

/* LE DÉTOURAGE PLEINE TAILLE. L'aperçu fait 1 400 px ; une photo en fait
   4 000. Dès que le détourage se pose, l'image pleine se détoure dans son
   propre fil : zoomé, le plan la montre en attendant le vecteur, et le
   vecteur la reprend telle quelle au lieu de tout refaire. */
let filFin = null
let filFinPleine = null
let minuteurFin = null
let finEnVol = false
let finARefaire = false
const cleFin = () => JSON.stringify([E.methode, E.reglages, E.methode === 'ia' ? E.ia.cle : 0])
const finAJour = () => !!(E.fin.toile && E.fin.cle === cleFin() && E.fin.pleine === E.pleine)

function oublierFin() {
  clearTimeout(minuteurFin)
  E.fin = { toile: null, data: null, cle: '', pleine: null }
  if (filFin && filFinPleine !== E.pleine) {
    filFin.fermer()
    filFin = null
    filFinPleine = null
  }
}

function planifierFin() {
  clearTimeout(minuteurFin)
  if (!E.pleine || !E.apercu || E.pleine.largeur <= E.apercu.largeur || finAJour()) return
  if (E.methode === 'ia' && !E.ia.masque) return
  minuteurFin = setTimeout(calculerFin, 450)
}

let finPromesse = Promise.resolve()
function calculerFin() {
  if (finEnVol) { finARefaire = true; return finPromesse }
  const cle = cleFin()
  const p = E.pleine
  if (!filFin || filFinPleine !== p) {
    if (filFin) filFin.fermer()
    filFin = filDedie()
    filFinPleine = p
    filFin.envoyer({ type: 'source', data: p.data, largeur: p.largeur, hauteur: p.hauteur })
  }
  finEnVol = true
  finPromesse = filFin.demander(messageCalcul(1)).then(rep => {
    if (E.pleine !== p || cle !== cleFin()) return
    const t = toileDe(p.largeur, p.hauteur)
    t.getContext('2d').putImageData(new ImageData(rep.data, p.largeur, p.hauteur), 0, 0)
    E.fin = { toile: t, data: rep.data, cle, pleine: p }
    repeindre()
    dessiner()
  }).catch(() => {}).finally(() => {
    finEnVol = false
    if (finARefaire) { finARefaire = false; planifierFin() }
  })
  return finPromesse
}

/* ---------------------------------------------------------------- LA VUE */
function dimensionner() {
  const scene = r('scene')
  const toile = r('toile')
  if (!scene || !toile) return
  const dpr = window.devicePixelRatio || 1
  const l = Math.max(1, scene.clientWidth)
  const h = Math.max(1, scene.clientHeight)
  if (toile.width !== Math.round(l * dpr) || toile.height !== Math.round(h * dpr)) {
    toile.width = Math.round(l * dpr)
    toile.height = Math.round(h * dpr)
  }
}

function ajuster() {
  const scene = r('scene')
  if (!scene || !E.apercu) return
  const W = scene.clientWidth
  const H = scene.clientHeight
  const { largeur: l, hauteur: h } = E.apercu
  /* Les versions tiennent le haut, la barre du plan le bas : l'image se
     centre entre elles. */
  const haut = 60, bas = 76
  const zoom = Math.max(0.02, Math.min((W - 96) / l, (H - haut - bas) / h, 8))
  E.vue = { zoom, ox: (W - l * zoom) / 2, oy: haut + (H - haut - bas - h * zoom) / 2, ajuste: true }
}

function zoomer(facteur, cx, cy) {
  const v = E.vue
  /* Jusqu'à 3 200 % de l'image pleine : le vecteur, lui, reste net. */
  const plafond = E.apercu && E.pleine ? 32 * E.pleine.largeur / E.apercu.largeur : 40
  const zoom = Math.max(0.02, Math.min(plafond, v.zoom * facteur))
  v.ox = cx - (cx - v.ox) * zoom / v.zoom
  v.oy = cy - (cy - v.oy) * zoom / v.zoom
  v.zoom = zoom
  v.ajuste = false
  dessiner()
}

/* 100 % : un pixel du fichier pour un point de l'écran, centré. */
function centPourCent() {
  const scene = r('scene')
  if (!scene || !E.apercu) return
  zoomer(E.pleine.largeur / E.apercu.largeur / E.vue.zoom, scene.clientWidth / 2, scene.clientHeight / 2)
}

function dessiner() {
  const toile = r('toile')
  if (!toile) return
  const ctx = toile.getContext('2d')
  const dpr = window.devicePixelRatio || 1
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, toile.width, toile.height)
  majZoom()
  placerSplit()
  placerPopPolice()
  if (!E.apercu || !E.resultat) return
  const { zoom, ox, oy } = E.vue
  const l = E.apercu.largeur * zoom
  const h = E.apercu.hauteur * zoom
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  if (E.comparer) return dessinerAvant(ctx, ox, oy, l, h)
  const scene = r('scene')
  if (E.split !== null) {
    const x = scene.clientWidth * E.split
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, x, scene.clientHeight)
    ctx.clip()
    dessinerAvant(ctx, ox, oy, l, h)
    ctx.restore()
    ctx.save()
    ctx.beginPath()
    ctx.rect(x, 0, scene.clientWidth - x, scene.clientHeight)
    ctx.clip()
    dessinerApres(ctx, l, h)
    ctx.restore()
    return
  }
  dessinerApres(ctx, l, h)
  dessinerLignes(ctx)
}

/* LE PLAN, AVANT : le fichier reçu — zoomé au-delà de l'aperçu, en pleine
   taille, et seulement le morceau à l'écran (30 septembre 2026 :
   « Comparer » montrait l'avant flou au zoom, l'aperçu de 1 400 px
   agrandi, à côté d'un après net). */
function dessinerAvant(ctx, ox, oy, l, h) {
  const dpr = window.devicePixelRatio || 1
  if (E.vue.zoom * dpr > 1.05 && E.sourcePleine) return dessinerMorceau(ctx, E.sourcePleine, ox, oy, l, h)
  ctx.drawImage(E.source, ox, oy, l, h)
}

/* LE PLAN, APRÈS : le vecteur, sinon — le temps qu'il arrive — l'image
   détourée. */
function dessinerApres(ctx, l, h) {
  const { zoom, ox, oy } = E.vue
  const dpr = window.devicePixelRatio || 1
  /* L'IA cherche : la photo, pâlie, le temps qu'elle trouve. */
  const enAttente = E.methode === 'ia' && (!E.ia.masque || E.ia.pose)
  if (!E.resultatImage || enAttente) {
    ctx.globalAlpha = 0.35
    ctx.drawImage(E.source, ox, oy, l, h)
    ctx.globalAlpha = 1
    return
  }
  if (E.version !== 'detoure' && vecteurMontre()) return dessinerVecteur(ctx)
  /* Zoomé au-delà de l'aperçu : l'image pleine, détourée à part — et
     seulement le morceau à l'écran (elle fait des millions de pixels). */
  if (zoom * dpr > 1.05 && finAJour()) return dessinerMorceau(ctx, E.fin.toile, ox, oy, l, h)
  ctx.drawImage(E.resultat, ox, oy, l, h)
}

function dessinerMorceau(ctx, img, ox, oy, l, h) {
  const scene = r('scene')
  const W = scene.clientWidth, H = scene.clientHeight
  const kx = img.width / l, ky = img.height / h
  const x0 = Math.max(0, -ox), y0 = Math.max(0, -oy)
  const x1 = Math.min(l, W - ox), y1 = Math.min(h, H - oy)
  if (x1 <= x0 || y1 <= y0) return
  ctx.drawImage(img, x0 * kx, y0 * ky, (x1 - x0) * kx, (y1 - y0) * ky, ox + x0, oy + y0, x1 - x0, y1 - y0)
}

/* LE VECTEUR À L'ÉCRAN : chaque forme se dessine elle-même, nette à tous
   les zooms ; un dégradé, l'image dans son contour. */
function dessinerVecteur(ctx) {
  const a = affichage()
  if (!a) return
  const v = E.vecteur
  const { zoom, ox, oy } = E.vue
  const s = zoom * E.apercu.echelle
  ctx.save()
  ctx.translate(ox, oy)
  ctx.scale(s, s)
  if (a.degrade) peindreDegrade(ctx, a, v.cadre)
  else for (const f of a.formes) { ctx.fillStyle = f.couleur; ctx.fill(f.path, f.regle) }
  ctx.restore()
}

/* LA VERSION IMAGE : l'image dans son contour, puis les lettres des
   polices en vrai vecteur par-dessus — nettes à tous les zooms, et
   entières là où elles sont posées dans le vide, hors du contour. */
function peindreDegrade(ctx, a, c) {
  const n = a.formes.length - a.lettres
  if (n > 0) {
    ctx.save()
    ctx.clip(a.formes[0].path, 'evenodd')
    ctx.drawImage(a.image, c.x, c.y, c.largeur, c.hauteur)
    ctx.restore()
  }
  for (const f of a.formes.slice(n)) { ctx.fillStyle = f.couleur; ctx.fill(f.path, f.regle) }
}

/* LE ZOOM, en pixels de l'image pleine : 100 %, un pixel du fichier pour
   un point de l'écran. */
function majZoom() {
  const z = r('zoom')
  if (!z) return
  z.textContent = E.apercu && E.pleine ? Math.max(1, Math.round(E.vue.zoom * E.apercu.largeur / E.pleine.largeur * 100)) + ' %' : '—'
}

function placerSplit() {
  const s = r('split')
  if (!s) return
  const on = E.split !== null && !!E.apercu
  s.hidden = !on
  if (on) s.style.left = (E.split * 100) + '%'
}

/* ------------------------------------------------------------ LE PANNEAU */
/* LES GESTES QUE L'HISTORIQUE NOTE : ce qui change un réglage. Le fond de
   l'aperçu, le zoom, « Comparer », un export n'en sont pas. Le libellé se
   lit entre les deux photos (lib/historique.js, `decrire`), sauf ici. */
const GESTES = new Set(['ligne-police', 'blanc', 'fond-retire', 'nettoyer', 'net', 'ultra', 'version', 'teinte-mode', 'teinte', 'pop-nuancier', 'pop-origine', 'pop-retirer', 'pop-remettre'])
const LIBELLES = {
  net: () => netMontre() ? 'Rendre net' : 'Rendre net coupé',
}

function clic(e) {
  const b = e.target.closest('[data-a]')
  if (!b || !(E.racine.contains(b) || (E.barre && E.barre.contains(b)))) {
    if (E.pop && !e.target.closest('[data-r="pop"]')) fermerPop()
    if (E.menu && !e.target.closest('[data-r="menu"]')) fermerMenu()
    if (E.historique && !e.target.closest('[data-r="historique"]')) fermerHistorique()
    /* Le plan ouvre et ferme la bulle d'une ligne lui-même (ses
       événements de pointeur) : son `click` ne la referme pas. */
    if (E.popPolice >= 0 && !e.target.closest('[data-r="pop-police"], [data-r="toile"]')) fermerPopPolice()
    return
  }
  const a = b.dataset.a
  const v = b.dataset.v
  if (a !== 'couleur' && !a.startsWith('pop-') && E.pop) fermerPop()
  if (a !== 'menu' && !b.closest('[data-r="menu"]') && E.menu) fermerMenu()
  if (a !== 'historique' && !b.closest('[data-r="historique"]') && E.historique) fermerHistorique()
  if (a !== 'ligne' && !b.closest('[data-r="pop-police"]') && E.popPolice >= 0) fermerPopPolice()
  if (GESTES.has(a)) return geste(() => agir(a, v, b), LIBELLES[a])
  agir(a, v, b)
}

function agir(a, v, b) {
  if (a === 'choisir') return r('fichier').click()
  if (a === 'prep-fermer') return fermerPrep()
  /* LA BARRE : annuler, rétablir, l'historique et ses gestes. */
  if (a === 'annuler') return defaire()
  if (a === 'retablir') return refaire()
  if (a === 'historique') return E.historique ? fermerHistorique() : ouvrirHistorique()
  if (a === 'histo') { fermerHistorique(); return allerA(Number(v)) }
  /* LA POLICE AU CLIC : une ligne du panneau ouvre sa bulle sur le plan ;
     dans la bulle, une police (ou le dessin d'origine) se choisit. */
  if (a === 'ligne') return ouvrirPopPolice(Number(v), true)
  if (a === 'pop-police-fermer') return fermerPopPolice()
  if (a === 'ligne-police') {
    const l = texteAJour() && E.textes.lignes[E.popPolice]
    if (l && !l.recherche) { l.choix = Number(v); l.main = true; majPolice(); poserPolices() }
    return
  }
  if (a === 'menu') return E.menu ? fermerMenu() : ouvrirMenu()
  if (a === 'fond') {
    E.fondVue = { type: v, couleur: E.fondVue.couleur }
    garderFondVue()
    return majPanneau()
  }
  if (a === 'blanc') {
    E.blanc = !E.blanc
    garder('olda.detourage.blanc', E.blanc ? '1' : '0')
    return majPanneau()
  }
  if (!E.apercu) return
  if (a === 'split') basculerSplit()
  else if (a === 'fond-retire') {
    /* La vendeuse contredit le graphiste : le fond autour du logo, partout
       (le noir enfermé dans un cercle, le creux des lettres), ou le sujet
       d'une photo. Un nouveau clic sur « Sujet » après un échec réessaie. */
    const methode = v === 'sujet' ? 'ia' : 'uni'
    const interieur = v === 'sujet' ? E.reglages.interieur : v === 'partout'
    if (methode === E.methode && interieur === E.reglages.interieur && !(methode === 'ia' && E.ia.erreur)) return
    if (methode !== E.methode) E.fondChoisi = true
    if (interieur !== E.reglages.interieur) E.creuxChoisi = true
    E.methode = methode
    E.reglages = Object.assign({}, E.reglages, { interieur })
    E.ia.erreur = ''
    recalculer()
    planifierFin()
    dessiner()
    preparer()
  } else if (a === 'nettoyer') {
    if (E.nettoyage.enCours) annulerNettoyage()
    else if (E.original) revenirOriginal()
    else nettoyerImage()
    preparer()
  } else if (a === 'net') {
    /* « Rendre net » : l'IA repart du fichier reçu, avec ou sans le flou
       retiré ; cochée sans l'IA, elle la lance. */
    const enCours = E.nettoyage.enCours
    const net = !netMontre()
    if (enCours) annulerNettoyage()
    E.net = net
    if (E.net || E.original || enCours) nettoyerImage()
    else majPanneau()
    preparer()
  } else if (a === 'ultra') {
    if (!E.nettoyage.enCours) { nettoyerImage(true); preparer() }
  } else if (a === 'version') changerVersion(v)
  else if (a === 'teinte-mode') {
    E.teinte = v === 'multi' ? { type: 'multi' } : E.uneCouleur
    majCouleurs()
  } else if (a === 'teinte') {
    E.teinte = { type: 'nuancier', nom: v }
    E.uneCouleur = E.teinte
    majCouleurs()
  } else if (a === 'couleur') ouvrirPop(v, b)
  else if (a === 'pop-nuancier') { E.recolor[E.pop] = hexVersRvb(v); fermerPop(); majCouleurs() }
  else if (a === 'pop-origine') { delete E.recolor[E.pop]; fermerPop(); majCouleurs() }
  else if (a === 'pop-retirer') {
    E.sans = E.sans.concat([E.pop.split(',').map(Number)])
    fermerPop()
    planifierVecteur(0)
  } else if (a === 'pop-remettre') {
    const c = E.pop
    E.sans = E.sans.filter(x => x.join(',') !== c)
    fermerPop()
    planifierVecteur(0)
  } else if (a === 'pop-fermer') fermerPop()
  else if (a === 'enregistrer') { fermerMenu(); enregistrer(v) }
  else if (a === 'ajuster') {
    ajuster()
    dessiner()
  }
  majPanneau()
}

/* VECTEUR OU IMAGE : la vendeuse choisit, le graphiste ne rechoisit plus. */
function changerVersion(v) {
  if (!['detoure', 'vecteur', 'image'].includes(v) || v === E.version) return
  E.version = v
  E.vueChoisie = true
  /* Le fond suit, tant que la vendeuse ne l'a pas choisi : autour
     seulement pour Détouré, les creux du graphiste pour un tracé. */
  if (!E.creuxChoisi && E.methode !== 'ia' && E.apercu && E.reglages.interieur !== creuxVoulu()) {
    E.reglages = Object.assign({}, E.reglages, { interieur: creuxVoulu() })
    recalculer()
    planifierFin()
  }
  planifierVecteur(0)
  majPanneau()
  majCouleurs()
  preparer()
}

function basculerSplit() {
  E.split = E.split === null ? 0.5 : null
  majPanneau()
  dessiner()
}

/* LE MENU « PLUS », ouvert au-dessus de son bouton. */
function ouvrirMenu() {
  fermerPop()
  E.menu = true
  majPanneau()
}
function fermerMenu() {
  if (!E.menu) return
  E.menu = false
  majPanneau()
}

/* ------------------------------------------------------------ L'HISTORIQUE
   (lib/historique.js, 30 septembre 2026) Une photo des réglages après
   chaque geste ; Annuler repose celle d'avant et relance le calcul comme
   si la vendeuse avait touché le réglage. Les curseurs (et la teinte
   cherchée dans « Autre ») ne font qu'un geste, noté au relâchement. */
const TENUS = ['seuil', 'lissage', 'nuances', 'gras', 'pop-couleur']

/* LA PHOTO DES RÉGLAGES — jamais des pixels. */
function photo() {
  const n = E.nettoyage
  return {
    /* L'image de travail où la photo est prise. */
    pleine: E.pleine ? E.pleine.n : null,
    version: E.version, vueChoisie: E.vueChoisie,
    methode: E.methode, fondChoisi: E.fondChoisi, creuxChoisi: E.creuxChoisi,
    reglages: Object.assign({}, E.reglages),
    lissage: E.lissage, nuances: E.nuances,
    teinte: Object.assign({}, E.teinte), uneCouleur: Object.assign({}, E.uneCouleur),
    teintes: photoTeintes(),
    polices: photoPolices(),
    blanc: E.blanc,
    ia: n.enCours ? n.demande : E.original ? (n.force ? 'ultra' : 'oui') : 'non',
    net: E.net,
  }
}
const copieTeintes = t => ({ recolor: Object.fromEntries(Object.entries(t.recolor).map(([k, v]) => [k, v.slice()])), sans: t.sans.map(c => c.slice()) })
/* Les teintes, sur la palette de cette image (`pleine`) — ou telles
   qu'elles attendent encore d'y être reportées. */
function photoTeintes() {
  const attente = E.report && E.report.pleine === E.pleine && E.report.teintes
  return Object.assign({ pleine: attente || !E.pleine ? null : E.pleine.n }, copieTeintes(attente || E))
}
/* Les polices : chaque ligne telle qu'elle est sur cette lecture (`cle`),
   et celles choisies à la main par leur place — pour une autre image. */
function photoPolices() {
  const attente = E.report && E.report.pleine === E.pleine && E.report.polices
  if (attente) return { cle: null, lignes: null, report: attente }
  const t = texteAJour() && E.textes.etat === 'pret' ? E.textes : null
  if (!t) return { cle: null, lignes: null, report: [] }
  return {
    cle: t.cle,
    lignes: t.lignes.map(l => ({ texte: l.texte, props: l.props, ecriture: !!l.ecriture, reconnue: !!l.reconnue, choix: l.choix, gras: l.gras || 0, main: !!l.main, edite: !!l.edite, recherche: !!l.recherche, police: l.choix >= 0 && l.props[l.choix] ? l.props[l.choix].nom : null })),
    report: policesAReporter(),
  }
}

/* UN GESTE : le point à l'écran reprend l'état vivant, le geste se fait,
   puis la photo d'après est notée — si quelque chose a bougé. */
let dansGeste = false
function geste(faire, libelle) {
  if (!E.histo || dansGeste) return faire()
  finirGeste()
  H.rafraichir(E.histo, photo())
  dansGeste = true
  try { return faire() } finally { dansGeste = false; noterGeste(libelle) }
}
function noterGeste(libelle) {
  const h = E.histo
  if (!h) return
  const avant = h.points[h.ici].photo, apres = photo()
  if (H.pareil(avant, apres)) return
  H.noter(h, (libelle && libelle()) || H.decrire(avant, apres, c => H.nomTeinte(c, NUANCIER)), apres)
  majBarre()
}
/* UN CURSEUR QU'ON PREND : la photo d'avant, une fois ; le geste se note
   quand on le lâche (`finirGeste`, sur son « change »). */
function entamer(cible) {
  if (E.tenu === cible) return
  finirGeste()
  if (!E.histo) return
  H.rafraichir(E.histo, photo())
  E.tenu = cible
}
function finirGeste() {
  if (!E.tenu) return
  E.tenu = null
  noterGeste()
}

/* ANNULER, RÉTABLIR, ALLER À UN POINT : la photo reposée, et ce qui a
   bougé, dit en passant. */
const defaire = () => bouger(h => H.reculer(h, photo()), h => 'Annulé « ' + h.points[h.ici + 1].libelle + ' »')
const refaire = () => bouger(h => H.avancer(h, photo()), h => 'Rétabli « ' + h.points[h.ici].libelle + ' »')
const allerA = k => bouger(h => H.aller(h, k, photo()), h => 'Retour à « ' + h.points[h.ici].libelle + ' »')
function bouger(aller, mot) {
  const h = E.histo
  if (!h || !E.apercu || E.lecture) return
  finirGeste()
  const p = aller(h)
  if (!p) return
  remettre(p)
  toast(mot(h))
  majBarre()
}

/* REPOSER UNE PHOTO, et relancer ce qui en dépend comme si la vendeuse
   avait touché chaque réglage : l'IA (arrêtée d'abord si elle tourne pour
   autre chose), le détourage si le fond a bougé, le tracé, les polices. */
function remettre(p) {
  const cle = cleFin(), pleine = E.pleine
  const avant = { version: E.version, methode: E.methode, interieur: E.reglages.interieur, enCours: E.nettoyage.enCours, original: E.original }
  fermerPop()
  E.version = p.version
  E.vueChoisie = p.vueChoisie
  E.methode = p.methode
  E.fondChoisi = p.fondChoisi
  E.creuxChoisi = p.creuxChoisi
  E.reglages = Object.assign({}, p.reglages)
  E.lissage = p.lissage
  E.nuances = p.nuances
  E.teinte = Object.assign({}, p.teinte)
  E.uneCouleur = Object.assign({}, p.uneCouleur)
  if (E.blanc !== p.blanc) { E.blanc = p.blanc; garder('olda.detourage.blanc', E.blanc ? '1' : '0') }
  E.ia.erreur = ''
  remettreImage(p)
  /* L'image est restée, mais la photo a été prise sur une autre (avant que
     l'IA ne la refasse) : ce que la vendeuse n'a pas choisi, le graphiste
     le redécide sur celle-ci, comme après l'IA (`redecider`, puis le
     modelé lu par le tracé). */
  if (E.pleine && E.pleine === pleine && p.pleine !== E.pleine.n && E.decision) {
    if (!E.fondChoisi) E.methode = E.decision.fond
    if (!E.vueChoisie) E.version = E.decision.version !== 'detoure' && E.vecteur && E.vecteur.pleine === E.pleine && !E.vecteur.apercu ? (E.vecteur.degrade ? 'image' : 'vecteur') : E.decision.version
    if (!E.creuxChoisi) E.reglages.interieur = creuxVoulu()
  }
  remettreTeintes(p.teintes)
  remettrePolices(p.polices)
  /* La même image (une autre s'est déjà toute recalculée) : le détourage,
     si le fond a bougé. */
  if (E.pleine === pleine && cleFin() !== cle) { recalculer(); planifierFin() }
  planifierVecteur(0)
  /* L'IA, le fond ou la version qui changent ouvrent la préparation,
     comme d'un clic — un curseur, une teinte, une police jamais. */
  if (E.nettoyage.enCours !== avant.enCours || E.original !== avant.original || E.version !== avant.version || E.methode !== avant.methode || E.reglages.interieur !== avant.interieur) preparer()
  majPanneau()
  majCouleurs()
}

/* L'AMÉLIORATION IA ET « RENDRE NET » de la photo : l'IA qui tourne pour
   autre chose s'arrête d'abord ; l'image nettoyée qui convient reste ;
   sinon l'IA repart du fichier reçu — ou le fichier reçu revient. */
function remettreImage(p) {
  const n = E.nettoyage
  const voulue = (ia, net) => ia === p.ia && net === p.net
  if (n.enCours && !voulue(n.demande, n.demandeNet)) annulerNettoyage()
  E.net = p.net
  if (p.ia === 'non') { if (E.original) revenirOriginal(); return }
  if (n.enCours || (E.original && voulue(n.force ? 'ultra' : 'oui', n.faiteNet))) return
  nettoyerImage(p.ia === 'ultra' ? true : 'auto')
}

/* LES TEINTES : telles quelles sur la même image ; d'une autre (l'IA l'a
   refaite), reportées sur la couleur la plus proche de son tracé
   (`reporterTeintes`). */
function remettreTeintes(t) {
  const attente = E.report && E.report.pleine === E.pleine ? E.report : null
  if ((!Object.keys(t.recolor).length && !t.sans.length) || (E.pleine && t.pleine === E.pleine.n)) {
    Object.assign(E, copieTeintes(t))
    if (attente) attente.teintes = null
    return
  }
  E.recolor = {}
  E.sans = []
  E.report = Object.assign(attente || { polices: null, pleine: E.pleine }, { teintes: copieTeintes(t) })
  if (vecteurAJour()) reporterTeintes(E.pleine)
}

/* LES POLICES : ligne par ligne sur la même lecture ; sur une autre,
   chaque ligne revient à ce que le graphiste y a posé, puis les choix de
   la photo s'y reportent par leur place. Le texte se lit encore : ils
   l'attendent. */
function remettrePolices(pp) {
  const attente = E.report && E.report.pleine === E.pleine ? E.report : null
  const t = texteAJour() && E.textes.etat === 'pret' ? E.textes : null
  if (!t) {
    if (E.pleine && (pp.report.length || attente)) E.report = Object.assign(attente || { teintes: null, pleine: E.pleine }, { polices: pp.report.length ? pp.report : null })
    return
  }
  for (const l of t.lignes) l.jeton = (l.jeton || 0) + 1
  if (pp.cle === t.cle && pp.lignes && pp.lignes.length === t.lignes.length) {
    pp.lignes.forEach((s, i) => Object.assign(t.lignes[i], { texte: s.texte, props: s.props, ecriture: s.ecriture, reconnue: s.reconnue, choix: s.choix, gras: s.gras, main: s.main, edite: s.edite, recherche: false }))
    if (attente) attente.polices = null
    /* Une ligne photographiée pendant sa recherche (son texte corrigé, ses
       polices pas encore là) la relance. */
    pp.lignes.forEach((s, i) => { if (s.recherche) relireLigne(i, s.texte, true) })
  } else {
    for (const l of t.lignes) Object.assign(l, l.defaut, { gras: 0, main: false, edite: false, recherche: false })
    if (pp.report.length) {
      E.report = Object.assign(attente || { teintes: null, pleine: E.pleine }, { polices: pp.report })
      for (const [k, texte] of reporterPolices(t)) relireLigne(k, texte)
    }
  }
  majPolice()
  poserPolices()
}

/* LA BARRE : le fichier, et ce qu'Annuler et Rétablir feraient. */
function majBarre() {
  const B = E.barre
  if (!B) return
  const image = !!E.apercu
  const nom = image ? E.nom : 'Aucune image'
  const recu = E.original ? E.original.fichier : E.fichier
  /* Ce que le graphiste a lu (lib/graphiste.js, `genre`) : une photo, une
     image (de la matière, une illustration), un logo à plat. */
  const genre = E.decision ? { photo: 'photo', image: E.decision.matiere ? 'matière' : 'illustration', logo: 'logo à plat' }[E.decision.genre] || '' : ''
  const taille = image ? [px(recu.largeur) + ' × ' + px(recu.hauteur) + ' px', recu.type, genre, E.original ? (E.nettoyage.faite ? 'IA Ultra ×4' : 'IA ×4') + (E.nettoyage.nette ? ', nette' : '') : ''].filter(Boolean).join(' · ') : ''
  const n = r('nom'), t = r('taille')
  if (n.textContent !== nom) { n.textContent = nom; n.title = image ? nom : '' }
  if (t.textContent !== taille) t.textContent = taille
  const h = image ? E.histo : null
  const derriere = h && h.ici > 0 ? h.points[h.ici].libelle : ''
  const devant = h && h.ici < h.points.length - 1 ? h.points[h.ici + 1].libelle : ''
  const annuler = B.querySelector('[data-a="annuler"]'), retablir = B.querySelector('[data-a="retablir"]'), histo = B.querySelector('[data-a="historique"]')
  annuler.disabled = !derriere
  annuler.title = derriere ? 'Annuler « ' + derriere + ' » (Ctrl Z)' : 'Annuler (Ctrl Z)'
  retablir.disabled = !devant
  retablir.title = devant ? 'Rétablir « ' + devant + ' » (Ctrl Maj Z)' : 'Rétablir (Ctrl Maj Z)'
  histo.disabled = !h
  histo.setAttribute('aria-expanded', String(E.historique))
  r('historique').hidden = !E.historique
  if (E.historique) dessinerHistorique()
}

/* LE MENU « HISTORIQUE » : un geste par ligne, le plus récent en haut ;
   celui à l'écran marqué, ceux qu'on peut rétablir en gris. Un clic y
   revient. */
function dessinerHistorique() {
  const h = E.histo, menu = r('historique')
  if (!h || !menu) return
  const maintenant = Date.now()
  let html = '<div class="o-studio-menu-titre">Historique</div>'
  for (let k = h.points.length - 1; k >= 0; k--) {
    const p = h.points[k]
    html += '<button type="button" role="menuitemradio" aria-checked="' + (k === h.ici) + '" class="o-studio-article o-studio-histo' + (k > h.ici ? ' o-studio-histo-apres' : '') + '" data-a="histo" data-v="' + k + '" title="' + attr(p.libelle) + '">'
      + '<span class="o-studio-article-mot">' + html_(p.libelle) + '</span><small>' + H.quandDit(p.quand, maintenant) + '</small></button>'
  }
  if (menu.dataset.dessin !== html) { menu.innerHTML = html; menu.dataset.dessin = html }
}
let minuteurHistorique = null
function ouvrirHistorique() {
  if (!E.histo) return
  fermerPop()
  fermerMenu()
  fermerPopPolice()
  E.historique = true
  majBarre()
  /* « il y a 2 min » se tient à jour, le menu ouvert. */
  clearInterval(minuteurHistorique)
  minuteurHistorique = setInterval(dessinerHistorique, 20000)
}
function fermerHistorique() {
  if (!E.historique) return
  E.historique = false
  clearInterval(minuteurHistorique)
  majBarre()
}

/* « 4 032 » : l'espace des milliers ne se coupe pas en fin de ligne. */
const px = n => n.toLocaleString('fr-FR').replace(/\s/g, ' ')

function majPanneau() {
  const R = E.racine
  if (!R) return
  const image = !!E.apercu
  R.classList.toggle('o-studio-vide', !image)
  r('accueil').hidden = image
  R.querySelectorAll('[data-besoin="image"]').forEach(s => s.toggleAttribute('inert', !image))
  majBarre()

  majCouleurs(false)
  majPolice()

  /* LE BOUTON : le PDF, ou ce qui part. */
  const ia = E.methode === 'ia'
  const pret = image && !(ia && !E.ia.masque)
  const bouton = R.querySelector('.o-studio-telecharger')
  r('enregistrer-mot').textContent = E.exporte ? (E.nettoyage.enCours ? 'Après l\'IA…' : 'Préparation…') : E.fait ? FORMATS[E.fait] + ' téléchargé' : 'Télécharger le PDF'
  bouton.disabled = !pret || !!E.exporte
  bouton.classList.toggle('o-studio-fait', !!E.fait)

  /* LE FOND : autour, partout, ou le sujet d'une photo — et la couleur
     retirée. */
  const retire = ia ? 'sujet' : E.reglages.interieur ? 'partout' : 'autour'
  R.querySelectorAll('[data-a="fond-retire"]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === retire)))
  const resFond = r('res-fond')
  const fonds = image && !ia ? E.fondsLus.slice(0, 2) : []
  const dessinFond = ia ? 'IA' : fonds.length ? fonds.map(c => '<i class="o-studio-fond-teinte" style="background:' + rvbHex(c) + '" title="' + rvbHex(c).toUpperCase() + '"></i>').join('') : image && E.resultatImage ? 'Transparent' : ''
  if (resFond.innerHTML !== dessinFond) resFond.innerHTML = dessinFond

  /* LES CURSEURS : le seuil (à la couleur près pour un fond uni, la
     confiance de l'IA pour le sujet d'une photo), le lissage du tracé. */
  const seuil = R.querySelector('[data-c="seuil"]')
  const [smin, smax, sval] = ia ? [0, SEUIL_MAX, E.reglages.seuil] : [1, 120, E.reglages.tolerance]
  seuil.min = smin
  seuil.max = smax
  if (document.activeElement !== seuil || Number(seuil.value) !== sval) seuil.value = sval
  seuil.style.setProperty('--p', ((sval - smin) / (smax - smin) * 100) + '%')
  r('val-seuil').textContent = sval
  /* Tenu en main, un curseur garde sa place ; annulé (Ctrl Z, le curseur
     encore en main), il reprend celle de l'historique. */
  const lis = R.querySelector('[data-c="lissage"]')
  if (document.activeElement !== lis || Number(lis.value) !== E.lissage) lis.value = E.lissage
  lis.style.setProperty('--p', E.lissage + '%')
  r('val-lissage').textContent = String(E.lissage)
  const nua = R.querySelector('[data-c="nuances"]')
  if (document.activeElement !== nua || Number(nua.value) !== E.nuances) nua.value = E.nuances
  nua.style.setProperty('--p', E.nuances + '%')
  r('val-nuances').textContent = E.nuances === 50 ? 'Auto' : String(E.nuances)
  r('res-trace').textContent = E.vecteur && vecteurMontre() && E.vecteur.noeuds ? px(E.vecteur.noeuds) + ' nœud' + (E.vecteur.noeuds > 1 ? 's' : '') : E.vectorise ? '…' : ''

  /* L'AMÉLIORATION IA, et le blanc DTF. */
  basculer('nettoyer', E.nettoyage.enCours || !!E.original)
  basculer('net', netMontre())
  basculer('blanc', E.blanc)
  majNettoyage()

  /* LE MENU « PLUS » : les autres formats. */
  const menu = r('menu')
  menu.hidden = !E.menu
  R.querySelector('[data-a="menu"]').setAttribute('aria-expanded', String(E.menu))
  R.querySelectorAll('.o-studio-menu [data-a="enregistrer"]').forEach(b => { b.disabled = !pret || !!E.exporte || (b.dataset.v === 'eps' && degradeRendu()) })

  /* DÉTOURÉ, VECTEUR OU IMAGE, en haut à gauche ; Détouré n'a ni tracé,
     ni couleurs, ni SVG, ni EPS — son blanc DTF est un masque de pixels
     (lib/pdf-image.js, `blancMasque`). */
  R.querySelectorAll('[data-trace]').forEach(el => { el.hidden = E.version === 'detoure' })
  R.querySelectorAll('[data-a="version"]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === E.version)))
  r('modes').classList.toggle('o-studio-cache', !image)

  /* LE PLAN : son fond, « Comparer ». */
  R.querySelector('[data-a="split"]').setAttribute('aria-pressed', String(E.split !== null))
  const scene = r('scene')
  scene.dataset.fond = E.fondVue.type
  scene.style.setProperty('--fond-textile', E.fondVue.couleur)
  r('pastille-couleur').style.background = E.fondVue.couleur
  const choix = R.querySelector('[data-c="fond-couleur"]')
  if (document.activeElement !== choix) choix.value = E.fondVue.couleur
  R.querySelectorAll('[data-a="fond"]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === E.fondVue.type)))
  r('vuebar').classList.toggle('o-studio-cache', !image)
  r('badge').hidden = !E.comparer
  majZoom()
  majEtat()
}

/* « Rendre net » cochée : voulue, et l'IA passe (ou est passée). */
const netMontre = () => E.net && (E.nettoyage.enCours || !!E.original)

const basculer = (action, oui) => E.racine.querySelectorAll('[data-a="' + action + '"]').forEach(b => b.setAttribute('aria-checked', String(!!oui)))

/* L'AMÉLIORATION IA : ce qu'elle fait, ce qu'elle a fait — son avancement
   détaillé est dans la préparation (`dessinerPrep`). */
function majNettoyage() {
  if (!E.racine) return
  const n = E.nettoyage
  /* La matière reconnue se dit : c'est l'IA des photos qui l'agrandit. */
  const matiere = E.decision && E.decision.matiere ? 'matière' : ''
  r('ia-etat').textContent = n.enCours ? (n.etape === 'calcul' ? (n.ultra ? 'Ultra ' : '') + Math.round(n.part * 100) + ' %' : '…')
    : E.original ? [n.faite ? 'Ultra' : '×4', matiere, String((n.duree / 1000).toFixed(1)).replace('.', ',') + ' s'].filter(Boolean).join(' · ') : matiere
  /* Le flou du fichier, mesuré sur ses bords (lib/graphiste.js) : retiré,
     rien à retirer (cochée à la main sur un fichier net), ou à retirer ;
     sous le seuil du graphiste, le fichier est net. */
  const d = E.decision, flou = d ? 'flou ' + flouMot(d.flou) : ''
  r('net-etat').textContent = n.enCours && n.etape === 'nettete' ? Math.round(n.part * 100) + ' %'
    : !d ? '' : E.original && E.net && !n.enCours ? (n.nette ? flou + ' retiré' : 'rien à retirer')
      : d.net ? flou : 'nette'
  /* L'Ultra que le poste ne tenait pas d'office : la vendeuse choisit,
     son temps sous les yeux. */
  r('ultra').hidden = !(!n.enCours && E.original && !n.faite && n.estime > 0)
  r('ultra-mot').textContent = 'Passer en Ultra · ' + environ(n.estime)
  majEtat()
}

/* Un temps à attendre, à la louche : « ~25 s », « ~1 min 20 ». */
function environ(ms) {
  const s = Math.max(1, Math.round(ms / 1000))
  if (s < 60) return '~' + s + ' s'
  const m = Math.floor(s / 60), r = Math.round(s % 60 / 10) * 10
  return r === 60 ? '~' + (m + 1) + ' min' : '~' + m + ' min' + (r ? ' ' + r : '')
}

/* « 1,8 px » : un flou mesuré. */
const flouMot = v => v.toFixed(1).replace('.', ',') + ' px'

/* CE QUI SE PASSE : le balayage sur le plan tant que l'IA cherche le
   sujet, et la préparation. */
function majEtat() {
  const scene = r('scene')
  if (scene) scene.classList.toggle('o-studio-cherche', !!(E.ia.enCours || E.ia.pose) && E.methode === 'ia')
  majPrep()
}

/* ------------------------------------------------------------ LA PRÉPARATION
   30 septembre 2026, « le calcul lisible, étape par étape » : la pastille
   qui tournait en bas du plan devient un panneau, en bas à gauche, qui
   liste les étapes réelles du calcul — seulement celles qui tournent pour
   ce fichier —, leur état et leur durée mesurée dans les fils
   (lib/detourage-travail.js, `etape`). Une préparation s'ouvre avec un
   fichier, l'IA cochée ou décochée, « Rendre net », l'Ultra, le fond ou la
   version — jamais avec un curseur, ni une teinte, ni une police. Le
   panneau paraît au premier calcul de plus de 400 ms (`MONTRER`) et part
   dès que le contrôle presse a fini ; un échec y reste, en rouge, à la
   place du toast. L'état de chaque étape se lit sur celui du studio (un
   fil fermé ne laisse rien « en cours ») ; les fils n'y ajoutent que
   leurs durées, le modèle du sujet, le flou retiré et le temps jaugé de
   l'Ultra. Il suit le calcul sans jamais le faire attendre. */
const ETAPES = [
  ['fichier', 'Lecture du fichier'],
  ['net', 'Rendre net'],
  ['ia', 'Amélioration IA'],
  ['sujet', 'Sujet'],
  ['detourage', 'Détourage'],
  ['trace', 'Tracé vectoriel'],
  ['texte', 'Lecture du texte'],
]
const MONTRER = 400
const MODELES = { birefnet: 'BiRefNet', isnet: 'ISNet' }
/* `vues` : les étapes de cette préparation ; `omises` : celles qui étaient
   déjà à jour quand elle s'est ouverte ; `t0` : le début de celles qui
   tournent ; `ms` : leurs durées, venues des fils ; `avance` : de quoi
   dire le temps qui reste. */
let prep = null
let imagePrep = 0
/* Le tracé final dans son fil : '' (demandé), 'trace', 'fini'. */
let phaseTrace = ''

function preparer(fichier = false) {
  const avant = prep
  if (avant) clearTimeout(avant.minuteur)
  prep = { fichier, lu: !fichier, vues: new Set(), omises: new Set(), t0: {}, ms: {}, detail: {}, echec: {}, avance: {}, montre: !!(avant && avant.montre && !avant.fini), fini: false, minuteur: 0, dits: new Set() }
  /* Ce qui est déjà à jour ne tourne pas : il ne s'affiche pas. */
  if (!fichier) for (const [id] of ETAPES) if (prevue(id)) { prep.vues.add(id); if (etatEtape(id) === 'fait') prep.omises.add(id) }
  majPrep()
}

function fermerPrep() {
  if (prep) { clearTimeout(prep.minuteur); prep.fini = true; prep.montre = false }
  const boite = r('prep')
  if (boite) boite.hidden = true
}

/* Les étapes qui tournent pour ce fichier : l'IA et son « Rendre net »
   pendant qu'ils passent, le sujet par l'IA, le tracé hors de Détouré. */
function prevue(id) {
  const p = prep
  if (id === 'fichier') return p.fichier
  if (!p.lu || !E.apercu) return false
  const n = E.nettoyage
  if (id === 'net') return n.enCours && n.flou > 0
  if (id === 'ia') return n.enCours
  if (id === 'sujet') return E.methode === 'ia'
  if (id === 'trace') return E.version !== 'detoure'
  return true
}

/* L'ÉTAT D'UNE ÉTAPE, lu sur le studio : 'attente', 'cours', 'fait' ou
   'echec'. Pendant que l'IA redessine l'image, tout ce qui suit l'attend :
   l'image reçue détourée entre-temps n'est qu'un aperçu — sauf le sujet
   d'une photo, qui passe avant l'IA dans son fil, et qu'on voit tourner. */
function etatEtape(id) {
  const p = prep
  if (p.echec[id]) return 'echec'
  const n = E.nettoyage
  if (id === 'fichier') return E.lecture ? 'cours' : 'fait'
  if (id === 'net') return n.enCours && n.etape === 'nettete' ? 'cours' : n.netFait ? 'fait' : 'attente'
  /* L'IA attend son tour dans son fil, puis son image nette. */
  if (id === 'ia') return n.enCours ? (n.parti && n.etape !== 'nettete' ? 'cours' : 'attente') : 'fait'
  if (id === 'sujet' && E.methode === 'ia' && E.ia.enCours && E.ia.parti) return 'cours'
  if (n.enCours || !E.apercu) return 'attente'
  if (id === 'sujet') return E.methode !== 'ia' || (E.ia.masque && !E.ia.enCours) ? 'fait' : E.ia.erreur ? 'echec' : 'attente'
  if (id === 'detourage') return E.calcul.enVol ? 'cours' : E.resultatImage && !(E.methode === 'ia' && (!E.ia.masque || E.ia.pose)) ? 'fait' : 'attente'
  if (id === 'trace') return E.version === 'detoure' ? 'fait' : finalEnVol ? (phaseTrace === 'fini' ? 'fait' : 'cours') : vecteurAJour() ? 'fait' : 'attente'
  /* La lecture du texte, en dernier. Une ligne corrigée à la main qui se
     recherche : le texte se lit encore. */
  const t = texteAJour() ? E.textes : null
  return !t ? 'attente' : t.etat === 'erreur' || (t.etat === 'pret' && !t.enPose && !t.lignes.some(l => l.recherche)) ? 'fait' : 'cours'
}

/* Ce qu'une étape a fait : le flou retiré, l'Ultra, le modèle du sujet. */
function detailEtape(id) {
  const n = E.nettoyage
  if (id === 'net') return prep.detail.net || (E.decision ? flouMot(E.decision.flou) : '')
  if (id === 'ia') return (n.enCours ? n.ultra : n.faite) ? 'Ultra' : ''
  if (id === 'sujet') return prep.detail.sujet || ''
  return ''
}

/* Où en est une étape qui tourne : sa part (null : on ne la sait pas) et
   sa phase. */
function avancement(id) {
  const n = E.nettoyage
  if (id === 'ia') return n.etape === 'telechargement' ? { part: n.part, mot: 'téléchargement' } : n.etape === 'calcul' ? { part: n.part, mot: '' } : { part: null, mot: 'mise en route' }
  if (id === 'net') return { part: n.part, mot: '' }
  if (id === 'sujet' && E.ia.etape === 'telechargement') return { part: E.ia.part, mot: 'téléchargement' }
  if (id === 'texte' && E.textes && E.textes.etat === 'recherche' && E.textes.part !== undefined) return { part: E.textes.part, mot: 'polices' }
  return { part: null, mot: '' }
}

/* LE TEMPS QUI RESTE à une étape qui avance. L'Ultra : le temps jaugé
   dans son fil pour `ULTRA_AUTO` (lib/detourage-travail.js, `ultra`), ou
   celui qu'annonçait « Passer en Ultra ». L'IA, « Rendre net », un
   téléchargement : à l'allure de leur avancement, régulier, dès qu'elle se
   lit (5 % en une seconde au moins). Les polices, ligne à ligne, n'ont pas
   d'allure ; 0 : on ne le sait pas. */
function resteEtape(id, a, maintenant) {
  const n = E.nettoyage
  if (id === 'ia' && n.etape === 'calcul' && n.ultra && n.prevu) return n.prevu * (1 - a.part)
  if (id === 'texte') return 0
  const cle = id + a.mot
  let v = prep.avance[id]
  if (!v || v.cle !== cle || a.part < v.part) v = prep.avance[id] = { cle, t0: maintenant, part: a.part }
  const fait = a.part - v.part, depuis = maintenant - v.t0
  return fait >= 0.05 && depuis >= 1000 ? depuis / fait * (1 - a.part) : 0
}

/* « 0,4 s », « 12,8 s », « 1 min 05 » : une durée mesurée. */
function dureeMot(ms) {
  if (ms < 100) return '< 0,1 s'
  if (ms < 60000) return (ms / 1000).toFixed(1).replace('.', ',') + ' s'
  return Math.floor(ms / 60000) + ' min ' + String(Math.floor(ms % 60000 / 1000)).padStart(2, '0')
}

/* UN ÉVÉNEMENT D'UN FIL (lib/detourage-travail.js, `etape`) : le début,
   la fin et sa durée, l'échec d'une étape — ou l'avancement du sujet qui
   nomme son modèle. */
function evenement(ev) {
  if (ev.etape === 'trace' && ev.etat !== 'fin') phaseTrace = ev.etat === 'debut' ? 'trace' : 'fini'
  const p = prep
  if (!p) return
  /* Une étape en échec qui repart (un seuil baissé après « Tout est
     parti ») efface son échec ; le panneau qui l'affichait la suit. */
  if (ev.etat === 'debut' && p.echec[ev.etape]) {
    delete p.echec[ev.etape]
    if (p.fini && p.montre) p.fini = false
  }
  if (p.fini) return
  const id = ev.etape
  /* L'image reçue, détourée le temps que l'IA la redessine : pas une
     étape — son sujet, qu'on a vu tourner, si. */
  if (E.nettoyage.enCours && id !== 'net' && id !== 'ia' && id !== 'sujet') return
  if (ev.modele !== undefined) p.detail.sujet = MODELES[ev.modele] || 'à la couleur'
  if (ev.etat === 'fin') {
    p.ms[id] = (p.ms[id] || 0) + (ev.ms || 0)
    if (id === 'net') p.detail.net = ev.nette && E.decision ? flouMot(E.decision.flou) : 'rien à retirer'
  }
  if (ev.etat === 'echec') echouer(id, ev.message, false)
  majPrep()
}

/* UN ÉCHEC : en rouge sur sa ligne, le panneau à l'écran ; hors d'une
   préparation, le toast d'alerte (`alerte` : son texte ; faux, rien). */
function echouer(id, message, alerte = message) {
  const p = prep
  if (p && !p.fini && (p.vues.has(id) || prevue(id))) {
    p.echec[id] = message || 'Erreur inconnue.'
    p.vues.add(id)
    p.omises.delete(id)
    p.montre = true
    return majPrep()
  }
  if (alerte) toast(alerte, 'alerte')
}

/* Les étapes de la préparation se retiennent tout de suite — un onglet
   caché ne dessine rien, l'IA y passe quand même —, et le panneau se
   redessine une fois par image affichée, au plus. */
function majPrep() {
  const p = prep
  if (!p || p.fini) return
  for (const [id] of ETAPES) if (prevue(id)) p.vues.add(id)
  if (!imagePrep && typeof requestAnimationFrame !== 'undefined') imagePrep = requestAnimationFrame(dessinerPrep)
}

function dessinerPrep() {
  imagePrep = 0
  const p = prep, boite = r('prep')
  if (!p || p.fini || !boite) return
  clearTimeout(p.minuteur)
  const maintenant = performance.now()
  let attendre = Infinity, reste = 0
  const lignes = []
  for (const [id, mot] of ETAPES) {
    if (!p.vues.has(id)) continue
    const etat = etatEtape(id)
    if (etat === 'cours') p.omises.delete(id)
    if (p.omises.has(id)) continue
    const l = { mot, etat, detail: detailEtape(id), valeur: '', part: null, erreur: '' }
    if (etat === 'cours') {
      /* Le premier calcul de plus de 400 ms montre le panneau ; sans part
         connue, les secondes passées. */
      if (p.t0[id] === undefined) p.t0[id] = maintenant
      const depuis = maintenant - p.t0[id]
      if (depuis >= MONTRER) p.montre = true
      else attendre = Math.min(attendre, MONTRER - depuis)
      const a = avancement(id)
      l.detail = [l.detail, a.mot].filter(Boolean).join(' · ')
      if (a.part !== null) {
        l.part = Math.max(0, Math.min(1, a.part))
        l.valeur = Math.round(l.part * 100) + ' %'
        reste = Math.max(reste, resteEtape(id, a, maintenant))
      } else {
        if (depuis >= 1000) l.valeur = Math.floor(depuis / 1000) + ' s'
        attendre = Math.min(attendre, 1000 - depuis % 1000)
      }
    } else {
      delete p.t0[id]
      if (etat === 'fait' && p.ms[id] !== undefined) l.valeur = dureeMot(p.ms[id])
      if (etat === 'echec') {
        l.erreur = p.echec[id] || E.ia.erreur || 'Erreur inconnue.'
        p.montre = true
        /* Dit une fois au lecteur d'écran, comme le toast qu'il remplace. */
        if (!p.dits.has(id)) { p.dits.add(id); r('prep-dit').textContent = mot + ' : ' + l.erreur }
      }
    }
    lignes.push(l)
  }
  const erreur = lignes.some(l => l.etat === 'echec')
  /* Le contrôle presse a fini (tout le reste avant lui) : le panneau part,
     sauf un échec, qui reste jusqu'à sa croix. */
  p.fini = lignes.every(l => l.etat === 'fait' || l.etat === 'echec')
  if (p.fini && !erreur) p.montre = false
  const html = '<div class="o-studio-prep-tete"><b>Préparation</b>' + (reste >= 1500 ? '<span>encore ' + environ(reste) + '</span>' : '')
    + (erreur ? '<button type="button" class="o-studio-pop-x" data-a="prep-fermer" aria-label="Fermer">' + ic('x') + '</button>' : '') + '</div>'
    + '<ol>' + lignes.map(l => '<li data-etat="' + l.etat + '">'
      + (l.etat === 'fait' ? ic('check') : l.etat === 'echec' ? ic('x') : '<i></i>')
      + '<span class="o-studio-prep-mot">' + l.mot + (l.detail ? '<small>' + html_(l.detail) + '</small>' : '') + '</span>'
      + '<span class="o-studio-prep-val">' + l.valeur + '</span>'
      + (l.part !== null ? '<span class="o-studio-prep-barre"><i style="width:' + (l.part * 100).toFixed(1) + '%"></i></span>' : '')
      + (l.erreur ? '<p>' + html_(l.erreur) + '</p>' : '') + '</li>').join('') + '</ol>'
  const corps = r('prep-corps')
  if (corps.dataset.dessin !== html) { corps.innerHTML = html; corps.dataset.dessin = html }
  boite.hidden = !p.montre
  if (!p.fini && attendre < Infinity) p.minuteur = setTimeout(majPrep, Math.ceil(attendre) + 5)
}

/* --------------------------------------------------------------- LES COULEURS */
/* La version image à l'écran : les pixels du fichier dans le contour. */
const degradeRendu = () => !!(E.vecteur && !E.vecteur.apercu && E.version === 'image' && E.teinte.type === 'multi')

function majCouleurs(redessiner = true) {
  const R = E.racine
  if (!R) return
  const t = E.teinte
  const une = t.type !== 'multi'
  R.querySelectorAll('[data-a="teinte-mode"]').forEach(b => b.setAttribute('aria-checked', String((b.dataset.v === 'une') === une)))
  r('une').hidden = !une
  R.querySelectorAll('[data-a="teinte"]').forEach(b => b.setAttribute('aria-checked', String(une && b.dataset.v === t.nom)))
  const v = E.vecteur
  const pal = r('palette')
  pal.hidden = une
  if (!une) {
    const couleurs = v ? v.couleurs || [] : []
    const fige = degradeRendu()
    const dessin = couleurs.map(c => {
      const k = c.join(',')
      const aff = E.recolor[k] || c
      const change = !!E.recolor[k]
      /* La couleur du nuancier la plus proche, quand c'est presque elle. */
      const pres = !change && !duNuancier(aff) ? auNuancier(aff) : null
      const note = change ? 'd\'origine ' + rvbHex(c).toUpperCase() : pres && pres.ecart <= PROCHE ? '≈ ' + pres.nom + ' · ΔE ' + pres.ecart.toFixed(1).replace('.', ',') : ''
      return '<button type="button" class="o-studio-teinte' + (change ? ' o-studio-changee' : '') + (E.pop === k ? ' o-studio-ouverte' : '') + '" data-a="couleur" data-v="' + k + '"' + pastille(aff, note) + (fige ? ' disabled' : '') + '><i style="background:' + rvbHex(aff) + '"></i>' + (change ? '<em style="background:' + rvbHex(c) + '"></em>' : '') + '</button>'
    }).join('') + E.sans.map(c => '<button type="button" class="o-studio-teinte o-studio-retiree' + (E.pop === c.join(',') ? ' o-studio-ouverte' : '') + '" data-a="couleur" data-v="' + c.join(',') + '"' + pastille(c, 'retirée') + '><i style="background:' + rvbHex(c) + '"></i></button>').join('')
    const html = dessin || '<span class="o-studio-palette-vide">' + (E.apercu ? 'Lecture des couleurs…' : '—') + '</span>'
    if (pal.dataset.dessin !== html) { pal.innerHTML = html; pal.dataset.dessin = html }
  }
  r('res-couleurs').textContent = une ? nomCouleur(rvbTeinte()) : v ? (degradeRendu() ? 'Celles du fichier' : (v.couleurs || []).length + ' teinte' + ((v.couleurs || []).length > 1 ? 's' : '')) : ''
  /* Une couleur : la silhouette « foncée » doit être tracée. */
  if (une && v && !v.unie) planifierVecteur(0)
  if (redessiner) dessiner()
}

function ouvrirPop(k, bouton) {
  if (E.pop === k) return fermerPop()
  E.pop = k
  const pop = r('pop')
  const retiree = E.sans.some(c => c.join(',') === k)
  const orig = k.split(',').map(Number)
  const aff = E.recolor[k] || orig
  const f = fiche(aff)
  pop.innerHTML = '<div class="o-studio-pop-tete"><i style="background:' + rvbHex(aff) + '"></i><b>' + f.nom + '<small>' + encres(f.encres) + '</small></b>'
    + '<button type="button" class="o-studio-pop-x" data-a="pop-fermer" aria-label="Fermer">' + ic('x') + '</button></div>'
    + (retiree
      ? '<button type="button" class="o-studio-bouton o-studio-pop-large" data-a="pop-remettre">' + ic('rotate-ccw') + '<span>Remettre cette teinte</span></button>'
      : '<div class="o-studio-pop-grille">' + NUANCIER.map(c => '<button type="button" data-a="pop-nuancier" data-v="' + rvbHex(c.rvb) + '"' + pastille(c.rvb) + (duNuancier(aff) === c ? ' aria-current="true"' : '') + '><i style="background:' + rvbHex(c.rvb) + '"></i></button>').join('') + '</div>'
        + '<div class="o-studio-pop-pied">'
        + '<label class="o-studio-bouton o-studio-pop-autre" title="Une autre couleur"><i style="background:conic-gradient(#e11d48,#f59e0b,#84cc16,#06b6d4,#6366f1,#e11d48)"></i><span>Autre</span><input type="color" data-c="pop-couleur" value="' + rvbHex(aff) + '"></label>'
        + (E.recolor[k] ? '<button type="button" class="o-studio-bouton" data-a="pop-origine" title="La couleur d\'origine">' + ic('rotate-ccw') + '</button>' : '')
        + '<button type="button" class="o-studio-bouton o-studio-pop-retirer" data-a="pop-retirer" title="Retirer cette teinte du logo">' + ic('trash-2') + '</button>'
        + '</div>')
  pop.hidden = false
  const panneau = E.racine.querySelector('.o-studio-panneau')
  const b = bouton.getBoundingClientRect(), p = panneau.getBoundingClientRect()
  pop.style.top = Math.round(b.bottom - p.top + 8) + 'px'
  pop.style.left = Math.round(Math.max(12, Math.min(p.width - 252, b.left - p.left - 110))) + 'px'
  majCouleurs(false)
}

function fermerPop() {
  if (!E.pop) return
  E.pop = null
  const pop = r('pop')
  if (pop) { pop.hidden = true; pop.innerHTML = '' }
  majCouleurs(false)
}

/* L'INFOBULLE D'UNE PASTILLE (30 septembre 2026, « il faut que les
   valeurs CMJN apparaissent quand on passe la souris sur les couleurs ») :
   son nom et ses quatre encres, tout de suite, au-dessus d'elle. */
function bulle(b) {
  const t = r('infobulle')
  if (!t) return
  if (!b) { t.hidden = true; return }
  const f = fiche(b.dataset.rvb.split(',').map(Number))
  t.innerHTML = '<b>' + f.nom + '</b>' + (b.dataset.note ? '<em>' + b.dataset.note + '</em>' : '')
    + '<span class="o-studio-infobulle-encres">' + f.encres.map((v, k) => '<span>' + 'CMJN'[k] + ' <b>' + String(v).replace('.', ',') + '</b></span>').join('') + '</span>'
    + '<small>' + (f.officielle ? 'Nuancier OLDA' : 'Converti en FOGRA39') + '</small>'
  t.hidden = false
  const p = b.getBoundingClientRect(), q = t.getBoundingClientRect()
  const haut = p.top - q.height - 8
  t.style.top = Math.round(haut >= 8 ? haut : p.bottom + 8) + 'px'
  t.style.left = Math.round(Math.max(8, Math.min(innerWidth - q.width - 8, p.left + p.width / 2 - q.width / 2))) + 'px'
}

/* ------------------------------------------------------------------ LE VECTEUR */
/* Le grand côté de l'image que l'IA a nettoyée — celle qu'a vue le
   modèle (entière sur la carte graphique, réduite à 768 px sur le
   processeur) : c'est là qu'est l'information (lib/vecteur-lisse.js). */
const origine = () => E.original ? E.original.entree || Math.min(COTE_NETTOYAGE, Math.max(E.original.pleine.largeur, E.original.pleine.hauteur)) : 0
const besoinUnie = () => E.teinte.type !== 'multi'
const cleVecteur = () => cleFin() + '|' + JSON.stringify([E.sans, origine(), E.lissage, E.nuances, clePoses()])

/* ---------------------------------------------------------- LES POLICES
   Le texte du logo relu en vraies lettres, dans les trois versions (30
   septembre 2026 : « les polices sont censées s'ajouter seules, et en
   Détouré et en Image aussi »). Une fois par image de travail, dans son
   propre fil : ses lignes se trouvent en pleine taille (lib/texte.js) et
   s'y lisent (lib/lecture.js), puis le fil cherche la police de chacune
   dans la réserve (lib/polices.js) et propose ses équivalents. Assez
   ressemblante (`RECONNUE`), sur une ligne assez grande pour en juger, la
   première remplace d'office les lettres du logo ; sinon elle est
   seulement proposée. Dans une ligne peu sûre (une écriture liée), le fil
   cherche une écriture (lib/ecriture.js) : proposée, jamais imposée. Le
   texte d'une ligne se corrige à la main : la recherche se refait sur ce
   qui est tapé.
   Les lettres choisies se posent une fois (`poserPolices`) : le vecteur et
   l'image les prennent dans leurs couches, le Détouré dans ses pixels
   (`repeindre`). */
const RECONNUE = 0.9
const LETTRE_SURE = 0.75
const LETTRE_CERTAINE = 0.85
/* LA CONFIANCE DE LA LECTURE (lib/lecture.js, de 0 à 100 : la ligne, et son
   mot le moins sûr), mesurée sur 91 lignes de vrais logos, lues à la main,
   tels que reçus et agrandis — chaque seuil plus juste que celui de
   Tesseract qu'il remplace, et il garde plus de lignes : à `LUE`, la ligne
   part à la recherche de sa police (91 et 83 % justes, contre 78 et 68) ;
   à `LUE_SURE`, sa police peut se poser d'office (94 %, contre 83 et
   74) ; à `LUE_CERTAINE`, la police ne corrige plus sa lecture (98 et
   100 %, contre 95 et 85). Sur 24 logos passés à toute la chaîne, chaque
   police posée d'office l'est encore, et trois de plus. */
const LUE = 80
const LUE_SURE = 85
const LUE_CERTAINE = 95
const lue = (l, seuil) => l.confiance >= seuil && l.mot >= seuil
const cleTexte = () => E.pleine ? E.pleine.n : 0
const texteAJour = () => !!(E.textes && E.textes.cle === cleTexte())
const choixPolices = () => texteAJour() ? E.textes.lignes.filter(l => l.choix >= 0 && l.props[l.choix]).map(l => Object.assign({ boite: l.boite, texte: l.texte, ecriture: !!l.ecriture, gras: l.gras || 0 }, l.props[l.choix])) : []
const GRAISSES = { 100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black' }
const nomPolice = p => p.nom + ' ' + (GRAISSES[p.graisse] || p.graisse) + (p.style === 'italic' ? ' Italic' : '')
/* Le grand côté du fichier reçu, avant l'IA : c'est à lui que se mesure
   un texte trop petit pour qu'une police s'y pose d'office. */
const coteRecu = () => { const f = E.original ? E.original.fichier : E.fichier; return f ? Math.max(f.largeur, f.hauteur) : 0 }

/* LE TEXTE SE LIT SEUL, dès qu'une image de travail se pose — pas pendant
   que l'IA la nettoie : on ne lit qu'une fois, l'image nette. */
let filTexte = null
let nTexte = 0
let minuteurTexte = null
function planifierTexte() {
  clearTimeout(minuteurTexte)
  minuteurTexte = setTimeout(lireTexte, 0)
}
async function lireTexte() {
  const p = E.pleine
  if (!p || E.nettoyage.enCours || texteAJour()) return
  const n = ++nTexte
  if (filTexte) filTexte.fermer()
  fermerPopPolice()
  E.ligneSurvol = -1
  const fil = filTexte = filDedie()
  let fini = null
  const t = E.textes = { cle: p.n, etat: 'lecture', lignes: [], fil, poses: null, fini: new Promise(ok => { fini = ok }), largeur: p.largeur, hauteur: p.hauteur, f: 0 }
  /* La préparation : les étapes du fil, et la part des polices cherchées. */
  const suivre = pr => {
    if (pr.etat) return evenement(pr)
    if (pr.etape === 'polices' && n === nTexte) { t.part = pr.part; majPrep() }
  }
  majPolice()
  try {
    const rep = await fil.demander({ type: 'texte', cle: p.n, data: p.data, largeur: p.largeur, hauteur: p.hauteur, origine: coteRecu() }, suivre)
    if (n !== nTexte) return
    const lus = rep.lus
    t.f = rep.f || 0
    /* Toutes les lignes lues, même sans police : le contrôle y mesure le
       texte le plus petit. */
    t.boites = rep.lignes.map(l => l.boite)
    /* Une ligne dont un mot est mal lu — ou qui n'a pas deux lettres : un
       bout de dessin lu « y » — ne reçoit pas de police. */
    const textes = lus.map(l => lue(l, LUE) && (l.texte.match(/[\p{L}\p{N}]/gu) || []).length >= 2 ? l.texte : null)
    /* Une ligne peu sûre, mais qui ressemble à du texte : sa lecture sert à
       y chercher une écriture (le modèle lit une écriture liée droite, sans
       la redresser). */
    const lectures = lus.map((l, i) => !textes[i] && l.confiance >= 20 ? [{ texte: l.texte, confiance: l.confiance }] : [])
    t.etat = 'recherche'
    majPolice()
    const r = rep.lignes.length ? await fil.demander({ type: 'polices', cle: p.n, textes, lectures, symboles: lus.map(l => l.symboles || null), sures: lus.map(l => lue(l, LUE_CERTAINE)) }, suivre) : { lignes: [] }
    if (n !== nTexte) return
    t.lignes = rep.lignes.map((l, i) => {
      const x = r.lignes[i]
      if (!x || !x.props.length) return null
      /* Une écriture n'est jamais la police exacte : proposée. Un bout de
         dessin lu de travers (« Cats », à 44 de confiance, une écriture
         chinoise à 51 %) n'est pas une ligne : il ne s'affiche pas. */
      if (x.ecriture && lus[i].confiance < 50 && x.props[0].note < 0.6) return null
      if (x.ecriture) return { ligne: i, boite: l.boite, contour: l.contour, texte: x.texte, props: x.props, ecriture: true, reconnue: false, choix: -1, lu: lus[i], gras: 0, grasMax: l.grasMax }
      /* Reconnue : la police colle à la ligne entière, et à chacune de ses
         lettres (sinon, une lettre est mal lue ou la police n'est qu'une
         cousine : on la propose, sans l'imposer) ; la lecture est sûre —
         ou chaque lettre colle si bien (`LETTRE_CERTAINE`) qu'elle le
         prouve ; et la ligne n'est pas trop petite pour en juger. */
      /* Et le texte est celui qui a été lu : une lettre « corrigée » par la
         police (« financier » devenu « hinancier ») n'est que proposée —
         jamais un mot faux posé d'office. */
      /* Une ligne courbe (un titre en arc, un ruban : lib/courbes.js), ou
         refaite d'une chaîne de lettres, est toujours proposée, jamais
         posée d'office : c'est la vendeuse qui choisit sa police. */
      const p0 = x.props[0]
      const reconnue = !l.petite && !l.contour && !l.chaine && x.texte.replace(/\s+/g, '') === lus[i].texte.replace(/\s+/g, '') && p0.note >= RECONNUE && p0.pire >= LETTRE_SURE && lus[i].confiance >= LUE_SURE && (lus[i].mot >= LUE_SURE || p0.pire >= LETTRE_CERTAINE)
      return { ligne: i, boite: l.boite, contour: l.contour, texte: x.texte, props: x.props, reconnue, choix: reconnue ? 0 : -1, lu: lus[i], gras: 0, grasMax: l.grasMax }
    }).filter(Boolean)
    /* Ce que le graphiste a lu et posé : l'historique y revient. */
    for (const l of t.lignes) l.defaut = { texte: l.texte, props: l.props, ecriture: !!l.ecriture, reconnue: l.reconnue, choix: l.choix }
    const relire = reporterPolices(t)
    t.etat = 'pret'
    majPolice()
    for (const [k, texte] of relire) await relireLigne(k, texte)
    await poserPolices()
  } catch (e) {
    if (n !== nTexte || (e && e.annule)) return
    t.etat = 'erreur'
    majPolice()
    echouer('texte', (e && e.message) || 'Le texte ne s\'est pas lu.', false)
  } finally {
    fini()
  }
}

/* LES LETTRES CHOISIES, POSÉES (lib/texte.js), une fois par choix : le
   vecteur les reprend dans ses couches, le Détouré se repeint. */
let nPoses = 0
async function poserPolices() {
  const t = E.textes
  if (!texteAJour() || t.etat !== 'pret') return
  const choix = choixPolices()
  const cle = JSON.stringify(choix.map(c => [c.boite, c.texte, c.ecriture, c.id, c.graisse, c.style, c.gras]))
  if (t.poses && t.poses.cle === cle) return
  const n = ++nPoses
  let fini = null
  t.posant = new Promise(ok => { fini = ok })
  /* Les lettres qui se posent : la lecture du texte n'a pas fini. */
  t.enPose = (t.enPose || 0) + 1
  majPrep()
  try {
    const rep = choix.length ? await t.fil.demander({ type: 'poses', cle: t.cle, polices: choix }, evenement) : { poses: [], texte: null, zones: [] }
    if (n !== nPoses || E.textes !== t) return
    t.poses = { cle, poses: rep.poses, texte: rep.texte, zones: rep.zones }
  } catch {
    if (n !== nPoses || E.textes !== t) return
    t.poses = { cle, poses: [], texte: null, zones: [] }
  } finally {
    t.enPose--
    fini()
  }
  planifierVecteur(0)
  repeindre()
  majPrep()
}
const posesPretes = () => texteAJour() && E.textes.poses && E.textes.poses.poses.length ? E.textes.poses : null
const clePoses = () => { const p = posesPretes(); return p ? p.cle : '' }

/* LE TEXTE RÉGLÉ : lu, ses polices cherchées, ses lettres posées — ce
   qu'attend un export. */
async function texteRegle() {
  for (let k = 0; k < 4; k++) {
    if (!E.pleine || E.nettoyage.enCours) return
    if (!texteAJour()) { clearTimeout(minuteurTexte); lireTexte() }
    const t = E.textes
    if (!texteAJour()) return
    await t.fini
    if (E.textes !== t) continue
    await poserPolices()
    if (t.posant) await t.posant
    if (E.textes === t) return
  }
}

/* LA POLICE AU CLIC (30 septembre 2026 : « pour éviter une barre latérale
   trop grande, je veux qu'on clique sur la police et qu'on choisisse
   directement »). Le panneau ne garde qu'une ligne par texte lu — un
   point (vert : la police reconnue est posée ; bleu : choisie à la main ;
   gris : le dessin d'origine), le texte, sa police. Sur le plan, chaque
   texte du logo se signale sous la souris ; un clic — là, ou sur sa ligne
   du panneau — ouvre sa bulle sur le texte même (`ouvrirPopPolice`) : le
   texte à corriger s'il est mal lu, les polices proposées chacune dans
   son propre dessin (la police chargée dans la page, `apercuPolice`), le
   dessin d'origine, le gras autour. */
function majPolice() {
  const bloc = r('bloc-police')
  if (!bloc) return
  const t = texteAJour() ? E.textes : null
  bloc.hidden = !t || (t.etat === 'pret' && !t.lignes.length)
  if (!t) { fermerPopPolice(); return }
  if (E.popPolice >= t.lignes.length) fermerPopPolice()
  r('res-police').textContent = t.etat === 'lecture' ? 'Lecture du texte…' : t.etat === 'recherche' ? 'Recherche de la police…' : t.etat === 'erreur' ? 'Indisponible' : t.lignes.length + ' ligne' + (t.lignes.length > 1 ? 's' : '')
  const etat = l => l.recherche ? 'recherche' : l.choix < 0 ? 'dessin' : l.reconnue && !l.main ? 'reconnue' : 'choisie'
  const html = (t.lignes.length ? '<div class="o-studio-police-aide">Cliquez sur un texte du logo pour choisir sa police.</div>' : '')
    + t.lignes.map((l, i) => '<button type="button" class="o-studio-ligne-texte" data-a="ligne" data-v="' + i + '" aria-pressed="' + (E.popPolice === i) + '" title="' + attr(l.texte) + ' — ' + (l.recherche ? 'recherche de la police…' : l.choix >= 0 ? nomPolice(l.props[l.choix]) : 'le dessin d\'origine') + '">'
      + '<i data-etat="' + etat(l) + '"></i><span class="o-studio-ligne-texte-mot">' + html_(l.texte) + '</span>'
      + '<small>' + (l.recherche ? 'Recherche…' : l.choix >= 0 ? html_(l.props[l.choix].nom) : 'Dessin') + '</small></button>').join('')
  const box = r('textes')
  if (box.dataset.dessin !== html) {
    /* Redessinée, la ligne garde la main du clavier. */
    const actif = box.contains(document.activeElement) ? document.activeElement : null
    const cible = actif && '[data-a="ligne"][data-v="' + actif.dataset.v + '"]'
    box.innerHTML = html
    box.dataset.dessin = html
    if (cible) { const el = box.querySelector(cible); if (el) el.focus() }
  }
  majPopPolice()
  majPrep()
}

/* ------------------------------------------------ LA LIGNE SUR LE PLAN
   Le cadre d'une ligne à l'écran : sa boîte (en pixels de lecture, `t.f`
   par pixel de l'image pleine) ramenée à l'aperçu puis au plan. Une ligne
   courbe (un titre en arc, un ruban : lib/courbes.js) a aussi son contour,
   la bande de ses lettres le long de la courbe : c'est lui qui se dessine
   et que la souris trouve — le cadre d'un arc couvre tout ce qu'il
   enjambe. */
function contourEcran(l) {
  const t = E.textes
  if (!t || !t.f || !E.apercu || !l.contour) return null
  const k = E.apercu.echelle / t.f * E.vue.zoom
  return l.contour.map(([x, y]) => [E.vue.ox + x * k, E.vue.oy + y * k])
}
function cadreLigneEcran(l) {
  const t = E.textes
  if (!t || !t.f || !E.apercu || !l.boite) return null
  const poly = contourEcran(l)
  if (poly) {
    const xs = poly.map(p => p[0]), ys = poly.map(p => p[1])
    const x = Math.min(...xs), y = Math.min(...ys)
    return { x, y, l: Math.max(...xs) - x, h: Math.max(...ys) - y, poly }
  }
  const k = E.apercu.echelle / t.f * E.vue.zoom
  const [x0, y0, x1, y1] = l.boite
  return { x: E.vue.ox + x0 * k, y: E.vue.oy + y0 * k, l: (x1 - x0 + 1) * k, h: (y1 - y0 + 1) * k }
}
/* Dans un polygone, ou à `m` pixels de son bord ; et son aire. */
function dansPolygone(poly, x, y, m) {
  let dedans = false, proche = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j], [bx, by] = poly[i]
    if ((ay > y) !== (by > y) && x < ax + (y - ay) * (bx - ax) / (by - ay)) dedans = !dedans
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1
    const u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2))
    if (Math.hypot(x - ax - u * dx, y - ay - u * dy) <= m) proche = true
  }
  return dedans || proche
}
const airePolygone = poly => { let a = 0; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1]; return Math.abs(a / 2) }
/* La ligne sous un point du plan (la plus petite qui le couvre, à 6 px
   près), ou -1. */
function ligneSous(x, y) {
  if (!texteAJour() || E.comparer || E.textes.etat !== 'pret') return -1
  let k = -1, aire = Infinity
  E.textes.lignes.forEach((l, i) => {
    const c = cadreLigneEcran(l)
    if (!c) return
    const a = c.poly ? airePolygone(c.poly) : c.l * c.h
    const sous = c.poly ? dansPolygone(c.poly, x, y, 6) : x >= c.x - 6 && x <= c.x + c.l + 6 && y >= c.y - 6 && y <= c.y + c.h + 6
    if (sous && a < aire) { aire = a; k = i }
  })
  return k
}
function survolerLigne(k) {
  const toile = r('toile')
  if (toile) toile.style.cursor = k >= 0 ? 'pointer' : ''
  if (k === E.ligneSurvol) return
  E.ligneSurvol = k
  dessiner()
}
/* LES LIGNES SIGNALÉES sur le plan : toutes, en pointillé discret, tant
   que la souris est sur le plan ; celle qu'elle survole et celle dont la
   bulle est ouverte, en plein, avec le nom de leur police. */
function dessinerLignes(ctx) {
  if (!texteAJour() || E.textes.etat !== 'pret' || !E.textes.lignes.length) return
  const lignes = E.textes.lignes
  const montrer = E.planSurvole || E.popPolice >= 0
  ctx.save()
  ctx.lineJoin = 'round'
  lignes.forEach((l, i) => {
    const forte = i === E.ligneSurvol || i === E.popPolice
    if (!forte && !montrer) return
    const c = cadreLigneEcran(l)
    if (!c) return
    const m = 4, rayon = 6
    ctx.beginPath()
    if (c.poly) { c.poly.forEach(([x, y], j) => j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath() }
    else ctx.roundRect(c.x - m, c.y - m, c.l + 2 * m, c.h + 2 * m, rayon)
    ctx.strokeStyle = forte ? '#0284c7' : 'rgba(2,132,199,.45)'
    ctx.lineWidth = forte ? 2 : 1
    ctx.setLineDash(forte ? [] : [4, 3])
    ctx.stroke()
    if (i !== E.ligneSurvol || i === E.popPolice) return
    /* Le nom de la police au-dessus (ou dessous, au bord du plan). */
    const mot = l.recherche ? 'Recherche de la police…' : l.choix >= 0 ? nomPolice(l.props[l.choix]) : 'Dessin d\'origine' + (l.props[0] ? ' · ' + nomPolice(l.props[0]) + ' proposée' : '')
    ctx.font = '600 12px ' + getComputedStyle(document.body).fontFamily
    const L = ctx.measureText(mot).width + 16, H = 22
    const x = Math.max(4, Math.min(ctx.canvas.clientWidth - L - 4, c.x - m)), y = c.y - m - H - 4 >= 4 ? c.y - m - H - 4 : c.y + c.h + m + 4
    ctx.setLineDash([])
    ctx.fillStyle = '#0284c7'
    ctx.beginPath()
    ctx.roundRect(x, y, L, H, 11)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.textBaseline = 'middle'
    ctx.fillText(mot, x + 8, y + H / 2 + 0.5)
  })
  ctx.restore()
}

/* ---------------------------------------------- LA BULLE D'UNE LIGNE */
/* UNE POLICE DANS LA PAGE, pour la montrer dans son dessin : le même
   fichier que lit le fil (Fontsource), chargé une fois. Rend le nom de la
   famille CSS. */
const apercus = new Map()
function apercuPolice(p) {
  const nom = 'olda-apercu-' + p.id + '-' + p.graisse + '-' + p.style
  if (!apercus.has(nom)) {
    apercus.set(nom, true)
    try {
      const ff = new FontFace(nom, 'url(https://cdn.jsdelivr.net/fontsource/fonts/' + p.id + '@latest/latin-' + p.graisse + '-' + p.style + '.woff)', { display: 'swap' })
      document.fonts.add(ff)
      ff.load().catch(() => {})
    } catch {}
  }
  return nom
}
/* La bulle de la ligne `k`, sur son texte dans le plan — amenée à l'écran
   d'abord si elle n'y est pas (`cadrer`, un clic dans le panneau). */
function ouvrirPopPolice(k, cadrer = false) {
  const t = texteAJour() ? E.textes : null
  if (!t || !t.lignes[k]) return
  if (E.popPolice === k && !cadrer) return fermerPopPolice()
  fermerPop()
  fermerMenu()
  E.popPolice = k
  if (cadrer) cadrerLigne(t.lignes[k])
  majPopPolice(true)
  majPolice()
  dessiner()
}
function fermerPopPolice() {
  if (E.popPolice < 0) return
  E.popPolice = -1
  const pop = r('pop-police')
  if (pop) { pop.hidden = true; pop.innerHTML = ''; pop.dataset.dessin = '' }
  majPolice()
  dessiner()
}
/* La vue glisse pour que la ligne soit à l'écran (sans changer le zoom). */
function cadrerLigne(l) {
  const scene = r('scene')
  const c = cadreLigneEcran(l)
  if (!scene || !c) return
  const W = scene.clientWidth, H = scene.clientHeight
  let dx = 0, dy = 0
  if (c.x < 16) dx = 16 - c.x; else if (c.x + c.l > W - 16) dx = Math.max(16 - c.x, W - 16 - c.x - c.l)
  if (c.y < 70) dy = 70 - c.y; else if (c.y + c.h > H - 90) dy = Math.max(70 - c.y, H - 90 - c.y - c.h)
  if (dx || dy) { E.vue.ox += dx; E.vue.oy += dy; E.vue.ajuste = false }
}
function majPopPolice(fraiche = false) {
  const pop = r('pop-police')
  if (!pop) return
  const t = texteAJour() ? E.textes : null
  const l = t && t.lignes[E.popPolice]
  if (!l) { if (!pop.hidden) { pop.hidden = true; pop.innerHTML = ''; pop.dataset.dessin = '' } return }
  const i = E.popPolice
  const html = '<div class="o-studio-pop-tete"><input class="o-studio-texte-mot" data-c="texte-ligne" data-v="' + i + '" value="' + attr(l.texte) + '" spellcheck="false" aria-label="Le texte de la ligne (à corriger s\'il est mal lu)" title="Mal lu ? Corrigez le texte : la police se recherche.">'
    + '<button type="button" class="o-studio-pop-x" data-a="pop-police-fermer" aria-label="Fermer">' + ic('x') + '</button></div>'
    + '<div class="o-studio-pop-liste" role="radiogroup" aria-label="La police de « ' + attr(l.texte) + ' »">'
    + (l.recherche ? '<div class="o-studio-pop-vide">Recherche de la police…</div>'
      : '<button type="button" role="radio" class="o-studio-pop-ligne" data-a="ligne-police" data-v="-1" aria-checked="' + (l.choix < 0) + '"><span class="o-studio-pop-apercu">Dessin d\'origine</span><small>les lettres du logo, telles quelles</small></button>'
      + l.props.map((p, j) => '<button type="button" role="radio" class="o-studio-pop-ligne" data-a="ligne-police" data-v="' + j + '" aria-checked="' + (l.choix === j) + '"><span class="o-studio-pop-apercu" style="font-family:\'' + apercuPolice(p) + '\',sans-serif">' + html_(l.texte) + '</span>'
        + '<small>' + html_(nomPolice(p)) + ' · ' + Math.round(p.note * 100) + ' %' + (j === 0 ? (l.reconnue ? ' · <b>reconnue</b>' : ' · la plus proche') : '') + '</small></button>').join(''))
    + '</div>' + curseurGras(l, i)
  if (pop.dataset.dessin !== html) {
    const actif = pop.contains(document.activeElement) && document.activeElement.type === 'text' ? document.activeElement : null
    if (!actif || fraiche) { pop.innerHTML = html; pop.dataset.dessin = html }
  }
  pop.hidden = false
  pop.querySelectorAll('[data-c="gras"]').forEach(el => majGras(el, l))
  placerPopPolice()
}
/* La bulle sous sa ligne (au-dessus faute de place), dans le plan. */
function placerPopPolice() {
  const pop = r('pop-police'), scene = r('scene')
  if (!pop || pop.hidden || !scene) return
  const t = texteAJour() ? E.textes : null
  const l = t && t.lignes[E.popPolice]
  const c = l && cadreLigneEcran(l)
  if (!c) return
  const W = scene.clientWidth, H = scene.clientHeight
  const pl = pop.offsetWidth, ph = pop.offsetHeight
  const x = Math.round(Math.max(12, Math.min(W - pl - 12, c.x + c.l / 2 - pl / 2)))
  const bas = c.y + c.h + 12
  const y = Math.round(bas + ph <= H - 12 ? bas : Math.max(12, Math.min(H - ph - 12, c.y - 12 - ph)))
  pop.style.left = x + 'px'
  pop.style.top = y + 'px'
}
/* LE GRAS D'UNE LIGNE (lib/texte.js, `grasPx`) : un curseur sous sa police,
   de 0 à 100 — du gras ajouté autour de chaque lettre, dans les trois
   versions et tous les exports. Il se lit en millimètres à la taille du
   PDF (300 dpi). Sans police choisie, il n'y a pas de lettres à épaissir.
   Sa valeur n'est pas dans le dessin de la ligne (`majGras` la pose) : un
   curseur qu'on tient ne se redessine pas sous la main. */
function curseurGras(l, i) {
  const sans = l.recherche || l.choix < 0
  return '<div class="o-studio-curseur o-studio-gras">'
    + '<div class="o-studio-curseur-tete"><label for="o-studio-gras-' + i + '">Gras autour</label><output data-r="val-gras-' + i + '"></output></div>'
    + '<input type="range" id="o-studio-gras-' + i + '" data-c="gras" data-v="' + i + '" min="0" max="100" step="1"'
    + (sans ? ' disabled title="Choisissez une police pour épaissir ses lettres"' : ' title="Du gras autour de chaque lettre de « ' + attr(l.texte) + ' »"') + '></div>'
}
function majGras(el, l) {
  if (!el || !l) return
  const v = l.gras || 0
  if (Number(el.value) !== v) el.value = v
  el.style.setProperty('--p', v + '%')
  const out = r('val-gras-' + el.dataset.v)
  const mm = v / 100 * (l.grasMax || 0) * 25.4 / DPI
  if (out) out.textContent = el.disabled ? '' : v ? '+' + mm.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' mm' : 'Aucun'
}
/* LE TEXTE D'UNE LIGNE CORRIGÉ À LA MAIN (« St Morton » → « St Martin ») :
   la recherche se refait sur ce texte-là, imposé ; la meilleure police
   s'applique aussitôt — on l'a demandée. `relancer` : la même recherche,
   à refaire (l'historique a reposé la ligne avant sa réponse). */
async function relireLigne(k, texte, relancer = false) {
  const t = E.textes
  const l = t && t.lignes[k]
  texte = String(texte || '').replace(/\s+/g, ' ').trim()
  if (!l || !texte || (texte === l.texte && !relancer) || !t.fil || !texteAJour()) return
  l.texte = texte
  l.main = l.edite = true
  l.recherche = true
  /* Une ligne reposée par l'historique entre-temps ne prend pas la
     réponse. */
  const jeton = l.jeton = (l.jeton || 0) + 1
  majPolice()
  const textes = [], lectures = []
  textes[l.ligne] = texte
  lectures[l.ligne] = [{ texte, confiance: 100, impose: true }]
  try {
    const r = await t.fil.demander({ type: 'polices', cle: t.cle, textes, lectures }, evenement)
    if (E.textes !== t || l.jeton !== jeton) return
    const x = r.lignes[l.ligne]
    if (x && x.props.length) Object.assign(l, { texte: x.texte, props: x.props, ecriture: !!x.ecriture, reconnue: false, choix: 0 })
    else Object.assign(l, { props: [], choix: -1 })
  } catch {
    if (E.textes !== t || l.jeton !== jeton) return
  }
  l.recherche = false
  majPolice()
  poserPolices()
}

/* ------------------------------------------------ LE DÉTOURÉ REPEINT
   Les lettres choisies peintes dans l'image détourée (lib/texte.js,
   `poserZone`) : les zones qu'elles touchent, repeintes dans le fil du
   texte sur les pixels détourés, posées à la place des leurs — dans la
   toile de l'image pleine (le plan zoomé) et dans l'aperçu ; l'export les
   reprend (`avecRepeint`). Les pixels détourés, eux, ne bougent pas :
   ailleurs, le Détouré reste le fichier. `E.repeint` : { cle, zones,
   fin (la toile qui les porte), surApercu }. */
const cleRepeint = () => clePoses() + '|' + cleFin() + '|' + cleTexte()
/* Les pixels détourés de l'image pleine, s'ils sont là. */
function baseDetouree() {
  if (!E.pleine || !E.apercu) return null
  if (E.pleine.largeur <= E.apercu.largeur) return E.resultatImage && !E.calcul.enVol ? E.resultatImage.data : null
  return finAJour() ? E.fin.data : null
}
let nRepeint = 0
async function repeindre() {
  const cle = cleRepeint()
  if (E.repeint && E.repeint.cle === cle) return appliquerRepeint()
  effacerRepeint()
  const poses = posesPretes()
  const base = poses && baseDetouree()
  if (!base) return dessiner()
  const n = ++nRepeint
  const t = E.textes, p = E.pleine
  const zones = poses.zones.map(z => {
    const data = new Uint8ClampedArray(z.l * z.h * 4)
    for (let y = 0; y < z.h; y++) {
      const de = ((z.y + y) * p.largeur + z.x) * 4
      data.set(base.subarray(de, de + z.l * 4), y * z.l * 4)
    }
    return { x: z.x, y: z.y, l: z.l, h: z.h, data, poses: z.poses }
  })
  try {
    const rep = await t.fil.demander({ type: 'poser', cle: t.cle, poses: poses.poses, zones })
    if (n !== nRepeint || cle !== cleRepeint()) return
    E.repeint = { cle, zones: rep.zones, fin: null, surApercu: false }
    appliquerRepeint()
  } catch {}
}
/* Le rectangle d'une zone dans l'aperçu, au pixel entier. */
function zoneApercu(z) {
  const s = E.apercu.echelle
  const x0 = Math.floor(z.x * s), y0 = Math.floor(z.y * s)
  return [x0, y0, Math.ceil((z.x + z.l) * s) - x0, Math.ceil((z.y + z.h) * s) - y0]
}
function appliquerRepeint() {
  const rp = E.repeint
  if (!rp || rp.cle !== cleRepeint()) return
  const plein = E.pleine.largeur > E.apercu.largeur
  let change = false
  if (plein && finAJour() && rp.fin !== E.fin.toile) {
    const ctx = E.fin.toile.getContext('2d')
    for (const z of rp.zones) ctx.putImageData(new ImageData(z.data, z.l, z.h), z.x, z.y)
    rp.fin = E.fin.toile
    rp.surApercu = false
    change = true
  }
  if (!rp.surApercu && (!plein || rp.fin) && E.resultat) {
    const ctx = E.resultat.getContext('2d')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    for (const z of rp.zones) {
      if (!plein) { ctx.putImageData(new ImageData(z.data, z.l, z.h), z.x, z.y); continue }
      /* Réduite depuis l'image pleine repeinte, au pixel entier près. */
      const [x, y, l, h] = zoneApercu(z), s = E.apercu.echelle
      ctx.clearRect(x, y, l, h)
      ctx.drawImage(rp.fin, x / s, y / s, l / s, h / s, x, y, l, h)
    }
    rp.surApercu = true
    change = true
  }
  if (change) dessiner()
}
/* Les toiles rendues à leurs pixels détourés. */
function effacerRepeint() {
  const rp = E.repeint
  E.repeint = null
  if (!rp) return
  if (rp.fin && rp.fin === E.fin.toile && E.fin.data) {
    const ctx = rp.fin.getContext('2d'), img = new ImageData(E.fin.data, rp.fin.width, rp.fin.height)
    for (const z of rp.zones) ctx.putImageData(img, 0, 0, z.x, z.y, z.l, z.h)
  }
  if (rp.surApercu && E.resultat && E.resultatImage) {
    const plein = E.pleine && E.apercu && E.pleine.largeur > E.apercu.largeur
    const ctx = E.resultat.getContext('2d')
    for (const z of rp.zones) {
      const [x, y, l, h] = plein ? zoneApercu(z) : [z.x, z.y, z.l, z.h]
      ctx.putImageData(E.resultatImage, 0, 0, x, y, l, h)
    }
  }
}
/* Les pixels détourés de l'image pleine, avec les lettres repeintes. */
function avecRepeint(data, largeur) {
  const rp = E.repeint
  if (!rp || rp.cle !== cleRepeint()) return data
  const sortie = new Uint8ClampedArray(data)
  for (const z of rp.zones) {
    for (let y = 0; y < z.h; y++) sortie.set(z.data.subarray(y * z.l * 4, (y + 1) * z.l * 4), ((z.y + y) * largeur + z.x) * 4)
  }
  return sortie
}
const html_ = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const attr = html_
/* Le curseur « Nuances » en facteur de fusion (lib/vecteur-lisse.js,
   `memeFamille`) : 50 → 1, 0 → 2 (des familles deux fois plus larges),
   100 → 0 (chaque nuance garde sa teinte). */
const fusion = () => E.nuances <= 50 ? 1 + (50 - E.nuances) / 50 : (100 - E.nuances) / 50
const vecteurAJour = () => !!(E.vecteur && !E.vecteur.apercu && E.vecteur.cle === cleVecteur() && E.vecteur.pleine === E.pleine && (!besoinUnie() || E.vecteur.unie))
/* Le dernier vecteur du détourage à l'écran, même d'une teinte retirée
   avant : il reste le temps que le suivant arrive. */
const vecteurMontre = () => !!(E.vecteur && E.vecteur.cleFin === cleFin() && E.vecteur.pleine === E.pleine)

/* LE VECTEUR SE TRACE SEUL, dès que le détourage se pose — mais pas
   pendant que l'IA nettoie l'image : on ne trace qu'une fois, l'image
   nette ; en attendant, le plan montre le détourage de l'image reçue. */
let minuteurVecteur = null
const aTracer = () => !!(E.version !== 'detoure' && E.apercu && E.resultatImage && !(E.methode === 'ia' && !E.ia.masque) && !E.nettoyage.enCours && !vecteurAJour())
function planifierVecteur(delai = 150) {
  clearTimeout(minuteurVecteur)
  if (!aTracer()) return
  minuteurVecteur = setTimeout(() => {
    if (aTracer()) vectoriser().then(() => { majPanneau(); dessiner() })
  }, delai)
}

let enVol = null
function vectoriser() {
  if (vecteurAJour()) return Promise.resolve(E.vecteur)
  if (!enVol) {
    /* Le détourage a bougé pendant le calcul : on refait, pour celui-là. */
    const debut = cleVecteur()
    enVol = calculerVecteur().finally(() => {
      enVol = null
      if (cleVecteur() !== debut) planifierVecteur(0)
    })
  }
  return enVol
}

/* L'APERÇU DU CURSEUR : un calcul à la fois ; la main a bougé entre-temps,
   on retrace pour sa dernière position. */
let apercuEnVol = false
function apercuVecteur() {
  if (apercuEnVol || !aTracerApercu()) return
  apercuEnVol = true
  const debut = cleVecteur()
  calculerVecteur(true).finally(() => {
    apercuEnVol = false
    majPanneau()
    dessiner()
    if (cleVecteur() !== debut && vecteurMontre()) apercuVecteur()
  })
}
const aTracerApercu = () => !!(E.version !== 'detoure' && E.apercu && E.resultatImage && !(E.methode === 'ia' && !E.ia.masque) && !E.nettoyage.enCours)

async function calculerVecteur(apercu = false) {
  const v = await tracer(apercu)
  return v === RENVOYER ? tracer(apercu) : v
}
const RENVOYER = {}

async function tracer(apercu = false) {
  if (!E.pleine) return null
  if (E.methode === 'ia' && !E.ia.masque) return null
  const cle = cleVecteur()
  const cleF = cleFin()
  const p = E.pleine
  const deja = finAJour()
  const memo = cleF + '|' + deja + '|' + p.n
  const qui = apercu ? 'apercu' : 'final'
  const f = apercu ? null : vecteurFil(cleF)
  /* Le détourage déjà reçu par ce fil ne retraverse pas. */
  const recu = connu.get(qui) === memo
  const m = Object.assign(messageCalcul(1), {
    type: 'vecteur',
    data: recu ? null : deja ? E.fin.data : p.data,
    detoure: deja,
    lissage: E.lissage,
    fusion: fusion(),
    apercu,
    memo,
    fonds: E.fondsLus,
    source: recu ? null : p.data,
    largeur: p.largeur,
    hauteur: p.hauteur,
    sans: E.sans,
    origine: origine(),
    unie: besoinUnie(),
    /* Les lettres des polices choisies, déjà posées (voir `poserPolices`). */
    polices: apercu || !posesPretes() ? [] : posesPretes().poses,
    texte: apercu || !posesPretes() ? null : posesPretes().texte,
  })
  E.vectorise++
  if (!apercu) { finalEnVol++; phaseTrace = '' }
  majEtat()
  let encore = false
  try {
    const rep = await (apercu ? demander(m) : f.demander(m, evenement))
    connu.set(qui, memo)
    if (E.pleine !== p || cleF !== cleFin()) return null
    /* Un aperçu arrivé après le tracé final ne le remplace pas. */
    if (apercu && E.vecteur && !E.vecteur.apercu && E.vecteur.cle === cle && E.vecteur.pleine === p) return E.vecteur
    E.vecteur = { svg: rep.svg, lettres: rep.lettres || '', unie: rep.unie, multi: rep.multi, degrade: rep.degrade, nuances: rep.nuances, cadre: rep.cadre, couleurs: rep.couleurs || [], rgba: rep.image, imageL: rep.imageLargeur, imageH: rep.imageHauteur, noeuds: rep.noeuds, cle, cleFin: cleF, pleine: p, apercu }
    /* Le graphiste ouvre sur Image un logo qui a du modelé (un dégradé,
       une texture : jamais tronqués), sur Vecteur un logo à plat. */
    if (!E.vueChoisie && E.version !== 'detoure') E.version = rep.degrade ? 'image' : 'vecteur'
    /* Une teinte changée qui a disparu du logo (retirée, fondue) s'oublie —
       sur un tracé des réglages du moment : un tracé dépassé (l'historique
       a reposé d'autres nuances entre-temps) n'efface rien. */
    const la = new Set(E.vecteur.couleurs.map(c => c.join(',')))
    if (cle === cleVecteur()) for (const k of Object.keys(E.recolor)) if (!la.has(k)) delete E.recolor[k]
    if (!apercu) reporterTeintes(p)
    return E.vecteur
  } catch (e) {
    connu.delete(qui)
    /* Le fil a perdu l'image (il a redémarré) : on la lui renvoie. */
    if (e && e.message === 'sans-image' && recu) { encore = true; return RENVOYER }
    if (!(e && e.annule)) {
      const mot = (e && e.message) || 'La vectorisation a échoué.'
      if (apercu) toast(mot, 'alerte')
      else echouer('trace', mot)
    }
    return null
  } finally {
    E.vectorise--
    if (!apercu) finalEnVol--
    majEtat()
    if (!encore) { majPanneau(); dessiner() }
  }
}

/* LA TEINTE CHOISIE, en RVB (null : les couleurs du tracé). */
function rvbTeinte() {
  const t = E.teinte
  if (t.type !== 'nuancier') return null
  const c = NUANCIER.find(n => n.nom === t.nom)
  return c ? c.rvb.slice() : null
}

/* CE QUE LE PLAN MONTRE ET CE QUE L'EXPORT EMPORTE : le SVG à la teinte du
   moment (la silhouette d'une couleur, les aplats recolorés, ou le contour
   d'un dégradé), et ses formes prêtes à dessiner. Gardé tant que rien ne
   change. */
function affichage() {
  const v = E.vecteur
  if (!v) return null
  const t = E.teinte
  const cle = JSON.stringify([t, E.recolor, E.version, !!v.unie])
  if (v.aff && v.aff.cle === cle) return v.aff
  let svg
  let degrade = false
  if (t.type !== 'multi') svg = teinter(v.unie || v.svg, rvbTeinte())
  else if (E.version === 'image' && !v.apercu) { svg = v.svg; degrade = true }
  else svg = recolorer(v.multi, E.recolor)
  const formes = lireSvg(svg).formes.map(f => ({ couleur: 'rgb(' + f.couleur.join(',') + ')', path: new Path2D(f.d), d: f.d, regle: f.regle }))
  if (degrade && !v.toile) {
    /* L'image nette, deux fois plus fine que le cadre (lib/image-nette.js). */
    v.toile = toileDe(v.imageL, v.imageH)
    v.toile.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(v.rgba), v.imageL, v.imageH), 0, 0)
  }
  /* `lettres` : les dernières formes, celles des polices (en version image). */
  v.aff = { cle, svg, formes, degrade, image: degrade ? v.toile : null, lettres: degrade && v.lettres ? lireSvg(v.lettres).formes.length : 0 }
  return v.aff
}

/* ------------------------------------------------------------------ LA SORTIE */
/* LE SUFFIXE DU NOM : la teinte, pour un logo d'une couleur. */
function suffixe() {
  const t = E.teinte
  return t.type === 'nuancier' ? '-' + t.nom.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[̀-ͯ]/g, '') : ''
}

/* LE CONTOUR D'UN DÉGRADÉ : sa silhouette sans les lettres des polices. */
function contourDe(v) {
  const n = lireSvg(v.svg).formes.length - (v.lettres ? lireSvg(v.lettres).formes.length : 0)
  let k = 0
  return v.svg.replace(/<path[^>]*\/>/g, p => k++ < n ? p : '')
}

/* LE SVG D'UN DÉGRADÉ : l'image, pleine, dans le contour vectoriel ; les
   lettres des polices par-dessus, en vrai vecteur. */
function svgDegrade(v) {
  const c = v.cadre
  if (!v.png) v.png = (v.toile || affichage().image).toDataURL('image/png')
  const d = lireSvg(contourDe(v)).formes.map(f => f.d).join('')
  const image = d ? '<defs><clipPath id="contour"><path clip-rule="evenodd" d="' + d + '"/></clipPath></defs>'
    + '<image href="' + v.png + '" x="' + c.x + '" y="' + c.y + '" width="' + c.largeur + '" height="' + c.hauteur + '" clip-path="url(#contour)" preserveAspectRatio="none"/>' : ''
  const lettres = v.lettres ? (v.lettres.match(/<path[^>]*\/>/g) || []).join('') : ''
  return v.svg.replace(/<path[^>]*\/>/g, '').replace('</svg>', image + lettres + '</svg>')
}

/* LE PNG : le dessin rendu à 300 dpi de sa taille d'impression, fond
   transparent (lib/png.js). */
async function pngDe(v, a, largeurCm) {
  const c = v.cadre
  let L = Math.max(1, Math.round(largeurCm / 2.54 * 300))
  if (L > PNG_MAX) L = PNG_MAX
  const k = L / c.largeur
  const H = Math.max(1, Math.round(c.hauteur * k))
  const t = toileDe(L, H)
  const ctx = t.getContext('2d')
  ctx.setTransform(k, 0, 0, k, -c.x * k, -c.y * k)
  ctx.imageSmoothingQuality = 'high'
  if (a.degrade) peindreDegrade(ctx, a, c)
  else for (const f of a.formes) { ctx.fillStyle = f.couleur; ctx.fill(f.path, f.regle) }
  return pngHd(deborder(ctx.getImageData(0, 0, L, H).data, L, H), L, H, { dpi: 300 })
}

/* UN FICHIER, dans le format voulu, à 300 dpi de l'image de travail. */
async function fichierDe(format, v, a, largeurCm) {
  /* Le blanc couvre exactement ce qui s'imprime : toutes les formes du
     logo, le contour d'un dégradé, la forme teinte en une couleur. */
  const blanc = E.blanc ? a.svg : null
  if (format === 'pdf') {
    return a.degrade
      ? await imageVersPdf(v.rgba, v.imageL, v.imageH, { largeurCm, decoupe: (W, H) => decoupePdf(contourDe(v), W, H), dessus: v.lettres && ((W, H) => dessinPdf(v.lettres, W, H)), blanc: blanc && ((W, H) => blancPdf(blanc, W, H)), ressources: RESSOURCES_BLANC })
      : new TextEncoder().encode(svgVersPdf(a.svg, { largeurCm, blanc }))
  }
  if (format === 'svg') return new TextEncoder().encode(svgFinal(a.degrade ? svgDegrade(v) : a.svg, { largeurCm }))
  if (format === 'eps') return new TextEncoder().encode(svgVersEps(a.svg, { largeurCm, blanc }))
  return pngDe(v, a, largeurCm)
}

const TYPES = { pdf: 'application/pdf', svg: 'image/svg+xml', eps: 'application/postscript', png: 'image/png', zip: 'application/zip' }
let minuteurFait = null

/* L'EXPORT ATTEND L'IA (30 septembre 2026) : un clic pendant l'Amélioration
   IA emportait l'image reçue, sans rien dire. Il attend qu'elle ait fini —
   puis le sujet de l'image nette, quand le fond passe par l'IA. Faux si un
   autre fichier s'est ouvert entre-temps : rien ne part. */
async function attendreIA() {
  const recu = () => E.original ? E.original.fichier : E.fichier
  const avant = recu()
  const pause = () => new Promise(ok => setTimeout(ok, 100))
  while (E.nettoyage.enCours || (E.methode === 'ia' && !E.ia.masque && E.ia.enCours)) await pause()
  return recu() === avant
}

async function enregistrer(quoi = 'pdf') {
  if (!E.pleine || E.exporte) return
  if (E.nettoyage.enCours) {
    E.exporte = quoi
    majPanneau()
    const meme = await attendreIA()
    E.exporte = ''
    majPanneau()
    if (!meme) return
  }
  if (E.methode === 'ia' && !E.ia.masque) return toast('L\'IA cherche encore le sujet…')
  if (E.version === 'detoure') return enregistrerDetoure(quoi)
  if (quoi === 'eps' && degradeRendu()) return toast('Un dégradé ne passe pas en EPS : PDF ou SVG.')
  E.exporte = quoi
  majPanneau()
  try {
    await texteRegle()
    const v = await vectoriser()
    if (!v) return
    const a = affichage()
    /* À 300 dpi. */
    const largeurCm = tailleCm(v.cadre.largeur, v.cadre.hauteur)[0]
    let blob, nom
    if (quoi === 'kit') {
      const formats = ['pdf', 'svg', 'png'].concat(a.degrade ? [] : ['eps'])
      const fichiers = []
      for (const f of formats) fichiers.push({ nom: nomExport(E.nom, f, suffixe()), octets: await fichierDe(f, v, a, largeurCm) })
      blob = new Blob([zip(fichiers)], { type: TYPES.zip })
      nom = nomExport(E.nom, 'zip', suffixe())
    } else {
      blob = new Blob([await fichierDe(quoi, v, a, largeurCm)], { type: TYPES[quoi] })
      nom = nomExport(E.nom, quoi, suffixe())
    }
    telecharger(blob, nom)
    /* C'est parti : le bouton le dit, en vert, le temps d'un regard. */
    E.fait = quoi
    clearTimeout(minuteurFait)
    minuteurFait = setTimeout(() => { E.fait = ''; majPanneau() }, 2200)
  } catch (e) {
    toast((e && e.message) || 'L\'export a échoué.', 'alerte')
  } finally {
    E.exporte = ''
    majPanneau()
  }
}

/* DÉTOURÉ : l'image pleine, son fond retiré, pixel pour pixel, recadrée
   au logo — PNG ou PDF à 300 dpi (lib/pdf-image.js). Rien ne se trace ;
   seules les lettres dont la police est choisie y sont repeintes. */
async function enregistrerDetoure(quoi) {
  if (quoi === 'svg' || quoi === 'eps') return toast('Détouré sort en PDF ou en PNG.')
  E.exporte = quoi
  majPanneau()
  try {
    await texteRegle()
    const detouree = await detourePleine()
    if (!detouree) return toast('Le détourage n\'a pas abouti.', 'alerte')
    await repeindre()
    const pleine = avecRepeint(detouree, E.pleine.largeur)
    const img = recadrer(pleine, E.pleine.largeur, E.pleine.hauteur)
    if (!img) return toast('Il ne reste rien : baisse le seuil.', 'alerte')
    /* À 300 dpi, pixel pour pixel. */
    const pdf = () => imageVersPdf(img.data, img.largeur, img.hauteur, { blancMasque: E.blanc, ressources: RESSOURCES_BLANC })
    const png = () => pngHd(deborder(img.data, img.largeur, img.hauteur), img.largeur, img.hauteur, { dpi: 300 })
    let blob, nom
    if (quoi === 'kit') {
      blob = new Blob([zip([{ nom: nomExport(E.nom, 'pdf', '', 'detoure'), octets: await pdf() }, { nom: nomExport(E.nom, 'png', '', 'detoure'), octets: await png() }])], { type: TYPES.zip })
      nom = nomExport(E.nom, 'zip', '', 'detoure')
    } else {
      blob = new Blob([await (quoi === 'png' ? png() : pdf())], { type: TYPES[quoi] })
      nom = nomExport(E.nom, quoi, '', 'detoure')
    }
    telecharger(blob, nom)
    E.fait = quoi
    clearTimeout(minuteurFait)
    minuteurFait = setTimeout(() => { E.fait = ''; majPanneau() }, 2200)
  } catch (e) {
    toast((e && e.message) || 'L\'export a échoué.', 'alerte')
  } finally {
    E.exporte = ''
    majPanneau()
  }
}

/* LES PIXELS DÉTOURÉS DE L'IMAGE PLEINE : ceux de l'aperçu quand il a sa
   taille, sinon le détourage fin, attendu s'il n'est pas encore là. */
async function detourePleine() {
  if (E.pleine.largeur <= E.apercu.largeur) {
    while (E.calcul.enVol) await new Promise(ok => setTimeout(ok, 50))
    return E.resultatImage && E.resultatImage.data
  }
  for (let k = 0; k < 3 && !finAJour(); k++) {
    clearTimeout(minuteurFin)
    await calculerFin()
  }
  return finAJour() ? E.fin.data : null
}

export function telecharger(blob, nom) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nom
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

/* ------------------------------------------------------------ LES MOTS */
let minuteurToast = null
function toast(mot, ton) {
  const t = r('toast')
  if (!t) return
  t.textContent = mot
  t.dataset.ton = ton || 'ok'
  t.classList.add('o-studio-montre')
  clearTimeout(minuteurToast)
  minuteurToast = setTimeout(() => t.classList.remove('o-studio-montre'), ton === 'alerte' ? 4200 : 2600)
}

/* --------------------------------------------------------- LES RACCOURCIS
   Posés une fois sur la page ; ils ne répondent que quand le studio est à
   l'écran, et pas pendant qu'on tape dans un champ. */
if (typeof document !== 'undefined') {
  const champ = t => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
  /* Un champ où l'on tape : Ctrl Z y annule la saisie, c'est le navigateur
     qui s'en charge — pas un curseur ni une case. */
  const saisie = t => t && (t.isContentEditable || t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && /^(text|number|search|email|url|tel|password)$/.test(t.type)))
  document.addEventListener('keydown', e => {
    if (!visible()) return
    const mod = e.ctrlKey || e.metaKey
    const k = e.key.toLowerCase()
    if (mod && k === 's') { e.preventDefault(); return enregistrer('pdf') }
    if (mod && k === 'o') { e.preventDefault(); return r('fichier').click() }
    /* ANNULER (Ctrl Z), RÉTABLIR (Ctrl Maj Z, Ctrl Y). */
    if (mod && !e.altKey && (k === 'z' || k === 'y') && !saisie(e.target)) {
      e.preventDefault()
      return k === 'y' || e.shiftKey ? refaire() : defaire()
    }
    if (mod || e.altKey || champ(e.target)) return
    if (e.key === 'Escape') { if (E.popPolice >= 0) fermerPopPolice(); else if (E.pop) fermerPop(); else if (E.menu) fermerMenu(); else if (E.historique) fermerHistorique(); else if (E.split !== null) basculerSplit(); return }
    if (!E.apercu) return
    /* Espace maintenu : le fichier reçu — sauf sur un bouton, qu'il presse. */
    if (e.key === ' ') {
      if (e.target.closest && e.target.closest('button, [role="radio"], [role^="menuitem"]')) return
      e.preventDefault()
      return voirAvant(true)
    }
    if (k === 'd') return geste(() => changerVersion('detoure'))
    if (k === 'v') return geste(() => changerVersion('vecteur'))
    if (k === 'i') return geste(() => changerVersion('image'))
    if (k === 'c') return basculerSplit()
    if (k === '0') { ajuster(); return dessiner() }
    if (k === '1') return centPourCent()
    const scene = r('scene')
    if (k === '+' || k === '=') return zoomer(1.25, scene.clientWidth / 2, scene.clientHeight / 2)
    if (k === '-') return zoomer(0.8, scene.clientWidth / 2, scene.clientHeight / 2)
  })
  document.addEventListener('keyup', e => { if (e.key === ' ' && E.comparer) voirAvant(false) })
  document.addEventListener('paste', e => {
    if (!visible()) return
    const item = [...((e.clipboardData && e.clipboardData.items) || [])].find(i => i.kind === 'file' && /^image\//.test(i.type))
    if (!item) return
    e.preventDefault()
    const f = item.getAsFile()
    if (f) charger(new File([f], f.name && f.name !== 'image.png' ? f.name : 'logo-colle.png', { type: f.type }))
  })
}

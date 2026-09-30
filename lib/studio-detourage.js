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
     entier dans une des couleurs DTF de l'atelier ;
   - LE BLANC DTF et UN BOUTON : le PDF pour la presse. Les autres formats
     — SVG, PNG, EPS, tout en .zip — dans « Plus ».
   Raccourcis : Ctrl + O ouvrir, Ctrl + V coller, Ctrl + S le PDF, V et I
   les versions, C comparer, Espace maintenu l'avant, 0 tout voir, 1 pour
   100 %, + et −.
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
     part, les pixels du fichier restent tels quels, rien ne se trace —
     d'office, et retenu d'une visite à l'autre sur ce poste. */
  version: lire('olda.detourage.version', 'detoure') === 'detoure' ? 'detoure' : 'vecteur',
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
  /* 'multi' (les couleurs du logo) ou une des couleurs DTF de l'atelier. */
  teinte: { type: 'multi' },
  uneCouleur: { type: 'dtf', nom: 'Noir' },
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
     le poste ne la tient pas d'office. */
  nettoyage: { enCours: false, etape: '', part: 0, moteur: '', duree: 0, ultra: 0, faite: 0, estime: 0, nette: false },
  /* « RENDRE NET » (lib/nettete.js, 30 septembre 2026 : « la feature de
     PicWish qui passe une image floue à une image nette ») : le flou du
     fichier retiré avant l'IA — voulu d'office par le graphiste quand le
     fichier est flou, d'un clic par la vendeuse ; `nettoyage.nette` :
     l'image de travail l'a été. */
  net: false,
  original: null,
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
      if (!a || e.data.progression !== undefined) return
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
      for (const a of encore) demander(a.message).then(a.ok, a.ko)
    }
    if (E.apercu) fil.postMessage({ type: 'source', data: E.apercu.data, largeur: E.apercu.largeur, hauteur: E.apercu.hauteur })
  } catch {
    filKo = true
  }
  return fil
}

function demander(message) {
  const f = ouvrirFil()
  if (!f) return import('./detourage-travail.js').then(m => m.traiter(message, memoireLocale)).then(r => r.reponse || {})
  return new Promise((ok, ko) => {
    const id = ++numero
    attentes.set(id, { ok, ko, message })
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

/* LES COULEURS DTF DE L'ATELIER, les mêmes que les pastilles de la prise
   de commande (COULEURS_LOGO et TEINTES, Comptoir ULTRA.dc.html). */
export const COULEURS_DTF = [
  ['Noir', '#0f172a'], ['Blanc', '#ffffff'], ['Kaki', '#7b7a4e'], ['Bleu marine', '#1e3a5f'],
  ['Bleu royal', '#2b53c4'], ['Bleu clair', '#8ec5ea'], ['Rouge', '#c62828'], ['Orange', '#f07f1f'],
  ['Corail', '#ff7a6b'], ['Vert', '#2e8b57'], ['Vert pastel', '#a8d8b0'], ['Menthe', '#98e0cf'],
  ['Lavande', '#b9a7dd'], ['Rose bébé', '#f6c6d4'], ['Jaune', '#f2c13d'], ['Beige', '#e3d3b4'],
]

const hexVersRvb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
const rvbHex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')

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
    + '  <div class="o-studio-etat" data-r="etat"></div>'
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
    + '  <input type="file" data-r="fichier" accept="image/*,.pdf,.ai,.svg,.heic,.heif,.tif,.tiff" hidden>'
    + '</div>'
    + '<aside class="o-studio-panneau">'
    + '  <header class="o-studio-entete">'
    + '    <div class="o-studio-fichier"><b data-r="nom">Aucune image</b><span data-r="taille">—</span></div>'
    + '    <button type="button" class="o-studio-bouton o-studio-discret" data-a="choisir" title="Ouvrir un fichier (Ctrl O)">Changer</button>'
    + '  </header>'
    + '  <div class="o-studio-defile">'
    + '    <section class="o-studio-bloc" data-besoin="image">'
    + ligne('sparkles', '<b>Amélioration IA</b>', 'nettoyer', 'Amélioration IA', 'ia-etat')
    + ligne('focus', '<b>Rendre net</b>', 'net', 'Rendre net', 'net-etat')
    + '      <div class="o-studio-progression" data-r="net-barre" hidden><i></i></div>'
    + '      <button type="button" class="o-studio-bouton o-studio-discret" data-a="ultra" data-r="ultra" hidden title="Le modèle haut de gamme, passé huit fois : des bords plus fidèles — plus long sur ce poste">' + ic('wand-sparkles') + '<span data-r="ultra-mot"></span></button>'
    + '    </section>'
    + '    <section class="o-studio-bloc" data-besoin="image">'
    + '      <div class="o-studio-bloc-tete"><b>Fond</b><span data-r="res-fond"></span></div>'
    + '      <div class="o-studio-segment" role="radiogroup" aria-label="Le fond à retirer">'
    + '        <button type="button" role="radio" data-a="fond-retire" data-v="autour" title="Le fond autour du logo, et dans les lettres posées dehors">Autour</button>'
    + '        <button type="button" role="radio" data-a="fond-retire" data-v="partout" title="Le fond partout, même dans les lettres et les cercles">Partout</button>'
    + '        <button type="button" role="radio" data-a="fond-retire" data-v="sujet" title="Le sujet d\'une photo, trouvé par l\'IA">' + ic('sparkles') + 'Sujet</button>'
    + '      </div>'
    + '      <div class="o-studio-progression" data-r="ia-barre" hidden><i></i></div>'
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
    + '      <div class="o-studio-pastilles" role="radiogroup" aria-label="Couleur du DTF" data-r="une" hidden>'
    + COULEURS_DTF.map(([nom, hex]) => '<button type="button" role="radio" data-a="teinte" data-v="' + nom + '" title="' + nom + '"><i style="background:' + hex + '"></i></button>').join('')
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
}

/* --------------------------------------------------------------- LE MONTAGE */
const r = nom => E.racine && E.racine.querySelector('[data-r="' + nom + '"]')

export function monter(hote) {
  if (!hote || hote.dataset.monte) return
  hote.dataset.monte = '1'
  hote.classList.add('o-studio')
  hote.innerHTML = gabarit()
  E.racine = hote
  const scene = r('scene')
  const toile = r('toile')

  hote.addEventListener('click', clic)
  hote.addEventListener('change', e => {
    /* Le curseur lâché : le tracé final, à la pleine taille. */
    if (e.target.dataset.c === 'lissage' || e.target.dataset.c === 'nuances') return planifierVecteur(0)
    /* Une police choisie pour une ligne (ou son tracé d'origine). */
    if (e.target.dataset.c === 'police' && E.textes) {
      const l = E.textes.lignes[Number(e.target.dataset.v)]
      if (l) { l.choix = Number(e.target.value); l.main = true; majPolice(); poserPolices() }
      return
    }
    /* Le texte d'une ligne corrigé (validé ou quitté). */
    if (e.target.dataset.c === 'texte-ligne' && E.textes) return relireLigne(Number(e.target.dataset.v), e.target.value)
    /* Le gras d'une ligne, lâché : ses lettres se reposent, épaissies. */
    if (e.target.dataset.c === 'gras' && E.textes) {
      const l = E.textes.lignes[Number(e.target.dataset.v)]
      if (l) { l.gras = Number(e.target.value); l.main = true; majPolice(); poserPolices() }
      return
    }
    if (e.target.dataset.c === 'pop-couleur' && E.pop) {
      E.recolor[E.pop] = hexVersRvb(e.target.value)
      majCouleurs()
    }
  })
  hote.addEventListener('input', e => {
    const c = e.target.dataset.c
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
    E.glisse = { x: e.clientX, y: e.clientY, ox: E.vue.ox, oy: E.vue.oy }
    scene.classList.add('o-studio-saisi')
    fermerPop()
    fermerMenu()
  })
  toile.addEventListener('pointermove', e => {
    const g = E.glisse
    if (!g) return
    E.vue.ox = g.ox + e.clientX - g.x
    E.vue.oy = g.oy + e.clientY - g.y
    E.vue.ajuste = false
    dessiner()
  })
  const lache = () => { E.glisse = null; scene.classList.remove('o-studio-saisi') }
  toile.addEventListener('pointerup', lache)
  toile.addEventListener('pointercancel', lache)
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

    if (E.nettoyage.enCours) annulerNettoyage()
    E.chargement = (E.chargement || 0) + 1
    E.nettoyage.nette = false
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
         creux, l'IA. */
      E.decision = decider(E.apercu, E.fichier)
      E.net = E.decision.net
      E.methode = E.decision.fond
      E.reglages = { tolerance: D.TOLERANCE, interieur: creuxVoulu(), seuil: SEUIL }
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
    if (E.decision && E.decision.nettoyer) nettoyerImage()
  } catch (e) {
    toast((e && e.message) || 'Ce fichier ne se lit pas comme une image.', 'alerte')
  } finally {
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
  const teintes = Object.keys(E.recolor).length || E.sans.length ? { recolor: E.recolor, sans: E.sans } : null
  const t = texteAJour() && E.textes.f ? E.textes : null
  const polices = t ? t.lignes.filter(l => l.main).map(l => {
    const p = l.choix >= 0 && l.props[l.choix]
    return Object.assign(placeLigne(l, t), { texte: l.texte, edite: !!l.edite, gras: l.gras || 0, police: p ? { id: p.id, graisse: p.graisse, style: p.style } : null })
  }) : []
  return teintes || polices.length ? { teintes, polices } : null
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
  const recue = E.source
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
  installer(E.pleine, toile)
  if (garderSource && recue) E.source = recue
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
  Object.assign(E.nettoyage, { enCours: true, etape: 'telechargement', part: 0, ultra: ultra === true ? 8 : 0 })
  majPanneau()
  /* Rendue nette : son flou, en pixels du fichier (lib/graphiste.js). */
  const flou = E.net && E.decision ? E.decision.flou : 0
  ia().demander({ type: 'nettoyer', data: source.data, largeur: source.largeur, hauteur: source.hauteur, matiere: !!(E.decision && E.decision.matiere), ultra: !!ultra, budget: ultra === true ? 0 : ULTRA_AUTO, flou }, pr => {
    if (E.pleine !== p || n !== nNettoyage) return
    E.nettoyage.etape = pr.etape
    if (pr.part !== undefined) E.nettoyage.part = pr.part
    if (pr.moteur) E.nettoyage.moteur = pr.moteur
    if (pr.ultra !== undefined) E.nettoyage.ultra = pr.ultra
    majNettoyage()
  }).then(rep => {
    if (E.pleine !== p || n !== nNettoyage) return
    const toile = toileDe(rep.largeur, rep.hauteur)
    toile.getContext('2d').putImageData(new ImageData(rep.data, rep.largeur, rep.hauteur), 0, 0)
    E.original = { pleine: source, fichier, entree: rep.entree }
    E.fichier = Object.assign({}, fichier, { largeur: rep.largeur, hauteur: rep.hauteur })
    E.nettoyage.faite = rep.ultra || 0
    E.nettoyage.nette = !!rep.nette
    E.nettoyage.estime = rep.estimeUltra || 0
    E.nettoyage.duree = performance.now() - debut
    E.nettoyage.enCours = false
    remplacer(rep, toile, redecider, true)
  }).catch(e => {
    if (e && e.annule) return
    toast('Le nettoyage n\'a pas pu se faire : ' + ((e && e.message) || 'erreur inconnue.'), 'alerte')
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

function annulerNettoyage() {
  nNettoyage++
  fermerIA()
  E.nettoyage.enCours = false
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
  const recu = E.original && E.decision ? { matiere: E.decision.matiere, flou: E.decision.flou, net: E.decision.net } : {}
  E.decision = Object.assign({}, decider(E.apercu, E.original ? E.original.fichier : E.fichier), { nettoyer: !!E.original }, recu)
  if (!E.fondChoisi) E.methode = E.decision.fond
  if (!E.creuxChoisi) E.reglages.interieur = creuxVoulu()
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
  Object.assign(E.ia, { enCours: true, etape: 'telechargement', part: 0, erreur: '' })
  majPanneau()
  dessiner()
  /* Le sujet d'une illustration collée, choisi par le graphiste : BiRefNet
     ou rien (lib/graphiste.js, `birefnet`) — rien, et le fond repasse à la
     couleur. Choisi d'un clic, ISNet fait l'affaire. */
  const exiger = !E.fondChoisi && !!(E.decision && E.decision.birefnet)
  ia().demander({ type: 'ia', data: apercu.data, largeur: apercu.largeur, hauteur: apercu.hauteur, matiere: !!(E.decision && E.decision.matiere), exiger }, p => {
    if (n !== E.ia.n) return
    E.ia.etape = p.etape
    if (p.part !== undefined) E.ia.part = p.part
    if (p.moteur) E.ia.moteur = p.moteur
    majIA()
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
    toast('L\'IA n\'a pas pu tourner : ' + E.ia.erreur, 'alerte')
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
  const minuteur = setTimeout(majEtat, 160)
  const { largeur: l, hauteur: h, data: source } = E.apercu
  /* Un résultat d'une autre méthode (on a changé pendant le calcul) ne
     s'affiche pas : le calcul suivant arrive. */
  const methode = E.methode
  const cleIA = E.ia.cle
  demander(messageCalcul(E.apercu.echelle)).then(rep => {
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
  }).catch(e => toast(e.message, 'alerte')).finally(() => {
    clearTimeout(minuteur)
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
  if (!E.apercu || !E.resultat) return
  const { zoom, ox, oy } = E.vue
  const l = E.apercu.largeur * zoom
  const h = E.apercu.hauteur * zoom
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  if (E.comparer) return ctx.drawImage(E.source, ox, oy, l, h)
  const scene = r('scene')
  if (E.split !== null) {
    const x = scene.clientWidth * E.split
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, x, scene.clientHeight)
    ctx.clip()
    ctx.drawImage(E.source, ox, oy, l, h)
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
function clic(e) {
  const b = e.target.closest('[data-a]')
  if (!b || !E.racine.contains(b)) {
    if (E.pop && !e.target.closest('[data-r="pop"]')) fermerPop()
    if (E.menu && !e.target.closest('[data-r="menu"]')) fermerMenu()
    return
  }
  const a = b.dataset.a
  const v = b.dataset.v
  if (a !== 'couleur' && !a.startsWith('pop-') && E.pop) fermerPop()
  if (a !== 'menu' && !b.closest('[data-r="menu"]') && E.menu) fermerMenu()
  if (a === 'choisir') return r('fichier').click()
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
  } else if (a === 'nettoyer') {
    if (E.nettoyage.enCours) annulerNettoyage()
    else if (E.original) revenirOriginal()
    else nettoyerImage()
  } else if (a === 'net') {
    /* « Rendre net » : l'IA repart du fichier reçu, avec ou sans le flou
       retiré ; cochée sans l'IA, elle la lance. */
    const enCours = E.nettoyage.enCours
    E.net = !netMontre()
    if (enCours) annulerNettoyage()
    if (E.net || E.original || enCours) nettoyerImage()
    else majPanneau()
  } else if (a === 'ultra') {
    if (!E.nettoyage.enCours) nettoyerImage(true)
  } else if (a === 'version') changerVersion(v)
  else if (a === 'teinte-mode') {
    E.teinte = v === 'multi' ? { type: 'multi' } : E.uneCouleur
    majCouleurs()
  } else if (a === 'teinte') {
    E.teinte = { type: 'dtf', nom: v }
    E.uneCouleur = E.teinte
    majCouleurs()
  } else if (a === 'couleur') ouvrirPop(v, b)
  else if (a === 'pop-dtf') { E.recolor[E.pop] = hexVersRvb(v); fermerPop(); majCouleurs() }
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
  E.vueChoisie = v !== 'detoure'
  garder('olda.detourage.version', v === 'detoure' ? 'detoure' : 'trace')
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

/* « 4 032 » : l'espace des milliers ne se coupe pas en fin de ligne. */
const px = n => n.toLocaleString('fr-FR').replace(/\s/g, ' ')

function majPanneau() {
  const R = E.racine
  if (!R) return
  const image = !!E.apercu
  R.classList.toggle('o-studio-vide', !image)
  r('accueil').hidden = image
  R.querySelectorAll('[data-besoin="image"]').forEach(s => s.toggleAttribute('inert', !image))
  r('nom').textContent = image ? E.nom : 'Aucune image'
  const recu = E.original ? E.original.fichier : E.fichier
  r('taille').textContent = image ? [px(recu.largeur) + ' × ' + px(recu.hauteur) + ' px', recu.type, E.original ? (E.nettoyage.faite ? 'IA Ultra ×4' : 'IA ×4') + (E.nettoyage.nette ? ', nette' : '') : ''].filter(Boolean).join(' · ') : '—'

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
  majIA()

  /* LES CURSEURS : le seuil (à la couleur près pour un fond uni, la
     confiance de l'IA pour le sujet d'une photo), le lissage du tracé. */
  const seuil = R.querySelector('[data-c="seuil"]')
  const [smin, smax, sval] = ia ? [0, SEUIL_MAX, E.reglages.seuil] : [1, 120, E.reglages.tolerance]
  seuil.min = smin
  seuil.max = smax
  if (document.activeElement !== seuil || Number(seuil.value) !== sval) seuil.value = sval
  seuil.style.setProperty('--p', ((sval - smin) / (smax - smin) * 100) + '%')
  r('val-seuil').textContent = sval
  const lis = R.querySelector('[data-c="lissage"]')
  if (document.activeElement !== lis) lis.value = E.lissage
  lis.style.setProperty('--p', E.lissage + '%')
  r('val-lissage').textContent = String(E.lissage)
  const nua = R.querySelector('[data-c="nuances"]')
  if (document.activeElement !== nua) nua.value = E.nuances
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

/* L'AMÉLIORATION IA : ce qu'elle fait, ce qu'elle a fait. */
function majNettoyage() {
  if (!E.racine) return
  const n = E.nettoyage
  const barre = r('net-barre')
  barre.hidden = !n.enCours
  barre.classList.toggle('o-studio-indefini', n.enCours && n.etape === 'preparation')
  barre.firstElementChild.style.width = Math.round(n.part * 100) + '%'
  /* La matière reconnue se dit : c'est l'IA des photos qui l'agrandit. */
  const matiere = E.decision && E.decision.matiere ? 'matière' : ''
  r('ia-etat').textContent = n.enCours ? (n.etape === 'calcul' ? (n.ultra ? 'Ultra ' : '') + Math.round(n.part * 100) + ' %' : '…')
    : E.original ? [n.faite ? 'Ultra' : '×4', matiere, String((n.duree / 1000).toFixed(1)).replace('.', ',') + ' s'].filter(Boolean).join(' · ') : matiere
  /* Le flou du fichier, mesuré sur ses bords (lib/graphiste.js) : retiré,
     rien à retirer (cochée à la main sur un fichier net), ou à retirer ;
     sous le seuil du graphiste, le fichier est net. */
  const d = E.decision, flou = d ? 'flou ' + String(d.flou.toFixed(1)).replace('.', ',') + ' px' : ''
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

/* LE SUJET D'UNE PHOTO : l'IA le cherche. */
function majIA() {
  if (!E.racine) return
  const u = E.ia
  const occupe = E.methode === 'ia' && (u.enCours || u.pose)
  const barre = r('ia-barre')
  barre.hidden = !occupe
  barre.classList.toggle('o-studio-indefini', occupe && !(u.enCours && u.etape === 'telechargement'))
  barre.firstElementChild.style.width = u.etape === 'telechargement' ? Math.round(u.part * 100) + '%' : '100%'
  majEtat()
}

/* CE QUI SE PASSE, en une pastille en bas du plan. */
function majEtat() {
  const n = E.nettoyage
  const mot = E.lecture ? 'Lecture du fichier…'
    : n.enCours ? (n.etape === 'telechargement' ? 'IA : téléchargement ' + Math.round(n.part * 100) + ' %' : n.etape === 'preparation' ? 'IA : mise en route…' : n.etape === 'nettete' ? 'Rendre net ' + Math.round(n.part * 100) + ' %' : (n.ultra ? 'IA Ultra ' : 'Amélioration IA ') + Math.round(n.part * 100) + ' %')
      : E.ia.enCours ? (E.ia.etape === 'telechargement' ? 'IA : téléchargement ' + Math.round(E.ia.part * 100) + ' %' : 'L\'IA cherche le sujet…')
        : E.calcul.enVol ? 'Détourage…'
          : E.vectorise ? 'Vectorisation…' : ''
  etat(mot)
  const scene = r('scene')
  if (scene) scene.classList.toggle('o-studio-cherche', !!(E.ia.enCours || E.ia.pose) && E.methode === 'ia')
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
      return '<button type="button" class="o-studio-teinte' + (change ? ' o-studio-changee' : '') + (E.pop === k ? ' o-studio-ouverte' : '') + '" data-a="couleur" data-v="' + k + '" title="' + rvbHex(aff).toUpperCase() + (change ? ' (d\'origine ' + rvbHex(c).toUpperCase() + ')' : '') + '"' + (fige ? ' disabled' : '') + '><i style="background:' + rvbHex(aff) + '"></i>' + (change ? '<em style="background:' + rvbHex(c) + '"></em>' : '') + '</button>'
    }).join('') + E.sans.map(c => '<button type="button" class="o-studio-teinte o-studio-retiree' + (E.pop === c.join(',') ? ' o-studio-ouverte' : '') + '" data-a="couleur" data-v="' + c.join(',') + '" title="Retirée : ' + rvbHex(c).toUpperCase() + '"><i style="background:' + rvbHex(c) + '"></i></button>').join('')
    const html = dessin || '<span class="o-studio-palette-vide">' + (E.apercu ? 'Lecture des couleurs…' : '—') + '</span>'
    if (pal.dataset.dessin !== html) { pal.innerHTML = html; pal.dataset.dessin = html }
  }
  r('res-couleurs').textContent = une ? t.nom : v ? (degradeRendu() ? 'Celles du fichier' : (v.couleurs || []).length + ' teinte' + ((v.couleurs || []).length > 1 ? 's' : '')) : ''
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
  pop.innerHTML = '<div class="o-studio-pop-tete"><i style="background:' + rvbHex(aff) + '"></i><b>' + rvbHex(aff).toUpperCase() + '</b>'
    + '<button type="button" class="o-studio-pop-x" data-a="pop-fermer" aria-label="Fermer">' + ic('x') + '</button></div>'
    + (retiree
      ? '<button type="button" class="o-studio-bouton o-studio-pop-large" data-a="pop-remettre">' + ic('rotate-ccw') + '<span>Remettre cette teinte</span></button>'
      : '<div class="o-studio-pop-grille">' + COULEURS_DTF.map(([nom, hex]) => '<button type="button" data-a="pop-dtf" data-v="' + hex + '" title="' + nom + '"><i style="background:' + hex + '"></i></button>').join('') + '</div>'
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
  const fil = filTexte = filDedie()
  let fini = null
  const t = E.textes = { cle: p.n, etat: 'lecture', lignes: [], fil, poses: null, fini: new Promise(ok => { fini = ok }), largeur: p.largeur, hauteur: p.hauteur, f: 0 }
  majPolice()
  try {
    const rep = await fil.demander({ type: 'texte', cle: p.n, data: p.data, largeur: p.largeur, hauteur: p.hauteur, origine: coteRecu() })
    if (n !== nTexte) return
    const lus = rep.lus
    t.f = rep.f || 0
    /* Une ligne dont un mot est mal lu — ou qui n'a pas deux lettres : un
       bout de dessin lu « y » — ne reçoit pas de police. */
    const textes = lus.map(l => lue(l, LUE) && (l.texte.match(/[\p{L}\p{N}]/gu) || []).length >= 2 ? l.texte : null)
    /* Une ligne peu sûre, mais qui ressemble à du texte : sa lecture sert à
       y chercher une écriture (le modèle lit une écriture liée droite, sans
       la redresser). */
    const lectures = lus.map((l, i) => !textes[i] && l.confiance >= 20 ? [{ texte: l.texte, confiance: l.confiance }] : [])
    t.etat = 'recherche'
    majPolice()
    const r = rep.lignes.length ? await fil.demander({ type: 'polices', cle: p.n, textes, lectures, symboles: lus.map(l => l.symboles || null), sures: lus.map(l => lue(l, LUE_CERTAINE)) }) : { lignes: [] }
    if (n !== nTexte) return
    t.lignes = rep.lignes.map((l, i) => {
      const x = r.lignes[i]
      if (!x || !x.props.length) return null
      /* Une écriture n'est jamais la police exacte : proposée. */
      if (x.ecriture) return { ligne: i, boite: l.boite, texte: x.texte, props: x.props, ecriture: true, reconnue: false, choix: -1, lu: lus[i], gras: 0, grasMax: l.grasMax }
      /* Reconnue : la police colle à la ligne entière, et à chacune de ses
         lettres (sinon, une lettre est mal lue ou la police n'est qu'une
         cousine : on la propose, sans l'imposer) ; la lecture est sûre —
         ou chaque lettre colle si bien (`LETTRE_CERTAINE`) qu'elle le
         prouve ; et la ligne n'est pas trop petite pour en juger. */
      /* Et le texte est celui qui a été lu : une lettre « corrigée » par la
         police (« financier » devenu « hinancier ») n'est que proposée —
         jamais un mot faux posé d'office. */
      const p0 = x.props[0]
      const reconnue = !l.petite && x.texte.replace(/\s+/g, '') === lus[i].texte.replace(/\s+/g, '') && p0.note >= RECONNUE && p0.pire >= LETTRE_SURE && lus[i].confiance >= LUE_SURE && (lus[i].mot >= LUE_SURE || p0.pire >= LETTRE_CERTAINE)
      return { ligne: i, boite: l.boite, texte: x.texte, props: x.props, reconnue, choix: reconnue ? 0 : -1, lu: lus[i], gras: 0, grasMax: l.grasMax }
    }).filter(Boolean)
    const relire = reporterPolices(t)
    t.etat = 'pret'
    majPolice()
    for (const [k, texte] of relire) await relireLigne(k, texte)
    await poserPolices()
  } catch (e) {
    if (n !== nTexte || (e && e.annule)) return
    t.etat = 'erreur'
    majPolice()
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
  try {
    const rep = choix.length ? await t.fil.demander({ type: 'poses', cle: t.cle, polices: choix }) : { poses: [], texte: null, zones: [] }
    if (n !== nPoses || E.textes !== t) return
    t.poses = { cle, poses: rep.poses, texte: rep.texte, zones: rep.zones }
  } catch {
    if (n !== nPoses || E.textes !== t) return
    t.poses = { cle, poses: [], texte: null, zones: [] }
  } finally {
    fini()
  }
  planifierVecteur(0)
  repeindre()
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

function majPolice() {
  const bloc = r('bloc-police')
  if (!bloc) return
  const t = texteAJour() ? E.textes : null
  bloc.hidden = !t || (t.etat === 'pret' && !t.lignes.length)
  if (!t) return
  r('res-police').textContent = t.etat === 'lecture' ? 'Lecture du texte…' : t.etat === 'recherche' ? 'Recherche de la police…' : t.etat === 'erreur' ? 'Indisponible' : t.lignes.length + ' ligne' + (t.lignes.length > 1 ? 's' : '')
  const html = t.lignes.map((l, i) => '<div class="o-studio-texte"><input class="o-studio-texte-mot" data-c="texte-ligne" data-v="' + i + '" value="' + attr(l.texte) + '" spellcheck="false" aria-label="Le texte de la ligne (à corriger s\'il est mal lu)" title="Mal lu ? Corrigez le texte : la police se recherche.">'
    + '<select data-c="police" data-v="' + i + '" data-lu="' + Math.round(l.lu ? l.lu.confiance : 0) + '/' + Math.round(l.lu ? l.lu.mot : 0) + '" data-pire="' + (l.props[0] ? l.props[0].pire : '') + '"' + (l.recherche ? ' disabled' : '') + ' aria-label="La police de « ' + attr(l.texte) + ' »">'
    + (l.recherche ? '<option>Recherche de la police…</option>' : '<option value="-1"' + (l.choix < 0 ? ' selected' : '') + '>Dessin d\'origine</option>'
      + l.props.map((p, j) => '<option value="' + j + '"' + (l.choix === j ? ' selected' : '') + '>' + html_(nomPolice(p)) + ' · ' + Math.round(p.note * 100) + ' %' + (j === 0 ? (l.reconnue ? ' · reconnue' : ' · la plus proche') : '') + '</option>').join(''))
    + '</select>' + curseurGras(l, i) + '</div>').join('')
  const box = r('textes')
  if (box.dataset.dessin !== html) {
    /* Redessinée, la ligne garde la main du clavier (un curseur réglé aux
       flèches, un choix de police). */
    const actif = box.contains(document.activeElement) && document.activeElement.type !== 'text' ? document.activeElement : null
    const cible = actif && '[data-c="' + actif.dataset.c + '"][data-v="' + actif.dataset.v + '"]'
    box.innerHTML = html
    box.dataset.dessin = html
    if (cible) { const el = box.querySelector(cible); if (el) el.focus() }
  }
  box.querySelectorAll('[data-c="gras"]').forEach(el => majGras(el, t.lignes[Number(el.dataset.v)]))
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
  if (document.activeElement !== el && Number(el.value) !== v) el.value = v
  el.style.setProperty('--p', v + '%')
  const out = r('val-gras-' + el.dataset.v)
  const mm = v / 100 * (l.grasMax || 0) * 25.4 / DPI
  if (out) out.textContent = el.disabled ? '' : v ? '+' + mm.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' mm' : 'Aucun'
}
/* LE TEXTE D'UNE LIGNE CORRIGÉ À LA MAIN (« St Morton » → « St Martin ») :
   la recherche se refait sur ce texte-là, imposé ; la meilleure police
   s'applique aussitôt — on l'a demandée. */
async function relireLigne(k, texte) {
  const t = E.textes
  const l = t && t.lignes[k]
  texte = String(texte || '').replace(/\s+/g, ' ').trim()
  if (!l || !texte || texte === l.texte || !t.fil || !texteAJour()) return
  l.texte = texte
  l.main = l.edite = true
  l.recherche = true
  majPolice()
  const textes = [], lectures = []
  textes[l.ligne] = texte
  lectures[l.ligne] = [{ texte, confiance: 100, impose: true }]
  try {
    const r = await t.fil.demander({ type: 'polices', cle: t.cle, textes, lectures })
    if (E.textes !== t) return
    const x = r.lignes[l.ligne]
    if (x && x.props.length) Object.assign(l, { texte: x.texte, props: x.props, ecriture: !!x.ecriture, reconnue: false, choix: 0 })
    else Object.assign(l, { props: [], choix: -1 })
  } catch {
    if (E.textes !== t) return
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
  if (!apercu) finalEnVol++
  majEtat()
  let encore = false
  try {
    const rep = await (apercu ? demander(m) : f.demander(m))
    connu.set(qui, memo)
    if (E.pleine !== p || cleF !== cleFin()) return null
    /* Un aperçu arrivé après le tracé final ne le remplace pas. */
    if (apercu && E.vecteur && !E.vecteur.apercu && E.vecteur.cle === cle && E.vecteur.pleine === p) return E.vecteur
    E.vecteur = { svg: rep.svg, lettres: rep.lettres || '', unie: rep.unie, multi: rep.multi, degrade: rep.degrade, nuances: rep.nuances, cadre: rep.cadre, couleurs: rep.couleurs || [], rgba: rep.image, imageL: rep.imageLargeur, imageH: rep.imageHauteur, noeuds: rep.noeuds, cle, cleFin: cleF, pleine: p, apercu }
    /* Le graphiste ouvre sur Image un logo qui a du modelé (un dégradé,
       une texture : jamais tronqués), sur Vecteur un logo à plat. */
    if (!E.vueChoisie && E.version !== 'detoure') E.version = rep.degrade ? 'image' : 'vecteur'
    /* Une teinte changée qui a disparu du logo (retirée, fondue) s'oublie. */
    const la = new Set(E.vecteur.couleurs.map(c => c.join(',')))
    for (const k of Object.keys(E.recolor)) if (!la.has(k)) delete E.recolor[k]
    if (!apercu) reporterTeintes(p)
    return E.vecteur
  } catch (e) {
    connu.delete(qui)
    /* Le fil a perdu l'image (il a redémarré) : on la lui renvoie. */
    if (e && e.message === 'sans-image' && recu) { encore = true; return RENVOYER }
    if (!(e && e.annule)) toast((e && e.message) || 'La vectorisation a échoué.', 'alerte')
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
  if (t.type !== 'dtf') return null
  const c = COULEURS_DTF.find(([n]) => n === t.nom)
  return c ? hexVersRvb(c[1]) : null
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
  return t.type === 'dtf' ? '-' + t.nom.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[̀-ͯ]/g, '') : ''
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
    etat('Lecture du texte…')
    await texteRegle()
    etat('Tracé final…')
    const v = await vectoriser()
    if (!v) return
    etat('Export…')
    const a = affichage()
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
    etat('Lecture du texte…')
    await texteRegle()
    etat('Détourage…')
    const detouree = await detourePleine()
    if (!detouree) return toast('Le détourage n\'a pas abouti.', 'alerte')
    await repeindre()
    const pleine = avecRepeint(detouree, E.pleine.largeur)
    etat('Export…')
    const img = recadrer(pleine, E.pleine.largeur, E.pleine.hauteur)
    if (!img) return toast('Il ne reste rien : baisse le seuil.', 'alerte')
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

function etat(mot) {
  const t = r('etat')
  if (!t) return
  if (mot) t.textContent = mot
  t.classList.toggle('o-studio-montre', !!mot)
}

/* --------------------------------------------------------- LES RACCOURCIS
   Posés une fois sur la page ; ils ne répondent que quand le studio est à
   l'écran, et pas pendant qu'on tape dans un champ. */
if (typeof document !== 'undefined') {
  const champ = t => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
  document.addEventListener('keydown', e => {
    if (!visible()) return
    const mod = e.ctrlKey || e.metaKey
    const k = e.key.toLowerCase()
    if (mod && k === 's') { e.preventDefault(); return enregistrer('pdf') }
    if (mod && k === 'o') { e.preventDefault(); return r('fichier').click() }
    if (mod || e.altKey || champ(e.target)) return
    if (e.key === 'Escape') { if (E.pop) fermerPop(); else if (E.menu) fermerMenu(); else if (E.split !== null) basculerSplit(); return }
    if (!E.apercu) return
    /* Espace maintenu : le fichier reçu — sauf sur un bouton, qu'il presse. */
    if (e.key === ' ') {
      if (e.target.closest && e.target.closest('button, [role="radio"], [role^="menuitem"]')) return
      e.preventDefault()
      return voirAvant(true)
    }
    if (k === 'd') return changerVersion('detoure')
    if (k === 'v') return changerVersion('vecteur')
    if (k === 'i') return changerVersion('image')
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

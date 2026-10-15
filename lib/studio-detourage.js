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
     l'après ; le fond de l'aperçu (damier, blanc, noir, une couleur) ;
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
   - UN BOUTON : le PDF pour la presse. Les autres formats
     — SVG, PNG, EPS, tout en .zip — dans « Plus » ;
   - AU-DESSUS, UNE BARRE FINE (30 septembre 2026) : le fichier, Annuler,
     Rétablir, l'HISTORIQUE des gestes (lib/historique.js : des photos des
     réglages, jamais des pixels), Changer.
   - DES OUTILS D'ILLUSTRATOR (1er octobre 2026) : un CONTOUR autour du
     logo (le décalage, en mm, d'une couleur du nuancier — Vecteur) ; un
     élément du logo, ou une ligne de texte, RETIRÉ d'un clic sur le plan
     (lib/effacer.js) ;
   - LA TAILLE D'IMPRESSION (1er octobre 2026, lib/taille.js) : en mm, tapée
     ou prise au tableau d'OLDA ; tous les exports y sortent, et ses cotes
     se lisent sur le plan.
   Raccourcis : Ctrl + O ouvrir, Ctrl + V coller, Ctrl + S le PDF, Ctrl + Z
   annuler, Ctrl + Maj + Z et Ctrl + Y rétablir, D, V et I les versions, C
   comparer, R les cotes, Espace maintenu l'avant, 0 tout voir, 1 pour
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
import { svgVersPdf, decoupePdf, dessinPdf, lireSvg, DPI } from './pdf-vectoriel.js'
import { imageVersPdf, deborder } from './pdf-image.js'
import { pngHd } from './png.js'
import { COTE_NETTOYAGE } from './nettoyage.js'
import { recolorer, svgFinal, svgVersEps, nomExport, zip, recadrer } from './export-logo.js'
import { decider, LISSAGE } from './graphiste.js'
import { ecart } from './lab.js'
import { NUANCIER } from './nuancier.js'
import { cmjn as versCmjn } from './cmjn.js'
import { auNuancier, PROCHE } from './controle.js'
import * as H from './historique.js'
import { tailleImprimee, dpiA, mmDit, lireMm } from './taille.js'
import { MARQUE } from './marque.js'
import { lignesDe as lignesFiche, enTeteDe as enTeteFiche, MOTS as MOTS_FICHE, dureeMot, environ } from './fiche.js'
import * as Reserve from './reserve-polices.js'
import { equivalentDe, chercherPolices } from './equivalents.js'
import { effacer, encreSous, encreDe } from './effacer.js'
import { estLettre } from './calques.js'
import { matriceDe, inverse, appliquer, estIdentite, IDENTITE, creuser, anneauOpaque } from './transformer.js'
import { deplacerChemin } from './contour.js'

const APERCU_MAX = D.APERCU_MAX
/* L'ULTRA D'OFFICE (lib/nettoyage.js) : quand le poste la fait en moins
   d'une minute (40 secondes jusqu'au 1er octobre 2026, « encore plus de
   puissance » : un poste moyen y gagne deux ou quatre orientations de
   plus) ; au-delà, le nettoyage, et un bouton qui dit son temps. */
const ULTRA_AUTO = 60000
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
  calcul: { enVol: false, aRefaire: false, cle: '' },
  glisse: null,
  lecture: false,
  /* Le fichier déposé pendant une lecture : il s'ouvre après. */
  suivant: null,
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
  /* LA TAILLE D'IMPRESSION (lib/taille.js) : { cote: 'largeur' | 'hauteur',
     mm }, ou null — 300 dpi des pixels. Elle reste d'un fichier à l'autre
     (les logos d'une même commande) ; un export, pas un geste. `cotes` :
     ses cotes sur le plan, retenues sur ce poste. */
  taille: null,
  cotes: lire('logomaker.cotes', '1') !== '0',
  /* La teinte dont la bulle est ouverte ; le menu « Plus ». */
  pop: null,
  menu: false,
  /* LE NETTOYAGE IA (lib/nettoyage.js) : l'image redessinée nette, ×4 ;
     `original`, l'image d'avant, pour y revenir d'un clic. `ultra` : les
     orientations de l'Ultra en cours (0, le nettoyage) ; `faite`, celles
     de l'image nettoyée ; `estime` : ce que l'Ultra prendrait ici, quand
     le poste ne la tient pas d'office ; `prevu` : ce que prend l'Ultra en
     cours (le temps jaugé dans le fil, ou `estime`) ; `flou` : celui
     qu'elle retire d'abord (« Améliorer la netteté »), en pixels du
     fichier.
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
     texte survolée sur le plan (-1 : aucune) ; `planSurvole` : la souris
     est sur le plan. */
  ligneSurvol: -1,
  planSurvole: false,
  /* LA RÉSERVE DES POLICES (1er octobre 2026, lib/reserve-polices.js) :
     celles de Google, celles du poste (`poste` : 'absent', 'prompt',
     'denied', 'lecture', 'pret', 'erreur' ; `faces`, leurs descriptions ;
     `part`, la lecture qui avance) et celles déposées (`ajouts`) ;
     `catalogue`, toutes les familles, pour la recherche de l'inspecteur
     (`cherche` : la ligne et ce qu'on y tape). */
  reserve: { poste: 'absent', faces: null, ajouts: [], part: 0, catalogue: null },
  cherche: { k: -1, q: '' },
  /* LE CONTOUR (lib/contour.js, Illustrator : Décalage) : son épaisseur
     imprimée (`mm`, 0 sans contour) et sa couleur du nuancier ; en
     Vecteur. */
  contour: { mm: 0, nom: 'Blanc' },
  /* L'INSPECTEUR (12 octobre 2026, voir `majInspecteur`) : il montre la
     sélection (`choix`) ; sans sélection, `point` — l'encre cliquée hors
     de toute forme listée (une miette, une lettre soudée au dessin), en
     fractions de l'image. `inspecteur.defile` : où en étaient les
     réglages du logo, pour y revenir. */
  point: null,
  inspecteur: { defile: 0 },
  /* LES CALQUES (12 octobre 2026, lib/calques.js) : les formes de l'image
     détourée de l'aperçu — avant les retraits à la main —, la forme que
     touche chaque consigne (`consignes` : les retraits et les
     recolorations, dans l'ordre envoyé au fil ; `touchees`, leur forme),
     et la carte des formes listées, pixel par pixel (la souris sur le
     plan). `formeSurvol` : la forme sous la souris, ou dans la liste. */
  calques: null,
  formeSurvol: -1,
  /* LA GOMME (les calques) : l'outil pris (`outil` : 'gomme' ou ''), le
     lasso en train de se tracer ou tracé (`lasso` : ses points à l'écran,
     et `poly`, en fractions, une fois fermé). `comble` : le fond rebouché
     sous chaque lasso (`liste` : les polygones, en fractions — ce que
     l'historique photographie ; `base` : l'image de travail sur laquelle
     ils s'appliquent, avant tout rebouchage ; `enCours`, `part`). */
  outil: '',
  lasso: null,
  comble: { liste: [], base: null, enCours: false, part: 0 },
  /* LES CALQUES DÉPLACÉS (12 octobre 2026, lib/transformer.js) : la
     sélection (`choix` : [{ forme: id } | { ligne: k }]), la prise en
     cours sur le plan (`prise` : son mode, son départ, les entrées du
     moment), son aperçu (`apercuPrise` : le fond sans la sélection, un
     sprite par élément, et la clé des réglages qu'il attend), le cadenas
     des proportions de l'inspecteur. */
  choix: [],
  prise: null,
  apercuPrise: null,
  cadenas: true,
}

/* LE FOND DE L'APERÇU, retenu d'une visite à l'autre sur ce poste. */
function lireFondVue() {
  try {
    const v = JSON.parse(localStorage.getItem('logomaker.fond') || 'null')
    if (v && ['damier', 'blanc', 'noir', 'couleur'].includes(v.type)) return { type: v.type, couleur: /^#[0-9a-f]{6}$/i.test(v.couleur) ? v.couleur : '#c62828' }
  } catch {}
  return { type: 'damier', couleur: '#c62828' }
}
function garderFondVue() {
  garder('logomaker.fond', JSON.stringify(E.fondVue))
}

/* ------------------------------------------------------------ LE FIL DE CALCUL */
/* DES FILS DE RÉSERVE (1er octobre 2026) : en ligne, un fil neuf met une
   demi-seconde à charger ses modules — chacun revalidé auprès du serveur,
   l'un après l'autre (17 ms sur le poste, 0,5 à 0,65 s depuis Railway) —,
   et chaque fichier ouvert en crée (le détourage pleine taille, le
   tracé) : le calcul l'attendait. Deux fils chargés attendent leur tour ;
   un fil pris, un autre se charge, au repos. Un fil de réserve qui n'a pas
   pu charger ses modules ne sert pas : on en crée un neuf, dont l'échec
   se verra (`onerror`). */
const MODULE_FIL = new URL('./detourage-travail.js', import.meta.url)
const RESERVE_FILS = 2
const filsPrets = []
let reserveEnVue = false
function nouveauFil() {
  let w = null
  while (!w && filsPrets.length) { const f = filsPrets.shift(); if (f.ko) f.w.terminate(); else w = f.w }
  if (w) w.onerror = null
  else w = new Worker(MODULE_FIL, { type: 'module' })
  remplirReserve()
  return w
}
function remplirReserve() {
  if (reserveEnVue || typeof Worker === 'undefined') return
  reserveEnVue = true
  const lancer = () => {
    reserveEnVue = false
    while (filsPrets.length < RESERVE_FILS) {
      let f
      try { f = { w: new Worker(MODULE_FIL, { type: 'module' }), ko: false } } catch { return }
      f.w.onerror = () => { f.ko = true }
      filsPrets.push(f)
    }
  }
  if (typeof requestIdleCallback === 'function') requestIdleCallback(lancer, { timeout: 2000 })
  else setTimeout(lancer, 500)
}

let fil = null
let filKo = false
let numero = 0
const attentes = new Map()
const memoireLocale = {}

function ouvrirFil() {
  if (fil || filKo) return fil
  try {
    fil = nouveauFil()
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
    f.postMessage(Object.assign({}, message, { id }))
  })
}

/* UN FIL À SOI, pour un long calcul (l'IA, le détourage de l'image
   pleine, le vecteur) : le fil de l'aperçu reste libre, et le calcul
   s'annule d'un coup (`fermer`) quand un autre fichier arrive. Sans Worker
   de module, le calcul se fait dans la page. */
/* `fournir(source, cle)` : les octets d'une police de la réserve, que le
   fil demande (`besoin`) quand il lui en faut une (lib/reserve-polices.js,
   `octets`). */
function filDedie(fournir = null) {
  let w = null
  try { w = nouveauFil() } catch {}
  const memoire = {}
  const dansLaPage = (m, progres) => import('./detourage-travail.js').then(mod => { if (fournir) mod.fournirPolices(fournir); return mod.traiter(m, memoire, progres) }).then(r => r.reponse || {})
  let n = 0
  const attente = new Map()
  if (w) {
    w.onmessage = e => {
      if (e.data.besoin) {
        const { source, cle } = e.data.besoin, ici = w
        Promise.resolve(fournir ? fournir(source, cle) : null).catch(() => null).then(o => { if (ici === w) w.postMessage({ type: 'fourni', n: e.data.n, octets: o }, o ? [o] : []) })
        return
      }
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
    demander(m, progres = () => {}, transfert = []) {
      if (!w) return dansLaPage(m, progres)
      return new Promise((ok, ko) => {
        const id = ++n
        attente.set(id, { ok, ko, m, progres })
        w.postMessage(Object.assign({}, m, { id }), transfert)
      })
    },
    /* Un calcul en cours : le fermer l'annulerait. */
    occupe: () => attente.size > 0,
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

/* LE FIL DU VECTEUR (quelques secondes) : un tracé devenu inutile se
   coupe net (`vectoriser`). `connu` : le détourage que ce fil a déjà
   reçu — l'image ne retraverse pas. */
let filVect = null
let finalEnVol = 0
const connu = new Map()
function vecteurFil() {
  if (!filVect) { filVect = filDedie(); connu.delete('final') }
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
    + '      <label role="radio" data-a="fond" data-v="couleur" title="Couleur de fond" aria-label="Couleur de fond"><i class="o-studio-pastille" data-p="couleur" data-r="pastille-couleur"></i><input type="color" data-c="fond-couleur"></label>'
    + '    </div>'
    + '    <span class="o-studio-sep" aria-hidden="true"></span>'
    + '    <button type="button" class="o-studio-outil o-studio-carre" data-a="cotes" aria-pressed="false" aria-label="Cotes" title="Les cotes du logo, à sa taille d\'impression (R)">' + ic('ruler') + '</button>'
    + '    <button type="button" class="o-studio-outil" data-a="gomme" aria-pressed="false" title="La gomme : un lasso autour de ce qui doit partir — retiré, ou le fond rebouché dessous (G)">' + ic('lasso') + '<span>Gomme</span></button>'
    + '    <button type="button" class="o-studio-outil" data-a="split" aria-pressed="false" title="Le fichier reçu sous le vecteur (C) — Espace maintenu : l\'avant seul">' + ic('columns-2') + '<span>Comparer</span></button>'
    + '    <button type="button" class="o-studio-outil" data-a="ajuster" title="Tout voir (0) · double-clic">' + ic('scan') + '<span data-r="zoom">100 %</span></button>'
    + '  </div>'
    + '  <div class="o-studio-toast" data-r="toast" role="status" aria-live="polite"></div>'
    + '  <div class="o-studio-pop o-studio-pop-lasso" data-r="pop-lasso" hidden></div>'
    + '  <input type="file" data-r="fichier" accept="image/*,.pdf,.ai,.svg,.heic,.heif,.tif,.tiff" hidden>'
    + '</div>'
    + '<aside class="o-studio-panneau">'
    + '  <div class="o-studio-defile">'
    + '    <section class="o-studio-bloc" data-besoin="image">'
    + ligne('sparkles', '<b>Améliorer l\'image</b>', 'nettoyer', 'Améliorer l\'image', 'ia-etat')
    + ligne('focus', '<b>Améliorer la netteté</b>', 'net', 'Améliorer la netteté', 'net-etat')
    + '      <button type="button" class="o-studio-bouton o-studio-discret" data-a="ultra" data-r="ultra" hidden title="Le modèle haut de gamme, passé huit fois : des bords plus fidèles — plus long sur ce poste">' + ic('wand-sparkles') + '<span data-r="ultra-mot"></span></button>'
    + '    </section>'
    + '    <section class="o-studio-bloc" data-besoin="image">'
    + '      <div class="o-studio-bloc-tete"><b>Fond</b><span data-r="res-fond"></span></div>'
    + '      <div class="o-studio-segment" role="radiogroup" aria-label="Le fond à retirer">'
    + '        <button type="button" role="radio" data-a="fond-retire" data-v="autour" title="Le fond autour du logo, et dans les lettres posées dehors">Autour</button>'
    + '        <button type="button" role="radio" data-a="fond-retire" data-v="partout" title="Le fond partout, même dans les lettres et les cercles">Partout</button>'
    + '        <button type="button" role="radio" data-a="fond-retire" data-v="sujet" title="Le sujet d\'une photo, trouvé par l\'IA">' + ic('sparkles') + 'Sujet</button>'
    + '        <button type="button" role="radio" data-a="fond-retire" data-v="entier" title="Le fond reste : une pochette d\'album, une affiche, une photo gardée entière — l\'image telle quelle, seulement améliorée">Entier</button>'
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
    + '    <section class="o-studio-bloc" data-besoin="image" data-trace data-r="bloc-contour">'
    + '      <div class="o-studio-bloc-tete"><b>Contour</b><span data-r="res-contour"></span></div>'
    + curseur('contour', 'Épaisseur', 0, 50, 0)
    + '      <div class="o-studio-pastilles" role="radiogroup" aria-label="Couleur du contour" data-r="contour-couleurs" hidden>'
    + NUANCIER.map(c => '<button type="button" role="radio" data-a="contour-couleur" data-v="' + c.nom + '"' + pastille(c.rvb) + '><i style="background:' + rvbHex(c.rvb) + '"></i></button>').join('')
    + '      </div>'
    + '    </section>'
    + '    <section class="o-studio-bloc" data-besoin="image" data-r="bloc-police" hidden>'
    + '      <div class="o-studio-bloc-tete"><b>Calques</b><span data-r="res-police"></span></div>'
    + '      <div class="o-studio-textes" data-r="textes"></div>'
    + '      <div class="o-studio-textes" data-r="formes"></div>'
    + '      <div class="o-studio-reserve"><span class="o-studio-reserve-dit" data-r="reserve-dit"></span>'
    + '        <button type="button" class="o-studio-lien" data-a="poste" data-r="poste" hidden><span data-r="poste-mot">Polices du poste</span></button>'
    + '        <button type="button" class="o-studio-lien" data-a="ajouter-police" title="Une police à reconnaître (TTF, OTF, WOFF ou TTC), gardée sur ce poste — ou lâchez son fichier sur le plan">' + ic('plus') + '<span>Ajouter</span></button></div>'
    + '      <input type="file" data-r="fichier-police" accept=".ttf,.otf,.woff,.woff2,.ttc" multiple hidden>'
    + '    </section>'
    + '  </div>'
    + '  <div class="o-studio-inspecteur" data-r="inspecteur" tabindex="-1" aria-label="L\'élément choisi" hidden></div>'
    + '  <footer class="o-studio-pied" data-besoin="image">'
    + gabaritTaille()
    + '    <div class="o-studio-pied-boutons">'
    + '    <button type="button" class="o-studio-bouton o-studio-plein o-studio-telecharger" data-a="enregistrer" data-v="pdf" title="Le PDF vectoriel pour la presse (Ctrl S)"><span class="o-studio-ic-dl">' + ic('download') + '</span><span class="o-studio-ic-ok">' + ic('check') + '</span><span data-r="enregistrer-mot">Télécharger le PDF</span></button>'
    + '    <button type="button" class="o-studio-bouton o-studio-plus" data-a="menu" aria-haspopup="menu" aria-expanded="false" title="Les autres formats"><span>Plus</span>' + ic('chevron-down') + '</button>'
    + '    </div>'
    + '    <div class="o-studio-menu" data-r="menu" role="menu" hidden>'
    + '      <div class="o-studio-menu-titre">Autres formats</div>'
    + '<div data-trace>' + article('enregistrer', 'svg', 'SVG', 'vectoriel, en mm') + '</div>'
    + article('enregistrer', 'png', 'PNG', 'à la taille d\'impression, fond transparent')
    + '<div data-trace>' + article('enregistrer', 'eps', 'EPS', 'Illustrator, CorelDRAW') + '</div>'
    + article('enregistrer', 'kit', 'Tout', 'PDF · SVG · PNG · EPS, en .zip')
    + '    </div>'
    + '  </footer>'
    + '  <div class="o-studio-pop" data-r="pop" hidden></div>'
    + '</aside>'
    + '<div class="o-studio-infobulle" data-r="infobulle" role="tooltip" hidden></div>'
}

/* LA TAILLE D'IMPRESSION : la largeur ou la hauteur tapée en mm, l'autre
   côté suit ; sans choix, 300 dpi des pixels (« Taille du fichier »). */
function gabaritTaille() {
  const champ = (cote, lettre, mot) => '<label class="o-studio-taille-champ" title="' + mot + ' imprimée"><span>' + lettre + '</span>'
    + '<input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" data-c="taille-' + cote + '" aria-label="' + mot + ' imprimée, en millimètres"><small>mm</small></label>'
  return '<div class="o-studio-taille">'
    + '<div class="o-studio-taille-tete"><b>Taille d\'impression</b>'
    + '<button type="button" class="o-studio-lien" data-a="taille-fichier" data-r="taille-fichier" title="Revenir à 300 dpi des pixels du fichier" hidden>Taille du fichier</button>'
    + '<span class="o-studio-taille-auto" data-r="taille-auto">300 dpi du fichier</span></div>'
    + '<div class="o-studio-taille-champs">' + champ('largeur', 'L', 'Largeur') + '<span class="o-studio-taille-fois" aria-hidden="true">×</span>' + champ('hauteur', 'H', 'Hauteur') + '</div>'
    + '<small class="o-studio-taille-note" data-r="taille-note" hidden></small>'
    + '</div>'
}

/* LA BARRE (30 septembre 2026) : la marque, le fichier et ses dimensions
   (sortis de l'en-tête du panneau), puis Annuler, Rétablir, l'historique
   des gestes et Changer. */
function gabaritBarre() {
  return ''
    + '<div class="o-studio-marque"><b>' + MARQUE + '</b></div>'
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
  /* Pour les bancs (un Chrome Playwright) : l'état du studio et la
     géométrie de ses éléments, sans rien changer à la page. */
  hote.studio = { E, elementDe, formesListees, coinsElement: ref => { const el = elementDe(ref); return el ? coinsElement(el) : null }, cleFin, ligneInspectee, elementInspecte }
  if (!barre) { barre = document.createElement('header'); hote.before(barre) }
  barre.classList.add('o-studio-barre')
  barre.innerHTML = gabaritBarre()
  E.barre = barre
  const scene = r('scene')
  const toile = r('toile')

  hote.addEventListener('click', clic)
  barre.addEventListener('click', clic)
  /* L'infobulle des couleurs : au survol, et au clavier. */
  hote.addEventListener('pointerover', e => {
    bulle(e.target.closest('[data-rvb]'))
    const f = e.target.closest('[data-a="forme"]')
    if (f) survolerForme(Number(f.dataset.v))
  })
  hote.addEventListener('pointerout', e => { if (e.target.closest('[data-a="forme"]') && !E.racine.querySelector('[data-r="toile"]').matches(':hover')) survolerForme(-1) })
  hote.addEventListener('pointerleave', () => bulle(null))
  hote.addEventListener('pointerdown', () => bulle(null))
  hote.addEventListener('focusin', e => bulle(e.target.matches('[data-rvb]:focus-visible') ? e.target : null))
  hote.addEventListener('focusout', () => bulle(null))
  hote.addEventListener('change', e => {
    const c = e.target.dataset.c
    /* Le curseur lâché : le tracé final, à la pleine taille — et un seul
       geste dans l'historique, du début à la fin du glissé. */
    if (c === 'lissage' || c === 'nuances') { planifierVecteur(0); return finirGeste() }
    if (c === 'seuil' || c === 'contour') {
      finirGeste()
      /* Le seuil lâché : les calques, qui n'ont pas suivi le curseur. */
      if (c === 'seuil' && E.apercu && !E.calques) recalculer()
      return
    }
    /* LA TAILLE D'IMPRESSION : un côté tapé, validé — vidé, le logo revient
       à la taille du fichier. */
    if (c === 'taille-largeur' || c === 'taille-hauteur') {
      const mm = lireMm(e.target.value)
      return choisirTaille(!e.target.value.trim() ? null : mm ? { cote: c.slice(7), mm } : E.taille)
    }
    /* Le texte d'une ligne corrigé (validé ou quitté). */
    if (c === 'texte-ligne' && E.textes) return geste(() => relireLigne(Number(e.target.dataset.v), e.target.value))
    /* La géométrie d'un élément tapée (les calques déplacés). */
    if (c && c.startsWith('geo-')) { e.target.blur(); return geometrieTapee(c.slice(4), e.target.value) }
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
    /* LE CONTOUR : son épaisseur suit la main, il se trace au repos. */
    if (c === 'contour') {
      E.contour = Object.assign({}, E.contour, { mm: Number(e.target.value) / 10 })
      majContour()
      planifierContour()
      return dessiner()
    }
    /* LA RECHERCHE D'UNE POLICE PAR SON NOM, lettre à lettre. */
    if (c === 'cherche-police') {
      E.cherche = { k: Number(e.target.dataset.v), q: e.target.value }
      return majRecherche()
    }
    /* Un côté qu'on tape : l'autre et les cotes suivent, le champ reste à
       la main. */
    if (c === 'taille-largeur' || c === 'taille-hauteur') {
      const mm = lireMm(e.target.value)
      if (mm) { E.taille = { cote: c.slice(7), mm }; majTaille(); dessiner() }
      return
    }
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
  r('fichier-police').addEventListener('change', e => {
    const f = [...(e.target.files || [])]
    e.target.value = ''
    ajouterPolices(f)
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
    /* Des fichiers de police : ils rejoignent la réserve. */
    const polices = [...e.dataTransfer.files].filter(x => POLICE_FICHIER.test(x.name))
    if (polices.length) return ajouterPolices(polices)
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
    /* Le bouton gauche seulement : un clic droit n'ouvre pas « Retirer cet
       élément ». */
    if (!E.apercu || e.button !== 0) return
    try { toile.setPointerCapture(e.pointerId) } catch {}
    /* LA GOMME : le lasso part d'ici. */
    if (E.outil === 'gomme') {
      const b = toile.getBoundingClientRect()
      fermerPopLasso()
      E.lasso = { pts: [[e.clientX - b.left, e.clientY - b.top]], poly: null }
      return dessiner()
    }
    /* UN ÉLÉMENT OU UNE POIGNÉE sous la souris : la prise (les calques
       déplacés) — le geste commence à trois pixels, sinon c'est un clic. */
    const b = toile.getBoundingClientRect()
    nGlisse++
    if (prendre(e.clientX - b.left, e.clientY - b.top, e)) { fermerPop(); fermerMenu(); fermerHistorique(); return dessiner() }
    viderChoix()
    E.glisse = { x: e.clientX, y: e.clientY, ox: E.vue.ox, oy: E.vue.oy, bouge: false }
    scene.classList.add('o-studio-saisi')
    fermerPop()
    fermerMenu()
    fermerHistorique()
  })
  toile.addEventListener('pointermove', e => {
    const g = E.glisse
    if (E.lasso && !E.lasso.poly) {
      const b = toile.getBoundingClientRect(), pts = E.lasso.pts, d = pts[pts.length - 1]
      const x = e.clientX - b.left, y = e.clientY - b.top
      if (Math.abs(x - d[0]) + Math.abs(y - d[1]) >= 2) { pts.push([x, y]); dessiner() }
      return
    }
    /* LA PRISE (les calques déplacés) : à trois pixels le geste commence,
       puis la sélection suit la souris. */
    if (E.prise) {
      const p = E.prise, b = toile.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top
      if (!p.bouge) { if (Math.abs(x - p.x) + Math.abs(y - p.y) <= 3 || !commencerPrise()) return }
      p.souris = [x, y]
      suivrePrise(x, y, e)
      return dessiner()
    }
    if (!g) {
      /* LA SOURIS SUR UN TEXTE DU LOGO : la ligne se signale, un clic
         ouvre sa police (voir `majPolice`) ; sur une poignée de la
         sélection, le curseur dit le geste. */
      const b = toile.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top
      const entre = !E.planSurvole
      E.planSurvole = true
      const poignee = E.choix.length ? poigneeSous(x, y) : null
      if (poignee) { survolerLigne(-1, entre); survolerForme(-1); toile.style.cursor = curseurPoignee(cadreChoix(), poignee); return }
      const k = ligneSous(x, y)
      survolerLigne(k, entre)
      const sous = k < 0 ? elementSous(x, y) : null
      const id = sous && sous.forme !== undefined ? sous.forme : -1
      if (id >= 0 || k >= 0) toile.style.cursor = choisi(k >= 0 ? { ligne: k } : { forme: id }) ? 'move' : 'pointer'
      survolerForme(id)
      return
    }
    if (Math.abs(e.clientX - g.x) + Math.abs(e.clientY - g.y) > 3) g.bouge = true
    E.vue.ox = g.ox + e.clientX - g.x
    E.vue.oy = g.oy + e.clientY - g.y
    E.vue.ajuste = false
    dessiner()
  })
  const lache = e => {
    if (E.lasso && !E.lasso.poly) return fermerLasso(e.type === 'pointerup')
    /* LA PRISE LÂCHÉE : un geste fini, ou un clic — l'élément est déjà
       choisi (`prendre`), l'inspecteur le montre. */
    if (E.prise) {
      const p = E.prise
      /* Un pointeur annulé (la fenêtre qui perd la main) ne valide pas
         un geste à moitié fait. */
      if (p.bouge && e.type !== 'pointerup') return annulerPrise()
      if (p.bouge) return finirPrise()
      E.prise = null
      return dessiner()
    }
    const g = E.glisse
    E.glisse = null
    scene.classList.remove('o-studio-saisi')
    /* Un clic sans glisser, hors de tout élément : l'encre sous le point
       (une miette, une lettre soudée au dessin), ou rien. */
    if (g && !g.bouge && e.type === 'pointerup') {
      const b = toile.getBoundingClientRect()
      ouvrirElement(e.clientX - b.left, e.clientY - b.top)
    }
  }
  toile.addEventListener('pointerup', lache)
  toile.addEventListener('pointercancel', lache)
  toile.addEventListener('pointerleave', () => { const sort = E.planSurvole; E.planSurvole = false; survolerLigne(-1, sort); survolerForme(-1) })
  toile.addEventListener('dblclick', () => { ajuster(); dessiner() })
  toile.addEventListener('wheel', e => {
    if (!E.apercu) return
    e.preventDefault()
    nGlisse++
    /* Un lasso fermé est dessiné à l'écran : le plan qui bouge le défait. */
    if (E.lasso && E.lasso.poly) annulerLasso()
    const b = toile.getBoundingClientRect()
    zoomer(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022)), e.clientX - b.left, e.clientY - b.top)
  }, { passive: false })

  new ResizeObserver(() => { dimensionner(); if (E.vue.ajuste) ajuster(); dessiner() }).observe(scene)

  dimensionner()
  majPanneau()
  if (E.apercu) ajuster()
  dessiner()
  /* Les polices du poste déjà prêtées, et celles déposées ; puis, au
     repos, le fil du texte se prépare (sa lecture, l'index des polices) —
     et des fils de réserve se chargent (`nouveauFil`). */
  remplirReserve()
  chargerReserve(false).finally(() => {
    const prechauffer = () => { if (!E.apercu || !E.textes) filDuTexte().envoyer({ type: 'prechauffer' }) }
    if (typeof requestIdleCallback === 'function') requestIdleCallback(prechauffer, { timeout: 3000 })
    else setTimeout(prechauffer, 1500)
  })
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
  /* Un fichier déposé pendant la lecture du précédent attend son tour (le
     dernier gagne) : il était ignoré sans un mot. */
  if (E.lecture) { E.suivant = fichier; return }
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
    E.contour = { mm: 0, nom: E.contour.nom }
    E.comble = { liste: [], base: null, enCours: false, part: 0 }
    E.outil = ''
    E.choix = []
    E.point = null
    E.prise = null
    E.apercuPrise = null
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
       ses garde-fous, jamais tracés. « Améliorer l'image », décochée,
       ramène le fichier reçu. */
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
    const suivant = E.suivant
    E.suivant = null
    if (suivant) charger(suivant)
  }
}

const typeDe = f => {
  const ext = String(f.name || '').split('.').pop().toUpperCase()
  if (/^(JPE?G|PNG|WEBP|HEIC|HEIF|TIFF?|PDF|SVG|AI|GIF|BMP)$/.test(ext)) return ext === 'JPG' ? 'JPEG' : ext === 'TIF' ? 'TIFF' : ext === 'WEBP' ? 'WebP' : ext
  return (String(f.type || '').split('/')[1] || 'image').toUpperCase()
}

/* CE QUI A ÉTÉ CHOISI À LA MAIN, à reporter sur une autre image du même
   fichier (30 septembre 2026 : « Améliorer l'image » décochée effaçait
   les teintes changées et les polices choisies). Les teintes, par leur
   couleur ; les polices, par la place de leur ligne dans l'image (de 0 à
   1 : l'IA l'agrandit quatre fois). */
const placeLigne = (l, t) => {
  const b = l.boite, W = t.largeur * t.f, H = t.hauteur * t.f
  return { cx: (b[0] + b[2]) / 2 / W, cy: (b[1] + b[3]) / 2 / H, h: (b[3] - b[1] + 1) / H, w: (b[2] - b[0] + 1) / W }
}
/* LA MÊME LIGNE, d'une image à l'autre : son centre à moins de 0,45
   hauteur et 0,25 largeur (12 octobre 2026, les calques déplacés : à 0,6
   hauteur, deux lignes empilées — « I'M HIS » sur « FAVORITE EX » — se
   prenaient l'une pour l'autre). Une place sans largeur (d'avant) garde
   l'ancienne règle. */
const memeLigne = (p, e) => !!e && (p.w && e.w
  ? Math.abs(p.cy - e.cy) < 0.45 * Math.max(p.h, e.h) && Math.abs(p.cx - e.cx) < 0.25 * Math.max(p.w, e.w)
  : Math.hypot(p.cx - e.cx, p.cy - e.cy) < 0.6 * Math.max(p.h, e.h))
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
    return Object.assign(placeLigne(l, t), { texte: l.texte, edite: !!l.edite, gras: l.gras || 0, couleur: l.couleur || null, police: p ? Object.assign({}, p) : null })
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
    l.couleur = a.couleur || null
    if (a.edite && a.texte !== l.texte) { relire.push([k, a.texte]); continue }
    if (!a.police) { l.choix = -1; continue }
    const j = l.props.findIndex(p => memePolice(p, a.police))
    if (j >= 0) l.choix = j
    /* Une police cherchée par son nom n'est pas parmi celles proposées à
       la nouvelle image : elle les rejoint. */
    else if (a.police.cherchee) { l.props = l.props.concat([a.police]); l.choix = l.props.length - 1 }
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
  /* Le même fichier, une autre image (« Améliorer l'image » cochée ou
     décochée, « Passer en Ultra ») : ce qui a été choisi à la main s'y
     reporte (`reporterTeintes`, `reporterPolices`). Un autre fichier
     repart de rien. */
  const report = E.pleine && pleine !== E.pleine && E.chargement === E.chargementPleine ? choixAReporter() : null
  if (E.ia.enCours) fermerIA()
  E.ia = { n: E.ia.n + 1, enCours: false, pose: false, etape: '', part: 0, moteur: E.ia.moteur, masque: null, cote: 0, modele: '', cle: E.ia.cle + 1, duree: 0, erreur: '' }
  E.pleine = { data: pleine.data, largeur: pleine.largeur, hauteur: pleine.hauteur, n: ++nPleine }
  E.chargementPleine = E.chargement
  /* Une autre image que celle des rebouchages (l'IA, l'original revenu, un
     fichier) : ils se rejoueront sur elle (`comblerImage`, par qui l'appelle). */
  if (!E.comblant) { nComble++; E.comble = { liste: E.comble.liste, base: null, enCours: false, part: 0 } }
  E.lasso = null
  fermerPopLasso()
  E.report = report && Object.assign(report, { pleine: E.pleine })
  /* Les teintes se relisent sur la nouvelle image (leurs couleurs y
     bougent un peu) : ce qu'on y avait changé s'y reporte quand son tracé
     arrive. */
  E.sans = []
  E.recolor = {}
  fermerPop()
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
   travail ; « Améliorer l'image », décochée, ramène l'originale. Une
   matière passe à l'IA des photos (lib/graphiste.js, `matiere`).
   30 septembre 2026 : un logo à plat passe en ULTRA (une matière aussi
   depuis le 1er octobre 2026), quand le poste la
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
     l'image reçue a pu y passer avant elle ; `netFait` : « Améliorer la
     netteté » a fini, dans cette passe. */
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
    /* Les rebouchages de la photo, sur l'image nette. */
    if (E.comble.liste.length) comblerImage(E.comble.liste)
  }).catch(e => {
    if (e && e.annule) return
    const mot = (e && e.message) || 'erreur inconnue.'
    const id = E.nettoyage.etape === 'nettete' ? 'net' : 'ia'
    /* L'IA tombée avant « Améliorer la netteté » : elle n'a pas tourné,
       elle ne s'affiche pas. */
    if (id === 'ia' && !E.nettoyage.netFait && prep) prep.vues.delete('net')
    echouer(id, mot, 'L\'amélioration de l\'image n\'a pas pu se faire : ' + mot)
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
  /* L'image nettoyée d'avant reste : « Améliorer la netteté » redit ce
     qu'elle a reçu, pas ce que voulait le calcul arrêté. */
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
  /* Le fond gardé d'office (le sujet était toute l'image) le reste. */
  if (E.decision && E.decision.entier) Object.assign(recu, { fond: 'entier', entier: true })
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
  if (E.comble.liste.length) comblerImage(E.comble.liste)
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
  E.calques = null
  E.formeSurvol = -1
  E.fondsLus = []
  E.vecteur = null
  E.repeint = null
  /* Le tracé de l'image d'avant ne sert plus : il se coupe, celui de
     celle-ci part dès que son détourage se pose. */
  if (filVect && finalEnVol) { filVect.fermer(); filVect = null }
  else if (filVect) filVect.envoyer({ type: 'oublier' })
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
  /* BiRefNet exigé mais absent, et Sujet cliqué entre-temps : ISNet fait
     l'affaire, il se relance (le sujet restait « en attente »). */
  let relancer = false
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
      else if (E.methode === 'ia') relancer = true
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
    if (relancer) return lancerIA()
    reposerIA()
    majPanneau()
    dessiner()
  })
}

/* -------------------------------------------------------------- LE CALCUL */
/* Le message d'un détourage, à la couleur ou par le sujet. */
/* La part de l'image que le sujet garde (son alpha), au seizième de
   pixel. */
const ENTIER_AUTO = 0.95
function couverture(data) {
  let n = 0, k = 0
  for (let i = 3; i < data.length; i += 64) { n++; if (data[i] >= 128) k++ }
  return n ? k / n : 0
}
function messageCalcul(echelle, consignes = null) {
  const m = { type: 'calcul', methode: E.methode, reglages: Object.assign({}, reglagesCalcul()), echelle }
  if (E.methode === 'ia') Object.assign(m, { masque: E.ia.masque, cote: E.ia.cote, modele: E.ia.modele, cle: E.ia.cle })
  if (consignes) Object.assign(m, { calques: true, consignes: consignes.map(c => ({ u: c.u, v: c.v, aire: c.aire })) })
  return m
}
/* LES CONSIGNES QUI TOUCHENT UNE FORME : chaque retrait d'un point et
   chaque recoloration (lib/calques.js leur trouve leur forme). */
function consignesCalques() {
  const e = (E.reglages.effaces || []).filter(x => x.u !== undefined && !x.cadre && !x.combler).map(x => ({ u: x.u, v: x.v, aire: x.aire, src: 'e', ref: x }))
  const t = (E.reglages.teintesElements || []).map(x => ({ u: x.u, v: x.v, aire: x.aire, src: 't', ref: x }))
  /* Les éléments déplacés (les calques déplacés), par leur point. */
  const x = transformationsDe().filter(e => e.u !== undefined).map(e => ({ u: e.u, v: e.v, aire: e.aire, src: 'x', ref: e }))
  return e.concat(t).concat(x)
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
  /* Les calques (les formes du dessin) : pas sous un curseur qu'on tient —
     le seuil lâché les redemande (`change`). */
  const consignes = E.tenu ? null : consignesCalques()
  const cleEnvoyee = cleFin()
  c.cle = cleEnvoyee
  demander(messageCalcul(E.apercu.echelle, consignes), evenement).then(rep => {
    if (!E.apercu || E.apercu.data !== source || methode !== E.methode || (methode === 'ia' && cleIA !== E.ia.cle)) return
    /* L'aperçu d'un geste fini part avec l'image qui le contient — ou la
       dernière demandée (Annuler l'a remplacée). */
    if (E.apercuPrise && !E.prise && (E.apercuPrise.cle === cleEnvoyee || !c.aRefaire)) E.apercuPrise = null
    E.fondsLus = rep.fonds || []
    const choisies = E.choix.map(ref => ref.forme !== undefined ? { id: ref.forme, f: formeDe(ref.forme) } : null)
    E.calques = rep.formes ? { pleine: E.pleine, formes: rep.formes, touchees: rep.touchees || [], carte: rep.carte, largeur: l, hauteur: h, consignes } : null
    /* Les rangs des formes ont pu changer (le seuil, le fond) : une forme
       choisie qui n'a plus le même cadre sort de la sélection — et de
       l'inspecteur. */
    E.choix = E.choix.filter((ref, i) => { const c0 = choisies[i]; if (!c0) return true; const f = formeDe(c0.id); return !!(f && c0.f && JSON.stringify(f.cadre) === JSON.stringify(c0.f.cadre)) })
    if (E.formeSurvol >= 0 && !formeListee(E.formeSurvol)) E.formeSurvol = -1
    if (methode === 'ia') E.ia.pose = false
    /* LE FOND GARDÉ D'OFFICE (12 octobre 2026) : le sujet que l'IA trouve
       est toute l'image (`ENTIER_AUTO` de ses pixels au moins) — rien à
       retirer, l'image reste entière, ses bords intacts. Tant que la
       vendeuse n'a pas choisi le fond ; « Sujet » d'un clic la ramène. */
    if (methode === 'ia' && !E.fondChoisi && E.decision && E.decision.fond === 'ia' && couverture(rep.data) >= ENTIER_AUTO) {
      E.decision = Object.assign({}, E.decision, { fond: 'entier', entier: true })
      E.methode = 'entier'
      c.aRefaire = true
      majPanneau()
      return
    }
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
const cleFin = () => JSON.stringify([E.methode, reglagesCalcul(), E.methode === 'ia' ? E.ia.cle : 0])
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
  dessinerCotes(ctx)
  dessinerLignes(ctx)
  dessinerFormes(ctx)
  dessinerSelection(ctx)
  dessinerLasso(ctx)
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
  /* L'aperçu d'un geste (les calques déplacés) : le temps du geste, et
     jusqu'à l'image calculée qui le contient. */
  if (E.apercuPrise) return dessinerApercuPrise(ctx)
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

/* ------------------------------------------------- LA TAILLE D'IMPRESSION
   (1er octobre 2026, « pouvoir choisir la taille ») */
/* LE CADRE DU LOGO, en pixels de l'image pleine : celui du tracé à
   l'écran, sinon l'encre du détourage (l'aperçu, ramené à l'image pleine
   — l'export, lui, recadre l'image pleine au pixel). */
const cadres = new WeakMap()
function cadreLogo() {
  if (!E.apercu) return null
  if (E.version !== 'detoure' && vecteurMontre()) { const a = affichage(); return (a && a.cadre) || E.vecteur.cadre }
  const img = E.resultatImage
  if (!img) return null
  if (!cadres.has(img)) {
    const { data, width: l, height: h } = img
    let x0 = l, y0 = h, x1 = -1, y1 = -1
    for (let y = 0; y < h; y++) {
      const o = y * l * 4
      for (let x = 0; x < l; x++) {
        if (!data[o + x * 4 + 3]) continue
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        y1 = y
      }
    }
    const k = 1 / E.apercu.echelle
    cadres.set(img, x1 < 0 ? null : { x: x0 * k, y: y0 * k, largeur: (x1 - x0 + 1) * k, hauteur: (y1 - y0 + 1) * k })
  }
  return cadres.get(img)
}
/* La taille imprimée du logo à l'écran (lib/taille.js). */
function tailleLogo() {
  const c = cadreLogo()
  return c ? tailleImprimee(c.largeur, c.hauteur, E.taille) : null
}
/* Des millimètres imprimés par pixel de l'image pleine. */
function mmParPx() {
  const c = cadreLogo(), t = tailleLogo()
  return c && t ? t.l / c.largeur : 25.4 / DPI
}
/* UN CÔTÉ IMPRIMÉ, dit pareil partout (champ, cote, nom) : celui qu'on a
   tapé tel quel (« 95,5 »), l'autre au millimètre. */
const coteDit = (t, cote) => E.taille && E.taille.cote === cote ? mmDit(E.taille.mm) : String(Math.round(cote === 'largeur' ? t.l : t.h))
/* « -280x322mm » à la fin du nom d'un export à la taille choisie. */
const tailleNom = t => t && !t.auto ? '-' + coteDit(t, 'largeur') + 'x' + coteDit(t, 'hauteur') + 'mm' : ''

function choisirTaille(choix) {
  E.taille = choix && choix.mm > 0 ? { cote: choix.cote === 'hauteur' ? 'hauteur' : 'largeur', mm: choix.mm } : null
  majTaille(true)
  planifierContour()
  dessiner()
}

/* LE BLOC DE LA TAILLE : les deux côtés (gris tant que c'est la taille du
   fichier), le préréglage, et la résolution d'une image trop juste pour
   cette taille — un tracé, lui, est net à toutes. Un champ qu'on tape
   garde sa saisie (`force` : on vient de la valider). */
function majTaille(force = false) {
  const R = E.racine
  if (!R) return
  const c = cadreLogo()
  const t = tailleLogo()
  for (const cote of ['largeur', 'hauteur']) {
    const el = R.querySelector('[data-c="taille-' + cote + '"]')
    if (!el || (!force && document.activeElement === el)) continue
    const v = t ? coteDit(t, cote) : E.taille && E.taille.cote === cote ? mmDit(E.taille.mm) : ''
    if (el.value !== v) el.value = v
    el.classList.toggle('o-studio-auto', !E.taille)
  }
  r('taille-fichier').hidden = !E.taille
  r('taille-auto').hidden = !!E.taille
  const note = r('taille-note')
  let mot = ''
  if (t && c && E.version !== 'vecteur') {
    const dpi = dpiA(c.largeur, t.l)
    if (dpi < 200) mot = '≈ ' + Math.round(dpi) + ' dpi à cette taille' + (E.version === 'detoure' ? ' : le Vecteur y reste net' : '')
  }
  if (note.textContent !== mot) note.textContent = mot
  note.hidden = !mot
}

function basculerCotes() {
  E.cotes = !E.cotes
  garder('logomaker.cotes', E.cotes ? '1' : '0')
  majPanneau()
  dessiner()
}

/* LES COTES : la largeur et la hauteur imprimées, autour du logo, comme
   Illustrator les mesure — au-dessus (dessous, au bord du plan) et à
   gauche. Un trait sombre ourlé de blanc, lisible sur tous les fonds. */
function dessinerCotes(ctx) {
  if (!E.cotes || E.comparer || E.split !== null) return
  const c = cadreLogo(), t = tailleLogo()
  if (!c || !t) return
  const s = E.vue.zoom * E.apercu.echelle
  const x0 = E.vue.ox + c.x * s, y0 = E.vue.oy + c.y * s
  const x1 = x0 + c.largeur * s, y1 = y0 + c.hauteur * s
  const ecart = 18
  const yH = y0 - ecart >= 64 ? y0 - ecart : y1 + ecart
  const xV = x0 - ecart >= 12 ? x0 - ecart : x1 + ecart
  ctx.save()
  ctx.lineCap = 'round'
  const trait = segments => {
    for (const [largeur, couleur] of [[3, 'rgba(255,255,255,.9)'], [1, '#0f172a']]) {
      ctx.beginPath()
      for (const [a, b, c2, d] of segments) { ctx.moveTo(a, b); ctx.lineTo(c2, d) }
      ctx.lineWidth = largeur
      ctx.strokeStyle = couleur
      ctx.stroke()
    }
  }
  trait([[x0, yH, x1, yH], [x0, yH - 5, x0, yH + 5], [x1, yH - 5, x1, yH + 5], [xV, y0, xV, y1], [xV - 5, y0, xV + 5, y0], [xV - 5, y1, xV + 5, y1]])
  ctx.font = '600 12px ' + getComputedStyle(document.body).fontFamily
  ctx.textBaseline = 'middle'
  const etiquette = (mot, x, y) => {
    const L = ctx.measureText(mot).width + 14, H = 20
    ctx.beginPath()
    ctx.roundRect(x - L / 2, y - H / 2, L, H, 10)
    ctx.fillStyle = '#fff'
    ctx.fill()
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(15,23,42,.18)'
    ctx.stroke()
    ctx.fillStyle = '#0f172a'
    ctx.fillText(mot, x - L / 2 + 7, y + 0.5)
  }
  etiquette(coteDit(t, 'largeur') + ' mm', (x0 + x1) / 2, yH)
  etiquette(coteDit(t, 'hauteur') + ' mm', xV, (y0 + y1) / 2)
  ctx.restore()
}

/* ------------------------------------------------------------ LE CONTOUR
   (1er octobre 2026, Illustrator : Objet › Tracé › Décalage ; lib/
   contour.js) Le dessin du vecteur peint dans une toile (jusqu'à 1 600 px),
   sa marge comprise, élargi et tracé dans un fil ; son chemin revient en
   pixels de l'image pleine, sous tout le dessin. En Vecteur seulement :
   Détouré garde ses pixels, la version Image son contour d'image. */
const contourVoulu = () => E.contour.mm > 0 && E.version === 'vecteur'
const rvbContour = () => (NUANCIER.find(c => c.nom === E.contour.nom) || NUANCIER.find(c => c.nom === 'Blanc')).rvb.slice()
/* L'ÉPAISSEUR EN PIXELS de l'image pleine : à la taille d'impression (qui compte le
   contour : la largeur choisie est celle du film), sinon à 300 dpi. */
function pxContour(v) {
  const c = v.cadre
  if (!(E.contour.mm > 0) || !c) return 0
  if (!E.taille) return E.contour.mm / 25.4 * DPI
  /* Le contour ne prend jamais plus du tiers du film (un film de 12 mm
     n'a pas 5 mm de contour de chaque côté). */
  const mm = Math.min(E.contour.mm, E.taille.mm / 3)
  const cote = E.taille.cote === 'hauteur' ? c.hauteur : c.largeur
  return mm * cote / (E.taille.mm - 2 * mm)
}
/* Ce dont le contour dépend : le tracé, la silhouette (une couleur : sans
   le blanc enfermé), l'épaisseur, le lissage. */
const cleContour = v => JSON.stringify([v.cle, v.cleFin, v.pleine && v.pleine.n, E.teinte.type === 'multi' ? 'multi' : 'unie', Math.round(pxContour(v) * 10) / 10, E.lissage])
let filContour = null
let minuteurContour = null
let contourEnVol = null
function planifierContour(delai = 120) {
  clearTimeout(minuteurContour)
  const v = E.vecteur
  if (!contourVoulu() || !v || v.apercu || (v.contour && v.contour.cle === cleContour(v))) return
  minuteurContour = setTimeout(calculerContour, delai)
}
function calculerContour() {
  const v = E.vecteur
  if (!contourVoulu() || !v || v.apercu) return Promise.resolve(null)
  const cle = cleContour(v)
  if (v.contour && v.contour.cle === cle) return Promise.resolve(v.contour)
  if (contourEnVol && contourEnVol.cle === cle) return contourEnVol.promesse
  const c = v.cadre, px = pxContour(v)
  /* La toile tient en 1 600 px, marge comprise. */
  const k = Math.min(1, 1600 / (Math.max(c.largeur, c.hauteur) + 2 * px))
  const pk = px * k, m = Math.ceil(pk) + 3
  const L = Math.ceil(c.largeur * k) + 2 * m, Ht = Math.ceil(c.hauteur * k) + 2 * m
  const toile = toileDe(L, Ht)
  const ctx = toile.getContext('2d', { willReadFrequently: true })
  ctx.setTransform(k, 0, 0, k, m - c.x * k, m - c.y * k)
  ctx.fillStyle = '#000'
  for (const f of lireSvg(E.teinte.type !== 'multi' ? (v.unie || v.svg) : v.svg).formes) ctx.fill(new Path2D(f.d), f.regle)
  const img = ctx.getImageData(0, 0, L, Ht).data
  const encre = new Uint8Array(L * Ht)
  for (let p = 0; p < encre.length; p++) encre[p] = img[p * 4 + 3] >= 128 ? 1 : 0
  filContour = filContour || filDedie()
  const promesse = filContour.demander({ type: 'contour', encre, largeur: L, hauteur: Ht, px: pk, lissage: E.lissage }, () => {}, [encre.buffer]).then(rep => {
    if (!rep.d || !rep.cadre) return null
    const contour = {
      cle,
      d: deplacerChemin(rep.d, 1 / k, c.x - m / k, c.y - m / k),
      cadre: { x: c.x + (rep.cadre.x - m) / k, y: c.y + (rep.cadre.y - m) / k, largeur: rep.cadre.largeur / k, hauteur: rep.cadre.hauteur / k },
    }
    /* Le tracé a pu se refaire pendant le calcul : le contour va à celui
       qui a la même clé. */
    const w = E.vecteur
    if (w && cleContour(w) === cle) { w.contour = contour; w.aff = null; majPanneau(); dessiner() }
    return contour
  }).catch(e => { if (!(e && e.annule)) toast('Le contour ne se trace pas.', 'alerte'); return null }).finally(() => { if (contourEnVol && contourEnVol.cle === cle) contourEnVol = null })
  contourEnVol = { cle, promesse }
  return promesse
}
/* Avant un export : le contour du tracé, à jour. */
async function contourAJour() {
  if (!contourVoulu()) return
  clearTimeout(minuteurContour)
  await calculerContour()
}
/* LE SVG AVEC SON CONTOUR : son chemin en premier (sous tout), le cadre
   du dessin agrandi pour le tenir. */
function avecContour(svg, ct, rvb) {
  const [x, y, l, h] = lireSvg(svg).boite
  const x0 = Math.min(x, ct.cadre.x), y0 = Math.min(y, ct.cadre.y)
  const x1 = Math.max(x + l, ct.cadre.x + ct.cadre.largeur), y1 = Math.max(y + h, ct.cadre.y + ct.cadre.hauteur)
  const n = v => String(Math.round(v * 100) / 100)
  return svg
    .replace(/width="[^"]*" height="[^"]*" viewBox="[^"]*"/, 'width="' + n(x1 - x0) + '" height="' + n(y1 - y0) + '" viewBox="' + [x0, y0, x1 - x0, y1 - y0].map(n).join(' ') + '"')
    .replace(/(<title>[^<]*<\/title>)/, '$1<path fill="rgb(' + rvb.join(',') + ')" fill-rule="evenodd" d="' + ct.d + '"/>')
}
/* LE BLOC « CONTOUR » : l'épaisseur, la couleur ; en Vecteur. */
function majContour() {
  const R = E.racine
  if (!R) return
  r('bloc-contour').hidden = E.version !== 'vecteur'
  const curseur = R.querySelector('[data-c="contour"]')
  const v = Math.round(E.contour.mm * 10)
  if (document.activeElement !== curseur || Number(curseur.value) !== v) curseur.value = v
  curseur.style.setProperty('--p', (v / 50 * 100) + '%')
  r('val-contour').textContent = E.contour.mm > 0 ? mmDit(E.contour.mm) + ' mm' : 'Aucun'
  r('res-contour').textContent = E.contour.mm > 0 ? E.contour.nom : ''
  r('contour-couleurs').hidden = !(E.contour.mm > 0)
  R.querySelectorAll('[data-a="contour-couleur"]').forEach(b => b.setAttribute('aria-checked', String(E.contour.mm > 0 && b.dataset.v === E.contour.nom)))
}

/* ----------------------------------------------------------- RETIRER
   (1er octobre 2026, Illustrator : sélectionner, Suppr ; lib/effacer.js)
   Un clic sur un élément du logo l'ouvre dans l'inspecteur, qui propose
   de le retirer ; celui d'une ligne propose de la retirer toute. Ce qui part est écrit dans les réglages du fond
   (`effaces`, en fractions de l'image) : l'historique le défait, l'image
   refaite par l'IA le garde. */
/* ------------------------------------------------------------ LES CALQUES
   12 octobre 2026 (« un système de calques : prendre l'écriture et la
   modifier, supprimer un objet qui me plaît pas »). Un calque est un
   élément que le graphiste a lu : une ligne de texte, ou une forme d'un
   seul tenant de l'image détourée (lib/calques.js). Le bloc « Calques »
   du panneau les liste, chacun avec son œil (montré, retiré) ; une forme
   se signale sur le plan sous la souris et s'ouvre d'un clic — là, ou sur
   sa ligne du bloc — dans sa bulle : retirer, remettre, sa couleur. Tout
   s'écrit dans les réglages (`effaces`, `teintesElements`, la couleur
   d'une ligne) : les trois versions, les exports et l'historique suivent. */
/* Les formes listées : celles du calcul, moins les lettres des lignes de
   texte (la ligne est leur calque). */
function cadresLignes() {
  const t = texteAJour() && E.textes.etat === 'pret' && E.textes.f ? E.textes : null
  if (!t) return []
  const W = t.largeur * t.f, H = t.hauteur * t.f
  return t.lignes.map(l => l.boite ? [l.boite[0] / W, l.boite[1] / H, (l.boite[2] + 1) / W, (l.boite[3] + 1) / H] : null).filter(Boolean)
}
function formesListees() {
  const c = E.calques
  if (!c || c.pleine !== E.pleine) return []
  if (c.listeCle !== cleTexte() + '|' + (texteAJour() ? E.textes.etat : '')) {
    const cadres = cadresLignes()
    /* Une forme qui est presque toute l'image (le rectangle d'un fond
       gardé) n'est pas un élément. */
    c.liste = c.formes.filter(f => !estLettre(f, cadres) && f.aire < 0.9)
    c.listeCle = cleTexte() + '|' + (texteAJour() ? E.textes.etat : '')
  }
  return c.liste
}
const formeListee = id => formesListees().some(f => f.id === id)
const formeDe = id => (E.calques && E.calques.pleine === E.pleine ? E.calques.formes : []).find(f => f.id === id) || null
/* Le retrait qui a emporté une forme, la recoloration qui la teinte. */
function consigneForme(id, src) {
  const c = E.calques
  if (!c || c.pleine !== E.pleine) return null
  for (let i = c.consignes.length - 1; i >= 0; i--) if (c.consignes[i].src === src && c.touchees[i] === id) return c.consignes[i].ref
  return null
}
const formeRetiree = id => !!consigneForme(id, 'e')
const couleurForme = id => { const t = consigneForme(id, 't'); return t ? t.rvb : null }
/* La forme listée sous un point du plan, ou -1. */
function formeSous(x, y) {
  const c = E.calques, img = E.resultatImage
  if (!c || c.pleine !== E.pleine || !c.carte || !img || E.comparer || E.split !== null) return -1
  const X = Math.floor((x - E.vue.ox) / E.vue.zoom), Y = Math.floor((y - E.vue.oy) / E.vue.zoom)
  if (X < 0 || Y < 0 || X >= c.largeur || Y >= c.hauteur) return -1
  const id = c.carte[Y * c.largeur + X]
  /* Une forme déplacée n'est plus à sa place d'origine (`elementSous`). */
  return id >= 0 && formeListee(id) && !formeRetiree(id) && !entreeForme(id) ? id : -1
}
/* Le cadre d'une forme à l'écran. */
function cadreFormeEcran(f) {
  if (!E.apercu) return null
  /* Une forme déplacée : l'enveloppe de son cadre transformé. */
  const el = elementDe({ forme: f.id })
  if (el) return enveloppe(coinsElement(el))
  const [u0, v0, u1, v1] = f.cadre, k = E.vue.zoom
  return { x: E.vue.ox + u0 * E.apercu.largeur * k, y: E.vue.oy + v0 * E.apercu.hauteur * k, l: (u1 - u0) * E.apercu.largeur * k, h: (v1 - v0) * E.apercu.hauteur * k }
}
function survolerForme(id) {
  if (id === E.formeSurvol) return
  E.formeSurvol = id
  majFormes()
  dessiner()
}
/* LA FORME SIGNALÉE sur le plan : celle sous la souris (celle qui est
   choisie a son cadre et ses poignées, `dessinerSelection`). */
function dessinerFormes(ctx) {
  const id = E.formeSurvol
  if (id < 0 || choisi({ forme: id }) || (E.prise && E.prise.bouge)) return
  const el = elementDe({ forme: id })
  if (!el) return
  const coins = coinsElement(el)
  ctx.save()
  ctx.beginPath()
  coins.forEach(([x, y], j) => j ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
  ctx.closePath()
  ctx.strokeStyle = 'rgba(2,132,199,.7)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([4, 3])
  ctx.stroke()
  ctx.restore()
}
/* LE BLOC : les formes, après les lignes de texte — une pastille de sa
   couleur, « Forme », sa part de l'image, son œil. */
function majFormes() {
  const box = r('formes')
  if (!box) return
  const liste = formesListees()
  const html = liste.map(f => {
    const retiree = formeRetiree(f.id), rvb = couleurForme(f.id) || f.rvb
    const part = partDe(f.aire)
    return '<div class="o-studio-calque"' + (retiree ? ' data-cache' : '') + '>'
      + '<button type="button" class="o-studio-ligne-texte o-studio-forme" data-a="forme" data-v="' + f.id + '" aria-pressed="' + String(choisi({ forme: f.id })) + '"' + (retiree ? ' disabled' : '') + ' title="' + (retiree ? 'Forme retirée — l\'œil la remet' : 'Un clic choisit la forme : la déplacer, sa couleur, la retirer') + '">'
      + '<i style="background:' + rvbHex(rvb) + '"></i><span class="o-studio-ligne-texte-mot">Forme</span><small>' + part + (entreeForme(f.id) ? '<em class="o-studio-deplace" title="Déplacé, redimensionné ou tourné">' + ic('move') + '</em>' : '') + '</small></button>'
      + '<button type="button" class="o-studio-oeil" data-a="oeil-forme" data-v="' + f.id + '" aria-pressed="' + !retiree + '" aria-label="' + (retiree ? 'Remettre cette forme' : 'Retirer cette forme') + '" title="' + (retiree ? 'Remettre' : 'Retirer (Ctrl Z remet)') + '">' + ic(retiree ? 'eye-off' : 'eye') + '</button>'
      + '</div>'
  }).join('')
  if (box.dataset.dessin !== html) {
    const actif = box.contains(document.activeElement) ? document.activeElement : null
    const cible = actif && '[data-a="' + actif.dataset.a + '"][data-v="' + actif.dataset.v + '"]'
    box.innerHTML = html
    box.dataset.dessin = html
    if (cible) { const el = box.querySelector(cible); if (el) el.focus({ preventScroll: true }) }
  }
  box.hidden = !liste.length
}
/* La part d'une forme dans l'image, lisible. */
const partDe = aire => aire >= 0.1 ? Math.round(aire * 100) + ' %' : aire >= 0.01 ? (aire * 100).toFixed(1).replace('.', ',') + ' %' : (aire * 100).toFixed(2).replace('.', ',') + ' %'
/* L'ŒIL D'UNE FORME : retirée, elle revient (son retrait part des
   réglages) ; sinon elle part, par son point — comme un clic sur le plan. */
function basculerForme(id) {
  const f = formeDe(id)
  if (!f) return
  const ref = consigneForme(id, 'e')
  if (ref) { E.reglages = Object.assign({}, E.reglages, { effaces: E.reglages.effaces.filter(e => e !== ref) }); recalculer(); planifierFin(); majPanneau(); return }
  retirerForme(f)
}
function retirerForme(f) {
  const e = { u: f.u, v: f.v }
  /* Une forme déplacée n'est plus à son adresse sur l'image à l'écran :
     le fil la retire avant de la déplacer, l'essai n'a pas de sens. */
  if (entreeForme(f.id)) return retirer([Object.assign(e, { aire: f.aire })])
  const essai = essayerRetrait(e)
  if (!essai || !essai.partis) return toast('Rien à retirer ici.', 'alerte')
  if (essai.part > 0.6) return toast('Cet élément tient à tout le dessin : rien n\'est retiré.', 'alerte')
  e.aire = essai.partis / essai.image
  retirer([e])
}
/* LA COULEUR D'UN ÉLÉMENT : une recoloration par forme (la dernière
   l'emporte), ou plus aucune. */
function colorerElement(rvb) {
  const p = elementInspecte()
  if (!p) return
  const deja = (E.reglages.teintesElements || []).filter(t => !(p.id >= 0 ? consigneForme(p.id, 't') === t : Math.abs(t.u - p.u) < 1e-6 && Math.abs(t.v - p.v) < 1e-6))
  const f = p.id >= 0 ? formeDe(p.id) : null
  const teintes = rvb ? deja.concat([Object.assign({ u: p.u, v: p.v, rvb }, f ? { aire: f.aire } : p.aire ? { aire: p.aire } : {})]) : deja
  E.reglages = Object.assign({}, E.reglages, { teintesElements: teintes })
  recalculer()
  planifierFin()
  majPanneau()
}
/* ------------------------------------------------------- L'INSPECTEUR
   12 octobre 2026 (« la bulle de modification s'ouvre directement sur
   l'objet que je souhaite modifier, c'est insupportable »). Jusque-là,
   la bulle d'une ligne ou d'une forme se posait SUR LE PLAN, sous
   l'élément — 320 px de large, jusqu'à 600 px de haut : elle recouvrait
   le texte qu'on éditait et ses voisins, débordait du plan, et se fermait
   au moindre clic ailleurs. Désormais RIEN NE FLOTTE SUR LE LOGO : le plan
   montre la sélection (son cadre, ses poignées), le panneau de droite
   montre ses propriétés — l'inspecteur, qui remplace les réglages du logo
   tant qu'un élément est choisi, et s'efface quand on désélectionne
   (Échap, « ← », un clic sur le vide du plan). Le modèle de Figma et de
   Photoshop : la toile reste entière, les réglages ont une place fixe.
   L'inspecteur SE DÉDUIT de la sélection (`E.choix`) : la ligne choisie
   seule, la forme choisie seule, plusieurs éléments — ou, sans sélection,
   le point d'encre cliqué hors de toute forme listée (`E.point`). Il reste
   pendant un geste sur le plan, un changement de police, de version, de
   fond ; une sélection qui n'existe plus (une forme retirée, les formes
   recalculées sous un autre seuil) sort de `E.choix` et l'inspecteur se
   ferme de lui-même. */
const ligneInspectee = () => E.choix.length === 1 && E.choix[0].ligne !== undefined ? E.choix[0].ligne : -1
function elementInspecte() {
  if (E.choix.length === 1 && E.choix[0].forme !== undefined) {
    const f = formeDe(E.choix[0].forme)
    return f && !formeRetiree(f.id) ? { u: f.u, v: f.v, id: f.id } : null
  }
  return E.choix.length ? null : E.point
}
/* UN ÉLÉMENT OUVERT depuis le plan ou le bloc « Calques » : la forme sous
   le point (ou `id`) se choisit ; l'encre hors de toute forme listée (une
   miette, une lettre soudée au dessin) devient le point inspecté.
   `cadrer` : depuis le bloc, la forme vient à l'écran. */
function ouvrirElement(x, y, id = -1, cadrer = false) {
  const img = E.resultatImage
  if (!img || !E.apercu || E.comparer || E.split !== null) return
  let f = id >= 0 ? formeDe(id) : null
  if (!f) {
    const X = (x - E.vue.ox) / E.vue.zoom, Y = (y - E.vue.oy) / E.vue.zoom
    if (X < 0 || Y < 0 || X >= img.width || Y >= img.height || !encreSous(img.data, img.width, img.height, X, Y, 2)) return
    id = formeSous(x, y)
    f = id >= 0 ? formeDe(id) : null
    if (!f) {
      E.choix = []
      E.point = { u: X / img.width, v: Y / img.height }
      majFormes()
      majPolice()
      return dessiner()
    }
  }
  if (formeRetiree(f.id)) return
  fermerPop()
  fermerMenu()
  if (cadrer) cadrerVue(cadreFormeEcran(f))
  choisir({ forme: f.id })
}
/* LA LIGNE `k` OUVERTE : choisie ; depuis le bloc (`cadrer`), amenée à
   l'écran d'abord. */
function ouvrirLigne(k, cadrer = false) {
  const t = texteAJour() ? E.textes : null
  const l = t && t.lignes[k]
  if (!l || ligneRetiree(l)) return
  fermerPop()
  fermerMenu()
  if (cadrer) cadrerVue(cadreLigneEcran(l))
  choisir({ ligne: k })
}
/* LES ÉLÉMENTS DU LOGO, dans l'ordre du bloc : les lignes, puis les
   formes listées — ce que « ‹ › » parcourt. */
function elementsDuLogo() {
  const t = texteAJour() && E.textes.etat === 'pret' ? E.textes : null
  const lignes = t ? t.lignes.map((l, i) => ligneRetiree(l) ? null : { ligne: i }).filter(Boolean) : []
  return lignes.concat(formesListees().filter(f => !formeRetiree(f.id)).map(f => ({ forme: f.id })))
}
function sauter(d) {
  const liste = elementsDuLogo()
  if (!liste.length) return
  const seul = E.choix.length === 1 ? E.choix[0] : null
  const i = seul ? liste.findIndex(ref => memeRef(ref, seul)) : -1
  const ref = liste[((i < 0 ? 0 : i + d) % liste.length + liste.length) % liste.length]
  if (ref.ligne !== undefined) ouvrirLigne(ref.ligne, true)
  else ouvrirElement(0, 0, ref.forme, true)
}
/* LA VUE GLISSE pour qu'un cadre de l'écran soit visible (220 ms, sans
   changer le zoom) — un saut quand le poste préfère moins de mouvement.
   Un geste sur le plan (la souris, la molette) la coupe. */
let nGlisse = 0
function cadrerVue(c) {
  const scene = r('scene')
  if (!scene || !c) return
  const W = scene.clientWidth, H = scene.clientHeight
  let dx = 0, dy = 0
  if (c.x < 16) dx = 16 - c.x; else if (c.x + c.l > W - 16) dx = Math.max(16 - c.x, W - 16 - c.x - c.l)
  if (c.y < 70) dy = 70 - c.y; else if (c.y + c.h > H - 90) dy = Math.max(70 - c.y, H - 90 - c.y - c.h)
  if (!dx && !dy) return
  E.vue.ajuste = false
  const n = ++nGlisse
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) { E.vue.ox += dx; E.vue.oy += dy; return dessiner() }
  const de = { ox: E.vue.ox, oy: E.vue.oy }, t0 = performance.now()
  const pas = now => {
    if (n !== nGlisse) return
    const p = Math.min(1, (now - t0) / 220), e = 1 - Math.pow(1 - p, 3)
    E.vue.ox = de.ox + dx * e
    E.vue.oy = de.oy + dy * e
    dessiner()
    if (p < 1) requestAnimationFrame(pas)
  }
  requestAnimationFrame(pas)
}
/* L'INSPECTEUR À JOUR (depuis `majPolice`, à chaque changement) : le
   HTML du sujet, posé s'il a changé — jamais sous un champ qu'on tape, le
   bouton qui a la main la garde — ; le panneau bascule entre ses
   réglages (`.o-studio-defile`) et l'inspecteur, garde où en étaient les
   réglages, revient en haut quand le SUJET change. */
function majInspecteur() {
  const insp = r('inspecteur'), defile = E.racine && E.racine.querySelector('.o-studio-defile')
  if (!insp || !defile) return
  const els = elementsChoisis()
  const k = ligneInspectee(), p = k >= 0 ? null : elementInspecte()
  const t = texteAJour() ? E.textes : null
  const l = k >= 0 && t ? t.lignes[k] : null
  let cle = '', html = ''
  if (l) { cle = 'ligne:' + k; html = htmlInspecteurLigne(l, k) }
  else if (els.length > 1) { cle = 'groupe'; html = htmlInspecteurGroupe(els) }
  else if (p) { cle = p.id >= 0 ? 'forme:' + p.id : 'point'; html = htmlInspecteurElement(p) }
  const ouvert = !!cle
  if (!ouvert) {
    if (insp.hidden) return
    insp.hidden = true
    insp.innerHTML = ''
    insp.dataset.dessin = ''
    insp.dataset.sujet = ''
    defile.hidden = false
    defile.scrollTop = E.inspecteur.defile
    animer(defile)
    return
  }
  if (insp.hidden) {
    E.inspecteur.defile = defile.scrollTop
    const main = defile.contains(document.activeElement)
    defile.hidden = true
    insp.hidden = false
    animer(insp)
    if (main) insp.focus({ preventScroll: true })
    /* Le panneau sous le plan (une fenêtre étroite) : l'inspecteur vient
       à l'écran si sa tête n'y est pas. */
    if (typeof matchMedia === 'function' && matchMedia('(max-width: 1100px)').matches) insp.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
  const nouveau = insp.dataset.sujet !== cle
  if (insp.dataset.dessin !== html) {
    /* Un champ qu'on tape (le texte, la recherche, une cote) ne se
       redessine pas sous les doigts, sauf pour un autre sujet. */
    const actif = insp.contains(document.activeElement) && document.activeElement.tagName === 'INPUT' ? document.activeElement : null
    if (!actif || nouveau) {
      const bouton = !nouveau && insp.contains(document.activeElement) ? document.activeElement : null
      const meme = bouton && bouton.dataset.a ? '[data-a="' + bouton.dataset.a + '"]' + (bouton.dataset.v !== undefined ? '[data-v="' + CSS.escape(bouton.dataset.v) + '"]' : '') : null
      insp.innerHTML = html
      insp.dataset.dessin = html
      if (meme) { const el = insp.querySelector(meme); if (el) el.focus({ preventScroll: true }) }
    }
  }
  if (nouveau) { insp.dataset.sujet = cle; insp.scrollTop = 0 }
  if (l) {
    insp.querySelectorAll('[data-c="gras"]').forEach(el => majGras(el, l))
    if (E.cherche.k === k && E.cherche.q) majRecherche()
  }
}
/* Le panneau qui change de vue glisse ; la classe part avec l'animation
   (le volet qui la coupe la laisserait posée, sans effet). */
function animer(el) {
  el.classList.remove('o-studio-anime')
  void el.offsetWidth
  el.classList.add('o-studio-anime')
  el.addEventListener('animationend', () => el.classList.remove('o-studio-anime'), { once: true })
}
/* LA TÊTE DE L'INSPECTEUR : retour, le titre, l'élément précédent et le
   suivant. */
function teteInspecteur(milieu) {
  const liste = elementsDuLogo()
  const seul = E.choix.length === 1 ? E.choix[0] : null
  const i = seul ? liste.findIndex(ref => memeRef(ref, seul)) : -1
  const nav = (d, icone, mot) => '<button type="button" class="o-studio-insp-nav" data-a="insp-suivant" data-v="' + d + '" title="' + mot + '" aria-label="' + mot + '"' + (i >= 0 && liste.length > 1 ? '' : ' disabled') + '>' + ic(icone) + '</button>'
  return '<div class="o-studio-insp-tete">'
    + '<button type="button" class="o-studio-insp-nav o-studio-insp-retour" data-a="insp-retour" title="Retour aux réglages du logo (Échap)" aria-label="Retour aux réglages du logo">' + ic('arrow-left') + '</button>'
    + milieu
    + nav(-1, 'chevron-left', 'L\'élément précédent du logo') + nav(1, 'chevron-right', 'L\'élément suivant du logo')
    + '</div>'
}
const blocInspecteur = (titre, detail, corps) => '<section class="o-studio-insp-bloc">' + (titre ? '<div class="o-studio-bloc-tete"><b>' + titre + '</b><span>' + detail + '</span></div>' : '') + corps + '</section>'
const boutonRetirer = (action, mot, titre) => blocInspecteur('', '', '<button type="button" class="o-studio-bouton o-studio-pop-retirer o-studio-pop-large" data-a="' + action + '" title="' + titre + '">' + ic('trash-2') + '<span>' + mot + '</span></button>')
/* UNE FORME (ou l'encre sous un clic) : sa couleur (les pastilles du
   nuancier, D'origine), sa géométrie, Retirer. */
function htmlInspecteurElement(p) {
  const f = p.id >= 0 ? formeDe(p.id) : null
  const couleur = f ? couleurForme(f.id) : null
  const rvb = couleur || (f ? f.rvb : null)
  const geo = f ? htmlGeometrie({ forme: f.id }) : ''
  return teteInspecteur('<div class="o-studio-insp-titre">' + (rvb ? '<i style="background:' + rvbHex(rvb) + '"></i>' : '') + '<b>' + (f ? 'Forme' : 'Élément') + '</b><small>' + (f ? partDe(f.aire) + ' du logo' : 'l\'encre sous le clic') + '</small></div>')
    + blocInspecteur('Couleur', couleur ? html_(fiche(couleur).nom) : 'D\'origine',
      '<div class="o-studio-pop-grille">' + NUANCIER.map(c => '<button type="button" data-a="element-couleur" data-v="' + rvbHex(c.rvb) + '"' + pastille(c.rvb) + (couleur && duNuancier(couleur) === c ? ' aria-current="true"' : '') + '><i style="background:' + rvbHex(c.rvb) + '"></i></button>').join('')
      + '<button type="button" data-a="element-origine" title="La couleur d\'origine" aria-label="La couleur d\'origine"' + (!couleur ? ' aria-current="true"' : '') + '><i class="o-studio-origine"></i></button></div>')
    + (geo ? blocInspecteur('Géométrie', 'en mm', geo) : '')
    + boutonRetirer('retirer-element', f ? 'Retirer cette forme' : 'Retirer cet élément', 'L\'élément part du logo, dans les trois versions et les exports (Ctrl Z le remet)')
}
/* PLUSIEURS ÉLÉMENTS (Maj + clic) : retourner, replacer, retirer. */
function htmlInspecteurGroupe(els) {
  const n = els.length, lignes = els.filter(e => e.ligne).length, formes = n - lignes
  const detail = [lignes ? lignes + ' ligne' + (lignes > 1 ? 's' : '') : '', formes ? formes + ' forme' + (formes > 1 ? 's' : '') : ''].filter(Boolean).join(' · ')
  return teteInspecteur('<div class="o-studio-insp-titre"><b>' + n + ' éléments</b><small>' + detail + '</small></div>')
    + blocInspecteur('Géométrie', 'Maj + clic : ajouter, retirer',
      '<div class="o-studio-geo-boutons o-studio-insp-boutons">'
      + '<button type="button" class="o-studio-bouton" data-a="geo-retourner-h" title="Retourner horizontalement" aria-label="Retourner horizontalement">' + ic('flip-horizontal') + '</button>'
      + '<button type="button" class="o-studio-bouton" data-a="geo-retourner-v" title="Retourner verticalement" aria-label="Retourner verticalement">' + ic('flip-vertical') + '</button>'
      + (els.some(el => el.entree) ? '<button type="button" class="o-studio-bouton" data-a="geo-replacer" title="Remettre chacun à sa place et à sa taille d\'origine">' + ic('rotate-ccw') + '<span>Replacer</span></button>' : '')
      + '</div>')
    + boutonRetirer('insp-retirer', 'Retirer ces ' + n + ' éléments', 'Ils partent du logo, dans les trois versions et les exports (Ctrl Z les remet)')
}
function retirer(effaces) {
  E.reglages = Object.assign({}, E.reglages, { effaces: (E.reglages.effaces || []).concat(effaces) })
  recalculer()
  planifierFin()
  majPanneau()
}
/* CE QU'UNE CONSIGNE RETIRERAIT, compté sur l'aperçu avant de la
   donner : les pixels d'encre partis (dans `boite`, en pixels d'aperçu,
   ou partout), sur ceux qu'il y avait. */
function essayerRetrait(e, boite = null) {
  const img = E.resultatImage
  if (!img) return null
  const copie = new Uint8ClampedArray(img.data)
  const compter = d => boite ? encreDe(d, img.width, ...boite) : encreDe(d, img.width)
  const avant = compter(copie)
  effacer(copie, img.width, img.height, [e])
  const apres = compter(copie)
  return { part: avant ? (avant - apres) / avant : 0, partis: avant - apres, image: img.width * img.height }
}
/* ------------------------------------------------------------ LA GOMME
   12 octobre 2026 (les calques : « supprimer un objet qui me plaît
   pas »). Un lasso tracé à la souris autour de ce qui doit partir ; au
   relâchement, sa bulle : RETIRER (l'encre dedans part, transparente — un
   logo à plat) ou COMBLER (le fond se rebouche dessous — une photo, par
   MI-GAN ; un logo, à la couleur : lib/combler.js). Le graphiste propose
   Combler sur une photo ou une image, Retirer sur un logo. Un rebouchage
   transforme l'image de travail, comme « Améliorer l'image » : ses
   polygones (`E.comble.liste`) sont dans la photo de l'historique, et
   Annuler les rejoue depuis l'image d'avant (`E.comble.base`). */
function prendreGomme(oui = E.outil !== 'gomme') {
  E.outil = oui ? 'gomme' : ''
  if (!oui) { E.lasso = null; fermerPopLasso() }
  viderChoix()
  majPanneau()
  dessiner()
}
/* Le lasso se ferme : un vrai polygone — ou, d'un simple glissé en
   ligne (deux points, une boucle sans aire), le rectangle qu'il tend ;
   sa bulle s'ouvre hors de son cadre (`placerHors`). */
function fermerLasso(fini) {
  const l = E.lasso
  if (!l) return
  let pts = l.pts
  if (!fini || pts.length < 2 || !E.apercu) { E.lasso = null; return dessiner() }
  let aire = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) aire += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]
  if (pts.length < 3 || Math.abs(aire / 2) < 16) {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
    if (x1 - x0 < 6 || y1 - y0 < 6) { E.lasso = null; return dessiner() }
    pts = l.pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
  }
  const { zoom, ox, oy } = E.vue, W = E.apercu.largeur, H = E.apercu.hauteur
  l.poly = pts.map(([x, y]) => [Math.max(0, Math.min(1, (x - ox) / zoom / W)), Math.max(0, Math.min(1, (y - oy) / zoom / H))])
  ouvrirPopLasso(enveloppe(pts))
  dessiner()
}
/* La bulle du lasso, HORS de son cadre : dessous, sinon dessus, sinon à
   côté — jamais sur ce qu'on vient d'entourer. */
function ouvrirPopLasso(cadre) {
  const pop = r('pop-lasso'), scene = r('scene')
  if (!pop) return
  const photo = !!(E.decision && E.decision.genre !== 'logo')
  pop.innerHTML = '<div class="o-studio-pop-tete"><b>Lasso<small>' + (photo ? 'une photo : le fond se rebouche' : 'un logo : l\'encre part') + '</small></b>'
    + '<button type="button" class="o-studio-pop-x" data-a="lasso-annuler" aria-label="Annuler">' + ic('x') + '</button></div>'
    + '<div class="o-studio-pop-pied">'
    + '<button type="button" class="o-studio-bouton' + (photo ? ' o-studio-plein' : '') + '" data-a="lasso-combler" title="Ce qui est dedans part, et le fond se rebouche dessous (une photo : par l\'IA)">' + ic('sparkles') + '<span>Combler</span></button>'
    + '<button type="button" class="o-studio-bouton' + (photo ? '' : ' o-studio-plein') + ' o-studio-pop-retirer" data-a="lasso-retirer" title="L\'encre dedans part, transparente (Ctrl Z la remet)">' + ic('trash-2') + '<span>Retirer</span></button>'
    + '</div>'
  pop.hidden = false
  placerHors(pop, cadre, scene.clientWidth, scene.clientHeight)
}
/* UNE BULLE POSÉE HORS D'UN CADRE de l'écran (`c` : x, y, l, h), à `m`
   pixels : dessous, sinon dessus, sinon à droite, sinon à gauche ; faute
   de place, au bas du plan. Toujours dans le plan. */
function placerHors(pop, c, W, H, m = 12) {
  const pl = pop.offsetWidth, ph = pop.offsetHeight
  let x = c.x + c.l / 2 - pl / 2, y
  if (c.y + c.h + m + ph <= H - 8) y = c.y + c.h + m
  else if (c.y - m - ph >= 8) y = c.y - m - ph
  else if (c.x + c.l + m + pl <= W - 8) { x = c.x + c.l + m; y = c.y + c.h / 2 - ph / 2 }
  else if (c.x - m - pl >= 8) { x = c.x - m - pl; y = c.y + c.h / 2 - ph / 2 }
  else y = H - ph - 8
  pop.style.left = Math.round(Math.max(8, Math.min(W - pl - 8, x))) + 'px'
  pop.style.top = Math.round(Math.max(8, Math.min(H - ph - 8, y))) + 'px'
}
function fermerPopLasso() {
  const pop = r('pop-lasso')
  if (pop) { pop.hidden = true; pop.innerHTML = '' }
}
function annulerLasso() {
  E.lasso = null
  fermerPopLasso()
  dessiner()
}
/* RETIRER AU LASSO : l'encre dedans part (lib/effacer.js, `coupe`). */
function retirerLasso() {
  const l = E.lasso
  if (!l || !l.poly) return
  const us = l.poly.map(p => p[0]), vs = l.poly.map(p => p[1])
  const e = { poly: l.poly, cadre: [Math.min(...us), Math.min(...vs), Math.max(...us), Math.max(...vs)], coupe: true }
  annulerLasso()
  prendreGomme(false)
  retirer([e])
}
/* COMBLER AU LASSO : un rebouchage de plus sur l'image de travail. */
function comblerLasso() {
  const l = E.lasso
  if (!l || !l.poly) return
  const poly = l.poly
  annulerLasso()
  prendreGomme(false)
  comblerImage(E.comble.liste.concat([{ poly }]))
}
function dessinerLasso(ctx) {
  const l = E.lasso
  if (!l || l.pts.length < 2) return
  ctx.save()
  ctx.beginPath()
  l.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
  if (l.poly) ctx.closePath()
  ctx.fillStyle = 'rgba(2,132,199,.12)'
  if (l.poly) ctx.fill()
  ctx.strokeStyle = '#0284c7'
  ctx.lineWidth = 1.5
  ctx.setLineDash([5, 4])
  ctx.stroke()
  ctx.restore()
}
/* L'IMAGE DE TRAVAIL REBOUCHÉE : `liste`, tous les lassos à reboucher,
   rejoués sur l'image d'avant tout rebouchage (`E.comble.base`, prise ici
   la première fois) dans le fil de l'IA — MI-GAN sur une photo ou une
   image, à la couleur sur un logo. L'image rendue remplace l'image de
   travail (`remplacer`) : le détourage, le tracé, le texte repartent ;
   « Comparer » garde le fichier reçu. Une liste vide : l'image d'avant
   revient telle quelle. */
let nComble = 0
function comblerImage(liste) {
  if (!E.pleine) return
  const base = E.comble.base || { data: E.pleine.data, largeur: E.pleine.largeur, hauteur: E.pleine.hauteur }
  E.comble.base = base
  E.comble.liste = liste
  const n = ++nComble
  if (!liste.length) { E.comble.enCours = false; return poserImageComblee(base) }
  Object.assign(E.comble, { enCours: true, part: 0 })
  preparer()
  majPanneau()
  const parIA = !!(E.decision && E.decision.genre !== 'logo')
  const data = base.data.slice()
  ia().demander({ type: 'combler', data, largeur: base.largeur, hauteur: base.hauteur, comblements: liste, ia: parIA }, pr => {
    if (n !== nComble) return
    if (pr.etat) return evenement(pr)
    if (pr.etape === 'combler' && pr.part !== undefined) { E.comble.part = pr.part; majPrep() }
  }, [data.buffer]).then(rep => {
    if (n !== nComble) return
    E.comble.enCours = false
    poserImageComblee(rep)
  }).catch(e => {
    if (n !== nComble || (e && e.annule)) return
    E.comble.enCours = false
    echouer('combler', (e && e.message) || 'Le rebouchage a échoué.')
  }).finally(() => {
    if (n !== nComble) return
    E.comble.enCours = false
    reposerIA()
    majPanneau()
  })
}
function poserImageComblee(img) {
  const data = img.data instanceof Uint8ClampedArray ? img.data : new Uint8ClampedArray(img.data)
  const toile = toileDe(img.largeur, img.hauteur)
  toile.getContext('2d').putImageData(new ImageData(data, img.largeur, img.hauteur), 0, 0)
  E.comblant = true
  try { remplacer({ data, largeur: img.largeur, hauteur: img.hauteur }, toile, () => {}, true) } finally { E.comblant = false }
}
function retirerElement() {
  const p = elementInspecte()
  if (!p) return
  /* L'inspecteur ne traîne pas sur un élément qui part. */
  E.point = null
  E.choix = []
  majFormes()
  majPolice()
  dessiner()
  const f = p.id >= 0 ? formeDe(p.id) : null
  if (f) return retirerForme(f)
  const e = { u: p.u, v: p.v }
  const essai = essayerRetrait(e)
  /* Un élément soudé à tout le dessin (le texte posé sur un badge, un
     masque d'IA d'un seul tenant) ne se retire pas d'un clic. */
  if (!essai || !essai.partis) return toast('Rien à retirer ici.', 'alerte')
  if (essai.part > 0.6) return toast('Cet élément tient à tout le dessin : rien n\'est retiré.', 'alerte')
  e.aire = essai.partis / essai.image
  retirer([e])
}
/* UNE LIGNE RETIRÉE : son cadre (un peu plus grand que ses lettres) —
   ou, en rond, son tour —, en fractions de l'image ; sa police n'est plus
   posée. */
function retirerLigne(k) {
  const t = texteAJour() ? E.textes : null
  const l = t && t.lignes[k]
  if (!l || !t.f) return
  const b = l.boite, W = t.largeur * t.f, H = t.hauteur * t.f, mg = 0.15 * (b[3] - b[1] + 1)
  /* `ligne` : sa place (son centre, sa hauteur), pour la retrouver. */
  const e = { ligne: placeLigne(l, t), cadre: [(b[0] - mg) / W, (b[1] - mg) / H, (b[2] + mg) / W, (b[3] + mg) / H] }
  if (l.contour) e.poly = l.contour.map(([x, y]) => [x / W, y / H])
  /* Des lettres soudées au dessin (un texte sur un badge, un ruban) ne
     partent pas avec leur cadre : la ligne reste, on le dit. */
  const img = E.resultatImage
  /* Une ligne déplacée n'est plus à sa place sur l'image à l'écran : le
     fil la retire avant de la déplacer, l'essai n'a pas de sens. */
  const essai = entreeLigne(l) ? { part: 1 } : img && essayerRetrait(e, [Math.floor(e.cadre[0] * img.width), Math.floor(e.cadre[1] * img.height), Math.ceil(e.cadre[2] * img.width), Math.ceil(e.cadre[3] * img.height)])
  if (!essai || essai.part < 0.3) return toast('Ces lettres tiennent au dessin : la ligne ne se retire pas seule. Choisissez « Dessin d\'origine » ou une police.', 'alerte')
  E.choix = E.choix.filter(c => c.ligne !== k)
  retirer([e])
  poserPolices()
}
/* Une ligne retirée : un retrait de ligne posé à sa place (son centre à
   moins de 0,6 hauteur), comme une police reportée (`reporterPolices`). */
function retraitLigne(l) {
  const t = E.textes, ef = E.reglages.effaces
  if (!ef || !ef.length || !t || !t.f) return null
  const p = placeLigne(l, t)
  return ef.find(e => e.ligne && typeof e.ligne === 'object' && memeLigne(p, e.ligne)) || null
}
const ligneRetiree = l => !!retraitLigne(l)
/* L'ŒIL D'UNE LIGNE (les calques) : retirée, elle revient ; sinon elle
   part, comme « Retirer cette ligne ». */
function basculerLigne(k) {
  const t = texteAJour() ? E.textes : null
  const l = t && t.lignes[k]
  if (!l) return
  const ref = retraitLigne(l)
  if (!ref) return retirerLigne(k)
  E.reglages = Object.assign({}, E.reglages, { effaces: E.reglages.effaces.filter(e => e !== ref) })
  recalculer()
  planifierFin()
  poserPolices()
  majPanneau()
}

/* ------------------------------------------------- LES CALQUES DÉPLACÉS
   12 octobre 2026 (« déplacer ou redimensionner un calque, au niveau de
   Photoshop : démonter un logo comme je le souhaite »). Un élément lu —
   une FORME (lib/calques.js) ou une LIGNE DE TEXTE — se sélectionne d'un
   clic (Maj : plusieurs), se DÉPLACE en le glissant, se REDIMENSIONNE par
   ses poignées (un coin : en proportion ; Maj : librement ; Alt : autour
   du centre ; un côté : ce côté seul), se TOURNE juste au-delà d'un coin
   (Maj : par 15°), se RETOURNE et se REPLACE dans son inspecteur, où sa
   géométrie se tape en millimètres ; les flèches le poussent, Suppr le
   retire. Sa transformation est dans les réglages (`transformations`,
   lib/transformer.js : pivot, d, angle, s, en largeurs d'image — relative
   à sa place d'origine) : les trois versions, les exports et
   l'historique suivent.
   Le studio ne lit ses éléments qu'à leur PLACE D'ORIGINE (les formes et
   la carte de `E.calques`, les boîtes des lignes) et passe par la matrice
   pour tout ce qui se voit ou se clique (`coinsElement`, `elementSous`).
   Pendant le geste, un APERÇU (`E.apercuPrise`) : l'image sans la
   sélection, son trou rebouché comme le fera le fil (`creuser`), et un
   sprite par élément que la toile dessine transformé à 60 fps ; il reste
   à l'écran jusqu'à l'image calculée qui le contient. Des GUIDES magenta
   aimantent le déplacement aux bords et centres de l'image et des autres
   éléments (Ctrl : sans aimant). */
const AIMANT = 5
const POIGNEE = 8
const ROTATION = 18
const MAGENTA = '#ff00ff'
const CURSEUR_ROTATION = 'url("data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>') + '") 11 11, url("data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>') + '") 11 11, alias'
const transformationsDe = () => E.reglages.transformations || []
const memeRef = (a, b) => !!a && !!b && a.forme === b.forme && a.ligne === b.ligne
const choisi = ref => E.choix.some(c => memeRef(c, ref))
/* L'entrée d'une forme (par la forme que touche son point, `touchees`)
   et celle d'une ligne (à 0,6 hauteur près, comme `retraitLigne`). */
/* L'entrée d'une forme : par la forme que touche son point (`touchees`,
   après le calcul), sinon par son adresse même — le geste vient d'être
   écrit, le calcul n'est pas rendu : pas de doublon, pas de saut. */
function entreeForme(id) {
  const e = consigneForme(id, 'x')
  if (e) return e
  const f = formeDe(id)
  return f ? transformationsDe().find(x => x.u !== undefined && Math.abs(x.u - f.u) < 1e-9 && Math.abs(x.v - f.v) < 1e-9) || null : null
}
/* La forme d'une entrée, de même. */
function formeDeEntree(e) {
  const c = E.calques
  if (!c || c.pleine !== E.pleine) return -1
  const i = c.consignes.findIndex(q => q.ref === e)
  if (i >= 0) return c.touchees[i]
  const f = c.formes.find(x => Math.abs(x.u - e.u) < 1e-9 && Math.abs(x.v - e.v) < 1e-9)
  return f ? f.id : -1
}
function entreeLigne(l) {
  const t = E.textes
  if (!t || !t.f) return null
  const p = placeLigne(l, t)
  return transformationsDe().find(e => e.ligne && memeLigne(p, e.ligne)) || null
}
/* La ligne d'une entrée, pour savoir si sa police est posée. */
function ligneDeEntree(e) {
  const t = texteAJour() ? E.textes : null
  if (!t || !t.f || !e.ligne) return null
  return t.lignes.find(l => memeLigne(placeLigne(l, t), e.ligne)) || null
}
/* LES RÉGLAGES QUE VOIENT LES FILS : sans les entrées des lignes dont la
   police est posée — leurs lettres de police se transforment dans la
   pose (`choixPolices`, `m`), leurs anciennes lettres s'effacent sur
   place. */
function reglagesCalcul() {
  const t = transformationsDe()
  if (!t.length) return E.reglages
  const reste = t.filter(e => { if (!e.ligne) return true; const l = ligneDeEntree(e); return !(l && l.choix >= 0 && l.props[l.choix] && !ligneRetiree(l)) })
  return reste.length === t.length ? E.reglages : Object.assign({}, E.reglages, { transformations: reste })
}
/* Le cadre d'une ligne en fractions de l'image, un peu plus grand que
   ses lettres (la marge du retrait, `retirerLigne`), et son tour en rond. */
function cadreLigne(l) {
  const t = E.textes
  if (!t || !t.f || !l.boite) return null
  const b = l.boite, W = t.largeur * t.f, H = t.hauteur * t.f, mg = 0.15 * (b[3] - b[1] + 1)
  const c = { cadre: [(b[0] - mg) / W, (b[1] - mg) / H, (b[2] + mg) / W, (b[3] + mg) / H], lettres: [b[0] / W, b[1] / H, (b[2] + 1) / W, (b[3] + 1) / H] }
  if (l.contour) c.poly = l.contour.map(([x, y]) => [x / W, y / H])
  return c
}
/* UN ÉLÉMENT par sa référence ({ forme: id } ou { ligne: k }) : son cadre
   d'origine (fractions), son polygone, son adresse pour les réglages, son
   entrée courante (ou aucune), son pivot (le centre du cadre, en largeurs
   d'image), sa ligne. Null s'il n'existe plus. */
function elementDe(ref) {
  if (!E.apercu) return null
  const asp = E.apercu.hauteur / E.apercu.largeur
  if (ref.forme !== undefined) {
    const f = formeDe(ref.forme)
    if (!f || formeRetiree(f.id)) return null
    const entree = entreeForme(f.id)
    return { ref, cadre: f.cadre, lettres: f.cadre, poly: null, adresse: { u: f.u, v: f.v, aire: f.aire }, entree, pivot: entree ? entree.pivot : [(f.cadre[0] + f.cadre[2]) / 2, (f.cadre[1] + f.cadre[3]) / 2 * asp], forme: f }
  }
  const t = texteAJour() && E.textes.etat === 'pret' ? E.textes : null
  const l = t && t.lignes[ref.ligne]
  if (!l || ligneRetiree(l)) return null
  const c = cadreLigne(l)
  if (!c) return null
  const entree = entreeLigne(l)
  /* `lettres` : le cadre des lettres mêmes (sans la marge du retrait),
     pour dire L et H. */
  return { ref, cadre: c.cadre, lettres: c.lettres, poly: c.poly || null, adresse: { ligne: placeLigne(l, t), cadre: c.cadre, poly: c.poly }, entree, pivot: entree ? entree.pivot : [(c.cadre[0] + c.cadre[2]) / 2, (c.cadre[1] + c.cadre[3]) / 2 * asp], ligne: l }
}
const entreeDe = el => el.entree || Object.assign({ pivot: el.pivot }, IDENTITE, { d: [0, 0], s: [1, 1] })
/* L'entrée du moment : celle du geste en cours, sinon celle des réglages. */
function entreeCourante(el) {
  const p = E.prise
  if (p && p.entrees) { const e = p.entrees.find(x => memeRef(x.ref, el.ref)); if (e) return e.entree }
  return entreeDe(el)
}
/* La matrice d'un élément en pixels d'aperçu, puis à l'écran. */
const matriceApercu = el => matriceDe(entreeCourante(el), E.apercu.largeur)
const versEcran = ([x, y]) => [E.vue.ox + x * E.vue.zoom, E.vue.oy + y * E.vue.zoom]
const versApercu = (x, y) => [(x - E.vue.ox) / E.vue.zoom, (y - E.vue.oy) / E.vue.zoom]
/* Les quatre coins du cadre d'origine (haut gauche, haut droit, bas
   droit, bas gauche), transformés, à l'écran. */
function coinsElement(el) {
  const W = E.apercu.largeur, H = E.apercu.hauteur, M = matriceApercu(el)
  const [u0, v0, u1, v1] = el.cadre
  return [[u0 * W, v0 * H], [u1 * W, v0 * H], [u1 * W, v1 * H], [u0 * W, v1 * H]].map(([x, y]) => versEcran(appliquer(M, x, y)))
}
/* Le tour d'une ligne en rond, transformé, à l'écran. */
function polyElement(el) {
  if (!el.poly) return null
  const W = E.apercu.largeur, H = E.apercu.hauteur, M = matriceApercu(el)
  return el.poly.map(([u, v]) => versEcran(appliquer(M, u * W, v * H)))
}
const enveloppe = pts => {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
  const x = Math.min(...xs), y = Math.min(...ys)
  return { x, y, l: Math.max(...xs) - x, h: Math.max(...ys) - y }
}
/* La sélection, telle qu'elle existe encore. */
function elementsChoisis() {
  const els = E.choix.map(elementDe).filter(Boolean)
  if (els.length !== E.choix.length) E.choix = els.map(e => e.ref)
  return els
}
function choisir(ref, ajouter = false) {
  if (ajouter) E.choix = choisi(ref) ? E.choix.filter(c => !memeRef(c, ref)) : E.choix.concat([ref])
  else E.choix = [ref]
  E.point = null
  majFormes()
  majPolice()
  dessiner()
}
/* Plus rien de choisi : l'inspecteur s'efface, les réglages reviennent. */
function viderChoix() {
  if (!E.choix.length && !E.point) return
  E.choix = []
  E.point = null
  majFormes()
  majPolice()
  dessiner()
}
/* L'ÉLÉMENT SOUS UN POINT DU PLAN : une ligne (son cadre transformé), puis
   une forme déplacée (elle est dessus : son antécédent dans la carte),
   puis une forme à sa place. */
function elementSous(x, y) {
  const k = ligneSous(x, y)
  if (k >= 0) return { ligne: k }
  const c = E.calques
  if (c && c.pleine === E.pleine && c.carte && E.resultatImage && !E.comparer && E.split === null) {
    const [ax, ay] = versApercu(x, y)
    const deplacees = transformationsDe().filter(e => e.u !== undefined)
    for (let i = deplacees.length - 1; i >= 0; i--) {
      const id = formeDeEntree(deplacees[i])
      if (!(id >= 0) || !formeListee(id) || formeRetiree(id)) continue
      const [ox, oy] = appliquer(inverse(matriceDe(deplacees[i], c.largeur)), ax, ay)
      const X = Math.floor(ox), Y = Math.floor(oy)
      if (X < 0 || Y < 0 || X >= c.largeur || Y >= c.hauteur) continue
      if (c.carte[Y * c.largeur + X] === id) return { forme: id }
    }
  }
  const id = formeSous(x, y)
  return id >= 0 ? { forme: id } : null
}
/* LES POIGNÉES de la sélection : huit points (0 haut gauche, puis dans le
   sens des aiguilles), ou les quatre coins d'un groupe qui a un élément
   tourné ; la zone de rotation, juste au-delà des coins. Rend le cadre
   (ses coins, son centre) de la sélection. */
function cadreChoix(els = elementsChoisis()) {
  if (!els.length) return null
  if (els.length === 1) {
    const coins = coinsElement(els[0])
    return { coins, centre: [(coins[0][0] + coins[2][0]) / 2, (coins[0][1] + coins[2][1]) / 2], seul: els[0], cotes: true }
  }
  const env = enveloppe(els.flatMap(coinsElement))
  const tourne = els.some(el => { const e = entreeCourante(el); return Math.abs(e.angle || 0) > 1e-9 })
  return { coins: [[env.x, env.y], [env.x + env.l, env.y], [env.x + env.l, env.y + env.h], [env.x, env.y + env.h]], centre: [env.x + env.l / 2, env.y + env.h / 2], seul: null, cotes: !tourne }
}
function poignees(cadre) {
  const c = cadre.coins, m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  return [c[0], m(c[0], c[1]), c[1], m(c[1], c[2]), c[2], m(c[2], c[3]), c[3], m(c[3], c[0])].map((p, i) => ({ i, x: p[0], y: p[1], coin: i % 2 === 0 })).filter(p => p.coin || cadre.cotes)
}
function poigneeSous(x, y) {
  const cadre = cadreChoix()
  if (!cadre) return null
  for (const p of poignees(cadre)) if (Math.abs(x - p.x) <= POIGNEE && Math.abs(y - p.y) <= POIGNEE) return { mode: p.coin ? 'coin' : 'cote', i: p.i }
  for (let i = 0; i < 4; i++) {
    const [cx, cy] = cadre.coins[i], d = Math.hypot(x - cx, y - cy)
    if (d > POIGNEE && d <= ROTATION && !dansQuadrilatere(cadre.coins, x, y)) return { mode: 'tourner', i: i * 2 }
  }
  return null
}
function dansQuadrilatere(coins, x, y) {
  let dedans = false
  for (let i = 0, j = 3; i < 4; j = i++) {
    const [xi, yi] = coins[i], [xj, yj] = coins[j]
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) dedans = !dedans
  }
  return dedans
}
/* Le curseur d'une poignée : celui du côté qu'elle tire, à l'angle près. */
function curseurPoignee(cadre, p) {
  if (p.mode === 'tourner') return CURSEUR_ROTATION
  const c = cadre.coins, centre = cadre.centre, pts = poignees(cadre)
  const h = pts.find(q => q.i === p.i) || { x: c[0][0], y: c[0][1] }
  const a = ((Math.atan2(h.y - centre[1], h.x - centre[0]) * 180 / Math.PI) + 360) % 180
  return a < 22.5 || a >= 157.5 ? 'ew-resize' : a < 67.5 ? 'nwse-resize' : a < 112.5 ? 'ns-resize' : 'nesw-resize'
}
/* LA PRISE : au pointerdown sur une poignée ou un élément ; le geste ne
   commence qu'à trois pixels (`commencerPrise`), un relâchement avant
   est un clic. */
function prendre(x, y, e) {
  const poignee = E.choix.length ? poigneeSous(x, y) : null
  const ref = poignee ? null : elementSous(x, y)
  if (!poignee && !ref) return false
  if (ref && e.shiftKey) { choisir(ref, true); if (!choisi(ref)) return true }
  else if (ref && !choisi(ref)) choisir(ref)
  E.prise = { mode: poignee ? poignee.mode : 'deplacer', poignee, x, y, bouge: false, entrees: null, ref, clic: !poignee && !e.shiftKey }
  return true
}
/* Le geste commence : les entrées de départ de chaque élément choisi, le
   cadre et le centre de départ, l'aperçu. Une ligne sans police dont les
   lettres tiennent au dessin ne se déplace pas (le fil ne saurait pas
   les prendre) : on le dit. */
function commencerPrise() {
  const p = E.prise
  const els = elementsChoisis()
  if (!els.length) { E.prise = null; return false }
  for (const el of els) {
    if (!el.ligne || (el.ligne.choix >= 0 && el.ligne.props[el.ligne.choix])) continue
    const img = E.resultatImage
    const essai = img && essayerRetrait(el.adresse, [Math.floor(el.cadre[0] * img.width), Math.floor(el.cadre[1] * img.height), Math.ceil(el.cadre[2] * img.width), Math.ceil(el.cadre[3] * img.height)])
    if (!essai || essai.part < 0.3) { toast('Ces lettres tiennent au dessin : choisissez une police pour les déplacer.', 'alerte'); E.prise = null; return false }
  }
  p.bouge = true
  p.depart = els.map(el => ({ ref: el.ref, el, entree: entreeDe(el), coins: coinsElement(el) }))
  p.cadre = cadreChoix(els)
  p.entrees = p.depart.map(d => ({ ref: d.ref, entree: d.entree }))
  p.guides = []
  p.etiquette = ''
  batirApercuPrise(els)
  r('scene').classList.add('o-studio-saisi')
  return true
}
/* Les entrées de la sélection, recalculées depuis le départ à chaque
   mouvement (rien ne s'accumule). */
function suivrePrise(x, y, e) {
  suivrePriseLibre(x, y, e)
  const p = E.prise
  if (p && p.entrees) p.entrees = bornerEntrees(p.entrees)
}
/* LE PLAN EST L'IMAGE : un élément poussé au-delà de son bord serait coupé
   (perdu). Les entrées se bornent — le cadre de la sélection reste dans
   l'image quand il y tient ; sinon il s'aligne sur son coin haut gauche. */
function bornerEntrees(entrees) {
  if (!E.apercu || !entrees.length) return entrees
  const W = E.apercu.largeur, H = E.apercu.hauteur
  let els = entrees.map(x => ({ x, el: elementDe(x.ref) })).filter(q => q.el)
  if (!els.length) return entrees
  const envDe = () => enveloppe(els.flatMap(({ x, el }) => coinsAvec(el, x.entree).map(([sx, sy]) => versApercu(sx, sy))))
  let env = envDe()
  /* Plus grand que l'image : réduit autour du centre de la sélection,
     jusqu'à y tenir (le geste bute). */
  if (env.l > W + 0.5 || env.h > H + 0.5) {
    const k = Math.min(W / env.l, H / env.h), cx = (env.x + env.l / 2) / W, cy = (env.y + env.h / 2) / W
    els = els.map(({ x, el }) => {
      const e0 = x.entree, c0 = [e0.pivot[0] + e0.d[0], e0.pivot[1] + e0.d[1]]
      const c1 = [cx + k * (c0[0] - cx), cy + k * (c0[1] - cy)]
      return { x: { ref: x.ref, entree: Object.assign({}, e0, { s: [e0.s[0] * k, e0.s[1] * k], d: [c1[0] - e0.pivot[0], c1[1] - e0.pivot[1]] }) }, el }
    })
    entrees = els.map(q => q.x)
    env = envDe()
  }
  let dx = 0, dy = 0
  if (env.x < 0) dx = -env.x; else if (env.x + env.l > W) dx = Math.max(-env.x, W - env.x - env.l)
  if (env.y < 0) dy = -env.y; else if (env.y + env.h > H) dy = Math.max(-env.y, H - env.y - env.h)
  if (!dx && !dy) return entrees
  return entrees.map(x => ({ ref: x.ref, entree: Object.assign({}, x.entree, { d: [x.entree.d[0] + dx / W, x.entree.d[1] + dy / W] }) }))
}
function suivrePriseLibre(x, y, e) {
  const p = E.prise
  const z = E.vue.zoom, W = E.apercu.largeur, asp = E.apercu.hauteur / W
  const enL = (dx, dy) => [dx / z / W, dy / z / W]
  const ecranVersL = ([sx, sy]) => { const [ax, ay] = versApercu(sx, sy); return [ax / W, ay / W] }
  const cadre = p.cadre, centre = cadre.centre
  p.guides = []
  if (p.mode === 'deplacer') {
    let dx = x - p.x, dy = y - p.y
    if (!e.ctrlKey && !e.metaKey) {
      const env = enveloppe(p.depart.flatMap(d => d.coins))
      const aimant = aimanter(env, dx, dy, p.depart.map(d => d.ref))
      dx = aimant.dx; dy = aimant.dy; p.guides = aimant.guides
    }
    const [lx, ly] = enL(dx, dy)
    p.entrees = p.depart.map(d => ({ ref: d.ref, entree: Object.assign({}, d.entree, { d: [d.entree.d[0] + lx, d.entree.d[1] + ly] }) }))
    const env = enveloppe(p.depart.flatMap(d => d.coins)), [ex, ey] = ecranVersL([env.x + dx, env.y + dy])
    p.etiquette = 'X ' + mmDe(ex * W) + ' · Y ' + mmDe(ey * W) + ' mm'
    return
  }
  if (p.mode === 'tourner') {
    let phi = (Math.atan2(y - centre[1], x - centre[0]) - Math.atan2(p.y - centre[1], p.x - centre[0])) * 180 / Math.PI
    if (e.shiftKey) phi = Math.round(phi / 15) * 15
    const [cx, cy] = ecranVersL(centre), co = Math.cos(phi * Math.PI / 180), si = Math.sin(phi * Math.PI / 180)
    p.entrees = p.depart.map(d => {
      const e0 = d.entree, c0 = [e0.pivot[0] + e0.d[0], e0.pivot[1] + e0.d[1]]
      const c1 = [cx + co * (c0[0] - cx) - si * (c0[1] - cy), cy + si * (c0[0] - cx) + co * (c0[1] - cy)]
      return { ref: d.ref, entree: Object.assign({}, e0, { angle: normaliserAngle((e0.angle || 0) + phi), d: [c1[0] - e0.pivot[0], c1[1] - e0.pivot[1]] }) }
    })
    const seul = p.entrees.length === 1 ? p.entrees[0].entree.angle : phi
    p.etiquette = (Math.round(seul * 10) / 10).toString().replace('.', ',') + '°'
    return
  }
  /* Un coin ou un côté : le point fixe (l'opposé, ou le centre avec Alt),
     les axes propres du cadre, le facteur sur chacun. */
  const i = p.poignee.i, coins = cadre.coins
  const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const points = [coins[0], m(coins[0], coins[1]), coins[1], m(coins[1], coins[2]), coins[2], m(coins[2], coins[3]), coins[3], m(coins[3], coins[0])]
  const F = e.altKey ? centre : points[(i + 4) % 8]
  const ex = unitaire(coins[1][0] - coins[0][0], coins[1][1] - coins[0][1]), ey = unitaire(coins[3][0] - coins[0][0], coins[3][1] - coins[0][1])
  const proj = (q, u) => (q[0] - F[0]) * u[0] + (q[1] - F[1]) * u[1]
  const depart = points[i], cur = [x, y]
  /* 0 haut gauche, 1 haut, 2 haut droit, 3 droite, 4 bas droit, 5 bas, 6
     bas gauche, 7 gauche : un côté haut ou bas ne tire que l'axe y. */
  const tireX = i !== 1 && i !== 5, tireY = i !== 3 && i !== 7
  let kx = 1, ky = 1
  const ax = proj(depart, ex), ay = proj(depart, ey)
  if (p.mode === 'coin' && !e.shiftKey) {
    const dd = [depart[0] - F[0], depart[1] - F[1]], l2 = dd[0] * dd[0] + dd[1] * dd[1] || 1
    kx = ky = ((cur[0] - F[0]) * dd[0] + (cur[1] - F[1]) * dd[1]) / l2
  } else {
    if (tireX && Math.abs(ax) > 1e-6) kx = proj(cur, ex) / ax
    if (tireY && Math.abs(ay) > 1e-6) ky = proj(cur, ey) / ay
  }
  if (!cadre.seul) { if (p.mode === 'coin') ky = kx; }
  const borne = k => Math.sign(k || 1) * Math.max(0.02, Math.abs(k))
  kx = borne(kx); ky = borne(ky)
  const [fx, fy] = ecranVersL(F)
  p.entrees = p.depart.map(d => {
    const e0 = d.entree
    if (cadre.seul) {
      /* L'échelle dans les axes propres ; `d` pour que F ne bouge pas :
         F = pivot + d' + R S' (pF − pivot), pF l'antécédent de F. */
      const s1 = [e0.s[0] * kx, e0.s[1] * ky]
      const Mi = inverse(matriceDe(e0, 1)), pF = appliquer(Mi, fx, fy)
      const r = (e0.angle || 0) * Math.PI / 180, co = Math.cos(r), si = Math.sin(r)
      const vx = s1[0] * (pF[0] - e0.pivot[0]), vy = s1[1] * (pF[1] - e0.pivot[1])
      const d1 = [fx - e0.pivot[0] - (co * vx - si * vy), fy - e0.pivot[1] - (si * vx + co * vy)]
      return { ref: d.ref, entree: Object.assign({}, e0, { s: s1, d: d1 }) }
    }
    /* Un groupe : uniforme autour de F (ou par axe, sans élément tourné). */
    const c0 = [e0.pivot[0] + e0.d[0], e0.pivot[1] + e0.d[1]]
    const c1 = [fx + kx * (c0[0] - fx), fy + ky * (c0[1] - fy)]
    return { ref: d.ref, entree: Object.assign({}, e0, { s: [e0.s[0] * kx, e0.s[1] * ky], d: [c1[0] - e0.pivot[0], c1[1] - e0.pivot[1]] }) }
  })
  const env = enveloppe(p.depart.flatMap(d => coinsAvec(d.el, p.entrees.find(q => memeRef(q.ref, d.ref)).entree)))
  const seul = cadre.seul ? p.entrees[0].entree : null
  const L = seul ? Math.abs(seul.s[0]) * (cadre.seul.lettres[2] - cadre.seul.lettres[0]) * W : env.l / z
  const Hh = seul ? Math.abs(seul.s[1]) * (cadre.seul.lettres[3] - cadre.seul.lettres[1]) * W * asp : env.h / z
  p.etiquette = mmDe(L) + ' × ' + mmDe(Hh) + ' mm · ' + Math.round(Math.abs(kx) * 100) + (Math.abs(kx - ky) > 1e-6 ? ' × ' + Math.round(Math.abs(ky) * 100) : '') + ' %'
}
const unitaire = (x, y) => { const n = Math.hypot(x, y) || 1; return [x / n, y / n] }
const normaliserAngle = a => { a = ((a % 360) + 360) % 360; return a > 180 ? a - 360 : a }
/* Les coins d'un élément pour une entrée donnée, à l'écran. */
function coinsAvec(el, entree) {
  const W = E.apercu.largeur, H = E.apercu.hauteur, M = matriceDe(entree, W)
  const [u0, v0, u1, v1] = el.cadre
  return [[u0 * W, v0 * H], [u1 * W, v0 * H], [u1 * W, v1 * H], [u0 * W, v1 * H]].map(([x, y]) => versEcran(appliquer(M, x, y)))
}
/* Des pixels d'aperçu en millimètres imprimés, une décimale. */
const mmDe = px => (Math.round(px / E.apercu.echelle * mmParPx() * 10) / 10).toFixed(1).replace('.', ',')
/* LES GUIDES : le cadre qui bouge (ses bords et son centre, sur chaque
   axe) s'aimante au plus proche des bords et centres de l'image et des
   autres éléments, à `AIMANT` pixels. */
function aimanter(env, dx, dy, exclus) {
  const W = E.apercu.largeur, H = E.apercu.hauteur
  const [ix, iy] = versEcran([0, 0]), [jx, jy] = versEcran([W, H])
  const xs = [ix, (ix + jx) / 2, jx], ys = [iy, (iy + jy) / 2, jy]
  const autres = []
  for (const f of formesListees()) if (!formeRetiree(f.id) && !exclus.some(r => r.forme === f.id)) { const el = elementDe({ forme: f.id }); if (el) autres.push(el) }
  const t = texteAJour() && E.textes.etat === 'pret' ? E.textes : null
  if (t) t.lignes.forEach((l, k) => { if (!ligneRetiree(l) && !exclus.some(r => r.ligne === k)) { const el = elementDe({ ligne: k }); if (el) autres.push(el) } })
  for (const el of autres) { const e = enveloppe(coinsElement(el)); xs.push(e.x, e.x + e.l / 2, e.x + e.l); ys.push(e.y, e.y + e.h / 2, e.y + e.h) }
  const miens = { x: [env.x + dx, env.x + dx + env.l / 2, env.x + dx + env.l], y: [env.y + dy, env.y + dy + env.h / 2, env.y + dy + env.h] }
  const guides = []
  let mx = null, my = null
  for (const a of miens.x) for (const b of xs) { const d = b - a; if (Math.abs(d) <= AIMANT && (mx === null || Math.abs(d) < Math.abs(mx))) mx = d }
  for (const a of miens.y) for (const b of ys) { const d = b - a; if (Math.abs(d) <= AIMANT && (my === null || Math.abs(d) < Math.abs(my))) my = d }
  if (mx !== null) { dx += mx; for (const a of miens.x) if (xs.some(b => Math.abs(b - a - mx) < 0.5)) guides.push({ x: a + mx }) }
  if (my !== null) { dy += my; for (const a of miens.y) if (ys.some(b => Math.abs(b - a - my) < 0.5)) guides.push({ y: a + my }) }
  return { dx, dy, guides }
}
/* L'APERÇU DU GESTE, sur l'aperçu : le résultat à l'écran (les lettres
   repeintes comprises) sans les pixels de la sélection à leur place du
   moment — le trou rebouché comme le fera le fil —, et un sprite par
   élément. */
function batirApercuPrise(els) {
  const toile = E.resultat, c = E.calques
  if (!toile || !E.apercu) { E.apercuPrise = null; return }
  const W = toile.width, H = toile.height
  const base = toile.getContext('2d').getImageData(0, 0, W, H)
  const fond = new Uint8ClampedArray(base.data)
  const masque = new Uint8Array(W * H)
  const sprites = []
  const carte = c && c.pleine === E.pleine && c.carte && c.largeur === W ? c.carte : null
  for (const el of els) {
    const M = matriceApercu(el), Mi = inverse(M)
    const coins = coinsElement(el).map(([x, y]) => versApercu(x, y))
    const env = enveloppe(coins)
    const x0 = Math.max(0, Math.floor(env.x) - 1), y0 = Math.max(0, Math.floor(env.y) - 1), x1 = Math.min(W - 1, Math.ceil(env.x + env.l) + 1), y1 = Math.min(H - 1, Math.ceil(env.y + env.h) + 1)
    const poly = el.poly ? el.poly.map(([u, v]) => [u * W, v * H]) : null
    const [u0, v0, u1, v1] = el.cadre
    let sx0 = W, sy0 = H, sx1 = -1, sy1 = -1
    const siens = []
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const q = y * W + x
        if (masque[q] || base.data[q * 4 + 3] < 32) continue
        const [ox, oy] = appliquer(Mi, x + 0.5, y + 0.5)
        const X = Math.floor(ox), Y = Math.floor(oy)
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue
        let sien
        if (el.forme) sien = carte ? carte[Y * W + X] === el.forme.id : ox >= u0 * W && ox <= u1 * W && oy >= v0 * H && oy <= v1 * H
        else {
          sien = ox >= u0 * W && ox <= u1 * W && oy >= v0 * H && oy <= v1 * H && (!poly || dansPolygone(poly, ox, oy, 0))
          /* Une forme listée qui n'est pas une lettre (le badge sous le
             texte) n'est pas à la ligne. */
          if (sien && carte) { const id = carte[Y * W + X]; if (id >= 0 && formeListee(id)) sien = false }
        }
        if (!sien) continue
        masque[q] = 1
        siens.push(q)
        if (x < sx0) sx0 = x; if (x > sx1) sx1 = x; if (y < sy0) sy0 = y; if (y > sy1) sy1 = y
      }
    }
    if (sx1 < 0) continue
    const sl = sx1 - sx0 + 1, sh = sy1 - sy0 + 1
    const sd = new Uint8ClampedArray(sl * sh * 4)
    for (const q of siens) { const x = q % W, y = (q - x) / W, i = q * 4, j = ((y - sy0) * sl + x - sx0) * 4; sd[j] = base.data[i]; sd[j + 1] = base.data[i + 1]; sd[j + 2] = base.data[i + 2]; sd[j + 3] = base.data[i + 3] }
    const t = toileDe(sl, sh)
    t.getContext('2d').putImageData(new ImageData(sd, sl, sh), 0, 0)
    sprites.push({ ref: el.ref, toile: t, x: sx0, y: sy0, M0: M, siens, cadre: [sx0, sy0, sx1, sy1] })
  }
  /* Les trous : chacun jugé sur l'image entière avant la première coupe,
     puis coupés, puis rebouchés — vite (un aperçu : 20 passes de détente). */
  const m = new Uint8Array(W * H)
  for (const s of sprites) { for (const q of s.siens) m[q] = 1; s.rebouche = anneauOpaque(fond, W, H, m, s.cadre); for (const q of s.siens) m[q] = 0 }
  for (const s of sprites) for (const q of s.siens) fond[q * 4 + 3] = 0
  for (const s of sprites) {
    if (!s.rebouche) continue
    for (const q of s.siens) m[q] = 1
    creuser(fond, W, H, m, { rebouche: true, cadre: s.cadre, relaxations: 20 })
    for (const q of s.siens) m[q] = 0
  }
  const f = toileDe(W, H)
  f.getContext('2d').putImageData(new ImageData(fond, W, H), 0, 0)
  E.apercuPrise = { fond: f, sprites, cle: null }
}
/* L'aperçu du geste à l'écran : le fond, puis chaque sprite par la
   matrice du moment (relative à sa place dans le fond). */
function dessinerApercuPrise(ctx) {
  const a = E.apercuPrise
  const { zoom, ox, oy } = E.vue
  ctx.drawImage(a.fond, ox, oy, E.apercu.largeur * zoom, E.apercu.hauteur * zoom)
  for (const s of a.sprites) {
    const el = elementDe(s.ref)
    if (!el) continue
    const M = matriceApercu(el), Mi = inverse(s.M0)
    /* M · M0⁻¹ : de la place du sprite à la nouvelle. */
    const R = composer(M, Mi)
    ctx.save()
    /* La toile lit a, b, c, d en colonnes : x' = a x + c y + e. */
    ctx.transform(zoom * R[0], zoom * R[2], zoom * R[1], zoom * R[3], ox + zoom * R[4], oy + zoom * R[5])
    ctx.drawImage(s.toile, s.x, s.y)
    ctx.restore()
  }
}
/* A · B (B d'abord). */
const composer = (A, B) => [A[0] * B[0] + A[1] * B[2], A[0] * B[1] + A[1] * B[3], A[2] * B[0] + A[3] * B[2], A[2] * B[1] + A[3] * B[3], A[0] * B[4] + A[1] * B[5] + A[4], A[2] * B[4] + A[3] * B[5] + A[5]]
/* LE GESTE FINI : les entrées écrites dans les réglages (un geste de
   l'historique), le calcul relancé ; l'aperçu reste jusqu'à l'image qui
   le contient (`recalculer`). */
function finirPrise() {
  const p = E.prise
  E.prise = null
  r('scene').classList.remove('o-studio-saisi')
  if (!p || !p.bouge) return
  if (!p.entrees) { E.apercuPrise = null; return dessiner() }
  geste(() => ecrireEntrees(p.entrees))
  if (E.apercuPrise) E.apercuPrise.cle = cleFin()
  dessiner()
}
function annulerPrise() {
  const p = E.prise
  if (!p) return
  E.prise = null
  E.apercuPrise = null
  r('scene').classList.remove('o-studio-saisi')
  dessiner()
}
/* LES ENTRÉES ÉCRITES : une par élément (l'identité retire l'entrée —
   « Replacer »), à sa place dans la liste (le dernier déplacé dessus) ;
   les lignes reposent leurs polices. */
function ecrireEntrees(entrees) {
  let liste = transformationsDe().slice()
  let lignes = false
  for (const { ref, entree } of bornerEntrees(entrees)) {
    const el = elementDe(ref)
    if (!el) continue
    if (el.ligne) lignes = true
    const propre = estIdentite(entree) ? null : Object.assign({}, el.adresse, { pivot: entree.pivot.slice(), d: entree.d.slice(), angle: entree.angle || 0, s: entree.s.slice() })
    const i = el.entree ? liste.indexOf(el.entree) : -1
    if (i >= 0) { if (propre) liste[i] = propre; else liste.splice(i, 1) } else if (propre) liste.push(propre)
  }
  const avant = cleFin()
  E.reglages = Object.assign({}, E.reglages, { transformations: liste })
  if (!liste.length) delete E.reglages.transformations
  /* Les fils ne revoient le détourage que s'ils voient autre chose : une
     ligne en police déplacée ne repose que ses lettres (`poserPolices`). */
  if (cleFin() !== avant) { recalculer(); planifierFin() }
  if (lignes) poserPolices()
  majPanneau()
}
/* Une transformation de plus sur toute la sélection : pousser (les
   flèches), retourner, remettre à sa place, ou une géométrie tapée. */
function transformerChoix(faire) {
  const els = elementsChoisis()
  if (!els.length) return
  const entrees = els.map(el => ({ ref: el.ref, entree: faire(entreeDe(el), el) })).filter(x => x.entree)
  if (entrees.length) geste(() => ecrireEntrees(entrees))
}
function pousserChoix(dx, dy) {
  const W = E.apercu.largeur, z = E.vue.zoom
  transformerChoix(e => Object.assign({}, e, { d: [e.d[0] + dx / z / W, e.d[1] + dy / z / W] }))
}
const retournerChoix = vertical => transformerChoix(e => Object.assign({}, e, { s: vertical ? [e.s[0], -e.s[1]] : [-e.s[0], e.s[1]] }))
const replacerChoix = () => transformerChoix(e => Object.assign({}, e, IDENTITE, { d: [0, 0], s: [1, 1] }))
/* SUPPR : la sélection se retire (le chemin de « Retirer »). */
function retirerChoix() {
  const els = elementsChoisis()
  if (!els.length) return
  E.point = null
  E.choix = []
  for (const el of els) { if (el.forme) retirerForme(el.forme); else retirerLigne(E.textes.lignes.indexOf(el.ligne)) }
}
/* LA SÉLECTION SUR LE PLAN : le cadre de chaque élément choisi (en plein,
   le tour d'une ligne en rond s'il en a un), les poignées, les guides et
   l'étiquette du geste. */
function dessinerSelection(ctx) {
  const els = elementsChoisis()
  if (!els.length || E.comparer || E.split !== null) return
  const cadre = cadreChoix(els)
  ctx.save()
  ctx.lineJoin = 'round'
  for (const el of els) {
    const poly = polyElement(el) || coinsElement(el)
    ctx.beginPath()
    poly.forEach(([x, y], j) => j ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
    ctx.closePath()
    ctx.strokeStyle = '#0284c7'
    ctx.lineWidth = els.length > 1 ? 1 : 1.5
    ctx.setLineDash([])
    ctx.stroke()
  }
  if (els.length > 1) {
    ctx.beginPath()
    cadre.coins.forEach(([x, y], j) => j ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
    ctx.closePath()
    ctx.strokeStyle = '#0284c7'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 3])
    ctx.stroke()
  }
  ctx.setLineDash([])
  for (const p of poignees(cadre)) {
    ctx.beginPath()
    ctx.rect(p.x - POIGNEE / 2, p.y - POIGNEE / 2, POIGNEE, POIGNEE)
    ctx.fillStyle = '#fff'
    ctx.fill()
    ctx.strokeStyle = '#0284c7'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
  const p = E.prise
  if (p && p.bouge) {
    const W = ctx.canvas.clientWidth, H = ctx.canvas.clientHeight
    /* Le bord de l'image : au-delà, rien ne s'imprime. */
    const [ix, iy] = versEcran([0, 0]), [jx, jy] = versEcran([E.apercu.largeur, E.apercu.hauteur])
    ctx.strokeStyle = 'rgba(2,132,199,.5)'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.strokeRect(Math.round(ix) + 0.5, Math.round(iy) + 0.5, Math.round(jx - ix), Math.round(jy - iy))
    ctx.setLineDash([])
    ctx.strokeStyle = MAGENTA
    ctx.lineWidth = 1
    for (const g of p.guides || []) {
      ctx.beginPath()
      if (g.x !== undefined) { ctx.moveTo(Math.round(g.x) + 0.5, 0); ctx.lineTo(Math.round(g.x) + 0.5, H) }
      else { ctx.moveTo(0, Math.round(g.y) + 0.5); ctx.lineTo(W, Math.round(g.y) + 0.5) }
      ctx.stroke()
    }
    if (p.etiquette && p.souris) {
      ctx.font = '600 12px ' + getComputedStyle(document.body).fontFamily
      const L = ctx.measureText(p.etiquette).width + 16, Hh = 22
      const x = Math.max(4, Math.min(W - L - 4, p.souris[0] + 16)), y = Math.max(4, Math.min(H - Hh - 4, p.souris[1] + 18))
      ctx.fillStyle = '#0284c7'
      ctx.beginPath()
      ctx.roundRect(x, y, L, Hh, 11)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.textBaseline = 'middle'
      ctx.fillText(p.etiquette, x + 8, y + Hh / 2 + 0.5)
    }
  }
  ctx.restore()
}
/* LA GÉOMÉTRIE DANS LA BULLE : X, Y (le coin haut gauche du cadre, en mm
   depuis le coin du fichier), L, H (en proportion sous le cadenas),
   l'angle ; Retourner ↔ ↕, Replacer. */
function htmlGeometrie(ref) {
  const el = elementDe(ref)
  if (!el || !E.apercu) return ''
  const e = entreeDe(el), W = E.apercu.largeur, asp = E.apercu.hauteur / W
  const env = enveloppe(coinsElement(el).map(([x, y]) => versApercu(x, y)))
  const L = Math.abs(e.s[0]) * (el.lettres[2] - el.lettres[0]) * W, H = Math.abs(e.s[1]) * (el.lettres[3] - el.lettres[1]) * W * asp
  const champ = (c, v, titre, unite, mot = c.toUpperCase()) => '<label class="o-studio-geo-champ" title="' + titre + '"><span>' + mot + '</span><input type="text" inputmode="decimal" data-c="geo-' + c + '" value="' + v + '" spellcheck="false" autocomplete="off"><small>' + unite + '</small></label>'
  return '<div class="o-studio-geo" data-r="geo">'
    + champ('x', mmDe(env.x), 'Depuis le bord gauche du fichier', 'mm') + champ('y', mmDe(env.y), 'Depuis le haut du fichier', 'mm')
    + champ('l', mmDe(L), 'Largeur imprimée', 'mm')
    + '<button type="button" class="o-studio-geo-cadenas" data-a="geo-cadenas" aria-pressed="' + String(E.cadenas) + '" title="' + (E.cadenas ? 'Les proportions sont gardées' : 'Largeur et hauteur libres') + '" aria-label="Garder les proportions">' + ic(E.cadenas ? 'lock' : 'unlock') + '</button>'
    + champ('h', mmDe(H), 'Hauteur imprimée', 'mm')
    + champ('angle', (Math.round((e.angle || 0) * 10) / 10).toString().replace('.', ','), 'Rotation (Maj + glisser hors d\'un coin : par 15°)', '°', '∠')
    + '<span class="o-studio-geo-boutons">'
    + '<button type="button" class="o-studio-bouton" data-a="geo-retourner-h" title="Retourner horizontalement" aria-label="Retourner horizontalement">' + ic('flip-horizontal') + '</button>'
    + '<button type="button" class="o-studio-bouton" data-a="geo-retourner-v" title="Retourner verticalement" aria-label="Retourner verticalement">' + ic('flip-vertical') + '</button>'
    + (el.entree ? '<button type="button" class="o-studio-bouton" data-a="geo-replacer" title="Remettre à sa place et à sa taille d\'origine">' + ic('rotate-ccw') + '<span>Replacer</span></button>' : '')
    + '</span></div>'
}
/* Un champ de géométrie validé : X, Y → d ; L, H → s (le centre fixe) ;
   l'angle → angle. */
function geometrieTapee(c, valeur) {
  const els = elementsChoisis()
  if (els.length !== 1 || !E.apercu) return
  const el = els[0], e = entreeDe(el), W = E.apercu.largeur, asp = E.apercu.hauteur / W
  /* Le nombre tapé, tel quel (pas la taille d'impression et ses bornes) : « 12,3 »,
     « 0 », « -4 ». */
  const v = Number(String(valeur).replace(',', '.').replace(/[^\d.-]/g, ''))
  if (!Number.isFinite(v) || valeur.trim() === '') return majGeometrie()
  if (c === 'angle') return transformerChoix(x => Object.assign({}, x, { angle: normaliserAngle(v) }))
  if ((c === 'l' || c === 'h') && !(v > 0)) return majGeometrie()
  const px = v / mmParPx() * E.apercu.echelle
  if (c === 'x' || c === 'y') {
    const env = enveloppe(coinsElement(el).map(([x, y]) => versApercu(x, y)))
    const delta = c === 'x' ? [px - env.x, 0] : [0, px - env.y]
    return transformerChoix(x => Object.assign({}, x, { d: [x.d[0] + delta[0] / W, x.d[1] + delta[1] / W] }))
  }
  const L0 = (el.lettres[2] - el.lettres[0]) * W, H0 = (el.lettres[3] - el.lettres[1]) * W * asp
  if (L0 <= 0 || H0 <= 0) return
  let sx = Math.abs(e.s[0]), sy = Math.abs(e.s[1])
  if (c === 'l') { const k = Math.max(0.02, px / L0) / sx; sx *= k; if (E.cadenas) sy *= k }
  else { const k = Math.max(0.02, px / H0) / sy; sy *= k; if (E.cadenas) sx *= k }
  transformerChoix(x => Object.assign({}, x, { s: [Math.sign(x.s[0]) * sx, Math.sign(x.s[1]) * sy] }))
}
function majGeometrie() {
  majInspecteur()
}

/* ------------------------------------------------------------ LE PANNEAU */
/* LES GESTES QUE L'HISTORIQUE NOTE : ce qui change un réglage. Le fond de
   l'aperçu, le zoom, « Comparer », un export n'en sont pas. Le libellé se
   lit entre les deux photos (lib/historique.js, `decrire`), sauf ici. */
const GESTES = new Set(['ligne-police', 'fond-retire', 'nettoyer', 'net', 'ultra', 'version', 'teinte-mode', 'teinte', 'pop-nuancier', 'pop-origine', 'pop-retirer', 'pop-remettre', 'contour-couleur', 'retirer-element', 'retirer-ligne', 'insp-retirer', 'element-couleur', 'element-origine', 'oeil-forme', 'oeil-ligne', 'ligne-couleur', 'ligne-origine', 'lasso-retirer', 'lasso-combler', 'geo-retourner-h', 'geo-retourner-v', 'geo-replacer'])
const LIBELLES = {
  net: () => netMontre() ? 'Améliorer la netteté' : 'Sans amélioration de la netteté',
}

function clic(e) {
  const b = e.target.closest('[data-a]')
  if (!b || !(E.racine.contains(b) || (E.barre && E.barre.contains(b)))) {
    if (E.pop && !e.target.closest('[data-r="pop"]')) fermerPop()
    if (E.menu && !e.target.closest('[data-r="menu"]')) fermerMenu()
    if (E.historique && !e.target.closest('[data-r="historique"]')) fermerHistorique()
    if (E.lasso && E.lasso.poly && !e.target.closest('[data-r="pop-lasso"], [data-r="toile"]')) annulerLasso()
    return
  }
  const a = b.dataset.a
  const v = b.dataset.v
  if (a !== 'couleur' && !a.startsWith('pop-') && E.pop) fermerPop()
  if (a !== 'menu' && !b.closest('[data-r="menu"]') && E.menu) fermerMenu()
  if (a !== 'historique' && !b.closest('[data-r="historique"]') && E.historique) fermerHistorique()
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
  /* L'INSPECTEUR : une ligne du bloc « Calques » s'ouvre (et vient à
     l'écran) ; dans l'inspecteur, une police (ou le dessin d'origine) se
     choisit ; « ← » revient aux réglages, « ‹ › » passe à l'élément
     voisin. */
  if (a === 'ligne') return ouvrirLigne(Number(v), true)
  if (a === 'insp-retour') return viderChoix()
  if (a === 'insp-suivant') return sauter(Number(v))
  if (a === 'insp-retirer') return retirerChoix()
  if (a === 'ligne-police') {
    const l = texteAJour() && E.textes.lignes[ligneInspectee()]
    if (l && !l.recherche) { l.choix = Number(v); l.main = true; majPolice(); poserPolices() }
    return
  }
  if (a === 'menu') return E.menu ? fermerMenu() : ouvrirMenu()
  if (a === 'fond') {
    E.fondVue = { type: v, couleur: E.fondVue.couleur }
    garderFondVue()
    return majPanneau()
  }
  if (a === 'cotes') return basculerCotes()
  /* LA GOMME et son lasso. */
  if (a === 'gomme') return prendreGomme()
  if (a === 'lasso-annuler') return annulerLasso()
  if (a === 'lasso-retirer') return retirerLasso()
  if (a === 'lasso-combler') return comblerLasso()
  /* RETIRER : l'élément ou la ligne de l'inspecteur. */
  if (a === 'retirer-element') return retirerElement()
  if (a === 'retirer-ligne') return retirerLigne(ligneInspectee())
  /* LES CALQUES : une forme du bloc s'ouvre dans l'inspecteur, son œil,
     sa couleur ; l'œil et la couleur d'une ligne de texte. */
  if (a === 'forme') return ouvrirElement(0, 0, Number(v), true)
  if (a === 'oeil-forme') return basculerForme(Number(v))
  if (a === 'element-couleur') return colorerElement(hexVersRvb(v))
  if (a === 'element-origine') return colorerElement(null)
  if (a === 'oeil-ligne') return basculerLigne(Number(v))
  /* LA GÉOMÉTRIE D'UN ÉLÉMENT (les calques déplacés) : le cadenas des
     proportions, retourner, replacer. */
  if (a === 'geo-cadenas') { E.cadenas = !E.cadenas; return majGeometrie() }
  if (a === 'geo-retourner-h') return retournerChoix(false)
  if (a === 'geo-retourner-v') return retournerChoix(true)
  if (a === 'geo-replacer') return replacerChoix()
  if (a === 'ligne-couleur' || a === 'ligne-origine') {
    const l = texteAJour() && E.textes.lignes[ligneInspectee()]
    if (!l || l.recherche) return
    l.couleur = a === 'ligne-couleur' ? hexVersRvb(v) : null
    l.main = true
    if (l.couleur && l.choix < 0 && l.props[0]) l.choix = 0
    majPolice()
    return poserPolices()
  }
  /* LA COULEUR DU CONTOUR (choisie sans épaisseur : 1 mm). */
  if (a === 'contour-couleur') {
    E.contour = { mm: E.contour.mm || 1, nom: v }
    majContour()
    planifierContour(0)
    return dessiner()
  }
  /* LA RÉSERVE DES POLICES : celles du poste (sur ce clic, Chrome demande
     la permission), une police à déposer, une police cherchée par nom. */
  if (a === 'poste') return chargerReserve(true)
  if (a === 'ajouter-police') return r('fichier-police').click()
  if (a === 'essayer-police') {
    const f = E.cherche.trouvees && E.cherche.trouvees[Number(v)]
    return f && essayerPolice(E.cherche.k, f)
  }
  if (a === 'taille-fichier') return choisirTaille(null)
  if (!E.apercu) return
  if (a === 'split') basculerSplit()
  else if (a === 'fond-retire') {
    /* La vendeuse contredit le graphiste : le fond autour du logo, partout
       (le noir enfermé dans un cercle, le creux des lettres), ou le sujet
       d'une photo. Un nouveau clic sur « Sujet » après un échec réessaie. */
    /* LE FOND GARDÉ (12 octobre 2026, « une pochette d'album, une
       affiche : juste les améliorer en gardant le rectangle ») : rien ne
       part — et, tant que la vendeuse n'a pas choisi la version, l'image
       se montre en Détouré, ses pixels tels quels. */
    const methode = v === 'sujet' ? 'ia' : v === 'entier' ? 'entier' : 'uni'
    const interieur = methode === 'uni' ? v === 'partout' : E.reglages.interieur
    if (methode === E.methode && interieur === E.reglages.interieur && !(methode === 'ia' && E.ia.erreur)) return
    if (methode !== E.methode) E.fondChoisi = true
    if (interieur !== E.reglages.interieur) E.creuxChoisi = true
    const avant = E.methode
    E.methode = methode
    E.reglages = Object.assign({}, E.reglages, { interieur })
    E.ia.erreur = ''
    if (!E.vueChoisie && E.decision) {
      const version = methode === 'entier' ? 'detoure' : avant === 'entier' ? E.decision.version : E.version
      if (version !== E.version) { E.version = version; planifierVecteur(0) }
    }
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
    /* « Améliorer la netteté » : l'IA repart du fichier reçu, avec ou sans
       le flou retiré ; cochée sans l'IA, elle la lance. */
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
  /* Comparer montre l'avant et l'après, pas une sélection : l'inspecteur
     s'efface. */
  if (E.split !== null) viderChoix()
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
const TENUS = ['seuil', 'lissage', 'nuances', 'gras', 'pop-couleur', 'contour']

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
    contour: Object.assign({}, E.contour),
    ia: n.enCours ? n.demande : E.original ? (n.force ? 'ultra' : 'oui') : 'non',
    net: E.net,
    comblements: E.comble.liste.slice(),
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
    lignes: t.lignes.map(l => ({ texte: l.texte, props: l.props, ecriture: !!l.ecriture, reconnue: !!l.reconnue, choix: l.choix, gras: l.gras || 0, couleur: l.couleur || null, main: !!l.main, edite: !!l.edite, recherche: !!l.recherche, police: l.choix >= 0 && l.props[l.choix] ? l.props[l.choix].nom : null })),
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
  /* Un geste en cours sur le plan s'annule, son aperçu aussi. */
  if (E.prise) annulerPrise()
  E.apercuPrise = null
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
  E.contour = Object.assign({ mm: 0, nom: 'Blanc' }, p.contour)
  E.point = null
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
  if (E.nettoyage.enCours !== avant.enCours || E.original !== avant.original || E.version !== avant.version || E.methode !== avant.methode || E.reglages.interieur !== avant.interieur || E.comble.enCours) preparer()
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
  /* Les rebouchages de la photo : rejoués sur l'image d'avant quand ils
     diffèrent — après l'IA si elle repart (elle les rejoue en finissant). */
  const comblements = p.comblements || []
  const memes = JSON.stringify(comblements) === JSON.stringify(E.comble.liste)
  E.comble.liste = comblements
  if (p.ia === 'non') { if (E.original) revenirOriginal(); else if (!memes) comblerImage(comblements); return }
  if (n.enCours || (E.original && voulue(n.force ? 'ultra' : 'oui', n.faiteNet))) { if (!n.enCours && !memes) comblerImage(comblements); return }
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
    pp.lignes.forEach((s, i) => Object.assign(t.lignes[i], { texte: s.texte, props: s.props, ecriture: s.ecriture, reconnue: s.reconnue, choix: s.choix, gras: s.gras, couleur: s.couleur || null, main: s.main, edite: s.edite, recherche: false }))
    if (attente) attente.polices = null
    /* Une ligne photographiée pendant sa recherche (son texte corrigé, ses
       polices pas encore là) la relance. */
    pp.lignes.forEach((s, i) => { if (s.recherche) relireLigne(i, s.texte, true) })
  } else {
    for (const l of t.lignes) Object.assign(l, l.defaut, { gras: 0, couleur: null, main: false, edite: false, recherche: false })
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

  /* LE FOND : autour, partout, le sujet d'une photo, ou gardé entier — et
     la couleur retirée. */
  const entier = E.methode === 'entier'
  const retire = ia ? 'sujet' : entier ? 'entier' : E.reglages.interieur ? 'partout' : 'autour'
  R.querySelectorAll('[data-a="fond-retire"]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === retire)))
  const resFond = r('res-fond')
  const fonds = image && !ia && !entier ? E.fondsLus.slice(0, 2) : []
  const dessinFond = entier ? 'Gardé' : ia ? 'IA' : fonds.length ? fonds.map(c => '<i class="o-studio-fond-teinte" style="background:' + rvbHex(c) + '" title="' + rvbHex(c).toUpperCase() + '"></i>').join('') : image && E.resultatImage ? 'Transparent' : ''
  if (resFond.innerHTML !== dessinFond) resFond.innerHTML = dessinFond

  /* LES CURSEURS : le seuil (à la couleur près pour un fond uni, la
     confiance de l'IA pour le sujet d'une photo ; rien à régler quand le
     fond reste), le lissage du tracé. */
  const seuil = R.querySelector('[data-c="seuil"]')
  seuil.closest('.o-studio-curseur').hidden = entier
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

  /* L'AMÉLIORATION IA. */
  basculer('nettoyer', E.nettoyage.enCours || !!E.original)
  basculer('net', netMontre())
  majNettoyage()

  /* LE MENU « PLUS » : les autres formats. */
  const menu = r('menu')
  menu.hidden = !E.menu
  R.querySelector('[data-a="menu"]').setAttribute('aria-expanded', String(E.menu))
  R.querySelectorAll('.o-studio-menu [data-a="enregistrer"]').forEach(b => { b.disabled = !pret || !!E.exporte || (b.dataset.v === 'eps' && degradeRendu()) })

  /* DÉTOURÉ, VECTEUR OU IMAGE, en haut à gauche ; Détouré n'a ni tracé,
     ni couleurs, ni SVG, ni EPS. */
  R.querySelectorAll('[data-trace]').forEach(el => { el.hidden = E.version === 'detoure' })
  R.querySelectorAll('[data-a="version"]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === E.version)))
  r('modes').classList.toggle('o-studio-cache', !image)

  /* LE PLAN : son fond, « Comparer ». */
  R.querySelector('[data-a="split"]').setAttribute('aria-pressed', String(E.split !== null))
  R.querySelector('[data-a="cotes"]').setAttribute('aria-pressed', String(E.cotes))
  R.querySelector('[data-a="gomme"]').setAttribute('aria-pressed', String(E.outil === 'gomme'))
  r('scene').dataset.outil = E.outil
  majTaille()
  majContour()
  planifierContour()
  const scene = r('scene')
  scene.dataset.fond = E.fondVue.type
  scene.style.setProperty('--fond-couleur', E.fondVue.couleur)
  r('pastille-couleur').style.background = E.fondVue.couleur
  const choix = R.querySelector('[data-c="fond-couleur"]')
  if (document.activeElement !== choix) choix.value = E.fondVue.couleur
  R.querySelectorAll('[data-a="fond"]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === E.fondVue.type)))
  r('vuebar').classList.toggle('o-studio-cache', !image)
  r('badge').hidden = !E.comparer
  majZoom()
  majEtat()
}

/* « Améliorer la netteté » cochée : voulue, et l'IA passe (ou est
   passée). */
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
   fichier, l'IA cochée ou décochée, « Améliorer la netteté », l'Ultra, le
   fond ou la version — jamais avec un curseur, ni une teinte, ni une
   police. Le panneau paraît au premier calcul de plus de 400 ms
   (`MONTRER`) et part
   dès que le contrôle presse a fini ; un échec y reste, en rouge, à la
   place du toast. L'état de chaque étape se lit sur celui du studio (un
   fil fermé ne laisse rien « en cours ») ; les fils n'y ajoutent que
   leurs durées, le modèle du sujet, le flou retiré et le temps jaugé de
   l'Ultra. Il suit le calcul sans jamais le faire attendre. */
const ETAPES = [
  ['fichier', 'Lecture du fichier'],
  ['net', 'Améliorer la netteté'],
  ['ia', 'Améliorer l\'image'],
  ['combler', 'Combler'],
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

/* Les étapes qui tournent pour ce fichier : l'IA et son « Améliorer la
   netteté » pendant qu'ils passent, le sujet par l'IA, le tracé hors de
   Détouré. */
function prevue(id) {
  const p = prep
  if (id === 'fichier') return p.fichier
  if (!p.lu || !E.apercu) return false
  const n = E.nettoyage
  if (id === 'net') return n.enCours && n.flou > 0
  if (id === 'ia') return n.enCours
  if (id === 'combler') return E.comble.enCours
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
  if (id === 'combler') return E.comble.enCours ? (n.enCours ? 'attente' : 'cours') : 'fait'
  if (E.comble.enCours && !n.enCours) return 'attente'
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
  if (id === 'combler') return { part: E.comble.part || null, mot: '' }
  if (id === 'sujet' && E.ia.etape === 'telechargement') return { part: E.ia.part, mot: 'téléchargement' }
  if (id === 'texte' && E.textes && E.textes.etat === 'recherche' && E.textes.part !== undefined) return { part: E.textes.part, mot: 'polices' }
  return { part: null, mot: '' }
}

/* LE TEMPS QUI RESTE à une étape qui avance. L'Ultra : le temps jaugé
   dans son fil pour `ULTRA_AUTO` (lib/detourage-travail.js, `ultra`), ou
   celui qu'annonçait « Passer en Ultra ». L'IA, « Améliorer la
   netteté », un téléchargement : à l'allure de leur avancement, régulier,
   dès qu'elle se lit (5 % en une seconde au moins). Les polices, ligne à
   ligne, n'ont pas d'allure ; 0 : on ne le sait pas. */
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
    if (pal.dataset.dessin !== html) {
      /* Redessinée (la bulle d'une teinte qui s'ouvre), la pastille garde
         la main du clavier. */
      const actif = pal.contains(document.activeElement) ? document.activeElement.dataset.v : null
      pal.innerHTML = html
      pal.dataset.dessin = html
      if (actif) { const el = [...pal.querySelectorAll('[data-a="couleur"]')].find(b => b.dataset.v === actif); if (el) el.focus() }
    }
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
    + '<small>' + (f.officielle ? 'Nuancier' : 'Converti en FOGRA39') + '</small>'
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
const choixPolices = () => texteAJour() ? E.textes.lignes.filter(l => l.choix >= 0 && l.props[l.choix] && !ligneRetiree(l)).map(l => Object.assign({ boite: l.boite, texte: l.texte, ecriture: !!l.ecriture, gras: l.gras || 0, couleur: l.couleur || null, m: entreeLigne(l) }, l.props[l.choix])) : []
const GRAISSES = { 100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black' }
/* Une police du poste dit son vrai style (« Futura Condensed Medium »,
   « Avenir Book »). */
const nomPolice = p => {
  if (!p.styleNom) return p.nom + ' ' + (GRAISSES[p.graisse] || p.graisse) + (p.style === 'italic' ? ' Italic' : '')
  if (/^(regular|normal|roman|plain)$/i.test(p.styleNom)) return p.nom
  /* « Futura Condensed » + « Condensed Medium » : le mot ne se répète pas. */
  const dernier = p.nom.split(' ').pop().toLowerCase() + ' '
  return p.nom + ' ' + (p.styleNom.toLowerCase().startsWith(dernier) ? p.styleNom.slice(dernier.length) : p.styleNom)
}
/* D'où vient une police : du poste, déposée — Google, sans le dire. */
const SOURCES = { poste: 'poste', ajout: 'ajoutée' }
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
/* LE FIL DU TEXTE reste d'une image à l'autre (1er octobre 2026) : la
   lecture (PP-OCRv5), l'index des polices et celles déjà lues y restent
   chargés (au plus 600 polices lues, lib/detourage-travail.js). Il ne se
   ferme que pour couper un calcul de l'image d'avant. */
function filDuTexte() {
  if (!filTexte) { filTexte = filDedie(Reserve.octets); envoyerReserve(filTexte) }
  return filTexte
}

/* UNE LIGNE DU TEXTE, de ce que le fil en a lu (`l`, sa lecture `lu`) et
   des polices qu'il y a trouvées (`x`) — null : pas une ligne. */
function ligneTrouvee(i, l, lu, x) {
  if (!x || !x.props.length) return null
  /* Une écriture n'est jamais la police exacte : proposée. Un bout de
     dessin lu de travers (« Cats », à 44 de confiance, une écriture
     chinoise à 51 %) n'est pas une ligne : il ne s'affiche pas. */
  if (x.ecriture && lu.confiance < 50 && x.props[0].note < 0.6) return null
  if (x.ecriture) return { ligne: i, boite: l.boite, contour: l.contour, texte: x.texte, props: x.props, ecriture: true, reconnue: false, choix: -1, lu, gras: 0, grasMax: l.grasMax }
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
  /* Ni des lettres à ombre portée (`ombre`) : la police posée l'effacerait. */
  const reconnue = !l.petite && !l.contour && !l.chaine && !l.ombre && x.texte.replace(/\s+/g, '') === lu.texte.replace(/\s+/g, '') && p0.note >= RECONNUE && p0.pire >= LETTRE_SURE && lu.confiance >= LUE_SURE && (lu.mot >= LUE_SURE || p0.pire >= LETTRE_CERTAINE)
  return { ligne: i, boite: l.boite, contour: l.contour, texte: x.texte, props: x.props, reconnue, choix: reconnue ? 0 : -1, lu, gras: 0, grasMax: l.grasMax }
}
/* Ce que le graphiste a lu et posé : l'historique y revient. */
const retenirDefaut = l => { l.defaut = { texte: l.texte, props: l.props, ecriture: !!l.ecriture, reconnue: l.reconnue, choix: l.choix } }

async function lireTexte() {
  const p = E.pleine
  if (!p || E.nettoyage.enCours || texteAJour()) return
  const n = ++nTexte
  /* Un calcul en cours pour l'image d'avant se coupe avec son fil. */
  if (filTexte && filTexte.occupe()) { filTexte.fermer(); filTexte = null }
  E.ligneSurvol = -1
  const fil = filDuTexte()
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
    /* La recherche se garde : la réserve qui change la relance
       (`relancerPolices`). */
    t.demande = { type: 'polices', cle: p.n, textes, lectures, symboles: lus.map(l => l.symboles || null), sures: lus.map(l => lue(l, LUE_CERTAINE)) }
    t.lus = lus
    t.trouvees = rep.lignes
    const r = rep.lignes.length ? await fil.demander(t.demande, suivre) : { lignes: [] }
    if (n !== nTexte) return
    t.lignes = rep.lignes.map((l, i) => ligneTrouvee(i, l, lus[i], r.lignes[i])).filter(Boolean)
    for (const l of t.lignes) retenirDefaut(l)
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

/* ------------------------------------------- LA RÉSERVE DES POLICES
   (1er octobre 2026, « le meilleur détecteur de police au monde ») Les
   1 906 familles de Google ne savent rien des polices commerciales ; le
   poste les a souvent (Helvetica, Futura, Century Gothic, Cooper…) :
   Chrome les prête sur un clic, et on peut en déposer. Elles se
   reconnaissent comme les autres (lib/polices-poste.js). */
/* Des faces lues et mesurées, dans un fil à elles : une image qui
   s'ouvre (et coupe le fil du texte) ne les interrompt pas. Il se ferme
   quand la réserve est lue. */
let filMesure = null
function decrireLot(faces, transfert) {
  filMesure = filMesure || filDedie()
  return filMesure.demander({ type: 'decrire', faces }, () => {}, transfert).then(r => r.faces)
}
function fermerMesure() {
  if (filMesure && !filMesure.occupe()) { filMesure.fermer(); filMesure = null }
}
/* Les familles de la réserve, données au fil du texte (sans attendre :
   le fil les pose avant la recherche qui suit). */
function envoyerReserve(fil) {
  if (!fil) return
  fil.envoyer({ type: 'reserve', source: 'poste', faces: E.reserve.faces || [] })
  fil.envoyer({ type: 'reserve', source: 'ajout', faces: E.reserve.ajouts || [] })
}
/* LES POLICES DU POSTE : d'office si le poste les a déjà prêtées (la
   permission « Polices » du site, gardée par Chrome) ; `demande` : sur un
   clic, Chrome la demande. Lues une fois, mesurées une fois — le coffre
   s'en souvient. Puis le texte à l'écran se recherche avec elles. */
async function chargerReserve(demande = false) {
  const R = E.reserve
  if (R.poste === 'lecture') return
  /* Sur un clic, la demande part tout de suite (Chrome ne la permet que
     dans l'élan du geste). */
  const etat = demande ? 'prompt' : await Reserve.etatPoste()
  if (etat === 'granted' || (demande && R.poste !== 'absent')) {
    R.poste = 'lecture'
    R.part = 0
    majReserve()
    try {
      R.faces = await Reserve.lirePoste(decrireLot, part => { R.part = part; majReserve() })
      R.poste = 'pret'
    } catch (e) {
      R.poste = (await Reserve.etatPoste()) === 'denied' ? 'denied' : 'erreur'
      if (demande) toast(R.poste === 'denied' ? 'Polices du poste refusées : autorisez « Polices » dans les réglages du site (le cadenas, à gauche de l\'adresse).' : 'Les polices du poste ne se lisent pas.', 'alerte')
    }
  } else R.poste = etat
  R.ajouts = await Reserve.lireAjouts(decrireLot)
  fermerMesure()
  R.catalogue = null
  envoyerReserve(filTexte)
  majReserve()
  if (demande) relancerPolices()
}
/* DÉPOSER DES POLICES (le bouton « Ajouter », ou un fichier de police
   lâché sur le plan) : gardées sur ce poste, reconnues ensuite comme les
   autres. */
async function ajouterPolices(fichiers) {
  if (!fichiers.length) return
  const { ajoutees, refusees, gardees } = await Reserve.ajouterPolices(fichiers, decrireLot)
  E.reserve.ajouts = await Reserve.lireAjouts()
  fermerMesure()
  E.reserve.catalogue = null
  envoyerReserve(filTexte)
  majReserve()
  toast(ajoutees ? ajoutees + ' police' + (ajoutees > 1 ? 's' : '') + ' ajoutée' + (ajoutees > 1 ? 's' : '') + (gardees ? '' : ' pour cette visite (le navigateur refuse de les garder)') + (refusees.length ? ' · refusée' + (refusees.length > 1 ? 's' : '') + ' : ' + refusees.join(', ') : '') : 'Pas une police de texte latin : ' + refusees.join(', '), ajoutees && gardees ? 'ok' : 'alerte')
  if (ajoutees) relancerPolices()
}
const POLICE_FICHIER = /\.(ttf|otf|woff2?|ttc)$/i
/* TOUTES LES FAMILLES (Google, le poste, les déposées), pour la recherche
   par nom de l'inspecteur. */
function catalogue() {
  const R = E.reserve
  if (!R.catalogue) R.catalogue = filDuTexte().demander({ type: 'catalogue' }).then(r => r.familles).catch(() => { R.catalogue = null; return [] })
  return R.catalogue
}
/* Les familles d'un lot de faces (leurs noms). */
const familles_ = faces => new Set((faces || []).map(d => d.famille.toLowerCase())).size
/* LA LIGNE DE LA RÉSERVE, au pied du bloc « Police ». */
function majReserve() {
  const d = r('reserve-dit')
  if (!d) return
  const R = E.reserve
  const dit = ['Google 1 906'].concat(R.faces ? ['poste ' + familles_(R.faces)] : [], R.ajouts.length ? ['ajoutées ' + familles_(R.ajouts)] : []).join(' · ')
  if (d.textContent !== dit) d.textContent = dit
  d.title = 'Les familles où la police se cherche : ' + dit
  const b = r('poste')
  b.hidden = ['absent', 'pret'].includes(R.poste)
  b.disabled = R.poste === 'lecture' || R.poste === 'denied'
  b.title = R.poste === 'denied' ? 'Refusé : autorisez « Polices » dans les réglages du site (le cadenas, à gauche de l\'adresse)' : 'Chercher aussi dans les polices installées sur ce poste (Helvetica, Futura, Century Gothic…) : Chrome demande la permission une fois'
  const mot = R.poste === 'lecture' ? 'Lecture ' + Math.round(R.part * 100) + ' %' : 'Polices du poste'
  if (r('poste-mot').textContent !== mot) r('poste-mot').textContent = mot
}

/* LA RÉSERVE A CHANGÉ : les polices du texte se recherchent, avec elle.
   Une ligne choisie ou corrigée à la main garde son choix ; les autres
   prennent ce que le graphiste trouve maintenant. */
async function relancerPolices() {
  const t = texteAJour() ? E.textes : null
  if (!t || t.etat !== 'pret' || !t.demande || !t.trouvees || !t.trouvees.length) return
  const n = nTexte
  t.etat = 'recherche'
  t.part = 0
  majPolice()
  try {
    const r = await t.fil.demander(t.demande, pr => { if (pr.etat) return evenement(pr); if (pr.etape === 'polices') { t.part = pr.part; majPrep() } })
    if (n !== nTexte || E.textes !== t) return
    const anciennes = new Map(t.lignes.map(l => [l.ligne, l]))
    const aLaMain = l => l && (l.main || l.edite)
    const neuves = t.trouvees.map((l, i) => aLaMain(anciennes.get(i)) ? anciennes.get(i) : ligneTrouvee(i, l, t.lus[i], r.lignes[i])).filter(Boolean)
    for (const l of neuves) if (!aLaMain(l)) retenirDefaut(l)
    t.lignes = neuves
  } catch (e) {
    if (n !== nTexte || E.textes !== t || (e && e.annule)) return
  }
  t.etat = 'pret'
  if (E.histo) H.rafraichir(E.histo, photo())
  majPolice()
  poserPolices()
}

/* UNE POLICE CHERCHÉE PAR SON NOM (l'inspecteur) : posée sur la ligne `k`,
   notée — elle s'ajoute à ses propositions et se choisit. */
async function essayerPolice(k, fam) {
  const t = texteAJour() ? E.textes : null
  const l = t && t.lignes[k]
  if (!l || l.recherche) return
  const jeton = l.jeton = (l.jeton || 0) + 1
  l.recherche = true
  majPolice()
  let r = null
  try { r = await t.fil.demander({ type: 'essayer', cle: t.cle, ligne: l.ligne, texte: l.texte, famille: fam.id, style: fam.style, ecriture: !!l.ecriture }) } catch {}
  if (E.textes !== t || l.jeton !== jeton) return
  l.recherche = false
  if (!r || !r.prop) {
    majPolice()
    return toast('« ' + fam.nom + ' » ne se pose pas sur ce texte' + (l.ecriture ? ' (une écriture liée)' : '') + '.', 'alerte')
  }
  E.cherche = { k: -1, q: '' }
  geste(() => {
    const j = l.props.findIndex(p => memePolice(p, r.prop))
    if (j >= 0) l.choix = j
    else { l.props = l.props.concat([Object.assign(r.prop, { cherchee: true })]); l.choix = l.props.length - 1 }
    l.main = true
    majPolice()
    poserPolices()
  }, () => 'Police : ' + nomPolice(r.prop))
}
const memePolice = (a, b) => a.id === b.id && a.graisse === b.graisse && a.style === b.style && (a.local || '') === (b.local || '')

/* LES LETTRES CHOISIES, POSÉES (lib/texte.js), une fois par choix : le
   vecteur les reprend dans ses couches, le Détouré se repeint. */
let nPoses = 0
async function poserPolices() {
  const t = E.textes
  if (!texteAJour() || t.etat !== 'pret') return
  const choix = choixPolices()
  /* Une ligne déplacée dont la police vient d'être choisie (ou quittée) :
     ses pixels passent du fil du détourage à la pose, ou l'inverse — le
     détourage se refait (voir `reglagesCalcul`). */
  if (transformationsDe().some(e => e.ligne) && E.calcul.cle !== cleFin()) { recalculer(); planifierFin() }
  const cle = JSON.stringify(choix.map(c => [c.boite, c.texte, c.ecriture, c.id, c.graisse, c.style, c.local || '', c.gras, c.couleur, c.m || null]))
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
   du panneau — l'ouvre dans l'inspecteur (`ouvrirLigne`, 12 octobre
   2026 : à la place des réglages du logo, rien ne flotte sur le plan) :
   le texte à corriger s'il est mal lu, les polices proposées chacune dans
   son propre dessin (la police chargée dans la page, `apercuPolice`), le
   dessin d'origine, le gras autour. */
function majPolice() {
  const bloc = r('bloc-police')
  if (!bloc) return
  const t = texteAJour() ? E.textes : null
  bloc.hidden = !(t && !(t.etat === 'pret' && !t.lignes.length)) && !formesListees().length
  if (!t) { r('res-police').textContent = ''; majFormes(); majInspecteur(); return }
  const restantes = t.lignes.filter(l => !ligneRetiree(l)).length
  r('res-police').textContent = t.etat === 'lecture' ? 'Lecture du texte…' : t.etat === 'recherche' ? 'Recherche de la police…' : t.etat === 'erreur' ? 'Indisponible' : restantes + ' ligne' + (restantes > 1 ? 's' : '')
  const etat = l => l.recherche ? 'recherche' : l.choix < 0 ? 'dessin' : l.reconnue && !l.main ? 'reconnue' : 'choisie'
  const html = (t.lignes.length ? '<div class="o-studio-police-aide">Cliquez sur un texte ou une forme du logo pour le modifier.</div>' : '')
    + t.lignes.map((l, i) => {
      const retiree = ligneRetiree(l)
      return '<div class="o-studio-calque"' + (retiree ? ' data-cache' : '') + '>'
        + '<button type="button" class="o-studio-ligne-texte" data-a="ligne" data-v="' + i + '" aria-pressed="' + String(choisi({ ligne: i })) + '"' + (retiree ? ' disabled' : '') + ' title="' + attr(l.texte + ' — ' + (retiree ? 'retirée : l\'œil la remet' : l.recherche ? 'recherche de la police…' : l.choix >= 0 ? nomPolice(l.props[l.choix]) : 'le dessin d\'origine')) + '">'
        + '<i data-etat="' + etat(l) + '"' + (l.couleur && l.choix >= 0 ? ' style="background:' + rvbHex(l.couleur) + '"' : '') + '></i><span class="o-studio-ligne-texte-mot">' + html_(l.texte) + '</span>'
        + '<small>' + (l.recherche ? 'Recherche…' : l.choix >= 0 ? html_(l.props[l.choix].nom) : 'Dessin') + (entreeLigne(l) ? '<em class="o-studio-deplace" title="Déplacée, redimensionnée ou tournée">' + ic('move') + '</em>' : '') + '</small></button>'
        + '<button type="button" class="o-studio-oeil" data-a="oeil-ligne" data-v="' + i + '" aria-pressed="' + !retiree + '" aria-label="' + (retiree ? 'Remettre cette ligne' : 'Retirer cette ligne') + '" title="' + (retiree ? 'Remettre' : 'Retirer (Ctrl Z remet)') + '">' + ic(retiree ? 'eye-off' : 'eye') + '</button>'
        + '</div>'
    }).join('')
  const box = r('textes')
  if (box.dataset.dessin !== html) {
    /* Redessinée, la ligne garde la main du clavier. */
    const actif = box.contains(document.activeElement) ? document.activeElement : null
    const cible = actif && '[data-a="ligne"][data-v="' + actif.dataset.v + '"]'
    box.innerHTML = html
    box.dataset.dessin = html
    if (cible) { const el = box.querySelector(cible); if (el) el.focus({ preventScroll: true }) }
  }
  majReserve()
  majFormes()
  majInspecteur()
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
  /* Une ligne déplacée (les calques déplacés) : son cadre d'origine (ou
     son tour) passé par sa matrice — toujours un polygone. */
  if (entreeLigne(l)) {
    const el = elementDe({ ligne: t.lignes.indexOf(l) })
    if (el) return Object.assign(enveloppe(coinsElement(el)), { poly: polyElement(el) || coinsElement(el) })
  }
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
    if (ligneRetiree(l)) return
    const c = cadreLigneEcran(l)
    if (!c) return
    const a = c.poly ? airePolygone(c.poly) : c.l * c.h
    const sous = c.poly ? dansPolygone(c.poly, x, y, 6) : x >= c.x - 6 && x <= c.x + c.l + 6 && y >= c.y - 6 && y <= c.y + c.h + 6
    if (sous && a < aire) { aire = a; k = i }
  })
  return k
}
/* `bord` : la souris entre sur le plan ou en sort — les pointillés de
   toutes les lignes paraissent ou partent, même sans ligne sous elle. */
function survolerLigne(k, bord = false) {
  const toile = r('toile')
  if (toile) toile.style.cursor = k >= 0 ? 'pointer' : ''
  if (k === E.ligneSurvol && !bord) return
  E.ligneSurvol = k
  dessiner()
}
/* LES LIGNES SIGNALÉES sur le plan : toutes, en pointillé discret, tant
   que la souris est sur le plan ; celle qu'elle survole et celle qui est
   dans l'inspecteur, en plein, avec le nom de leur police. */
function dessinerLignes(ctx) {
  if (!texteAJour() || E.textes.etat !== 'pret' || !E.textes.lignes.length) return
  const lignes = E.textes.lignes
  const ouverte = ligneInspectee()
  const montrer = E.planSurvole || ouverte >= 0
  ctx.save()
  ctx.lineJoin = 'round'
  lignes.forEach((l, i) => {
    const forte = i === E.ligneSurvol || i === ouverte
    if ((!forte && !montrer) || ligneRetiree(l)) return
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
    if (i !== E.ligneSurvol || i === ouverte) return
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

/* ---------------------------------------- L'INSPECTEUR D'UNE LIGNE */
/* UNE POLICE DANS LA PAGE, pour la montrer dans son dessin : le même
   fichier que lit le fil (Fontsource), chargé une fois. Rend le nom de la
   famille CSS. */
const apercus = new Map()
function apercuPolice(p) {
  const nom = 'apercu-' + (p.local ? p.source + '-' + p.local : p.id + '-' + p.graisse + '-' + p.style).replace(/[^\w-]/g, '_')
  if (!apercus.has(nom)) {
    apercus.set(nom, true)
    /* Une police du poste par son nom, une déposée par ses octets
       (lib/reserve-polices.js) ; une de Google, chez Fontsource. */
    const source = p.local ? Reserve.sourceFontFace(p.source, p.local) : Promise.resolve('url(https://cdn.jsdelivr.net/fontsource/fonts/' + p.id + '@latest/latin-' + p.graisse + '-' + p.style + '.woff)')
    let ff = null
    source.then(src => {
      if (!src) return
      ff = new FontFace(nom, src, { display: 'swap' })
      document.fonts.add(ff)
      return ff.load()
    }).catch(() => {
      /* Pas venue (le réseau) : elle se redemandera à la prochaine
         ouverture. */
      if (ff) document.fonts.delete(ff)
      apercus.delete(nom)
    })
  }
  return nom
}
/* UNE LIGNE DANS L'INSPECTEUR : en tête son texte (à corriger s'il est
   mal lu) ; POLICE — le dessin d'origine, les polices proposées chacune
   dans son dessin, la recherche par nom (1er octobre 2026 : « c'est du
   Gotham » — toutes les familles, Google, le poste, les déposées ; un nom
   commercial trouve sa jumelle libre), les polices du poste ; GRAS
   AUTOUR ; COULEUR ; GÉOMÉTRIE ; Retirer. */
function htmlInspecteurLigne(l, i) {
  const geo = htmlGeometrie({ ligne: i })
  const couleur = couleurLigne(l)
  return teteInspecteur('<input class="o-studio-texte-mot" data-c="texte-ligne" data-v="' + i + '" value="' + attr(l.texte) + '" spellcheck="false" aria-label="Le texte de la ligne (à corriger s\'il est mal lu)" title="Mal lu ? Corrigez le texte : la police se recherche.">')
    + blocInspecteur('Police', l.recherche ? 'Recherche…' : l.choix >= 0 ? html_(nomPolice(l.props[l.choix])) : 'Dessin d\'origine',
      '<div class="o-studio-pop-liste" role="radiogroup" aria-label="La police de « ' + attr(l.texte) + ' »">'
      + (l.recherche ? '<div class="o-studio-pop-vide">Recherche de la police…</div>'
        : '<button type="button" role="radio" class="o-studio-pop-ligne" data-a="ligne-police" data-v="-1" aria-checked="' + (l.choix < 0) + '"><span class="o-studio-pop-apercu">Dessin d\'origine</span><small>les lettres du logo, telles quelles</small></button>'
        + l.props.map((p, j) => '<button type="button" role="radio" class="o-studio-pop-ligne" data-a="ligne-police" data-v="' + j + '" aria-checked="' + (l.choix === j) + '"><span class="o-studio-pop-apercu" style="font-family:\'' + apercuPolice(p) + '\',sans-serif">' + html_(l.texte) + '</span>'
          + '<small>' + html_(nomPolice(p)) + ' · ' + Math.round(p.note * 100) + ' %' + (p.cherchee ? ' · cherchée' : j === 0 ? (l.reconnue ? ' · <b>reconnue</b>' : ' · la plus proche') : '')
          + (SOURCES[p.source] ? ' <em class="o-studio-source">' + SOURCES[p.source] + '</em>' : '') + (equivalentDe(p.id) ? ' <em class="o-studio-equivalent" title="Son équivalent libre : le dessin de la police commerciale">' + equivalentDe(p.id) + '</em>' : '') + '</small></button>').join(''))
      + '</div>'
      + '<div class="o-studio-recherche"><input class="o-studio-texte-mot o-studio-cherche-mot" data-c="cherche-police" data-v="' + i + '" value="' + attr(E.cherche.k === i ? E.cherche.q : '') + '" placeholder="Chercher une police : Futura, Gotham…" spellcheck="false" autocomplete="off" aria-label="Chercher une police par son nom">'
      + '<div class="o-studio-pop-liste" data-r="cherche-resultats" role="listbox" aria-label="Polices trouvées"></div>'
      + (['prompt', 'erreur'].includes(E.reserve.poste) ? '<button type="button" class="o-studio-lien" data-a="poste">Chercher aussi dans les polices de ce poste</button>' : '')
      + '</div>')
    + blocInspecteur('', '', curseurGras(l, i))
    + (couleur ? blocInspecteur('', '', couleur) : '')
    + (geo ? blocInspecteur('Géométrie', 'en mm', geo) : '')
    + boutonRetirer('retirer-ligne', 'Retirer cette ligne', 'Ses lettres partent du logo, dans les trois versions et les exports (Ctrl Z les remet)')
}

/* LES POLICES TROUVÉES PAR LEUR NOM, chacune dans son dessin (le texte de
   la ligne), sous le champ de l'inspecteur. */
let nRecherche = 0
async function majRecherche() {
  const boite = r('cherche-resultats')
  const t = texteAJour() ? E.textes : null
  const l = t && t.lignes[E.cherche.k]
  if (!boite || !l) return
  const q = E.cherche.q.trim()
  const n = ++nRecherche
  if (!q) { boite.innerHTML = ''; boite.dataset.dessin = ''; return }
  const cat = await catalogue()
  if (n !== nRecherche) return
  E.cherche.trouvees = chercherPolices(cat, q)
  const html = E.cherche.trouvees.length ? E.cherche.trouvees.map((f, j) => '<button type="button" role="option" class="o-studio-pop-ligne" data-a="essayer-police" data-v="' + j + '"><span class="o-studio-pop-apercu" style="font-family:\'' + apercuPolice(f.face) + '\',sans-serif">' + html_(l.texte) + '</span>'
    + '<small>' + html_(f.nom) + (f.style === 'italic' ? ' Italic' : '') + (SOURCES[f.source] ? ' <em class="o-studio-source">' + SOURCES[f.source] + '</em>' : '') + (equivalentDe(f.id) ? ' <em class="o-studio-equivalent">' + equivalentDe(f.id) + '</em>' : '') + '</small></button>').join('')
    : '<div class="o-studio-pop-vide">Aucune police « ' + html_(q) + ' »' + (['prompt', 'erreur'].includes(E.reserve.poste) ? ' chez Google : cherchez aussi dans les polices du poste.' : '.') + '</div>'
  if (boite.dataset.dessin !== html) { boite.innerHTML = html; boite.dataset.dessin = html }
}
/* LE GRAS D'UNE LIGNE (lib/texte.js, `grasPx`) : un curseur sous sa police,
   de 0 à 100 — du gras ajouté autour de chaque lettre, dans les trois
   versions et tous les exports. Il se lit en millimètres à la taille d'impression
   (`mmParPx`). Sans police choisie, il n'y a pas de lettres à épaissir.
   Sa valeur n'est pas dans le dessin de la ligne (`majGras` la pose) : un
   curseur qu'on tient ne se redessine pas sous la main. */
function curseurGras(l, i) {
  const sans = l.recherche || l.choix < 0
  return '<div class="o-studio-curseur o-studio-gras">'
    + '<div class="o-studio-curseur-tete"><label for="o-studio-gras-' + i + '">Gras autour</label><output data-r="val-gras-' + i + '"></output></div>'
    + '<input type="range" id="o-studio-gras-' + i + '" data-c="gras" data-v="' + i + '" min="0" max="100" step="1"'
    + (sans ? ' disabled title="Choisissez une police pour épaissir ses lettres"' : ' title="Du gras autour de chaque lettre de « ' + attr(l.texte) + ' »"') + '></div>'
}
/* LA COULEUR D'UNE LIGNE (12 octobre 2026, les calques) : les pastilles
   du nuancier et « D'origine », sous le gras — sur ses lettres en police,
   dans les trois versions et les exports. Sans police choisie, la
   première proposée se pose avec la couleur. */
function couleurLigne(l) {
  if (l.recherche || !l.props.length) return ''
  const c = l.couleur
  return '<div class="o-studio-pop-couleur"><div class="o-studio-curseur-tete"><label>Couleur</label><output>' + (c ? html_(fiche(c).nom) : 'D\'origine') + '</output></div>'
    + '<div class="o-studio-pop-grille">' + NUANCIER.map(n => '<button type="button" data-a="ligne-couleur" data-v="' + rvbHex(n.rvb) + '"' + pastille(n.rvb) + (c && duNuancier(c) === n ? ' aria-current="true"' : '') + '><i style="background:' + rvbHex(n.rvb) + '"></i></button>').join('')
    + '<button type="button" data-a="ligne-origine" title="La couleur des lettres du logo"' + (!c ? ' aria-current="true"' : '') + '><i class="o-studio-origine"></i></button></div></div>'
}
function majGras(el, l) {
  if (!el || !l) return
  const v = l.gras || 0
  if (Number(el.value) !== v) el.value = v
  el.style.setProperty('--p', v + '%')
  const out = r('val-gras-' + el.dataset.v)
  const mm = v / 100 * (l.grasMax || 0) * mmParPx()
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
  const textes = [], lectures = [], sures = []
  textes[l.ligne] = texte
  lectures[l.ligne] = [{ texte, confiance: 100, impose: true }]
  /* Le texte tapé est sûr : la police ne le « corrige » pas. */
  sures[l.ligne] = true
  try {
    const r = await t.fil.demander({ type: 'polices', cle: t.cle, textes, lectures, sures }, evenement)
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
    return { x: z.x, y: z.y, l: z.l, h: z.h, data, poses: z.poses, comble: !!(E.decision && E.decision.genre === 'photo') }
  })
  try {
    const rep = await t.fil.demander({ type: 'poser', cle: t.cle, poses: poses.poses, zones })
    if (n !== nRepeint || cle !== cleRepeint()) return
    E.repeint = { cle, zones: rep.zones, fin: null, surApercu: false }
    /* L'aperçu d'un geste fini sur une ligne en police part avec ses
       lettres reposées. */
    if (E.apercuPrise && !E.prise) E.apercuPrise = null
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
/* LA VERSION IMAGE ne se calcule que montrée ou exportée (12 octobre 2026,
   la vitesse : un logo ouvert en Vecteur n'en a pas besoin — le tracé
   final, gardé dans son fil, ne se refait pas quand on la demande). */
const besoinImage = () => E.version === 'image'
const vecteurAJour = () => !!(E.vecteur && !E.vecteur.apercu && E.vecteur.cle === cleVecteur() && E.vecteur.pleine === E.pleine && (!besoinUnie() || E.vecteur.unie) && (!besoinImage() || E.vecteur.rgba))
/* Le dernier vecteur du détourage à l'écran, même d'une teinte retirée
   avant : il reste le temps que le suivant arrive. */
const vecteurMontre = () => !!(E.vecteur && E.vecteur.cleFin === cleFin() && E.vecteur.pleine === E.pleine)

/* LE VECTEUR SE TRACE SEUL, dès que le détourage se pose — mais pas
   pendant que l'IA nettoie l'image : on ne trace qu'une fois, l'image
   nette ; en attendant, le plan montre le détourage de l'image reçue. */
let minuteurVecteur = null
/* `echecTrace` : les réglages dont le tracé vient d'échouer — il ne se
   relance pas seul pour eux (le panneau qui se redessine le relançait,
   un toast toutes les quelques secondes) ; un geste, un export, oui. */
let echecTrace = null
const aEchoue = () => !!(echecTrace && echecTrace.cle === cleVecteur() && echecTrace.pleine === E.pleine && echecTrace.unie === besoinUnie())
const aTracer = () => !!(E.version !== 'detoure' && E.apercu && E.resultatImage && !(E.methode === 'ia' && !E.ia.masque) && !E.nettoyage.enCours && !vecteurAJour() && !aEchoue())
function planifierVecteur(delai = 150) {
  clearTimeout(minuteurVecteur)
  if (!aTracer()) return
  minuteurVecteur = setTimeout(() => {
    if (aTracer()) vectoriser().then(() => { majPanneau(); dessiner() })
  }, delai)
}

let enVol = null
let enVolCle = ''
function vectoriser() {
  if (vecteurAJour()) return Promise.resolve(E.vecteur)
  /* Un tracé lancé pour d'autres réglages (le seuil, une teinte retirée,
     les nuances, une police posée) se coupe net : il allait au bout, puis
     seulement le bon partait — le double du temps. */
  if (enVol && enVolCle !== cleVecteur() && filVect) { filVect.fermer(); filVect = null }
  if (!enVol) {
    /* Le détourage a bougé pendant le calcul : on refait, pour celui-là. */
    const debut = enVolCle = cleVecteur()
    enVol = calculerVecteur().finally(() => {
      enVol = null
      if (cleVecteur() !== debut) planifierVecteur(0)
    })
  }
  return enVol
}

/* LE TRACÉ DES RÉGLAGES DU MOMENT, pour l'export : `vectoriser` rend le
   tracé en vol, lancé peut-être avant le dernier geste — une teinte
   retirée revenait dans le PDF. null : il a échoué pour ces réglages. */
async function vecteurFrais() {
  for (let essai = 0; essai < 4; essai++) {
    const neuf = !enVol, cle = cleVecteur(), pleine = E.pleine
    await vectoriser()
    if (vecteurAJour()) return E.vecteur
    if (neuf && cle === cleVecteur() && pleine === E.pleine) return null
  }
  return null
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
  const f = apercu ? null : vecteurFil()
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
    image: apercu || besoinImage(),
    /* La clé des lettres posées : le tracé gardé dans le fil ne resservira
       qu'à elles (le gras, la police, la couleur d'une ligne changent les
       lettres sans changer leur nombre). */
    clePoses: apercu ? '' : clePoses(),
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
    /* Le contour du tracé d'avant reste, le temps que le sien se trace. */
    const contour = E.vecteur && E.vecteur.pleine === p ? E.vecteur.contour : null
    /* L'image par couches d'un tracé d'avant (mêmes réglages) reste si
       celui-ci ne l'a pas refaite. */
    const avant = E.vecteur && !E.vecteur.apercu && E.vecteur.cle === cle && E.vecteur.pleine === p && E.vecteur.rgba ? E.vecteur : null
    E.vecteur = { svg: rep.svg, lettres: rep.lettres || '', unie: rep.unie, multi: rep.multi, degrade: rep.degrade, nuances: rep.nuances, cadre: rep.cadre, couleurs: rep.couleurs || [], rgba: rep.image || (avant ? avant.rgba : null), imageL: rep.image ? rep.imageLargeur : avant ? avant.imageL : 0, imageH: rep.image ? rep.imageHauteur : avant ? avant.imageH : 0, noeuds: rep.noeuds, cle, cleFin: cleF, pleine: p, apercu, contour }
    /* Le graphiste ouvre sur Image un logo qui a du modelé (un dégradé,
       une texture : jamais tronqués), sur Vecteur un logo à plat. */
    if (!E.vueChoisie && E.version !== 'detoure') E.version = rep.degrade ? 'image' : 'vecteur'
    /* Passée en Image sans son image : elle se demande (le tracé est gardé). */
    if (!apercu && besoinImage() && !E.vecteur.rgba) planifierVecteur(0)
    /* Une teinte changée qui a disparu du logo (retirée, fondue) s'oublie —
       sur un tracé des réglages du moment : un tracé dépassé (l'historique
       a reposé d'autres nuances entre-temps) n'efface rien. */
    const la = new Set(E.vecteur.couleurs.map(c => c.join(',')))
    if (cle === cleVecteur()) for (const k of Object.keys(E.recolor)) if (!la.has(k)) delete E.recolor[k]
    if (!apercu) { echecTrace = null; reporterTeintes(p) }
    return E.vecteur
  } catch (e) {
    connu.delete(qui)
    /* Le fil a perdu l'image (il a redémarré) : on la lui renvoie. */
    if (e && e.message === 'sans-image' && recu) { encore = true; return RENVOYER }
    if (!(e && e.annule)) {
      const mot = (e && e.message) || 'La vectorisation a échoué.'
      if (apercu) toast(mot, 'alerte')
      else { echecTrace = { cle, pleine: p, unie: m.unie }; echouer('trace', mot) }
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
  const ct = contourVoulu() && !v.apercu ? v.contour : null
  const cle = JSON.stringify([t, E.recolor, E.version, !!v.unie, ct ? [ct.cle, E.contour.nom] : null])
  if (v.aff && v.aff.cle === cle) return v.aff
  let svg
  let degrade = false
  if (t.type !== 'multi') svg = teinter(v.unie || v.svg, rvbTeinte())
  else if (E.version === 'image' && !v.apercu && v.rgba) { svg = v.svg; degrade = true }
  else svg = recolorer(v.multi, E.recolor)
  /* Le contour, sous tout le dessin, de sa couleur : ni la teinte ni les
     couleurs changées ne le touchent. */
  if (ct) svg = avecContour(svg, ct, rvbContour())
  const lu = lireSvg(svg)
  const formes = lu.formes.map(f => ({ couleur: 'rgb(' + f.couleur.join(',') + ')', path: new Path2D(f.d), d: f.d, regle: f.regle }))
  if (degrade && !v.toile) {
    /* L'image nette, deux fois plus fine que le cadre (lib/image-nette.js). */
    v.toile = toileDe(v.imageL, v.imageH)
    v.toile.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(v.rgba), v.imageL, v.imageH), 0, 0)
  }
  /* `lettres` : les dernières formes, celles des polices (en version image). */
  /* `cadre` : celui de tout ce qui s'imprime, contour compris. */
  v.aff = { cle, svg, formes, degrade, image: degrade ? v.toile : null, lettres: degrade && v.lettres ? lireSvg(v.lettres).formes.length : 0, cadre: { x: lu.boite[0], y: lu.boite[1], largeur: lu.boite[2], hauteur: lu.boite[3] } }
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
   transparent (lib/png.js) ; au-delà de PNG_MAX, moins de points par pouce,
   et le fichier le dit (il s'ouvre toujours à sa taille). */
async function pngDe(v, a, largeurCm) {
  const c = a.cadre || v.cadre
  const dpi = Math.min(300, PNG_MAX / (largeurCm / 2.54))
  const L = Math.max(1, Math.round(largeurCm / 2.54 * dpi))
  const k = L / c.largeur
  const H = Math.max(1, Math.round(c.hauteur * k))
  const t = toileDe(L, H)
  const ctx = t.getContext('2d')
  ctx.setTransform(k, 0, 0, k, -c.x * k, -c.y * k)
  ctx.imageSmoothingQuality = 'high'
  if (a.degrade) peindreDegrade(ctx, a, c)
  else for (const f of a.formes) { ctx.fillStyle = f.couleur; ctx.fill(f.path, f.regle) }
  return pngHd(deborder(ctx.getImageData(0, 0, L, H).data, L, H), L, H, { dpi })
}

/* UN FICHIER, dans le format voulu, à 300 dpi de l'image de travail. */
async function fichierDe(format, v, a, largeurCm) {
  if (format === 'pdf') {
    return a.degrade
      ? await imageVersPdf(v.rgba, v.imageL, v.imageH, { largeurCm, decoupe: (W, H) => decoupePdf(contourDe(v), W, H), dessus: v.lettres && ((W, H) => dessinPdf(v.lettres, W, H)) })
      : new TextEncoder().encode(svgVersPdf(a.svg, { largeurCm }))
  }
  if (format === 'svg') return new TextEncoder().encode(svgFinal(a.degrade ? svgDegrade(v) : a.svg, { largeurCm }))
  if (format === 'eps') return new TextEncoder().encode(svgVersEps(a.svg, { largeurCm }))
  return pngDe(v, a, largeurCm)
}

const TYPES = { pdf: 'application/pdf', svg: 'image/svg+xml', eps: 'application/postscript', png: 'image/png', zip: 'application/zip' }
let minuteurFait = null

/* L'EXPORT ATTEND L'IA (30 septembre 2026) : un clic pendant « Améliorer
   l'image » emportait l'image reçue, sans rien dire. Il attend qu'elle
   ait fini — puis le sujet de l'image nette, quand le fond passe par
   l'IA. Faux si un autre fichier s'est ouvert entre-temps : rien ne
   part. */
async function attendreIA() {
  const charge = E.chargement
  const pause = () => new Promise(ok => setTimeout(ok, 100))
  while (E.nettoyage.enCours || (E.methode === 'ia' && !E.ia.masque && E.ia.enCours)) await pause()
  return E.chargement === charge
}

/* LE TEXTE RÉGLÉ, sur l'image nette : `texteRegle` rend la main tant que
   l'IA tourne (son texte se lit sur l'image nette) — on l'attend, puis le
   texte. Faux si un autre fichier s'est ouvert entre-temps. */
async function pretAExporter() {
  const charge = E.chargement
  for (let k = 0; k < 3; k++) {
    if (!(await attendreIA())) return false
    await texteRegle()
    if (E.chargement !== charge) return false
    if (!E.nettoyage.enCours) return true
  }
  return !E.nettoyage.enCours
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
  /* Un autre fichier ouvert pendant l'attente : rien ne part (il partait,
     à son nom, avant son IA). */
  const charge = E.chargement
  try {
    if (!(await pretAExporter())) return
    const v = await vecteurFrais()
    if (E.chargement !== charge) return
    if (!v) return toast('Le tracé n\'a pas abouti : rien n\'est parti.', 'alerte')
    await contourAJour()
    if (E.chargement !== charge) return
    /* Un contour qui n'est pas celui de ce tracé ne part pas. */
    if (contourVoulu() && !(E.vecteur && E.vecteur.contour && E.vecteur.contour.cle === cleContour(E.vecteur))) return toast('Le contour ne s\'est pas tracé : rien n\'est parti.', 'alerte')
    const a = affichage()
    /* À la taille d'impression choisie, sinon à 300 dpi ; le nom la dit. Le cadre de
       tout ce qui s'imprime, contour compris. */
    const cad = a.cadre || v.cadre
    const t = tailleImprimee(cad.largeur, cad.hauteur, E.taille)
    const largeurCm = t.l / 10
    const fin = suffixe() + tailleNom(t)
    let blob, nom
    if (quoi === 'kit') {
      const formats = ['pdf', 'svg', 'png'].concat(a.degrade ? [] : ['eps'])
      const fichiers = []
      for (const f of formats) fichiers.push({ nom: nomExport(E.nom, f, fin), octets: await fichierDe(f, v, a, largeurCm) })
      blob = new Blob([zip(fichiers)], { type: TYPES.zip })
      nom = nomExport(E.nom, 'zip', fin)
    } else {
      blob = new Blob([await fichierDe(quoi, v, a, largeurCm)], { type: TYPES[quoi] })
      nom = nomExport(E.nom, quoi, fin)
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
  const charge = E.chargement
  try {
    if (!(await pretAExporter())) return
    const detouree = await detourePleine()
    if (E.chargement !== charge) return
    if (!detouree) return toast('Le détourage n\'a pas abouti.', 'alerte')
    await repeindre()
    if (E.chargement !== charge) return
    const pleine = avecRepeint(detouree, E.pleine.largeur)
    const img = recadrer(pleine, E.pleine.largeur, E.pleine.hauteur)
    if (!img) return toast('Il ne reste rien : baisse le seuil.', 'alerte')
    /* Pixel pour pixel, à la taille d'impression choisie (le PNG dit la
       résolution qui l'y met), sinon à 300 dpi. */
    const t = tailleImprimee(img.largeur, img.hauteur, E.taille)
    const fin = tailleNom(t)
    const pdf = () => imageVersPdf(img.data, img.largeur, img.hauteur, { largeurCm: t.l / 10 })
    const png = () => pngHd(deborder(img.data, img.largeur, img.hauteur), img.largeur, img.hauteur, { dpi: dpiA(img.largeur, t.l) })
    let blob, nom
    if (quoi === 'kit') {
      blob = new Blob([zip([{ nom: nomExport(E.nom, 'pdf', fin, 'detoure'), octets: await pdf() }, { nom: nomExport(E.nom, 'png', fin, 'detoure'), octets: await png() }])], { type: TYPES.zip })
      nom = nomExport(E.nom, 'zip', fin, 'detoure')
    } else {
      blob = new Blob([await (quoi === 'png' ? png() : pdf())], { type: TYPES[quoi] })
      nom = nomExport(E.nom, quoi, fin, 'detoure')
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
    /* Échap ferme l'inspecteur, même depuis un de ses champs (le texte, la
       recherche, une cote). */
    if (e.key === 'Escape' && e.target.closest && e.target.closest('[data-r="inspecteur"]')) { e.target.blur(); return viderChoix() }
    if (mod || e.altKey || champ(e.target)) return
    if (e.key === 'Escape') { if (E.prise) annulerPrise(); else if (E.lasso) annulerLasso(); else if (E.outil) prendreGomme(false); else if (E.pop) fermerPop(); else if (E.menu) fermerMenu(); else if (E.historique) fermerHistorique(); else if (E.choix.length || E.point) viderChoix(); else if (E.split !== null) basculerSplit(); return }
    if (!E.apercu) return
    /* LA SÉLECTION AU CLAVIER (les calques déplacés) : les flèches la
       poussent d'un pixel (Maj : dix), Suppr la retire. */
    if (E.choix.length && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault()
      const n = e.shiftKey ? 10 : 1
      return pousserChoix(e.key === 'ArrowLeft' ? -n : e.key === 'ArrowRight' ? n : 0, e.key === 'ArrowUp' ? -n : e.key === 'ArrowDown' ? n : 0)
    }
    if (E.choix.length && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); return geste(() => retirerChoix()) }
    if (k === 'g') return prendreGomme()
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
    if (k === 'r') return basculerCotes()
    if (k === '0') { ajuster(); return dessiner() }
    if (k === '1') return centPourCent()
    const scene = r('scene')
    if (k === '+' || k === '=') return zoomer(1.25, scene.clientWidth / 2, scene.clientHeight / 2)
    if (k === '-') return zoomer(0.8, scene.clientWidth / 2, scene.clientHeight / 2)
  })
  document.addEventListener('keyup', e => { if (e.key === ' ' && E.comparer) voirAvant(false) })
  /* Espace lâché hors de la fenêtre (une autre appli au premier plan) : le
     keyup n'arrive jamais, « Avant » restait affiché. */
  window.addEventListener('blur', () => { if (E.comparer) voirAvant(false) })
  document.addEventListener('paste', e => {
    if (!visible()) return
    const item = [...((e.clipboardData && e.clipboardData.items) || [])].find(i => i.kind === 'file' && /^image\//.test(i.type))
    if (!item) return
    e.preventDefault()
    const f = item.getAsFile()
    if (f) charger(new File([f], f.name && f.name !== 'image.png' ? f.name : 'logo-colle.png', { type: f.type }))
  })
}

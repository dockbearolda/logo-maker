import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lignesDe, enTeteDe, dureeMot, environ, MOTS } from './fiche.js'

/* L'état plat d'un logo à plat, tout fini : la base que chaque test déforme. */
const etat = (p = {}) => Object.assign({
  image: true,
  version: 'vecteur',
  fond: { methode: 'uni', interieur: true, teintes: [[255, 255, 255]] },
  ia: { faite: true, ultra: false, decochee: false, voulue: true },
  net: { faite: false, retire: false, flou: '' },
  couleurs: { une: false, nom: '', n: 2, degrade: false },
  lignes: [],
  texte: { etat: 'pret' },
  retouche: { formes: 3, contour: 0 },
  etapes: { ia: { etat: 'fait', ms: 6400 }, detourage: { etat: 'fait', ms: 200 }, trace: { etat: 'fait', ms: 800 }, texte: { etat: 'fait', ms: 9000 } },
  prep: { lecture: false, fini: true, total: 16400 },
}, p)
const ligne = (e, id) => lignesDe(e).find(l => l.id === id)
const ids = e => lignesDe(e).filter(l => !l.cachee).map(l => l.id)

test('un logo à plat fini : les lignes dans l\'ordre, en mots de vendeuse', () => {
  assert.deepEqual(ids(etat()), ['image', 'fond', 'version', 'couleurs', 'retoucher'])
  const im = ligne(etat(), 'image')
  assert.equal(im.titre, 'Image améliorée')
  assert.equal(im.detail, 'agrandie ×4')
  assert.equal(im.etat, 'fait')
  assert.equal(im.valeur, '6,4 s')
  const f = ligne(etat(), 'fond')
  assert.equal(f.titre, 'Fond retiré')
  assert.equal(f.detail, 'partout, même dans les lettres')
  const v = ligne(etat(), 'version')
  assert.equal(v.titre, 'Vectorisé')
  assert.equal(v.detail, 'net à toute taille')
  const c = ligne(etat(), 'couleurs')
  assert.equal(c.titre, '2 couleurs')
  assert.equal(c.detail, 'd\'origine')
  const r = ligne(etat(), 'retoucher')
  assert.equal(r.titre, 'Retoucher')
  assert.equal(r.detail, 'calques, contour, gomme, déplacer')
  assert.equal(r.etat, 'omise')
})

test('aucun jargon dans une ligne fermée', () => {
  for (const l of lignesDe(etat())) for (const mot of ['nœud', 'seuil', 'lissage', 'nuance', 'tolérance', 'masque', 'BiRefNet', 'ISNet']) {
    assert.doesNotMatch(l.titre + ' ' + l.detail, new RegExp(mot, 'i'), l.id + ' dit « ' + mot + ' »')
  }
})

test('l\'Ultra et le flou corrigé se disent ; une couleur, dégradé, autour, sujet, entier', () => {
  assert.equal(ligne(etat({ ia: { faite: true, ultra: true, decochee: false, voulue: true }, net: { faite: true, retire: true, flou: '1,8 px' } }), 'image').detail, 'agrandie ×4, Ultra, flou corrigé')
  assert.equal(ligne(etat({ net: { faite: true, retire: false, flou: '0,3 px' } }), 'image').detail, 'agrandie ×4')
  assert.equal(ligne(etat({ couleurs: { une: true, nom: 'Noir', n: 2, degrade: false } }), 'couleurs').titre, 'Une couleur')
  assert.equal(ligne(etat({ couleurs: { une: true, nom: 'Noir', n: 2, degrade: false } }), 'couleurs').detail, 'Noir')
  assert.equal(ligne(etat({ version: 'image', couleurs: { une: false, nom: '', n: 0, degrade: true } }), 'couleurs').titre, 'Dégradés')
  assert.equal(ligne(etat({ fond: { methode: 'uni', interieur: false, teintes: [] } }), 'fond').detail, 'autour du logo seulement')
  const s = ligne(etat({ fond: { methode: 'ia', interieur: true, teintes: [] } }), 'fond')
  assert.equal(s.titre, 'Sujet détouré')
  assert.equal(s.detail, 'trouvé par l\'IA')
  const en = ligne(etat({ fond: { methode: 'entier', interieur: true, teintes: [] } }), 'fond')
  assert.equal(en.titre, 'Fond gardé')
  assert.equal(en.detail, 'l\'image entière')
  assert.equal(ligne(etat({ couleurs: { une: false, nom: '', n: 1, degrade: false } }), 'couleurs').titre, '1 couleur')
})

test('l\'image gardée telle quelle, ou décochée', () => {
  const g = ligne(etat({ ia: { faite: false, ultra: false, decochee: false, voulue: false }, etapes: {} }), 'image')
  assert.equal(g.titre, 'Image gardée telle quelle')
  assert.equal(g.detail, 'déjà nette et grande')
  assert.equal(g.etat, 'omise')
  const d = ligne(etat({ ia: { faite: false, ultra: false, decochee: true, voulue: false }, etapes: {} }), 'image')
  assert.equal(d.titre, 'Sans amélioration')
  assert.equal(d.detail, 'décochée')
})

test('une photo en Détouré : Couleurs cachée, Version « Détouré »', () => {
  const e = etat({ version: 'detoure', fond: { methode: 'ia', interieur: true, teintes: [] }, etapes: { ia: { etat: 'fait', ms: 5000 }, sujet: { etat: 'fait', ms: 1200 }, detourage: { etat: 'fait', ms: 100 }, texte: { etat: 'fait', ms: 300 } } })
  assert.deepEqual(ids(e), ['image', 'fond', 'version', 'retoucher'])
  assert.equal(ligne(e, 'couleurs').cachee, true)
  assert.equal(ligne(e, 'version').titre, 'Détouré')
  assert.equal(ligne(e, 'version').detail, 'les pixels du fichier, sans le fond')
  assert.equal(ligne(e, 'fond').valeur, '1,3 s')
})

test('l\'IA en cours : la ligne Image dit sa part, l\'Ultra, le temps qui reste ; ce qui suit attend', () => {
  const e = etat({ ia: { faite: false, ultra: true, decochee: false, voulue: true }, etapes: { ia: { etat: 'cours', part: 0.42, reste: 14000, mot: 'Ultra' }, detourage: { etat: 'attente' }, trace: { etat: 'attente' }, texte: { etat: 'attente' } }, prep: { lecture: false, fini: false, total: 0 } })
  const im = ligne(e, 'image')
  assert.equal(im.titre, 'Image en cours')
  assert.equal(im.detail, 'Ultra · encore ~14 s')
  assert.equal(im.etat, 'cours')
  assert.equal(im.valeur, '42 %')
  assert.equal(im.part, 0.42)
  assert.equal(ligne(e, 'fond').etat, 'attente')
  assert.equal(ligne(e, 'version').etat, 'attente')
  assert.equal(ligne(e, 'version').titre, 'Vectorisé')
  assert.equal(enTeteDe(e).mot, 'Préparation…')
  assert.equal(enTeteDe(e).valeur, '')
})

test('une part inconnue : les secondes passées ; le téléchargement se dit ; sous 1,5 s rien ne reste', () => {
  const e = etat({ etapes: { ia: { etat: 'cours', part: null, depuis: 3400, reste: 0, mot: 'mise en route' } }, ia: { faite: false, ultra: false, decochee: false, voulue: true } })
  assert.equal(ligne(e, 'image').valeur, '3 s')
  assert.equal(ligne(e, 'image').detail, 'mise en route')
  const t = etat({ etapes: { ia: { etat: 'cours', part: 0.1, depuis: 500, reste: 1000, mot: 'téléchargement' } }, ia: { faite: false, ultra: false, decochee: false, voulue: true } })
  assert.equal(ligne(t, 'image').detail, 'téléchargement')
  assert.equal(ligne(t, 'image').valeur, '10 %')
})

test('en attente du tracé (l\'IA passe d\'abord) : « Couleurs », grisée, jamais « 0 couleur »', () => {
  const e = etat({ couleurs: { une: false, nom: '', n: 0, degrade: false }, etapes: { ia: { etat: 'cours', part: 0.2, reste: 0, mot: '' }, trace: { etat: 'attente' } }, ia: { faite: false, ultra: false, decochee: false, voulue: true } })
  const c = ligne(e, 'couleurs')
  assert.equal(c.titre, 'Couleurs')
  assert.equal(c.detail, '')
  assert.equal(c.etat, 'attente')
  /* Sans tracé du tout (rien d'attendu) : pareil, sans « 0 couleur ». */
  const sans = ligne(etat({ couleurs: { une: false, nom: '', n: 0, degrade: false }, etapes: {} }), 'couleurs')
  assert.equal(sans.titre, 'Couleurs')
  assert.equal(sans.etat, 'omise')
})

test('le tracé en cours : Version et Couleurs le disent', () => {
  const e = etat({ etapes: { trace: { etat: 'cours', part: null, depuis: 600, reste: 0, mot: '' } } })
  assert.equal(ligne(e, 'version').titre, 'Tracé en cours')
  assert.equal(ligne(e, 'version').etat, 'cours')
  assert.equal(ligne(e, 'couleurs').titre, 'Couleurs')
  assert.equal(ligne(e, 'couleurs').detail, 'en cours')
})

test('un échec reste dans sa ligne, en rouge, avec le message', () => {
  const e = etat({ etapes: { ia: { etat: 'echec', erreur: 'L\'IA n\'a pas pu tourner : mémoire.' } }, ia: { faite: false, ultra: false, decochee: false, voulue: true } })
  const im = ligne(e, 'image')
  assert.equal(im.etat, 'echec')
  assert.equal(im.erreur, 'L\'IA n\'a pas pu tourner : mémoire.')
  assert.equal(im.titre, 'Image améliorée')
})

test('les textes : une ligne par texte lu, dans ses quatre états, puis retirée', () => {
  const e = etat({ lignes: [
    { texte: 'CERCLE DES CRÉATEURS', etat: 'proposee', police: 'Kameron', retiree: false },
    { texte: 'DIB', etat: 'reconnue', police: 'Montserrat', retiree: false },
    { texte: 'SEA VIEW', etat: 'dessin', police: '', retiree: false },
    { texte: 'VILLAS', etat: 'choisie', police: 'Bebas Neue', retiree: false },
    { texte: 'POOL', etat: 'recherche', police: '', retiree: false },
    { texte: 'BAR', etat: 'reconnue', police: 'Lato', retiree: true },
  ] })
  assert.deepEqual(ids(e), ['image', 'fond', 'version', 'couleurs', 'texte:0', 'texte:1', 'texte:2', 'texte:3', 'texte:4', 'texte:5', 'retoucher'])
  assert.equal(ligne(e, 'texte:0').titre, 'CERCLE DES CRÉATEURS')
  assert.equal(ligne(e, 'texte:0').detail, 'Kameron proposée')
  assert.equal(ligne(e, 'texte:1').detail, 'Montserrat reconnue et posée')
  assert.equal(ligne(e, 'texte:2').detail, 'dessin d\'origine')
  assert.equal(ligne(e, 'texte:3').detail, 'Bebas Neue, choisie')
  assert.equal(ligne(e, 'texte:4').detail, 'recherche de la police…')
  assert.equal(ligne(e, 'texte:5').detail, 'retirée')
  assert.equal(ligne(e, 'texte:5').etat, 'omise')
})

test('pendant la lecture du texte, une seule ligne « Texte » ; rien lu, rien', () => {
  const l = etat({ texte: { etat: 'lecture' }, etapes: { texte: { etat: 'cours', part: null, depuis: 2000, reste: 0, mot: '' } } })
  assert.deepEqual(ids(l).filter(i => i.startsWith('texte')), ['texte'])
  assert.equal(ligne(l, 'texte').titre, 'Texte')
  assert.equal(ligne(l, 'texte').detail, 'lecture en cours')
  assert.equal(ligne(l, 'texte').valeur, '2 s')
  const r = etat({ texte: { etat: 'recherche' }, etapes: { texte: { etat: 'cours', part: 0.5, depuis: 2000, reste: 0, mot: 'polices' } } })
  assert.equal(ligne(r, 'texte').detail, 'recherche des polices')
  assert.equal(ligne(r, 'texte').valeur, '50 %')
  assert.deepEqual(ids(etat({ texte: { etat: 'pret' }, lignes: [] })).filter(i => i.startsWith('texte')), [])
  assert.equal(ligne(etat({ texte: { etat: 'erreur' } }), 'texte').detail, 'lecture indisponible')
})

test('le rebouchage se dit dans Retoucher', () => {
  const e = etat({ etapes: { combler: { etat: 'cours', part: 0.4, depuis: 300, reste: 0, mot: '' } } })
  assert.equal(ligne(e, 'retoucher').detail, 'rebouchage 40 %')
  assert.equal(ligne(e, 'retoucher').etat, 'cours')
})

test('l\'en-tête : la lecture, la préparation, prêt et son temps ; sans fichier, rien', () => {
  assert.deepEqual(enTeteDe(etat({ image: false, prep: { lecture: false, fini: false, total: 0 } })), { mot: '', valeur: '' })
  assert.deepEqual(enTeteDe(etat({ image: false, prep: { lecture: true, fini: false, total: 0 } })), { mot: 'Lecture du fichier…', valeur: '' })
  assert.deepEqual(enTeteDe(etat({ prep: { lecture: false, fini: false, total: 0 } })), { mot: 'Préparation…', valeur: '' })
  assert.deepEqual(enTeteDe(etat()), { mot: 'Prêt', valeur: '16,4 s' })
})

test('sans fichier, aucune ligne', () => {
  assert.deepEqual(lignesDe(etat({ image: false })), [])
})

test('les durées et les temps à la louche', () => {
  assert.equal(dureeMot(80), '< 0,1 s')
  assert.equal(dureeMot(830), '0,8 s')
  assert.equal(dureeMot(65000), '1 min 05')
  assert.equal(environ(25000), '~25 s')
  assert.equal(environ(80000), '~1 min 20')
  assert.equal(environ(118000), '~2 min')
})

test('les mots de l\'accueil sont là, en trois lignes', () => {
  assert.equal(MOTS.accueil.lignes.length, 3)
  assert.equal(MOTS.accueil.exemples, 'Ou essaie avec un exemple')
})

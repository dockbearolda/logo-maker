/* LA FICHE (15 octobre 2026, « ultra simple d'utilisation » : la vendeuse
   voit le résultat et les décisions en mots, changeables d'un clic). Le
   panneau de droite n'est plus une liste de réglages : il dit CE QUE L'APP
   A FAIT, une ligne par décision du graphiste, dans l'ordre de la chaîne,
   en mots de vendeuse — et chaque ligne s'ouvre sur le réglage qui la
   change. Ce module est pur : l'état plat que lui donne le studio
   (`etatFiche`, lib/studio-detourage.js) → les lignes et leurs mots. Rien
   d'autre : c'est lui qu'on teste à sec, et c'est ici que le chantier
   français / anglais traduira (`MOTS`). Spec :
   docs/superpowers/specs/2026-10-15-parcours-en-un-geste-design.md */

/* TOUS LES MOTS de la fiche et de l'accueil. Des mots de vendeuse : jamais
   « nœuds », « seuil », « lissage » dans une ligne fermée. */
export const MOTS = {
  enTete: { lecture: 'Lecture du fichier…', cours: 'Préparation…', pret: 'Prêt' },
  image: {
    titre: 'Image améliorée', cours: 'Image en cours', agrandie: 'agrandie ×4', ultra: 'Ultra', flou: 'flou corrigé',
    gardee: 'Image gardée telle quelle', gardeeDetail: 'déjà nette et grande',
    sans: 'Sans amélioration', sansDetail: 'décochée',
    aideIA: 'Le logo redessiné net et agrandi ×4 par l\'IA, fidèle au fichier',
    aideNet: 'Le flou du fichier mesuré et retiré avant l\'IA, sans rien inventer',
  },
  fond: {
    retire: 'Fond retiré', partout: 'partout, même dans les lettres', autour: 'autour du logo seulement',
    sujet: 'Sujet détouré', sujetDetail: 'trouvé par l\'IA', entier: 'Fond gardé', entierDetail: 'l\'image entière',
    cours: 'Fond en cours', aideSeuil: 'Plus haut : plus de fond part',
  },
  version: {
    vecteur: 'Vectorisé', vecteurDetail: 'net à toute taille', image: 'Image', imageDetail: 'dégradés et textures gardés',
    detoure: 'Détouré', detoureDetail: 'les pixels du fichier, sans le fond', cours: 'Tracé en cours',
    aideLissage: 'Plus haut : des courbes plus douces',
  },
  couleurs: {
    n: n => n + ' couleur' + (n > 1 ? 's' : ''), origine: 'd\'origine', degrade: 'Dégradés', degradeDetail: 'les couleurs du fichier',
    une: 'Une couleur', cours: 'Couleurs', coursDetail: 'en cours', aideNuances: 'Auto : le graphiste compte les teintes',
  },
  texte: {
    titre: 'Texte', lecture: 'lecture en cours', recherche: 'recherche des polices', erreur: 'lecture indisponible',
    reconnue: p => p + ' reconnue et posée', proposee: p => p + ' proposée', choisie: p => p + ', choisie',
    dessin: 'dessin d\'origine', rechercheLigne: 'recherche de la police…', retiree: 'retirée',
  },
  retoucher: { titre: 'Retoucher', detail: 'calques, contour, gomme, déplacer', comble: p => 'rebouchage ' + p + ' %', gomme: 'La gomme est sur le plan (touche G)' },
  encore: 'encore',
  accueil: {
    lignes: ['Le fond part, le flou aussi, le texte retrouve sa police.', 'Le fichier ressort prêt pour la presse.', 'Rien ne quitte ce poste.'],
    exemples: 'Ou essaie avec un exemple',
  },
}

/* « 0,4 s », « 12,8 s », « 1 min 05 » : une durée mesurée. */
export function dureeMot(ms) {
  if (ms < 100) return '< 0,1 s'
  if (ms < 60000) return (ms / 1000).toFixed(1).replace('.', ',') + ' s'
  return Math.floor(ms / 60000) + ' min ' + String(Math.floor(ms % 60000 / 1000)).padStart(2, '0')
}

/* Un temps à attendre, à la louche : « ~25 s », « ~1 min 20 ». */
export function environ(ms) {
  const s = Math.max(1, Math.round(ms / 1000))
  if (s < 60) return '~' + s + ' s'
  const m = Math.floor(s / 60), r = Math.round(s % 60 / 10) * 10
  return r === 60 ? '~' + (m + 1) + ' min' : '~' + m + ' min' + (r ? ' ' + r : '')
}

/* L'état d'une ligne, lu sur ses étapes : un échec l'emporte, puis ce qui
   tourne, puis ce qui attend, puis ce qui est fait ; rien de prévu :
   « omise » (ni icône, ni durée). */
const etatDe = pas => {
  const p = pas.filter(Boolean)
  for (const e of ['echec', 'cours', 'attente', 'fait']) if (p.some(x => x.etat === e)) return e
  return 'omise'
}
const enCours = pas => pas.find(p => p && p.etat === 'cours') || null
const partConnue = c => c.part !== null && c.part !== undefined
/* Ce qui s'affiche à droite : la part de l'étape qui tourne (ou ses
   secondes passées, sans part connue), sinon la durée de ce qui est fait. */
const valeurDe = pas => {
  const c = enCours(pas)
  if (c) return partConnue(c) ? Math.round(c.part * 100) + ' %' : (c.depuis || 0) >= 1000 ? Math.floor(c.depuis / 1000) + ' s' : ''
  const ms = pas.reduce((s, p) => s + (p && p.etat === 'fait' && p.ms ? p.ms : 0), 0)
  return ms ? dureeMot(ms) : ''
}
const partDe = pas => { const c = enCours(pas); return c && partConnue(c) ? Math.max(0, Math.min(1, c.part)) : null }
const erreurDe = pas => { const p = pas.find(x => x && x.etat === 'echec'); return p ? p.erreur || 'Erreur inconnue.' : '' }
/* Le sous-titre d'une étape qui tourne : sa phase, et le temps qui reste
   quand on le sait (1,5 s au moins). */
const motCours = (c, ...avant) => [...avant, c.mot && c.mot !== 'Ultra' ? c.mot : '', c.reste >= 1500 ? MOTS.encore + ' ' + environ(c.reste) : ''].filter(Boolean).join(' · ')

const ligne = (id, titre, detail, pas, extra = {}) => Object.assign({
  id, titre, detail, etat: etatDe(pas), valeur: valeurDe(pas), part: partDe(pas), erreur: erreurDe(pas), cachee: false,
}, extra)

function ligneImage(e) {
  const pas = [e.etapes.net, e.etapes.ia]
  const c = enCours(pas)
  if (c) return ligne('image', MOTS.image.cours, motCours(c, c === e.etapes.ia && e.ia.ultra ? MOTS.image.ultra : ''), pas)
  const etat = etatDe(pas)
  if (etat === 'attente' || etat === 'echec') return ligne('image', MOTS.image.titre, MOTS.image.agrandie, pas)
  if (!e.ia.faite) {
    if (e.ia.decochee) return ligne('image', MOTS.image.sans, MOTS.image.sansDetail, [])
    return ligne('image', MOTS.image.gardee, MOTS.image.gardeeDetail, [])
  }
  const detail = [MOTS.image.agrandie, e.ia.ultra ? MOTS.image.ultra : '', e.net.faite && e.net.retire ? MOTS.image.flou : ''].filter(Boolean).join(', ')
  return ligne('image', MOTS.image.titre, detail, pas)
}

function ligneFond(e) {
  const pas = [e.etapes.sujet, e.etapes.detourage]
  const c = enCours(pas)
  const m = e.fond.methode
  const titre = m === 'ia' ? MOTS.fond.sujet : m === 'entier' ? MOTS.fond.entier : MOTS.fond.retire
  const detail = m === 'ia' ? MOTS.fond.sujetDetail : m === 'entier' ? MOTS.fond.entierDetail : e.fond.interieur ? MOTS.fond.partout : MOTS.fond.autour
  if (c) return ligne('fond', MOTS.fond.cours, motCours(c, detail), pas)
  return ligne('fond', titre, detail, pas)
}

function ligneVersion(e) {
  const pas = [e.etapes.trace]
  const c = enCours(pas)
  const v = e.version
  const titre = v === 'detoure' ? MOTS.version.detoure : v === 'image' ? MOTS.version.image : MOTS.version.vecteur
  const detail = v === 'detoure' ? MOTS.version.detoureDetail : v === 'image' ? MOTS.version.imageDetail : MOTS.version.vecteurDetail
  if (c && v !== 'detoure') return ligne('version', MOTS.version.cours, motCours(c, detail), pas)
  return ligne('version', titre, detail, pas)
}

function ligneCouleurs(e) {
  const pas = [e.etapes.trace]
  const cachee = e.version === 'detoure'
  if (enCours(pas) && !cachee) return ligne('couleurs', MOTS.couleurs.cours, MOTS.couleurs.coursDetail, pas, { cachee, valeur: '' })
  const c = e.couleurs
  const etat = etatDe(pas)
  /* Le tracé attend son tour (l'IA passe d'abord), ou n'a rien donné
     encore : « Couleurs », grisée — jamais « 0 couleur ». */
  if (etat === 'attente' || (!c.une && !c.degrade && !c.n)) return ligne('couleurs', MOTS.couleurs.cours, '', [], { cachee, etat: etat === 'attente' ? 'attente' : 'omise' })
  const [titre, detail] = c.une ? [MOTS.couleurs.une, c.nom] : c.degrade ? [MOTS.couleurs.degrade, MOTS.couleurs.degradeDetail] : [MOTS.couleurs.n(c.n), MOTS.couleurs.origine]
  /* La durée est celle du tracé, déjà dite sur Version : pas deux fois. */
  return ligne('couleurs', titre, detail, [], { cachee, etat: etat === 'echec' ? 'echec' : 'omise' })
}

function lignesTexte(e) {
  const pas = [e.etapes.texte]
  const t = e.texte && e.texte.etat
  if (t === 'lecture' || t === 'recherche') return [ligne('texte', MOTS.texte.titre, t === 'lecture' ? MOTS.texte.lecture : MOTS.texte.recherche, pas)]
  if (t === 'erreur') return [ligne('texte', MOTS.texte.titre, MOTS.texte.erreur, pas, { etat: 'echec' })]
  if (etatDe(pas) === 'attente' && !e.lignes.length) return [ligne('texte', MOTS.texte.titre, MOTS.texte.lecture, pas)]
  return e.lignes.map((l, k) => {
    if (l.retiree) return ligne('texte:' + k, l.texte, MOTS.texte.retiree, [], { etat: 'omise' })
    const detail = l.etat === 'recherche' ? MOTS.texte.rechercheLigne : l.etat === 'reconnue' ? MOTS.texte.reconnue(l.police) : l.etat === 'proposee' ? MOTS.texte.proposee(l.police) : l.etat === 'choisie' ? MOTS.texte.choisie(l.police) : MOTS.texte.dessin
    return ligne('texte:' + k, l.texte, detail, [], { etat: l.etat === 'recherche' ? 'cours' : 'fait' })
  })
}

function ligneRetoucher(e) {
  const pas = [e.etapes.combler]
  const c = enCours(pas)
  if (c) return ligne('retoucher', MOTS.retoucher.titre, partConnue(c) ? MOTS.retoucher.comble(Math.round(c.part * 100)) : MOTS.retoucher.detail, pas, { valeur: '' })
  return ligne('retoucher', MOTS.retoucher.titre, MOTS.retoucher.detail, [], { etat: etatDe(pas) === 'echec' ? 'echec' : 'omise', erreur: erreurDe(pas) })
}

/* LES LIGNES de la fiche, dans l'ordre de la chaîne. Sans fichier, rien. */
export function lignesDe(e) {
  if (!e.image) return []
  return [ligneImage(e), ligneFond(e), ligneVersion(e), ligneCouleurs(e), ...lignesTexte(e), ligneRetoucher(e)]
}

/* L'EN-TÊTE : la lecture du fichier, la préparation qui tourne, puis
   « Prêt » et le temps total du dépôt à la dernière étape. */
export function enTeteDe(e) {
  if (e.prep.lecture) return { mot: MOTS.enTete.lecture, valeur: '' }
  if (!e.image) return { mot: '', valeur: '' }
  if (!e.prep.fini) return { mot: MOTS.enTete.cours, valeur: '' }
  return { mot: MOTS.enTete.pret, valeur: e.prep.total ? dureeMot(e.prep.total) : '' }
}

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { creer, noter, aller, reculer, avancer, rafraichir, pareil, quandDit, nomTeinte, decrire, MAX, OUVERT } from './historique.js'
import { NUANCIER } from './nuancier.js'

/* Une photo de réglages, comme la prend le studio. */
const photo = (p = {}) => Object.assign({
  version: 'vecteur', vueChoisie: false, methode: 'uni', fondChoisi: false, creuxChoisi: false,
  reglages: { tolerance: 24, interieur: false, seuil: 50 }, lissage: 50, nuances: 50,
  teinte: { type: 'multi' }, uneCouleur: { type: 'nuancier', nom: 'Noir' },
  teintes: { pleine: 1, recolor: {}, sans: [] },
  polices: { cle: 1, lignes: [{ texte: 'OLDA', choix: -1, police: null, gras: 0, main: false, edite: false, props: [] }], report: [] },
  blanc: true, ia: 'non', net: false,
}, p)
const avec = (p, chemin, v) => { const c = structuredClone(p); chemin(c, v); return c }

test('l\'ouverture est l\'entrée 0, la décision du graphiste', () => {
  const h = creer(photo(), 1000)
  assert.equal(h.points.length, 1)
  assert.equal(h.ici, 0)
  assert.equal(h.points[0].libelle, OUVERT)
  assert.equal(reculer(h, photo()), null)
  assert.equal(avancer(h, photo()), null)
})

test('annuler revient à la photo d\'avant, rétablir à celle d\'après', () => {
  const p0 = photo(), p1 = photo({ lissage: 70 }), p2 = photo({ lissage: 90 })
  const h = creer(p0)
  noter(h, 'Lissage 50 → 70', p1)
  noter(h, 'Lissage 70 → 90', p2)
  assert.equal(h.ici, 2)
  assert.equal(reculer(h, p2), p1)
  assert.equal(reculer(h, p1), p0)
  assert.equal(h.ici, 0)
  assert.equal(avancer(h, p0), p1)
  assert.equal(h.ici, 1)
})

test('le point qu\'on quitte prend l\'état vivant (ce que le graphiste a décidé après coup)', () => {
  const h = creer(photo())
  noter(h, 'Améliorer l\'image', photo({ ia: 'oui' }))
  const vivant = photo({ ia: 'oui', version: 'image' })
  reculer(h, vivant)
  assert.equal(h.points[1].photo, vivant)
  rafraichir(h, photo({ blanc: false }))
  assert.equal(h.points[0].photo.blanc, false)
})

test('un geste après des annulations efface ce qui restait à rétablir', () => {
  const h = creer(photo())
  noter(h, 'a', photo({ lissage: 1 }))
  noter(h, 'b', photo({ lissage: 2 }))
  reculer(h, photo({ lissage: 2 }))
  noter(h, 'c', photo({ lissage: 3 }))
  assert.deepEqual(h.points.map(p => p.libelle), [OUVERT, 'a', 'c'])
  assert.equal(avancer(h, photo()), null)
})

test('50 entrées au plus : le plus vieux geste part, l\'ouverture reste', () => {
  const h = creer(photo())
  for (let k = 1; k <= 80; k++) noter(h, 'geste ' + k, photo({ lissage: k }))
  assert.equal(h.points.length, MAX)
  assert.equal(h.points[0].libelle, OUVERT)
  assert.equal(h.points[1].libelle, 'geste 32')
  assert.equal(h.points.at(-1).libelle, 'geste 80')
  assert.equal(h.ici, MAX - 1)
  assert.equal(aller(h, 0, photo()).lissage, 50)
})

test('aller à un point de l\'historique ; les gestes plus récents restent à rétablir', () => {
  const h = creer(photo())
  for (let k = 1; k <= 4; k++) noter(h, 'g' + k, photo({ lissage: k }))
  assert.equal(aller(h, 1, photo({ lissage: 4 })).lissage, 1)
  assert.equal(h.points.length, 5)
  assert.equal(avancer(h, photo({ lissage: 1 })).lissage, 2)
  assert.equal(aller(h, 2, photo()), null)
  assert.equal(aller(h, 9, photo()), null)
})

test('deux photos pareilles ne font pas de geste — l\'ordre des teintes, les polices proposées n\'y comptent pas', () => {
  const a = photo({ teintes: { pleine: 1, recolor: { '1,2,3': [4, 5, 6], '7,8,9': [0, 0, 0] }, sans: [] } })
  const b = photo({ teintes: { pleine: 1, recolor: { '7,8,9': [0, 0, 0], '1,2,3': [4, 5, 6] }, sans: [] } })
  b.polices.lignes[0].props = [{ id: 'montserrat', nom: 'Montserrat' }]
  b.polices.report = [{ cx: 0.5 }]
  assert.ok(pareil(a, b))
  assert.ok(!pareil(a, photo({ lissage: 51 })))
})

test('le temps, en français', () => {
  const t = 1_000_000
  assert.equal(quandDit(t, t + 5000), 'à l\'instant')
  assert.equal(quandDit(t, t + 59_000), 'à l\'instant')
  assert.equal(quandDit(t, t + 2 * 60_000 + 10), 'il y a 2 min')
  assert.equal(quandDit(t, t + 75 * 60_000), 'il y a 1 h')
  assert.equal(quandDit(t + 1000, t), 'à l\'instant')
})

test('le nom d\'une teinte : celui du nuancier, sinon sa famille', () => {
  assert.equal(nomTeinte([0, 79, 159], NUANCIER), 'Bleu Royal')
  assert.equal(nomTeinte([200, 20, 30], NUANCIER), 'Rouge')
  assert.equal(nomTeinte([10, 10, 12]), 'Noir')
  assert.equal(nomTeinte([250, 250, 250]), 'Blanc')
  assert.equal(nomTeinte([128, 128, 130]), 'Gris')
  assert.equal(nomTeinte([240, 140, 20]), 'Orange')
  assert.equal(nomTeinte([110, 60, 20]), 'Marron')
  assert.equal(nomTeinte([30, 160, 60]), 'Vert')
  assert.equal(nomTeinte([20, 60, 200]), 'Bleu')
  assert.equal(nomTeinte([130, 40, 190]), 'Violet')
  assert.equal(nomTeinte([240, 120, 180]), 'Rose')
  /* Deux verts ne se disent pas « Vert → Vert ». */
  assert.equal(nomTeinte([36, 85, 27]), 'Vert foncé')
  assert.equal(nomTeinte([150, 200, 240]), 'Bleu clair')
  assert.equal(nomTeinte([60, 60, 62]), 'Gris foncé')
})

test('une teinte changée pour une voisine du même nom : « ajusté »', () => {
  const a = photo(), nom = c => nomTeinte(c, NUANCIER)
  assert.equal(decrire(a, avec(a, p => { p.teintes.recolor['36,85,27'] = [58, 170, 53] }), nom), 'Vert foncé → Vert')
  assert.equal(decrire(a, avec(a, p => { p.teintes.recolor['60,170,60'] = [58, 170, 53] }), nom), 'Vert ajusté')
})

test('le libellé d\'un geste, lu entre deux photos', () => {
  const a = photo()
  const nom = c => nomTeinte(c, NUANCIER)
  assert.equal(decrire(a, avec(a, p => { p.reglages.tolerance = 32 })), 'Seuil 24 → 32')
  assert.equal(decrire(a, avec(a, p => { p.reglages.interieur = true })), 'Fond : Partout')
  assert.equal(decrire(a, avec(a, p => { p.methode = 'ia' })), 'Fond : Sujet')
  assert.equal(decrire(a, photo({ version: 'image', reglages: { tolerance: 24, interieur: true, seuil: 50 } })), 'Version : Image')
  assert.equal(decrire(a, photo({ lissage: 70 })), 'Lissage 50 → 70')
  assert.equal(decrire(a, photo({ nuances: 80 })), 'Nuances Auto → 80')
  assert.equal(decrire(a, photo({ teinte: { type: 'nuancier', nom: 'Rouge' } })), 'Une couleur : Rouge')
  assert.equal(decrire(photo({ teinte: { type: 'nuancier', nom: 'Rouge' } }), a), 'Couleurs d\'origine')
  assert.equal(decrire(a, avec(a, p => { p.teintes.sans.push([200, 20, 30]) }), nom), 'Rouge retiré')
  assert.equal(decrire(avec(a, p => { p.teintes.sans.push([200, 20, 30]) }), a, nom), 'Rouge remis')
  assert.equal(decrire(a, avec(a, p => { p.teintes.recolor['200,20,30'] = [0, 79, 159] }), nom), 'Rouge → Bleu Royal')
  assert.equal(decrire(avec(a, p => { p.teintes.recolor['200,20,30'] = [0, 79, 159] }), a, nom), 'Bleu Royal → Rouge')
  assert.equal(decrire(a, avec(a, p => { p.polices.lignes[0].choix = 0; p.polices.lignes[0].police = 'Montserrat' })), 'Police : Montserrat')
  assert.equal(decrire(avec(a, p => { p.polices.lignes[0].choix = 0; p.polices.lignes[0].police = 'Montserrat' }), a), 'Police : dessin d\'origine')
  assert.equal(decrire(a, avec(a, p => { p.polices.lignes[0].gras = 40 })), 'Gras 0 → 40')
  assert.equal(decrire(a, avec(a, p => { p.polices.lignes[0].texte = 'OLDA PRINT' })), 'Texte : OLDA PRINT')
  assert.equal(decrire(a, photo({ blanc: false })), 'Blanc DTF coupé')
  assert.equal(decrire(a, photo({ ia: 'oui' })), 'Améliorer l\'image')
  assert.equal(decrire(photo({ ia: 'oui' }), a), 'Sans amélioration de l\'image')
  assert.equal(decrire(photo({ ia: 'oui' }), photo({ ia: 'ultra' })), 'IA Ultra')
  assert.equal(decrire(photo({ ia: 'oui' }), photo({ ia: 'oui', net: true })), 'Améliorer la netteté')
  assert.equal(decrire(photo({ ia: 'oui', net: true }), photo({ ia: 'oui' })), 'Sans amélioration de la netteté')
})

test('les teintes d\'une autre image ne se comparent pas (l\'IA a changé l\'image)', () => {
  const a = photo({ teintes: { pleine: 1, recolor: {}, sans: [] } })
  const b = photo({ teintes: { pleine: 2, recolor: {}, sans: [[200, 20, 30]] } })
  assert.equal(decrire(a, b), 'Réglage')
})

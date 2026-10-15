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
  polices: { cle: 1, lignes: [{ texte: 'ATELIER', choix: -1, police: null, gras: 0, main: false, edite: false, props: [] }], report: [] },
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
  assert.equal(decrire(a, avec(a, p => { p.methode = 'entier' })), 'Fond : Entier')
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
  assert.equal(decrire(a, avec(a, p => { p.polices.lignes[0].texte = 'ATELIER PRINT' })), 'Texte : ATELIER PRINT')
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

test('le contour et les éléments retirés se disent', () => {
  const p = photo()
  assert.equal(decrire(p, photo({ contour: { mm: 1.5, nom: 'Blanc' } })), 'Contour 1,5 mm · Blanc')
  assert.equal(decrire(photo({ contour: { mm: 1.5, nom: 'Blanc' } }), photo({ contour: { mm: 1.5, nom: 'Noir' } })), 'Contour 1,5 mm · Noir')
  assert.equal(decrire(photo({ contour: { mm: 2, nom: 'Blanc' } }), photo({ contour: { mm: 0, nom: 'Blanc' } })), 'Sans contour')
  const retire = e => photo({ reglages: Object.assign({}, p.reglages, { effaces: e }) })
  assert.equal(decrire(p, retire([{ u: 0.5, v: 0.5 }])), 'Élément retiré')
  assert.equal(decrire(p, retire([{ ligne: true, cadre: [0, 0, 1, 1] }])), 'Ligne retirée')
  assert.equal(decrire(retire([{ u: 0.5, v: 0.5 }]), p), 'Élément remis')
})

/* LES CALQUES (12 octobre 2026) : ce que disent les libellés. */
test('les calques : un élément retiré, remis, comblé, recoloré ; la couleur d\'une ligne', () => {
  const nom = c => nomTeinte(c, NUANCIER)
  const e = { u: 0.2, v: 0.3, aire: 0.01 }
  const p0 = photo({ reglages: { tolerance: 24, interieur: false, seuil: 50, effaces: [] } })
  const p1 = photo({ reglages: { tolerance: 24, interieur: false, seuil: 50, effaces: [e] } })
  assert.equal(decrire(p0, p1, nom), 'Élément retiré')
  assert.equal(decrire(p1, p0, nom), 'Élément remis')
  const pl = photo({ reglages: { tolerance: 24, interieur: false, seuil: 50, effaces: [{ poly: [[0, 0], [0.1, 0], [0, 0.1]], cadre: [0, 0, 0.1, 0.1], coupe: true }] } })
  assert.equal(decrire(p0, pl, nom), 'Lasso retiré')
  assert.equal(decrire(pl, p0, nom), 'Lasso remis')
  const pc = photo({ comblements: [{ poly: [[0, 0], [0.1, 0], [0, 0.1]] }] })
  assert.equal(decrire(photo({ comblements: [] }), pc, nom), 'Comblé')
  assert.equal(decrire(pc, photo({ comblements: [] }), nom), 'Comblé, annulé')
  const pr = photo({ reglages: { tolerance: 24, interieur: false, seuil: 50, teintesElements: [{ u: 0.2, v: 0.3, rvb: [255, 255, 255] }] } })
  assert.equal(decrire(p0, pr, nom), 'Élément : Blanc')
  assert.equal(decrire(pr, p0, nom), 'Élément : couleur d\'origine')
  const l0 = photo(), l1 = photo({ polices: { cle: 1, lignes: [{ texte: 'ATELIER', choix: -1, police: null, gras: 0, couleur: [0, 0, 0], main: true, edite: false, props: [] }], report: [] } })
  assert.equal(decrire(l0, l1, nom), 'Couleur du texte : Noir')
  assert.equal(decrire(l1, l0, nom), 'Couleur du texte : d\'origine')
})

test('les calques déplacés : déplacé, agrandi, réduit, tourné, retourné, replacé ; une ligne ; plusieurs', () => {
  const nom = c => nomTeinte(c, NUANCIER)
  const base = { tolerance: 24, interieur: false, seuil: 50 }
  const P = transformations => photo({ reglages: Object.assign({}, base, { transformations }) })
  const e = (plus = {}) => Object.assign({ u: 0.2, v: 0.3, aire: 0.01, pivot: [0.2, 0.3], d: [0, 0], angle: 0, s: [1, 1] }, plus)
  const p0 = P([])
  assert.equal(decrire(p0, P([e({ d: [0.1, 0] })]), nom), 'Élément déplacé')
  assert.equal(decrire(P([e({ d: [0.1, 0] })]), P([e({ d: [0.1, 0], s: [2, 2] })]), nom), 'Élément agrandi')
  assert.equal(decrire(p0, P([e({ s: [0.5, 1] })]), nom), 'Élément réduit')
  assert.equal(decrire(p0, P([e({ angle: 30 })]), nom), 'Élément tourné')
  assert.equal(decrire(p0, P([e({ s: [-1, 1] })]), nom), 'Élément retourné')
  assert.equal(decrire(P([e({ d: [0.1, 0] })]), p0, nom), 'Élément replacé')
  const l = { ligne: { cx: 0.5, cy: 0.5, h: 0.1 }, cadre: [0.4, 0.45, 0.6, 0.55], pivot: [0.5, 0.5], d: [0, 0.2], angle: 0, s: [1, 1] }
  assert.equal(decrire(p0, P([l]), nom), 'Ligne déplacée')
  assert.equal(decrire(p0, P([Object.assign({}, l, { d: [0, 0], angle: 15 })]), nom), 'Ligne tournée')
  assert.equal(decrire(p0, P([Object.assign({}, l, { d: [0, 0], s: [2, 2] })]), nom), 'Ligne agrandie')
  assert.equal(decrire(p0, P([e({ d: [0.1, 0] }), l]), nom), '2 éléments déplacés')
  assert.equal(decrire(P([e({ d: [0.1, 0] })]), P([e({ d: [0.1, 0] })]), nom), 'Réglage', 'rien n\'a bougé')
})

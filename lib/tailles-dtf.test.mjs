import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TAILLES_DTF, tailleImprimee, dpiA, cmDit, lireCm, prereglage, CM_MAX } from './tailles-dtf.js'

const pres = (a, b) => Math.abs(a - b) < 1e-9

test('sans choix, le dessin sort à 300 dpi de ses pixels', () => {
  const t = tailleImprimee(3543, 1772, null)
  assert.ok(t.auto)
  assert.ok(Math.abs(t.l - 30) < 0.01 && Math.abs(t.h - 15.003) < 0.01)
  assert.equal(tailleImprimee(0, 10, null), null)
})

test('une largeur choisie : la hauteur suit les proportions', () => {
  const t = tailleImprimee(600, 300, { cote: 'largeur', cm: 28 })
  assert.ok(!t.auto && pres(t.l, 28) && pres(t.h, 14))
})

test('une hauteur choisie (un logo tout en hauteur) : la largeur suit', () => {
  const t = tailleImprimee(300, 900, { cote: 'hauteur', cm: 9 })
  assert.ok(pres(t.l, 3) && pres(t.h, 9))
})

test('la résolution à cette taille', () => {
  assert.ok(pres(dpiA(3543, 30), 3543 / (30 / 2.54)))
  assert.equal(dpiA(100, 0), 0)
})

test('une taille tapée à la française, bornée, au millimètre', () => {
  assert.equal(lireCm('19,3'), 19.3)
  assert.equal(lireCm('19.34 cm'), 19.3)
  assert.equal(lireCm(' 7 '), 7)
  assert.equal(lireCm('900'), CM_MAX)
  assert.equal(lireCm(''), null)
  assert.equal(lireCm('abc'), null)
  assert.equal(lireCm('-3'), null)
  assert.equal(lireCm('0'), null)
})

test('« 19,3 », « 28 » : la taille dite au millimètre', () => {
  assert.equal(cmDit(19.34), '19,3')
  assert.equal(cmDit(28), '28')
})

test('les préréglages : les largeurs du tableau d\'OLDA', () => {
  assert.deepEqual(TAILLES_DTF.map(t => t.emplacement), ['Cœur, poitrine', 'Dos', 'Bébé', 'Tote bag'])
  assert.equal(prereglage({ cote: 'largeur', cm: 28 }), 'Dos')
  assert.equal(prereglage({ cote: 'largeur', cm: 7 }), 'Cœur, poitrine')
  assert.equal(prereglage({ cote: 'hauteur', cm: 28 }), null)
  assert.equal(prereglage({ cote: 'largeur', cm: 27.5 }), null)
  assert.equal(prereglage(null), null)
})

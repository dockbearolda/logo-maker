import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TAILLES_DTF, tailleImprimee, dpiA, mmDit, lireMm, prereglage, MM_MAX } from './tailles-dtf.js'

const pres = (a, b) => Math.abs(a - b) < 1e-9

test('sans choix, le dessin sort à 300 dpi de ses pixels', () => {
  const t = tailleImprimee(3543, 1772, null)
  assert.ok(t.auto)
  assert.ok(Math.abs(t.l - 300) < 0.1 && Math.abs(t.h - 150.03) < 0.1)
  assert.equal(tailleImprimee(0, 10, null), null)
})

test('une largeur choisie, en mm : la hauteur suit les proportions', () => {
  const t = tailleImprimee(600, 300, { cote: 'largeur', mm: 280 })
  assert.ok(!t.auto && pres(t.l, 280) && pres(t.h, 140))
})

test('une hauteur choisie (un logo tout en hauteur) : la largeur suit', () => {
  const t = tailleImprimee(300, 900, { cote: 'hauteur', mm: 90 })
  assert.ok(pres(t.l, 30) && pres(t.h, 90))
})

test('la résolution à cette taille', () => {
  assert.ok(pres(dpiA(3543, 300), 3543 / (300 / 25.4)))
  assert.equal(dpiA(100, 0), 0)
})

test('une taille tapée en mm, à la française, bornée, au dixième', () => {
  assert.equal(lireMm('193'), 193)
  assert.equal(lireMm('78,5'), 78.5)
  assert.equal(lireMm('78.54 mm'), 78.5)
  assert.equal(lireMm('9000'), MM_MAX)
  assert.equal(lireMm(''), null)
  assert.equal(lireMm('abc'), null)
  assert.equal(lireMm('-3'), null)
  assert.equal(lireMm('0'), null)
})

test('« 322 », « 78,5 » : la taille dite en mm', () => {
  assert.equal(mmDit(322.04), '322')
  assert.equal(mmDit(78.46), '78,5')
})

test('les préréglages : les largeurs du tableau d\'OLDA, en mm', () => {
  assert.deepEqual(TAILLES_DTF.map(t => t.emplacement), ['Cœur, poitrine', 'Dos', 'Bébé', 'Tote bag'])
  assert.equal(prereglage({ cote: 'largeur', mm: 280 }), 'Dos')
  assert.equal(prereglage({ cote: 'largeur', mm: 70 }), 'Cœur, poitrine')
  assert.equal(prereglage({ cote: 'hauteur', mm: 280 }), null)
  assert.equal(prereglage({ cote: 'largeur', mm: 275 }), null)
  assert.equal(prereglage(null), null)
})

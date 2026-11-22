import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chercher, plat, quand } from './recents.js'

const MAINTENANT = new Date(2026, 10, 22, 15, 0).getTime()
const H = 3600000
const f = (nom, ilYa) => ({ nom, date: MAINTENANT - ilYa })
const L = [
  f('WhatsApp Image 2026-11-22 at 12.17.41 (2).jpeg', 3 * H),
  f('logo-new_balance.png', 1 * H),
  f('Café Élysée logo.pdf', 26 * H),
  f('balance-sheet.xlsx.png', 5 * 24 * H),
  f('Strong Together.ai', 40 * 24 * H),
]

test('sans requête : tout, dans le même ordre', () => {
  assert.deepEqual(chercher(L, '  ', MAINTENANT), L)
})

test('sans accents ni casse, séparateurs comme des espaces', () => {
  assert.equal(plat('Café_Élysée-LOGO'), 'cafe elysee logo')
  assert.deepEqual(chercher(L, 'cafe ely', MAINTENANT).map(x => x.nom), ['Café Élysée logo.pdf'])
})

test('le nom qui commence par le mot passe devant', () => {
  assert.deepEqual(chercher(L, 'balance', MAINTENANT).map(x => x.nom), ['balance-sheet.xlsx.png', 'logo-new_balance.png'])
})

test('les mots du temps et des types filtrent', () => {
  assert.deepEqual(chercher(L, "aujourd'hui", MAINTENANT).map(x => x.nom), ['logo-new_balance.png', 'WhatsApp Image 2026-11-22 at 12.17.41 (2).jpeg'])
  assert.deepEqual(chercher(L, 'hier', MAINTENANT).map(x => x.nom), ['Café Élysée logo.pdf'])
  assert.deepEqual(chercher(L, 'png', MAINTENANT).map(x => x.nom), ['logo-new_balance.png', 'balance-sheet.xlsx.png'])
  assert.deepEqual(chercher(L, 'whatsapp jpg', MAINTENANT).length, 1)
  assert.deepEqual(chercher(L, 'vecteur', MAINTENANT).map(x => x.nom), ['Café Élysée logo.pdf', 'Strong Together.ai'])
})

test('quand', () => {
  assert.equal(quand(MAINTENANT - 30000, MAINTENANT), 'à l\'instant')
  assert.equal(quand(MAINTENANT - 5 * 60000, MAINTENANT), 'il y a 5 min')
  assert.match(quand(MAINTENANT - 3 * H, MAINTENANT), /^aujourd'hui 12 h 00$/)
  assert.match(quand(MAINTENANT - 26 * H, MAINTENANT), /^hier 13 h 00$/)
})

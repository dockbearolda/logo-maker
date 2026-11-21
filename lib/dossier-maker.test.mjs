import { test } from 'node:test'
import assert from 'node:assert/strict'
import { horodatage, nomMaker, baseDe, estDeMaker, disponible } from './dossier-maker.js'

const d = new Date(2026, 10, 20, 9, 5)

test('le nom Maker est horodaté et se trie', () => {
  assert.equal(horodatage(d), '2026-11-20-09h05')
  assert.equal(nomMaker('Logo Club.jpeg', 'png', d), 'Logo Club-maker-2026-11-20-09h05.png')
})

test('un fichier repris de Maker ne cumule pas les horodatages', () => {
  assert.equal(nomMaker('Club-maker-2026-11-19-18h40.png', 'png', d), 'Club-maker-2026-11-20-09h05.png')
  assert.equal(nomMaker('Club-maker-2026-11-19-18h40-2.png', 'png', d), 'Club-maker-2026-11-20-09h05.png')
  assert.ok(estDeMaker('Club-maker-2026-11-19-18h40.png'))
  assert.ok(!estDeMaker('Club.png'))
})

test('un nom vide ou interdit reste un nom de fichier', () => {
  assert.equal(baseDe(''), 'logo')
  assert.equal(baseDe('a/b:c.png'), 'a-b-c')
})

test('sans navigateur, pas de dossier : le fichier se téléchargera', () => {
  assert.equal(disponible(), false)
})

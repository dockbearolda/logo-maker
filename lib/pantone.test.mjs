import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pantone } from './pantone.js'

test('un code Pantone tapé de plusieurs façons donne sa couleur', () => {
  for (const s of ['186 C', '186', 'Pantone 186C', 'pms 186 c', ' 186 u ']) assert.deepEqual(pantone(s), { nom: 'Pantone 186 C', rvb: [200, 16, 46] })
  assert.equal(pantone('reflex blue').nom, 'Pantone Reflex Blue C')
  assert.deepEqual(pantone('Cool Gray 7 C').rvb, [151, 153, 155])
  assert.deepEqual(pantone('871 C').rvb, [132, 117, 78])
})

test('un code inconnu ne donne rien', () => {
  for (const s of ['', '99999', 'bonjour', null]) assert.equal(pantone(s), null)
})

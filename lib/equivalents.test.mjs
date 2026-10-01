import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { EQUIVALENTS, equivalentDe, chercherPolices } from './equivalents.js'

const index = JSON.parse(readFileSync(new URL('../vendor/polices/index.json', import.meta.url), 'utf8'))
const catalogue = index.familles.flatMap(f => Object.keys(f.styles).map(style => ({ id: f.id, nom: f.nom, style, source: 'google' })))

test('chaque équivalent est une famille de la réserve', () => {
  const ids = new Set(index.familles.map(f => f.id))
  for (const id of Object.keys(EQUIVALENTS)) assert.ok(ids.has(id), id)
  assert.equal(equivalentDe('jost'), '≈ Futura')
  assert.equal(equivalentDe('roboto'), '')
})

test('chercher une police par son nom, ou par celui de sa jumelle commerciale', () => {
  assert.equal(chercherPolices(catalogue, 'gotham')[0].nom, 'Montserrat')
  assert.deepEqual(chercherPolices(catalogue, 'Futura').map(f => f.nom).slice(0, 2), ['Jost', 'League Spartan'])
  const r = chercherPolices(catalogue, 'montserrat')
  assert.equal(r[0].nom, 'Montserrat')
  assert.equal(r[0].style, 'normal')
  assert.ok(r.length <= 8)
  assert.deepEqual(chercherPolices(catalogue, '  '), [])
})

test('à nom égal, la police du poste passe devant celle de Google', () => {
  const cat = [{ id: 'pt-sans', nom: 'PT Sans', style: 'normal', source: 'google' }, { id: 'poste-pt-sans', nom: 'PT Sans', style: 'normal', source: 'poste' }]
  assert.equal(chercherPolices(cat, 'pt sans')[0].source, 'poste')
})

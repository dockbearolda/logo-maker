import { test } from 'node:test'
import assert from 'node:assert/strict'
import { promptFinition } from './prompt-chatgpt.js'

const analyse = {
  genre: 'logo', flou: true, format: [300, 200], degrade: false,
  couleurs: ['#ff0000', '#000000'],
  lignes: [{ texte: 'OLDA', police: 'Bebas Neue', sure: true, boite: [0.1, 0.1, 0.9, 0.5] }],
}
const noms = { '#ff0000': 'Rouge', '#000000': 'Noir' }

test('la finition reprend le fichier dégrossi, sans le refaire', () => {
  const p = promptFinition({ analyse, largeurCm: 28, version: 'vecteur', nomCouleur: c => noms[c] })
  assert.match(p, /ALREADY been cleaned/)
  assert.match(p, /do NOT start over/)
  assert.match(p, /"OLDA" — font Bebas Neue/)
  assert.match(p, /exactly 2 flat colors \(Rouge, Noir\)/)
  assert.match(p, /28 cm wide/)
  assert.match(p, /VECTOR PDF/)
  /* Le fichier joint est déjà net : ni « flou », ni « trop petit ». */
  assert.doesNotMatch(p, /blurry|only 300 x 200/)
  assert.doesNotMatch(p, /#[0-9a-f]{6}/i)
})

test('une image ou un détouré se finit en pixels, sans aplats forcés', () => {
  const p = promptFinition({ analyse: { ...analyse, genre: 'image' }, version: 'detoure', nomCouleur: c => noms[c] })
  assert.doesNotMatch(p, /VECTOR PDF/)
  assert.match(p, /transparent PNG/)
})

test('sans fiche, un prompt quand même', () => {
  assert.match(promptFinition(), /FINISHING PASS/)
})

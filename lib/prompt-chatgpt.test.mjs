import { test } from 'node:test'
import assert from 'node:assert/strict'
import { promptLogo, lienChatGpt } from './prompt-chatgpt.js'

test('le prompt ChatGPT dit le texte lu mot pour mot et les couleurs en mots', () => {
  const analyse = { genre: 'logo', couleurs: ['#e4032c', '#000000'], lignes: [{ texte: 'Bad Girl', police: 'Pacifico', sure: true, boite: [0.1, 0.6, 0.9, 0.9] }], format: [600, 400] }
  const p = promptLogo({ analyse, largeurCm: 28, nomCouleur: h => h === '#000000' ? 'Noir' : 'Rouge' })
  assert.match(p, /"Bad Girl"/)
  assert.match(p, /exactly 2 colors \(Rouge, Noir\)/)
  assert.match(p, /about 28 cm wide/)
  assert.doesNotMatch(p, /#[0-9a-f]{6}/i)
})

test('sans fiche, le prompt garde le fond autour seulement (image)', () => {
  assert.match(promptLogo(), /Remove ONLY the background around the subject/)
})

test('le lien ChatGPT pré-remplit le prompt sans l\'envoyer', () => {
  assert.equal(lienChatGpt('a b'), 'https://chatgpt.com/?prompt=a+b')
})

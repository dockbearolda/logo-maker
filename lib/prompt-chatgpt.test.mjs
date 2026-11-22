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

test('les prompts vont vite : une réponse sans question, une image, reprises bornées', async () => {
  const { promptFinition } = await import('./prompt-chatgpt.js')
  const analyse = { genre: 'logo', couleurs: ['#000000'], lignes: [], format: [600, 400] }
  for (const p of [promptLogo({ analyse, largeurCm: 28 }), promptLogo(), promptFinition({ analyse, largeurCm: 28 }), promptFinition()]) {
    assert.match(p, /ONE reply/)
    assert.match(p, /do not wait for my confirmation/)
    assert.match(p, /ONE preview image/)
    assert.doesNotMatch(p, /4000 px|fix and re-run/)
  }
  assert.match(promptLogo({ analyse, largeurCm: 28 }), /at most 2 correction passes/)
})

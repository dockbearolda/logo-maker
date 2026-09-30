/* LE STUDIO DE DÉTOURAGE SE COMPILE (25 septembre 2026). Il ne tourne que
   dans le navigateur — les tests du métier ne l'importent pas —, et une
   faute de syntaxe y laisse le comptoir ENTIER sans logique : la page
   importe le module avant de démarrer. On le compile ici, comme le
   navigateur. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

for (const f of ['studio-detourage.js', 'detourage-travail.js', 'detourage.js', 'sujet.js', 'pdf-image.js', 'png.js', 'geometrie.js', 'export-logo.js', 'vecteur-lisse.js', 'nettoyage.js', 'graphiste.js', 'image-nette.js']) {
  test('lib/' + f + ' se compile', () => {
    assert.doesNotThrow(() => execFileSync(process.execPath, ['--check', fileURLToPath(new URL('./' + f, import.meta.url))], { stdio: 'pipe' }))
  })
}

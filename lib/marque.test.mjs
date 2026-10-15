import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { MARQUE } from './marque.js'

const RACINE = join(import.meta.dirname, '..')
// Le code sans ses commentaires (HTML, les blocs, les lignes) : ce que
// l'app dit, pas l'histoire qu'elle raconte.
const sansCommentaires = s => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

test('la marque est un nom, sans OLDA', () => {
  assert.equal(typeof MARQUE, 'string')
  assert.ok(MARQUE.length > 0)
  assert.doesNotMatch(MARQUE, /olda/i)
})

test('plus un seul « OLDA » dans la page, le code, le paquet, le README', async () => {
  const fautes = []
  for (const f of ['index.html', 'package.json', 'README.md', 'vendor/LISEZMOI.md']) {
    const s = sansCommentaires(await readFile(join(RACINE, f), 'utf8'))
    for (const [i, l] of s.split('\n').entries()) if (/olda/i.test(l)) fautes.push(f + ':' + (i + 1))
  }
  for (const f of await readdir(join(RACINE, 'lib'))) {
    if (!f.endsWith('.js')) continue
    const s = sansCommentaires(await readFile(join(RACINE, 'lib', f), 'utf8'))
    for (const [i, l] of s.split('\n').entries()) if (/olda/i.test(l)) fautes.push('lib/' + f + ':' + (i + 1))
  }
  for (const d of ['vendor', 'outils', 'exemples']) {
    for (const f of await readdir(join(RACINE, d)).catch(() => [])) if (/olda/i.test(f)) fautes.push(d + '/' + f)
  }
  assert.deepEqual(fautes, [])
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { NUANCIER } from './nuancier.js'
import { cmjn } from './cmjn.js'
import { svgVersPdf } from './pdf-vectoriel.js'
import { svgVersEps } from './export-logo.js'
import { lireAse } from '../outils/nuancier.mjs'

test('le nuancier est celui du fichier d\'Illustrator, dans son ordre', () => {
  const ase = lireAse(readFileSync(new URL('../outils/nuancier-olda-2026-v2.ase', import.meta.url)))
  assert.deepEqual(NUANCIER.map(({ nom, cmjn }) => ({ nom, cmjn })), ase)
  assert.equal(NUANCIER.length, 17)
  assert.deepEqual(NUANCIER.find(c => c.nom === 'Rouge').cmjn, [0, 100, 81.21, 0])
})

test('chaque couleur a son propre rendu à l\'écran', () => {
  assert.equal(new Set(NUANCIER.map(c => c.rvb.join(','))).size, NUANCIER.length)
})

test('une couleur du nuancier sort dans ses encres officielles, pas convertie', () => {
  for (const c of NUANCIER) assert.deepEqual(cmjn(c.rvb), c.cmjn.map(v => v / 100), c.nom)
  /* Le noir du nuancier : N100 seul ; le noir d'un fichier reste un noir riche. */
  assert.deepEqual(cmjn(NUANCIER.find(c => c.nom === 'Noir').rvb), [0, 0, 0, 1])
  assert.ok(cmjn([0, 0, 0])[0] > 0.8)
})

test('le PDF et l\'EPS écrivent ces encres telles quelles', () => {
  const rouge = NUANCIER.find(c => c.nom === 'Rouge').rvb
  const svg = '<svg viewBox="0 0 10 10" width="10" height="10"><path fill="rgb(' + rouge.join(',') + ')" d="M0 0L10 0L10 10Z"/></svg>'
  assert.match(svgVersPdf(svg), /\n0 1 0\.8121 0 k\n/)
  assert.match(svgVersEps(svg), /\n0 1 0\.8121 0 setcmykcolor\n/)
  const marron = NUANCIER.find(c => c.nom === 'Marron').rvb
  assert.match(svgVersPdf(svg.replace(rouge.join(','), marron.join(','))), /\n0\.2656 0\.6328 0\.7266 0\.2031 k\n/)
})

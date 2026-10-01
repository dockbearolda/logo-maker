import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Font, Glyph, Path, parse } from '../vendor/opentype.min.mjs'
import { ignoree, ajouterPolices, lireAjouts, octets } from './reserve-polices.js'
import { decrireFace } from './polices-poste.js'

test('les familles écartées : les écritures d\'ailleurs, pas un nom latin qui en contient un court', () => {
  for (const f of ['PingFang SC', 'Apple Color Emoji', 'Noto Sans Kannada', 'Rod', 'David', 'Sana', 'Muna', 'Kohinoor Bangla', '.SF NS', 'Wingdings 2', 'Arial Hebrew']) assert.ok(ignoree(f), f)
  for (const f of ['Rodeo', 'Brody', 'Davida', 'Munari', 'Sana Sans', 'Helvetica', 'Galvji', 'Noto Sans Mono', 'Futura', 'Avenir Next']) assert.ok(!ignoree(f), f)
})

/* Une police déposée, sans coffre (Node n'a pas IndexedDB : comme une
   navigation privée qui le refuse) : elle sert pour la visite, et le dit. */
test('une police déposée sans coffre sert quand même, pour la visite', async () => {
  const glyphes = [new Glyph({ name: '.notdef', advanceWidth: 500, path: new Path() })]
  for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz') {
    const p = new Path(); p.moveTo(50, 0); p.lineTo(450, 0); p.lineTo(450, 700); p.lineTo(50, 700); p.close()
    glyphes.push(new Glyph({ name: c, unicode: c.charCodeAt(0), advanceWidth: 500, path: p }))
  }
  const o = new Font({ familyName: 'Maison Client', styleName: 'Bold', unitsPerEm: 1000, ascender: 800, descender: -200, weightClass: 700, glyphs: glyphes }).toArrayBuffer()
  const decrire = async faces => faces.map(f => decrireFace(parse(f.octets)))
  const r = await ajouterPolices([new File([o], 'maison.ttf'), new File([new Uint8Array(4)], 'cassee.woff2')], decrire)
  assert.equal(r.ajoutees, 1)
  assert.equal(r.gardees, false)
  assert.equal(r.refusees.length, 1)
  const ajouts = await lireAjouts()
  assert.equal(ajouts.length, 1)
  assert.equal(ajouts[0].famille, 'Maison Client')
  assert.ok(ajouts[0].cle.startsWith('ajout:'))
  const b = await octets('ajout', ajouts[0].cle)
  assert.equal(b.byteLength, o.byteLength)
})

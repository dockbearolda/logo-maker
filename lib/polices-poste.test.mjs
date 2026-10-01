import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { Font, Glyph, Path, parse } from '../vendor/opentype.min.mjs'
import { facesTtc, decrireFace, famillesPoste, slug } from './polices-poste.js'
import { CARACTERES, ajuster } from './polices.js'

/* UNE POLICE FABRIQUÉE, écrite en octets comme un fichier : les 52
   lettres en blocs (`larges` : plus larges), d'une graisse donnée. */
function octetsPolice({ famille = 'Essai Sans', style = 'Regular', graisse = 400, larges = 1, lettres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' } = {}) {
  const e = graisse / 4
  const glyphes = [new Glyph({ name: '.notdef', advanceWidth: 500, path: new Path() }), new Glyph({ name: 'space', unicode: 32, advanceWidth: 250, path: new Path() })]
  for (const c of lettres) {
    const p = new Path()
    const h = /[a-z]/.test(c) ? 500 : 700, l = 420 * larges
    p.moveTo(50, 0); p.lineTo(50 + l, 0); p.lineTo(50 + l, h); p.lineTo(50, h); p.close()
    p.moveTo(50 + e, e); p.lineTo(50 + e, h - e); p.lineTo(50 + l - e, h - e); p.lineTo(50 + l - e, e); p.close()
    glyphes.push(new Glyph({ name: c, unicode: c.charCodeAt(0), advanceWidth: 100 + l, path: p }))
  }
  const f = new Font({ familyName: famille, styleName: style, unitsPerEm: 1000, ascender: 800, descender: -200, weightClass: graisse, glyphs: glyphes })
  return f.toArrayBuffer()
}

/* UNE COLLECTION (.ttc) de plusieurs polices : l'en-tête « ttcf », puis
   chaque police recopiée, ses positions décalées. */
function collection(polices) {
  const tete = 12 + 4 * polices.length
  const total = tete + polices.reduce((s, p) => s + p.byteLength, 0)
  const sortie = new Uint8Array(total)
  const v = new DataView(sortie.buffer)
  v.setUint32(0, 0x74746366); v.setUint32(4, 0x00010000); v.setUint32(8, polices.length)
  let o = tete
  polices.forEach((p, k) => {
    v.setUint32(12 + 4 * k, o)
    const u = new Uint8Array(p)
    sortie.set(u, o)
    const d = new DataView(sortie.buffer, o)
    const n = d.getUint16(4)
    for (let t = 0; t < n; t++) d.setUint32(12 + 16 * t + 8, d.getUint32(12 + 16 * t + 8) + o)
    o += p.byteLength
  })
  return sortie.buffer
}

test('une face mesurée comme celles de l\'index : graisse, capitale, trait, cadres', () => {
  const d = decrireFace(parse(octetsPolice({ graisse: 700 })), { cle: 'EssaiSans-Bold' })
  assert.equal(d.famille, 'Essai Sans')
  assert.equal(d.graisse, 700)
  assert.equal(d.style, 'normal')
  assert.equal(d.cap, 700)
  assert.ok(d.e > 0.15 && d.e < 0.4, 'trait ' + d.e)
  assert.equal(d.boites.length, 4 * CARACTERES.length)
  const i = CARACTERES.indexOf('a')
  assert.deepEqual(d.boites.slice(4 * i, 4 * i + 4), [50, 0, 470, 500])
  assert.equal(d.boites[4 * CARACTERES.indexOf('€')], null)
  assert.equal(d.av, undefined)
})

test('une face sans l\'alphabet latin n\'est pas une police de logo', () => {
  assert.equal(decrireFace(parse(octetsPolice({ lettres: 'ABC' }))), null)
  assert.equal(decrireFace(parse(octetsPolice()), { famille: '.SF NS' }), null)
})

test('une écriture garde l\'avance de ses lettres, son espace, sa pente', () => {
  const d = decrireFace(parse(octetsPolice({ famille: 'Essai Script' })))
  assert.equal(d.av.length, CARACTERES.length)
  assert.equal(d.av[CARACTERES.indexOf('a')], 520)
  assert.equal(d.esp, 250)
  assert.equal(typeof d.pente, 'number')
})

test('une collection TTC se défait en polices à part', () => {
  const a = octetsPolice({ graisse: 400 }), b = octetsPolice({ graisse: 700, style: 'Bold' })
  const faces = facesTtc(collection([a, b]))
  assert.equal(faces.length, 2)
  assert.deepEqual(faces.map(f => parse(f).tables.os2.usWeightClass), [400, 700])
  /* Une police seule revient telle quelle. */
  assert.equal(facesTtc(a)[0].byteLength, a.byteLength)
})

test('les faces d\'une famille réunies comme `famillesDe` les rend ; une chasse à part fait sa famille', () => {
  const faces = [
    decrireFace(parse(octetsPolice({ graisse: 400 })), { cle: 'A', famille: 'Essai Sans', style: 'Regular' }),
    decrireFace(parse(octetsPolice({ graisse: 700, larges: 1.2 })), { cle: 'B', famille: 'Essai Sans', style: 'Bold' }),
    decrireFace(parse(octetsPolice({ graisse: 700, larges: 1.2 })), { cle: 'B', famille: 'Essai Sans', style: 'Bold' }),
    decrireFace(parse(octetsPolice({ graisse: 400, larges: 0.6 })), { cle: 'C', famille: 'Essai Sans', style: 'Condensed Regular' }),
    decrireFace(parse(octetsPolice({ graisse: 400 })), { cle: 'D', famille: 'Essai Sans', style: 'Italic' }),
  ]
  const fams = famillesPoste(faces, 'poste')
  assert.deepEqual(fams.map(f => f.id + '|' + f.style), ['poste-essai-sans|normal', 'poste-essai-sans|italic', 'poste-essai-sans-condensed|normal'])
  const f = fams[0]
  assert.deepEqual(f.fichiers.map(x => [x.graisse, x.local, x.source]), [[400, 'A', 'poste'], [700, 'B', 'poste']])
  assert.equal(f.fichiers[0].w, 1)
  assert.ok(Math.abs(f.fichiers[1].w - 1.2) < 0.01)
  assert.deepEqual(f.boite('H'), { x1: 50, y1: 0, x2: 470, y2: 700 })
  assert.equal(f.cap, 700)
  /* Elle se cale sur des lettres comme une famille de Google. */
  const lettres = [...'HELLO'].map((c, k) => ({ c, x0: 10 + 50 * k, x1: 10 + 50 * k + 41, y0: 20, y1: 89 }))
  const cal = ajuster(lettres, null, f.boite)
  assert.ok(Math.abs(cal.echelle - 0.1) < 0.002)
  assert.equal(slug('Gill Sans Nova'), 'gill-sans-nova')
})

/* SUR CE POSTE (un Mac), une vraie police commerciale. */
const ARIAL = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
test('Arial Bold, du poste', { skip: !existsSync(ARIAL) }, () => {
  const d = decrireFace(parse(readFileSync(ARIAL).buffer.slice(0)), { cle: 'Arial-BoldMT', famille: 'Arial', style: 'Bold' })
  assert.equal(d.famille, 'Arial')
  assert.equal(d.graisse, 700)
  assert.ok(d.cap > 1400 && d.cap < 1500)
})

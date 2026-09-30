import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inflateSync, crc32 as crcNode } from 'node:zlib'
import { pngHd, crc32, parMetre } from './png.js'

/* Les blocs d'un PNG : nom, octets, et leur contrôle vérifié. */
function blocs(png) {
  const b = Buffer.from(png)
  assert.deepEqual([...b.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const liste = []
  for (let o = 8; o < b.length;) {
    const n = b.readUInt32BE(o)
    const nom = b.toString('latin1', o + 4, o + 8)
    const donnees = b.subarray(o + 8, o + 8 + n)
    assert.equal(b.readUInt32BE(o + 8 + n), crcNode(b.subarray(o + 4, o + 8 + n)), 'contrôle du bloc ' + nom)
    liste.push({ nom, donnees })
    o += 12 + n
  }
  return liste
}

/* Défaire le prédicteur (Paeth, un octet de filtre par ligne). */
function lire(brut, largeur, hauteur, canaux) {
  const ligne = largeur * canaux
  const sortie = new Uint8Array(ligne * hauteur)
  for (let y = 0; y < hauteur; y++) {
    assert.equal(brut[y * (ligne + 1)], 4)
    for (let x = 0; x < ligne; x++) {
      const a = x >= canaux ? sortie[y * ligne + x - canaux] : 0
      const b = y ? sortie[(y - 1) * ligne + x] : 0
      const c = x >= canaux && y ? sortie[(y - 1) * ligne + x - canaux] : 0
      const p = a + b - c
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
      sortie[y * ligne + x] = brut[y * (ligne + 1) + 1 + x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)
    }
  }
  return sortie
}

test('le contrôle des blocs est celui du PNG', () => {
  assert.equal(crc32(new TextEncoder().encode('IEND')), 0xae426082)
  assert.equal(crc32(new Uint8Array([1, 2, 3])), crcNode(Buffer.from([1, 2, 3])))
})

test('un PNG HD : RGBA 8 bits, 300 dpi, chaque pixel tel quel', async () => {
  /* 3 × 2 : du rouge opaque, un bord de cheveux à 10 %, du vide. */
  const rgba = new Uint8ClampedArray([
    200, 20, 30, 255, 91, 64, 51, 26, 0, 0, 0, 0,
    200, 20, 30, 255, 200, 20, 30, 255, 7, 8, 9, 1,
  ])
  const png = await pngHd(rgba, 3, 2)
  const b = blocs(png)
  assert.deepEqual(b.map(x => x.nom), ['IHDR', 'sRGB', 'pHYs', 'IDAT', 'IEND'])
  const ihdr = Buffer.from(b[0].donnees)
  assert.equal(ihdr.readUInt32BE(0), 3)
  assert.equal(ihdr.readUInt32BE(4), 2)
  assert.deepEqual([...ihdr.subarray(8)], [8, 6, 0, 0, 0])
  const phys = Buffer.from(b[2].donnees)
  assert.equal(phys.readUInt32BE(0), 11811)
  assert.equal(phys.readUInt32BE(4), 11811)
  assert.equal(phys[8], 1)
  assert.deepEqual([...lire(inflateSync(b[3].donnees), 3, 2, 4)], [...rgba])
  assert.equal(b[4].donnees.length, 0)
})

test('la résolution se choisit', async () => {
  assert.equal(parMetre(300), 11811)
  assert.equal(parMetre(150), 5906)
  const b = blocs(await pngHd(new Uint8ClampedArray([1, 2, 3, 4]), 1, 1, { dpi: 150 }))
  assert.equal(Buffer.from(b[2].donnees).readUInt32BE(0), 5906)
})

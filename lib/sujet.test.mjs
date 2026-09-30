import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reechantillonner, surBlanc, entreeModele, masqueEnOctets, boite, affinerMasque, poserSujet, coupe, SEUIL, COTE_MODELE, BIREFNET } from './sujet.js'

const ROUGE = [200, 30, 40]
const VERT = [60, 140, 50]

/* UNE PHOTO HD : un disque rouge de rayon 600 sur une herbe verte
   granuleuse, 2 048 px de côté, le bord adouci comme par un objectif. */
const COTE = 2048
const RAYON = 600
function photo() {
  const data = new Uint8ClampedArray(COTE * COTE * 4)
  let graine = 7
  const bruit = () => ((graine = (graine * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5) * 30
  for (let y = 0; y < COTE; y++) {
    for (let x = 0; x < COTE; x++) {
      const c = Math.min(1, Math.max(0, RAYON - Math.hypot(x + 0.5 - COTE / 2, y + 0.5 - COTE / 2) + 0.5))
      const n = bruit()
      const i = (y * COTE + x) * 4
      for (let k = 0; k < 3; k++) data[i + k] = ROUGE[k] * c + (VERT[k] + n) * (1 - c)
      data[i + 3] = 255
    }
  }
  return data
}

/* CE QUE REND LE MODÈLE, en 1 024 : le disque, un bord doux de quatre
   points, posé un point et demi trop large — trois pixels de la photo. */
function masqueDuModele() {
  const m = new Uint8Array(COTE_MODELE * COTE_MODELE)
  const r0 = RAYON * COTE_MODELE / COTE + 1.5
  for (let y = 0; y < COTE_MODELE; y++) {
    for (let x = 0; x < COTE_MODELE; x++) {
      const r = Math.hypot(x + 0.5 - COTE_MODELE / 2, y + 0.5 - COTE_MODELE / 2)
      m[y * COTE_MODELE + x] = Math.round(255 * Math.min(1, Math.max(0, (r0 - r) / 4 + 0.5)))
    }
  }
  return m
}

/* La photo, ses coefficients et son sujet ne se calculent qu'une fois. */
let cache = null
function sujet() {
  if (!cache) {
    const src = photo()
    const affine = affinerMasque(src, COTE, COTE, masqueDuModele())
    cache = { src, affine, d: poserSujet(src, COTE, COTE, affine) }
  }
  return cache
}

const alpha = (d, l, x, y) => d[(y * l + x) * 4 + 3]

test('rééchantillonner : un aplat reste un aplat, la moyenne se garde', () => {
  const plat = new Float32Array(10 * 10).fill(90)
  assert.ok(reechantillonner(plat, 10, 10, 3, 3).every(v => Math.abs(v - 90) < 1e-3))
  assert.ok(reechantillonner(plat, 10, 10, 37, 23).every(v => Math.abs(v - 90) < 1e-3))
  /* Une moitié noire, une moitié blanche : réduite, elle garde son gris
     moyen, et le passage reste dans l'ordre. */
  const moitie = new Float32Array(40).map((_, x) => (x < 20 ? 0 : 255))
  const r = reechantillonner(moitie, 40, 1, 8, 1)
  assert.equal(r.length, 8)
  assert.ok(Math.abs(r.reduce((s, v) => s + v, 0) / 8 - 127.5) < 3)
  for (let x = 1; x < 8; x++) assert.ok(r[x] >= r[x - 1])
  /* Le RVB d'un RGBA : un pas de 4, trois canaux lus. */
  const rgba = new Uint8ClampedArray([10, 20, 30, 255, 10, 20, 30, 255])
  assert.deepEqual([...reechantillonner(rgba, 2, 1, 1, 1, 3, 4)].map(Math.round), [10, 20, 30])
})

test('l\'entrée du modèle : 3 plans centrés, le transparent posé sur du blanc', () => {
  /* 2 × 1 : un pixel rouge pur, un pixel transparent. */
  const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 0])
  assert.notEqual(surBlanc(rgba), rgba)
  assert.deepEqual([...surBlanc(rgba)], [255, 0, 0, 255, 255, 255, 255, 255])
  const opaque = new Uint8ClampedArray([1, 2, 3, 255])
  assert.equal(surBlanc(opaque), opaque, 'une photo opaque passe sans copie')
  const t = entreeModele(rgba, 2, 1, 2)
  assert.equal(t.length, 3 * 2 * 2)
  /* Plan rouge, plan vert, plan bleu : (valeur − 128) / 256. */
  const blanc = (255 - 128) / 256
  const noir = -128 / 256
  assert.ok(Math.abs(t[0] - blanc) < 1e-3, 'rouge du pixel rouge')
  assert.ok(Math.abs(t[4] - noir) < 1e-3, 'vert du pixel rouge')
  assert.ok(Math.abs(t[8] - noir) < 1e-3, 'bleu du pixel rouge')
  assert.ok(Math.abs(t[1] - blanc) < 1e-3 && Math.abs(t[5] - blanc) < 1e-3 && Math.abs(t[9] - blanc) < 1e-3, 'le transparent est blanc')
  /* BiRefNet : chaque canal de 0 à 1, centré et réduit comme ImageNet. */
  const b = entreeModele(rgba, 2, 1, 2, BIREFNET)
  assert.ok(Math.abs(b[0] - (1 - 0.485) / 0.229) < 1e-3, 'rouge du pixel rouge')
  assert.ok(Math.abs(b[4] - (0 - 0.456) / 0.224) < 1e-3, 'vert du pixel rouge')
  assert.ok(Math.abs(b[9] - (1 - 0.406) / 0.225) < 1e-3, 'bleu du transparent')
})

test('la sortie du modèle en octets : bornée, et un modèle hésitant remonte à 1', () => {
  assert.deepEqual([...masqueEnOctets(new Float32Array([0, 0.5, 1, 1.2, -0.1]))], [0, 128, 255, 255, 0])
  assert.deepEqual([...masqueEnOctets(new Float32Array([0, 0.3, 0.6]))], [0, 128, 255])
  /* Rien de sûr nulle part : on ne gonfle pas le bruit. */
  assert.deepEqual([...masqueEnOctets(new Float32Array([0, 0.02]))], [0, 5])
  /* BiRefNet rend des logits : la sigmoïde d'abord. */
  assert.deepEqual([...masqueEnOctets(new Float32Array([-20, 0, 20]), BIREFNET)], [0, 128, 255])
})

test('la moyenne sur un carré garde un aplat et adoucit une marche', () => {
  assert.ok(boite(new Float32Array(25).fill(4), 5, 5, 2).every(v => Math.abs(v - 4) < 1e-5))
  const marche = new Float32Array(10).map((_, x) => (x < 5 ? 0 : 1))
  const b = boite(marche, 10, 1, 1)
  assert.ok(Math.abs(b[4] - 1 / 3) < 1e-5 && Math.abs(b[5] - 2 / 3) < 1e-5)
})

test('la coupe : le voile part sous le seuil, le haut n\'est presque pas durci', () => {
  const c = coupe(20)
  assert.equal(c(0.1), 0)
  assert.equal(c(0.2), 0)
  assert.ok(c(0.6) > 0.5 && c(0.6) < 0.55)
  assert.equal(c(0.97), 1)
  assert.equal(SEUIL, 20)
  /* Au plus haut, elle reste une coupe, pas une division par zéro. */
  assert.ok(Number.isFinite(coupe(500)(0.95)))
})

test('le sujet d\'une photo : le bord recalé sur la photo, au pixel près', () => {
  const { src, d } = sujet()
  const l = COTE, c = COTE / 2
  assert.equal(alpha(d, l, c, c), 255)
  assert.equal(alpha(d, l, 5, 5), 0)
  assert.equal(src[3], 255, 'la source ne bouge pas')
  /* Le long de quatre rayons : plein jusqu'au bord vrai (599 px), presque
     vide juste après, vide à 604 — là où le modèle débordait encore. */
  for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
    const a = r => alpha(d, l, c + dx * r - (dx < 0 ? 1 : 0), c + dy * r - (dy < 0 ? 1 : 0))
    for (let r = 560; r <= 598; r++) assert.ok(a(r) >= 250, 'r ' + r + ' : ' + a(r))
    assert.ok(a(600) <= 80, 'r 600 : ' + a(600))
    for (let r = 604; r < 640; r++) assert.equal(a(r), 0, 'r ' + r)
  }
})

test('les pixels du bord perdent leur part d\'herbe', () => {
  const { src, d } = sujet()
  let vus = 0
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 5 || d[i + 3] > 250) continue
    vus++
    /* Dans la photo, un mélange de rouge et de vert ; ici, du rouge. */
    assert.ok(d[i] > d[i + 1] + 100, 'pixel ' + (i / 4) + ' : ' + [...d.subarray(i, i + 4)] + ' (photo ' + [...src.subarray(i, i + 3)] + ')')
  }
  assert.ok(vus > 1000, vus + ' pixels de bord')
})

test('le seuil : plus haut, le sujet se resserre ; le transparent reste transparent', () => {
  const { src, affine } = sujet()
  const opaques = s => poserSujet(src, COTE, COTE, affine, { seuil: s }).filter((v, i) => i % 4 === 3 && v > 0).length
  const [o0, o20, o80] = [opaques(0), opaques(20), opaques(80)]
  assert.ok(o0 >= o20 && o20 >= o80 && o0 > o80, [o0, o20, o80].join(' ≥ '))
  /* Un pixel déjà transparent dans le fichier ne revient pas. */
  const troue = src.slice()
  troue[(1024 * COTE + 1024) * 4 + 3] = 0
  assert.equal(alpha(poserSujet(troue, COTE, COTE, affine), COTE, 1024, 1024), 0)
})

test('les coefficients servent à toutes les tailles de la même photo', () => {
  const { src, affine } = sujet()
  /* L'aperçu à moitié taille : le même disque, rayon 300. */
  const petit = new Uint8ClampedArray(reechantillonner(src, COTE, COTE, 1024, 1024, 4).map(Math.round))
  const d = poserSujet(petit, 1024, 1024, affine)
  assert.equal(alpha(d, 1024, 512, 512), 255)
  assert.equal(alpha(d, 1024, 2, 2), 0)
  assert.ok(alpha(d, 1024, 512 + 298, 512) >= 250 && alpha(d, 1024, 512 + 302, 512) === 0)
})

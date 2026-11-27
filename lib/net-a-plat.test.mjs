import { test } from 'node:test'
import assert from 'node:assert/strict'
import { netAPlat, sansMelanges, pasDuFichier } from './net-a-plat.js'

const BLEU = [27, 76, 147], BLANC = [235, 238, 244]
/* Une image floue : `dedans(x, y)` donne la part de bleu (0 à 1), plus un
   bruit de JPEG. */
function image(l, h, dedans, bruit = 6) {
  const d = new Uint8ClampedArray(l * h * 4)
  let s = 7
  const alea = () => { s = (s * 16807) % 2147483647; return (s / 2147483647 - 0.5) * 2 * bruit }
  for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) {
    const t = dedans(x, y), i = (y * l + x) * 4
    for (let c = 0; c < 3; c++) d[i + c] = t * BLEU[c] + (1 - t) * BLANC[c] + alea()
    d[i + 3] = 255
  }
  return d
}
const flouDisque = (cx, cy, r, w) => (x, y) => Math.max(0, Math.min(1, 0.5 - (Math.hypot(x - cx, y - cy) - r) / w))
const pal = [BLEU, BLANC]

test('un disque flou ressort net : aplats purs, bord d\'un pixel', () => {
  const L = 120, d = image(L, L, flouDisque(60, 60, 35, 9))
  const rep = netAPlat(d, L, L, { echelle: 4, palette: pal })
  assert.equal(rep.change, true)
  let purs = 0, melanges = 0
  for (let i = 0; i < d.length; i += 4) {
    const bleu = d[i] === BLEU[0] && d[i + 1] === BLEU[1] && d[i + 2] === BLEU[2]
    const blanc = d[i] === BLANC[0] && d[i + 1] === BLANC[1] && d[i + 2] === BLANC[2]
    if (bleu || blanc) purs++; else melanges++
  }
  /* Le tour du disque fait ~220 pixels : le bord tient en un ou deux. */
  assert.ok(melanges < 2 * 2 * Math.PI * 35, 'mélanges : ' + melanges)
  assert.ok(purs > 0.95 * L * L)
  /* Le centre bleu, le coin blanc. */
  assert.deepEqual([...d.slice((60 * L + 60) * 4, (60 * L + 60) * 4 + 3)], BLEU)
  assert.deepEqual([...d.slice(0, 3)], BLANC)
})

test('le bord reste à sa place', () => {
  const L = 120, d = image(L, L, flouDisque(60, 60, 35, 9), 0)
  netAPlat(d, L, L, { echelle: 4, palette: pal })
  /* Sur la ligne du centre, le bleu commence à 60 − 35 = 25 (à un pixel). */
  let x0 = -1
  for (let x = 0; x < L; x++) { const i = (60 * L + x) * 4; if (d[i + 2] < (BLEU[2] + BLANC[2]) / 2) { x0 = x; break } }
  assert.ok(Math.abs(x0 - 25) <= 1, 'bord à ' + x0)
})

test('un trait fin d\'un pixel du fichier (4 à ×4) reste', () => {
  const L = 80, d = image(L, L, (x) => Math.max(0, Math.min(1, 1 - Math.abs(x - 40) / 3)))
  netAPlat(d, L, L, { echelle: 4, palette: pal })
  const i = (40 * L + 40) * 4
  assert.deepEqual([...d.slice(i, i + 3)], BLEU)
})

test('un dégradé (pas un logo à plat) ne change pas', () => {
  const L = 60, d = new Uint8ClampedArray(L * L * 4)
  for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) { const i = (y * L + x) * 4; d[i] = x * 4; d[i + 1] = 255 - y * 4; d[i + 2] = (x * y) % 255; d[i + 3] = 255 }
  const avant = d.slice()
  const rep = netAPlat(d, L, L, { echelle: 4 })
  assert.equal(rep.change, false)
  assert.deepEqual(d, avant)
})

test('le vide ne bouge pas', () => {
  const L = 60, d = image(L, L, flouDisque(30, 30, 15, 6))
  for (let y = 0; y < 10; y++) for (let x = 0; x < L; x++) d[(y * L + x) * 4 + 3] = 0
  const avant = d.slice()
  netAPlat(d, L, L, { echelle: 4, palette: pal })
  for (let i = 0; i < 10 * L * 4; i++) assert.equal(d[i], avant[i])
})

test('les mélanges de deux teintes ne sont pas des teintes', () => {
  const l = sansMelanges([[231, 235, 241], [27, 76, 147], [131, 139, 157], [103, 111, 131], [75, 83, 103], [40, 48, 68]])
  assert.deepEqual(l, [[231, 235, 241], [27, 76, 147], [40, 48, 68]])
  /* Trois vraies teintes restent trois. */
  assert.equal(sansMelanges([[255, 0, 0], [0, 128, 0], [0, 0, 255]]).length, 3)
})

test('un trait gris fin sur du blanc reste gris, même près d\'un bleu', () => {
  const GRIS = [40, 48, 68]
  const L = 80, d = new Uint8ClampedArray(L * L * 4)
  for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
    const i = (y * L + x) * 4
    /* À gauche un aplat bleu ; à droite, un trait gris pâli (fin, anticrénelé). */
    const t = x < 20 ? 1 : 0
    const g = Math.max(0, Math.min(1, 0.6 - Math.abs(x - 55) / 4))
    for (let c = 0; c < 3; c++) d[i + c] = t ? BLEU[c] : g * GRIS[c] + (1 - g) * BLANC[c]
    d[i + 3] = 255
  }
  netAPlat(d, L, L, { echelle: 4, palette: [BLEU, BLANC, GRIS] })
  const i = (40 * L + 55) * 4
  assert.deepEqual([...d.slice(i, i + 3)], GRIS)
})

/* Le bord d'un aplat bleu sur du blanc avec, entre les deux, une bande
   bleu nuit de `w` pixels (à ×4). */
const NUIT = [40, 50, 68]
function bande(w) {
  const L = 80, d = new Uint8ClampedArray(L * L * 4)
  for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
    const i = (y * L + x) * 4
    const c = x < 40 ? BLEU : x < 40 + w ? NUIT : BLANC
    d.set([...c, 255], i)
  }
  netAPlat(d, L, L, { echelle: 4, palette: [BLEU, BLANC, NUIT] })
  const nuit = []
  for (let x = 30; x < 50; x++) { const i = (40 * L + x) * 4; if (d[i] === NUIT[0] && d[i + 1] === NUIT[1] && d[i + 2] === NUIT[2]) nuit.push(x) }
  return nuit
}

test('le liseré de l\'IA entre deux aplats part (24 novembre 2026)', () => {
  assert.deepEqual(bande(2), [])
})

test('un vrai contour d\'un pixel du fichier entre deux aplats reste', () => {
  assert.ok(bande(6).length >= 4, 'contour : ' + bande(6))
})

/* LE BORD DU VIDE ET LE PAS DU FICHIER (27 novembre 2026). */
const NOIR = [30, 30, 30]
/* Un disque noir anticrénelé sur du vide (`l` pixels), agrandi au plus
   proche ×`k`. */
function disqueVide(l, k = 1) {
  const L = l * k, d = new Uint8ClampedArray(L * L * 4)
  for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
    const sx = Math.floor(x / k) + 0.5, sy = Math.floor(y / k) + 0.5
    const a = Math.max(0, Math.min(1, 0.5 - (Math.hypot(sx - l / 2, sy - l / 2) - l / 3)))
    d.set([...NOIR, Math.round(255 * a)], (y * L + x) * 4)
  }
  return { data: d, largeur: L, hauteur: L }
}

test('le pas du fichier : 1 à sa vraie taille, ~2 agrandi au plus proche ×2', () => {
  assert.equal(pasDuFichier(disqueVide(120)), 1)
  const p = pasDuFichier(disqueVide(120, 2))
  assert.ok(p > 1.7 && p < 2.4, 'pas : ' + p)
})

/* L'image de l'IA ×4 d'un disque sur du vide : l'opacité en dents de scie
   (des marches de 6 pixels), la couleur posée sur du blanc au bord. */
function iaDuDisque(l) {
  const L = 4 * l, d = new Uint8ClampedArray(L * L * 4)
  for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
    const r = Math.hypot(Math.floor(x / 6) * 6 + 3 - L / 2, Math.floor(y / 6) * 6 + 3 - L / 2)
    const a = r < L / 3 ? 255 : r < L / 3 + 3 ? 160 : 0
    const t = a / 255
    d.set([...NOIR.map(c => t * c + (1 - t) * 255), a], (y * L + x) * 4)
  }
  return d
}

test('le bord du vide : plus de liseré clair, l\'opacité anticrénelée sur un pixel', () => {
  const l = 60, L = 4 * l, d = iaDuDisque(l)
  const rep = netAPlat(d, L, L, { echelle: 4, palette: [NOIR, [255, 255, 255]] })
  assert.equal(rep.vide, true)
  let clairs = 0, demi = 0
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] && d[i] > 60) clairs++
    if (d[i + 3] > 0 && d[i + 3] < 255) demi++
  }
  assert.equal(clairs, 0, 'pixels clairs au bord : ' + clairs)
  /* Le tour du disque fait ~500 pixels : le bord tient en un ou deux. */
  assert.ok(demi < 2 * 2 * Math.PI * L / 3, 'demi-transparents : ' + demi)
})

test('les marches d\'un fichier agrandi au plus proche se fondent le long du bord', () => {
  /* Une droite en pente douce sur du vide, dans un fichier agrandi ×3 au
     plus proche, puis ×4 (l'IA) : des marches de 12 pixels. */
  const l = 40, k = 3, L = 4 * k * l, s = new Uint8ClampedArray(k * l * k * l * 4), d = new Uint8ClampedArray(L * L * 4)
  /* L'opacité anticrénelée du vrai pixel (x, y) du petit fichier. */
  const couvert = (x, y) => Math.round(255 * Math.max(0, Math.min(1, 0.5 + (y + 0.5 - 0.6 * l - 0.2 * (x + 0.5)) / Math.hypot(1, 0.2))))
  for (let y = 0; y < k * l; y++) for (let x = 0; x < k * l; x++) s.set([...NOIR, couvert(Math.floor(x / k), Math.floor(y / k))], (y * k * l + x) * 4)
  /* L'IA : chaque vrai pixel en bloc de 4k, à demi au bord. */
  for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
    const a = couvert(Math.floor(x / (4 * k)), Math.floor(y / (4 * k)))
    d.set([...NOIR, a > 200 ? 255 : a > 60 ? 128 : 0], (y * L + x) * 4)
  }
  const rep = netAPlat(d, L, L, { echelle: 4, palette: [NOIR, [255, 255, 255]], source: { data: s, largeur: k * l, hauteur: k * l } })
  assert.ok(rep.pas >= 1.25, 'pas : ' + rep.pas)
  /* Le bord, colonne par colonne, s'écarte de la droite de moins de 3
     pixels (les marches en faisaient 12). */
  let pire = 0
  for (let x = L / 4; x < 3 * L / 4; x++) {
    let somme = 0
    for (let y = 0; y < L; y++) somme += d[(y * L + x) * 4 + 3] / 255
    pire = Math.max(pire, Math.abs((L - somme) - (0.6 * L + 0.2 * x)))
  }
  assert.ok(pire < 3, 'écart au bord : ' + pire.toFixed(2))
})

test('un voile (une opacité à 40 % sur une vraie surface) garde son opacité', () => {
  const L = 120, d = image(L, L, flouDisque(60, 60, 35, 9), 0)
  for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) if (x > 60) d[(y * L + x) * 4 + 3] = 102
  const avant = []
  for (let i = 3; i < d.length; i += 4) avant.push(d[i])
  const rep = netAPlat(d, L, L, { echelle: 4, palette: pal })
  assert.equal(rep.vide, false)
  const apres = []
  for (let i = 3; i < d.length; i += 4) apres.push(d[i])
  assert.deepEqual(apres, avant)
})

/* UNE VRAIE ENCRE GRISE N'EST PAS UN MÉLANGE (27 novembre 2026, le banc de
   bout en bout : l'écu au contour gris sur fond crème perdait son contour
   et son texte gris — le gris est sur le segment du noir de l'étoile et du
   crème, mais il ne touche jamais le noir). */
test('un contour gris sur du crème reste, même si un noir est ailleurs', () => {
  const CREME = [245, 240, 230], GRIS = [128, 128, 128], NOIR2 = [0, 0, 0], LIME = [196, 214, 0]
  const L = 160, d = new Uint8ClampedArray(L * L * 4)
  for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
    const r = Math.max(Math.abs(x - 80), Math.abs(y - 80))
    /* Le gris jauni par le JPEG (la couleur du vert bavée) par endroits : plus
       près du segment crème–noir que du gris–vert. */
    const jauni = r >= 50 && r < 66 && (x + y) % 7 === 0
    const c = Math.hypot(x - 80, y - 60) < 10 ? NOIR2 : r < 50 ? LIME : jauni ? [129, 124, 88] : r < 66 ? GRIS : CREME
    d.set([...c, 255], (y * L + x) * 4)
  }
  netAPlat(d, L, L, { echelle: 4, palette: [CREME, GRIS, NOIR2, LIME] })
  for (let y = 20; y < 140; y++) for (let x = 20; x < 140; x++) {
    const r = Math.max(Math.abs(x - 80), Math.abs(y - 80)), i = (y * L + x) * 4
    if (r >= 53 && r <= 63) assert.ok(d[i] > 100, `noir dans le contour gris en ${x},${y} : ${[...d.slice(i, i + 3)]}`)
  }
  const i = (80 * L + 138) * 4
  assert.deepEqual([...d.slice(i, i + 3)], GRIS)
})

test('le gris du bord d\'un disque noir sur du blanc reste un mélange', () => {
  const BLANC2 = [255, 255, 255], NOIR2 = [0, 0, 0], MI = [128, 128, 128]
  const L = 120, d = new Uint8ClampedArray(L * L * 4)
  for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
    /* La rampe de l'agrandissement : quatre pixels de gris entre les deux. */
    const t = Math.max(0, Math.min(1, (Math.hypot(x - 60, y - 60) - 30) / 4 + 0.5))
    d.set([...NOIR2.map((c, k) => Math.round((1 - t) * c + t * BLANC2[k])), 255], (y * L + x) * 4)
  }
  const rep = netAPlat(d, L, L, { echelle: 4, palette: [BLANC2, NOIR2, MI] })
  assert.equal(rep.teintes, 2)
})

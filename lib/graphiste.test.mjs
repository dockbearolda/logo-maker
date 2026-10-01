import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decider, PETIT, PETITE_MATIERE } from './graphiste.js'

const image = (l, h, f) => {
  const data = new Uint8ClampedArray(l * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) data.set(f(x, y), (y * l + x) * 4)
  return { data, largeur: l, hauteur: h }
}
/* Un O rouge sur du blanc : un logo. */
const logo = image(80, 80, (x, y) => {
  const r = Math.hypot(x - 40, y - 40)
  return r > 14 && r < 30 ? [200, 30, 60, 255] : [255, 255, 255, 255]
})
/* Un sujet au milieu d'un décor qui change partout : une photo. */
let graine = 5
const hasard = () => (graine = (graine * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
const photo = image(80, 80, (x, y) => (Math.hypot(x - 40, y - 40) < 18
  ? [200, 150, 110, 255]
  : [Math.round(40 + 120 * hasard()), Math.round(90 + 110 * hasard()), Math.round(30 + 90 * hasard()), 255]))

test('un petit logo sur du blanc : à la couleur, les creux vidés, nettoyé par l\'IA', () => {
  const { flou, ...d } = decider(logo, { largeur: 480, hauteur: 480 })
  assert.deepEqual(d, { fond: 'uni', creux: true, nettoyer: true, matiere: false, birefnet: false, net: false, genre: 'logo', version: 'vecteur', ombre: false })
  assert.ok(flou < 0.5, 'flou ' + flou)
})

test('un grand logo n\'a pas besoin de l\'IA pour être net', () => {
  assert.equal(decider(logo, { largeur: PETIT + 1, hauteur: 600 }).nettoyer, false)
})

/* 29 septembre 2026 : une photo a de la matière — l'IA des photos
   l'agrandit sans en faire un dessin animé. */
test('une petite photo : le sujet par l\'IA, agrandie avec sa matière', () => {
  const { flou, ...d } = decider(photo, { largeur: 400, hauteur: 400 })
  assert.deepEqual(d, { fond: 'ia', creux: true, nettoyer: true, matiere: true, birefnet: false, net: false, genre: 'photo', version: 'detoure', ombre: false })
  assert.ok(flou < 0.5, 'flou ' + flou)
})

/* 27 septembre 2026, « Le Cercle des Créatrices » : un cercle de filets
   dorés sur un fond noir, en JPEG. « Il va de soi que je veux retirer le
   noir » : sur un fond noir ou de couleur, ce qui a sa couleur à
   l'intérieur du dessin est du fond aussi — le papier, vu à travers. */
test('un logo doré sur un fond noir : le noir part aussi dans le cercle', () => {
  let g = 11
  const grain = () => (g = (g * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
  const cercle = image(120, 120, (x, y) => {
    const r = Math.hypot(x - 60, y - 60)
    /* Un anneau doré qui brille, en dégradé : une illustration. */
    if (r > 40 && r < 44) return [Math.round(150 + x), Math.round(130 + x * 0.8), Math.round(70 + y * 0.5), 255]
    return [Math.round(4 * grain()), Math.round(4 * grain()), Math.round(4 * grain()), 255]
  })
  const d = decider(cercle, { largeur: 447, hauteur: 447 })
  assert.equal(d.fond, 'uni')
  assert.equal(d.creux, true)
})

/* 27 septembre 2026, le phénix ouvert dans Illustrator : « les intérieurs
   sont pleins, ça doit être transparent ». Sur le blanc aussi, une
   illustration voit son fond enfermé partir. */
test('sur le blanc, une illustration a aussi ses creux vidés', () => {
  const teinte = (h, l) => {
    const k = n => (n + h / 30) % 12, a = 0.8 * Math.min(l, 1 - l)
    return [0, 8, 4].map(n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)))))
  }
  const illus = image(120, 120, (x, y) => {
    const r = Math.hypot(x - 60, y - 60)
    if (r < 8 || r >= 40) return [255, 255, 255, 255]
    return [...teinte((Math.atan2(y - 60, x - 60) * 180 / Math.PI + 360) % 360, 0.7 - r / 100), 255]
  })
  assert.equal(decider(illus, { largeur: 2000, hauteur: 2000 }).creux, true)
})

/* 29 septembre 2026, « BEA-16 BEIGE BRODERIE » : 1 165 × 1 447 px pour
   30 cm de large, 99 dpi. Trop grand pour le nettoyage d'un logo à plat,
   trop petit pour ses fils : la matière s'agrandit jusqu'à PETITE_MATIERE. */
const broderie = image(120, 120, (x, y) => (Math.hypot(x - 60, y - 60) < 50
  ? ((x + y) % 4 < 2 ? [226, 196, 150, 255] : [176, 140, 96, 255])
  : [0, 0, 0, 0]))

test('une broderie : sa matière reconnue, agrandie par l\'IA au-delà d\'un petit logo', () => {
  const { flou, ...d } = decider(broderie, { largeur: 1165, hauteur: 1447 })
  assert.deepEqual(d, { fond: 'uni', creux: true, nettoyer: true, matiere: true, birefnet: false, net: false, genre: 'image', version: 'image', ombre: false })
  assert.ok(flou < 0.5, 'flou ' + flou)
})

test('une matière déjà assez grande ne passe pas à l\'IA', () => {
  const d = decider(broderie, { largeur: PETITE_MATIERE + 1, hauteur: 900 })
  assert.equal(d.matiere, true)
  assert.equal(d.nettoyer, false)
})

test('un logo à plat de 1 447 px reste trop grand pour le nettoyage', () => {
  assert.equal(decider(logo, { largeur: 1165, hauteur: 1447 }).nettoyer, false)
})

/* 30 septembre 2026, « Strong Together » : une illustration peinte, collée
   sur sa carte blanche au milieu d'une toile transparente (le PNG de
   Canva). Son décor ne part qu'avec le sujet, par BiRefNet. Un logo à
   plat collé de même reste à la couleur. */
test('une illustration collée sur sa carte : le sujet, par BiRefNet seulement', () => {
  let g = 3
  const grain = () => (g = (g * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
  const collee = dessin => image(160, 160, (x, y) => {
    if (x < 20 || x >= 140 || y < 20 || y >= 140) return [0, 0, 0, 0]
    return Math.hypot(x - 80, y - 80) < 45 ? dessin() : [252, 252, 250, 255]
  })
  const peinte = decider(collee(() => [110 + 80 * grain(), 40 + 80 * grain(), 60 + 80 * grain(), 255].map(Math.round)), { largeur: 2000, hauteur: 2000 })
  assert.equal(peinte.fond, 'ia')
  assert.equal(peinte.birefnet, true)
  const aPlat = decider(collee(() => [200, 30, 60, 255]), { largeur: 2000, hauteur: 2000 })
  assert.equal(aPlat.fond, 'uni')
  assert.equal(aPlat.birefnet, false)
})

/* 30 septembre 2026, « la feature de PicWish » : un fichier flou est rendu
   net d'office, même grand — son flou dit en pixels de l'image de
   travail. */
test('un grand logo flou : rendu net d\'office, son flou en pixels de l\'image de travail', async () => {
  const { adoucir } = await import('./nettete.js')
  const l = 600, h = 400, v = new Float32Array(l * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) {
    const r = Math.hypot(x - 200, y - 200)
    v[y * l + x] = (r > 70 && r < 150) || (x > 380 && x < 460 && y > 60 && y < 340) ? 30 : 240
  }
  const b = adoucir(v, l, h, 3)
  const flou = image(l, h, (x, y) => { const g = Math.round(b[y * l + x]); return [g, g, g, 255] })
  /* L'aperçu est la moitié de l'image de travail : son flou double. */
  const d = decider(Object.assign(flou, { echelle: 0.5 }), { largeur: 2400, hauteur: 1600 })
  assert.equal(d.net, true)
  assert.equal(d.nettoyer, true)
  assert.ok(Math.abs(d.flou - 6) < 1, 'flou ' + d.flou)
  /* Le même, net : rien à retirer, et trop grand pour l'IA. */
  const net = decider(Object.assign(image(l, h, (x, y) => { const g = v[y * l + x]; return [g, g, g, 255] }), { echelle: 0.5 }), { largeur: 2400, hauteur: 1600 })
  assert.equal(net.net, false)
  assert.equal(net.nettoyer, false)
})

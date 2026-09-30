import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decider, PETIT } from './graphiste.js'

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
  assert.deepEqual(decider(logo, { largeur: 480, hauteur: 480 }), { fond: 'uni', creux: true, nettoyer: true })
})

test('un grand logo n\'a pas besoin de l\'IA pour être net', () => {
  assert.equal(decider(logo, { largeur: PETIT + 1, hauteur: 600 }).nettoyer, false)
})

test('une photo : le sujet par l\'IA, sans nettoyage', () => {
  assert.deepEqual(decider(photo, { largeur: 400, hauteur: 400 }), { fond: 'ia', creux: true, nettoyer: false })
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

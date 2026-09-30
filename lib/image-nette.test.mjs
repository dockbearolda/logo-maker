import { test } from 'node:test'
import assert from 'node:assert/strict'
import { imageParCouches, etiqueter } from './image-nette.js'

const image = (l, h, f) => {
  const d = new Uint8ClampedArray(l * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) d.set([...f(x, y).map(Math.round), 255], (y * l + x) * 4)
  return d
}
/* Un carré (x0, y0)–(x1, y1), en tracé fermé. */
const carre = (x0, y0, x1, y1) => Float32Array.from([x0, y0, x1, y0, x1, y1, x0, y1])

test('les étiquettes : chaque pixel fin prend la couche du dessus, un trou reste un trou', () => {
  const couches = [
    { couleur: [0, 0, 0], boucles: [carre(0, 0, 10, 10), carre(3, 3, 7, 7)] },
    { couleur: [0, 0, 255], boucles: [carre(4, 4, 6, 6)] },
  ]
  const lab = etiqueter(couches, 0, 0, 1, 10, 10)
  assert.equal(lab[1 * 10 + 1], 0, 'le noir')
  assert.equal(lab[3 * 10 + 3], -1, 'le trou du noir')
  assert.equal(lab[4 * 10 + 4], 1, 'le bleu, posé dessus')
})

test('les étiquettes d\'une couche au nombre d\'enroulements (les lettres épaissies) : deux lettres qui se chevauchent se fondent', () => {
  const lettres = [carre(0, 0, 6, 10), carre(4, 0, 10, 10)]
  const pair = etiqueter([{ couleur: [0, 0, 0], boucles: lettres }], 0, 0, 1, 10, 10)
  assert.equal(pair[5 * 10 + 5], -1, 'en pair-impair, un trou')
  const fondues = etiqueter([{ couleur: [0, 0, 0], boucles: lettres, nonzero: true }], 0, 0, 1, 10, 10)
  assert.equal(fondues[5 * 10 + 5], 0, 'au nombre d\'enroulements, plein')
  /* Le creux d'une lettre (tracé à l'envers) reste un creux. */
  const o = [carre(0, 0, 10, 10), Float32Array.from([3, 3, 3, 7, 7, 7, 7, 3])]
  const creux = etiqueter([{ couleur: [0, 0, 0], boucles: o, nonzero: true }], 0, 0, 1, 10, 10)
  assert.equal(creux[5 * 10 + 5], -1)
  assert.equal(creux[1 * 10 + 1], 0)
})

test('l\'image par les couches : le coin arrondi par l\'IA redevient un coin vif, de la couleur de sa couche', () => {
  /* Un carré bleu dans du noir ; dans le fichier, ses coins sont arrondis
     (noirs) — le vecteur, lui, le sait carré. */
  const n = 40
  const rgba = image(n, n, (x, y) => {
    const dedans = x >= 10 && x < 30 && y >= 10 && y < 30
    const coin = (x < 14 || x >= 26) && (y < 14 || y >= 26) && Math.hypot(x < 14 ? 14 - x : x - 25, y < 14 ? 14 - y : y - 25) > 4
    return dedans && !coin ? [20, 140, 220] : [10, 10, 10]
  })
  const couches = [
    { couleur: [10, 10, 10], boucles: [carre(0, 0, 40, 40)] },
    { couleur: [20, 140, 220], boucles: [carre(10, 10, 30, 30)] },
  ]
  const r = imageParCouches(rgba, n, n, { x: 0, y: 0 }, couches, 2, 1)
  assert.equal(r.largeur, 80)
  const px = (X, Y) => [...r.data.slice((Y * 80 + X) * 4, (Y * 80 + X) * 4 + 3)]
  const coin = px(21, 21)
  assert.ok(coin[2] > 180 && coin[0] < 60, 'le coin est bleu : ' + coin)
  const dehors = px(18, 18)
  assert.ok(dehors[2] < 40, 'juste dehors, du noir : ' + dehors)
})

test('l\'image par les couches : le halo clair autour d\'une pastille part, le dégradé qui passe d\'une couche à l\'autre reste sans couture', () => {
  const n = 40
  /* Un dégradé rouge → orange de gauche à droite, coupé en deux couches au
     milieu (deux familles pour le vecteur), sans bord dans le fichier. */
  const rgba = image(n, n, x => [200 + x, 40 + x * 2, 50])
  const couches = [
    { couleur: [210, 60, 50], boucles: [carre(0, 0, 20, 40)] },
    { couleur: [230, 110, 50], boucles: [carre(20, 0, 40, 40)] },
  ]
  const r = imageParCouches(rgba, n, n, { x: 0, y: 0 }, couches, 2, 1)
  for (let X = 30; X < 50; X++) {
    const a = r.data[(40 * 80 + X - 1) * 4 + 1], b = r.data[(40 * 80 + X) * 4 + 1]
    assert.ok(Math.abs(a - b) <= 4, 'marche en ' + X + ' : ' + a + ' → ' + b)
  }
  /* Une pastille magenta entourée d'un halo blanc (le JPEG) puis du vide :
     le halo, tout contre le bord de la couche, prend le magenta. */
  const p = image(n, n, (x, y) => {
    const d = Math.hypot(x - 20, y - 20)
    return d < 10 ? [214, 0, 111] : d < 12 ? [240, 200, 220] : [255, 255, 255]
  })
  for (let q = 0; q < n * n; q++) if (Math.hypot(q % n - 20, Math.floor(q / n) - 20) >= 12) p[q * 4 + 3] = 0
  const rond = []
  for (let k = 0; k < 64; k++) rond.push(20 + 11.5 * Math.cos(k / 64 * 2 * Math.PI), 20 + 11.5 * Math.sin(k / 64 * 2 * Math.PI))
  const r2 = imageParCouches(p, n, n, { x: 0, y: 0 }, [{ couleur: [214, 0, 111], boucles: [Float32Array.from(rond)] }], 2, 1, [[255, 255, 255]])
  const bord = [...r2.data.slice((40 * 80 + 40 + 21) * 4, (40 * 80 + 40 + 21) * 4 + 3)]
  assert.ok(bord[1] < 80, 'le bord de la pastille est magenta : ' + bord)
})

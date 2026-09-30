import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lireDictionnaire, cadreEncre, preparer, decoder, lireLignes, HAUT, MARGE } from './lecture.js'

/* Une ligne de 200 × 60, l'encre sur du blanc : des lettres de 40 de haut
   (y de 10 à 49), une puce au milieu de leur hauteur, un point à leur pied. */
const formes = [
  { x0: 10, x1: 29, y0: 10, y1: 49 },
  { x0: 40, x1: 59, y0: 10, y1: 49 },
  { x0: 84, x1: 93, y0: 25, y1: 34 },
  { x0: 118, x1: 137, y0: 10, y1: 49 },
  { x0: 150, x1: 157, y0: 42, y1: 49 },
]
function ligne() {
  const l = 200, h = 60, data = new Uint8Array(l * h).fill(255)
  for (const f of formes) for (let y = f.y0; y <= f.y1; y++) for (let x = f.x0; x <= f.x1; x++) data[y * l + x] = 0
  return { data, l, h }
}

/* UN MODÈLE POUR RIRE : il trouve les colonnes encrées de son entrée, et
   pose sur chaque tache le caractère suivant de `lu` — son pic un peu
   avant le centre, comme le vrai (lib/lecture.js, `DECALAGE`). Un espace
   entre les deux premières taches et les autres. */
const dict = lireDictionnaire('A\nB\n.\nl\n')
function modele(lu, probas) {
  const vus = []
  const calculer = async (e, W) => {
    vus.push({ W, n: e.length })
    const T = W / 8, C = dict.length, probs = new Float32Array(T * C)
    for (let t = 0; t < T; t++) probs[t * C] = 1
    const taches = []
    for (let x = 0, dans = false; x <= W; x++) {
      let encre = false
      for (let y = 0; y < HAUT && x < W; y++) if (e[y * W + x] < 0) { encre = true; break }
      if (encre && !dans) taches.push({ a: x })
      if (!encre && dans) taches[taches.length - 1].b = x - 1
      dans = encre
    }
    const pose = (t, k, p) => { probs[t * C] = 0; probs[t * C + k] = p; probs[t * C + (k === 1 ? 2 : 1)] = 1 - p }
    taches.forEach((s, i) => pose(Math.max(0, Math.round((s.a + s.b) / 2 / 8 - 0.75)), dict.indexOf(lu[i]), probas[i]))
    const t2 = Math.round((taches[1].b + taches[2].a) / 2 / 8)
    probs[t2 * C] = 0
    probs[t2 * C + C - 1] = 1
    return { probs, T, C }
  }
  return { calculer, vus }
}

test('la lecture : l\'entrée du modèle, recadrée sur l\'encre, 48 de haut, par huit colonnes', () => {
  const im = ligne()
  assert.deepEqual(cadreEncre(im), { x0: 10, x1: 157, y0: 10, y1: 49 })
  const p = preparer(im)
  assert.equal(p.W % 8, 0)
  assert.equal(p.entree.length, 3 * HAUT * p.W)
  /* La marge : 0,15 de la hauteur d'encre, de part et d'autre. */
  const m = Math.round(MARGE * 40)
  assert.equal(p.sx, 10 - m)
  assert.ok(Math.abs(p.echelle - (40 + 2 * m) / HAUT) < 0.01)
  /* Le haut de l'entrée, la marge : blanc (1) ; le milieu d'une lettre :
     noir (−1). Les trois plans sont égaux. */
  assert.equal(p.entree[0], 1)
  const y = 24, x = Math.round((20 - p.sx) / p.echelle)
  assert.equal(p.entree[y * p.W + x], -1)
  assert.equal(p.entree[HAUT * p.W + y * p.W + x], -1)
})

test('la lecture : le CTC, un caractère par suite de pas, les blancs retirés', () => {
  const d = lireDictionnaire('A\nB\n')
  assert.deepEqual(d, ['', 'A', 'B', ' '])
  const C = 4, suite = [1, 1, 0, 1, 2, 2, 3, 0, 2]
  const probs = new Float32Array(suite.length * C)
  suite.forEach((k, t) => { probs[t * C + k] = t === 1 ? 0.6 : 0.9 })
  const cars = decoder(probs, suite.length, C, d)
  assert.equal(cars.map(x => x.c).join(''), 'AAB B')
  assert.equal(cars[0].p, Math.fround(0.9), 'la plus haute de ses pas')
  assert.deepEqual([cars[2].t0, cars[2].t1], [4, 5])
})

test('la lecture d\'une ligne : le texte, sa confiance, son mot le moins sûr, le cadre de chaque caractère, la puce', async () => {
  const { calculer, vus } = modele(['A', 'B', '.', 'l', '.'], [0.99, 0.9, 0.6, 0.8, 0.95])
  const [r] = await lireLignes([ligne()], calculer, dict)
  assert.equal(vus.length, 1)
  /* La tache au milieu de la hauteur des lettres est une puce ; celle de
     leur pied, un point. */
  assert.equal(r.texte, 'AB •l.')
  /* La confiance : la moyenne des caractères (les espaces à part) ; le mot
     le moins sûr : « •l. », la moyenne des siens. */
  assert.ok(Math.abs(r.confiance - 100 * (0.99 + 0.9 + 0.6 + 0.8 + 0.95) / 5) < 1e-3)
  assert.ok(Math.abs(r.mot - 100 * (0.6 + 0.8 + 0.95) / 3) < 1e-3)
  /* Chaque cadre, resserré sur son encre : sa forme. */
  assert.deepEqual(r.symboles.map(s => s.c), ['A', 'B', '•', 'l', '.'])
  r.symboles.forEach((s, i) => {
    assert.ok(Math.abs(s.x0 - formes[i].x0) <= 1 && Math.abs(s.x1 - formes[i].x1) <= 1, JSON.stringify([s, formes[i]]))
  })
})

test('la lecture : une ligne sans encre, ou un modèle en panne, rend une lecture vide', async () => {
  const vide = { data: new Uint8Array(40 * 20).fill(255), l: 40, h: 20 }
  const { calculer } = modele(['A', 'B', '.', 'l', '.'], [1, 1, 1, 1, 1])
  const panne = async () => { throw new Error('carte perdue') }
  assert.deepEqual(await lireLignes([vide], calculer, dict), [{ texte: '', confiance: 0, mot: 0, symboles: [] }])
  assert.deepEqual((await lireLignes([ligne()], panne, dict))[0].texte, '')
  /* Un dictionnaire qui n'est pas celui du modèle, c'est une erreur. */
  await assert.rejects(lireLignes([ligne()], calculer, ['', 'A']), /dictionnaire/)
})

test('la lecture : un 1 qui n\'est qu\'un trait droit, dans une ligne de lettres, est un l', async () => {
  /* « l Office » : un trait nu, puis deux lettres ; le modèle lit « 1 ». */
  const l = 200, h = 60, data = new Uint8Array(l * h).fill(255)
  const peindre = (x0, x1, y0, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) data[y * l + x] = 0 }
  peindre(10, 15, 10, 49)
  peindre(40, 59, 10, 49)
  peindre(70, 89, 10, 49)
  const d = lireDictionnaire('1\nO\nf\n')
  const lire = async lu => {
    const calculer = async (e, W) => {
      const T = W / 8, C = d.length, probs = new Float32Array(T * C)
      for (let t = 0; t < T; t++) probs[t * C] = 1
      const taches = []
      for (let x = 0, dans = false; x <= W; x++) {
        let encre = false
        for (let y = 0; y < HAUT && x < W; y++) if (e[y * W + x] < 0) { encre = true; break }
        if (encre && !dans) taches.push({ a: x })
        if (!encre && dans) taches[taches.length - 1].b = x - 1
        dans = encre
      }
      taches.forEach((s, i) => { const t = Math.max(0, Math.round((s.a + s.b) / 2 / 8 - 0.75)); probs[t * C] = 0; probs[t * C + d.indexOf(lu[i])] = 1 })
      const t2 = Math.round((taches[0].b + taches[1].a) / 2 / 8)
      probs[t2 * C] = 0
      probs[t2 * C + C - 1] = 1
      return { probs, T, C }
    }
    return (await lireLignes([{ data, l, h }], calculer, d))[0]
  }
  const r = await lire(['1', 'O', 'f'])
  assert.equal(r.texte, 'l Of')
  assert.equal(r.symboles[0].c, 'l')
  /* Un vrai 1, avec son drapeau : il reste un chiffre. */
  peindre(2, 15, 10, 16)
  assert.equal((await lire(['1', 'O', 'f'])).texte, '1 Of')
})

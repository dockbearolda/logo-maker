import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fondsDuBord, retirerFond, imageCollee, voiles, aplatirVoiles } from './detourage.js'

/* Une image de `l` × `h`, peinte pixel par pixel par `peindre(x, y)`. */
function image(l, h, peindre) {
  const data = new Uint8ClampedArray(l * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) data.set([...peindre(x, y), 255].slice(0, 4), (y * l + x) * 4)
  return data
}
const alpha = (data, l, x, y) => data[(y * l + x) * 4 + 3]

const BLANC = [255, 255, 255]
const ROUGE = [200, 20, 30]

/* Un carré rouge de 10 à 29, percé d'un trou blanc de 17 à 22, sur blanc. */
const logo = () => image(40, 40, (x, y) => {
  const dansCarre = x >= 10 && x < 30 && y >= 10 && y < 30
  const dansTrou = x >= 17 && x < 23 && y >= 17 && y < 23
  return dansCarre && !dansTrou ? ROUGE : BLANC
})

test('le fond se lit sur le pourtour', () => {
  assert.deepEqual(fondsDuBord(logo(), 40, 40), [BLANC])
})

test('le blanc qui borde part, le dessin reste, le trou enfermé aussi', () => {
  const d = logo()
  const { retires } = retirerFond(d, 40, 40)
  assert.ok(retires > 1000)
  assert.equal(alpha(d, 40, 0, 0), 0)
  assert.equal(alpha(d, 40, 5, 20), 0)
  assert.equal(alpha(d, 40, 15, 15), 255)
  assert.equal(alpha(d, 40, 20, 20), 255)
})

test('« l\'intérieur » retire aussi le blanc enfermé', () => {
  const d = logo()
  retirerFond(d, 40, 40, { interieur: true })
  assert.equal(alpha(d, 40, 20, 20), 0)
  assert.equal(alpha(d, 40, 15, 15), 255)
})

test('un blanc cassé bruité (JPEG) part aussi', () => {
  const d = image(30, 30, (x, y) => (x > 10 && x < 20 && y > 10 && y < 20 ? [0, 0, 0] : [245 - ((x * 7 + y * 3) % 12), 244, 238]))
  retirerFond(d, 30, 30)
  assert.equal(alpha(d, 30, 2, 2), 0)
  assert.equal(alpha(d, 30, 15, 15), 255)
})

test('le faux damier de ChatGPT : ses deux couleurs partent', () => {
  const d = image(32, 32, (x, y) => (x > 12 && x < 20 && y > 12 && y < 20 ? ROUGE : ((x >> 2) + (y >> 2)) % 2 ? [204, 204, 204] : BLANC))
  assert.equal(fondsDuBord(d, 32, 32).length, 2)
  retirerFond(d, 32, 32)
  assert.equal(alpha(d, 32, 0, 0), 0)
  assert.equal(alpha(d, 32, 4, 0), 0)
  assert.equal(alpha(d, 32, 16, 16), 255)
})

test('le liseré rose d\'un bord rouge devient du rouge à moitié transparent', () => {
  const d = image(20, 20, (x, y) => (x < 10 || x > 17 || y < 2 || y > 17 ? BLANC : x === 10 ? [228, 138, 143] : ROUGE))
  retirerFond(d, 20, 20)
  const i = (5 * 20 + 10) * 4
  assert.ok(d[i + 3] > 90 && d[i + 3] < 170, 'alpha ' + d[i + 3])
  assert.ok(Math.abs(d[i] - ROUGE[0]) < 8 && Math.abs(d[i + 1] - ROUGE[1]) < 8)
})

test('un dessin coloré qui touche le bord n\'est pas pris pour le fond', () => {
  const d = image(20, 20, x => (x < 10 ? BLANC : ROUGE))
  assert.deepEqual(fondsDuBord(d, 20, 20), [BLANC])
  retirerFond(d, 20, 20)
  assert.equal(alpha(d, 20, 15, 5), 255)
})

test('un PNG déjà transparent ne bouge pas', () => {
  const d = image(10, 10, (x, y) => (x > 3 && x < 7 && y > 3 && y < 7 ? [...ROUGE, 255] : [0, 0, 0, 0]))
  const avant = d.slice()
  const { fonds, retires } = retirerFond(d, 10, 10)
  assert.deepEqual(fonds, [])
  assert.equal(retires, 0)
  assert.deepEqual(d, avant)
})

/* Une image collée sur une toile transparente plus grande (Canva) : un
   carré rouge sur son rectangle blanc cassé, de 8 à 51, sur une toile de
   60 × 60 transparente. */
const colleeSurToile = (fond = [253, 253, 253]) => image(60, 60, (x, y) => {
  if (x < 8 || x > 51 || y < 8 || y > 51) return [0, 0, 0, 0]
  return x >= 22 && x < 38 && y >= 22 && y < 38 ? ROUGE : fond
})

test('une image collée sur une toile transparente : son fond blanc part', () => {
  assert.deepEqual(fondsDuBord(colleeSurToile(), 60, 60), [[253, 253, 253]])
  const d = colleeSurToile()
  const { retires } = retirerFond(d, 60, 60)
  assert.ok(retires > 1500, 'retirés ' + retires)
  assert.equal(alpha(d, 60, 8, 8), 0)
  assert.equal(alpha(d, 60, 15, 30), 0)
  assert.equal(alpha(d, 60, 30, 30), 255)
  const b = bordDuFond(colleeSurToile(), 60, 60)
  assert.equal(b.part, 1)
  assert.equal(methodeConseillee(colleeSurToile(), 60, 60).methode, 'uni')
})

/* La même, agrandie ×4 par l'IA : l'image pleine d'un « Strong Together »
   (30 septembre 2026, « quand je zoome, le fond carré blanc réapparaît »).
   Ses bords s'adoucissent sur trois pixels, ses coins s'arrondissent un
   peu : 2 800 px de large, deux fois l'aperçu. `rayon` : l'arrondi de ses
   coins. */
const colleeAgrandie = (rayon = 6) => {
  const L = 2800, H = 700, x0 = 400, x1 = 2399, y0 = 100, y1 = 599
  const data = new Uint8ClampedArray(L * H * 4)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < L; x++) {
      const dx = Math.max(0, x0 + rayon - x, x - (x1 - rayon)), dy = Math.max(0, y0 + rayon - y, y - (y1 - rayon))
      const dedans = rayon - Math.hypot(dx, dy)
      const a = Math.round(255 * Math.min(1, Math.max(0, (dedans + 0.5) / 3)))
      const rouge = x >= 1300 && x < 1500 && y >= 250 && y < 450
      data.set(rouge ? [...ROUGE, a] : [253, 253, 253, a], (y * L + x) * 4)
    }
  }
  return data
}

test('une image collée agrandie par l\'IA : ses coins adoucis, son fond part quand même', () => {
  assert.deepEqual(imageCollee(colleeAgrandie(), 2800, 700), { x: 400, y: 100, largeur: 2000, hauteur: 500 })
  assert.deepEqual(fondsDuBord(colleeAgrandie(), 2800, 700), [[253, 253, 253]])
  /* Un vrai autocollant, ses coins arrondis à cette taille, garde sa marge. */
  assert.equal(imageCollee(colleeAgrandie(40), 2800, 700), null)
})

test('un autocollant déjà détouré garde sa marge blanche', () => {
  /* Coins arrondis : la marge blanche suit la forme, ce n'est pas une image
     collée. */
  const autocollant = () => image(60, 60, (x, y) => {
    const dx = Math.max(0, Math.abs(x - 29.5) - 12), dy = Math.max(0, Math.abs(y - 29.5) - 12)
    if (Math.hypot(dx, dy) > 10) return [0, 0, 0, 0]
    return x >= 22 && x < 38 && y >= 22 && y < 38 ? ROUGE : BLANC
  })
  assert.deepEqual(fondsDuBord(autocollant(), 60, 60), [])
  const d = autocollant()
  const avant = d.slice()
  retirerFond(d, 60, 60)
  assert.deepEqual(d, avant)
})

test('un badge sombre déjà détouré, à angles vifs, reste un dessin', () => {
  const badge = () => colleeSurToile([20, 20, 20])
  assert.deepEqual(fondsDuBord(badge(), 60, 60), [])
  const d = badge()
  const avant = d.slice()
  retirerFond(d, 60, 60)
  assert.deepEqual(d, avant)
})

/* ------------------------------------------------ LES RÉGLAGES FINS */

import { detourer, peindre, seuilPoussieres, REGLAGES } from './detourage.js'

test('le seuil : plus haut, un gris clair part avec le fond', () => {
  const peint = () => image(30, 30, (x, y) => (x > 10 && x < 20 && y > 10 && y < 20 ? [0, 0, 0] : x > 2 && x < 7 && y > 2 && y < 27 ? [215, 215, 215] : BLANC))
  const bas = detourer(peint(), 30, 30, { tolerance: 20 }).data
  const haut = detourer(peint(), 30, 30, { tolerance: 60 }).data
  assert.equal(alpha(bas, 30, 4, 15), 255)
  assert.equal(alpha(haut, 30, 4, 15), 0)
  assert.equal(alpha(haut, 30, 15, 15), 255)
})

test('la source n\'est jamais touchée : les réglages se rejouent', () => {
  const src = logo()
  const copie = src.slice()
  detourer(src, 40, 40, { interieur: true, resserrer: 2 })
  assert.deepEqual(src, copie)
})

test('resserrer : le bord du dessin recule d\'autant de pixels', () => {
  const r0 = detourer(logo(), 40, 40, { lisere: 0 }).data
  const r2 = detourer(logo(), 40, 40, { lisere: 0, resserrer: 2 }).data
  assert.equal(alpha(r0, 40, 10, 20), 255)
  assert.equal(alpha(r2, 40, 10, 20), 0)
  assert.equal(alpha(r2, 40, 11, 20), 0)
  assert.equal(alpha(r2, 40, 12, 20), 255)
})

test('les poussières : un point de bruit isolé part, le dessin reste', () => {
  /* Un point de 3 × 3 : plus qu'une miette, il reste d'office. */
  const peint = () => image(100, 100, (x, y) => (x > 30 && x < 70 && y > 30 && y < 70) || (x >= 4 && x < 7 && y >= 4 && y < 7) ? [0, 0, 0] : BLANC)
  assert.equal(alpha(detourer(peint(), 100, 100).data, 100, 5, 5), 255)
  const net = detourer(peint(), 100, 100, { poussieres: 40 }).data
  assert.equal(alpha(net, 100, 5, 5), 0)
  assert.equal(alpha(net, 100, 50, 50), 255)
  assert.equal(seuilPoussieres(0, 1e6), 0)
  assert.equal(seuilPoussieres(100, 1e6), 10000)
})

test('les fonds imposés passent devant ceux du bord (la pipette)', () => {
  /* Un fond vert que le bord ne dit pas : le carré rouge touche tout. */
  const peint = () => image(20, 20, (x, y) => (x > 5 && x < 15 && y > 5 && y < 15 ? [30, 160, 60] : ROUGE))
  const d = detourer(peint(), 20, 20, { fonds: [[30, 160, 60]], interieur: true }).data
  assert.equal(alpha(d, 20, 10, 10), 0)
  assert.equal(alpha(d, 20, 0, 0), 255)
  /* Aucune couleur : rien ne part. */
  assert.equal(alpha(detourer(peint(), 20, 20, { fonds: [] }).data, 20, 0, 0), 255)
})

test('le pinceau efface, et restaure le pixel d\'origine', () => {
  const src = logo()
  const d = detourer(src, 40, 40, {
    traits: [
      { mode: 'effacer', rayon: 2 / 40, points: [[20 / 40, 12 / 40]] },
      { mode: 'restaurer', rayon: 2 / 40, points: [[2 / 40, 2 / 40], [6 / 40, 2 / 40]] },
    ],
  }).data
  assert.equal(alpha(d, 40, 20, 12), 0)
  assert.equal(alpha(d, 40, 4, 2), 255)
  assert.equal(d[(2 * 40 + 4) * 4], 255)
  assert.equal(alpha(d, 40, 4, 10), 0)
})

test('peindre suit le trait d\'un point à l\'autre', () => {
  const d = image(50, 10, () => ROUGE)
  peindre(d, d.slice(), 50, 10, { mode: 'effacer', rayon: 1.5 / 50, points: [[5 / 50, 0.5], [45 / 50, 0.5]] })
  for (const x of [5, 15, 25, 35, 45]) assert.equal(alpha(d, 50, x, 5), 0, 'x ' + x)
  assert.equal(alpha(d, 50, 25, 0), 255)
})

test('les réglages d\'office', () => {
  assert.equal(REGLAGES.tolerance, 28)
})

/* « Le blanc des lettres ne fonctionne pas toujours bien » (25 septembre
   2026) : lettres blanc pur sur un badge, le tout sur un fond crème. */
test('un fond crème emmène le blanc pur des lettres', () => {
  const CREME = [234, 228, 219]
  const peint = () => image(40, 40, (x, y) => {
    const badge = x >= 8 && x < 32 && y >= 8 && y < 32
    const lettre = x >= 14 && x < 26 && y >= 16 && y < 24
    return lettre ? BLANC : badge ? [15, 81, 50] : CREME
  })
  assert.deepEqual(fondsDuBord(peint(), 40, 40), [CREME, BLANC])
  const d = detourer(peint(), 40, 40).data
  assert.equal(alpha(d, 40, 20, 20), 0)
  assert.equal(alpha(d, 40, 10, 10), 255)
  /* « Depuis les bords » garde les lettres. */
  assert.equal(alpha(detourer(peint(), 40, 40, { interieur: false }).data, 40, 20, 20), 255)
  /* Un fond déjà blanc ne se double pas. */
  assert.deepEqual(fondsDuBord(logo(), 40, 40), [BLANC])
})

test('les ombres portées partent avec le fond, le gris du dessin reste', () => {
  /* Un carré noir, son ombre grise à droite, un gris enfermé au milieu. */
  const peint = () => image(40, 40, (x, y) => {
    if (x >= 10 && x < 26 && y >= 10 && y < 26) return x >= 16 && x < 20 && y >= 16 && y < 20 ? [170, 170, 170] : [10, 10, 10]
    if (x >= 26 && x < 30 && y >= 12 && y < 28) return [185, 185, 187]
    return BLANC
  })
  assert.equal(alpha(detourer(peint(), 40, 40, { lisere: 0 }).data, 40, 27, 20), 255)
  const d = detourer(peint(), 40, 40, { lisere: 0, ombres: 60 }).data
  assert.equal(alpha(d, 40, 27, 20), 0)
  assert.equal(alpha(d, 40, 17, 17), 255)
  assert.equal(alpha(d, 40, 12, 12), 255)
})

/* ------------------------------------------- FOND UNI OU VRAI DÉCOR ? */

import { partUnie, bordDuFond, partEnAplats, methodeConseillee, palette, estIllustration } from './detourage.js'

/* Une « photo » : un sujet au milieu d'un décor qui change partout — des
   feuilles, une allée, un ciel. */
let graine = 3
const hasard = () => (graine = (graine * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
const decor = () => image(60, 60, (x, y) => (Math.hypot(x - 30, y - 30) < 14
  ? [200, 150, 110]
  : [Math.round(40 + 120 * hasard()), Math.round(90 + 110 * hasard()), Math.round(30 + 90 * hasard())]))

test('la part du pourtour que le fond couvre', () => {
  assert.equal(partUnie(logo(), 40, 40), 1)
  assert.ok(partUnie(decor(), 60, 60) < 0.5)
  /* Déjà transparent : rien à retirer, le pourtour est « uni ». */
  assert.equal(partUnie(image(10, 10, () => [0, 0, 0, 0]), 10, 10), 1)
  /* Un logo dont le carré rouge touche la moitié gauche du bord. */
  const colle = image(40, 40, (x, y) => (x < 20 && y > 5 && y < 35 ? ROUGE : BLANC))
  const p = partUnie(colle, 40, 40)
  assert.ok(p > 0.6 && p < 0.9, 'part ' + p)
})

test('le fond du pourtour : propre pour un logo, grainé pour une photo', () => {
  assert.deepEqual(bordDuFond(logo(), 40, 40), { fonds: [BLANC], part: 1, ecart: 0 })
  /* Un mur de photo : un blanc cassé qui bouge de quelques niveaux. */
  const mur = image(40, 40, () => [Math.round(228 + 10 * hasard()), 224, 218])
  const b = bordDuFond(mur, 40, 40)
  assert.equal(b.part, 1)
  assert.ok(b.ecart > 2, 'écart ' + b.ecart)
  /* Les aplats d'un logo, le grain d'une photo. */
  assert.equal(partEnAplats(logo(), 40, 40, [BLANC]) > 0.8, true)
  const grain = image(60, 60, () => [Math.round(40 + 120 * hasard()), Math.round(90 + 110 * hasard()), Math.round(30 + 90 * hasard())])
  assert.ok(partEnAplats(grain, 60, 60) < 0.05)
})

test('la méthode : un fond uni part à la couleur, un décor passe au modèle', () => {
  const l = methodeConseillee(logo(), 40, 40)
  assert.equal(l.methode, 'uni')
  assert.equal(l.logo, true)
  const photo = methodeConseillee(decor(), 60, 60)
  assert.equal(photo.methode, 'ia')
  assert.equal(photo.logo, false)
  /* Un logo collé au bord reste à la couleur. */
  const colle = image(40, 40, (x, y) => (x < 20 && y > 5 && y < 35 ? ROUGE : BLANC))
  assert.equal(methodeConseillee(colle, 40, 40).methode, 'uni')
  /* Une photo devant un mur uni, le sol en bas : au modèle. */
  const vrai = () => [Math.round(255 * hasard()), Math.round(255 * hasard()), Math.round(255 * hasard())]
  const mur = image(60, 60, (x, y) => (y > 40 || Math.hypot(x - 30, y - 30) < 12 ? vrai() : [236, 232, 225]))
  assert.ok(partUnie(mur, 60, 60) > 0.5 && partUnie(mur, 60, 60) < 0.9)
  assert.equal(methodeConseillee(mur, 60, 60).methode, 'ia')
  /* Une photo entre deux bandes noires : le noir est propre, mais le
     dessin a le grain d'une photo. */
  const bandes = image(60, 60, (x, y) => (y < 12 || y > 47 ? [0, 0, 0] : vrai()))
  assert.equal(methodeConseillee(bandes, 60, 60).methode, 'ia')
  /* Une illustration en dégradés sur le blanc d'un autocollant : à la
     couleur, « Depuis les bords ». */
  const autocollant = image(60, 60, (x, y) => (Math.hypot(x - 30, y - 30) < 22 ? [Math.round(x * 4), Math.round(80 + y * 2), Math.round(255 - x * 3)] : BLANC))
  const a = methodeConseillee(autocollant, 60, 60)
  assert.equal(a.methode, 'uni')
  assert.equal(a.logo, false)
  /* Le blanc cassé bruité d'un logo ChatGPT reste un fond uni. */
  const chatgpt = image(40, 40, (x, y) => (x > 10 && x < 30 && y > 10 && y < 30 ? ROUGE : [245 - ((x * 7 + y * 3) % 8), 244, 238]))
  assert.equal(methodeConseillee(chatgpt, 40, 40).methode, 'uni')
})

test('les teintes se trouvent, les plus présentes d\'abord', () => {
  const pal = palette(detourer(logo(), 40, 40, { interieur: false, lisere: 0 }).data, 2)
  assert.equal(pal.length, 2)
  assert.deepEqual(pal[0], ROUGE)
  assert.deepEqual(pal[1], BLANC)
})

test('un logo en aplats n\'est pas une illustration, une peinture si', () => {
  const JAUNE = [250, 200, 20]
  const aplats = image(120, 120, (x, y) => (Math.hypot(x - 60, y - 60) < 24 ? JAUNE : Math.hypot(x - 60, y - 60) < 50 ? ROUGE : [0, 0, 0, 0]))
  assert.equal(estIllustration(aplats), false)
  /* Un ciel en dégradé, une mer en dégradé. */
  const peinture = image(120, 120, (x, y) => [Math.round(x * 2), Math.round(80 + y), Math.round(255 - x - y / 2)])
  assert.equal(estIllustration(peinture), true)
})

test('les miettes du JPEG partent, le point d\'un i reste', () => {
  const MARINE = [20, 40, 110]
  const peint = () => image(60, 60, (x, y) => {
    if (x >= 10 && x < 40 && y >= 10 && y < 40) return ROUGE
    if (x >= 50 && x < 53 && y >= 20 && y < 23) return MARINE
    /* Le bruit de la compression, loin du dessin : presque blanc, ou d'une
       couleur criarde sur un pixel. */
    if (x === 5 && y === 50) return [215, 238, 240]
    if (x === 50 && y === 50) return [200, 120, 120]
    if (x >= 30 && x < 32 && y === 52) return [226, 214, 212]
    return BLANC
  })
  const d = detourer(peint(), 60, 60).data
  assert.equal(alpha(d, 60, 20, 20), 255)
  assert.equal(alpha(d, 60, 51, 21), 255, 'le point du i')
  assert.equal(alpha(d, 60, 5, 50), 0)
  assert.equal(alpha(d, 60, 50, 50), 0)
  assert.equal(alpha(d, 60, 30, 52), 0)
  assert.equal(alpha(d, 60, 31, 52), 0)
})

/* 27 septembre 2026, un phénix en dégradé : « ça creuse toujours les logos
   que ça ne devrait pas creuser à l'intérieur ». Le reflet qui pâlit
   jusqu'au blanc n'est pas un creux ; le creux d'une lettre, si. */
test('« l\'intérieur » : le creux part, le reflet d\'un dégradé reste', () => {
  const l = 120
  const d = image(l, l, (x, y) => {
    const r = Math.hypot(x - 40, y - 60)
    const dansTrou = x >= 92 && x < 102 && y >= 50 && y < 70
    if (r < 32) { const t = Math.max(0, 1 - r / 26); return [230, 90, 50].map(v => Math.round(v + (255 - v) * Math.min(1, t * 1.3))) }
    return x >= 84 && x < 110 && y >= 40 && y < 80 && !dansTrou ? [20, 20, 20] : BLANC
  })
  retirerFond(d, l, l, { interieur: true })
  assert.equal(alpha(d, l, 40, 60), 255, 'le cœur du reflet reste')
  assert.equal(alpha(d, l, 97, 60), 0, 'le creux du carré noir part')
  assert.equal(alpha(d, l, 2, 2), 0, 'le fond part')
})

/* 30 septembre 2026, le ruban rose à carreaux : sa boucle laisse voir le
   fond, avec une ombre grise douce de 8 px contre le ruban ; son liseré
   (rose) est plus clair que le tissu (framboise). */
const ruban = () => image(200, 200, (x, y) => {
  const r = Math.hypot(x - 100, y - 100)
  if (r < 22) return BLANC
  if (r < 30) { const v = Math.round(225 - (r - 22) / 8 * 30); return [v, v, v] }
  if (r < 33) return [230, 100, 160]
  if (r < 60) return [150, 20, 80]
  return BLANC
})

test('la boucle ombrée d\'un ruban part dans « Partout », avec son ombre', () => {
  const d = detourer(ruban(), 200, 200, { interieur: true }).data
  assert.equal(alpha(d, 200, 100, 100), 0, 'le fond vu à travers')
  assert.equal(alpha(d, 200, 100, 126), 0, 'son ombre')
  assert.equal(alpha(d, 200, 100, 145), 255, 'le ruban')
  const autour = detourer(ruban(), 200, 200, { interieur: false }).data
  assert.equal(alpha(autour, 200, 100, 100), 255, '« Autour » ne vide pas la boucle')
})

test('un reflet blanc net, sans ombre autour, reste', () => {
  /* Une bouteille bleue : son reflet blanc passe au bleu clair, puis au
     bleu franc — aucune ombre grise entre les deux. */
  const d = image(200, 200, (x, y) => {
    const r = Math.hypot(x - 100, y - 100)
    return r < 12 ? BLANC : r < 16 ? [120, 180, 235] : r < 60 ? [20, 60, 160] : BLANC
  })
  retirerFond(d, 200, 200, { interieur: true })
  assert.equal(alpha(d, 200, 100, 100), 255)
  assert.equal(alpha(d, 200, 2, 2), 0)
})

/* 27 septembre 2026, « Le temps des Cerises » : un petit logo JPEG que l'IA
   agrandit quatre fois. Ses lettres ont un bord en pente douce et un grain
   de quelques niveaux : mesurée à deux niveaux près, la part en aplats
   tombait sous la moitié, le logo passait pour une illustration et le creux
   de ses lettres restait blanc. */
test('un logo agrandi par l\'IA, bords doux et léger grain, reste un logo', () => {
  const n = 240, d = new Uint8ClampedArray(n * n * 4)
  let graine = 7
  const bruit = () => { graine = (graine * 1103515245 + 12345) % 2147483648; return (graine / 2147483648 - 0.5) * 7 }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    /* Un O gris anthracite : 30 px de trait, 5 px de pente de chaque côté. */
    const r = Math.hypot(x - 120, y - 120)
    const encre = Math.max(0, Math.min(1, (r - 50) / 5 + 0.5)) * Math.max(0, Math.min(1, (80 - r) / 5 + 0.5))
    const v = Math.max(0, Math.min(255, Math.round(255 - 225 * encre + (encre > 0.98 ? bruit() : 0))))
    d.set([v, v, v, 255], (y * n + x) * 4)
  }
  const c = methodeConseillee(d, n, n)
  assert.equal(c.methode, 'uni')
  assert.equal(c.logo, true)
})

/* LES LETTRES DU DEHORS : un sticker (le corps, percé d'une fenêtre
   blanche) et, posés à côté sur le fond, deux petits « O » verts (4 % de la
   hauteur) et une île (un anneau vert, sa marge blanche, son cœur vert). */
const VERT = [20, 110, 60]
const anneau = (x, y, cx, cy, r1, r2) => { const d = Math.hypot(x - cx, y - cy); return d >= r1 && d < r2 }
const sticker = () => image(320, 260, (x, y) => {
  const corps = x >= 10 && x < 210 && y >= 10 && y < 250
  const fenetre = x >= 60 && x < 160 && y >= 60 && y < 200
  if (corps) return fenetre ? BLANC : ROUGE
  if (anneau(x, y, 260, 40, 3, 6) || anneau(x, y, 260, 80, 3, 6)) return VERT
  if (anneau(x, y, 270, 180, 20, 26) || Math.hypot(x - 270, y - 180) < 12) return VERT
  return BLANC
})

test('« Autour » vide les lettres posées dehors, pas le blanc du logo', () => {
  const d = sticker()
  retirerFond(d, 320, 260)
  /* Le creux des O part, leur trait reste… */
  assert.equal(alpha(d, 320, 260, 40), 0)
  assert.equal(alpha(d, 320, 260, 80), 0)
  assert.equal(alpha(d, 320, 264, 40), 255)
  /* …la fenêtre blanche du sticker et la marge blanche de l'île aussi. */
  assert.equal(alpha(d, 320, 110, 130), 255)
  assert.equal(alpha(d, 320, 270, 164), 255)
  /* `lettres: false` : comme avant, seul le fond relié au bord part. */
  const avant = sticker()
  retirerFond(avant, 320, 260, { lettres: false })
  assert.equal(alpha(avant, 320, 260, 40), 255)
})

test('une forme du dehors qui enferme quelque chose garde son blanc', () => {
  /* Une île : un anneau vert, du blanc dedans, et un point vert au milieu
     qui ne touche rien — l'anneau blanc garde l'île. */
  const d = image(84, 60, (x, y) => {
    if (x >= 4 && x < 56 && y >= 4 && y < 56) return ROUGE
    if (anneau(x, y, 70, 30, 8, 11)) return VERT
    if (Math.hypot(x - 70, y - 30) < 3) return VERT
    return BLANC
  })
  retirerFond(d, 84, 60)
  assert.equal(alpha(d, 84, 70, 25), 255)
  assert.equal(alpha(d, 84, 70, 30), 255)
})

test('sans corps (des lettres seules), tous les creux partent', () => {
  const d = image(60, 30, (x, y) => ([[15, 15], [45, 15]].some(([cx, cy]) => anneau(x, y, cx, cy, 4, 9)) ? VERT : BLANC))
  retirerFond(d, 60, 30)
  assert.equal(alpha(d, 60, 15, 15), 0)
  assert.equal(alpha(d, 60, 45, 15), 0)
  assert.equal(alpha(d, 60, 21, 15), 255)
})

/* 30 septembre 2026, « la piscine » : « POOL » en rose pâle, le premier O
   gardait un disque blanc, le second non — d'un O à l'autre, un pixel
   d'épaisseur de trait. Trois O rose pâle, de 3, 4 et 5 px de trait : les
   trois creux partent, les traits restent. */
test('« Autour » vide les creux d\'une lettre pâle, quel que soit son trait', () => {
  const ROSE = [240, 150, 155]
  const d = image(90, 30, (x, y) => ([[15, 9], [45, 10], [75, 11]].some(([cx, r]) => anneau(x, y, cx, 15, 6, r)) ? ROSE : BLANC))
  retirerFond(d, 90, 30)
  for (const cx of [15, 45, 75]) {
    assert.equal(alpha(d, 90, cx, 15), 0, 'le creux du O à ' + cx)
    assert.equal(alpha(d, 90, cx + 3, 15), 0, 'le bord du creux du O à ' + cx)
    assert.equal(alpha(d, 90, cx + 7, 15), 255, 'le trait du O à ' + cx)
  }
})

test('« Autour » : le reflet blanc d\'une forme posée dehors reste', () => {
  /* Deux poêles grises posées côte à côte, sans corps : ce sont des
     lettres. Chacune a son reflet, un trait blanc qui fonce vers le gris
     en six pixels — pas un creux, même si son pâle est pris avec lui. */
  const d = image(150, 50, (x, y) => {
    const k = x < 75 ? 0 : 75
    if (x < k + 5 || x >= k + 70 || y < 5 || y >= 45) return BLANC
    const loin = Math.max(Math.max(k + 15 - x, x - (k + 59), 0), Math.max(23 - y, y - 26, 0))
    const v = 255 - Math.min(110, Math.round(18.4 * loin))
    return [v, v, v]
  })
  retirerFond(d, 150, 50)
  assert.equal(alpha(d, 150, 37, 25), 255)
  assert.equal(alpha(d, 150, 112, 25), 255)
  assert.equal(alpha(d, 150, 37, 21), 255)
  assert.equal(alpha(d, 150, 2, 2), 0)
})

test('un petit JPEG sur du noir, son grain de trois niveaux : à la couleur', () => {
  /* « AutoMax », 263 px sur du noir grainé : il partait au modèle. */
  let g = 5
  const grain = () => Math.round(((g = (g * 16807) % 2147483647) / 2147483647) * 7)
  const l = 120, h = 50, d = new Uint8ClampedArray(l * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) d.set(x > 20 && x < 100 && y > 15 && y < 35 ? [230, 230, 232, 255] : [grain(), grain(), grain(), 255], (y * l + x) * 4)
  assert.equal(methodeConseillee(d, l, h).methode, 'uni')
})

/* ============================================================ LA MATIÈRE
   29 septembre 2026, « BEA-16 BEIGE BRODERIE » : un logo qui représente de
   la broderie — « ça doit s'appliquer pour tout, si c'est du cuir ou autre,
   de l'eau, du feu, des paillettes ». Le dedans de ses formes n'est jamais
   à plat : des fils, un grain, un modelé. Celui d'un logo à plat, si — même
   avec le grain d'un JPEG. */
import { aDeLaMatiere } from './detourage.js'

/* Un disque de `rayon` pixels au milieu d'une image transparente de
   120 × 120, peint par `peindre(x, y)`. */
const disque = (peindre, rayon = 50) => {
  const d = new Uint8ClampedArray(120 * 120 * 4)
  for (let y = 0; y < 120; y++) for (let x = 0; x < 120; x++) if (Math.hypot(x - 60, y - 60) < rayon) d.set([...peindre(x, y), 255], (y * 120 + x) * 4)
  return d
}

test('une broderie a de la matière : des fils partout dans ses formes', () => {
  /* Des fils en biais, tous les quatre pixels, clairs et sombres. */
  const fils = disque((x, y) => ((x + y) % 4 < 2 ? [226, 196, 150] : [176, 140, 96]))
  assert.equal(aDeLaMatiere(fils, 120, 120, []), true)
})

test('un ballon, de l\'eau : un modelé doux, de la matière aussi', () => {
  /* Éclairé d'en haut à gauche, sombre de l'autre côté. */
  const ballon = disque((x, y) => { const v = Math.round(250 - 2.2 * Math.hypot(x - 35, y - 35)); return [v, Math.round(v * 0.4), Math.round(v * 0.5)] })
  assert.equal(aDeLaMatiere(ballon, 120, 120, []), true)
})

test('un logo à plat n\'a pas de matière, même avec le grain d\'un JPEG', () => {
  let g = 9
  const grain = () => Math.round(((g = (g * 16807) % 2147483647) / 2147483647) * 6) - 3
  const plat = disque(() => [200 + grain(), 20 + grain(), 30 + grain()])
  assert.equal(aDeLaMatiere(plat, 120, 120, []), false)
})

test('des filets trop fins pour se juger : à plat, dans le doute', () => {
  /* Un anneau de fils de quatre pixels : pas de dedans à lire. */
  const d = disque((x, y) => (Math.hypot(x - 60, y - 60) > 46 && (x + y) % 4 < 2 ? [226, 196, 150] : [176, 140, 96]))
  for (let y = 0; y < 120; y++) for (let x = 0; x < 120; x++) if (Math.hypot(x - 60, y - 60) < 46) d[(y * 120 + x) * 4 + 3] = 0
  assert.equal(aDeLaMatiere(d, 120, 120, []), false)
})

test('le fond d\'un logo ne compte pas dans sa matière', () => {
  /* Du papier grainé autour d'un disque à plat : le papier est le fond. */
  let g = 4
  const grain = () => Math.round(((g = (g * 16807) % 2147483647) / 2147483647) * 40)
  const d = image(120, 120, (x, y) => (Math.hypot(x - 60, y - 60) < 50 ? ROUGE : [190 + grain(), 190, 190]))
  assert.equal(aDeLaMatiere(d, 120, 120, [[220, 190, 190]]), false)
})

/* Une lettre teal opaque (bord anticrénelé d'un pixel), et son ombre
   décalée : le même teal à 40 % d'opacité (un PNG de Canva), sur du vide. */
const TEAL = [3, 152, 158]
const ombree = () => {
  const l = 60, h = 50
  const d = new Uint8ClampedArray(l * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) {
    const lettre = x >= 10 && x < 30 && y >= 10 && y < 30
    const bordLettre = !lettre && x >= 9 && x < 31 && y >= 9 && y < 31 && (x < 12 || y < 12)
    const ombre = x >= 16 && x < 40 && y >= 16 && y < 40
    const a = lettre ? 255 : ombre ? 96 : bordLettre ? 128 : 0
    if (a) d.set([...TEAL, a], (y * l + x) * 4)
  }
  return { d, l, h }
}

test('un voile (une ombre à 40 % de Canva) se lit sur le fichier ; le bord anticrénelé d\'une lettre n\'en est pas un', () => {
  const { d, l, h } = ombree()
  const v = voiles(d, l, h)
  assert.ok(v, 'un voile')
  assert.equal(v[25 * l + 33], 96, 'dans l\'ombre')
  assert.equal(v[20 * l + 20], 0, 'la lettre, opaque')
  assert.equal(v[9 * l + 20], 0, 'le bord anticrénelé de la lettre, loin de l\'ombre')
  /* Rien que des bords anticrénelés : aucun voile. */
  const net = image(40, 40, (x, y) => [...ROUGE, x >= 10 && x < 30 && y >= 10 && y < 30 ? 255 : (x === 9 || y === 9) && x >= 9 && x < 30 && y >= 9 && y < 30 ? 128 : 0])
  assert.equal(voiles(net, 40, 40), null)
  /* Tout opaque (un JPEG) : aucun voile. */
  assert.equal(voiles(logo(), 40, 40), null)
})

test('un voile aplati : la couleur qu\'il a sur la page blanche, pleine ; le reste ne bouge pas', () => {
  const { d, l, h } = ombree()
  const a = aplatirVoiles(d, voiles(d, l, h))
  const px = (x, y) => [...a.slice((y * l + x) * 4, (y * l + x) * 4 + 4)]
  /* 40 % de teal sur du blanc. */
  const t = 96 / 255
  assert.deepEqual(px(33, 25), TEAL.map(c => Math.round(c * t + 255 * (1 - t))).concat(255))
  assert.deepEqual(px(20, 20), [...TEAL, 255], 'la lettre')
  assert.deepEqual(px(50, 45), [0, 0, 0, 0], 'le vide')
  assert.deepEqual(px(9, 20), [...TEAL, 128], 'le bord de la lettre, loin de l\'ombre')
  assert.deepEqual([...d.slice((25 * l + 33) * 4, (25 * l + 33) * 4 + 4)], [...TEAL, 96], 'le fichier reçu reste intact')
})

/* LES ÉLÉMENTS (30 septembre 2026, lib/elements.js) : dans une illustration,
   le blanc peint d'un élément reste ; le jour d'une lettre part, sans
   exception ; le jour d'un anneau part. */
const BLEU = [30, 60, 160]
/* Un anneau carré (une lettre « O ») de `c` de côté, trait `t`, en (x0, y0). */
const anneauCarre = (x, y, x0, y0, c, t) => x >= x0 && x < x0 + c && y >= y0 && y < y0 + c && !(x >= x0 + t && x < x0 + c - t && y >= y0 + t && y < y0 + c - t)

test('une illustration : le blanc peint dans un corps épais reste, le jour des lettres part', () => {
  /* Un corps bleu de 60 × 60, un blanc de 10 × 6 dedans ; deux lettres « O »
     (anneaux de 20, trait 4) sur le fond, côte à côte, et un petit « o »
     dont le jour fait 2 × 2 pixels. */
  const dessin = (x, y) => {
    if (x >= 30 && x < 90 && y >= 30 && y < 90) return x >= 45 && x < 55 && y >= 50 && y < 56 ? BLANC : BLEU
    if (anneauCarre(x, y, 10, 100, 20, 4) || anneauCarre(x, y, 36, 100, 20, 4) || anneauCarre(x, y, 62, 108, 8, 3)) return [20, 20, 20]
    return BLANC
  }
  const d = image(130, 130, dessin)
  retirerFond(d, 130, 130, { interieur: true, elements: true })
  assert.equal(alpha(d, 130, 50, 53), 255, 'le blanc peint dans le corps reste')
  assert.equal(alpha(d, 130, 20, 110), 0, 'le jour du premier O part')
  assert.equal(alpha(d, 130, 46, 110), 0, 'le jour du second O part')
  assert.equal(alpha(d, 130, 65, 111), 0, 'le jour de deux pixels du petit o part aussi')
  assert.equal(alpha(d, 130, 12, 110), 255, 'le trait des lettres reste')
  assert.equal(alpha(d, 130, 5, 5), 0)
  /* Un logo à plat (`elements` faux) se creuse comme avant : le blanc du
     corps part. */
  const e = image(130, 130, dessin)
  retirerFond(e, 130, 130, { interieur: true, elements: false })
  assert.equal(alpha(e, 130, 50, 53), 0)
  assert.equal(alpha(e, 130, 20, 110), 0)
})

test('une illustration : le jour d\'un anneau seul (une bonne part de lui) part, un petit blanc dans un grand corps reste', () => {
  const d = image(100, 100, (x, y) => anneauCarre(x, y, 10, 10, 40, 6) ? [20, 20, 20] : x >= 55 && x < 95 && y >= 55 && y < 95 ? (x >= 70 && x < 76 && y >= 70 && y < 74 ? BLANC : BLEU) : BLANC)
  retirerFond(d, 100, 100, { interieur: true, elements: true })
  assert.equal(alpha(d, 100, 30, 30), 0, 'le jour de l\'anneau part')
  assert.equal(alpha(d, 100, 72, 72), 255, 'le reflet du corps reste')
})

test('« Autour » ne change pas : le blanc enfermé reste, celui des petites lettres posées dehors part', () => {
  const d = image(260, 260, (x, y) => x >= 30 && x < 90 && y >= 30 && y < 90 ? (x >= 45 && x < 55 && y >= 50 && y < 56 ? BLANC : BLEU) : anneauCarre(x, y, 10, 200, 12, 3) || anneauCarre(x, y, 28, 200, 12, 3) ? [20, 20, 20] : BLANC)
  retirerFond(d, 260, 260, { interieur: false })
  assert.equal(alpha(d, 260, 50, 53), 255)
  assert.equal(alpha(d, 260, 16, 206), 0)
})

/* UN IMPRIMÉ PHOTOGRAPHIÉ (30 septembre 2026, le t-shirt « SAINT MARTIN ») :
   un tissu crème, ses plis l'assombrissent en douceur jusqu'à 45 niveaux
   (bien au-delà du seuil), du grain ; au milieu, un dessin cerné de noir —
   un disque rouge, et un ruban crème un peu plus jaune que le tissu, enfermé
   dans son trait. `sansCerne` : le même disque sans trait (une photo). */
function imprime(l = 300, h = 300, { sansCerne = false } = {}) {
  let graine = 7
  const bruit = () => { graine = (graine * 16807) % 2147483647; return (graine / 2147483647 - 0.5) * 8 }
  return image(l, h, (x, y) => {
    const pli = 45 * Math.max(0, 1 - Math.abs(x - 40) / 40) + 25 * y / h
    const tissu = [247, 242, 228].map(v => Math.round(v - pli + bruit()))
    const r = Math.hypot(x - 150, y - 150)
    if (r < 70) return [200, 30, 40]
    if (!sansCerne && r < 76) return [20, 20, 30]
    if (!sansCerne && y >= 236 && y < 270 && x >= 80 && x < 220) return y < 240 || y >= 266 || x < 84 || x >= 216 ? [20, 20, 30] : [250, 238, 196].map(v => v - Math.round(25 * y / h))
    return tissu
  })
}

test('le fond ombré : un tissu et ses plis se lisent, s\'éclairent à plat, et partent en entier', async () => {
  const { fondOmbre, sansOmbre, detourer } = await import('./detourage.js')
  const d = imprime()
  const o = fondOmbre(d, 300, 300)
  assert.ok(o && o.part > 0.9, JSON.stringify(o && o.part))
  /* Éclairé à plat, le tissu ne s'écarte plus de sa couleur que sous le
     seuil — au creux même du pli, à peine. */
  const plat = sansOmbre(d, 300, 300, o)
  for (const [x, y] of [[40, 20], [5, 150], [280, 280], [40, 290]]) {
    const i = (y * 300 + x) * 4
    assert.ok(Math.max(...[0, 1, 2].map(c => Math.abs(plat[i + c] - o.ref[c]))) < 28, [x, y, plat[i], plat[i + 1], plat[i + 2]].join())
  }
  /* Sans éclairage, le pli reste ; avec, tout le tissu part — et le dessin
     reste, son ruban crème compris (peint, pas vu à travers). */
  const brut = detourer(d, 300, 300, { interieur: true })
  assert.equal(alpha(brut.data, 300, 40, 150), 255)
  const r = detourer(d, 300, 300, { interieur: true, ombre: true })
  for (const [x, y] of [[40, 150], [2, 2], [297, 297], [40, 297]]) assert.equal(alpha(r.data, 300, x, y), 0, x + ',' + y)
  assert.equal(alpha(r.data, 300, 150, 150), 255)
  assert.equal(alpha(r.data, 300, 150, 252), 255)
})

test('le graphiste : un imprimé cerné sur un tissu ombré part à la couleur ; une photo devant un mur, non', async () => {
  const { methodeConseillee } = await import('./detourage.js')
  const m = methodeConseillee(imprime(), 300, 300)
  assert.equal(m.methode, 'uni')
  assert.ok(m.ombre)
  const p = methodeConseillee(imprime(300, 300, { sansCerne: true }), 300, 300)
  assert.ok(!p.ombre)
})

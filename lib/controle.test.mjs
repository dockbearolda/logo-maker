/* LE CONTRÔLE PRESSE (lib/controle.js) : la fidélité du tracé mesurée
   contre l'image détourée, l'épaisseur de l'encre, le nuancier. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { distances, epaisseurs, controler, auNuancier, partSous, PROCHE } from './controle.js'

/* Une image RVBA de `l` × `h`, peinte par `peint(x, y)` : null, ou
   [r, v, b]. */
function image(l, h, peint) {
  const d = new Uint8ClampedArray(l * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) {
    const c = peint(x + 0.5, y + 0.5)
    if (c) d.set([c[0], c[1], c[2], 255], (y * l + x) * 4)
  }
  return d
}
/* Un rectangle et un rond, en boucles (pixels de l'image). */
const rect = (x0, y0, x1, y1) => Float32Array.from([x0, y0, x1, y0, x1, y1, x0, y1])
const rond = (cx, cy, r, n = 180) => {
  const b = new Float32Array(2 * n)
  for (let i = 0; i < n; i++) { const t = i / n * 2 * Math.PI; b[2 * i] = cx + r * Math.cos(t); b[2 * i + 1] = cy + r * Math.sin(t) }
  return b
}
const dansRond = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) < r
const dansRect = (x, y, x0, y0, x1, y1) => x > x0 && x < x1 && y > y0 && y < y1

test('la distance au fond : exacte, et le bord de l\'image est du fond', () => {
  const l = 9, h = 7, m = new Uint8Array(l * h)
  for (let y = 1; y <= 5; y++) for (let x = 2; x <= 6; x++) m[y * l + x] = 1
  const d = distances(m, l, h)
  assert.equal(d[3 * l + 4], 9, 'le centre du carré de 5 : à 3 du fond')
  assert.equal(d[1 * l + 2], 1, 'son coin : à 1')
  assert.equal(d[0], 0, 'le fond : 0')
  /* Un trait collé au bord de l'image : le bord compte pour du fond. */
  const t = new Uint8Array(l * h)
  for (let x = 0; x < l; x++) t[x] = 1
  assert.equal(distances(t, l, h)[4], 1)
})

test('l\'épaisseur de l\'encre : un trait de 3 pixels est fin, un pavé ne l\'est pas', () => {
  const l = 120, h = 80, m = new Uint8Array(l * h)
  /* Un pavé de 40 × 40, et un trait de 3 × 60. */
  for (let y = 10; y < 50; y++) for (let x = 10; x < 50; x++) m[y * l + x] = 1
  for (let y = 60; y < 63; y++) for (let x = 20; x < 80; x++) m[y * l + x] = 1
  const e = epaisseurs(m, l, h)
  assert.equal(e.encre, 1600 + 180)
  assert.ok(e.fin >= 2 && e.fin <= 3, 'le plus fin : ' + e.fin)
  /* Sous 4 pixels : le trait, et lui seul (à peu près). */
  const sous4 = partSous(e.parts, 4)
  assert.ok(Math.abs(sous4 - 180 / 1780) < 0.03, 'part sous 4 px : ' + sous4)
  assert.equal(e.parts[e.parts.length - 1], 1)
  /* Rien de fin : un pavé seul. */
  const p = new Uint8Array(l * h)
  for (let y = 10; y < 70; y++) for (let x = 10; x < 110; x++) p[y * l + x] = 1
  const g = epaisseurs(p, l, h)
  assert.equal(g.fin, 0, 'aucun trait fin')
  assert.ok(partSous(g.parts, 6) < 0.02, 'part sous 6 px : ' + partSous(g.parts, 6))
})

test('un tracé fidèle s\'accorde ; une île perdue, un jour bouché, une couleur fausse se voient', () => {
  const l = 200, h = 160
  const rouge = [200, 30, 60], bleu = [20, 60, 200]
  const img = image(l, h, (x, y) => dansRond(x, y, 70, 80, 50) ? rouge : dansRect(x, y, 140, 30, 170, 130) ? bleu : dansRond(x, y, 150, 145, 6) ? rouge : null)
  const cadre = { x: 10, y: 20, largeur: 180, hauteur: 140 }
  const fidele = [{ couleur: rouge, boucles: [rond(70, 80, 50), rond(150, 145, 6)] }, { couleur: bleu, boucles: [rect(140, 30, 170, 130)] }]
  const c = controler(img, l, h, cadre, fidele)
  assert.ok(c.accord > 0.995, 'accord ' + c.accord)
  assert.ok(c.ecart < 1, 'écart ' + c.ecart)
  assert.equal(c.manque.n, 0)
  assert.equal(c.ajout.n, 0)
  assert.ok(c.teinte < 0.01, 'teinte ' + c.teinte)
  assert.equal(c.L, 180)
  /* Le petit rond oublié : une île perdue, de son aire à peu près. */
  const sans = controler(img, l, h, cadre, [{ couleur: rouge, boucles: [rond(70, 80, 50)] }, fidele[1]])
  assert.equal(sans.manque.n, 1)
  assert.ok(sans.manque.pire > 60 && sans.manque.pire < 120, 'pire ' + sans.manque.pire)
  assert.ok(Math.abs(sans.manque.epaisseur - 12) <= 2 && Math.abs(sans.manque.longueur - 12) <= 2, 'épaisseur ' + sans.manque.epaisseur + ', longueur ' + sans.manque.longueur)
  assert.ok(sans.accord < c.accord)
  /* Un jour bouché : une forme tracée où le fichier n'a rien. */
  const bouche = controler(img, l, h, cadre, [{ couleur: rouge, boucles: [rond(70, 80, 50), rond(150, 145, 6), rect(20, 130, 60, 150)] }, fidele[1]])
  assert.equal(bouche.ajout.n, 1)
  assert.ok(bouche.ajout.pire > 600, 'pire ' + bouche.ajout.pire)
  assert.ok(Math.abs(bouche.ajout.epaisseur - 20) <= 2 && Math.abs(bouche.ajout.longueur - 40) <= 2, 'épaisseur ' + bouche.ajout.epaisseur + ', longueur ' + bouche.ajout.longueur)
  /* La bonne forme, la mauvaise couleur : le rectangle, un peu plus du
     quart de l'encre. */
  const faux = controler(img, l, h, cadre, [fidele[0], { couleur: rouge, boucles: [rect(140, 30, 170, 130)] }])
  assert.ok(faux.teinte > 0.2 && faux.teinte < 0.35, 'teinte ' + faux.teinte)
  /* Ce que les lettres ont effacé ne compte pas. */
  const efface = { masque: new Uint8Array(l * h), largeur: l, k: 1 }
  for (let y = 135; y < 156; y++) for (let x = 140; x < 161; x++) efface.masque[y * l + x] = 1
  const hors = controler(img, l, h, cadre, [{ couleur: rouge, boucles: [rond(70, 80, 50)] }, fidele[1]], { efface })
  assert.equal(hors.manque.n, 0)
})

test('le contrôle se réduit sur un grand cadre, et rend null sans couche', () => {
  const l = 300, h = 100
  const img = image(l, h, (x, y) => dansRect(x, y, 10, 10, 290, 90) ? [0, 0, 0] : null)
  const c = controler(img, l, h, { x: 0, y: 0, largeur: 300, hauteur: 100 }, [{ couleur: [0, 0, 0], boucles: [rect(10, 10, 290, 90)] }], { cote: 150 })
  assert.equal(c.L, 150)
  assert.equal(c.H, 50)
  assert.ok(c.accord > 0.99, 'accord ' + c.accord)
  assert.equal(controler(img, l, h, { x: 0, y: 0, largeur: 300, hauteur: 100 }, []), null)
})

test('le nuancier : la couleur la plus proche, et son écart', () => {
  const r = auNuancier([228, 3, 44])
  assert.equal(r.nom, 'Rouge')
  assert.ok(r.ecart < 0.01)
  const p = auNuancier([230, 10, 48])
  assert.equal(p.nom, 'Rouge')
  assert.ok(p.ecart > 0 && p.ecart < PROCHE, 'écart ' + p.ecart)
  const g = auNuancier([120, 120, 120])
  assert.ok(g.ecart > PROCHE, g.nom + ' ' + g.ecart)
  assert.deepEqual(auNuancier([255, 255, 255]).cmjn, [0, 0, 0, 0])
})

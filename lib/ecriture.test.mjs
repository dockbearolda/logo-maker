import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Font, Glyph, Path } from '../vendor/opentype.min.mjs'
import { distanceMots, voisins, relectures, encreLigne, poserTexte, pente, cheminTexte, choisirEcriture, ligneUnie } from './ecriture.js'
import { polygones, remplir } from './polices.js'

/* UNE ÉCRITURE FABRIQUÉE : des lettres en bâtons penchés de `s` (le haut
   décalé de s × la hauteur vers la droite), d'épaisseur `e`. Chaque lettre
   a son dessin : ses bâtons [x0, y0, x1, y1] (en unités, y vers le haut). */
const DESSINS = {
  S: [[80, 0, 380, 0], [380, 0, 380, 350], [80, 350, 380, 350], [80, 350, 80, 700], [80, 700, 380, 700]],
  t: [[200, 0, 200, 600], [80, 420, 330, 420]],
  M: [[60, 0, 60, 700], [60, 700, 250, 350], [250, 350, 440, 700], [440, 700, 440, 0]],
  a: [[80, 0, 330, 0], [330, 0, 330, 420], [80, 420, 330, 420], [80, 0, 80, 210], [80, 210, 330, 210]],
  r: [[80, 0, 80, 420], [80, 380, 300, 420]],
  i: [[160, 0, 160, 420], [160, 540, 160, 600]],
  n: [[70, 0, 70, 420], [70, 420, 320, 420], [320, 420, 320, 0]],
  o: [[80, 0, 330, 0], [330, 0, 330, 420], [330, 420, 80, 420], [80, 420, 80, 0]],
}
function ecriture({ s = 0.4, e = 50, nom = 'Essai' } = {}) {
  const baton = (p, [x0, y0, x1, y1]) => {
    /* Un bâton : un parallélogramme autour du segment, penché. */
    const X = (x, y) => x + s * y
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1
    const nx = -dy / l * e / 2, ny = dx / l * e / 2
    const pts = [[x0 + nx - dx / l * e / 2, y0 + ny - dy / l * e / 2], [x1 + nx + dx / l * e / 2, y1 + ny + dy / l * e / 2], [x1 - nx + dx / l * e / 2, y1 - ny + dy / l * e / 2], [x0 - nx - dx / l * e / 2, y0 - ny - dy / l * e / 2]]
    /* Dans le sens des polices (enroulement constant). */
    const aire = pts.reduce((t, a, i) => { const b = pts[(i + 1) % 4]; return t + a[0] * b[1] - b[0] * a[1] }, 0)
    const ordre = aire > 0 ? pts : pts.slice().reverse()
    p.moveTo(X(...ordre[0]), ordre[0][1])
    for (const q of ordre.slice(1)) p.lineTo(X(...q), q[1])
    p.close()
  }
  const glyphes = [new Glyph({ name: '.notdef', advanceWidth: 500, path: new Path() }), new Glyph({ name: 'space', unicode: 32, advanceWidth: 260, path: new Path() })]
  for (const [c, batons] of Object.entries(DESSINS)) {
    const p = new Path()
    for (const b of batons) baton(p, b)
    glyphes.push(new Glyph({ name: c, unicode: c.charCodeAt(0), advanceWidth: c === 'M' ? 560 : c === 'i' || c === 't' ? 320 : 430, path: p }))
  }
  const f = new Font({ familyName: nom, styleName: 'Regular', unitsPerEm: 1000, ascender: 800, descender: -200, glyphs: glyphes })
  glyphes.forEach((g, i) => { g.index = i })
  return f
}

/* LA LIGNE D'UN LOGO écrite dans une police, comme lib/texte.js la rend :
   ses formes d'un tenant (ici une seule), leurs pixels. */
function ligneDe(police, texte, taille = 90) {
  const polys = polygones(cheminTexte(police, texte, taille), 24)
  let X0 = Infinity, Y0 = Infinity, X1 = -Infinity, Y1 = -Infinity
  for (const p of polys) for (const [x, y] of p) { X0 = Math.min(X0, x); Y0 = Math.min(Y0, y); X1 = Math.max(X1, x); Y1 = Math.max(Y1, y) }
  const L = Math.ceil(X1 - X0) + 40, H = Math.ceil(Y1 - Y0) + 40
  const m = remplir(polys.map(p => p.map(([x, y]) => [x - X0 + 20, y - Y0 + 20])), 0, 0, L, H)
  const pixels = []
  let x0 = L, y0 = H, x1 = 0, y1 = 0
  for (let k = 0; k < m.length; k++) if (m[k]) { pixels.push(k); const x = k % L, y = (k - x) / L; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
  return { ligne: [{ x0, y0, x1, y1, pixels: Int32Array.from(pixels) }], largeur: L }
}

test('la distance entre deux mots : les confusions d\'une écriture liée comptent moitié', () => {
  assert.equal(distanceMots('mostin', 'martin'), 1)
  assert.equal(distanceMots('morton', 'mouton'), 0.5)
  assert.equal(distanceMots('mart', 'martin'), 2.5)
  assert.equal(distanceMots('étage', 'etage'), 0.25)
  assert.ok(distanceMots('abcdef', 'uvwxyz', 2) > 2, 'arrêtée au-delà de la limite')
})

test('les voisins d\'un mot mal lu, dans le lexique : les plus proches, la casse gardée', () => {
  const lexique = ['de', 'motion', 'moeten', 'martin', 'master', 'mettre']
  assert.equal(voisins('Mostin', lexique)[0].m, 'Martin')
  assert.equal(voisins('MOSTIN', lexique)[0].m, 'MARTIN')
  assert.deepEqual(voisins('de', lexique), [], 'trop court')
  /* « perises » : « cerises », jamais le mot grossier aussi proche. */
  assert.deepEqual(voisins('perises', ['penises', 'cerises']).map(v => v.m), ['cerises'])
})

test('les lectures d\'une écriture : le vote mot à mot, le lexique, le texte tapé', () => {
  const lexique = ['st', 'martin', 'personal', 'training', 'motion']
  const lu = relectures([{ texte: 'SE Martin', confiance: 67 }, { texte: 'St Morton', confiance: 40 }, { texte: 'St Motion', confiance: 44 }], lexique)
  assert.equal(lu[0].texte, 'St Martin')
  assert.equal(lu[0].connus, 1)
  const perso = relectures([{ texte: 'Personal Training', confiance: 55 }, { texte: 'Versonal Training', confiance: 91 }], lexique)
  assert.equal(perso[0].texte, 'Personal Training', 'un mot connu pèse plus que la confiance d\'un mot inconnu')
  assert.ok(perso.find(t => t.texte === 'Versonal Training').inconnus === 1)
  /* Tapé à la main : seul, tel quel. */
  assert.deepEqual(relectures([{ texte: 'Sint Maarten', impose: true }, { texte: 'St Martin', confiance: 90 }], lexique).map(t => t.texte), ['Sint Maarten'])
  /* Trop peu de lettres : rien. */
  assert.equal(relectures([{ texte: '|. Ve', confiance: 38 }], lexique).length, 0)
})

test('l\'inclinaison d\'une écriture', () => {
  const droite = ecriture({ s: 0 }), penchee = ecriture({ s: 0.4 })
  const mesure = police => { const { ligne, largeur } = ligneDe(police, 'Mt'); const o = encreLigne(ligne, largeur); return pente(o.masque, o.l, o.h) }
  assert.ok(Math.abs(mesure(droite)) <= 0.05)
  assert.ok(Math.abs(mesure(penchee) - 0.4) <= 0.1, String(mesure(penchee)))
})

test('la pose : la police du logo colle mieux qu\'une autre, et à sa place', () => {
  const logo = ecriture({ s: 0.4, e: 45 }), grasse = ecriture({ s: 0.4, e: 130 }), droite = ecriture({ s: 0, e: 45 })
  const { ligne, largeur } = ligneDe(logo, 'St Martin')
  const obs = encreLigne(ligne, largeur)
  const n = police => poserTexte(police, 'St Martin', obs).note
  assert.ok(n(logo) > n(grasse) + 0.1, n(logo) + ' / ' + n(grasse))
  assert.ok(n(logo) > n(droite) + 0.1, n(logo) + ' / ' + n(droite))
  assert.ok(poserTexte(logo, 'St Martin', obs).distance < 0.8)
})

test('le choix d\'une écriture : dans la réserve, la bonne police et le bon texte', async () => {
  const polices = { fine: ecriture({ s: 0.4, e: 45 }), grasse: ecriture({ s: 0.4, e: 130 }), droite: ecriture({ s: 0, e: 45 }) }
  /* Les familles, comme famillesDe les rend (l'index : cadres, avances,
     inclinaison, trait). */
  const famille = (id, p, s, e) => ({
    id, nom: id, cap: 700, pente: s, espace: 260,
    boite: c => { const g = p.charToGlyph(c); if (!g || !g.index) return null; const b = g.getBoundingBox(); return { x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2 } },
    avance: c => { const g = p.charToGlyph(c); return g && g.index ? g.advanceWidth : null },
    fichiers: [{ id, nom: id, style: 'normal', graisse: 400, e: e / 700, w: 1 }],
  })
  const familles = [famille('grasse', polices.grasse, 0.4, 130), famille('droite', polices.droite, 0, 45), famille('fine', polices.fine, 0.4, 45)]
  const { ligne, largeur } = ligneDe(polices.fine, 'St Martin')
  const r = await choisirEcriture(ligne, largeur, [{ texte: 'St Mortin', confiance: 60 }, { texte: 'St Martin', confiance: 45 }], familles, async f => polices[f.id], ['st', 'martin', 'mortier'])
  assert.equal(r.texte, 'St Martin')
  assert.equal(r.props[0].fichier.id, 'fine')
  /* Un bout de dessin lu de travers n'a pas d'écriture. */
  assert.equal(await choisirEcriture(ligne, largeur, [{ texte: 'rN RY', confiance: 41 }], familles, async f => polices[f.id], ['st', 'martin']), null)
  assert.equal(await choisirEcriture(ligne, largeur, [{ texte: 'St Martin', confiance: 24 }], familles, async f => polices[f.id], ['st', 'martin']), null)
})

test('une écriture est d\'une seule teinte, un dessin multicolore non', () => {
  /* Une image de 40 × 10 : à gauche un dégradé doré (du jaune pâle au
     doré foncé), à droite des facettes rose, orange et vertes. */
  const L = 40, H = 10, data = new Uint8ClampedArray(L * H * 4)
  const facettes = [[240, 150, 160], [245, 170, 110], [150, 190, 160]]
  for (let y = 0; y < H; y++) for (let x = 0; x < L; x++) {
    const i = (y * L + x) * 4, t = x / 19
    const c = x < 20 ? [240 - 60 * t, 220 - 70 * t, 140 - 90 * t] : facettes[(x + y) % 3]
    data.set([...c, 255], i)
  }
  const ligne = (x0, x1) => [{ pixels: Int32Array.from({ length: (x1 - x0) * H }, (_, k) => Math.floor(k / (x1 - x0)) * L + x0 + (k % (x1 - x0))) }]
  assert.ok(ligneUnie(ligne(0, 20), L, data, L, H), 'le dégradé doré')
  assert.ok(!ligneUnie(ligne(20, 40), L, data, L, H), 'les facettes')
})

test('prevoirTexte : une lettre accentuée hors de l\'index prend sa lettre de base', async () => {
  const { prevoirTexte } = await import('./ecriture.js')
  /* L'index mesure ces lettres ; la police n'a pas le « ê » ; í, ñ, ö, ß
     sont hors de l'index (undefined). */
  const connues = 'abcdeilmnoprsMNPS', indexees = connues + 'êC'
  const fam = {
    espace: 250, cap: 700,
    avance: c => connues.includes(c) ? 500 : indexees.includes(c) ? null : undefined,
    boite: c => connues.includes(c) ? { x1: 20, x2: 480, y1: 0, y2: c === c.toUpperCase() ? 700 : 500 } : null,
  }
  const accent = prevoirTexte(fam, 'María Niño')
  assert.ok(accent, 'une écriture n\'est plus écartée pour un í ou un ñ')
  assert.deepEqual(accent, prevoirTexte(fam, 'Maria Nino'))
  assert.ok(prevoirTexte(fam, 'Sröße'), 'ß : la largeur d\'un « n »')
  assert.equal(prevoirTexte(fam, 'Crêperie'), null, 'sans « ê » dans la police, pas cette écriture')
})

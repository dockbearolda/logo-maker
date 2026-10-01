/* LE FIL DE CALCUL DU STUDIO, hors navigateur : le détourage à la
   couleur et par le sujet, l'enregistrement en PNG et en PDF, et le vrai
   modèle de vendor/, qui doit se charger et trouver un sujet. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { traiter } from './detourage-travail.js'
import { COTE_MODELE } from './sujet.js'

function image(l, h, peindre) {
  const data = new Uint8ClampedArray(l * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) data.set([...peindre(x, y), 255].slice(0, 4), (y * l + x) * 4)
  return data
}
const alpha = (d, l, x, y) => d[(y * l + x) * 4 + 3]

/* Un disque rouge au milieu d'une herbe granuleuse. */
let graine = 11
const hasard = () => (graine = (graine * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
const photo = (l = 120) => image(l, l, (x, y) => (Math.hypot(x - l / 2, y - l / 2) < l * 0.3
  ? [210, 30, 40]
  : [Math.round(50 + 40 * hasard()), Math.round(130 + 40 * hasard()), Math.round(40 + 30 * hasard())]))
/* Ce que le modèle en dirait : le disque, en 1 024. */
const masque = (l = 120) => {
  const m = new Uint8Array(COTE_MODELE * COTE_MODELE)
  for (let y = 0; y < COTE_MODELE; y++) for (let x = 0; x < COTE_MODELE; x++) {
    m[y * COTE_MODELE + x] = Math.hypot(x - COTE_MODELE / 2, y - COTE_MODELE / 2) < COTE_MODELE * 0.3 ? 255 : 0
  }
  return m
}

test('le calcul à la couleur : le fond uni part', async () => {
  const memoire = {}
  const logo = image(40, 40, (x, y) => (x > 10 && x < 30 && y > 10 && y < 30 ? [200, 20, 30] : [255, 255, 255]))
  await traiter({ type: 'source', data: logo, largeur: 40, hauteur: 40 }, memoire)
  const { reponse } = await traiter({ type: 'calcul', methode: 'uni', reglages: { tolerance: 28, interieur: true } }, memoire)
  assert.equal(alpha(reponse.data, 40, 0, 0), 0)
  assert.equal(alpha(reponse.data, 40, 20, 20), 255)
  assert.deepEqual(reponse.fonds, [[255, 255, 255]])
})

test('le calcul par le sujet : l\'herbe part, les coefficients se gardent d\'un seuil à l\'autre', async () => {
  const memoire = {}
  await traiter({ type: 'source', data: photo(), largeur: 120, hauteur: 120 }, memoire)
  const m = { type: 'calcul', methode: 'ia', masque: masque(), cle: 1, reglages: { seuil: 20 } }
  const a = (await traiter(m, memoire)).reponse.data
  assert.equal(alpha(a, 120, 60, 60), 255)
  assert.equal(alpha(a, 120, 3, 3), 0)
  const coefficients = memoire.affine.coefficients
  await traiter(Object.assign({}, m, { reglages: { seuil: 60 } }), memoire)
  assert.equal(memoire.affine.coefficients, coefficients, 'pas de filtre guidé refait pour un seuil')
  await traiter(Object.assign({}, m, { cle: 2 }), memoire)
  assert.notEqual(memoire.affine.coefficients, coefficients, 'un autre masque, d\'autres coefficients')
  await assert.rejects(traiter({ type: 'calcul', methode: 'ia', reglages: {} }, memoire), /pas encore trouvé/)
})

/* 30 septembre 2026, « le calcul lisible » : chaque étape dit son début, sa
   fin et sa durée, ou son échec et son message (lib/studio-detourage.js,
   la préparation). */
test('les étapes de la préparation : le détourage, son début, sa fin, son échec', async () => {
  const memoire = {}
  const evs = []
  const suivre = p => { if (p.etat) evs.push(p) }
  await traiter({ type: 'source', data: photo(), largeur: 120, hauteur: 120 }, memoire, suivre)
  assert.equal(evs.length, 0, 'recevoir l\'image n\'est pas une étape')
  await traiter({ type: 'calcul', methode: 'ia', masque: masque(), cle: 1, reglages: { seuil: 20 } }, memoire, suivre)
  assert.deepEqual(evs.map(e => e.etape + ':' + e.etat), ['detourage:debut', 'detourage:fin'])
  assert.equal(evs[0].part, 0)
  assert.equal(evs[1].part, 1)
  assert.ok(Number.isInteger(evs[1].ms) && evs[1].ms >= 0, 'sa durée : ' + evs[1].ms)
  evs.length = 0
  await assert.rejects(traiter({ type: 'calcul', methode: 'ia', reglages: {} }, memoire, suivre), /pas encore trouvé/)
  assert.deepEqual(evs.map(e => e.etape + ':' + e.etat), ['detourage:debut', 'detourage:echec'])
  assert.match(evs[1].message, /pas encore trouvé/)
})

test('l\'enregistrement : un PDF vectoriel', async () => {
  const commun = { type: 'export', data: photo(), largeur: 120, hauteur: 120, methode: 'ia', masque: masque(), cle: 1, reglages: { seuil: 20 }, cadrage: { rogner: true, marge: 0 } }
  const pdf = (await traiter(Object.assign({ format: 'pdf' }, commun), {})).reponse
  assert.equal(Buffer.from(pdf.fichier.subarray(0, 8)).toString('latin1'), '%PDF-1.4')
  assert.ok(pdf.largeur > 60 && pdf.largeur < 90, 'rogné au disque : ' + pdf.largeur)
  assert.match(Buffer.from(pdf.fichier).toString('latin1'), / c\n| l\n/, 'des tracés, pas une image')
  /* Tout est parti : rien à enregistrer, on le dit. */
  const vide = image(10, 10, () => [255, 255, 255])
  await assert.rejects(traiter({ type: 'export', format: 'pdf', data: vide, largeur: 10, hauteur: 10, methode: 'uni', reglages: { tolerance: 28, interieur: true }, cadrage: { rogner: true } }, {}), /Tout est parti/)
})

test('le vrai modèle se charge de vendor/ et trouve le sujet', async () => {
  /* Le fil télécharge le modèle ; ici, le fichier se lit sur le disque. */
  const avant = globalThis.fetch
  globalThis.fetch = async url => new Response(await readFile(fileURLToPath(url)))
  try {
    const etapes = [], evs = []
    const { reponse } = await traiter({ type: 'ia', data: photo(160), largeur: 160, hauteur: 160, cote: 320 }, {}, p => p.etat ? evs.push(p) : etapes.push(p.etape))
    assert.equal(reponse.cote, 320)
    /* L'étape « Sujet » de la préparation, et le modèle qui l'a trouvé. */
    assert.deepEqual(evs.map(e => e.etape + ':' + e.etat), ['sujet:debut', 'sujet:fin'])
    assert.equal(evs[1].modele, 'isnet')
    assert.equal(reponse.masque.length, 320 * 320)
    assert.equal(reponse.moteur, 'wasm')
    assert.ok(etapes.includes('telechargement') && etapes.includes('calcul'))
    const m = (x, y) => reponse.masque[y * 320 + x]
    assert.ok(m(160, 160) > 200, 'le disque : ' + m(160, 160))
    assert.ok(m(10, 10) < 50 && m(310, 310) < 50, 'l\'herbe : ' + m(10, 10) + ', ' + m(310, 310))
  } finally {
    globalThis.fetch = avant
  }
})

test('la lecture : le vrai modèle lit les lignes d\'un logo, leurs lettres, leur puce et leurs accents', async () => {
  /* Deux lignes marine sur du blanc (lecture.test.pgm.gz : Helvetica, 900
     × 230, en niveaux de gris). */
  const pgm = gunzipSync(await readFile(new URL('./lecture.test.pgm.gz', import.meta.url)))
  const [, l, h] = pgm.toString('latin1', 0, 20).match(/^P5\s+(\d+)\s+(\d+)\s+255\s/).map(Number)
  const gris = pgm.subarray(pgm.length - l * h)
  const data = image(l, h, (x, y) => { const v = gris[y * l + x]; return [v, v, v] })
  const avant = globalThis.fetch
  globalThis.fetch = async url => new Response(await readFile(fileURLToPath(url)))
  try {
    const evs = []
    const { reponse } = await traiter({ type: 'texte', cle: 1, data, largeur: l, hauteur: h }, {}, p => { if (p.etat) evs.push(p.etape + ':' + p.etat) })
    assert.deepEqual(evs, ['texte:debut', 'texte:fin'])
    assert.equal(reponse.lignes.length, 2)
    assert.deepEqual(reponse.lus.map(x => x.texte.replace(/\s+/g, '')), ['POOL•BAR•RESTAURANT', 'RéserveNaturelledeSaint-Martin'])
    for (const x of reponse.lus) {
      assert.ok(x.confiance >= 85 && x.mot >= 85, x.texte + ' : ' + x.confiance + ' / ' + x.mot)
      /* Un cadre par caractère lu, de gauche à droite. */
      assert.equal(x.symboles.length, x.texte.replace(/\s+/g, '').length)
      assert.ok(x.symboles.every((s, i) => s.x0 <= s.x1 && (!i || s.x0 >= x.symboles[i - 1].x0)))
    }
  } finally {
    globalThis.fetch = avant
  }
})

test('le nettoyage IA : le vrai modèle rend un logo flou net, quatre fois plus grand', async () => {
  const avant = globalThis.fetch
  globalThis.fetch = async url => new Response(await readFile(fileURLToPath(url)))
  try {
    /* Un carré noir aux bords flous (une rampe de 6 px) sur du blanc, 48 px. */
    const flou = image(48, 48, (x, y) => {
      const d = Math.max(Math.abs(x - 23.5), Math.abs(y - 23.5)) - 12
      const v = Math.round(255 * Math.min(1, Math.max(0, (d + 3) / 6)))
      return [v, v, v]
    })
    const etapes = []
    /* L'Ultra demandée : sans carte graphique, le nettoyage la remplace,
       sans temps à proposer. */
    const { reponse } = await traiter({ type: 'nettoyer', data: flou, largeur: 48, hauteur: 48, ultra: true, budget: 40000 }, {}, p => etapes.push(p.etape))
    assert.equal(reponse.largeur, 192)
    assert.equal(reponse.hauteur, 192)
    assert.equal(reponse.moteur, 'wasm')
    assert.equal(reponse.ultra, 0)
    assert.equal(reponse.estimeUltra, 0)
    assert.ok(etapes.includes('telechargement') && etapes.includes('calcul'))
    const gris = (x, y) => reponse.data[(y * 192 + x) * 4]
    assert.ok(gris(96, 96) < 40, 'le carré reste noir : ' + gris(96, 96))
    assert.ok(gris(4, 4) > 215, 'le blanc reste blanc : ' + gris(4, 4))
    /* Le bord : la rampe de 6 px (24 px agrandie) se resserre. */
    let rampe = 0
    for (let x = 0; x < 96; x++) if (gris(x, 96) > 40 && gris(x, 96) < 215) rampe++
    assert.ok(rampe < 20, 'bord de ' + rampe + ' px')
  } finally {
    globalThis.fetch = avant
  }
})

/* 30 septembre 2026, « la feature de PicWish » : un logo flou de 3 px,
   rendu net avant l'IA (lib/nettete.js), en sort aux bords plus francs
   que par l'IA seule — et rien ne se déflouerait sur une image nette. */
test('rendre net : le vrai modèle, après la déconvolution, rend des bords plus francs', async () => {
  const avant = globalThis.fetch
  globalThis.fetch = async url => new Response(await readFile(fileURLToPath(url)))
  try {
    const { adoucir } = await import('./nettete.js')
    const l = 96, v = new Float32Array(l * l)
    for (let y = 0; y < l; y++) for (let x = 0; x < l; x++) v[y * l + x] = Math.max(Math.abs(x - 47.5), Math.abs(y - 47.5)) < 24 ? 20 : 235
    const b = adoucir(v, l, l, 3)
    const flou = image(l, l, (x, y) => { const g = Math.round(b[y * l + x]); return [g, g, g] })
    const etapes = []
    const seule = (await traiter({ type: 'nettoyer', data: flou, largeur: l, hauteur: l }, {})).reponse
    const evs = []
    const debut = performance.now()
    const nette = (await traiter({ type: 'nettoyer', data: flou, largeur: l, hauteur: l, flou: 3 }, {}, p => p.etat ? evs.push(p) : etapes.push(p.etape))).reponse
    const total = performance.now() - debut
    /* Deux étapes de la préparation : « Rendre net » dans l'IA, et l'IA
       sans son temps. */
    assert.deepEqual(evs.map(e => e.etape + ':' + e.etat), ['ia:debut', 'net:debut', 'net:fin', 'ia:fin'])
    const [, , net, ia] = evs
    assert.equal(net.nette, true)
    assert.equal(ia.ultra, 0)
    assert.ok(net.ms > 0 && ia.ms > 0 && net.ms + ia.ms <= total + 2, net.ms + ' + ' + ia.ms + ' ≤ ' + total)
    assert.equal(seule.nette, false)
    assert.equal(nette.nette, true)
    assert.ok(etapes.includes('nettete'))
    assert.equal(nette.largeur, 4 * l)
    /* La rampe du bord gauche, le long du milieu (×4). */
    const rampe = r => { let k = 0; for (let x = 0; x < 2 * l; x++) { const g = r.data[(2 * l * 4 * l + x) * 4]; if (g > 50 && g < 205) k++ } return k }
    assert.ok(rampe(nette) < 0.75 * rampe(seule), rampe(seule) + ' → ' + rampe(nette))
    const gris = (r, x, y) => r.data[(y * 4 * l + x) * 4]
    assert.ok(gris(nette, 2 * l, 2 * l) < 50 && gris(nette, 8, 8) > 205, 'le carré reste noir, le fond blanc')
  } finally {
    globalThis.fetch = avant
  }
})

test('le sujet de l\'IA : ce que le décor enferme revient (la pastille d\'un O)', async () => {
  const { recoudre } = await import('./detourage-travail.js')
  /* Un O noir sur du blanc, une pastille jaune dans son creux, entourée de blanc ; l'IA a tout effacé sauf l'anneau. */
  const l = 40
  const source = image(l, l, (x, y) => { const d = Math.hypot(x - 20, y - 20); return d < 5 ? [240, 200, 0] : d >= 10 && d < 15 ? [0, 0, 0] : [255, 255, 255] })
  const ia = () => { const d = source.slice(); for (let p = 0; p < l * l; p++) { const r = Math.hypot(p % l - 20, Math.floor(p / l) - 20); if (!(r >= 10 && r < 15)) d[p * 4 + 3] = 0 } return d }
  const garde = ia(); recoudre(garde, source, l, l, false)
  assert.equal(alpha(garde, l, 20, 20), 255, 'la pastille revient')
  assert.equal(alpha(garde, l, 27, 20), 255, 'le blanc du creux aussi (« Extérieur seulement »)')
  assert.equal(alpha(garde, l, 2, 2), 0, 'le décor reste effacé')
  const creux = ia(); recoudre(creux, source, l, l, true)
  assert.equal(alpha(creux, l, 20, 20), 255, 'la pastille revient')
  assert.equal(alpha(creux, l, 27, 20), 0, 'le blanc du creux part (« Intérieur du logo aussi »)')
})

/* Un masque de modèle, en 1 024 sur une image de `l` × `h` : 255 là où
   `garde(x, y)` le dit (en pixels de l'image). */
const masqueDe = (l, h, garde) => {
  const m = new Uint8Array(COTE_MODELE * COTE_MODELE)
  for (let v = 0; v < COTE_MODELE; v++) for (let u = 0; u < COTE_MODELE; u++) m[v * COTE_MODELE + u] = garde((u + 0.5) * l / COTE_MODELE, (v + 0.5) * h / COTE_MODELE) ? 255 : 0
  return m
}

test('les creux de BiRefNet restent vides, ceux d\'ISNet reviennent', async () => {
  /* Un anneau noir sur du blanc ; le modèle n'a gardé que l'anneau. */
  const l = 120
  const r = (x, y) => Math.hypot(x - 60, y - 60)
  const source = image(l, l, (x, y) => (r(x, y) >= 25 && r(x, y) < 40 ? [0, 0, 0] : [255, 255, 255]))
  const masque = masqueDe(l, l, (x, y) => r(x, y) >= 25 && r(x, y) < 40)
  const calcul = async modele => {
    const memoire = {}
    await traiter({ type: 'source', data: source, largeur: l, hauteur: l }, memoire)
    return (await traiter({ type: 'calcul', methode: 'ia', masque, modele, cle: 1, reglages: { seuil: 20, interieur: false } }, memoire)).reponse.data
  }
  assert.equal(alpha(await calcul('isnet'), l, 60, 60), 255, 'ISNet : le creux revient')
  const b = await calcul('birefnet')
  assert.equal(alpha(b, l, 60, 60), 0, 'BiRefNet : le creux reste vide')
  assert.equal(alpha(b, l, 60, 28), 255, 'l\'anneau')
})

/* 30 septembre 2026, « Strong Together » : une carte blanche collée sur
   une toile transparente, le sujet au milieu. */
const carte = () => image(200, 160, (x, y) => {
  if (x < 30 || x >= 150 || y < 20 || y >= 120) return [0, 0, 0, 0]
  return Math.hypot(x - 70, y - 70) < 25 ? [210, 30, 40] : [252, 252, 250]
})

test('une image collée : le fond clair de sa carte part, même gardé par le modèle', async () => {
  const memoire = {}
  await traiter({ type: 'source', data: carte(), largeur: 200, hauteur: 160 }, memoire)
  /* Le modèle a pris toute la carte pour le sujet. */
  const masque = masqueDe(200, 160, (x, y) => x >= 30 && x < 150 && y >= 20 && y < 120)
  const d = (await traiter({ type: 'calcul', methode: 'ia', masque, modele: 'birefnet', cle: 1, reglages: { seuil: 20, tolerance: 28, interieur: false } }, memoire)).reponse.data
  assert.equal(alpha(d, 200, 70, 70), 255, 'le sujet')
  assert.equal(alpha(d, 200, 130, 100), 0, 'le blanc de la carte')
})

test('une image collée : le vrai modèle ne cherche le sujet que sur elle', async () => {
  const avant = globalThis.fetch
  globalThis.fetch = async url => new Response(await readFile(fileURLToPath(url)))
  try {
    const { reponse } = await traiter({ type: 'ia', data: carte(), largeur: 200, hauteur: 160, cote: 320 }, {})
    assert.equal(reponse.masque.length, 320 * 320)
    const m = (x, y) => reponse.masque[Math.floor(y / 160 * 320) * 320 + Math.floor(x / 200 * 320)]
    assert.ok(m(70, 70) > 200, 'le disque, à sa place sur la toile : ' + m(70, 70))
    assert.equal(m(180, 140), 0, 'la toile autour de la carte')
    assert.ok(m(140, 110) < 50, 'le blanc de la carte : ' + m(140, 110))
    /* Choisi par le graphiste, c'est BiRefNet ou rien : ici, rien (pas de
       carte graphique), et pas d'ISNet non plus. */
    const rien = (await traiter({ type: 'ia', data: carte(), largeur: 200, hauteur: 160, cote: 320, exiger: true }, {})).reponse
    assert.equal(rien.masque, null)
  } finally {
    globalThis.fetch = avant
  }
})

/* 27 septembre 2026 : un anneau doré qui brille jusqu'au blanc et un texte
   blanc, passés en une de nos couleurs — l'anneau sortait en morceaux, le
   texte disparaissait. Un dégradé n'a pas de jour : tout ce qui s'imprime
   prend la couleur. */
test('en une couleur, un doré qui brille et son texte blanc restent entiers', async () => {
  const { traiter } = await import('./detourage-travail.js')
  const l = 200
  const data = image(l, l, (x, y) => {
    const r = Math.hypot(x - 100, y - 115), t = (1 + Math.cos(4 * Math.atan2(y - 115, x - 100))) / 2
    if (r >= 60 && r < 70) return [184, 144, 63].map(v => Math.round(v + (255 - v) * t))
    return x >= 60 && x < 140 && y >= 10 && y < 26 ? [255, 255, 255] : [32, 36, 44]
  })
  const m = { type: 'vecteur', methode: 'uni', reglages: { tolerance: 28, interieur: true }, echelle: 1, data, detoure: false, lissage: 70, memo: 'essai', apercu: false, fonds: [], source: data, largeur: l, hauteur: l }
  const evs = []
  const { reponse } = await traiter(m, {}, p => { if (p.etat) evs.push(p) })
  assert.ok(reponse.degrade)
  /* Le tracé final : une étape de la préparation. */
  assert.deepEqual(evs.map(e => e.etape + ':' + e.etat), ['trace:debut', 'trace:fin'])
  const d = /\sd="([^"]*)"/.exec(reponse.unie)[1]
  assert.equal((d.match(/M/g) || []).length, 3, 'l\'anneau (dehors, dedans) et le texte')
  const ys = d.match(/-?\d+\.?\d*/g).filter((_, i) => i % 2).map(Number)
  assert.ok(Math.min(...ys) < 14, 'le texte blanc est dans la forme')
  /* L'aperçu du curseur n'est pas une étape. */
  evs.length = 0
  await traiter(Object.assign({}, m, { apercu: true, memo: 'apercu' }), {}, p => { if (p.etat) evs.push(p) })
  assert.equal(evs.length, 0, 'l\'aperçu du curseur n\'est pas une étape')
})

test('le texte corrigé garde les espaces de la lecture', async () => {
  const { recoudreTexte } = await import('./detourage-travail.js')
  assert.equal(recoudreTexte('pteds de la', 'piedsdela'), 'pieds de la')
  /* La puce lue « » » reprend sa place de puce, les espaces gardés ; un
     nombre de lettres qui ne tombe pas juste : les lettres corrigées seules. */
  assert.equal(recoudreTexte('POOL » BAR', 'POOL•BAR'), 'POOL • BAR')
  assert.equal(recoudreTexte('POOL »« BAR', 'POOL•BAR'), 'POOL•BAR')
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Font, Glyph, Path } from '../vendor/opentype.min.mjs'
import { polygones, remplir, reunir, lignes, ajuster, noter, choisirPolices, corriger, glyphesDe, famillesDe, caractere, ponctuation, epaisseur, graissePolice, CARACTERES, boites, harmoniser } from './polices.js'

/* UNE PETITE POLICE FABRIQUÉE : des lettres en bâtons, d'épaisseur `e`
   (en unités), 700 de capitale. `larges` : des lettres plus larges (une
   autre police). */
function police({ e = 100, larges = 1, nom = 'Essai' } = {}) {
  const rect = (p, x0, y0, x1, y1) => { p.moveTo(x0, y0); p.lineTo(x1, y0); p.lineTo(x1, y1); p.lineTo(x0, y1); p.close() }
  const dessins = {
    I: p => rect(p, 50, 0, 50 + e, 700),
    L: p => { rect(p, 50, 0, 50 + e, 700); rect(p, 50, 0, 50 + 400 * larges, e) },
    T: p => { rect(p, 50 + (400 * larges - e) / 2, 0, 50 + (400 * larges + e) / 2, 700); rect(p, 50, 700 - e, 50 + 400 * larges, 700) },
    E: p => { rect(p, 50, 0, 50 + e, 700); rect(p, 50, 0, 50 + 380 * larges, e); rect(p, 50, 350 - e / 2, 50 + 300 * larges, 350 + e / 2); rect(p, 50, 700 - e, 50 + 380 * larges, 700) },
    H: p => { rect(p, 50, 0, 50 + e, 700); rect(p, 50 + 420 * larges - e, 0, 50 + 420 * larges, 700); rect(p, 50, 350 - e / 2, 50 + 420 * larges, 350 + e / 2) },
    F: p => { rect(p, 50, 0, 50 + e, 700); rect(p, 50, 350 - e / 2, 50 + 300 * larges, 350 + e / 2); rect(p, 50, 700 - e, 50 + 380 * larges, 700) },
  }
  const glyphes = [new Glyph({ name: '.notdef', advanceWidth: 500, path: new Path() })]
  for (const [c, d] of Object.entries(dessins)) {
    const p = new Path()
    d(p)
    glyphes.push(new Glyph({ name: c, unicode: c.charCodeAt(0), advanceWidth: 100 + 420 * larges + e, path: p }))
  }
  const f = new Font({ familyName: nom, styleName: 'Regular', unitsPerEm: 1000, ascender: 800, descender: -200, glyphs: glyphes })
  /* Une police lue d'un fichier numérote ses glyphes ; celle-ci, non. */
  glyphes.forEach((g, i) => { g.index = i })
  return f
}

/* LES LETTRES OBSERVÉES d'un texte écrit dans une police, à `taille`
   pixels de capitale, sur une grille : comme le Logo maker les voit. */
function observer(texte, p, { taille = 60, x = 20, base = 90, ecart = 12 } = {}) {
  const s = taille / 700
  const glyphes = []
  for (const c of texte) {
    const gl = p.charToGlyph(c)
    const b = gl.getBoundingBox()
    const polys = polygones(gl.getPath(x - b.x1 * s, base, s * 1000).commands)
    const x0 = Math.floor(x) - 4, y0 = Math.floor(base - taille) - 4, l = Math.ceil((b.x2 - b.x1) * s) + 8, h = taille + 8
    const m = remplir(polys, x0, y0, l, h)
    let gx0 = Infinity, gy0 = Infinity, gx1 = -1, gy1 = -1, sx = 0, n = 0
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < l; xx++) if (m[yy * l + xx]) { gx0 = Math.min(gx0, x0 + xx); gx1 = Math.max(gx1, x0 + xx); gy0 = Math.min(gy0, y0 + yy); gy1 = Math.max(gy1, y0 + yy); sx += x0 + xx + 0.5; n++ }
    glyphes.push({ c, x0: gx0, y0: gy0, x1: gx1, y1: gy1, mx0: x0, my0: y0, ml: l, mh: h, masque: m, cx: sx / n })
    x += (b.x2 - b.x1) * s + ecart
  }
  return glyphes
}

test('un polygone se remplit au centre des pixels, un trou reste un trou', () => {
  const carre = [[[2, 2], [8, 2], [8, 8], [2, 8]]]
  const m = remplir(carre, 0, 0, 10, 10)
  assert.equal(m.reduce((s, v) => s + v, 0), 36)
  const anneau = [[[0, 0], [10, 0], [10, 10], [0, 10]], [[3, 3], [3, 7], [7, 7], [7, 3]]]
  const a = remplir(anneau, 0, 0, 10, 10)
  assert.equal(a[5 * 10 + 5], 0, 'le trou')
  assert.equal(a[1 * 10 + 1], 1)
  /* Une courbe se coupe en segments. */
  const q = polygones([{ type: 'M', x: 0, y: 0 }, { type: 'Q', x1: 10, y1: 10, x: 20, y: 0 }, { type: 'Z' }])
  assert.ok(q[0].length >= 3)
})

test('l\'épaisseur du trait : deux fois l\'aire sur le pourtour', () => {
  const l = 40, h = 40, m = new Uint8Array(l * h)
  for (let y = 5; y < 35; y++) for (let x = 10; x < 16; x++) m[y * l + x] = 1
  assert.ok(Math.abs(epaisseur(m, l, h) - 2 * 180 / 72) < 0.01)
  /* Une police plus grasse a un trait plus épais. */
  assert.ok(graissePolice(police({ e: 160 })).e > graissePolice(police({ e: 80 })).e)
})

test('l\'accent rejoint sa lettre ; un petit texte au-dessus d\'une grande lettre, non', () => {
  const E = { x0: 10, y0: 30, x1: 40, y1: 90 }, accent = { x0: 20, y0: 18, x1: 32, y1: 26 }
  const r = reunir([E, accent])
  assert.equal(r.length, 1)
  assert.equal(r[0].y0, 18)
  /* « BAR », 40 px, posé 60 px au-dessus d'une lettre de script de 200 px. */
  const script = { x0: 0, y0: 300, x1: 150, y1: 500 }, B = { x0: 40, y0: 200, x1: 70, y1: 240 }
  assert.equal(reunir([script, B]).length, 2)
})

test('les lignes : un texte espacé, la puce, le point du i, et pas la main d\'à côté', () => {
  const h = 40
  const lettre = (x, y0 = 100, hh = h, l = 24) => ({ x0: x, y0, x1: x + l - 1, y1: y0 + hh - 1, formes: [{}] })
  /* « L A  P I S » espacé d'une hauteur, une puce, puis « B A R ». */
  const texte = [lettre(0), lettre(64), lettre(170), lettre(234), lettre(298)]
  const puce = { x0: 360, y0: 116, x1: 367, y1: 123, formes: [{}] }
  const suite = [lettre(410), lettre(474), lettre(538)]
  /* Une main du personnage, loin à gauche, sur la même ligne de base. */
  const main = lettre(-200, 108, 32, 30)
  const ls = lignes([...texte, puce, ...suite, main])
  const principale = ls.find(l => l.length >= 8)
  assert.ok(principale, JSON.stringify(ls.map(l => l.length)))
  assert.ok(principale.includes(puce) && puce.ponctuation, 'la puce est dans la ligne')
  assert.ok(!principale.includes(main), 'la main n\'en est pas')
  /* Le point d'un i : posé au-dessus de sa lettre, il la rejoint. */
  const stem = lettre(600, 112, 28, 8)
  const point = { x0: 600, y0: 100, x1: 607, y1: 106, formes: [{}] }
  const avecI = lignes([lettre(560, 112, 28), stem, point, lettre(620, 112, 28)])
  assert.equal(avecI.length, 1)
  assert.equal(avecI[0].length, 3, 'le point fait partie du i')
  assert.equal(stem.y0, 100)
})

test('les lignes : la puce de la rangée du dessus, le filet décoratif, l\'apostrophe', () => {
  const lettre = (x, y0, hh, l = 24) => ({ x0: x, y0, x1: x + l - 1, y1: y0 + hh - 1, formes: [{}] })
  /* « BAR • RESTAURANT » en petit, et juste dessous le grand M d'une
     écriture (« St Martin ») : la puce reste une puce de sa rangée. */
  const rangee = [lettre(0, 100, 30), lettre(40, 100, 30), lettre(80, 100, 30), lettre(190, 100, 30), lettre(230, 100, 30), lettre(270, 100, 30)]
  const puce = { x0: 145, y0: 110, x1: 154, y1: 119, formes: [{}] }
  const grand = [lettre(60, 125, 150, 60), lettre(130, 128, 150, 70), lettre(210, 125, 150, 60)]
  lignes([...rangee, puce, ...grand])
  assert.ok(grand.every(g => g.y0 >= 125), 'aucune grande lettre n\'a pris la puce')
  /* Un filet rouge au-dessus de « Car Rental » : pas un accent. */
  const mots = [lettre(0, 100, 40), lettre(30, 110, 30), lettre(60, 110, 30), lettre(120, 100, 40), lettre(150, 110, 30)]
  const filet = { x0: 0, y0: 88, x1: 170, y1: 90, formes: [{}] }
  lignes([...mots, filet])
  assert.ok(mots.every(m => m.y0 >= 100), 'le filet n\'est l\'accent de personne')
  /* L'apostrophe de « l'Orthopédie », plus large que le « l » fin : elle
     le rejoint. */
  const l = lettre(0, 100, 40, 4), apostrophe = { x0: 2, y0: 92, x1: 9, y1: 99, formes: [{}] }
  lignes([l, apostrophe, lettre(20, 100, 40), lettre(60, 100, 40), lettre(100, 100, 40)])
  assert.equal(l.y0, 92)
})

test('la ligne de base et l\'échelle se retrouvent ; la bonne police l\'emporte', () => {
  const vraie = police({ e: 100 }), autre = police({ e: 100, larges: 1.5, nom: 'Large' })
  const obs = observer('HILTE', vraie)
  const a = ajuster(obs, vraie)
  assert.ok(Math.abs(a.echelle - 60 / 700) < 0.003, a.echelle)
  assert.ok(Math.abs(a.base - 90) < 1.5, a.base)
  const bonne = noter(obs, vraie), mauvaise = noter(obs, autre)
  assert.ok(bonne.note > 0.95, bonne.note)
  assert.ok(bonne.note > mauvaise.note + 0.1, bonne.note + ' / ' + mauvaise.note)
})

test('le choix dans la réserve : la police, sa graisse, et les équivalents', async () => {
  const fichiers = { 'essai-400': police({ e: 90 }), 'essai-700': police({ e: 150 }), 'large-400': police({ e: 90, larges: 1.5 }) }
  const index = { v: 1, caracteres: CARACTERES, familles: [] }
  for (const [id, larg] of [['essai', 1], ['large', 1.5]]) {
    const p = fichiers[id + '-400']
    const b = boites(p)
    const plat = []
    for (const c of CARACTERES) {
      const gl = p.charToGlyph(c)
      const bb = gl && gl.index ? gl.getBoundingBox() : null
      if (bb && b[c]) plat.push(bb.x1, bb.y1, bb.x2, bb.y2); else plat.push(null, null, null, null)
    }
    const graisses = id === 'essai' ? [[400, graissePolice(fichiers['essai-400']).e, 1], [700, graissePolice(fichiers['essai-700']).e, 1.1]] : [[400, graissePolice(fichiers['large-400']).e, 1]]
    index.familles.push({ id, nom: id === 'essai' ? 'Essai' : 'Large', cat: 'sans-serif', styles: { normal: { upm: 1000, cap: 700, boites: plat, fichiers: graisses } } })
    void larg
  }
  const charger = async f => fichiers[f.id + '-' + f.graisse] || null
  const obs = observer('HILTEF', fichiers['essai-700'])
  const props = await choisirPolices(obs, famillesDe(index), charger, { n: 2, tri: 5 })
  assert.equal(props[0].fichier.id, 'essai')
  assert.equal(props[0].fichier.graisse, 700, 'la graisse du logo')
  assert.ok(props[0].note > 0.9)
  assert.equal(props.length, 2, 'un équivalent est proposé')
  assert.ok(props[0].poses.length === obs.length)
})

test('une lettre mal lue se corrige par la police : un L lu pour un E', () => {
  const p = police({ e: 100 })
  const obs = observer('HEIT', p)
  obs[1].c = 'L'
  const r = corriger(obs, p)
  assert.equal(r.corrections, 1)
  assert.equal(r.glyphes[1].c, 'E')
  /* Une lecture juste ne bouge pas. */
  assert.equal(corriger(observer('HEIT', p), p).corrections, 0)
})

test('la ligne dément une correction : deux lettres pareilles lues pareil restent', () => {
  /* « CARAÏBES » devenu « CRRRÏBES » (30 septembre 2026) : dans la police
     trouvée, une autre lettre collait mieux aux deux A du logo. Deux
     lettres de la même forme, lues de la même lettre : l'OCR ne s'y
     trompe pas. Seule, la même lettre se corrige. */
  const p = police({ e: 100 })
  const lire = (formes, lu) => { const o = observer(formes, p); [...lu].forEach((c, i) => { o[i].c = c }); return corriger(o, p) }
  assert.equal(lire('HTTE', 'HIIE').corrections, 0)
  assert.equal(lire('HTE', 'HIE').glyphes[1].c, 'T')
  /* Une lettre qui a la forme exacte d'une autre de la ligne, lue
     autrement, prend sa lettre (« pteds » : son « t » est le « i » de
     « Orthopédie »). */
  assert.equal(lire('HEIET', 'HEILT').glyphes[3].c, 'E')
})

test('le texte lu épouse les lettres : sans ses espaces, la puce mal lue mise à part', () => {
  const ligne = [0, 1, 2, 3].map(i => ({ x0: i * 30, y0: 0, x1: i * 30 + 20, y1: 30, pixels: Int32Array.of(i * 30 + 5) }))
  assert.equal(glyphesDe(ligne, 'LA P I', 200).map(g => g.c).join(''), 'LAPI')
  assert.equal(glyphesDe(ligne, 'LAP', 200), null, 'une lettre de trop : rien')
  /* Une puce lue « * » de trop : sans la ponctuation, les lettres se comptent. */
  const avecPuce = ligne.slice(0, 2).concat([{ x0: 70, y0: 12, x1: 76, y1: 18, ponctuation: true, pixels: Int32Array.of(15 * 200 + 72) }], ligne.slice(2))
  const g = glyphesDe(avecPuce, 'LA *« PI', 200)
  assert.deepEqual(g.map(x => x.c), ['L', 'A', '•', 'P', 'I'])
  assert.ok(g[2].ponctuation)
  /* Ce que l'OCR lit de travers d'office. */
  assert.equal(caractere('|'), 'l')
  assert.equal(caractere("'"), '’')
  assert.ok(ponctuation('»') && !ponctuation('é') && !ponctuation('’'))
})

test('le mot le moins sûr d\'une lecture', async () => {
  const { motMoinsSur } = await import('./lecture.js')
  const data = { blocks: [{ paragraphs: [{ lines: [{ words: [{ text: 'luxury', confidence: 93 }, { text: '»', confidence: 20 }, { text: '1x', confidence: 61 }] }] }] }] }
  assert.equal(motMoinsSur(data), 61)
})

test('une famille par bloc : deux lignes l\'une sous l\'autre prennent la même, une ligne à part garde la sienne', async () => {
  const essai = police({ e: 100 }), large = police({ e: 100, larges: 1.3, nom: 'Large' })
  const fi = id => ({ id, nom: id, graisse: 400, style: 'normal' })
  const ligne = (texte, base, notes) => ({
    cadre: [20, base - 60, 400, base], polarite: 0, glyphes: observer(texte, essai, { base }),
    props: notes.map(([id, note]) => ({ fichier: fi(id), police: id === 'essai' ? essai : large, note, pire: note })),
  })
  const a = ligne('HILTE', 90, [['essai', 0.96], ['large', 0.93]])
  const b = ligne('TEHIL', 170, [['large', 0.95], ['essai', 0.94]])
  const loin = ligne('LITHE', 900, [['large', 0.97], ['essai', 0.9]])
  const familles = [{ id: 'essai', fichiers: [fi('essai')] }, { id: 'large', fichiers: [fi('large')] }]
  await harmoniser([a, b, loin], familles, async f => f.id === 'essai' ? essai : large)
  assert.equal(a.props[0].fichier.id, 'essai')
  assert.equal(b.props[0].fichier.id, 'essai', 'la famille du bloc')
  assert.ok(b.props[0].pire > 0.9, 'sa ressemblance, lettre à lettre, en pleine taille')
  assert.equal(b.props.length, 2)
  assert.equal(loin.props[0].fichier.id, 'large', 'hors du bloc : la sienne')
  /* Trop loin de sa meilleure (plus de cinq centièmes) : chacune la sienne. */
  const c = ligne('HILTE', 90, [['essai', 0.96], ['large', 0.85]])
  const d = ligne('TEHIL', 170, [['large', 0.95], ['essai', 0.86]])
  await harmoniser([c, d], familles, async f => f.id === 'essai' ? essai : large)
  assert.equal(c.props[0].fichier.id, 'essai')
  assert.equal(d.props[0].fichier.id, 'large')
})

/* LE BANC DE BOUT EN BOUT (27 novembre 2026, « transformer un logo de merde
   en un logo parfaitement exploitable ») : chaque étape avait son banc
   (les bords, les polices, les lignes, les mêmes octets) ; celui-ci juge la
   SORTIE contre la VÉRITÉ. Un logo propre (outils/corpus-bout.py : sa
   `verite.png` et trois fichiers abîmés — `petit`, `flou`, `whatsapp`)
   passe abîmé par la chaîne du vecteur (la décision du graphiste, le
   détourage, le tracé lisse), et le tracé, rendu à la taille de la vérité,
   s'y compare :
   - `forme`  : l'encre tracée contre l'encre vraie (intersection / union) ;
   - `bord`   : les bords tracés à 2 pixels près des vrais, et l'inverse
                (F1 : ni bord inventé, ni bord perdu) — teinte contre teinte,
                pas seulement l'encre contre le vide ;
   - `ΔE`     : l'écart que voit l'œil (CIEDE2000) entre la couleur tracée
                et la vraie, au cœur des aplats ;
   - `teintes`: les couleurs tracées en trop (+) ou perdues (−) ;
   - `îles`   : les morceaux d'un seul tenant en trop ou perdus ;
   - `nœuds`  : le poids du tracé (à fidélité égale, moins c'est mieux).
   Sans l'IA (le fichier abîmé se trace tel quel) : les nombres jugent la
   part en JavaScript, la comparaison avant/après tient.
     npm run banc:bout -- <corpus> [--ia] [--avant=<ref>] [--images=<dossier>] [--detail]
   Avec `--avant`, le `lib/` de la référence git contre celui de l'arbre de
   travail, logo par logo ; sans, l'arbre de travail seul. */
import { spawn, execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { cpus, tmpdir, homedir } from 'node:os'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join, resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lirePng } from './png-lire.mjs'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const ABIMES = ['petit', 'flou', 'whatsapp']
/* Le bord se juge à 2 pixels de la vérité (1 024 px de grand côté). */
const TOL_BORD = 2
/* Une île compte à partir de 0,02 % de l'image. */
const ILE_MIN = 0.0002
/* onnxruntime-node et la sortie brute de l'IA (voir `chaineIa`). */
const CACHE_IA = join(homedir(), '.cache', 'logo-maker-banc')

/* ------------------------------------------------ LE FILS : une chaîne */
if (process.argv[2] === '--mesurer') {
  const [, , , racine, images, modeIa, ...cas] = process.argv
  const L = n => import(join(racine, 'lib', n))
  const { decider } = await L('graphiste.js')
  const { detourer, TOLERANCE } = await L('detourage.js')
  const { vectoriserLisse } = await L('vecteur-lisse.js')
  const { paletteAuto } = await L('vectoriser.js')
  const { etiqueter } = await L('image-nette.js')
  const { distances } = await L('controle.js')
  const { ecart } = await L('lab.js')
  const { pngHd } = await L('png.js')
  const ia = modeIa === 'ia' ? await chaineIa(L) : null

  for (const dossier of cas) {
    const v = lirePng(join(dossier, 'verite.png'))
    const TL = v.largeur, TH = v.hauteur, N = TL * TH
    /* Une vérité synthétique dit son encre (son alpha : le vide partout où
       le fond paraît, creux compris) ; un vrai logo se détoure, propre. */
    let exacte = false
    for (let p = 3; p < v.data.length; p += 4) if (v.data[p] < 255) { exacte = true; break }
    const ref = exacte ? { data: v.data, fonds: [] } : detourer(v.data, TL, TH, { tolerance: TOLERANCE, interieur: true }, 1)
    /* Les encres vraies : dites par le corpus synthétique, lues sur un vrai logo. */
    const dites = join(dossier, 'couleurs.json')
    const pal = existsSync(dites) ? JSON.parse(readFileSync(dites, 'utf8')) : paletteAuto(ref.data, ref.fonds || [])
    /* La vérité en teintes : -1 le vide, sinon la teinte de la palette la plus proche. */
    const vrai = new Int16Array(N).fill(-1)
    for (let p = 0; p < N; p++) {
      if (ref.data[p * 4 + 3] < 128) continue
      let m = 0, dm = Infinity
      for (let k = 0; k < pal.length; k++) {
        const c = pal[k], d = (ref.data[p * 4] - c[0]) ** 2 + (ref.data[p * 4 + 1] - c[1]) ** 2 + (ref.data[p * 4 + 2] - c[2]) ** 2
        if (d < dm) { dm = d; m = k }
      }
      vrai[p] = m
    }
    /* L'ambigu (corpus-bout.py) : un grand intérieur couleur du fond, que l'app
       peut garder exprès (la marge d'un autocollant) — hors du jugement, élargi
       de la tolérance du bord. */
    const hors = new Uint8Array(N)
    if (existsSync(join(dossier, 'ambigu.png'))) {
      const a = lirePng(join(dossier, 'ambigu.png'))
      for (let p = 0; p < N; p++) if (a.data[p * 4] > 127) hors[p] = 1
      for (let k = 0; k < TOL_BORD + 1; k++) {
        const avant = hors.slice()
        for (let p = 0; p < N; p++) if (!avant[p] && ((p % TL > 0 && avant[p - 1]) || (p % TL < TL - 1 && avant[p + 1]) || (p >= TL && avant[p - TL]) || (p < N - TL && avant[p + TL]))) hors[p] = 1
      }
      for (let p = 0; p < N; p++) if (hors[p]) vrai[p] = -2
    }
    const bordsVrais = bords(vrai, TL, TH, hors)
    const ilesVraies = iles(vrai, TL, TH)
    for (const abime of ABIMES) {
      const r = { cas: basename(dossier), abime }
      try {
        const img = lirePng(join(dossier, abime + '.png'))
        const t0 = performance.now()
        const d = decider({ data: img.data, largeur: img.largeur, hauteur: img.hauteur, echelle: 1 }, { largeur: img.largeur, hauteur: img.hauteur })
        const aPlat = d.genre === 'logo' && !d.matiere
        /* Avec l'IA : l'image que trace l'app après « Logo maker » (l'Ultra). */
        const hd = ia ? await ia(img, d, aPlat) : img
        const det = detourer(hd.data, hd.largeur, hd.hauteur, { tolerance: TOLERANCE, interieur: true }, 1)
        const m = vectoriserLisse(det.data, hd.largeur, hd.hauteur, { fonds: det.fonds || [], source: hd.data, alpha: true, lissage: 70, trouer: false, geometrie: true, miettes: true, origine: Math.max(img.largeur, img.hauteur), nuances: true, mono: false, memo: {}, aPlat })
        r.ms = Math.round(performance.now() - t0)
        const couches = m.couches || []
        const trace = etiqueter(couches, 0, 0, TL / hd.largeur, TL, TH)
        for (let p = 0; p < N; p++) if (hors[p]) trace[p] = -2
        /* La forme. */
        let inter = 0, union = 0
        for (let p = 0; p < N; p++) {
          if (hors[p]) continue
          const a = vrai[p] >= 0, b = trace[p] >= 0
          if (a && b) inter++
          if (a || b) union++
        }
        r.forme = union ? inter / union : 1
        /* Le bord : chaque tracé de teinte dans la tolérance de la vérité, et l'inverse. */
        const bordsTraces = bords(trace, TL, TH, hors)
        r.bord = f1(bordsVrais, bordsTraces, TL, TH, distances)
        /* La couleur, au cœur des aplats (deux pixels de la même teinte tout autour). */
        let somme = 0, nb = 0
        for (let y = 2; y < TH - 2; y += 3) for (let x = 2; x < TL - 2; x += 3) {
          const p = y * TL + x, z = trace[p], k = vrai[p]
          if (z < 0 || k < 0) continue
          if (trace[p - 2] !== z || trace[p + 2] !== z || trace[p - 2 * TL] !== z || trace[p + 2 * TL] !== z) continue
          if (vrai[p - 2] !== k || vrai[p + 2] !== k || vrai[p - 2 * TL] !== k || vrai[p + 2 * TL] !== k) continue
          somme += ecart(couches[z].couleur, pal[k]); nb++
        }
        r.dE = nb ? somme / nb : 0
        /* Les teintes : distinctes à ΔE 3 près, celles qui se voient hors de l'ambigu. */
        const compte = new Uint32Array(couches.length)
        for (let p = 0; p < N; p++) if (trace[p] >= 0) compte[trace[p]]++
        for (let z = 0; z < couches.length; z++) if (compte[z] < ILE_MIN * N) compte[z] = 0
        const vues = []
        for (const c of couches.filter((_, z) => compte[z])) if (!vues.some(u => ecart(u, c.couleur) < 3)) vues.push(c.couleur)
        r.teintes = vues.length - pal.length
        r.iles = iles(trace, TL, TH) - ilesVraies
        r.noeuds = m.noeuds || 0
        if (images !== '-') {
          const s = new Uint8ClampedArray(N * 4)
          for (let p = 0; p < N; p++) {
            const z = trace[p]
            const c = z >= 0 ? couches[z].couleur : z === -2 ? [235, 235, 235] : [255, 255, 255]
            s[p * 4] = c[0]; s[p * 4 + 1] = c[1]; s[p * 4 + 2] = c[2]; s[p * 4 + 3] = 255
          }
          writeFileSync(join(images, `${r.cas}-${abime}.png`), await pngHd(s, TL, TH))
        }
      } catch (e) {
        r.erreur = String(e && e.stack || e).slice(0, 300)
      }
      process.stdout.write(JSON.stringify(r) + '\n')
    }
  }
  process.exit(0)
}

/* L'IA DE L'APP EN NODE (`--ia`) : ce que fait « Logo maker » sur la carte
   graphique (lib/detourage-travail.js, `nettoyer` puis `garder`) — le flou
   retiré si le graphiste le mesure, l'Ultra du modèle OLDA en quatre
   orientations (le general en huit pour une matière), puis `recaler`,
   `fidele`, `borner` et les bords nets d'un logo à plat. Par
   onnxruntime-node, sur le processeur, installé à part (pas une dépendance
   du projet) :
     mkdir -p ~/.cache/logo-maker-banc && cd ~/.cache/logo-maker-banc && npm i onnxruntime-node
   La sortie brute du modèle se garde dans ce dossier (clé : l'entrée exacte
   et le modèle) : un changement du `lib/` ne refait que ce qui suit. */
async function chaineIa(L) {
  const ort = createRequire(join(CACHE_IA, 'package.json'))('onnxruntime-node')
  const { nettoyerParTuiles, enOrientations, fidele, borner, recaler, COTE_NETTOYAGE, ORIENTATIONS, FLOU, JUGE, FACTEUR } = await L('nettoyage.js')
  const { netAPlat } = await L('net-a-plat.js')
  const { rendreNet } = await L('nettete.js')
  const { reduire } = await L('vectoriser.js')
  const sessions = {}
  const session = async nom => sessions[nom] || (sessions[nom] = await ort.InferenceSession.create(join(RACINE, 'vendor', nom), { intraOpNumThreads: 2 }))
  mkdirSync(join(CACHE_IA, 'ia'), { recursive: true })
  return async (fichier, d, aPlat) => {
    let img = reduire(fichier.data, fichier.largeur, fichier.hauteur, COTE_NETTOYAGE)
    if (d.net && d.flou > 0) {
      const n = rendreNet(img, d.flou * img.largeur / fichier.largeur, { min: Math.ceil(Math.max(fichier.largeur, fichier.hauteur) / FACTEUR) })
      if (n.sigma) img = Object.assign(n, { nette: true })
    }
    const nom = d.matiere ? 'realesr-general-x4v3.onnx' : 'olda-logo-x4.onnx'
    const orientations = ORIENTATIONS.slice(0, d.matiere ? 8 : 4)
    const cle = createHash('sha1').update(nom + orientations.join()).update(img.data).digest('hex')
    const chemin = join(CACHE_IA, 'ia', cle + '.bin')
    const L4 = img.largeur * FACTEUR, H4 = img.hauteur * FACTEUR
    let data
    if (existsSync(chemin)) data = new Uint8ClampedArray(readFileSync(chemin))
    else {
      const s = await session(nom)
      const calculer = async (entree, l, h) => {
        const sortie = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', entree, [1, 3, h, l]) })
        return sortie[s.outputNames[0]].data
      }
      data = (await nettoyerParTuiles(img.data, img.largeur, img.hauteur, enOrientations(calculer, orientations))).data
      writeFileSync(chemin, data)
    }
    const r = { data: new Uint8ClampedArray(data), largeur: L4, hauteur: H4 }
    const src = img.nette ? img : reduire(fichier.data, fichier.largeur, fichier.hauteur, Math.round(JUGE * Math.max(img.largeur, img.hauteur)))
    recaler(r.data, r.largeur, r.hauteur, src.data, src.largeur, src.hauteur)
    fidele(r.data, r.largeur, r.hauteur, src.data, src.largeur, src.hauteur, { flou: FLOU * src.largeur / img.largeur })
    borner(r.data, r.largeur, r.hauteur, src.data, src.largeur, src.hauteur, { rayon: Math.max(1, Math.round(src.largeur / img.largeur)) })
    if (aPlat) netAPlat(r.data, r.largeur, r.hauteur, { echelle: r.largeur / fichier.largeur, source: fichier })
    return r
  }
}

/* Les pixels de bord : là où la teinte change avec le voisin de droite ou du dessous. */
function bords(lab, L, H, hors) {
  const b = new Uint8Array(L * H)
  for (let y = 0; y < H; y++) for (let x = 0; x < L; x++) {
    const p = y * L + x
    if (hors[p]) continue
    if ((x < L - 1 && lab[p] !== lab[p + 1]) || (y < H - 1 && lab[p] !== lab[p + L])) b[p] = 1
  }
  return b
}

/* F1 des bords à `TOL_BORD` près : la distance de chaque bord à l'autre ensemble. */
function f1(vrais, traces, L, H, distances) {
  const loin = m => { const d = new Uint8Array(m.length); for (let i = 0; i < m.length; i++) d[i] = m[i] ? 0 : 1; return distances(d, L, H) }
  const dV = loin(vrais), dT = loin(traces), t2 = TOL_BORD * TOL_BORD
  let nT = 0, okT = 0, nV = 0, okV = 0
  for (let p = 0; p < vrais.length; p++) {
    if (traces[p]) { nT++; if (dV[p] <= t2) okT++ }
    if (vrais[p]) { nV++; if (dT[p] <= t2) okV++ }
  }
  const precision = nT ? okT / nT : 1, rappel = nV ? okV / nV : 1
  return precision + rappel ? 2 * precision * rappel / (precision + rappel) : 0
}

/* Les îles : les morceaux d'un seul tenant de chaque teinte (le vide compris). */
function iles(lab, L, H) {
  const n = L * H, vu = new Uint8Array(n), pile = []
  const min = Math.max(16, ILE_MIN * n)
  let compte = 0
  for (let s = 0; s < n; s++) {
    if (vu[s]) continue
    const z = lab[s]
    vu[s] = 1; pile.push(s)
    let aire = 0
    while (pile.length) {
      const p = pile.pop(), x = p % L
      aire++
      if (x > 0 && !vu[p - 1] && lab[p - 1] === z) { vu[p - 1] = 1; pile.push(p - 1) }
      if (x < L - 1 && !vu[p + 1] && lab[p + 1] === z) { vu[p + 1] = 1; pile.push(p + 1) }
      if (p >= L && !vu[p - L] && lab[p - L] === z) { vu[p - L] = 1; pile.push(p - L) }
      if (p < n - L && !vu[p + L] && lab[p + L] === z) { vu[p + L] = 1; pile.push(p + L) }
    }
    if (aire >= min) compte++
  }
  return compte
}

/* -------------------------------------------------------- LE BANC */
const args = process.argv.slice(2)
const corpus = args.find(a => !a.startsWith('--'))
if (!corpus) { console.error('node outils/banc-bout.mjs <corpus> [--avant=<ref>] [--images=<dossier>]'); process.exit(2) }
const avant = (args.find(a => a.startsWith('--avant=')) || '').slice(8)
const images = (args.find(a => a.startsWith('--images=')) || '').slice(9)
const modeIa = args.includes('--ia') ? 'ia' : '-'
const cas = readdirSync(corpus).map(d => join(corpus, d)).filter(d => existsSync(join(d, 'verite.png'))).sort()

let ref = null
if (avant) {
  ref = join(tmpdir(), 'logo-maker-banc-bout-ref')
  rmSync(ref, { recursive: true, force: true })
  mkdirSync(ref, { recursive: true })
  execFileSync('sh', ['-c', `git -C "${RACINE}" archive "${avant}" lib | tar -x -C "${ref}"`])
  symlinkSync(join(RACINE, 'vendor'), join(ref, 'vendor'))
}
const dossierImages = racine => {
  if (!images) return '-'
  const d = join(images, racine === RACINE ? 'apres' : 'avant')
  mkdirSync(d, { recursive: true })
  return d
}

const parFil = Math.max(1, Math.floor(cpus().length / (ref ? 2 : 1) / (modeIa === 'ia' ? 2 : 1)))
function mesurer(racine) {
  const paquets = Array.from({ length: parFil }, (_, i) => cas.filter((_, k) => k % parFil === i)).filter(p => p.length)
  return Promise.all(paquets.map(liste => new Promise((ok, ko) => {
    const f = spawn(process.execPath, ['--max-old-space-size=8000', fileURLToPath(import.meta.url), '--mesurer', racine, dossierImages(racine), modeIa, ...liste], { stdio: ['ignore', 'pipe', 'inherit'] })
    let txt = ''
    f.stdout.on('data', d => { txt += d })
    f.on('close', c => c ? ko(new Error('fil ' + c)) : ok(txt.trim().split('\n').filter(Boolean).map(l => JSON.parse(l))))
  }))).then(t => new Map(t.flat().map(r => [r.cas + '|' + r.abime, r])))
}

const t0 = Date.now()
console.log(`${cas.length} logos × ${ABIMES.length} abîmes${modeIa === 'ia' ? ' · avec l\'IA (Ultra OLDA)' : ' · sans l\'IA'}${ref ? ` · ${avant} contre l'arbre de travail` : ''}`)
const [A, B] = await Promise.all([ref ? mesurer(ref) : null, mesurer(RACINE)])

const METRIQUES = [['forme', 3, 1], ['bord', 3, 1], ['dE', 2, -1], ['teintes', 2, -1], ['iles', 2, -1], ['noeuds', 0, -1]]
const absolu = k => k === 'teintes' || k === 'iles'
const val = (r, k) => r && !r.erreur ? (absolu(k) ? Math.abs(r[k]) : r[k]) : NaN
const moyenne = (rs, k) => { const v = rs.map(r => val(r, k)).filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN }
const fmt = (x, d) => Number.isFinite(x) ? x.toFixed(d) : '—'

for (const r of B.values()) if (r.erreur) console.log('✗', r.cas, r.abime, r.erreur)
if (args.includes('--detail')) {
  console.log('\nLogo par logo (le pire en forme d\'abord) :')
  for (const r of [...B.values()].filter(r => !r.erreur).sort((a, b) => a.forme - b.forme))
    console.log('  ' + `${r.cas} · ${r.abime}`.padEnd(44) + METRIQUES.map(([k, d]) => fmt(r[k], d).padStart(9)).join(''))
}
if (A) {
  console.log('\nCe qui change (avant → après) :')
  for (const [cle, b] of B) {
    const a = A.get(cle)
    const ch = METRIQUES.filter(([k, d]) => fmt(val(a, k), d) !== fmt(val(b, k), d)).map(([k, d]) => `${k} ${fmt(a && a[k], d)} → ${fmt(b[k], d)}`)
    if (ch.length) console.log(`  ${cle.replace('|', ' · ')} : ${ch.join(', ')}`)
  }
}
console.log('\nMoyennes' + (A ? ' (avant → après)' : '') + ' — forme, bord : plus haut est mieux ; ΔE, |teintes|, |îles|, nœuds : plus bas est mieux')
const groupes = [...ABIMES.map(g => [g, r => r.abime === g]), ['synthétiques', r => !r.cas.startsWith('vrai-')], ['vrais', r => r.cas.startsWith('vrai-')], ['TOUT', () => true]]
console.log('  ' + 'groupe'.padEnd(14) + METRIQUES.map(([k]) => k.padStart(A ? 18 : 9)).join(''))
for (const [nom, garde] of groupes) {
  const b = [...B.values()].filter(garde), a = A ? [...A.values()].filter(garde) : null
  console.log('  ' + nom.padEnd(14) + METRIQUES.map(([k, d]) => (A ? `${fmt(moyenne(a, k), d)} → ${fmt(moyenne(b, k), d)}` : fmt(moyenne(b, k), d)).padStart(A ? 18 : 9)).join(''))
}
console.log(`(${Math.round((Date.now() - t0) / 1000)} s)`)
if (ref) rmSync(ref, { recursive: true, force: true })

/* LE BANC DES POLICES (lib/polices.js, `choisirPolices`) : des mots écrits
   dans des polices connues de la réserve (vendor/polices/index.json, les
   fichiers pris sur jsDelivr et gardés dans node_modules/.polices-cache/),
   rendus en pixels comme le Logo maker les voit (quatre sous-pixels,
   plein à la moitié), puis reconnus. Mesure : la famille retrouvée en
   tête — ou une jumelle, le même dessin à 0,005 près —, dans les cinq, et
   sa graisse juste. Pour juger un changement du choix (CLAUDE.md) :
   avant, après, sur le même tirage.
     node --max-old-space-size=8000 outils/banc-polices.mjs [familles=40] [graine=1] [texte…]
   Réglages par l'environnement : TRI (familles passées au tri de l'index),
   GRAISSES (graisses essayées par famille), HAUTEUR (pixels des lettres
   réduites), FINE=0 (sans la graisse affinée en pleine taille), CAP
   (hauteur de capitale du rendu, 56), FAMILLES=id:graisse,… (un tirage
   choisi), DEBUG_POLICE=id (le rang de cette famille à chaque étape).
   LES POLICES DU POSTE (1er octobre 2026, lib/polices-poste.js) : POSTE=1
   ajoute à la réserve celles de ce Mac (/System/Library/Fonts, ses
   collections défaites), comme Chrome les prête au Logo maker ;
   TIRAGE=poste écrit les mots dans des familles du poste (Futura, Gill
   Sans, Helvetica…) plutôt que de Google — sans POSTE=1, aucune ne peut
   être reconnue : c'est la mesure d'avant. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
const CACHE = new URL('../node_modules/.polices-cache/', import.meta.url)
mkdirSync(CACHE, { recursive: true })
import { famillesDe, choisirPolices, polygones, remplir, formesDe, lignesDe, glyphesDe, noter, reduireGlyphes } from '../lib/polices.js'
import { cheminTexte } from '../lib/ecriture.js'

const N = Number(process.argv[2] || 40)
const GRAINE = Number(process.argv[3] || 1)
const TEXTES = process.argv.slice(4).length ? process.argv.slice(4) : ['Biodiversité', 'NATIONALE', 'Explorer']
const CAP = Number(process.env.CAP || 56)
const HAUTEUR = process.env.HAUTEUR ? Number(process.env.HAUTEUR) : undefined

const index = JSON.parse(readFileSync(new URL('../vendor/polices/index.json', import.meta.url), 'utf8'))
const familles = famillesDe(index)
/* Le tirage se fait dans Google seul : avec ou sans le poste, les mêmes
   mots dans les mêmes polices. */
const google = familles.slice()

const { parse } = await import('../vendor/opentype.min.mjs')

/* Les polices de ce Mac, défaites et mesurées comme dans le Logo maker. */
const posteOctets = new Map()
let poste = []
if (process.env.POSTE === '1' || process.env.TIRAGE === 'poste') {
  const { readdirSync } = await import('node:fs')
  const { facesTtc, decrireFace, famillesPoste } = await import('../lib/polices-poste.js')
  const { IGNOREES } = await import('../lib/reserve-polices.js')
  const descr = []
  for (const dossier of ['/System/Library/Fonts/', '/System/Library/Fonts/Supplemental/', '/Library/Fonts/']) {
    let noms = []
    try { noms = readdirSync(dossier) } catch {}
    for (const nom of noms.filter(n => /\.(ttf|otf|ttc)$/i.test(n))) {
      let faces = []
      try { faces = facesTtc(readFileSync(dossier + nom)) } catch { continue }
      faces.forEach((o, k) => {
        if (o.byteLength > 12e6) return
        let police
        try { police = parse(o) } catch { return }
        const n = police.names.windows || police.names.macintosh || police.names
        const fam = (n.typographicFamily || n.preferredFamily || n.fontFamily || {}).en || ''
        if (!fam || IGNOREES.test(fam)) return
        const cle = dossier + nom + '#' + k
        const d = decrireFace(police, { cle })
        if (d) { descr.push(d); posteOctets.set(cle, o) }
      })
    }
  }
  poste = famillesPoste(descr, 'poste')
  console.log('poste :', descr.length, 'faces,', poste.length, 'familles')
}
if (process.env.POSTE === '1') familles.push(...poste)

const cache = new Map()
function charger(f) {
  const cle = f.local ? 'local:' + f.local : f.id + '/' + f.graisse + f.style
  if (f.local && !cache.has(cle)) cache.set(cle, Promise.resolve(posteOctets.has(f.local) ? parse(posteOctets.get(f.local)) : null))
  if (!cache.has(cle)) {
    cache.set(cle, (async () => {
      const nom = 'https://cdn.jsdelivr.net/fontsource/fonts/' + f.id + '@latest/latin-' + f.graisse + '-' + f.style + '.woff'
      const local = new URL(f.id + '-' + f.graisse + '-' + f.style + '.woff', CACHE)
      let octets
      try { octets = readFileSync(local) } catch {
        const r = await fetch(nom)
        if (!r.ok) { try { writeFileSync(local, new Uint8Array(0)) } catch {} ; return null }
        octets = Buffer.from(await r.arrayBuffer())
        try { writeFileSync(local, octets) } catch {}
      }
      if (!octets.length) return null
      return parse(octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength))
    })().catch(() => null))
  }
  return cache.get(cle)
}

/* Un tirage reproductible. */
let g = GRAINE
const alea = () => { g = (g * 1103515245 + 12345) & 0x7fffffff; return g / 0x7fffffff }

/* Les familles à écrire : droites, pas manuscrites, prises au hasard
   (TIRAGE=poste : parmi celles du poste). */
const droites = (process.env.TIRAGE === 'poste' ? poste : google).filter(f => f.style === 'normal' && f.cat !== 'handwriting')
const tirees = []
const vus = new Set()
for (const id of (process.env.FAMILLES || '').split(',').filter(Boolean)) {
  const [fid, g] = id.split(':'), f = droites.find(f => f.id === fid)
  if (f) { vus.add(f.id); tirees.push({ fam: f, fichier: f.fichiers.find(x => String(x.graisse) === g) || f.fichiers[0] }) }
}
while (!process.env.FAMILLES && tirees.length < N && tirees.length < droites.length) {
  const f = droites[Math.floor(alea() * droites.length)]
  if (vus.has(f.id)) continue
  vus.add(f.id)
  tirees.push({ fam: f, fichier: f.fichiers[Math.floor(alea() * f.fichiers.length)] })
}

/* Le mot rendu en pixels : à `CAP` pixels de capitale, quatre sous-pixels,
   plein à la moitié — puis ses lettres comme lib/texte.js les trouve. */
function observer(police, texte) {
  const taille = CAP * police.unitsPerEm / (police.charToGlyph('H').getBoundingBox().y2 || police.unitsPerEm * 0.7)
  const polys = polygones(cheminTexte(police, texte, taille), 24)
  let X0 = Infinity, Y0 = Infinity, X1 = -Infinity, Y1 = -Infinity
  for (const p of polys) for (const [x, y] of p) { X0 = Math.min(X0, x); Y0 = Math.min(Y0, y); X1 = Math.max(X1, x); Y1 = Math.max(Y1, y) }
  const m = 12, SS = 4
  const W = Math.ceil(X1 - X0) + 2 * m, H = Math.ceil(Y1 - Y0) + 2 * m
  const fin = remplir(polys.map(p => p.map(([x, y]) => [(x - X0 + m) * SS, (y - Y0 + m) * SS])), 0, 0, W * SS, H * SS)
  const tout = new Float32Array(W * H)
  for (let y = 0; y < H * SS; y++) for (let x = 0; x < W * SS; x++) if (fin[y * W * SS + x]) tout[((y / SS) | 0) * W + ((x / SS) | 0)] += 1 / (SS * SS)
  const { formes } = formesDe(tout, W, H)
  const lignes = lignesDe(formes.filter(f => f.pixels.length >= 4))
  if (lignes.length !== 1) return null
  return glyphesDe(lignes[0], texte, W, null)
}

let total = 0, tete = 0, cinq = 0, graisse = 0, sautes = 0, duree = 0, jumelles = 0
const mediane = v => { const t = v.slice().sort((a, b) => a - b); return t[t.length >> 1] }
const rates = []
for (const { fam, fichier } of tirees) {
  const police = await charger(fichier)
  if (!police) { sautes++; continue }
  for (const texte of TEXTES) {
    const glyphes = observer(police, texte)
    if (!glyphes) { sautes++; continue }
    const t0 = performance.now()
    const opts = {}
    if (HAUTEUR) opts.hauteur = HAUTEUR
    if (process.env.TRI) opts.tri = Number(process.env.TRI)
    if (process.env.GRAISSES) opts.graisses = Number(process.env.GRAISSES)
    if (process.env.FINE === '0') opts.fine = false
    const props = await choisirPolices(glyphes, familles, charger, opts)
    duree += performance.now() - t0
    total++
    let rang = props.findIndex(p => p.fichier.id === fam.id)
    /* La vraie police notée comme les propositions : à égalité avec la
       première (à 0,005 près), c'est une jumelle — le même dessin. Pas
       au-dessus (1er octobre 2026) : mieux notée que la première, la
       vraie a été manquée ; ni absente de la réserve (TIRAGE=poste sans
       POSTE=1) : rien ne pouvait la trouver. */
    if (rang !== 0 && props.length && familles.includes(fam)) {
      const f = Math.min(1, (HAUTEUR || 48) / mediane(glyphes.filter(g => !g.ponctuation).map(g => g.y1 - g.y0 + 1)))
      const vraie = noter(reduireGlyphes(glyphes, f), police).note
      if (Math.abs(vraie - props[0].note) <= 0.005) { rang = 0; jumelles++ }
    }
    if (rang === 0) { tete++; if (props[0].fichier.graisse === fichier.graisse) graisse++ }
    if (rang >= 0 && rang < 5) cinq++
    else rates.push(fam.id + ' ' + fichier.graisse + ' « ' + texte + ' » → ' + props.slice(0, 3).map(p => p.fichier.id + ' ' + p.fichier.graisse + ' ' + Math.round(p.note * 100) + '%').join(', '))
    if (rang > 0) rates.push('  (rang ' + (rang + 1) + ') ' + fam.id + ' ' + fichier.graisse + ' « ' + texte + ' » → ' + props.slice(0, 3).map(p => p.fichier.id + ' ' + p.fichier.graisse + ' ' + Math.round(p.note * 100) + '%').join(', '))
    process.stderr.write('.')
  }
}
console.log('\nlignes', total, 'sautées', sautes, '· en tête (ou jumelle)', tete, '(' + Math.round(100 * tete / total) + ' %, dont ' + jumelles + ' jumelles)', '· dans les cinq', cinq, '(' + Math.round(100 * cinq / total) + ' %)', '· graisse juste', graisse, '· ' + Math.round(duree / total) + ' ms par ligne (polices en cache)')
for (const r of rates) console.log(r)

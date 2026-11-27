/* LE BANC DES MÊMES OCTETS (27 novembre 2026) : « même logo → même PDF ».
   Chaque logo passe par la chaîne de calcul de deux `lib/` — celui d'une
   référence git (`--avant=main` par défaut) et celui de l'arbre de
   travail — et chaque étape se compare en SHA-1 : la décision du
   graphiste, le détourage, le tracé (SVG), les bords nets d'un logo à plat.
   Un écart n'est pas une erreur : c'est ce que le changement touche, à
   regarder logo par logo (outils/banc-controle.mjs, banc-lignes.mjs).
     node outils/banc-octets.mjs [--avant=<ref>] [logo…]
   Sans logo : les images de ~/Downloads (PNG, JPEG, WebP, HEIC), réduites
   à la taille de l'aperçu par `sips` (macOS) et gardées en cache. Sort
   avec 1 s'il y a un écart. L'IA (ONNX) et la lecture du texte n'y passent
   pas : seule la part en JavaScript, qui doit rendre les mêmes octets. */
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, statSync, symlinkSync, rmSync } from 'node:fs'
import { homedir, tmpdir, cpus } from 'node:os'
import { join, resolve, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lirePng } from './png-lire.mjs'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sha = x => createHash('sha1').update(x).digest('hex').slice(0, 12)

/* ------------------------------------------------ LE FILS : une chaîne */
if (process.argv[2] === '--mesurer') {
  const [, , , racine, ...pngs] = process.argv
  const L = n => import(join(racine, 'lib', n))
  const { decider } = await L('graphiste.js')
  const { detourer, TOLERANCE } = await L('detourage.js')
  const { vectoriserLisse } = await L('vecteur-lisse.js')
  const { netAPlat } = await L('net-a-plat.js')
  for (const png of pngs) {
    const r = { fichier: png }
    try {
      const img = lirePng(png)
      const d = decider({ data: img.data, largeur: img.largeur, hauteur: img.hauteur, echelle: 1 }, { largeur: img.largeur, hauteur: img.hauteur })
      r.decision = sha(JSON.stringify(d))
      const det = detourer(img.data, img.largeur, img.hauteur, { tolerance: TOLERANCE, interieur: true }, 1)
      r.detourage = sha(det.data)
      const aPlat = d.genre === 'logo' && !d.matiere
      const v = vectoriserLisse(det.data, img.largeur, img.hauteur, { fonds: det.fonds || [], source: img.data, alpha: true, lissage: 70, trouer: false, geometrie: true, miettes: true, origine: Math.max(img.largeur, img.hauteur), nuances: true, mono: false, memo: {}, aPlat })
      r.svg = v.svg ? sha(v.svg) : '-'
      if (aPlat) {
        const copie = new Uint8ClampedArray(img.data)
        netAPlat(copie, img.largeur, img.hauteur, { echelle: 1 })
        r.net = sha(copie)
      } else r.net = '-'
    } catch (e) {
      r.erreur = String(e && e.message || e).slice(0, 120)
    }
    process.stdout.write(JSON.stringify(r) + '\n')
  }
  process.exit(0)
}

/* -------------------------------------------------------- LE BANC */
const args = process.argv.slice(2)
const avant = (args.find(a => a.startsWith('--avant=')) || '--avant=main').slice(8)
let logos = args.filter(a => !a.startsWith('--'))
if (!logos.length) {
  const dl = join(homedir(), 'Downloads')
  logos = readdirSync(dl).filter(f => /\.(png|jpe?g|webp|heic)$/i.test(f)).map(f => join(dl, f))
}

/* Les PNG d'aperçu (1 400 px au plus, comme le studio), en cache. */
const cache = join(tmpdir(), 'logo-maker-banc-octets')
mkdirSync(cache, { recursive: true })
const pngs = []
for (const f of logos) {
  const s = statSync(f)
  const sortie = join(cache, sha('v2|' + f + '|' + s.size + '|' + s.mtimeMs) + '.png')
  if (!existsSync(sortie)) {
    try {
      const dims = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', f], { encoding: 'utf8' }).match(/\d+/g).slice(-2).map(Number)
      const reduire = Math.max(...dims) > 1400 ? ['-Z', '1400'] : []
      execFileSync('sips', ['-s', 'format', 'png', ...reduire, f, '--out', sortie], { stdio: 'ignore' })
    } catch { console.warn('illisible :', basename(f)); continue }
  }
  pngs.push({ nom: basename(f), png: sortie })
}

/* Le lib/ de la référence, dans un dossier à part (vendor/ relié). */
const ref = join(tmpdir(), 'logo-maker-banc-ref')
rmSync(ref, { recursive: true, force: true })
mkdirSync(ref, { recursive: true })
execFileSync('sh', ['-c', `git -C "${RACINE}" archive "${avant}" lib | tar -x -C "${ref}"`])
symlinkSync(join(RACINE, 'vendor'), join(ref, 'vendor'))

/* Chaque version en plusieurs fils (la moitié des cœurs chacune). */
const parFil = Math.max(1, Math.floor(cpus().length / 2))
function mesurer(racine) {
  const paquets = Array.from({ length: parFil }, (_, i) => pngs.filter((_, k) => k % parFil === i).map(p => p.png)).filter(p => p.length)
  return Promise.all(paquets.map(liste => new Promise((ok, ko) => {
    const f = spawn(process.execPath, ['--max-old-space-size=8000', fileURLToPath(import.meta.url), '--mesurer', racine, ...liste], { stdio: ['ignore', 'pipe', 'inherit'] })
    let txt = ''
    f.stdout.on('data', d => { txt += d })
    f.on('close', c => c ? ko(new Error('fil ' + c)) : ok(txt.trim().split('\n').filter(Boolean).map(l => JSON.parse(l))))
  }))).then(t => new Map(t.flat().map(r => [r.fichier, r])))
}

const t0 = Date.now()
console.log(`${pngs.length} logos · ${avant} contre l'arbre de travail · ${parFil} fils chacun`)
const [A, B] = await Promise.all([mesurer(ref), mesurer(RACINE)])
const ETAPES = ['decision', 'detourage', 'svg', 'net', 'erreur']
let ecarts = 0
for (const { nom, png } of pngs) {
  const a = A.get(png) || {}, b = B.get(png) || {}
  const diff = ETAPES.filter(k => (a[k] || '') !== (b[k] || ''))
  if (!diff.length) continue
  ecarts++
  console.log(`≠ ${nom} : ${diff.join(', ')}${b.erreur ? ' — ' + b.erreur : ''}`)
}
console.log(ecarts ? `${ecarts} logo(s) changent sur ${pngs.length}.` : `Les mêmes octets sur les ${pngs.length} logos.`, `(${Math.round((Date.now() - t0) / 1000)} s)`)
rmSync(ref, { recursive: true, force: true })
process.exit(ecarts ? 1 : 0)

/* LA TABLE DU CMJN (lib/cmjn-fogra39.js), refaite depuis le profil de la
   presse : chaque sommet d'une grille de 17 × 17 × 17 couleurs sRVB passé
   par littleCMS (`transicc`, Homebrew : `brew install little-cms2`) vers
   Coated FOGRA39, en relatif colorimétrique avec compensation du point
   noir — ce que font Illustrator et Photoshop réglés sur « Europe, usage
   général 3 ». lib/cmjn.js interpole entre les sommets (tétraèdres) : à
   0,2 % d'encre près en moyenne de littleCMS lui-même.

     node outils/table-cmjn.mjs ["/chemin/vers/CoatedFOGRA39.icc"]

   Le profil est celui qu'installe la suite Adobe. */
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const PROFIL = process.argv[2] || '/Library/Application Support/Adobe/Color/Profiles/Recommended/CoatedFOGRA39.icc'
const N = 17
/* Sous un demi-point d'encre, rien : le blanc sort 0 0 0 0, pas 0 0,1 0 0. */
const MIN = 0.5

const grille = []
for (let r = 0; r < N; r++) for (let g = 0; g < N; g++) for (let b = 0; b < N; b++) grille.push([r, g, b].map(i => i * 255 / (N - 1)))
const sortie = execFileSync('transicc', ['-n', '-t1', '-b', '-c0', '-i*sRGB', '-o' + PROFIL], {
  input: grille.map(c => c.join(' ')).join('\n') + '\n',
  stdio: ['pipe', 'pipe', 'ignore'],
  maxBuffer: 1 << 26,
}).toString().trim().split('\n').map(l => l.trim().split(/\s+/).map(Number))
if (sortie.length !== grille.length || sortie.some(v => v.length !== 4 || v.some(x => !Number.isFinite(x)))) throw new Error('transicc : réponse inattendue')

const octets = new Uint8Array(grille.length * 4)
sortie.forEach((v, i) => v.forEach((x, k) => { octets[i * 4 + k] = x < MIN ? 0 : Math.round(Math.min(100, x) * 2.55) }))

const fichier = new URL('../lib/cmjn-fogra39.js', import.meta.url)
writeFileSync(fichier, '/* LA TABLE DU CMJN : Coated FOGRA39, relatif colorimétrique, point noir\n'
  + '   compensé — ' + N + ' × ' + N + ' × ' + N + ' sommets sRVB (rouge, puis vert, puis bleu),\n'
  + '   quatre octets chacun (C, M, J, N ; 255 : 100 % d\'encre). Écrite par\n'
  + '   outils/table-cmjn.mjs : ne pas modifier à la main. */\n'
  + 'export const N = ' + N + '\n'
  + "export const TABLE = '" + Buffer.from(octets).toString('base64') + "'\n")
console.log('lib/cmjn-fogra39.js :', grille.length, 'sommets —', 'noir', sortie[0].map(Math.round).join('/'), '· rouge', sortie[(N - 1) * N * N].map(Math.round).join('/'))

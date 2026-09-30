/* LE NUANCIER OLDA (lib/nuancier.js), refait depuis le fichier d'échange
   de couleurs d'Illustrator (.ase) : chaque couleur, son nom et ses encres
   telles quelles — et son rendu à l'écran, ces encres passées par
   littleCMS (`transicc`, Homebrew : `brew install little-cms2`) de Coated
   FOGRA39 vers sRGB, en relatif colorimétrique avec compensation du point
   noir, comme Illustrator les montre en Europe.

     node outils/nuancier.mjs ["/chemin/vers/Nuancier.ase"] ["/chemin/vers/CoatedFOGRA39.icc"]

   Le nuancier d'office : outils/nuancier-olda-2026-v2.ase. */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/* LES COULEURS D'UN .ase : { nom, cmjn } (de 0 à 100), dans l'ordre du
   nuancier. Seules les couleurs CMJN y sont attendues. */
export function lireAse(octets) {
  const d = new DataView(octets.buffer, octets.byteOffset, octets.byteLength)
  if (String.fromCharCode(...octets.subarray(0, 4)) !== 'ASEF') throw new Error('pas un nuancier .ase')
  const couleurs = []
  for (let p = 12; p < octets.length;) {
    const type = d.getUint16(p), taille = d.getUint32(p + 2)
    const bloc = p + 6
    p = bloc + taille
    if (type !== 0x0001) continue
    const n = d.getUint16(bloc)
    let nom = ''
    for (let k = 0; k < n - 1; k++) nom += String.fromCharCode(d.getUint16(bloc + 2 + k * 2))
    const q = bloc + 2 + n * 2
    const modele = String.fromCharCode(...octets.subarray(q, q + 4))
    if (modele !== 'CMYK') throw new Error(nom + ' : ' + modele.trim() + ', pas du CMJN')
    const cmjn = [0, 1, 2, 3].map(k => Math.round(d.getFloat32(q + 4 + k * 4) * 10000) / 100)
    couleurs.push({ nom, cmjn })
  }
  return couleurs
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ASE = process.argv[2] || fileURLToPath(new URL('./nuancier-olda-2026-v2.ase', import.meta.url))
  const PROFIL = process.argv[3] || '/Library/Application Support/Adobe/Color/Profiles/Recommended/CoatedFOGRA39.icc'
  const couleurs = lireAse(readFileSync(ASE))
  const ecran = execFileSync('transicc', ['-n', '-t1', '-b', '-c0', '-i' + PROFIL, '-o*sRGB'], {
    input: couleurs.map(c => c.cmjn.join(' ')).join('\n') + '\n',
    stdio: ['pipe', 'pipe', 'ignore'],
  }).toString().trim().split('\n').map(l => l.trim().split(/\s+/).map(v => Math.round(Math.max(0, Math.min(255, Number(v))))))
  if (ecran.length !== couleurs.length || ecran.some(v => v.length !== 3 || v.some(x => !Number.isFinite(x)))) throw new Error('transicc : réponse inattendue')
  const lignes = couleurs.map((c, i) => "  { nom: '" + c.nom.replace(/'/g, "\\'") + "', cmjn: [" + c.cmjn.join(', ') + '], rvb: [' + ecran[i].join(', ') + '] },')
  const nomFichier = ASE.split('/').pop()
  writeFileSync(new URL('../lib/nuancier.js', import.meta.url), '/* LE NUANCIER OLDA (' + nomFichier + ') : chaque couleur, ses encres\n'
    + '   officielles (C, M, J, N, de 0 à 100) et son rendu à l\'écran (sRVB,\n'
    + '   depuis Coated FOGRA39). Écrit par outils/nuancier.mjs : ne pas\n'
    + '   modifier à la main. */\n'
    + 'export const NUANCIER = [\n' + lignes.join('\n') + '\n]\n')
  console.log('lib/nuancier.js :', couleurs.length, 'couleurs —', couleurs.map((c, i) => c.nom + ' ' + ecran[i].join('/')).join(' · '))
}

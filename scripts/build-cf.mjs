// Prépare dist-cf/ : le site tel que le servait serveur.mjs (rien de caché, ni les outils de développement),
// SANS les fichiers de plus de 25 Mio (limite de Cloudflare pour les fichiers statiques) : les modèles d'IA vont dans R2
// (`npm run cf:modeles`) et sont servis par worker/index.js.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const RACINE = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
const OUT = path.join(RACINE, 'dist-cf');
const LIMITE = 25 * 1024 * 1024;
const EXCLUS = new Set(['node_modules', 'dist-cf', 'worker', 'scripts', 'wrangler.jsonc', 'package.json', 'package-lock.json', 'serveur.mjs', 'serveur.test.mjs', 'CLAUDE.md']);

fs.rmSync(OUT, { recursive: true, force: true });
const gros = [];
let n = 0;
(function copier(src, dst, profondeur = 0) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.name.startsWith('.') || (profondeur === 0 && EXCLUS.has(e.name))) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copier(s, d, profondeur + 1);
    else if (fs.statSync(s).size > LIMITE) gros.push(path.relative(RACINE, s).split(path.sep).join('/'));
    else { fs.copyFileSync(s, d); n++; }
  }
})(RACINE, OUT);

fs.writeFileSync(path.join(OUT, '_headers'), `/*
  X-Content-Type-Options: nosniff
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: credentialless
  Cache-Control: no-cache
`);
fs.writeFileSync(path.join(RACINE, 'worker', 'gros-fichiers.json'), JSON.stringify(gros, null, 2) + '\n');
console.log(`dist-cf prêt : ${n} fichiers ; ${gros.length} gros fichiers à mettre dans R2 :\n  ` + gros.join('\n  '));

/* =============================================================== LE SERVEUR
   30 septembre 2026 : « récupère tout mon app Logo maker et mets-la sur un
   site Railway en ligne ». Le Logo maker reste des pages statiques — tout se
   calcule dans le navigateur, rien n'arrive ici — : ce serveur ne fait que
   les servir, sans paquet. `node serveur.mjs` (Railway : `npm start`, le
   port dans PORT ; l'aperçu `logo-maker` aussi).
   - Les bons types : un .wasm en application/wasm (le navigateur le compile
     en le recevant), un .mjs en JavaScript.
   - Compressé une fois, gardé en mémoire : le moteur ONNX (27 Mo) part en
     7, les scripts et l'index des polices aussi. Pas les modèles .onnx (déjà
     denses).
   - Revalidé à chaque visite (ETag) : une mise en ligne se voit tout de
     suite, et ce qui n'a pas changé ne repart pas (304). L'ETag est
     l'empreinte du contenu, pas sa date : Railway date chaque fichier du
     dernier commit, et un modèle de 55 Mo repartait à chaque mise en
     ligne.
   - Rien de caché ne sort : ni .git, ni .claude, rien qui commence par un
     point.
   - La page est isolée de toute autre origine (1er octobre 2026, « encore
     plus puissante ») : sans cet isolement, le navigateur refuse la mémoire
     partagée, et le moteur ONNX ne calcule que sur un cœur du processeur —
     la lecture du texte, l'IA sans carte graphique. Isolée, sur quatre.
     « credentialless » : les polices de Google et de Fontsource (jsDelivr)
     viennent toujours, sans cookies — Chrome, Edge et Firefox le
     comprennent ; Safari l'ignore et reste sur un cœur. */
import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { pipeline } from 'node:stream'
import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { gzip } from 'node:zlib'
import { promisify } from 'node:util'
import { extname, join, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const RACINE = fileURLToPath(new URL('.', import.meta.url))

export const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.onnx': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
}
const COMPRESSES = new Set(['.html', '.js', '.mjs', '.json', '.svg', '.txt', '.md', '.wasm'])

/* LE FICHIER D'UNE ADRESSE, dans `racine` : « / » et un dossier donnent
   son index.html. null : une adresse illisible, qui sort de la racine, ou
   qui passe par un nom caché. */
export function fichierDe(racine, adresse) {
  let chemin
  try {
    chemin = decodeURIComponent(new URL(adresse, 'http://x').pathname)
  } catch {
    return null
  }
  if (chemin.includes('\0') || chemin.split('/').some(p => p.startsWith('.'))) return null
  if (chemin.endsWith('/')) chemin += 'index.html'
  const f = resolve(join(racine, chemin))
  return f.startsWith(resolve(racine) + sep) ? f : null
}

/* L'EMPREINTE D'UN FICHIER, calculée une fois par version (taille et
   date) : une promesse, pour que deux visiteurs ne la calculent pas deux
   fois. Faible (W/) : la version compressée porte la même. */
const empreintes = new Map()
function empreinte(f, s) {
  const version = s.size + '-' + s.mtimeMs
  const deja = empreintes.get(f)
  if (deja && deja.version === version) return deja.etag
  const etag = new Promise((ok, ko) => {
    const h = createHash('sha1')
    createReadStream(f).on('error', ko).on('data', m => h.update(m)).on('end', () => ok('W/"' + h.digest('base64url') + '"'))
  })
  empreintes.set(f, { version, etag })
  etag.catch(() => empreintes.delete(f))
  return etag
}

/* Les fichiers compressés, un par chemin (sa dernière version) : une
   promesse, pour que deux visiteurs ne compressent pas deux fois le même. */
const compresses = new Map()
const gz = promisify(gzip)
function compresse(f, etag) {
  const deja = compresses.get(f)
  if (deja && deja.etag === etag) return deja.octets
  const octets = readFile(f).then(o => gz(o))
  compresses.set(f, { etag, octets })
  octets.catch(() => compresses.delete(f))
  return octets
}

export function serveur(racine = RACINE) {
  return createServer(async (req, rep) => {
    rep.setHeader('X-Content-Type-Options', 'nosniff')
    rep.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
    rep.setHeader('Cross-Origin-Embedder-Policy', 'credentialless')
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      rep.writeHead(405, { Allow: 'GET, HEAD' })
      return rep.end()
    }
    const f = fichierDe(racine, req.url)
    const s = f && await stat(f).catch(() => null)
    if (s && s.isDirectory()) {
      /* Un dossier sans « / » : l'adresse se complète, ses liens relatifs
         partent de là. */
      rep.writeHead(301, { Location: new URL(req.url, 'http://x').pathname + '/' })
      return rep.end()
    }
    if (!s || !s.isFile()) {
      rep.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      return rep.end('Introuvable.')
    }
    const ext = extname(f).toLowerCase()
    const etag = await empreinte(f, s).catch(() => null)
    if (!etag) {
      rep.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      return rep.end('Introuvable.')
    }
    const entetes = { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache', ETag: etag }
    /* Une réponse qui aurait pu partir compressée le dit, compressée ou non. */
    if (COMPRESSES.has(ext)) entetes.Vary = 'Accept-Encoding'
    if (req.headers['if-none-match'] === etag) {
      rep.writeHead(304, entetes)
      return rep.end()
    }
    if (COMPRESSES.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      try {
        const o = await compresse(f, etag)
        rep.writeHead(200, Object.assign(entetes, { 'Content-Encoding': 'gzip', 'Content-Length': o.length }))
        return rep.end(req.method === 'HEAD' ? undefined : o)
      } catch {
        /* Illisible pour la compression : il part tel quel. */
      }
    }
    rep.writeHead(200, Object.assign(entetes, { 'Content-Length': s.size }))
    if (req.method === 'HEAD') return rep.end()
    /* `pipeline` ferme le fichier quand le visiteur coupe (un modèle de
       55 Mo à moitié reçu, la page rechargée) ; `pipe` le laissait ouvert. */
    pipeline(createReadStream(f), rep, () => {})
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT) || 8130
  serveur().listen(port, () => console.log('Logo maker : http://localhost:' + port + '/'))
}

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
     suite, et ce qui n'a pas changé ne repart pas (304).
   - Rien de caché ne sort : ni .git, ni .claude, rien qui commence par un
     point. */
import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
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
  '.gz': 'application/gzip',
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

/* Les fichiers compressés, par chemin et version : une promesse, pour que
   deux visiteurs ne compressent pas deux fois le même. */
const compresses = new Map()
const gz = promisify(gzip)
function compresse(f, etag) {
  const cle = f + etag
  if (!compresses.has(cle)) compresses.set(cle, readFile(f).then(o => gz(o)).catch(e => { compresses.delete(cle); throw e }))
  return compresses.get(cle)
}

export function serveur(racine = RACINE) {
  return createServer(async (req, rep) => {
    rep.setHeader('X-Content-Type-Options', 'nosniff')
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
    const etag = 'W/"' + s.size.toString(36) + '-' + Math.floor(s.mtimeMs).toString(36) + '"'
    const entetes = { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache', ETag: etag }
    if (req.headers['if-none-match'] === etag) {
      rep.writeHead(304, entetes)
      return rep.end()
    }
    if (COMPRESSES.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      try {
        const o = await compresse(f, etag)
        rep.writeHead(200, Object.assign(entetes, { 'Content-Encoding': 'gzip', 'Content-Length': o.length, Vary: 'Accept-Encoding' }))
        return rep.end(req.method === 'HEAD' ? undefined : o)
      } catch {
        /* Illisible pour la compression : il part tel quel. */
      }
    }
    rep.writeHead(200, Object.assign(entetes, { 'Content-Length': s.size }))
    if (req.method === 'HEAD') return rep.end()
    createReadStream(f).on('error', () => rep.destroy()).pipe(rep)
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT) || 8130
  serveur().listen(port, () => console.log('Logo maker : http://localhost:' + port + '/'))
}

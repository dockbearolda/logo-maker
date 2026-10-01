/* LE SERVEUR (serveur.mjs) : les pages telles quelles, compressées quand
   ça vaut la peine, rien de caché. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdtemp, writeFile, utimes, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { serveur, fichierDe } from './serveur.mjs'

const RACINE = fileURLToPath(new URL('.', import.meta.url))

test('fichierDe : l\'index, et rien hors de la racine ni de caché', () => {
  assert.equal(fichierDe(RACINE, '/'), RACINE + 'index.html')
  assert.equal(fichierDe(RACINE, '/lib/png.js?v=2'), RACINE + 'lib/png.js')
  assert.equal(fichierDe(RACINE, '/vendor/lexique/mots.txt'), RACINE + 'vendor/lexique/mots.txt')
  for (const a of ['/.git/config', '/.claude/launch.json', '/lib/../.git/HEAD', '/..%2f..%2fetc/passwd', '/%E0%A4%A']) assert.equal(fichierDe(RACINE, a), null, a)
  /* « %2e%2e » se lit « .. » et remonte… jusqu'à la racine, pas plus haut. */
  assert.equal(fichierDe(RACINE, '/%2e%2e/%2e%2e/secret'), RACINE + 'secret')
})

test('le serveur : types, compression, revalidation, 404', async t => {
  const s = serveur(RACINE).listen(0)
  t.after(() => s.close())
  await new Promise(r => s.once('listening', r))
  const base = 'http://localhost:' + s.address().port
  /* fetch décompresse de lui-même : on garde les octets bruts. */
  const brut = (chemin, entetes = {}) => new Promise((ok, ko) => {
    import('node:http').then(({ get }) => get(base + chemin, { headers: entetes }, r => {
      const morceaux = []
      r.on('data', m => morceaux.push(m)).on('end', () => ok({ statut: r.statusCode, entetes: r.headers, corps: Buffer.concat(morceaux) }))
    }).on('error', ko))
  })

  const page = await brut('/')
  assert.equal(page.statut, 200)
  assert.match(page.entetes['content-type'], /^text\/html/)
  assert.equal(page.entetes['cache-control'], 'no-cache')
  /* Isolée : le moteur ONNX calcule sur plusieurs cœurs. */
  assert.equal(page.entetes['cross-origin-opener-policy'], 'same-origin')
  assert.equal(page.entetes['cross-origin-embedder-policy'], 'credentialless')
  assert.equal(page.corps.toString(), await readFile(RACINE + 'index.html', 'utf8'))

  const wasm = await brut('/vendor/ort-wasm-simd-threaded.asyncify.wasm', { 'accept-encoding': 'gzip, br' })
  assert.equal(wasm.entetes['content-type'], 'application/wasm')
  assert.equal(wasm.entetes['content-encoding'], 'gzip')
  assert.ok(wasm.corps.length < 0.5 * 26781914, 'compressé : ' + wasm.corps.length)
  assert.deepEqual(gunzipSync(wasm.corps), await readFile(RACINE + 'vendor/ort-wasm-simd-threaded.asyncify.wasm'))

  /* Un modèle part tel quel. */
  for (const f of ['/vendor/realesr-animevideov3.onnx', '/vendor/ppocrv5-latin-rec.onnx']) {
    const r = await brut(f, { 'accept-encoding': 'gzip' })
    assert.equal(r.entetes['content-encoding'], undefined, f)
    assert.equal(Number(r.entetes['content-length']), r.corps.length)
  }

  const js = await brut('/lib/png.js')
  assert.match(js.entetes['content-type'], /^text\/javascript/)
  /* Compressé ou non, un script le dit : un cache ne rend pas l'un pour l'autre. */
  assert.equal(js.entetes.vary, 'Accept-Encoding')
  assert.equal((await brut('/lib/png.js', { 'if-none-match': js.entetes.etag })).statut, 304)

  assert.equal((await brut('/.git/config')).statut, 404)
  assert.equal((await brut('/rien.html')).statut, 404)
  const dossier = await brut('/lib')
  assert.equal(dossier.statut, 301)
  assert.equal(dossier.entetes.location, '/lib/')
})

test('l\'ETag suit le contenu, pas la date : une mise en ligne ne refait pas partir un modèle', async t => {
  const dossier = await mkdtemp(join(tmpdir(), 'olda-serveur-'))
  t.after(() => rm(dossier, { recursive: true, force: true }))
  const f = join(dossier, 'modele.onnx')
  await writeFile(f, 'les mêmes octets')
  const s = serveur(dossier).listen(0)
  t.after(() => s.close())
  await new Promise(r => s.once('listening', r))
  const etag = async () => {
    const r = await fetch('http://localhost:' + s.address().port + '/modele.onnx')
    await r.arrayBuffer()
    return r.headers.get('etag')
  }
  const avant = await etag()
  await utimes(f, new Date(2030, 0, 1), new Date(2030, 0, 1))
  assert.equal(await etag(), avant, 'même contenu, autre date : même ETag')
  await writeFile(f, 'd\'autres octets')
  assert.notEqual(await etag(), avant, 'autre contenu : autre ETag')
})

/* 2 octobre 2026 : index.html demande d'un coup tous les modules de la page
   (`modulepreload`) — sinon sept niveaux d'imports, sept allers-retours. Un
   module ajouté, retiré ou renommé doit l'être là aussi. */
test('index.html précharge exactement les modules que la page importe', async () => {
  const html = await readFile(join(RACINE, 'index.html'), 'utf8')
  const pre = [...html.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map(m => m[1]).sort()
  const vus = new Set()
  const voir = async f => {
    if (vus.has(f)) return
    vus.add(f)
    const s = await readFile(join(RACINE, f), 'utf8')
    for (const m of s.matchAll(/^import\s[^'"]*['"](\.[^'"]+)['"]/gm)) await voir(join(f, '..', m[1]))
  }
  for (const m of html.match(/<script type="module">[\s\S]*?<\/script>/)[0].matchAll(/import\s[^'"]*['"]\.\/([^'"]+)['"]/g)) await voir(m[1])
  assert.deepEqual(pre, [...vus].sort())
})

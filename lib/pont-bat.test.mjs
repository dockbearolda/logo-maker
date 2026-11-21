import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pontDepuis, piloteDepuis, recevoir, renvoyer, enregistrerMaker } from './pont-bat.js'

const J = 'a'.repeat(32)

test('le pont : un jeton et un BAT admis', () => {
  const p = pontDepuis('https://logo-maker.dockbear.workers.dev/?bat=' + J + '&depuis=' + encodeURIComponent('https://bat-studio.dockbear.workers.dev'))
  assert.deepEqual(p, { jeton: J, api: 'https://bat-studio.dockbear.workers.dev/api/pont/' + J })
  assert.equal(pontDepuis('http://localhost:8080/?bat=' + J + '&depuis=http://localhost:3100/bat/').api, 'http://localhost:3100/bat/api/pont/' + J)
})

test('le pont : rien sans jeton valide, ni vers un autre site', () => {
  assert.equal(pontDepuis('https://x/?depuis=https://bat-studio.dockbear.workers.dev'), null)
  assert.equal(pontDepuis('https://x/?bat=zz&depuis=https://bat-studio.dockbear.workers.dev'), null)
  assert.equal(pontDepuis('https://x/?bat=' + J + '&depuis=https://evil.example'), null)
  assert.equal(pontDepuis('https://x/?bat=' + J + '&depuis=pas-une-adresse'), null)
})

test('le pont : reçoit le logo, renvoie un seul PDF', async () => {
  const avant = globalThis.fetch
  const appels = []
  globalThis.fetch = async (url, o = {}) => {
    appels.push([o.method || 'GET', String(url).split('/').pop(), o.headers && o.headers['X-Nom']])
    if (!o.method) return new Response(new Uint8Array([1, 2]), { headers: { 'X-Nom': encodeURIComponent('WhatsApp é.jpg') } })
    return new Response('{"ok":true}')
  }
  try {
    const p = pontDepuis('https://x/?bat=' + J + '&depuis=https://bat-studio.dockbear.workers.dev')
    const f = await recevoir(p)
    assert.equal(f.name, 'WhatsApp é.jpg')
    assert.equal(f.size, 2)
    await renvoyer(p, { nom: 'logo.pdf', bat: new Uint8Array([1]), rip: new Uint8Array([2]) })
    assert.deepEqual(appels.slice(1).map(a => a.slice(0, 2)), [['PUT', 'bat']])
  } finally { globalThis.fetch = avant }
})

test('le pont : une erreur du BAT se dit', async () => {
  const avant = globalThis.fetch
  globalThis.fetch = async () => new Response('{"error":"Lien expiré"}', { status: 410 })
  try {
    await assert.rejects(recevoir(pontDepuis('https://x/?bat=' + J + '&depuis=https://bat-studio.dockbear.workers.dev')), /Lien expiré/)
  } finally { globalThis.fetch = avant }
})

test('le pilote : seul un BAT admis pilote', () => {
  assert.deepEqual(piloteDepuis('https://x/?pilote=' + encodeURIComponent('https://bat-studio.dockbear.workers.dev/')), { origine: 'https://bat-studio.dockbear.workers.dev' })
  assert.deepEqual(piloteDepuis('https://x/?pilote=http://localhost:3100'), { origine: 'http://localhost:3100' })
  assert.equal(piloteDepuis('https://x/?pilote=https://evil.example'), null)
  assert.equal(piloteDepuis('https://x/?pilote=nimporte'), null)
  assert.equal(piloteDepuis('https://x/'), null)
})

test('le pilote : renvoyer rend les PDF à la page, sans réseau', async () => {
  let recu = null
  await renvoyer({ envoyer: x => { recu = x } }, { nom: 'l.pdf', bat: new Uint8Array([1]) })
  assert.deepEqual(Object.keys(recu), ['nom', 'bat'])
})

test('la disquette range le travail dans -04_MAKER, sans le poser sur le BAT', async () => {
  const avant = globalThis.fetch
  const vus = []
  globalThis.fetch = async (url, o = {}) => { vus.push([url, o.method, o.headers['X-Nom']]); return new Response('{"chemin":"/C/Aloha/Tee - 20-11-2026/-04_MAKER/logo.pdf"}') }
  try {
    const r = await enregistrerMaker({ api: 'https://bat/api/pont/' + 'a'.repeat(32) }, { nom: 'logo é.pdf', octets: new Uint8Array([1]) })
    assert.deepEqual(vus, [['https://bat/api/pont/' + 'a'.repeat(32) + '/maker', 'PUT', encodeURIComponent('logo é.pdf')]])
    assert.match(r.chemin, /-04_MAKER\/logo\.pdf$/)
    globalThis.fetch = async () => new Response('{"error":"Ce BAT n\'a pas encore de dossier Dropbox"}', { status: 409 })
    await assert.rejects(enregistrerMaker({ api: 'https://bat/x' }, { nom: 'a.pdf', octets: new Uint8Array([1]) }), /dossier Dropbox/)
  } finally { globalThis.fetch = avant }
})

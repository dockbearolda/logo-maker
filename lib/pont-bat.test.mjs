import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pontDepuis, recevoir, renvoyer } from './pont-bat.js'

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

test('le pont : reçoit le logo, renvoie le RIP puis le BAT', async () => {
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
    assert.deepEqual(appels.slice(1).map(a => a.slice(0, 2)), [['PUT', 'rip'], ['PUT', 'bat']])
  } finally { globalThis.fetch = avant }
})

test('le pont : une erreur du BAT se dit', async () => {
  const avant = globalThis.fetch
  globalThis.fetch = async () => new Response('{"error":"Lien expiré"}', { status: 410 })
  try {
    await assert.rejects(recevoir(pontDepuis('https://x/?bat=' + J + '&depuis=https://bat-studio.dockbear.workers.dev')), /Lien expiré/)
  } finally { globalThis.fetch = avant }
})

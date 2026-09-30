import { test } from 'node:test'
import assert from 'node:assert/strict'
import { genre, parCmDe, empreinteDe, feuilleHTML, vuesHTML, logoRecadre, RECADRAGES, MENTIONS } from './bat-feuille.js'

const bat = () => ({
  numero: 'BAT-26.09.15-1402.1', date: '15 / 09 / 2026', client: 'Le <Pélican>', projet: 'Tenues',
  ref: 'NS300', nom: 'T-shirt écoresponsable unisexe', genre: 'textile', coloris: 'White', hex: '#ffffff',
  tailles: [{ t: 'S', q: 4 }, { t: 'M', q: 0 }, { t: 'L', q: 6 }],
  vues: [
    { id: 'face', photo: 'https://cdn.toptex.com/packshots/PS_NS300_WHITE.png', logos: [{ id: 'g1', src: 'data:image/png;base64,AAAA', x: 60, y: 30, cm: 9.5 }] },
    { id: 'dos', photo: 'https://cdn.toptex.com/packshots/PS_NS300-B_WHITE.png', logos: [] },
  ],
})

test('le genre se lit dans le nom de l\'article', () => {
  assert.equal(genre('Sac cabas en coton bio'), 'sac')
  assert.equal(genre('Casquette 5 panneaux Ultimate'), 'casquette')
  assert.equal(genre('T-shirt col V manches courtes homme'), 'textile')
})

test('un centimètre vaut une part positive du cadre, plus grande sur un sac que sur un t-shirt', () => {
  assert.ok(parCmDe('textile', 'face') > 0)
  assert.ok(parCmDe('casquette', 'face') > parCmDe('textile', 'face'))
})

test('l\'empreinte change quand un logo bouge, pas quand on relit', () => {
  const a = bat()
  assert.equal(empreinteDe(a), empreinteDe(bat()))
  const b = bat()
  b.vues[0].logos[0].x = 61
  assert.notEqual(empreinteDe(a), empreinteDe(b))
  const c = bat()
  c.tailles[0].q = 5
  assert.notEqual(empreinteDe(a), empreinteDe(c))
})

test('la feuille met le produit en avant et ne demande aucune signature', () => {
  const html = feuilleHTML(bat())
  assert.match(html, /BAT-26\.09\.15-1402\.1/)
  assert.match(html, /Le &lt;Pélican&gt;/)
  assert.doesNotMatch(html, /Signature/i)
  assert.match(MENTIONS, /validation en ligne/)
  /* Les tailles à zéro ne s'écrivent pas ; le total, si. */
  assert.doesNotMatch(html, /<small>M<\/small>/)
  assert.match(html, /<small>Total<\/small><b>10<\/b>/)
  /* Épurée le 23 septembre 2026 : ni date, ni « Pour », ni colonne des
     marquages, ni cadre « Validation » tant que le client n'a rien dit. */
  assert.doesNotMatch(html, /15 \/ 09 \/ 2026|>Pour<|Marquages|Aucun logo posé|En ligne, par le client/)
})

test('la validation du client s\'écrit sur la feuille', () => {
  assert.match(feuilleHTML(bat(), { validation: { decision: 'valide', quand: '15 sept. à 14:02' } }), /Validé en ligne.*15 sept\. à 14:02/)
  assert.match(feuilleHTML(bat(), { validation: { decision: 'correction', quand: 'hier' } }), /Correction demandée/)
})

test('seul l\'atelier voit les poignées ; le client voit la feuille nue', () => {
  const atelier = feuilleHTML(bat(), { edition: true, cle: 'a1|l1' })
  assert.match(atelier, /class="feuille edition"/)
  assert.match(atelier, /poignee/)
  assert.match(atelier, /Cliquer pour poser un logo/)
  const client = vuesHTML(bat(), { autonome: true })
  assert.doesNotMatch(client, /poignee|retirer-logo|Cliquer pour poser/)
  assert.match(client, /aspect-ratio/)
})

/* La largeur DTF lue sous une quantité ne change pas ce que le client valide :
   un BAT déjà envoyé ne passe pas « à renvoyer » pour elle. */
test('la largeur du DTF dos ne change ni l\'empreinte, et s\'écrit sous la quantité', () => {
  const bat = { ref: 'NS300', coloris: 'Noir', tailles: [{ t: 'M', q: 3 }], vues: [] }
  const avec = Object.assign({}, bat, { tailles: [{ t: 'M', q: 3, dos: '28' }] })
  assert.equal(empreinteDe(avec), empreinteDe(bat))
  assert.match(feuilleHTML(avec), /<b>3<\/b><i>dos 28 mm<\/i>/)
  assert.doesNotMatch(feuilleHTML(bat), /dos \d+ mm/)
})

/* CHAQUE PHOTO SON CADRE (23 septembre 2026) : la vue qui en porte un le
   dessine ; celle d'avant garde la fenêtre fixe, et le client voit ses
   logos où il les a validés. */
test('la vue dessine son cadre ; sans cadre, la fenêtre fixe de son genre', () => {
  const avec = bat()
  avec.vues[0].recadrage = { x: 0, y: 10, w: 100, h: 80, p: 0.6664 }
  assert.match(feuilleHTML(avec), /style="width:100%;height:125%;left:0%;top:-12\.5%"/)
  assert.match(feuilleHTML(avec), /data-recadrage="100 80 0\.6664"/)
  const r = RECADRAGES.textile
  assert.match(feuilleHTML(bat()), new RegExp('data-recadrage="' + r.w + ' ' + r.h + ' 0"'))
  /* Un centimètre pèse moins dans un cadre plus large. */
  assert.ok(parCmDe('textile', 'face', { w: 100 }) < parCmDe('textile', 'face'))
})

test('un logo garde sa place sur le vêtement quand le cadre change', () => {
  const de = RECADRAGES.textile
  const vers = { x: 0, y: 10, w: 100, h: 80 }
  const l = logoRecadre({ id: 'g1', x: 50, y: 25, cm: 9.5 }, de, vers)
  /* Au milieu en largeur (50 % de la photo), à 16 + 0,25 × 70 = 33,5 % de
     sa hauteur, soit (33,5 − 10) / 80 du nouveau cadre. */
  assert.deepEqual(l, { id: 'g1', x: 50, y: 29.375, cm: 9.5 })
  const retour = logoRecadre(l, vers, de)
  assert.ok(Math.abs(retour.x - 50) < 1e-6 && Math.abs(retour.y - 25) < 1e-6)
})

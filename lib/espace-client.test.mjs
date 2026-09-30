/* Le seul calcul de ce module qu'un œil ne relit pas d'un coup : la table des
   indicatifs. Un lien wa.me faux ne se voit qu'au bout de la chaîne — chez le
   client qui ne reçoit rien — donc il se vérifie ici, en une seconde.
   `node --test`, sans rien à installer. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nettoyerTel, construireFeuille, texteEnvoi } from './espace-client.js'

test('un numéro déjà international perd son « + » et ses espaces', () => {
  assert.equal(nettoyerTel('+590 690 11 22 33'), '590690112233')
  assert.equal(nettoyerTel('00590690112233'), '590690112233')
  assert.equal(nettoyerTel('590690112233'), '590690112233')
})

test('un mobile des Antilles prend le 590 à la place de son zéro', () => {
  assert.equal(nettoyerTel('06 90 38 27 69'), '590690382769')
  assert.equal(nettoyerTel('0691234567'), '590691234567')
})

test('un fixe des Antilles répète son indicatif', () => {
  assert.equal(nettoyerTel('05 90 47 97 88'), '590590479788')
})

test('les autres outre-mer ont chacun le leur', () => {
  assert.equal(nettoyerTel('0696123456'), '596696123456')
  assert.equal(nettoyerTel('0694123456'), '594694123456')
  assert.equal(nettoyerTel('0692123456'), '262692123456')
})

test('un mobile de métropole prend le 33', () => {
  assert.equal(nettoyerTel('0768536034'), '33768536034')
  assert.equal(nettoyerTel('06 42 26 69 49'), '33642266949')
  assert.equal(nettoyerTel('01.42.26.69.49'), '33142266949')
})

test('ce qui n\'est pas reconnu n\'est pas inventé', () => {
  assert.equal(nettoyerTel(''), '')
  assert.equal(nettoyerTel(null), '')
  assert.equal(nettoyerTel('690382769'), '690382769')
  assert.equal(nettoyerTel('06 90 38'), '069038')
})

test('l\'ajout libre imprime sa description sous son intitulé', () => {
  const html = construireFeuille({ lignes: [
    { designation: 'Gravure sur miroir', detail: 'Miroir non fourni, photo fournie par le client', qte: '1', pu: '80,00 €', total: '80,00 €' },
    { designation: 'T-shirt · M', detail: '', qte: '2', pu: '35,00 €', total: '70,00 €' },
  ] })
  assert.match(html, /Gravure sur miroir<\/div><div class="fe__art-d">Miroir non fourni, photo fournie par le client<\/div><\/td>/)
  /* Une ligne sans description n'imprime pas de ligne vide. */
  assert.match(html, /T-shirt · M<\/div><\/td>/)
})

test('la description s\'imprime échappée', () => {
  const html = construireFeuille({ lignes: [{ designation: 'Plaque', detail: '<b>bois</b> & métal', qte: '1', pu: '', total: '' }] })
  assert.ok(html.includes('&lt;b&gt;bois&lt;/b&gt; &amp; métal'))
})

test('la feuille imprime l\'adresse de la fiche quand elle existe', () => {
  assert.match(construireFeuille({ clientNom: 'LAGON', clientAdresse: 'Baie Orientale' }), /<div class="fe__muted">Baie Orientale<\/div>/)
  assert.doesNotMatch(construireFeuille({ clientNom: 'LAGON' }), /Baie Orientale/)
})

test('la feuille à télécharger ne lance pas l\'impression', () => {
  assert.match(construireFeuille({ titre: 'Devis' }), /print\(\)/)
  assert.doesNotMatch(construireFeuille({ titre: 'Devis' }, { imprimer: false }), /<script/)
})

/* LA FEUILLE DU 23 SEPTEMBRE 2026 (maquette « top999 ») : devis, proforma et
   facture partagent la même mise en page. */
test('la quantité ouvre la ligne, en gras, avant la désignation', () => {
  const html = construireFeuille({ lignes: [{ designation: 'NS300 · M', qte: '2', pu: '18,27 €', total: '36,54 €' }] })
  assert.match(html, /<th class="fe__c-qte">Qté<\/th><th>Désignation<\/th>/)
  assert.match(html, /<tr><td class="fe__qte">2<\/td><td><div class="fe__art">NS300 · M<\/div>/)
})

test('les étapes se numérotent sous « Prochaines étapes », les autres notes non', () => {
  const cadres = [{ titre: '', geant: '', texte: 'Un bon à tirer vous est envoyé.' }, { titre: '', geant: '', texte: 'Délai confirmé.' }]
  const etapes = construireFeuille({ cadres, etapes: true })
  assert.match(etapes, /Prochaines étapes/)
  assert.match(etapes, /<span class="fe__rang">2<\/span><span>Délai confirmé.<\/span>/)
  const notes = construireFeuille({ cadres })
  assert.doesNotMatch(notes, /Prochaines étapes|class="fe__rang"/)
})

test('le règlement rappelle la référence du virement, en face du solde', () => {
  const html = construireFeuille({ reglementVisible: true, acompteK: 'Acompte reçu', acompteV: '25,00 €', solde: 'Solde de 53,00 €',
    reglementK: 'Virement', iban: 'FR76', bic: 'BIC X', reference: 'Merci d\'indiquer PRO-1 en référence.' })
  /* Quatre cellules par colonne, même vides : les lignes se répondent. */
  assert.match(html, /<div class="fe__muted"><\/div><div class="fe__muted">Solde de 53,00 €<\/div><\/div><div>/)
  assert.match(html, /<div class="fe__muted">Merci d'indiquer PRO-1 en référence.<\/div><\/div><\/div>/)
})

test('la page du client lit ce qui est rentré, sans la référence', async () => {
  const { reglementPourClient } = await import('./espace-client.js')
  assert.equal(reglementPourClient({}, 'd1', 120), null)
  assert.equal(reglementPourClient({ acomptes: { d1: null } }, 'd1', 120), null)
  assert.deepEqual(reglementPourClient({ acomptes: { d1: { montant: 60, moyen: 'Carte', reference: 'T-42' } } }, 'd1', 120), { recu: 60, reste: 60 })
  assert.deepEqual(reglementPourClient({ acomptes: { d1: { montant: 60 } }, soldes: { d1: { montant: 60 } } }, 'd1', 120), { recu: 120, reste: 0 })
})

/* UN DEVIS À OPTIONS DIT SES PRIX dans le message : le client compare avant
   même d'ouvrir le lien, et sait qu'il n'a qu'à choisir. */
test('le message d\'un devis à options annonce chaque prix', () => {
  const lien = 'https://olda.example/e/abc'
  assert.equal(texteEnvoi({ nature: 'Devis', montant: '158,12 €', lien }), 'Atelier OLDA SARL — Devis 158,12 € — ' + lien)
  const choix = [{ lettre: 'A', montant: '158,12 €' }, { lettre: 'B', montant: '204,36 €' }]
  const texte = texteEnvoi({ nature: 'Devis', montant: '204,36 €', lien, choix })
  assert.match(texte, /2 propositions au choix : A 158,12 € · B 204,36 €/)
  assert.match(texte, /Choisissez la vôtre/)
  assert.ok(texte.endsWith(lien))
  /* Une seule option encore en lice : le message d'un devis simple. */
  assert.equal(texteEnvoi({ nature: 'Devis', montant: '158,12 €', lien, choix: choix.slice(0, 1) }), 'Atelier OLDA SARL — Devis 158,12 € — ' + lien)
})

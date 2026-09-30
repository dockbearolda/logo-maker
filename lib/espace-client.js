/* ========================================================== L'ESPACE CLIENT
   Ce que l'atelier et la page du client partagent : l'identité imprimée sur
   un papier, le texte court qui accompagne un lien, et la feuille A4 qu'on
   imprime — des deux côtés, LA MÊME feuille. Rien ici ne touche au cahier
   (`lib/etat.js`) ni aux lectures de dossier (`lib/dossiers.js`) : ce module
   ne fait que présenter et communiquer, jamais persister. */

/* L'atelier tel qu'il figure sur ses papiers — repris à l'identique des
   modèles devisvierge.html, facturevierge.html et de la feuille du comptoir.
   Un numéro de SIRET recopié à quatre endroits reste UNE valeur : c'est le
   texte qui se répète, pas la source. */
export const ATELIER = {
  nom: 'Atelier OLDA SARL',
  lignes: [
    '1 rue Opale, Route de l\'Espérance',
    '97150 Grand-Case, Saint-Martin',
    '06 90 47 97 88',
    'atelierolda@gmail.com',
  ],
  pied: 'SIRET 978 296 952 00028 · APE 1813Z · RCS Saint-Martin · TVA FR86978296952 · Capital 500,00 €',
}

/* LE LOGO DE L'ATELIER (23 septembre 2026), sur tout ce qui part chez le
   client : devis, facture, BAT, sa page. EN LIGNE ET PAS EN <img> : la
   feuille imprimable s'ouvre d'un blob, où un chemin ne se résout pas, et la
   page du client passe avant le mot de passe, où un fichier de l'atelier
   rend 401. Il prend la couleur du texte qui l'entoure (`currentColor`).
   `olda.svg` et `favicon.svg`, pour les pages de l'atelier, portent le même
   tracé — lib/logo-olda.test.mjs y veille. */
export const LOGO_OLDA = '<svg viewBox="56 65 170 180" role="img" aria-label="OLDA" fill="currentColor">'
  + '<path d="M187.85,114.63h33.12c.82,0,1.48.66,1.48,1.48v34.05c0,.82-.66,1.48-1.48,1.48h-73.22c-.82,0-1.48-.66-1.48-1.48v-76.52c0-.82.66-1.48,1.48-1.48h37.15c.82,0,1.48.66,1.48,1.48v39.51c0,.82.66,1.48,1.48,1.48Z"/>'
  + '<path d="M141.24,238.96l41.28-77.18c.58-1.05,2.09-1.05,2.67,0l41.39,77.18c.56,1.02-.18,2.26-1.34,2.26h-82.67c-1.16,0-1.89-1.24-1.34-2.26Z"/>'
  + '<path d="M101.44,161.74h-2.56l.48,79.48h1.16c20.68,0,38.61-15.44,40.49-36.03,2.14-23.57-16.43-43.44-39.57-43.44Z"/>'
  + '<path d="M95.36,161.74h-32.71c-.82,0-1.48.66-1.48,1.48v76.52c0,.82.66,1.48,1.48,1.48h32.26l.45-79.48Z"/>'
  + '<path d="M140.12,108.5c-1.61-20.24-18-36.63-38.24-38.24-25.72-2.04-47.09,19.32-45.05,45.04,1.6,20.24,18,36.64,38.24,38.25.12,0,.23,0,.34.02l.23-39.79v-.05l-11.32,11.07s-1.19-11.25,6.13-12.84h-13s4.12-7.32,14.54-4.85l-7.67-7.67s11.86-1.72,12.82,6.62c1.07-8.9,12.54-6.48,12.54-6.48l-7.92,8.04c8.81-3.63,14.91,4.33,14.91,4.33h-13.05c4.85,1.4,6.01,6.08,6.2,9.41.14,2.05-.12,3.59-.12,3.59l-3.54-3.59-7.55-7.62.24,39.91c24-.2,43.23-20.71,41.29-45.17Z"/>'
  + '</svg>'

/* L'ICÔNE DE L'ONGLET de la page du client : le même logo, foncé sur un carré
   blanc arrondi — il se lit sur une barre d'onglets claire comme sombre. En
   data URL, pour la même raison que le logo est en ligne. */
export const ICONE_OLDA = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" style="color:#1c1c1a">'
  + '<rect width="32" height="32" rx="6.4" fill="#fff"/>'
  + LOGO_OLDA.replace('<svg ', '<svg x="4.4" y="3.5" width="23.2" height="25" ')
  + '</svg>')

/* -------------------------------------------------------------- LE TÉLÉPHONE
   WA.ME NE CONNAÎT QUE L'INTERNATIONAL. Il ne veut ni espace ni « + », et
   surtout PAS le zéro de tête d'un numéro local : « 0690 38 27 69 » envoyé
   tel quel donne un lien que WhatsApp refuse — la fenêtre s'ouvre sur
   « numéro invalide » et le client ne reçoit rien. Or une fiche d'atelier
   porte le numéro comme on le compose ici : c'est donc à ce module de le
   remettre en international avant d'en faire un lien.
   Le zéro tombe, l'indicatif du pays le remplace. */

/* Les quatre premiers chiffres du numéro local disent l'outre-mer —
   « 0690 » un mobile de Saint-Martin, « 0590 » un fixe. Tout le reste
   (01 à 05, 06, 07, 09) est métropolitain, donc +33.
   L'ANTILLE RÉPÈTE SON INDICATIF : 0590 47 97 88 s'écrit +590 590 47 97 88.
   Ce n'est pas une faute de recopie, c'est le plan de numérotation. */
const INDICATIFS = {
  '0590': '590', '0690': '590', '0691': '590', /* Guadeloupe, St-Martin, St-Barth */
  '0596': '596', '0696': '596', '0697': '596', /* Martinique */
  '0594': '594', '0694': '594',                /* Guyane */
  '0262': '262', '0692': '262', '0693': '262', /* Réunion, Mayotte */
}

export function nettoyerTel(tel) {
  const brut = String(tel || '').trim()
  /* Points, tirets, parenthèses : une fiche saisie à la main en porte, et
     aucun n'a de sens dans une URL. Seuls les chiffres comptent. */
  const chiffres = brut.replace(/\D/g, '')
  if (!chiffres) return ''
  /* Déjà international : le « + » ou le « 00 » le disent, il n'y a rien à
     deviner. */
  if (brut.startsWith('+')) return chiffres
  if (chiffres.startsWith('00')) return chiffres.slice(2)
  /* Local français : dix chiffres qui commencent par zéro. En dehors de ce
     compte exact on ne touche à rien — mieux vaut un numéro rendu tel quel
     qu'un indicatif inventé devant un numéro qu'on n'a pas reconnu. */
  if (chiffres.length === 10 && chiffres.startsWith('0')) {
    return (INDICATIFS[chiffres.slice(0, 4)] || '33') + chiffres.slice(1)
  }
  return chiffres
}

/* ------------------------------------------------------------ LE TEXTE COURT
   Atelier, nature du document, montant s'il y en a un, lien — rien de plus.
   Un BAT ne porte pas de montant : il ne prétend pas en avoir un.
   UN DEVIS À OPTIONS DIT SES PRIX, et qu'il n'y a qu'à choisir : `choix`,
   les options encore en lice — [{ lettre, montant }] —, remplace le montant
   seul d'une option qui n'en dit qu'une. */
export function texteEnvoi({ nature, montant, lien, choix }) {
  const milieu = choix && choix.length > 1
    ? choix.length + ' propositions au choix : ' + choix.map(o => o.lettre + ' ' + o.montant).join(' · ') + '. Choisissez la vôtre sur le lien'
    : montant ? nature + ' ' + montant : nature
  return [ATELIER.nom, milieu, lien].filter(Boolean).join(' — ')
}

/* CE QUE LE CLIENT A DÉJÀ RÉGLÉ, pour sa page : ce qui est rentré et ce qui
   reste, lus sur le cahier — l'acompte et le solde notés au comptoir. Jamais
   la référence du paiement : c'est la preuve de l'atelier, pas une ligne pour
   le client. null quand rien n'est rentré. */
export function reglementPourClient(etat, id, ttc) {
  const verse = x => (x && Number(x.montant)) || 0
  const cents = n => Math.round(n * 100) / 100
  const recu = cents(verse(((etat && etat.acomptes) || {})[id]) + verse(((etat && etat.soldes) || {})[id]))
  if (!(recu > 0)) return null
  return { recu, reste: cents(Math.max(0, (Number(ttc) || 0) - recu)) }
}

/* L'ACCEPTATION VAUT-ELLE POUR CE DEVIS ? Elle porte le numéro du devis que
   le client a vu (22 septembre 2026, au soir) : corrigé en V2, le devis se
   revalide — celle de la V1 ne dit rien de la V2. Une acceptation d'avant la
   règle, sans numéro, ne vaut que pour la première version. La page du
   client, le serveur et la veille du comptoir lisent cette règle, et aucune
   autre. */
export function acceptationVaut(acceptation, numero) {
  if (!acceptation) return false
  if (acceptation.numero) return acceptation.numero === numero
  return !/-V\d+$/.test(String(numero || ''))
}

/* ---------------------------------------------------------------- LES DATES
   Le format que la page du client et le statut atelier se partagent :
   « 9 sept. à 14h32 ». `Intl` porte les mois français nativement dès Node 20
   — la table de mois de lib/dates.js ne se recopie pas ici. */
export function formatHoraire(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const jour = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return jour + ' à ' + heure.replace(':', 'h')
}

/* ============================================================= LA FEUILLE A4
   CE QUI S'IMPRIME, ET RIEN D'AUTRE AUTOUR. Le comptoir et la page du client
   appellent tous deux cette fonction pour la même raison : une feuille A4
   dessinée une fois, jamais recopiée. Elle rend un document HTML complet,
   prêt pour une fenêtre d'impression — jamais injectée dans une page que
   React tient déjà, ce qui la casserait.
   Chaque champ est une CHAÎNE DÉJÀ MISE EN FORME : cette fonction ne calcule
   rien, elle pose ce qu'on lui donne. `totaux`, `cadres` et `reglementVisible`
   sont optionnels — une pièce plus simple (le dossier vu depuis la page du
   client, par exemple, qui n'a qu'un montant global) les laisse vides et la
   feuille s'imprime quand même, sans bloc creux. */
/* LE TITRE SE LIT, IL NE CRIE PAS : « Devis », pas « DEVIS ». Un appelant
   qui passe encore des capitales est ramené à la casse d'une phrase. */
const titreLisible = t => (t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t)

/* `imprimer: false` rend la même page sans lancer l'impression à
   l'ouverture : c'est le fichier qu'on télécharge. */
export function construireFeuille(feuille, { imprimer = true } = {}) {
  const f = Object.assign({
    titre: 'Document', numero: '', dateLigne: '', clientNom: '', clientTel: '', clientAdresse: '',
    projet: '', teteDesignation: 'Désignation', teteQte: 'Qté', tetePu: 'PU HT', teteTotal: 'Total HT',
    lignes: [], totaux: [], grandK: '', grandV: '',
    cadres: [], etapes: false, reglementVisible: false, reglementK: '', iban: '', bic: '', reference: '',
    acompteK: '', acompteV: '', acompteNote: '', solde: '',
    signature: '', mentions: '',
  }, feuille)

  const echap = v => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  /* Un champ vide ou « — » ne s'imprime pas : pas de ligne creuse. */
  const plein = v => !!v && v !== '—'
  const si = (v, html) => (plein(v) ? html : '')

  const titre = titreLisible(f.titre)
  /* La ligne de contact réécrite sur le devis passe telle quelle. */
  const clientLigne = typeof f.clientLigne === 'string' ? f.clientLigne
    : [f.clientTel, plein(f.projet) ? 'Réf. ' + f.projet : ''].filter(plein).join(' · ')
  const [rue, ville, ...contact] = ATELIER.lignes

  /* LA QUANTITÉ D'ABORD, EN GRAS (23 septembre 2026, maquette « top999 ») :
     on lit « 2 », puis ce que c'est, puis ce que ça coûte. */
  const lignesHTML = f.lignes.map(l => (
    '<tr><td class="fe__qte">' + echap(l.qte) + '</td>'
    + '<td><div class="fe__art">' + echap(l.designation) + '</div>'
    + (l.detail ? '<div class="fe__art-d">' + echap(l.detail) + '</div>' : '') + '</td>'
    + '<td class="fe__n">' + echap(l.pu) + '</td>'
    + '<td class="fe__n">' + echap(l.total) + '</td></tr>'
  )).join('')

  const totauxHTML = f.totaux.map(t => (
    '<div class="fe__ligne fe__muted"><span>' + echap(t.libelle) + '</span><span>' + echap(t.valeur) + '</span></div>'
  )).join('')

  /* UN CADRE N'A PLUS DE BOÎTE : une phrase, et son titre seulement quand il
     porte une date ou un montant à lire (l'échéance, l'avoir). Les papiers
     qui annoncent la suite (devis, proforma) la numérotent, sous « Prochaines
     étapes ». */
  const etapes = f.etapes && f.cadres.length > 0
  const notesHTML = (etapes ? '<div class="fe__cap">Prochaines étapes</div>' : '') + f.cadres.map((c, i) => (c.geant
    ? '<div class="fe__bloc"><div class="fe__cap">' + echap(c.titre) + '</div><div class="fe__fort">' + echap(c.geant) + '</div>'
      + si(c.texte, '<div>' + echap(c.texte) + '</div>') + '</div>'
    : etapes ? '<div class="fe__etape"><span class="fe__rang">' + (i + 1) + '</span><span>' + echap(c.texte) + '</span></div>'
    : '<div>' + echap(c.texte) + '</div>'
  )).join('')

  /* LE RÈGLEMENT, EN DEUX COLONNES DONT LES LIGNES SE RÉPONDENT : l'acompte
     en face du nom de la banque, le montant en face de l'IBAN, le solde en
     face de la référence à rappeler. Une ligne absente garde sa place. */
  const cellule = (classe, v) => '<div class="' + classe + '">' + echap(v) + '</div>'
  const reglementHTML = !f.reglementVisible ? '' : (
    '<div class="fe__pay"><div>'
    + cellule('fe__cap', f.acompteK) + cellule('fe__gros', f.acompteV)
    + cellule('fe__muted', f.acompteNote) + cellule('fe__muted', f.solde)
    + '</div><div>'
    + cellule('fe__cap', f.reglementK) + cellule('fe__mono', f.iban)
    + cellule('fe__mono', f.bic) + cellule('fe__muted', f.reference)
    + '</div></div>'
  )

  const basHTML = !notesHTML && !f.signature ? '' : (
    '<div class="fe__bas"><div class="fe__notes fe__muted">' + notesHTML + '</div>'
    + (f.signature ? '<div class="fe__accord"><div class="fe__cap">' + echap(f.signature) + '</div>'
      + '<div class="fe__signature">Date, nom et signature</div></div>' : '<div></div>')
    + '</div>'
  )

  return '<!doctype html><html lang="fr"><head><meta charset="utf-8">'
    + '<title>' + echap(titre) + ' ' + echap(f.numero) + ' — ' + echap(ATELIER.nom) + '</title>'
    + '<style>'
    + '*{box-sizing:border-box}@page{size:A4;margin:0}html,body{margin:0;padding:0;background:#ecebe8}'
    + 'body{padding:24px 0;font:9.5pt/1.5 "Helvetica Neue",Helvetica,Arial,sans-serif;color:#1c1c1a;font-variant-numeric:tabular-nums}'
    + '.fe{width:210mm;min-height:297mm;margin:0 auto;background:#fff;box-shadow:0 2px 20px rgba(0,0,0,.1);padding:16mm 20mm 12mm;display:flex;flex-direction:column}'
    + '.fe__muted{color:#6b6b66}.fe__cap{font-size:7.5pt;letter-spacing:.12em;text-transform:uppercase;color:#6b6b66}'
    + '.fe__fort{font-size:11pt;font-weight:700}.fe__bloc{display:flex;flex-direction:column;gap:1px}'
    + '.fe__tete{display:flex;justify-content:space-between;align-items:flex-start;gap:10mm}.fe__ref{text-align:right;flex:none}'
    + '.fe__logo{margin-bottom:3mm}.fe__logo svg{display:block;width:13.2mm;height:14mm}'
    + '.fe__titre{font-size:24pt;font-weight:300;letter-spacing:.02em;line-height:1}.fe__num{margin-top:8px;font-weight:600}'
    + '.fe__client{margin-top:10mm}'
    + 'table{margin-top:9mm;width:100%;border-collapse:collapse}'
    + 'th{font-weight:400;padding:0 0 8px;border-bottom:1px solid #1c1c1a;text-align:left}'
    + 'td{padding:10px 0;border-bottom:1px solid #e4e3df;vertical-align:top}th+th,td+td{padding-left:12px}'
    + '.fe__n{text-align:right;white-space:nowrap}th.fe__n{text-align:right}'
    + '.fe__qte{font-weight:600}.fe__c-qte{width:50px}.fe__c-pu{width:80px}.fe__c-tot{width:85px}tr{break-inside:avoid}'
    + '.fe__art-d{color:#6b6b66}'
    + '.fe__totaux{margin-top:8mm;margin-left:auto;width:72mm;display:flex;flex-direction:column;gap:4px}'
    + '.fe__ligne{display:flex;justify-content:space-between;align-items:baseline;gap:12px}'
    + '.fe__ttc{margin-top:6px;padding-top:10px;border-top:1px solid #1c1c1a;font-weight:700}'
    + '.fe__gros{font-size:16pt;font-weight:700}'
    + '.fe__pay{margin-top:9mm;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:repeat(4,auto);grid-auto-flow:column;column-gap:10mm;row-gap:2px;align-items:baseline;padding:7mm 0;border-top:1px solid #e4e3df;border-bottom:1px solid #e4e3df}'
    + '.fe__pay>div{display:contents}.fe__accord{display:flex;flex-direction:column;gap:2px}'
    + '.fe__mono{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:8.5pt;overflow-wrap:anywhere}'
    + '.fe__bas{margin-top:7mm;display:grid;grid-template-columns:1fr 1fr;gap:10mm}.fe__notes{display:flex;flex-direction:column;gap:6px}'
    + '.fe__etape{display:flex;gap:10px;align-items:baseline}.fe__rang{min-width:10px;font-weight:700;color:#1c1c1a}'
    + '.fe__signature{height:24mm;border:1px solid #e4e3df;border-radius:2px;padding:6px 8px;color:#a8a7a1;font-size:8pt;margin-top:2px}'
    + '.fe__mentions{margin-top:7mm;color:#6b6b66;font-size:8pt}'
    + '.fe__pied{margin-top:auto;padding-top:8mm;text-align:center;font-size:7.5pt;color:#8a8984}'
    + '@media print{body{background:#fff;padding:0}.fe{box-shadow:none}}'
    + '</style></head><body>'
    + '<div class="fe">'
    + '<div class="fe__tete"><div class="fe__bloc"><div class="fe__logo">' + LOGO_OLDA + '</div><div class="fe__fort">' + echap(ATELIER.nom) + '</div>'
    + '<div class="fe__muted">' + [rue, ville, contact.join(' · ')].filter(Boolean).map(echap).join('<br>') + '</div></div>'
    + '<div class="fe__ref"><div class="fe__titre">' + echap(titre) + '</div>'
    + '<div class="fe__num">' + (echap(f.numero) || '________') + '</div>'
    + si(f.dateLigne, '<div class="fe__muted">' + echap(f.dateLigne) + '</div>') + '</div></div>'
    + '<div class="fe__bloc fe__client"><div class="fe__cap">Client</div>'
    + '<div class="fe__fort">' + echap(f.clientNom) + '</div>'
    + si(clientLigne, '<div class="fe__muted">' + echap(clientLigne) + '</div>')
    + si(f.clientAdresse, '<div class="fe__muted">' + echap(f.clientAdresse) + '</div>')
    + '</div>'
    + (f.lignes.length ? (
      '<table><thead><tr class="fe__cap"><th class="fe__c-qte">' + echap(f.teteQte) + '</th>'
      + '<th>' + echap(f.teteDesignation) + '</th>'
      + '<th class="fe__n fe__c-pu">' + echap(f.tetePu) + '</th>'
      + '<th class="fe__n fe__c-tot">' + echap(f.teteTotal) + '</th></tr></thead>'
      + '<tbody>' + lignesHTML + '</tbody></table>'
    ) : '')
    + '<div class="fe__totaux">' + totauxHTML
    + '<div class="fe__ligne fe__ttc"><span>' + echap(f.grandK) + '</span><span class="fe__gros">' + echap(f.grandV) + '</span></div></div>'
    + reglementHTML
    + basHTML
    + si(f.mentions, '<div class="fe__mentions">' + echap(f.mentions) + '</div>')
    + '<div class="fe__pied">' + echap(ATELIER.pied) + '</div>'
    + '</div>'
    + (imprimer ? '<script>addEventListener("load",()=>{try{print()}catch(e){}})</script>' : '')
    + '</body></html>'
}

/* --------------------------------------------------------------- WHATSAPP
   Le lien de wa.me ne se connaît qu'après un aller-retour réseau (créer ou
   relire le jeton du dossier) — mais une fenêtre ouverte APRÈS cet
   aller-retour arrive trop tard : le navigateur ne la distingue plus d'une
   publicité et la bloque. On l'ouvre donc tout de suite, vide, dans le
   geste du clic, et on ne fait que la POINTER une fois le lien connu. */
export function fenetreEnAttente() {
  const fenetre = window.open('', '_blank')
  return {
    /* Un bloqueur de pop-up rend `null` sans le dire nulle part ailleurs :
       l'appelant doit pouvoir le SAVOIR, pas annoncer un envoi qui n'a
       ouvert aucune fenêtre. */
    ouverte: !!fenetre,
    vers(url) { if (fenetre) fenetre.location.href = url },
    fermer() { if (fenetre) fenetre.close() },
  }
}

/* Ouvre la feuille dans une fenêtre neuve et lance l'impression. Une fenêtre
   à part, jamais une injection dans la page qui appelle : le comptoir est
   tenu par React, et une page qui écrit dans son DOM par-dessous le casse au
   prochain rendu.
   PAR L'URL D'UN BLOB, PAS PAR `document.write` : la fenêtre navigue vers un
   document déjà complet plutôt que de le recevoir en deux temps. Appelée
   SYNCHRONE, dans le geste du clic — sinon le navigateur la prend pour une
   pub et la bloque. */
/* TÉLÉCHARGER LA FEUILLE : la page A4 en un seul fichier HTML, styles
   compris, nommée d'après le papier — « Devis DEV-26.09.23-001.html ». Elle
   s'ouvre dans n'importe quel navigateur et s'y imprime en PDF. */
export function telechargerFeuille(feuille) {
  const nom = [titreLisible(feuille.titre || 'Document'), feuille.numero].filter(Boolean).join(' ')
    .replace(/[\\/:*?"<>|]/g, '-') + '.html'
  const url = URL.createObjectURL(new Blob([construireFeuille(feuille, { imprimer: false })], { type: 'text/html' }))
  const lien = Object.assign(document.createElement('a'), { href: url, download: nom })
  document.body.appendChild(lien)
  lien.click()
  lien.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
  return nom
}

export function imprimerFeuille(feuille) {
  const jeton = new Blob([construireFeuille(feuille)], { type: 'text/html' })
  const url = URL.createObjectURL(jeton)
  const fenetre = window.open(url, '_blank')
  if (!fenetre) { URL.revokeObjectURL(url); return false }
  setTimeout(() => URL.revokeObjectURL(url), 60000)
  return true
}

/* ======================================================== LA VALIDATION
   CE QUE LE CLIENT VIENT DE FAIRE, SUR UNE PAGE À SOI (24 septembre 2026,
   Charlie : « lorsqu'on valide ça marche mais ça saute et remonte en haut de
   la page — je veux une validation haut de gamme et professionnelle »). La
   page du dossier perdait d'un coup ses options et sa barre : le navigateur
   recalait le défilement où il pouvait, l'annonce passait en haut, le client
   ne savait plus où il était. Désormais le geste finit sur un écran blanc —
   la coche verte qui se trace, ce qui a été fait, ce qui vient ensuite, le
   reçu en deux ou trois rangs — et un seul bouton, là où était celui qu'il
   vient de toucher. Pendant ce temps, la page se repeint DERRIÈRE, et
   `surFermer` la place (en haut, sur l'article suivant) avant qu'elle
   réapparaisse : rien ne bouge sous les yeux du client.
   Les deux pages du client (espace/dossier.html, espace/bat.html) portent les
   mêmes jetons de couleur ; ce style s'y ajoute tel quel. */
export const STYLE_VALIDATION = `
  html.validation-ouverte { overflow: hidden }
  .validation { position: fixed; inset: 0; z-index: 30; overflow-y: auto; background: #fff; opacity: 0; transition: opacity .28s ease }
  .validation--visible { opacity: 1 }
  .validation__corps { max-width: 520px; min-height: 100%; margin: 0 auto; display: flex; flex-direction: column; padding: max(24px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right)) 0 max(24px, env(safe-area-inset-left)) }
  .validation__marque { display: flex; height: 44px; padding: 0 4px; color: var(--encre) }
  .validation__marque svg { height: 100%; width: auto }
  .validation__centre { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 0 32px; text-align: center }
  .validation__coche { width: 76px; height: 76px; margin-bottom: 28px; overflow: visible }
  .validation__coche circle { fill: var(--succes); transform-box: fill-box; transform-origin: center }
  .validation__coche path { fill: none; stroke: #fff; stroke-width: 5; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 48; stroke-dashoffset: 48 }
  .validation__titre { margin: 0; font-size: 28px; font-weight: 800; line-height: 1.15; letter-spacing: -.02em; color: var(--encre) }
  .validation__texte { max-width: 32ch; margin: 12px 0 0; font-size: 17px; line-height: 1.45; color: var(--texte-2) }
  .validation__recu { width: 100%; margin-top: 36px; border-top: 1px solid var(--filet); border-bottom: 1px solid var(--filet); text-align: left }
  .validation__rang { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 52px; padding: 8px 4px }
  .validation__rang + .validation__rang { border-top: 1px solid var(--filet) }
  .validation__rang > span { flex: none; color: var(--texte-2) }
  .validation__rang > b { min-width: 0; text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; overflow-wrap: anywhere }
  .validation__barre { position: sticky; bottom: 0; padding: 16px 0 max(16px, env(safe-area-inset-bottom)); background: #fff }
  .validation__bouton { width: 100%; height: 54px; border: 0; border-radius: 16px; background: var(--action); color: var(--sur-action); font: inherit; font-size: 18px; font-weight: 600; cursor: pointer; -webkit-tap-highlight-color: transparent }
  .validation__bouton:active { background: var(--action-appui) }
  .validation__bouton:focus-visible { outline: none; box-shadow: var(--anneau) }
  .validation--visible .validation__coche circle { animation: validation-rond .5s cubic-bezier(.2, 1.3, .4, 1) both }
  .validation--visible .validation__coche path { animation: validation-trait .36s .24s cubic-bezier(.4, 0, .2, 1) both }
  .validation--visible .validation__monte { animation: validation-monte .44s .16s cubic-bezier(.2, .8, .2, 1) both }
  @keyframes validation-rond { from { opacity: 0; transform: scale(.6) } }
  @keyframes validation-trait { to { stroke-dashoffset: 0 } }
  @keyframes validation-monte { from { opacity: 0; transform: translateY(10px) } }

  /* LE BOUTON QUI ENVOIE garde sa place, sa taille et sa couleur : le texte
     laisse la place à un anneau qui tourne. Rien ne se replie pendant
     l'aller-retour ; son voisin s'efface sans disparaître. */
  .bouton[aria-busy="true"] { position: relative; color: transparent !important; pointer-events: none }
  .bouton[aria-busy="true"]::after { content: ''; position: absolute; inset: 0; width: 20px; height: 20px; margin: auto; border: 2.5px solid rgba(255,255,255,.35); border-top-color: #fff; border-radius: 50%; animation: validation-tourne .7s linear infinite }
  .bouton--danger[aria-busy="true"]::after { border-color: rgba(185,28,28,.2); border-top-color: var(--danger) }
  .bouton[aria-disabled="true"] { opacity: .35; pointer-events: none }
  @keyframes validation-tourne { to { transform: rotate(360deg) } }

  @media (prefers-reduced-motion: reduce) {
    .validation { transition: none }
    .validation--visible .validation__coche circle, .validation--visible .validation__monte { animation: none }
    .validation--visible .validation__coche path { animation: none; stroke-dashoffset: 0 }
  }
`

/* L'ÉCRAN DE VALIDATION. `rangs` : le reçu, `[libellé, valeur]` ; `surFermer`
   place la page d'en dessous, encore cachée, avant qu'elle ne revienne. */
export function montrerValidation({ titre, texte = '', rangs = [], bouton = 'Voir mon dossier', surFermer }) {
  const echap = v => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  const ecran = document.createElement('div')
  ecran.className = 'validation'
  ecran.setAttribute('role', 'dialog')
  ecran.setAttribute('aria-modal', 'true')
  ecran.setAttribute('aria-labelledby', 'validation-titre')
  ecran.innerHTML = '<div class="validation__corps">'
    + '<div class="validation__marque">' + LOGO_OLDA + '</div>'
    + '<div class="validation__centre">'
    + '<svg class="validation__coche" viewBox="0 0 76 76" aria-hidden="true"><circle cx="38" cy="38" r="38"/><path d="M23 39.5l10 10L53 28"/></svg>'
    + '<div class="validation__monte">'
    + '<h1 class="validation__titre" id="validation-titre">' + echap(titre) + '</h1>'
    + (texte ? '<p class="validation__texte">' + echap(texte) + '</p>' : '')
    + '</div>'
    + (rangs.length ? '<div class="validation__recu validation__monte">' + rangs.map(([k, v]) => '<div class="validation__rang"><span>' + echap(k) + '</span><b>' + echap(v) + '</b></div>').join('') + '</div>' : '')
    + '</div>'
    + '<div class="validation__barre"><button class="validation__bouton" type="button">' + echap(bouton) + '</button></div>'
    + '</div>'
  document.body.appendChild(ecran)
  document.documentElement.classList.add('validation-ouverte')
  /* Posé transparent, lu, puis rendu visible : le fondu part bien de zéro. */
  ecran.getBoundingClientRect()
  ecran.classList.add('validation--visible')
  const fermer = () => {
    document.removeEventListener('keydown', echappe)
    if (surFermer) surFermer()
    document.documentElement.classList.remove('validation-ouverte')
    ecran.classList.remove('validation--visible')
    ecran.addEventListener('transitionend', () => ecran.remove(), { once: true })
    setTimeout(() => ecran.remove(), 400)
  }
  const echappe = e => { if (e.key === 'Escape') fermer() }
  document.addEventListener('keydown', echappe)
  const b = ecran.querySelector('.validation__bouton')
  b.onclick = fermer
  b.focus({ preventScroll: true })
}

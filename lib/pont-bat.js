/* LE PONT AVEC BAT STUDIO (17 novembre 2026, « ouvrir le logo dégueulasse
   du client depuis le BAT et appliquer ça directement »). Le BAT ouvre
   Logo maker avec `?bat=<jeton>&depuis=<adresse du BAT>` : le logo arrive
   tout seul, et « Télécharger le PDF » devient « Renvoyer au BAT ».

   Les deux pages ne se parlent pas de fenêtre à fenêtre — l'isolement de
   Logo maker (COOP same-origin, pour l'IA) coupe le lien avec la page qui
   l'ouvre. Le serveur du BAT fait relais (bat-studio, server/pont.mjs) ; le
   jeton, tiré au hasard, tient lieu de secret.

   Ce qui repart : UN PDF, le même pour la feuille du BAT et pour le RIP —
   sans couche de blanc DTF depuis le 17 novembre 2026 : le RIP la fait. */

/* Les BAT admis : en ligne, et tout BAT local (développement). */
const BAT = ['https://bat-studio.dockbear.workers.dev']
const local = o => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)

/* L'adresse de la page → { jeton, api } ou null (pas de pont). */
export function pontDepuis(href) {
  let u
  try { u = new URL(href) } catch { return null }
  const jeton = u.searchParams.get('bat') || ''
  const depuis = u.searchParams.get('depuis') || ''
  if (!/^[a-f0-9]{32}$/.test(jeton) || !depuis) return null
  let base
  try { base = new URL(depuis) } catch { return null }
  if (!BAT.includes(base.origin) && !local(base.origin)) return null
  return { jeton, api: base.origin + base.pathname.replace(/\/+$/, '') + '/api/pont/' + jeton }
}

async function erreurDe(r) {
  let j = null
  try { j = await r.json() } catch { /* pas de JSON */ }
  return new Error((j && j.error) || 'Le BAT ne répond pas (' + r.status + ').')
}

/* LE PILOTE (17 novembre 2026, « en un clic sur mon logo, voir
   instantanément les améliorations, sans ouvrir l'app ») : le BAT charge
   Logo maker dans un cadre invisible, `?pilote=<adresse du BAT>`, et lui
   parle par messages — le logo entre, les PDF sortent (studio-detourage.js,
   `ecouterPilote`). Seul un BAT admis peut piloter. → { origine } ou null. */
export function piloteDepuis(href) {
  let u
  try { u = new URL(href) } catch { return null }
  const depuis = u.searchParams.get('pilote') || ''
  if (!depuis) return null
  let origine
  try { origine = new URL(depuis).origin } catch { return null }
  if (!BAT.includes(origine) && !local(origine)) return null
  return { origine }
}

/* Le logo envoyé par le BAT, en fichier prêt à ouvrir. */
export async function recevoir(pont) {
  const r = await fetch(pont.api + '/source', { cache: 'no-store' })
  if (!r.ok) throw await erreurDe(r)
  let nom = 'logo'
  try { nom = decodeURIComponent(r.headers.get('X-Nom') || 'logo') } catch { /* nom illisible */ }
  return new File([await r.arrayBuffer()], nom, { type: r.headers.get('Content-Type') || '' })
}

/* Renvoie le logo refait. */
export async function renvoyer(pont, { nom, bat }) {
  /* Piloté : le PDF reste dans la page, le pilote le rend au BAT. */
  if (pont.envoyer) return pont.envoyer({ nom, bat })
  const poser = async (partie, octets) => {
    const r = await fetch(pont.api + '/' + partie, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream', 'X-Nom': encodeURIComponent(nom) },
      body: octets,
    })
    if (!r.ok) throw await erreurDe(r)
  }
  await poser('bat', bat)
}

/* LA DISQUETTE (20 novembre 2026, « quand on est dans Maker on peut à tout
   moment, en cliquant sur la disquette, enregistrer notre travail pour
   reprendre un travail en cours ») : le PDF du moment part dans le dossier
   Dropbox du projet, sous -04_MAKER — le BAT sait lequel, Logo maker ne
   choisit pas où il écrit. Rien ne se pose sur le BAT. → { chemin } */
export async function enregistrerMaker(pont, { nom, octets }) {
  const r = await fetch(pont.api + '/maker', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream', 'X-Nom': encodeURIComponent(nom) },
    body: octets,
  })
  if (!r.ok) throw await erreurDe(r)
  return r.json()
}

/* LE PONT AVEC BAT STUDIO (17 novembre 2026, « ouvrir le logo dégueulasse
   du client depuis le BAT et appliquer ça directement »). Le BAT ouvre
   Logo maker avec `?bat=<jeton>&depuis=<adresse du BAT>` : le logo arrive
   tout seul, et « Télécharger le PDF » devient « Renvoyer au BAT ».

   Les deux pages ne se parlent pas de fenêtre à fenêtre — l'isolement de
   Logo maker (COOP same-origin, pour l'IA) coupe le lien avec la page qui
   l'ouvre. Le serveur du BAT fait relais (bat-studio, server/pont.mjs) ; le
   jeton, tiré au hasard, tient lieu de secret.

   Ce qui repart : le PDF POUR LE BAT, sans la couche de blanc DTF — son
   Spot_1 s'affiche en magenta, le BAT du client serait rose —, et le PDF
   DU RIP, blanc compris, que le BAT range dans 000_LOGOS_OFFICIELS. */

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

/* Le logo envoyé par le BAT, en fichier prêt à ouvrir. */
export async function recevoir(pont) {
  const r = await fetch(pont.api + '/source', { cache: 'no-store' })
  if (!r.ok) throw await erreurDe(r)
  let nom = 'logo'
  try { nom = decodeURIComponent(r.headers.get('X-Nom') || 'logo') } catch { /* nom illisible */ }
  return new File([await r.arrayBuffer()], nom, { type: r.headers.get('Content-Type') || '' })
}

/* Renvoie le logo refait. Le PDF du RIP d'abord : le BAT guette le sien, et
   le prend dès qu'il le voit — le RIP doit déjà être là. */
export async function renvoyer(pont, { nom, bat, rip = null }) {
  const poser = async (partie, octets) => {
    const r = await fetch(pont.api + '/' + partie, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream', 'X-Nom': encodeURIComponent(nom) },
      body: octets,
    })
    if (!r.ok) throw await erreurDe(r)
  }
  if (rip) await poser('rip', rip)
  await poser('bat', bat)
}

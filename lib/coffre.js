/* ================================================================ LE COFFRE
   Ce que le Logo maker garde d'une visite à l'autre sur ce poste, dans
   le navigateur (IndexedDB) — rien n'en sort :
   - `faces` : les mesures des polices du poste et des polices déposées
     (lib/polices-poste.js, `decrireFace`), pour ne pas les relire ;
   - `ajouts` : les polices déposées elles-mêmes, leurs octets.
   Sans IndexedDB (une navigation privée qui le refuse), rien ne se garde
   et rien ne casse : tout se refait. La page et ses fils l'ouvrent
   pareil. */
const NOM = 'olda-logo-maker'
const VERSION = 1
const MAGASINS = ['faces', 'ajouts']

let ouverte = null
function ouvrir() {
  if (!ouverte) {
    ouverte = new Promise((ok, ko) => {
      if (typeof indexedDB === 'undefined') return ko(new Error('sans IndexedDB'))
      const r = indexedDB.open(NOM, VERSION)
      r.onupgradeneeded = () => { for (const m of MAGASINS) if (!r.result.objectStoreNames.contains(m)) r.result.createObjectStore(m) }
      r.onsuccess = () => ok(r.result)
      r.onerror = () => ko(r.error)
    }).catch(e => { ouverte = null; throw e })
  }
  return ouverte
}

const fini = t => new Promise((ok, ko) => { t.oncomplete = () => ok(); t.onerror = () => ko(t.error); t.onabort = () => ko(t.error) })

/* TOUT UN MAGASIN : Map clé → valeur (vide sans coffre). */
export async function tout(magasin) {
  try {
    const db = await ouvrir()
    const t = db.transaction(magasin, 'readonly')
    const s = t.objectStore(magasin)
    const [cles, valeurs] = await Promise.all([s.getAllKeys(), s.getAll()].map(r => new Promise((ok, ko) => { r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error) })))
    return new Map(cles.map((k, i) => [k, valeurs[i]]))
  } catch {
    return new Map()
  }
}

/* UNE VALEUR (undefined sans elle). */
export async function lire(magasin, cle) {
  try {
    const db = await ouvrir()
    const r = db.transaction(magasin, 'readonly').objectStore(magasin).get(cle)
    return await new Promise((ok, ko) => { r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error) })
  } catch {
    return undefined
  }
}

/* DES ENTRÉES [clé, valeur] posées d'un coup ; une valeur `undefined`
   retire sa clé. Faux si le coffre manque. */
export async function poser(magasin, entrees) {
  try {
    const db = await ouvrir()
    const t = db.transaction(magasin, 'readwrite')
    const s = t.objectStore(magasin)
    for (const [k, v] of entrees) v === undefined ? s.delete(k) : s.put(v, k)
    await fini(t)
    return true
  } catch {
    return false
  }
}

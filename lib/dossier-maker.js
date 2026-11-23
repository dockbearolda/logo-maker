/* LE DOSSIER « MAKER » DU POSTE (20 novembre 2026, « un bouton qui
   enregistre immédiatement le logo en cours dans un dossier dédié nommé
   Maker, horodaté, pour le reprendre plus tard ; et une option pour le
   rouvrir »).

   Logo maker est une page de Chrome : il n'écrit sur le disque que par
   l'accès aux fichiers du navigateur (File System Access). La première
   fois, Chrome demande un dossier — on y choisit Documents, Dropbox ou un
   dossier « Maker » ; un dossier qui ne s'appelle pas « Maker » en reçoit
   un. Le dossier se garde dans le coffre (IndexedDB) : les fois suivantes,
   un clic suffit (Chrome redemande au plus « Autoriser » une fois par
   visite). Sans cet accès (un autre navigateur), le fichier se télécharge.

   Ouvert depuis le BAT, la disquette écrit dans -04_MAKER du projet
   (lib/pont-bat.js) ; ce dossier-ci est celui du travail hors BAT. */
import * as Coffre from './coffre.js'

export const NOM_DOSSIER = 'Maker'
const CLE = 'dossier-maker'

const deux = n => String(n).padStart(2, '0')
/* « 2026-11-20-14h32 » : se trie dans l'ordre du temps, se lit d'un coup d'œil. */
export function horodatage(d = new Date()) {
  return d.getFullYear() + '-' + deux(d.getMonth() + 1) + '-' + deux(d.getDate()) + '-' + deux(d.getHours()) + 'h' + deux(d.getMinutes())
}

/* Un fichier déjà passé par Maker (« logo-maker-2026-11-20-14h32.png ») :
   son horodatage part, pour ne pas les empiler à chaque reprise. */
const MARQUE = /-maker-\d{4}-\d{2}-\d{2}-\d{2}h\d{2}(?:-\d+)?$/
export function baseDe(nom) {
  const b = String(nom || '').replace(/\.[^./\\]*$/, '').replace(MARQUE, '').replace(/[\\/:*?"<>|]+/g, '-').trim()
  return b || 'logo'
}
export const estDeMaker = nom => MARQUE.test(String(nom || '').replace(/\.[^./\\]*$/, ''))
export function nomMaker(nom, extension, d = new Date()) {
  return baseDe(nom) + '-maker-' + horodatage(d) + '.' + extension
}

export const disponible = () => typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'

async function autorise(dossier, demander) {
  const o = { mode: 'readwrite' }
  try {
    if ((await dossier.queryPermission(o)) === 'granted') return true
    return demander && (await dossier.requestPermission(o)) === 'granted'
  } catch { return false }
}

/* Le dossier gardé, s'il est encore là et permis — sans rien demander. */
export async function dossierPret() {
  const d = await Coffre.lire('reglages', CLE)
  return d && (await autorise(d, false)) ? d : null
}
export async function aUnDossier() { return !!(await Coffre.lire('reglages', CLE)) }

/* Le dossier où écrire : le gardé (permission redemandée si besoin), sinon
   Chrome le fait choisir. → handle, ou null (refusé, fenêtre fermée). À
   appeler depuis un clic : Chrome n'ouvre ses fenêtres que sur un geste. */
export async function dossierMaker({ changer = false } = {}) {
  if (!disponible()) return null
  if (!changer) {
    const d = await Coffre.lire('reglages', CLE)
    if (d && (await autorise(d, true))) return d
  }
  let choisi
  try { choisi = await window.showDirectoryPicker({ id: 'olda-maker', mode: 'readwrite', startIn: 'documents' }) } catch { return null }
  const d = choisi.name === NOM_DOSSIER ? choisi : await choisi.getDirectoryHandle(NOM_DOSSIER, { create: true })
  await Coffre.poser('reglages', [[CLE, d]])
  return d
}

/* Écrit le fichier dans Maker ; deux enregistrements dans la même minute ne
   s'écrasent pas (« -2 », « -3 »). → le nom écrit. */
export async function ecrire(dossier, nom, blob) {
  const point = nom.lastIndexOf('.')
  const base = nom.slice(0, point), ext = nom.slice(point)
  let final = nom
  for (let i = 2; i < 100; i++) {
    try { await dossier.getFileHandle(final); final = base + '-' + i + ext } catch { break }
  }
  const f = await dossier.getFileHandle(final, { create: true })
  const w = await f.createWritable()
  await w.write(blob)
  await w.close()
  return final
}

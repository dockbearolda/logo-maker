/* LES DERNIERS LOGOS (22 novembre 2026, « fermer le logo en cours et en
   rouvrir un autre ultra facilement ; une recherche ultra intelligente avec
   les derniers logos enregistrés dans Téléchargements, disponibles direct
   pour ne pas avoir à chercher »).

   Logo maker est une page de Chrome : il ne lit un dossier que si on le lui
   donne une fois (File System Access). Deux sources, mêlées et triées du
   plus récent au plus ancien :
   - LE DOSSIER RELIÉ (Téléchargements, d'habitude) : ses images, PDF, SVG
     et AI, gardé dans le coffre (IndexedDB) ; Chrome redemande au plus
     « Autoriser » une fois par visite. Chrome refuse le dossier
     Téléchargements lui-même sur certains postes (dossier « système ») :
     on le dit, et un sous-dossier ou « Parcourir » fait l'affaire ;
   - LES FICHIERS DÉJÀ OUVERTS par « Parcourir » ou glissés (leurs accès,
     gardés aussi).
   Pur côté recherche (`chercher`) : testé sans navigateur. */
import * as Coffre from './coffre.js'

const CLE_DOSSIER = 'dossier-recents'
const CLE_LISTE = 'fichiers-recents'
const LISTE_MAX = 40
/* Un dossier de téléchargements peut tenir des milliers de fichiers : on
   n'en lit que les logos, et au plus tant. */
const LUS_MAX = 600
export const LOGO = /\.(png|jpe?g|webp|gif|bmp|tiff?|heic|heif|svg|pdf|ai)$/i

export const disponible = () => typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function'

async function permis(h, demander) {
  const o = { mode: 'read' }
  try {
    if ((await h.queryPermission(o)) === 'granted') return true
    return !!demander && (await h.requestPermission(o)) === 'granted'
  } catch { return false }
}

export async function dossier() { return (await Coffre.lire('reglages', CLE_DOSSIER)) || null }

/* Relier un dossier (depuis un clic). → { nom } ou { erreur }. */
export async function relier() {
  try {
    const d = await window.showDirectoryPicker({ id: 'olda-recents', mode: 'read', startIn: 'downloads' })
    await Coffre.poser('reglages', [[CLE_DOSSIER, d]])
    return { nom: d.name }
  } catch (e) {
    if (e && e.name === 'AbortError') return { annule: true }
    return { erreur: 'Chrome refuse ce dossier (dossier système). Choisis un sous-dossier de Téléchargements, ou utilise « Parcourir ».' }
  }
}

/* Un fichier ouvert (son accès) rejoint la liste. */
export async function noter(handle) {
  if (!handle || handle.kind !== 'file') return
  const liste = (await Coffre.lire('reglages', CLE_LISTE)) || []
  const garde = []
  for (const h of liste) { try { if (!(await h.isSameEntry(handle))) garde.push(h) } catch { garde.push(h) } }
  await Coffre.poser('reglages', [[CLE_LISTE, [handle].concat(garde).slice(0, LISTE_MAX)]])
}

/* « Parcourir » : le sélecteur de Chrome, ouvert dans Téléchargements. */
export async function parcourir() {
  try {
    const [h] = await window.showOpenFilePicker({
      id: 'olda-logo', startIn: 'downloads', multiple: false,
      types: [{ description: 'Logos', accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff', '.heic', '.heif', '.svg'], 'application/pdf': ['.pdf'], 'application/postscript': ['.ai'] } }],
    })
    await noter(h)
    return h.getFile()
  } catch { return null }
}

/* LA LISTE : { nom, date, taille, fichier, cle } du plus récent au plus
   ancien. `demander` : redemander l'autorisation (depuis un clic). */
export async function lister({ demander = false } = {}) {
  const vus = new Map()
  const ajouter = async (h, source) => {
    try {
      const f = await h.getFile()
      if (!LOGO.test(f.name)) return
      const cle = f.name + '|' + f.size + '|' + f.lastModified
      if (!vus.has(cle)) vus.set(cle, { nom: f.name, date: f.lastModified, taille: f.size, fichier: f, cle, source })
    } catch { /* déplacé, effacé : il sort de la liste */ }
  }
  const d = await dossier()
  let etat = d ? 'relie' : 'aucun'
  if (d) {
    if (await permis(d, demander)) {
      let n = 0
      try {
        for await (const h of d.values()) {
          if (h.kind !== 'file' || !LOGO.test(h.name)) continue
          await ajouter(h, 'dossier')
          if (++n >= LUS_MAX) break
        }
      } catch { etat = 'perdu' }
    } else etat = 'a-autoriser'
  }
  for (const h of (await Coffre.lire('reglages', CLE_LISTE)) || []) {
    if (await permis(h, demander)) await ajouter(h, 'ouvert')
  }
  return { etat, nomDossier: d ? d.name : '', fichiers: [...vus.values()].sort((a, b) => b.date - a.date) }
}

/* LA RECHERCHE : sans accents ni casse, les « _ - . » comme des espaces ;
   chaque mot doit se trouver dans le nom — sauf les mots du temps
   (« aujourd'hui », « hier », « semaine », « mois ») et des types (« png »,
   « jpg », « pdf », « svg », « ai », « image ») qui filtrent. Le nom qui
   commence par un mot passe devant ; à égalité, le plus récent. */
export const plat = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[_\-.()[\]]+/g, ' ').replace(/\s+/g, ' ').trim()
const JOUR = 86400000
const TEMPS = { aujourdhui: 1, auj: 1, today: 1, hier: 2, semaine: 7, mois: 31 }
const TYPES = { png: /\.png$/i, jpg: /\.jpe?g$/i, jpeg: /\.jpe?g$/i, pdf: /\.pdf$/i, svg: /\.svg$/i, ai: /\.ai$/i, webp: /\.webp$/i, image: /\.(png|jpe?g|webp|gif|bmp|tiff?|heic|heif)$/i, vecteur: /\.(svg|pdf|ai)$/i }

export function chercher(fichiers, requete, maintenant = Date.now()) {
  const mots = plat(requete).replace(/aujourd ?'? ?hui/g, 'aujourdhui').split(' ').filter(Boolean)
  if (!mots.length) return fichiers.slice()
  const debutJour = new Date(maintenant); debutJour.setHours(0, 0, 0, 0)
  const filtres = [], texte = []
  for (const m of mots) {
    if (TEMPS[m]) {
      const j = TEMPS[m]
      if (j === 1) filtres.push(f => f.date >= debutJour.getTime())
      else if (j === 2) filtres.push(f => f.date >= debutJour.getTime() - JOUR && f.date < debutJour.getTime())
      else filtres.push(f => f.date >= maintenant - j * JOUR)
    } else if (TYPES[m]) filtres.push(f => TYPES[m].test(f.nom))
    else texte.push(m)
  }
  const notes = []
  for (const f of fichiers) {
    if (!filtres.every(t => t(f))) continue
    const nom = plat(f.nom.replace(/\.[^.]+$/, ''))
    let note = 0, ok = true
    for (const m of texte) {
      const i = nom.indexOf(m)
      if (i < 0) { ok = false; break }
      note += i === 0 ? 3 : nom[i - 1] === ' ' ? 2 : 1
    }
    if (ok) notes.push({ f, note })
  }
  notes.sort((a, b) => b.note - a.note || b.f.date - a.f.date)
  return notes.map(x => x.f)
}

/* « il y a 3 min », « hier 14 h 32 », « 12 nov. ». */
export function quand(date, maintenant = Date.now()) {
  const s = (maintenant - date) / 1000
  if (s < 60) return 'à l\'instant'
  if (s < 3600) return 'il y a ' + Math.floor(s / 60) + ' min'
  const d = new Date(date), h = d.getHours() + ' h ' + String(d.getMinutes()).padStart(2, '0')
  const debut = new Date(maintenant); debut.setHours(0, 0, 0, 0)
  if (date >= debut.getTime()) return 'aujourd\'hui ' + h
  if (date >= debut.getTime() - JOUR) return 'hier ' + h
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

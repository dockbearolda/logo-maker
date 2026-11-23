/* OUVRIR UN LOGO (22 novembre 2026, « on doit ajouter un logo très
   rapidement », un seul endroit) : le sélecteur de fichiers de Chrome,
   ouvert dans Téléchargements — là où arrivent les logos, triables par
   date. Sans lui (un autre navigateur), le champ fichier de toujours.
   Le dossier relié et les vignettes des derniers logos sont partis :
   Chrome refusait le dossier Téléchargements (dossier « système »). */

/* Dans un cadre d'un autre site (le Dashboard ouvre Logo maker dans un
   onglet à lui), Chrome refuse ce sélecteur (SecurityError) : le clic ne
   faisait plus rien. Là, le champ fichier de toujours. */
const encadre = () => { try { return window.top !== window.self } catch { return true } }
export const disponible = () => typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function' && !encadre()

/* → le fichier choisi, null (annulé), ou false (refusé : le champ fichier
   doit prendre le relais). */
export async function parcourir() {
  try {
    const [h] = await window.showOpenFilePicker({
      id: 'olda-logo', startIn: 'downloads', multiple: false,
      types: [{ description: 'Logos', accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff', '.heic', '.heif', '.svg'], 'application/pdf': ['.pdf'], 'application/postscript': ['.ai'] } }],
    })
    return h.getFile()
  } catch (e) { return e && e.name === 'AbortError' ? null : false }
}

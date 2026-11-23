/* OUVRIR UN LOGO (22 novembre 2026, « on doit ajouter un logo très
   rapidement », un seul endroit) : le sélecteur de fichiers de Chrome,
   ouvert dans Téléchargements — là où arrivent les logos, triables par
   date. Sans lui (un autre navigateur), le champ fichier de toujours.
   Le dossier relié et les vignettes des derniers logos sont partis :
   Chrome refusait le dossier Téléchargements (dossier « système »). */

export const disponible = () => typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function'

/* → le fichier choisi, ou null (annulé). */
export async function parcourir() {
  try {
    const [h] = await window.showOpenFilePicker({
      id: 'olda-logo', startIn: 'downloads', multiple: false,
      types: [{ description: 'Logos', accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff', '.heic', '.heif', '.svg'], 'application/pdf': ['.pdf'], 'application/postscript': ['.ai'] } }],
    })
    return h.getFile()
  } catch { return null }
}

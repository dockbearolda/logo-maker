/* ================================================================ LES ICÔNES
   Celles de la barre latérale, dessinées par lucide (lucide.dev, licence
   ISC, v1.47.0) et RECOPIÉES ICI : pas de CDN, le comptoir s'ouvre aussi
   sans internet. Des caractères (+, ▤, ✎, ⚙, €) les remplaçaient jusqu'au
   23 septembre 2026 — Production et Réglages portaient le même ⚙.

   UNE PLANCHE, POSÉE UNE FOIS. Chaque icône devient un <symbol> d'un <svg>
   caché en tête du corps ; la barre ne fait que s'y référer
   (`<svg class="o-nav-icone"><use href="#icone-…"></use></svg>`). Le trait
   (1,75), la taille (17 px) et la couleur (currentColor) se règlent dans la
   feuille de la page, sur `.o-nav-icone` : le <use> en hérite. */

export const ICONES = {
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  /* La coche d'un choix. */
  check: '<path d="M20 6 9 17l-5-5"/>',
  /* LE LOGO MAKER (lib/studio-detourage.js) : son entrée, le fichier qui
     arrive, le PDF qui part. */
  'wand-sparkles': '<path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/>',
  /* Changer de fichier, télécharger. */
  upload: '<path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
  download: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
  /* L'IA (l'amélioration, le sujet d'une photo) et le cadre qui remet
     l'image en entier. */
  sparkles: '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>',
  /* « Améliorer la netteté » (30 septembre 2026) : la mise au point. */
  focus: '<circle cx="12" cy="12" r="3"/><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>',
  /* LE LOGO MAKER (27 septembre 2026) : ses deux versions (le vecteur,
     l'image), « Comparer », le menu « Plus », la bulle d'une couleur. */
  shapes: '<path d="M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z"/><rect x="3" y="14" width="7" height="7" rx="1"/><circle cx="17.5" cy="17.5" r="3.5"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  /* La règle et le badge du contrôle presse (lib/studio-detourage.js). */
  ruler: '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/>',
  'columns-2': '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 3v18"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  'trash-2': '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  'rotate-ccw': '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  /* LA BARRE DU STUDIO (30 septembre 2026) : Annuler, Rétablir, Historique. */
  'undo-2': '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>',
  'redo-2': '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
}

/* La planche entière, telle qu'elle se pose dans la page. */
export const planche = () =>
  '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">'
  + Object.entries(ICONES).map(([nom, trace]) => '<symbol id="icone-' + nom + '" viewBox="0 0 24 24">' + trace + '</symbol>').join('')
  + '</svg>'

function poser() {
  if (document.getElementById('icone-plus')) return
  document.body.insertAdjacentHTML('afterbegin', planche())
}

if (typeof document !== 'undefined') {
  if (document.body) poser()
  else addEventListener('DOMContentLoaded', poser)
}

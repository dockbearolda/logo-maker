/* ================================================================ EFFACER
   1er octobre 2026 (Illustrator : sélectionner, Suppr) : un élément du
   logo s'en va d'un clic — le numéro de téléphone sous le logo, un ®, une
   miette, un mot qu'on ne veut pas imprimer. Ce qui part se dit en
   fractions de l'image (`u`, `v` de 0 à 1) : la même consigne vaut pour
   l'aperçu, l'image pleine et l'image agrandie par l'IA.
   - un POINT { u, v } : la forme d'un seul tenant (huit voisins, tout ce
     qui n'est pas transparent) qui le touche — ou la plus proche, à
     quelques pixels, d'un clic tombé à côté d'un trait fin ;
   - un CADRE { cadre: [u0, v0, u1, v1] } : chaque forme qui y tient pour
     moitié au moins (une ligne de texte, ses lettres et leurs accents ;
     l'anneau qui l'entoure, à peine dedans, reste).
   Le détourage s'en charge (lib/detourage-travail.js) : partout ensuite —
   les trois versions, les exports — l'élément n'est plus là. Pur. */

/* Où chercher la forme d'un clic tombé à côté : 0,4 % du grand côté. */
const PRES = 0.004

export function effacer(data, largeur, hauteur, effaces) {
  if (!effaces || !effaces.length) return data
  const n = largeur * hauteur
  /* Les pixels déjà pris dans une forme (un octet chacun : l'image pleine
     en a 25 millions). */
  const pris = new Uint8Array(n)
  const pile = []
  /* La forme qui contient `p` : ses pixels (une fois chacune). */
  const forme = p => {
    if (pris[p]) return null
    const pixels = []
    pris[p] = 1
    pile.push(p)
    while (pile.length) {
      const q = pile.pop()
      pixels.push(q)
      const x = q % largeur, y = (q - x) / largeur
      for (let dy = -1; dy <= 1; dy++) {
        const Y = y + dy
        if (Y < 0 || Y >= hauteur) continue
        for (let dx = -1; dx <= 1; dx++) {
          const X = x + dx
          if (X < 0 || X >= largeur) continue
          const r = Y * largeur + X
          if (!pris[r] && data[r * 4 + 3] > 0) { pris[r] = 1; pile.push(r) }
        }
      }
    }
    return pixels
  }
  const vider = pixels => { for (const p of pixels) data[p * 4 + 3] = 0 }
  const rayon = Math.max(2, Math.round(PRES * Math.max(largeur, hauteur)))
  for (const e of effaces) {
    if (e.cadre) {
      const [u0, v0, u1, v1] = e.cadre
      const x0 = Math.max(0, Math.floor(u0 * largeur)), y0 = Math.max(0, Math.floor(v0 * hauteur))
      const x1 = Math.min(largeur - 1, Math.ceil(u1 * largeur)), y1 = Math.min(hauteur - 1, Math.ceil(v1 * hauteur))
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const p = y * largeur + x
          if (data[p * 4 + 3] === 0) continue
          const f = forme(p)
          if (!f) continue
          let dedans = 0
          for (const q of f) { const X = q % largeur, Y = (q - X) / largeur; if (X >= x0 && X <= x1 && Y >= y0 && Y <= y1) dedans++ }
          if (dedans >= 0.5 * f.length) vider(f)
        }
      }
      continue
    }
    /* Un point : le pixel opaque le plus proche, à `rayon` près. */
    const cx = Math.min(largeur - 1, Math.max(0, Math.floor(e.u * largeur))), cy = Math.min(hauteur - 1, Math.max(0, Math.floor(e.v * hauteur)))
    let meilleur = -1, dm = Infinity
    for (let y = Math.max(0, cy - rayon); y <= Math.min(hauteur - 1, cy + rayon); y++) {
      for (let x = Math.max(0, cx - rayon); x <= Math.min(largeur - 1, cx + rayon); x++) {
        const p = y * largeur + x
        if (data[p * 4 + 3] < 128) continue
        const d = (x - cx) ** 2 + (y - cy) ** 2
        if (d < dm) { dm = d; meilleur = p }
      }
    }
    if (meilleur < 0) continue
    const f = forme(meilleur)
    if (f) vider(f)
  }
  return data
}

/* UN POINT DE L'IMAGE est-il de l'encre ? (le clic sur le plan, avant d'y
   proposer « Retirer cet élément ») — à `rayon` pixels près. */
export function encreSous(data, largeur, hauteur, x, y, rayon = 2) {
  for (let Y = Math.max(0, Math.floor(y) - rayon); Y <= Math.min(hauteur - 1, Math.floor(y) + rayon); Y++) {
    for (let X = Math.max(0, Math.floor(x) - rayon); X <= Math.min(largeur - 1, Math.floor(x) + rayon); X++) {
      if (data[(Y * largeur + X) * 4 + 3] >= 128) return true
    }
  }
  return false
}

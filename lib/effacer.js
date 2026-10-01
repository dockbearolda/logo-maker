/* ================================================================ EFFACER
   1er octobre 2026 (Illustrator : sélectionner, Suppr) : un élément du
   logo s'en va d'un clic — le numéro de téléphone sous le logo, un ®, une
   miette, un mot qu'on ne veut pas imprimer. Ce qui part se dit en
   fractions de l'image (`u`, `v` de 0 à 1) : la même consigne vaut pour
   l'aperçu, l'image pleine et l'image agrandie par l'IA.
   - un POINT { u, v, aire } : la forme d'un seul tenant (huit voisins,
     l'encre à partir d'un huitième d'opacité) qui le touche — ou la plus
     proche, à quelques pixels, d'un clic tombé à côté d'un trait fin.
     `aire` : la part de l'image qu'elle couvrait au clic ; une forme
     trois fois plus grande ou plus petite n'est plus la même (le seuil a
     bougé, l'IA a soudé le dessin) — elle reste ;
   - un CADRE { cadre: [u0, v0, u1, v1] } : chaque forme qui y tient pour
     moitié au moins (une ligne de texte, ses lettres et leurs accents ;
     l'anneau qui l'entoure, à peine dedans, reste) — dans son polygone
     (`poly` : [[u, v]…]) s'il en a un : le tour d'une ligne écrite en
     rond, dont le cadre prendrait le dessin du milieu.
   Chaque consigne se lit sur l'image telle qu'elle est (une forme gardée
   par l'une reste à prendre pour la suivante). Le liseré presque
   transparent d'une forme retirée part avec elle. Le détourage s'en
   charge (lib/detourage-travail.js) : partout ensuite — les trois
   versions, les exports — l'élément n'est plus là. Pur. */

/* Où chercher la forme d'un clic tombé à côté : 0,4 % du grand côté. */
const PRES = 0.004
/* L'encre d'une forme : un huitième d'opacité au moins (le halo d'un
   masque doux de l'IA ne soude pas tout le dessin). */
const ENCRE = 32

export function effacer(data, largeur, hauteur, effaces) {
  if (!effaces || !effaces.length) return data
  const n = largeur * hauteur
  /* Un octet par pixel, remis à zéro pour chaque consigne. */
  const pris = new Uint8Array(n)
  let pile = new Int32Array(1024)
  /* LA FORME DE `p`, parcourue : `visite(q)` pour chacun de ses pixels ;
     rend leur nombre. `marque` : la valeur posée dans `pris`. */
  const parcourir = (p, marque, visite) => {
    let haut = 0, compte = 0
    pris[p] = marque
    pile[haut++] = p
    while (haut) {
      const q = pile[--haut]
      compte++
      visite(q)
      const x = q % largeur, y = (q - x) / largeur
      for (let dy = -1; dy <= 1; dy++) {
        const Y = y + dy
        if (Y < 0 || Y >= hauteur) continue
        for (let dx = -1; dx <= 1; dx++) {
          const X = x + dx
          if (X < 0 || X >= largeur) continue
          const r = Y * largeur + X
          if (pris[r] === marque || data[r * 4 + 3] < ENCRE) continue
          pris[r] = marque
          if (haut === pile.length) { const plus = new Int32Array(pile.length * 2); plus.set(pile); pile = plus }
          pile[haut++] = r
        }
      }
    }
    return compte
  }
  /* LA RETIRER : ses pixels, puis le liseré presque transparent autour. */
  const retirer = p => {
    const bord = []
    parcourir(p, 2, q => {
      data[q * 4 + 3] = 0
      const x = q % largeur, y = (q - x) / largeur
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = x + dx, Y = y + dy
        if (X < 0 || Y < 0 || X >= largeur || Y >= hauteur) continue
        const r = Y * largeur + X
        if (data[r * 4 + 3] > 0 && data[r * 4 + 3] < ENCRE) bord.push(r)
      }
    })
    for (const r of bord) data[r * 4 + 3] = 0
  }
  const rayon = Math.max(2, Math.round(PRES * Math.max(largeur, hauteur)))
  for (const e of effaces) {
    pris.fill(0)
    if (e.cadre) {
      const [u0, v0, u1, v1] = e.cadre
      const x0 = Math.max(0, Math.floor(u0 * largeur)), y0 = Math.max(0, Math.floor(v0 * hauteur))
      const x1 = Math.min(largeur - 1, Math.ceil(u1 * largeur)), y1 = Math.min(hauteur - 1, Math.ceil(v1 * hauteur))
      const poly = e.poly ? e.poly.map(([u, v]) => [u * largeur, v * hauteur]) : null
      const dans = poly ? (X, Y) => X >= x0 && X <= x1 && Y >= y0 && Y <= y1 && dansPoly(poly, X + 0.5, Y + 0.5) : (X, Y) => X >= x0 && X <= x1 && Y >= y0 && Y <= y1
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const p = y * largeur + x
          if (pris[p] || data[p * 4 + 3] < ENCRE || !dans(x, y)) continue
          let dedans = 0
          const total = parcourir(p, 1, q => { const X = q % largeur, Y = (q - X) / largeur; if (dans(X, Y)) dedans++ })
          if (dedans >= 0.5 * total) retirer(p)
        }
      }
      continue
    }
    /* Un point : le pixel d'encre le plus proche, à `rayon` près. */
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
    if (e.aire > 0) {
      const part = parcourir(meilleur, 1, () => {}) / n
      if (part > 3 * e.aire || part < e.aire / 3) continue
    }
    retirer(meilleur)
  }
  return data
}

/* Un point dans un polygone (pair-impair). */
function dansPoly(poly, x, y) {
  let dedans = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) dedans = !dedans
  }
  return dedans
}

/* L'ENCRE D'UNE IMAGE (RVBA de `largeur` de large), en pixels — dans le
   rectangle [x0, x1] × [y0, y1] s'il est donné : ce qu'une consigne
   retirerait se compte avant de la donner (le studio, sur l'aperçu). */
export function encreDe(data, largeur, x0 = 0, y0 = 0, x1 = Infinity, y1 = Infinity) {
  const hauteur = data.length / 4 / largeur
  let k = 0
  for (let y = Math.max(0, y0); y <= Math.min(hauteur - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(largeur - 1, x1); x++) if (data[(y * largeur + x) * 4 + 3] >= 128) k++
  }
  return k
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

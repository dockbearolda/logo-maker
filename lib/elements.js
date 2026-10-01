/* ================================================================ LES ÉLÉMENTS
   30 septembre 2026, le logo « 6e3 AME » : « il est primordial que tout
   intérieur de lettre, sans exception, soit parfaitement vidé ; il faudrait
   aussi que le logiciel reconnaisse les éléments pour éviter de retirer ce
   qui ne doit pas l'être ». « Partout » vidait tout ce qui avait la couleur
   du fond et un bord net : le ciel de l'île et le creux des lettres — mais
   aussi l'aigrette blanche, le ventre de la baleine, la bouteille, l'écume.
   Ici, le dessin se lit en éléments, du calcul seul (lib/detourage.js s'en
   sert, `creux`) :
   - LES FORMES, d'un seul tenant (huit voisins) : leur cadre, leur taille,
     et pour chaque pixel la sienne (`composante`) ;
   - LES LETTRES : les formes rangées en lignes de texte (lib/polices.js,
     `lignes` : même hauteur, même ligne de base, à portée l'une de
     l'autre, deux au moins) — les lettres d'un mot, les deux mots d'une
     écriture, « 2026 - 2027 ». Un creux qui touche une lettre est le jour
     de cette lettre : il se vide, quelle que soit sa taille ou son bord.
   Le reste — ce qui a la couleur du fond, enfermé dans un élément qui
   n'est pas une lettre — se juge dans lib/detourage.js (`creux`) : le fond
   vu à travers (grand, ou relié au fond par un filet) part, le blanc peint
   d'un élément (le plumage, un reflet, une écume) reste. */
import { reunir, lignes } from './polices.js'

const TRANSPARENT = 16

/* LES FORMES ET LES LETTRES d'une image (RVBA, `largeur` × `hauteur`).
   `hors` : 1 sur ce qui n'est pas du dessin (le fond, à la couleur) ;
   `file` : une réserve de n entiers, si on en a une. Rend { composante (la
   forme de chaque pixel, -1 hors du dessin), formes : [{ id, x0, y0, x1,
   y1, taille }], lettres (1 sur les pixels des lettres, ou null) }. */
export function elementsDu(data, largeur, hauteur, hors, file = null) {
  const n = largeur * hauteur
  const composante = new Int32Array(n).fill(-1)
  if (!file || file.length < n) file = new Int32Array(n)
  const dessin = p => !hors[p] && data[p * 4 + 3] >= TRANSPARENT
  const formes = []
  for (let p0 = 0; p0 < n; p0++) {
    if (composante[p0] >= 0 || !dessin(p0)) continue
    const id = formes.length
    let tete = 0, queue = 0, x0 = largeur, y0 = hauteur, x1 = -1, y1 = -1
    composante[p0] = id
    file[queue++] = p0
    while (tete < queue) {
      const p = file[tete++], x = p % largeur, y = (p - x) / largeur
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
      for (let dy = -1; dy <= 1; dy++) {
        const Y = y + dy
        if (Y < 0 || Y >= hauteur) continue
        for (let dx = -1; dx <= 1; dx++) {
          const X = x + dx
          if (X < 0 || X >= largeur) continue
          const q = Y * largeur + X
          if (composante[q] >= 0 || !dessin(q)) continue
          composante[q] = id
          file[queue++] = q
        }
      }
    }
    formes.push({ id, x0, y0, x1, y1, taille: queue })
  }
  return { composante, formes, lettres: lettresDe(formes, composante, largeur, hauteur) }
}

/* LES LETTRES : les formes de taille de lettre (ni une poussière, ni un
   dessin de près de la moitié de l'image) rangées en lignes de texte ;
   1 sur leurs pixels. */
export function lettresDe(formes, composante, largeur, hauteur) {
  const petites = formes.filter(f => f.taille >= 3 && f.y1 - f.y0 + 1 < 0.45 * hauteur && f.x1 - f.x0 + 1 < 0.5 * largeur)
  if (petites.length < 2) return null
  const texte = lignes(reunir(petites.map(f => ({ id: f.id, x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1 }))), { min: 2 })
  let lettres = null
  for (const l of texte) {
    for (const lettre of l) {
      for (const f of lettre.formes) {
        if (!lettres) lettres = new Uint8Array(largeur * hauteur)
        for (let y = f.y0; y <= f.y1; y++) {
          const o = y * largeur
          for (let x = f.x0; x <= f.x1; x++) if (composante[o + x] === f.id) lettres[o + x] = 1
        }
      }
    }
  }
  return lettres
}

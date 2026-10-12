/* ================================================================ LES CALQUES
   12 octobre 2026 : « un système de calques — prendre l'écriture et la
   modifier, supprimer un objet qui me plaît pas ». Un calque n'est jamais
   dessiné par la vendeuse : c'est un élément que le graphiste a lu dans
   le fichier — une ligne de texte (lib/texte.js, dans le studio), ou une
   FORME, listée ici : une composante d'un seul tenant de l'image détourée
   (huit voisins, l'encre à partir d'un huitième d'opacité — la règle de
   lib/effacer.js, pour qu'un clic sur la liste retire exactement ce
   qu'un clic sur le plan retirerait).
   Chaque forme se dit en fractions de l'image, comme `effaces` : la même
   adresse vaut pour l'aperçu, l'image pleine et l'image agrandie par
   l'IA. Seules les formes d'au moins `AIRE_MIN` de l'image sont listées,
   les `MAX` plus grandes au plus ; les miettes se retirent au clic sur le
   plan, comme avant. Pur. */

/* L'encre d'une forme : un huitième d'opacité (lib/effacer.js, `ENCRE`). */
const ENCRE = 32
export const AIRE_MIN = 0.0005
export const MAX = 40

/* LES FORMES d'une image détourée (RVBA, `largeur` × `hauteur`), de la
   plus grande à la plus petite : { id, u, v, aire, cadre: [u0, v0, u1,
   v1], rvb }. `u`, `v` : un pixel sûr de la forme, le plus proche de son
   centre ; `rvb` : sa couleur dominante (le bac de seize niveaux le plus
   peuplé, la moyenne de ses pixels). `consignes` : des points { u, v }
   (les retraits et les recolorations déjà données) — pour chacun, l'`id`
   de la forme qu'il touche, ou -1 (`touchees`) ; et `carte`, la forme
   listée de chaque pixel (-1 : aucune), pour la souris sur le plan. */
export function formesDe(data, largeur, hauteur, consignes = []) {
  const n = largeur * hauteur
  const composante = new Int32Array(n).fill(-1)
  const file = new Int32Array(n)
  const formes = []
  for (let p0 = 0; p0 < n; p0++) {
    if (composante[p0] >= 0 || data[p0 * 4 + 3] < ENCRE) continue
    const id = formes.length
    let tete = 0, queue = 0, x0 = largeur, y0 = hauteur, x1 = -1, y1 = -1, sx = 0, sy = 0
    composante[p0] = id
    file[queue++] = p0
    while (tete < queue) {
      const p = file[tete++], x = p % largeur, y = (p - x) / largeur
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
      sx += x; sy += y
      for (let dy = -1; dy <= 1; dy++) {
        const Y = y + dy
        if (Y < 0 || Y >= hauteur) continue
        for (let dx = -1; dx <= 1; dx++) {
          const X = x + dx
          if (X < 0 || X >= largeur) continue
          const q = Y * largeur + X
          if (composante[q] >= 0 || data[q * 4 + 3] < ENCRE) continue
          composante[q] = id
          file[queue++] = q
        }
      }
    }
    formes.push({ id, taille: queue, x0, y0, x1, y1, cx: sx / queue, cy: sy / queue, debut: 0 })
  }
  /* Les formes retenues : assez grandes, les plus grandes d'abord. */
  const retenues = formes.filter(f => f.taille >= AIRE_MIN * n).sort((a, b) => b.taille - a.taille).slice(0, MAX)
  const rang = new Int32Array(formes.length).fill(-1)
  retenues.forEach((f, k) => { rang[f.id] = k })
  /* Un passage sur l'image : pour chaque forme retenue, le pixel le plus
     proche de son centre et ses couleurs (les bacs de seize niveaux). */
  const proche = retenues.map(() => ({ d: Infinity, p: -1 }))
  const bacs = retenues.map(() => new Map())
  for (let p = 0; p < n; p++) {
    const id = composante[p]
    if (id < 0 || rang[id] < 0) continue
    const k = rang[id], f = retenues[k], x = p % largeur, y = (p - x) / largeur
    const d = (x - f.cx) ** 2 + (y - f.cy) ** 2
    if (d < proche[k].d) { proche[k].d = d; proche[k].p = p }
    const i = p * 4
    if (data[i + 3] < 128) continue
    const cle = (data[i] >> 4) * 256 + (data[i + 1] >> 4) * 16 + (data[i + 2] >> 4)
    const b = bacs[k].get(cle) || [0, 0, 0, 0]
    b[0] += data[i]; b[1] += data[i + 1]; b[2] += data[i + 2]; b[3]++
    bacs[k].set(cle, b)
  }
  const sortie = retenues.map((f, k) => {
    let tete = null
    for (const b of bacs[k].values()) if (!tete || b[3] > tete[3]) tete = b
    const p = proche[k].p, x = p % largeur, y = (p - x) / largeur
    return {
      id: k, u: (x + 0.5) / largeur, v: (y + 0.5) / hauteur, aire: f.taille / n,
      cadre: [f.x0 / largeur, f.y0 / hauteur, (f.x1 + 1) / largeur, (f.y1 + 1) / hauteur],
      rvb: tete ? [Math.round(tete[0] / tete[3]), Math.round(tete[1] / tete[3]), Math.round(tete[2] / tete[3])] : [0, 0, 0],
    }
  })
  /* Les consignes : la forme sous chaque point (lib/effacer.js cherche
     l'encre à `PRES` du grand côté). */
  const rayon = Math.max(2, Math.round(0.004 * Math.max(largeur, hauteur)))
  const touchees = consignes.map(c => {
    if (!c || c.u === undefined) return -1
    const cx = Math.min(largeur - 1, Math.max(0, Math.floor(c.u * largeur))), cy = Math.min(hauteur - 1, Math.max(0, Math.floor(c.v * hauteur)))
    let meilleur = -1, dm = Infinity
    for (let y = Math.max(0, cy - rayon); y <= Math.min(hauteur - 1, cy + rayon); y++) {
      for (let x = Math.max(0, cx - rayon); x <= Math.min(largeur - 1, cx + rayon); x++) {
        const p = y * largeur + x
        if (data[p * 4 + 3] < 128) continue
        const d = (x - cx) ** 2 + (y - cy) ** 2
        if (d < dm) { dm = d; meilleur = p }
      }
    }
    if (meilleur < 0) return -1
    const id = composante[meilleur]
    if (id < 0 || rang[id] < 0) return -1
    /* La même tolérance d'aire que le retrait : une forme trois fois plus
       grande ou plus petite n'est plus la sienne. */
    const part = formes[id].taille / n
    if (c.aire > 0 && (part > 3 * c.aire || part < c.aire / 3)) return -1
    return rang[id]
  })
  /* La carte : la forme listée de chaque pixel (son rang), -1 ailleurs. */
  const carte = new Int8Array(n).fill(-1)
  for (let p = 0; p < n; p++) { const id = composante[p]; if (id >= 0) carte[p] = rang[id] }
  return { formes: sortie, touchees, carte }
}

/* UNE FORME QUI EST UNE LETTRE d'une ligne de texte (`lignes` : leurs
   cadres [u0, v0, u1, v1] en fractions) : son cadre tient pour les quatre
   cinquièmes dans celui de la ligne, et elle n'est pas plus haute qu'une
   fois et demie la ligne — la ligne est son calque, elle ne se liste pas
   à part. Un badge sous le texte (plus grand que la ligne) reste une
   forme. */
export function estLettre(forme, lignes) {
  const [a0, b0, a1, b1] = forme.cadre
  const aire = (a1 - a0) * (b1 - b0)
  if (!(aire > 0)) return false
  for (const l of lignes) {
    const [c0, d0, c1, d1] = l
    if (b1 - b0 > 1.5 * (d1 - d0)) continue
    const x0 = Math.max(a0, c0), y0 = Math.max(b0, d0), x1 = Math.min(a1, c1), y1 = Math.min(b1, d1)
    if (x1 <= x0 || y1 <= y0) continue
    if ((x1 - x0) * (y1 - y0) >= 0.8 * aire) return true
  }
  return false
}

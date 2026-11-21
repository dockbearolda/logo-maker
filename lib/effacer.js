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
     rond, dont le cadre prendrait le dessin du milieu ;
   - un LASSO { poly, cadre, coupe: true } (12 octobre 2026, la gomme des
     calques) : l'encre dedans part, pixel par pixel — pas les formes
     entières.
   Chaque consigne se lit sur l'image telle qu'elle est (une forme gardée
   par l'une reste à prendre pour la suivante). Le liseré presque
   transparent d'une forme retirée part avec elle. Le détourage s'en
   charge (lib/detourage-travail.js) : partout ensuite — les trois
   versions, les exports — l'élément n'est plus là. Pur.
   12 octobre 2026 (les calques) : un élément se RECOLORE aussi
   (`recolorer`) — la même adresse qu'un point, chaque pixel d'encre de
   la forme prend la couleur, son opacité gardée. */

/* Où chercher la forme d'un clic tombé à côté : 0,4 % du grand côté. */
const PRES = 0.004
/* L'encre d'une forme : un huitième d'opacité au moins (le halo d'un
   masque doux de l'IA ne soude pas tout le dessin). */
const ENCRE = 32

/* LA SÉLECTION D'UNE CONSIGNE (12 octobre 2026, les calques déplacés —
   partagée par `effacer`, `recolorer` et lib/transformer.js) : ses pixels
   d'encre (`pixels`) et le liseré presque transparent qui les touche
   (`bord`, 0 < alpha < ENCRE), ou null sans rien. Un point : la forme
   d'un seul tenant sous lui (à `PRES` près, à l'aire près) ; un cadre :
   chaque forme qui y tient pour moitié (dans son polygone s'il en a un).
   `etat` : { pris, pile } réutilisés d'une consigne à l'autre (`pris`
   est remis à zéro ici). Rien n'est modifié. */
export function selection(data, largeur, hauteur, e, etat = null) {
  const n = largeur * hauteur
  const pris = etat && etat.pris && etat.pris.length === n ? etat.pris : new Uint8Array(n)
  let pile = etat && etat.pile ? etat.pile : new Int32Array(1024)
  if (etat) etat.pris = pris
  pris.fill(0)
  /* LA FORME DE `p`, parcourue (huit voisins, l'encre à `ENCRE`) :
     `visite(q)` pour chacun de ses pixels ; rend leur nombre. */
  const parcourir = (p, visite) => {
    let haut = 0, compte = 0
    pris[p] = 1
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
          if (pris[r] || data[r * 4 + 3] < ENCRE) continue
          pris[r] = 1
          if (haut === pile.length) { const plus = new Int32Array(pile.length * 2); plus.set(pile); pile = plus; if (etat) etat.pile = pile }
          pile[haut++] = r
        }
      }
    }
    return compte
  }
  const pixels = []
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
        const forme = []
        const total = parcourir(p, q => { forme.push(q); const X = q % largeur, Y = (q - X) / largeur; if (dans(X, Y)) dedans++ })
        if (dedans >= 0.5 * total) for (const q of forme) pixels.push(q)
      }
    }
  } else {
    const rayon = Math.max(2, Math.round(PRES * Math.max(largeur, hauteur)))
    const meilleur = encreProche(data, largeur, hauteur, e, rayon)
    if (meilleur < 0) return null
    parcourir(meilleur, q => pixels.push(q))
    if (e.aire > 0) {
      const part = pixels.length / n
      if (part > 3 * e.aire || part < e.aire / 3) return null
    }
  }
  if (!pixels.length) return null
  /* Le liseré presque transparent autour : il fondait la forme dans le
     fond. Chaque pixel une fois (`pris` = 3). */
  const bord = []
  for (const q of pixels) {
    const x = q % largeur, y = (q - x) / largeur
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const X = x + dx, Y = y + dy
      if (X < 0 || Y < 0 || X >= largeur || Y >= hauteur) continue
      const r = Y * largeur + X
      if (pris[r] !== 3 && data[r * 4 + 3] > 0 && data[r * 4 + 3] < ENCRE) { pris[r] = 3; bord.push(r) }
    }
  }
  return { pixels: Int32Array.from(pixels), bord: Int32Array.from(bord) }
}

export function effacer(data, largeur, hauteur, effaces) {
  if (!effaces || !effaces.length) return data
  const etat = { pris: new Uint8Array(largeur * hauteur), pile: new Int32Array(1024) }
  for (const e of effaces) {
    /* Un lasso qui coupe : l'encre dedans, pixel par pixel. */
    if (e.cadre && e.coupe && e.poly) {
      const poly = e.poly.map(([u, v]) => [u * largeur, v * hauteur])
      const [u0, v0, u1, v1] = e.cadre
      const x0 = Math.max(0, Math.floor(u0 * largeur)), y0 = Math.max(0, Math.floor(v0 * hauteur))
      const x1 = Math.min(largeur - 1, Math.ceil(u1 * largeur)), y1 = Math.min(hauteur - 1, Math.ceil(v1 * hauteur))
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (dansPoly(poly, x + 0.5, y + 0.5)) data[(y * largeur + x) * 4 + 3] = 0
      continue
    }
    /* Chaque consigne se lit sur l'image telle qu'elle est. */
    const sel = selection(data, largeur, hauteur, e, etat)
    if (!sel) continue
    for (const q of sel.pixels) data[q * 4 + 3] = 0
    for (const q of sel.bord) data[q * 4 + 3] = 0
  }
  return data
}

/* LE PIXEL D'ENCRE LE PLUS PROCHE d'un point { u, v }, à `rayon` pixels
   près ; -1 sans encre. */
function encreProche(data, largeur, hauteur, e, rayon) {
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
  return meilleur
}

/* UN ÉLÉMENT RECOLORÉ (12 octobre 2026, les calques) : pour chaque
   consigne { u, v, aire, rvb }, la forme d'un seul tenant sous le point —
   la même adresse, la même tolérance d'aire que `effacer` — prend `rvb`
   sur chacun de ses pixels d'encre, son opacité gardée (le bord
   anticrénelé reste doux). `data` est modifié sur place et rendu. */
export function recolorer(data, largeur, hauteur, teintes) {
  if (!teintes || !teintes.length) return data
  const etat = { pris: new Uint8Array(largeur * hauteur), pile: new Int32Array(1024) }
  for (const t of teintes) {
    if (!t || !t.rvb) continue
    const sel = selection(data, largeur, hauteur, t, etat)
    if (!sel) continue
    const [r, g, b] = t.rvb
    for (const q of sel.pixels) { const i = q * 4; data[i] = r; data[i + 1] = g; data[i + 2] = b }
    /* Le liseré presque transparent autour prend aussi la couleur : il
       fondait l'ancienne teinte dans le fond. */
    for (const q of sel.bord) { const i = q * 4; data[i] = r; data[i + 1] = g; data[i + 2] = b }
  }
  return data
}

/* L'ÉPAISSEUR D'UN ÉLÉMENT (21 novembre 2026, « cliquer sur certaines
   zones pour ajuster l'épaisseur ») : la même adresse qu'un retrait (un
   point pour une forme, un cadre pour une ligne de texte sans police), et
   `k`, l'épaisseur ajoutée (> 0) ou ôtée (< 0) tout autour, en part du
   grand côté de l'image — la même consigne vaut pour l'aperçu, l'image
   pleine et l'image agrandie par l'IA. Épaissi, chaque pixel à moins de
   |k| du bord prend la couleur de l'encre la plus proche ; aminci, celle
   de ce qui touche la forme (le fond transparent, ou l'aplat sous une
   lettre). Le dernier demi-pixel se fond (pas d'escalier). Pur, sauf
   `data`. */
export function epaissir(data, largeur, hauteur, epaisseurs) {
  if (!epaisseurs || !epaisseurs.length) return data
  const etat = { pris: new Uint8Array(largeur * hauteur), pile: new Int32Array(1024) }
  const n = largeur * hauteur
  for (const e of epaisseurs) {
    if (!e || !e.k) continue
    const rayon = Math.abs(e.k) * Math.max(largeur, hauteur)
    if (rayon < 0.5) continue
    const sel = selection(data, largeur, hauteur, e, etat)
    if (!sel) continue
    const dans = new Uint8Array(n)
    for (const q of sel.pixels) dans[q] = 1
    const grossir = e.k > 0
    /* Le liseré d'une forme amincie part : il dessinerait l'ancien bord. */
    if (!grossir) for (const q of sel.bord) data[q * 4 + 3] = 0
    /* Les sources : l'encre au bord de la forme (épaissir), ou ce qui la
       touche dehors (amincir) ; chacune se propage vers l'autre côté,
       au plus près (la distance à sa source). */
    const source = new Int32Array(n).fill(-1)
    let file = new Int32Array(Math.max(1024, sel.pixels.length))
    let fin = 0
    const pousser = q => { if (fin === file.length) { const plus = new Int32Array(file.length * 2); plus.set(file); file = plus } file[fin++] = q }
    for (const q of sel.pixels) {
      const x = q % largeur, y = (q - x) / largeur
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = x + dx, Y = y + dy
        if (X < 0 || Y < 0 || X >= largeur || Y >= hauteur) continue
        const r = Y * largeur + X
        if (dans[r]) continue
        if (grossir) { if (source[q] < 0) { source[q] = q; pousser(q) } }
        else if (source[r] < 0) { source[r] = r; pousser(r) }
      }
    }
    /* Chaque pixel garde la source la plus proche : une file qui se
       relâche (un pixel repart quand une source plus proche l'atteint). */
    const dist = new Float64Array(n).fill(Infinity)
    for (let t = 0; t < fin; t++) dist[file[t]] = 0
    const touches = []
    for (let t = 0; t < fin; t++) {
      const q = file[t], s = source[q]
      const x = q % largeur, y = (q - x) / largeur
      const sx = s % largeur, sy = (s - sx) / largeur
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = x + dx, Y = y + dy
        if (X < 0 || Y < 0 || X >= largeur || Y >= hauteur) continue
        const r = Y * largeur + X
        if (grossir ? dans[r] : !dans[r]) continue
        const d = Math.hypot(X - sx, Y - sy)
        if (d > rayon + 0.5 || d >= dist[r]) continue
        if (dist[r] === Infinity) touches.push(r)
        dist[r] = d
        source[r] = s
        pousser(r)
      }
    }
    /* La part couverte par la source : 1 en deçà du rayon, fondue sur le
       dernier pixel. */
    const avant = new Uint8ClampedArray(data)
    for (const r of touches) {
      const part = Math.min(1, rayon + 0.5 - dist[r]), reste = 1 - part
      const i = r * 4, j = source[r] * 4
      for (let c = 0; c < 3; c++) data[i + c] = avant[j + c] * part + avant[i + c] * reste
      data[i + 3] = grossir ? Math.max(avant[i + 3], avant[j + 3] * part) : avant[j + 3] * part + avant[i + 3] * reste
    }
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

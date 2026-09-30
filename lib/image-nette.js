/* ============================================================ L'IMAGE NETTE
   27 septembre 2026 : « quand je zoome sur l'image, j'aimerais que ce soit
   moins flou, avec des courbes parfaites ». La version image du Logo maker
   garde les dégradés et les textures du fichier (ils ne doivent jamais être
   tronqués) ; ses bords, eux, sont ceux du vecteur (voir plus bas,
   `imageParCouches`, 28 septembre 2026). Du calcul pur : des pixels qui
   entrent, des pixels qui sortent (lib/detourage-travail.js le fait
   tourner hors de la page). */
import { plats } from './vecteur-lisse.js'

const VOISINS = (p, largeur, n, f) => {
  const x = p % largeur
  if (x > 0) f(p - 1)
  if (x < largeur - 1) f(p + 1)
  if (p >= largeur) f(p - largeur)
  if (p < n - largeur) f(p + largeur)
}

/* ===================================================== L'IMAGE PAR LES COUCHES
   28 septembre 2026 : « les couleurs à l'intérieur des lettres ne sont pas
   parfaites ». Lue seule, l'image devinait mal ses bords : la pastille jaune
   d'un O sortait mordue de noir, le triangle bleu d'un A arrondi et rétréci,
   un liseré blanc autour du magenta. Le vecteur, lui, sait où sont les
   bords — au demi-pixel, en vraies courbes. L'image se refait donc sur ses
   couches :
   1. LES ÉTIQUETTES : chaque pixel fin prend la couche du vecteur qui le
      couvre, celle du dessus (ses tracés, remplis ligne à ligne) ;
   2. LES PIXELS SÛRS du fichier : loin d'un bord de couche, ou posés à plat
      et plus près de la teinte de leur couche que de toute autre. La rampe
      d'un bord — le jaune qui passe au noir, le halo blanc d'un JPEG —
      n'en est jamais ;
   3. LA COULEUR se propage des pixels sûrs aux autres, sans jamais passer
      d'une couche à l'autre : le dégradé d'une plume, la texture d'une
      photo restent ceux du fichier ; le bord, lui, est celui du vecteur ;
   4. LA TAILLE FINE : chaque pixel fin lit ses voisins du fichier de SA
      couche (en douceur), et un pixel fin d'adoucissement le long des bords
      efface l'escalier.
   `rgba` : le cadre de l'image détourée (`largeur` × `hauteur`), placé en
   `cadre.x`, `cadre.y` de l'image de travail ; `couches` : du dessous au
   dessus, `{ couleur, boucles, aplat }` (lib/vecteur-lisse.js, en pixels
   de l'image de travail ; `aplat` : redessinée, peinte de sa couleur) ; `f` : combien de fois plus fine ; `echelle` :
   combien de pixels de l'image pour un pixel du fichier d'origine (quatre
   quand l'IA l'a agrandi : ses rampes y sont quatre fois plus larges) ;
   `fonds` : les couleurs du fond retiré. */
export function imageParCouches(rgba, largeur, hauteur, cadre, couches, f = 2, echelle = 1, fonds = []) {
  const L = Math.round(largeur * f), H = Math.round(hauteur * f)
  const fin = etiqueter(couches, cadre.x, cadre.y, f, L, H)
  const n = largeur * hauteur
  /* L'étiquette de chaque pixel du fichier : celle du pixel fin qui porte
     son centre. */
  const lab = new Int16Array(n)
  for (let y = 0; y < hauteur; y++) {
    const Y = Math.min(H - 1, Math.floor((y + 0.5) * f))
    for (let x = 0; x < largeur; x++) lab[y * largeur + x] = fin[Y * L + Math.min(L - 1, Math.floor((x + 0.5) * f))]
  }
  /* La distance au bord de couche le plus proche (une vague, bornée). */
  const d = Math.max(1, Math.ceil(0.75 * Math.max(1, echelle)))
  const dist = new Uint8Array(n).fill(255)
  const file = new Int32Array(n)
  let tete = 0, queue = 0
  for (let p = 0; p < n; p++) {
    const x = p % largeur
    if ((x > 0 && lab[p - 1] !== lab[p]) || (x < largeur - 1 && lab[p + 1] !== lab[p]) || (p >= largeur && lab[p - largeur] !== lab[p]) || (p < n - largeur && lab[p + largeur] !== lab[p])) { dist[p] = 0; file[queue++] = p }
  }
  while (tete < queue) {
    const p = file[tete++]
    if (dist[p] > d) continue
    VOISINS(p, largeur, n, q => { if (dist[q] === 255) { dist[q] = dist[p] + 1; file[queue++] = q } })
  }
  /* Les pixels sûrs : tous, sauf la rampe d'un bord et les étrangers (voir
     plus bas) ; les couleurs rivales d'une couche sont celles des couches
     qui la touchent, et le fond si elle touche le vide. */
  const plat = plats(rgba, largeur, hauteur, 18)
  const tons = couches.map(c => c.couleur)
  const voisines = couches.map(() => new Set())
  for (let p = 0; p < n; p++) {
    const l = lab[p]
    if (l < 0) continue
    VOISINS(p, largeur, n, q => { if (lab[q] !== l) voisines[l].add(lab[q]) })
  }
  const rivales = voisines.map(v => [...v].flatMap(a => a >= 0 ? [tons[a]] : fonds))
  /* ÉTRANGER à sa couche : franchement loin de sa teinte (48 niveaux) et
     deux fois et demie plus près de celle d'une voisine — le coin noir
     qu'une IA a laissé dans un triangle bleu. Le bout clair d'une plume
     dorée, loin de la moyenne de sa couche mais sans voisine qui lui
     ressemble, reste à elle. */
  const etranger = (i, l) => {
    const c = tons[l], e = (rgba[i] - c[0]) ** 2 + (rgba[i + 1] - c[1]) ** 2 + (rgba[i + 2] - c[2]) ** 2
    if (e <= 48 * 48) return false
    for (const o of rivales[l]) if (((rgba[i] - o[0]) ** 2 + (rgba[i + 1] - o[1]) ** 2 + (rgba[i + 2] - o[2]) ** 2) * 6.25 < e) return true
    return false
  }
  const sur = new Uint8Array(n)
  const aSur = new Uint8Array(couches.length)
  for (let p = 0; p < n; p++) {
    const l = lab[p], i = p * 4
    if (l < 0 || rgba[i + 3] < 250) continue
    /* La rampe d'un vrai bord (qui n'est pas posée à plat), tout contre un
       bord de couche, se refait ; ailleurs le fichier fait foi — un dégradé
       qui passe d'une couche à l'autre sans bord reste le sien. */
    if (dist[p] <= d && !plat[p]) continue
    if (etranger(i, l)) continue
    sur[p] = 1
    aSur[l] = 1
  }
  /* Une couche trop fine pour avoir un pixel sûr (un filet d'un pixel)
     garde ceux du fichier qui sont à elle, opaques. */
  for (let p = 0; p < n; p++) if (lab[p] >= 0 && !aSur[lab[p]] && rgba[p * 4 + 3] >= 250) sur[p] = 1
  /* La couleur se propage, couche par couche. */
  const col = new Uint8ClampedArray(n * 3)
  const pris = new Uint8Array(n)
  tete = 0; queue = 0
  for (let p = 0; p < n; p++) if (sur[p]) { col[p * 3] = rgba[p * 4]; col[p * 3 + 1] = rgba[p * 4 + 1]; col[p * 3 + 2] = rgba[p * 4 + 2]; pris[p] = 1; file[queue++] = p }
  while (tete < queue) {
    const p = file[tete++]
    VOISINS(p, largeur, n, q => {
      if (pris[q] || lab[q] !== lab[p]) return
      pris[q] = 1
      col[q * 3] = col[p * 3]; col[q * 3 + 1] = col[p * 3 + 1]; col[q * 3 + 2] = col[p * 3 + 2]
      file[queue++] = q
    })
  }
  /* La taille fine : les voisins du fichier de la même couche, en douceur. */
  const ecart = (p, q) => Math.abs(col[p * 3] - col[q * 3]) <= 24 && Math.abs(col[p * 3 + 1] - col[q * 3 + 1]) <= 24 && Math.abs(col[p * 3 + 2] - col[q * 3 + 2]) <= 24
  const sortie = new Uint8ClampedArray(L * H * 4)
  for (let Y = 0; Y < H; Y++) {
    const v = Math.max(0, Math.min(hauteur - 1, (Y + 0.5) / f - 0.5))
    const j0 = Math.floor(v), j1 = Math.min(hauteur - 1, j0 + 1), ty = v - j0
    for (let X = 0; X < L; X++) {
      const l = fin[Y * L + X]
      if (l < 0) continue
      /* Ce que le vecteur a redessiné — un anneau au compas, les lettres
         d'une police — se peint d'un aplat : le reflet cassé d'un anneau
         argenté, les pixels d'une lettre tracée n'y ont plus leur place. */
      if (couches[l].aplat) {
        const o = (Y * L + X) * 4, c = tons[l]
        sortie[o] = c[0]; sortie[o + 1] = c[1]; sortie[o + 2] = c[2]; sortie[o + 3] = 255
        continue
      }
      const u = Math.max(0, Math.min(largeur - 1, (X + 0.5) / f - 0.5))
      const i0 = Math.floor(u), i1 = Math.min(largeur - 1, i0 + 1), tx = u - i0
      let r = 0, g = 0, b = 0, w = 0
      const q0 = j0 * largeur + i0, q1 = j0 * largeur + i1, q2 = j1 * largeur + i0, q3 = j1 * largeur + i1
      /* Quatre voisins sûrs et proches en couleur (un dégradé) : ils se lisent
         ensemble, de quelque couche qu'ils soient — pas de couture. */
      const doux = sur[q0] && sur[q1] && sur[q2] && sur[q3] && ecart(q0, q1) && ecart(q0, q2) && ecart(q0, q3) && ecart(q1, q2) && ecart(q1, q3) && ecart(q2, q3)
      const ajouter = (p, pk) => { if (pk > 0 && pris[p] && (doux || lab[p] === l)) { r += col[p * 3] * pk; g += col[p * 3 + 1] * pk; b += col[p * 3 + 2] * pk; w += pk } }
      ajouter(q0, (1 - tx) * (1 - ty) + 1e-6)
      ajouter(q1, tx * (1 - ty))
      ajouter(q2, (1 - tx) * ty)
      ajouter(q3, tx * ty)
      if (!w) {
        /* Aucun voisin de sa couche : le plus proche à deux pixels, sinon la
           teinte de la couche. */
        const cx = Math.round(u), cy = Math.round(v)
        for (let rr = 1; rr <= 2 && !w; rr++) for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
          const xx = cx + dx, yy = cy + dy
          if (xx < 0 || yy < 0 || xx >= largeur || yy >= hauteur) continue
          ajouter(yy * largeur + xx, 1 / (1 + dx * dx + dy * dy))
        }
      }
      const o = (Y * L + X) * 4
      if (w) { sortie[o] = r / w; sortie[o + 1] = g / w; sortie[o + 2] = b / w } else { const c = tons[l]; sortie[o] = c[0]; sortie[o + 1] = c[1]; sortie[o + 2] = c[2] }
      sortie[o + 3] = 255
    }
  }
  adoucirLesBords(sortie, fin, L, H)
  return { data: sortie, largeur: L, hauteur: H }
}

/* LES ÉTIQUETTES FINES : chaque couche, du dessous au dessus, remplit ses
   tracés (règle pair-impair : un trou reste un trou) ligne de pixels fins
   par ligne de pixels fins ; -1 hors du dessin. `x0`, `y0` : le coin du
   cadre dans l'image de travail. */
export function etiqueter(couches, x0, y0, f, L, H) {
  const lab = new Int16Array(L * H).fill(-1)
  const xs = []
  couches.forEach((c, i) => {
    const bords = []
    for (const b of c.boucles) {
      const m = b.length / 2
      for (let k = 0; k < m; k++) {
        const k2 = k + 1 < m ? k + 1 : 0
        let ax = (b[2 * k] - x0) * f, ay = (b[2 * k + 1] - y0) * f
        let bx = (b[2 * k2] - x0) * f, by = (b[2 * k2 + 1] - y0) * f
        if (ay === by) continue
        if (ay > by) { const tx = ax; ax = bx; bx = tx; const ty = ay; ay = by; by = ty }
        bords.push([ay, by, ax, (bx - ax) / (by - ay)])
      }
    }
    bords.sort((a, b) => a[0] - b[0])
    let prochain = 0
    let actifs = []
    for (let Y = 0; Y < H; Y++) {
      const yc = Y + 0.5
      while (prochain < bords.length && bords[prochain][0] <= yc) actifs.push(bords[prochain++])
      if (!actifs.length) continue
      actifs = actifs.filter(e => e[1] > yc)
      xs.length = 0
      for (const e of actifs) xs.push(e[2] + (yc - e[0]) * e[3])
      xs.sort((a, b) => a - b)
      const o = Y * L
      for (let j = 0; j + 1 < xs.length; j += 2) {
        const xa = Math.max(0, Math.ceil(xs[j] - 0.5)), xb = Math.min(L - 1, Math.floor(xs[j + 1] - 0.5))
        for (let X = xa; X <= xb; X++) lab[o + X] = i
      }
    }
  })
  return lab
}

/* LES BORDS SANS MARCHES : chaque pixel fin qui touche une autre région
   prend la moyenne de ses neuf voisins — l'escalier devient une pente d'un
   pixel fin, la courbe reste nette. */
function adoucirLesBords(rgba, regionsFines, L, H) {
  const n = L * H
  const bord = []
  for (let p = 0; p < n; p++) {
    const z = regionsFines[p]
    const x = p % L
    if ((x > 0 && regionsFines[p - 1] !== z) || (x < L - 1 && regionsFines[p + 1] !== z) || (p >= L && regionsFines[p - L] !== z) || (p < n - L && regionsFines[p + L] !== z)) bord.push(p)
  }
  const moyennes = new Uint8ClampedArray(bord.length * 3)
  bord.forEach((p, k) => {
    const x = p % L, y = (p - x) / L
    let r = 0, g = 0, b = 0, m = 0
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const X = x + dx, Y = y + dy
      if (X < 0 || Y < 0 || X >= L || Y >= H) continue
      const q = Y * L + X
      r += rgba[q * 4]; g += rgba[q * 4 + 1]; b += rgba[q * 4 + 2]; m++
    }
    moyennes[k * 3] = r / m; moyennes[k * 3 + 1] = g / m; moyennes[k * 3 + 2] = b / m
  })
  bord.forEach((p, k) => { rgba[p * 4] = moyennes[k * 3]; rgba[p * 4 + 1] = moyennes[k * 3 + 1]; rgba[p * 4 + 2] = moyennes[k * 3 + 2] })
}

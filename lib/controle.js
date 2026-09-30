/* ======================================================== LE CONTRÔLE PRESSE
   30 septembre 2026 : « qu'on puisse se reposer complètement dessus ». Le
   tracé se jugeait à l'œil ; ici il se MESURE, contre l'image détourée
   qu'il a suivie, et le résultat se lit dans le panneau (lib/studio-
   detourage.js, « Contrôle ») : ce qui part à la presse est vérifié, pas
   supposé. Trois mesures :
   1. LA FIDÉLITÉ (`controler`). Chaque pixel de l'image détourée est-il
      tracé, et rien d'autre ? Les couches du vecteur, remplies comme pour
      la version image (lib/image-nette.js, `etiqueter`), se comparent au
      détourage pixel par pixel. Un écart d'un pixel le long d'un bord
      (l'anticrénelage, le demi-pixel du contour) ne compte pas ; une île
      qui manque — un point, un empattement, une puce — ou qui a été
      ajoutée — un jour bouché, deux lettres soudées — compte, et la plus
      grosse se dit. La couleur aussi : la part de l'encre dont la teinte
      tracée n'est pas celle du fichier.
   2. LA FINESSE (`epaisseurs`). L'épaisseur locale de l'encre — le plus
      grand disque inscrit qui couvre chaque point (Hildebrand et
      Rüegsegger, 1997) — par la distance au fond (Felzenszwalb et
      Huttenlocher, 2012) : le trait le plus fin du logo, et la part de
      l'encre sous une épaisseur donnée. En pixels ici ; la page les lit en
      millimètres à la largeur d'impression choisie — un trait sous 0,3 mm
      ne tient pas en DTF, un texte sous 2,5 mm de haut ne se lit plus.
   3. LES COULEURS (`auNuancier`). La couleur du nuancier OLDA la plus
      proche de chaque teinte, et l'écart que voit l'œil (lib/lab.js) :
      sous `PROCHE`, c'est la même couleur à la presse, la vendeuse peut la
      prendre d'un clic.
   Du calcul pur, dans le fil du vecteur (lib/detourage-travail.js), au
   plus sur `COTE_CONTROLE` pixels de grand côté : un dixième de
   millimètre à 25 cm d'impression. */
import { etiqueter } from './image-nette.js'
import { NUANCIER } from './nuancier.js'
import { ecart } from './lab.js'

export const COTE_CONTROLE = 2048
/* L'épaisseur se mesure jusqu'à deux fois ce rayon (en pixels de
   contrôle) : au-delà, l'encre est épaisse, point. */
export const EPAISSEUR_MAX = 12
/* Sous cet écart (CIEDE2000), une teinte et une couleur du nuancier sont
   la même à la presse. */
export const PROCHE = 5
/* Deux couleurs à plus de ça (le plus grand des trois canaux) ne sont pas
   la même teinte. */
export const TEINTE = 48

/* ------------------------------------------------------ LA DISTANCE AU FOND
   Felzenszwalb et Huttenlocher (2012), exacte, en deux passes de
   paraboles : pour chaque pixel où `dedans[p]` n'est pas nul, le CARRÉ de
   la distance au centre du pixel le plus proche hors de la forme ; 0
   ailleurs. Hors de l'image, c'est du fond (une marge d'un pixel). */
const INF = 1e20
function paraboles(f, n, d, v, z) {
  let k = 0
  v[0] = 0; z[0] = -INF; z[1] = INF
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    while (s <= z[k]) {
      k--
      s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    }
    k++
    v[k] = q; z[k] = s; z[k + 1] = INF
  }
  k = 0
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]
  }
}
export function distances(dedans, l, h) {
  const L = l + 2, H = h + 2, m = Math.max(L, H)
  const g = new Float32Array(L * H)
  const f = new Float32Array(m), d = new Float32Array(m), v = new Int32Array(m), z = new Float32Array(m + 1)
  for (let x = 0; x < L; x++) {
    for (let y = 0; y < H; y++) f[y] = x > 0 && x < L - 1 && y > 0 && y < H - 1 && dedans[(y - 1) * l + x - 1] ? INF : 0
    paraboles(f, H, d, v, z)
    for (let y = 0; y < H; y++) g[y * L + x] = d[y]
  }
  const sortie = new Float32Array(l * h)
  for (let y = 1; y < H - 1; y++) {
    for (let x = 0; x < L; x++) f[x] = g[y * L + x]
    paraboles(f, L, d, v, z)
    for (let x = 1; x < L - 1; x++) sortie[(y - 1) * l + x - 1] = d[x]
  }
  return sortie
}

/* ----------------------------------------------------------- L'ÉPAISSEUR
   L'épaisseur locale de chaque pixel d'encre : le diamètre du plus grand
   disque inscrit qui le couvre. Les centres des disques sont les crêtes de
   la distance au fond (un pixel plus loin du fond que ses huit voisins) ;
   du plus grand au plus petit, chaque crête peint son disque là où rien
   n'est encore peint — le premier peintre est le plus grand. Une crête
   à plus de `max` du fond n'est pas peinte : ce qu'elle couvre est épais.
   Rend `parts` : pour chaque épaisseur t (en pixels, de 0 à 2 max + 1),
   la part de l'encre d'épaisseur t ou moins (la dernière vaut 1) ;
   `fin` : le trait le plus fin — la plus petite épaisseur qui couvre au
   moins `AIRE_FIN` pixels, ou 0,2 % de l'encre (une miette seule n'est
   pas un trait) ; `encre` : les pixels d'encre. */
export const AIRE_FIN = 40
export function epaisseurs(dedans, l, h, max = EPAISSEUR_MAX) {
  const n = l * h
  const d2 = distances(dedans, l, h)
  const d = new Float32Array(n)
  let encre = 0
  for (let p = 0; p < n; p++) { if (d2[p] > 0) { d[p] = Math.sqrt(d2[p]); encre++ } }
  const cretes = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      const p = y * l + x, r = d[p]
      if (!(r > 0) || r > max) continue
      let haut = true
      for (let j = -1; j <= 1 && haut; j++) {
        const Y = y + j
        if (Y < 0 || Y >= h) continue
        for (let i = -1; i <= 1; i++) {
          const X = x + i
          if ((!i && !j) || X < 0 || X >= l) continue
          if (d[Y * l + X] > r) { haut = false; break }
        }
      }
      if (haut) cretes.push(p)
    }
  }
  cretes.sort((a, b) => d[b] - d[a])
  const ep = new Float32Array(n)
  for (const p of cretes) {
    const r = d[p], x0 = p % l, y0 = (p - x0) / l, R = Math.ceil(r), t = 2 * r - 1
    for (let j = -R; j <= R; j++) {
      const Y = y0 + j
      if (Y < 0 || Y >= h) continue
      const w = Math.floor(Math.sqrt(Math.max(0, r * r - j * j)))
      for (let i = -w; i <= w; i++) {
        const X = x0 + i
        if (X < 0 || X >= l) continue
        const q = Y * l + X
        if (d[q] > 0 && !ep[q]) ep[q] = t
      }
    }
  }
  const T = 2 * max + 1
  const compte = new Float64Array(T + 1)
  for (let p = 0; p < n; p++) {
    if (!(d[p] > 0)) continue
    const t = ep[p] ? Math.min(T, Math.max(1, Math.round(ep[p]))) : T
    compte[t]++
  }
  const parts = new Float32Array(T + 1)
  let cumul = 0, fin = 0
  const seuil = Math.max(AIRE_FIN, 0.002 * encre)
  for (let t = 0; t <= T; t++) {
    cumul += compte[t]
    parts[t] = encre ? cumul / encre : 0
    if (!fin && t < T && cumul >= seuil) fin = t
  }
  return { parts, fin, encre }
}

/* ------------------------------------------------------------ LE CONTRÔLE
   `rgba` : l'image détourée (`largeur` × `hauteur`, celle qu'a suivie le
   tracé) ; `cadre` : le cadre du vecteur dedans ; `couches` : ses couches,
   du dessous au dessus (lib/vecteur-lisse.js : { couleur, boucles, aplat,
   nonzero }) ; `echelle` : combien de pixels de cette image pour un pixel
   du fichier reçu (quatre après l'IA) ; `efface` : ce que les lettres
   des polices ont effacé (lib/vecteur-lisse.js) — là, le tracé diffère du
   fichier exprès, ça ne compte pas. Rend, en pixels de contrôle (`L` ×
   `H`, le cadre réduit à `cote` au plus) :
   - `accord` : la part du dessin (détourage ou tracé) où les deux
     s'accordent, à un pixel de bord près ;
   - `ecart` : l'écart moyen du contour — les pixels en désaccord,
     rapportés au périmètre du détourage ;
   - `manque`, `ajout` : les îles perdues ou ajoutées d'au moins
     `ILE` pixels du fichier de côté — leur nombre `n`, et la plus grande :
     son aire `pire`, son `epaisseur` (le plus grand disque inscrit) et sa
     `longueur` (sa boîte) — un filet perdu est long et fin, un jour
     bouché est rond ;
   - `teinte` : la part de l'encre intérieure dont la couleur tracée n'est
     pas celle du fichier (à `TEINTE` près) — nulle sur une version image,
     qui garde les couleurs du fichier ;
   - `finesse` : voir `epaisseurs` ;
   - `L`, `H` : les pixels de contrôle. Null sans couche. */
export const ILE = 1.5
export function controler(rgba, largeur, hauteur, cadre, couches, { echelle = 1, efface = null, cote = COTE_CONTROLE } = {}) {
  if (!couches || !couches.length || !cadre || !(cadre.largeur > 0) || !(cadre.hauteur > 0)) return null
  const f = Math.min(1, cote / Math.max(cadre.largeur, cadre.hauteur))
  const L = Math.max(1, Math.round(cadre.largeur * f)), H = Math.max(1, Math.round(cadre.hauteur * f))
  const n = L * H
  const trace = etiqueter(couches, cadre.x, cadre.y, f, L, H)
  /* Le détourage ramené aux pixels de contrôle : l'opacité et la couleur
     moyennes de ce que chacun couvre. */
  const somme = new Float32Array(n * 4), nb = new Uint16Array(n)
  const x1 = Math.min(largeur, cadre.x + cadre.largeur), y1 = Math.min(hauteur, cadre.y + cadre.hauteur)
  for (let y = Math.max(0, cadre.y); y < y1; y++) {
    const Y = Math.min(H - 1, Math.floor((y - cadre.y + 0.5) * f))
    for (let x = Math.max(0, cadre.x); x < x1; x++) {
      const X = Math.min(L - 1, Math.floor((x - cadre.x + 0.5) * f))
      const p = Y * L + X, i = (y * largeur + x) * 4, a = rgba[i + 3]
      somme[p * 4] += rgba[i] * a; somme[p * 4 + 1] += rgba[i + 1] * a; somme[p * 4 + 2] += rgba[i + 2] * a; somme[p * 4 + 3] += a
      nb[p]++
    }
  }
  const attendu = new Uint8Array(n), encre = new Uint8Array(n)
  for (let p = 0; p < n; p++) {
    attendu[p] = nb[p] && somme[p * 4 + 3] / nb[p] >= 128 ? 1 : 0
    encre[p] = trace[p] >= 0 ? 1 : 0
  }
  /* Ce que les lettres ont effacé, élargi de deux pixels (la rampe de
     l'ancienne lettre) : hors du jugement. */
  const hors = new Uint8Array(n)
  if (efface && efface.masque && efface.largeur) {
    const lignes = Math.floor(efface.masque.length / efface.largeur)
    for (let p = 0; p < n; p++) {
      const X = p % L, Y = (p - X) / L
      const ex = Math.min(efface.largeur - 1, Math.floor((X / f + cadre.x + 0.5) / efface.k))
      const ey = Math.min(lignes - 1, Math.floor((Y / f + cadre.y + 0.5) / efface.k))
      if (efface.masque[ey * efface.largeur + ex] === 1) hors[p] = 1
    }
    let front = []
    for (let p = 0; p < n; p++) if (hors[p]) front.push(p)
    for (let k = 0; k < 2 && front.length; k++) {
      const suivant = []
      for (const p of front) voisins(p, L, n, q => { if (!hors[q]) { hors[q] = 2; suivant.push(q) } })
      front = suivant
    }
  }
  /* Le désaccord, puis sans ses bords (un pixel d'anticrénelage). */
  const D = new Uint8Array(n)
  let union = 0, desaccord = 0, perimetre = 0
  for (let p = 0; p < n; p++) {
    if (hors[p]) continue
    if (attendu[p] || encre[p]) union++
    if (attendu[p] !== encre[p]) { D[p] = 1; desaccord++ }
    if (attendu[p]) {
      const X = p % L
      if (X === 0 || X === L - 1 || p < L || p >= n - L || !attendu[p - 1] || !attendu[p + 1] || !attendu[p - L] || !attendu[p + L]) perimetre++
    }
  }
  const E = new Uint8Array(n)
  let erode = 0
  for (let p = 0; p < n; p++) {
    if (!D[p]) continue
    const X = p % L
    if (X > 0 && X < L - 1 && p >= L && p < n - L && D[p - 1] && D[p + 1] && D[p - L] && D[p + L]) { E[p] = 1; erode++ }
  }
  /* Les îles de désaccord : perdues (attendues, pas tracées) ou ajoutées. */
  const aireMin = Math.max(4, (ILE * echelle * f) ** 2)
  const vu = new Uint8Array(n)
  const manque = { n: 0, pire: 0, epaisseur: 0, longueur: 0 }, ajout = { n: 0, pire: 0, epaisseur: 0, longueur: 0 }
  const pile = []
  const pires = new Map()
  for (let s = 0; s < n; s++) {
    if (!E[s] || vu[s]) continue
    vu[s] = 1
    pile.push(s)
    const pixels = []
    let perdu = 0, x0 = L, x1 = -1, y0 = H, y1 = -1
    while (pile.length) {
      const p = pile.pop(), X = p % L, Y = (p - X) / L
      pixels.push(p)
      if (attendu[p]) perdu++
      if (X < x0) x0 = X
      if (X > x1) x1 = X
      if (Y < y0) y0 = Y
      if (Y > y1) y1 = Y
      voisins(p, L, n, q => { if (E[q] && !vu[q]) { vu[q] = 1; pile.push(q) } })
    }
    const aire = pixels.length
    if (aire < aireMin) continue
    const ile = perdu * 2 >= aire ? manque : ajout
    ile.n++
    if (aire > ile.pire) { ile.pire = aire; pires.set(ile, { pixels, x0, y0, x1, y1 }) }
  }
  /* La plus grande île de chaque sorte : son épaisseur — deux fois sa
     distance au fond la plus grande (mesurée de centre à centre de
     pixel : un demi-pixel de chaque côté en plus) —, sa longueur — sa
     boîte. Érodée d'un pixel de chaque côté : les deux reprennent les
     deux. */
  for (const [ile, g] of pires) {
    const l = g.x1 - g.x0 + 1, h = g.y1 - g.y0 + 1
    const m = new Uint8Array(l * h)
    for (const p of g.pixels) { const X = p % L, Y = (p - X) / L; m[(Y - g.y0) * l + X - g.x0] = 1 }
    const d2 = distances(m, l, h)
    let haut = 0
    for (let i = 0; i < d2.length; i++) if (d2[i] > haut) haut = d2[i]
    ile.epaisseur = 2 * (Math.sqrt(haut) + 1) + 1
    ile.longueur = Math.max(l, h) + 2
  }
  /* La couleur, au cœur de l'encre (loin d'un bord de couche). */
  let interieur = 0, faux = 0
  for (let p = 0; p < n; p++) {
    if (!attendu[p] || !encre[p] || hors[p] || !nb[p]) continue
    const X = p % L, z = trace[p]
    if (X === 0 || X === L - 1 || p < L || p >= n - L || trace[p - 1] !== z || trace[p + 1] !== z || trace[p - L] !== z || trace[p + L] !== z) continue
    interieur++
    const c = couches[z].couleur, a = somme[p * 4 + 3] || 1
    if (Math.max(Math.abs(somme[p * 4] / a - c[0]), Math.abs(somme[p * 4 + 1] / a - c[1]), Math.abs(somme[p * 4 + 2] / a - c[2])) > TEINTE) faux++
  }
  return {
    accord: union ? 1 - erode / union : 1,
    ecart: perimetre ? desaccord / perimetre : 0,
    manque, ajout,
    teinte: interieur ? faux / interieur : 0,
    finesse: epaisseurs(encre, L, H),
    L, H,
  }
}
const voisins = (p, L, n, f) => {
  const x = p % L
  if (x > 0) f(p - 1)
  if (x < L - 1) f(p + 1)
  if (p >= L) f(p - L)
  if (p < n - L) f(p + L)
}

/* --------------------------------------------------------- LE NUANCIER OLDA
   La couleur du nuancier la plus proche d'une teinte sRVB, et l'écart que
   voit l'œil (CIEDE2000) : { nom, rvb, cmjn, ecart }. */
export function auNuancier(rvb) {
  let meilleure = null
  for (const c of NUANCIER) {
    const e = ecart(rvb, c.rvb)
    if (!meilleure || e < meilleure.ecart) meilleure = { nom: c.nom, rvb: c.rvb, cmjn: c.cmjn, ecart: e }
  }
  return meilleure
}

/* LA PART DE L'ENCRE SOUS UNE ÉPAISSEUR, lue dans `parts` (voir
   `epaisseurs`) à `t` pixels — entre deux entiers, en douceur. */
export function partSous(parts, t) {
  if (!parts || !parts.length) return 0
  if (t <= 0) return 0
  const T = parts.length - 1
  if (t >= T) return 1
  const a = Math.floor(t), b = Math.min(T, a + 1), k = t - a
  return parts[a] * (1 - k) + parts[b] * k
}

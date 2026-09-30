/* ========================================================= LE VECTEUR LISSE
   27 septembre 2026 : « un bouton qui permet de vectoriser un logo, et
   qu'il soit parfaitement lisse et haut de gamme, utilisable ». Le tracé
   d'imagetracer suit les pixels : sur un logo JPEG, ses bords tremblent.
   Ici, le contour se calcule comme le ferait un graphiste :
   1. LA COUVERTURE : chaque pixel dit à quel point il appartient à chaque
      teinte du logo — pas oui ou non : le pixel du bord, à moitié blanc à
      moitié bleu, compte pour moitié. L'ombre portée (le fond, assombri)
      compte pour du fond : le logo sort à plat.
   2. UN LÉGER FLOU sur cette couverture efface le grain du JPEG.
   3. LE CONTOUR passe exactement là où la couverture vaut la moitié
      (« marching squares », interpolé : au centième de pixel, pas en
      escalier).
   4. LES POINTES restent pointues (un angle franc est repéré et gardé) ;
      entre elles, le contour se lisse puis se redessine en courbes de
      Bézier, le moins possible, à moins d'un demi-pixel du vrai bord.
   Les teintes s'empilent sans jour entre elles : chaque couche couvre
   aussi la place des couches posées au-dessus. */
import { paletteAuto, palette, estOmbre, reduire, agrandir } from './vectoriser.js'
import { formesParfaites, anneaux, arcs, rayonProfil, bordDessine } from './geometrie.js'
import { lab, ecartLab, ecart as ecartOeil } from './lab.js'
import { lignesTexte, glyphesDe, noter, glyphesSvg, polygones, cheminPose, ligneDe, remplir as remplirPolys } from './polices.js'
import { encreLigne, poserTexte, cheminEcriture } from './ecriture.js'

/* Le travail se fait sur 2 400 px au plus : au-delà, le contour n'y gagne
   rien et le calcul traîne. */
const COTE_MAX = 2400
const COTE_MIN = 2000
/* Un dégradé tracé en tons (voir `tons`) se trace sur 1 600 px au plus :
   seize couches y coûtent trois fois moins, et ses courbes n'y perdent rien
   (l'image nette, elle, se refait à 4 096 px, lib/image-nette.js). */
const COTE_TONS = 1600
const TONS_MAX = 16

/* LES TEINTES ET LE FOND : les teintes du logo, et tout ce qui est fond —
   la couleur retirée et ses ombres. */
export function teintes(data, fonds = [], garder = false, trouer = true, fusion = 1, largeur = 0, pas = 1) {
  /* Le fond gardé à l'intérieur (« Extérieur seulement ») n'est pas une
     teinte du logo : un DTF ne l'imprime pas — sauf quand le détourage fait
     foi (`garder`) : ce qu'il a laissé opaque est du logo (le script blanc
     dans un disque noir). */
  const pal = nuancesFondues(data, paletteAuto(data, fonds), fusion, largeur, pas).filter(c => garder || !fonds.some(f => Math.hypot(c[0] - f[0], c[1] - f[1], c[2] - f[2]) < 40))
  /* Le blanc que le détourage a gardé DANS le dessin (le reflet d'une aile,
     27 septembre 2026 : « j'ai des trous dans le logo ») est une teinte du
     logo, même peu présent : sans elle, il se lisait comme du fond et le
     tracé le perçait. */
  if (garder && !trouer) {
    const pas = Math.max(1, Math.floor(data.length / 4 / 200000))
    for (const f of fonds) {
      if (pal.some(c => Math.hypot(c[0] - f[0], c[1] - f[1], c[2] - f[2]) < 48)) continue
      let total = 0, proches = 0
      for (let i = 0; i < data.length; i += 4 * pas) {
        if (data[i + 3] < 250) continue
        total++
        if (Math.max(Math.abs(data[i] - f[0]), Math.abs(data[i + 1] - f[1]), Math.abs(data[i + 2] - f[2])) < 30) proches++
      }
      if (proches >= 20 && proches > total * 0.0005) pal.push(f.map(Math.round))
    }
  }
  const ombres = pal.filter(c => estOmbre(c, fonds))
  const logo = pal.filter(c => !ombres.includes(c))
  return { logo: logo.length ? logo : pal.slice(0, 1), fond: fonds.concat(logo.length ? ombres : []), ombres: logo.length ? ombres : [] }
}

/* LES NUANCES D'UN MÊME DÉGRADÉ N'EN FONT QU'UNE : un doré qui brille,
   un blanc et le gris de son relief. Tracées à part, elles faisaient des
   taches. Mais deux couleurs voisines d'un logo à plat restent deux (29
   septembre 2026 : le vert sauge d'un crabe et le vert plus sombre de
   « LA PISCINE », le rose et le pêche de ses facettes se fondaient — le
   texte sortait plus pâle et plus gras). Ce qui les distingue n'est pas
   leur écart mais le chemin de l'une à l'autre : un dégradé passe en
   douceur d'un ton au suivant — des pixels posés à plat (`plats`) ont
   toutes les couleurs d'entre les deux — ; deux couleurs d'un logo se
   touchent par un bord net, ou pas du tout. Deux teintes se fondent donc :
   - quasi pareilles pour l'œil (lib/lab.js : moins de 3 + 3 × `fusion`,
     6 d'office), le grain d'un JPEG ;
   - ou reliées en douceur dans l'image, à moins de 30 × `fusion` ;
   - et toujours sans qu'aucune ne s'écarte de la couleur du groupe de
     plus de 16 × `fusion` (un dégradé) ou 7 × `fusion` (des tons
     voisins) : un dégradé du noir au blanc n'est pas une couleur.
   `fusion` : 1 d'office ; plus haut, des familles plus larges (moins de
   teintes) ; 0, chaque nuance reste la sienne (le curseur « Nuances »).
   La teinte gardée est leur moyenne, pesée par leur place. */
export function memeFamille(a, b, fusion = 1) {
  return ecartOeil(a, b) < 12 * fusion
}
export function nuancesFondues(data, pal, fusion = 1, largeur = 0, pas = 1) {
  return nuancesGroupees(data, pal, fusion, largeur, pas).teintes
}
/* La même chose, et pour chaque teinte de `pal` le numéro de celle qui
   l'a reprise (`groupe`) : un ton qui s'est fondu se reconnaît encore.
   `largeur` : celle de l'image, pour lire les dégradés (sans elle, seul
   l'écart compte). `pas` : un pixel du fichier, en pixels de l'image —
   agrandie, le bord net entre deux couleurs devient une rampe douce de
   quelques pixels, qui n'est pas un dégradé : le dégradé se lit par-dessus
   (`plats`, deux pixels et demi du fichier de part et d'autre). */
export function nuancesGroupees(data, pal, fusion = 1, largeur = 0, pas = 1) {
  const k = pal.length
  if (k < 2 || !(fusion > 0)) return { teintes: pal.map(c => c.slice()), groupe: pal.map((_, i) => i) }
  const N = data.length / 4
  /* Chaque pixel plein prend son ton le plus proche (à 4 niveaux près, une
     fois par couleur). */
  const lab1 = new Int8Array(N).fill(-1), memoire = new Map()
  const n = new Float64Array(k)
  let total = 0
  for (let p = 0; p < N; p++) {
    const i = p * 4
    if (data[i + 3] < 128) continue
    const cle = (data[i] >> 2) << 12 | (data[i + 1] >> 2) << 6 | data[i + 2] >> 2
    let a = memoire.get(cle)
    if (a === undefined) {
      let d1 = Infinity
      a = 0
      for (let j = 0; j < k; j++) { const c = pal[j], d = (data[i] - c[0]) ** 2 + (data[i + 1] - c[1]) ** 2 + (data[i + 2] - c[2]) ** 2; if (d < d1) { d1 = d; a = j } }
      memoire.set(cle, a)
    }
    lab1[p] = a
    n[a]++
    total++
  }
  /* LE DÉGRADÉ QUI RELIE DEUX TONS : là où, posés à plat (`plats`, lus
     par-dessus la rampe d'un bord), un pixel d'un ton touche en douceur un
     pixel de l'autre, à `ecartDe` pixels — le dégradé passe de l'un à
     l'autre. Deux facettes d'un crabe, l'une claire, l'autre sombre,
     séparées d'un filet blanc, ne se touchent jamais : elles restent deux,
     même si chacune a son léger modelé. */
  const rencontres = new Float64Array(k * k)
  if (largeur) {
    const hauteur = N / largeur
    const ecartDe = Math.max(1, Math.round(2.5 * pas)), seuil = Math.max(18, 3 * ecartDe)
    const plat = plats(data, largeur, hauteur, seuil, ecartDe)
    /* Loin du vide : le bord d'une facette qui pâlit vers le blanc (ou le
       jour entre deux facettes) n'est pas un dégradé. */
    const vide = new Float32Array(N)
    for (let p = 0; p < N; p++) if (data[p * 4 + 3] < 250) vide[p] = 1
    const presDuVide = maxLocal(vide, largeur, hauteur, ecartDe + 1)
    const doux = (p, q) => Math.max(Math.abs(data[p * 4] - data[q * 4]), Math.abs(data[p * 4 + 1] - data[q * 4 + 1]), Math.abs(data[p * 4 + 2] - data[q * 4 + 2])) <= seuil
    for (let y = 0; y < hauteur; y++) {
      for (let x = 0; x < largeur; x++) {
        const p = y * largeur + x, a = lab1[p]
        if (a < 0 || !plat[p] || presDuVide[p]) continue
        for (const q of [x + ecartDe < largeur ? p + ecartDe : -1, y + ecartDe < hauteur ? p + ecartDe * largeur : -1]) {
          if (q < 0) continue
          const b = lab1[q]
          if (b < 0 || b === a || !plat[q] || presDuVide[q] || !doux(p, q)) continue
          rencontres[a * k + b]++
          rencontres[b * k + a]++
        }
      }
    }
  }
  const labs = pal.map(lab)
  const quasi = 3 + 3 * Math.min(1, fusion) + 6 * Math.max(0, fusion - 1)
  const liens = []
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const e = ecartLab(labs[i], labs[j])
      /* Un ton que presque rien ne porte (moins de trois pour mille) et
         proche d'un autre : le grain, pas une couleur. */
      const grain = Math.min(n[i], n[j]) < total * 0.003 && e < 12 * fusion
      const degrade = rencontres[i * k + j] > 0 && e < 30 * fusion
      if (e < quasi || grain || degrade) liens.push([e, i, j, degrade && !(e < quasi || grain)])
    }
  }
  liens.sort((a, b) => a[0] - b[0])
  const chef = pal.map((_, i) => i)
  const trouver = i => { while (chef[i] !== i) i = chef[i] = chef[chef[i]]; return i }
  const membres = pal.map((_, i) => [i])
  const moyenne = ids => {
    const t = ids.reduce((s, i) => s + (n[i] || 1e-6), 0)
    return [0, 1, 2].map(c => ids.reduce((s, i) => s + pal[i][c] * (n[i] || 1e-6), 0) / t)
  }
  /* Un groupe tenu par un dégradé s'étend jusqu'à 16 × `fusion` de sa
     moyenne ; des tons seulement voisins, jusqu'à 7 × `fusion` : le vert
     d'un texte ne rejoint pas, de proche en proche, le vert sauge du
     dessin. Et deux groupes ne se relient par un dégradé que s'ils se
     touchent en douceur sur trois centièmes au moins du plus petit : quelques
     pixels de modelé qui se ressemblent ne font pas un dégradé. */
  const parDegrade = pal.map(() => false)
  const aire = ids => ids.reduce((s, i) => s + n[i], 0)
  for (const [, i, j, d] of liens) {
    const a = trouver(i), b = trouver(j)
    if (a === b) continue
    const ids = membres[a].concat(membres[b])
    if (d) {
      let r = 0
      for (const x of membres[a]) for (const y of membres[b]) r += rencontres[x * k + y]
      if (r < Math.max(8, 0.03 * Math.min(aire(membres[a]), aire(membres[b])))) continue
    }
    const m = lab(moyenne(ids))
    const large = d || parDegrade[a] || parDegrade[b]
    if (ids.some(x => ecartLab(labs[x], m) > (large ? 16 : 7) * fusion)) continue
    chef[b] = a
    membres[a] = ids
    membres[b] = []
    parDegrade[a] = large
  }
  const groupes = pal.map((_, i) => i).filter(i => trouver(i) === i).map(i => membres[i])
  groupes.sort((g, h) => h.reduce((s, i) => s + n[i], 0) - g.reduce((s, i) => s + n[i], 0))
  const groupe = pal.map(() => 0)
  groupes.forEach((g, gi) => g.forEach(i => { groupe[i] = gi }))
  return { teintes: groupes.map(g => moyenne(g).map(Math.round)), groupe }
}

/* LES TRAITS FINS NE SE CASSENT PAS : un filet d'un pixel ne couvre jamais
   son pixel en entier, et le flou l'éteint encore — sous la moitié, il
   disparaissait par endroits. Chaque point se compare au plus couvert de
   son voisinage : un filet pâle est remonté (sans s'épaissir au-delà de
   son flou), une grande forme ne change pas.
   `avant` : la carte d'avant le flou. Un filet est pâle PARCE QUE le flou
   l'a éteint : son sommet d'avant le dépasse de loin. Une plage à demi
   couverte avait déjà ce sommet avant le flou : ce n'est pas un filet, elle
   ne bouge pas (28 septembre 2026 : un anneau d'or sombre, lu aux trois
   quarts doré, voyait son quart de vide remonté en un trait noir qui le
   fendait en deux). */
export function renforcer(carte, largeur, hauteur, r, min = 0.05, avant = null) {
  const n = largeur * hauteur
  const M = maxLocal(carte, largeur, hauteur, r)
  const A = avant ? maxLocal(avant, largeur, hauteur, r) : null
  const sortie = new Float32Array(n)
  /* Seul un filet qui s'éteindrait (sommet sous 0,6) est remonté, juste
     assez pour rester : une lettre normale garde son épaisseur exacte.
     Sous `min`, ce n'est pas un filet : une trace. */
  for (let i = 0; i < n; i++) sortie[i] = M[i] >= 0.6 || M[i] < min || (A && M[i] > 0.75 * A[i]) ? carte[i] : Math.min(1, carte[i] * 0.6 / M[i])
  return sortie
}

/* LES JOURS D'UN LOGO EN UNE COULEUR (27 septembre 2026, « quand je
   choisis une de nos couleurs, ça ne fonctionne pas du tout » : un texte
   blanc à côté d'un emblème doré disparaissait). Chaque morceau de clair
   (sa couverture passe 0,35) se juge sur ce qui le borde : plus de foncé
   que de vide, c'est un jour ; sinon, du dessin. Rend 1 sur les jours,
   élargis de deux pixels (leur bord fondu part avec eux). */
export function jours(clair, fonce, largeur, hauteur) {
  const n = largeur * hauteur
  const morceau = new Int32Array(n).fill(-1)
  const pile = new Int32Array(n)
  const verdict = []
  for (let p0 = 0; p0 < n; p0++) {
    if (morceau[p0] >= 0 || clair[p0] < 0.35) continue
    const m = verdict.length
    let vide = 0, fonces = 0, haut = 0
    morceau[p0] = m
    pile[haut++] = p0
    while (haut) {
      const p = pile[--haut]
      const x = p % largeur
      for (let v = 0; v < 4; v++) {
        const q = v === 0 ? (x > 0 ? p - 1 : -1) : v === 1 ? (x < largeur - 1 ? p + 1 : -1) : v === 2 ? p - largeur : p + largeur
        if (q < 0 || q >= n) { vide++; continue }
        if (clair[q] >= 0.35) { if (morceau[q] < 0) { morceau[q] = m; pile[haut++] = q } continue }
        if (fonce[q] > 1 - clair[q] - fonce[q]) fonces++
        else vide++
      }
    }
    verdict.push(fonces > vide ? 1 : 0)
  }
  const jour = new Float32Array(n)
  for (let p = 0; p < n; p++) if (morceau[p] >= 0 && verdict[morceau[p]]) jour[p] = 1
  return maxLocal(jour, largeur, hauteur, 2)
}

/* LE PLUS GRAND DANS UN CARRÉ DE CÔTÉ 2r+1 (van Herk) : trois comparaisons
   par pixel, quel que soit r — le curseur du lissage répond tout de suite. */
function maxLigne(src, dst, n, pas, depart, r, g, d) {
  const w = 2 * r + 1
  for (let i = 0; i < n; i++) {
    const v = src[depart + i * pas]
    g[i] = i % w === 0 ? v : Math.max(g[i - 1], v)
  }
  for (let i = n - 1; i >= 0; i--) {
    const v = src[depart + i * pas]
    d[i] = i === n - 1 || (i + 1) % w === 0 ? v : Math.max(d[i + 1], v)
  }
  const bloc = i => Math.floor(i / w)
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - r), b = Math.min(n - 1, i + r)
    let v
    if (a === 0 && b === n - 1) { v = g[b]; for (let j = 0; j <= b; j += w) v = Math.max(v, d[j]) }
    else if (a === 0) v = g[b]
    else if (bloc(a) === bloc(b)) v = d[a]
    else v = Math.max(d[a], g[b])
    dst[depart + i * pas] = v
  }
}
/* Le même, de haut en bas, ligne après ligne. */
function maxColonnes(src, dst, largeur, hauteur, r) {
  const w = 2 * r + 1, n = largeur * hauteur
  const g = new Float32Array(n), d = new Float32Array(n)
  for (let y = 0; y < hauteur; y++) {
    const o = y * largeur
    if (y % w === 0) for (let x = 0; x < largeur; x++) g[o + x] = src[o + x]
    else for (let x = 0; x < largeur; x++) g[o + x] = Math.max(g[o - largeur + x], src[o + x])
  }
  for (let y = hauteur - 1; y >= 0; y--) {
    const o = y * largeur
    if (y === hauteur - 1 || (y + 1) % w === 0) for (let x = 0; x < largeur; x++) d[o + x] = src[o + x]
    else for (let x = 0; x < largeur; x++) d[o + x] = Math.max(d[o + largeur + x], src[o + x])
  }
  const bloc = i => Math.floor(i / w)
  for (let y = 0; y < hauteur; y++) {
    const a = Math.max(0, y - r), b = Math.min(hauteur - 1, y + r), o = y * largeur
    const oa = a * largeur, ob = b * largeur
    if (a === 0 && b === hauteur - 1) {
      for (let x = 0; x < largeur; x++) { let v = g[ob + x]; for (let j = 0; j <= b; j += w) v = Math.max(v, d[j * largeur + x]); dst[o + x] = v }
    } else if (a === 0) for (let x = 0; x < largeur; x++) dst[o + x] = g[ob + x]
    else if (bloc(a) === bloc(b)) for (let x = 0; x < largeur; x++) dst[o + x] = d[oa + x]
    else for (let x = 0; x < largeur; x++) dst[o + x] = Math.max(d[oa + x], g[ob + x])
  }
}
export function maxLocal(carte, largeur, hauteur, r) {
  const tmp = new Float32Array(carte.length)
  const sortie = new Float32Array(carte.length)
  const m = Math.max(largeur, hauteur)
  const g = new Float32Array(m), d = new Float32Array(m)
  for (let y = 0; y < hauteur; y++) maxLigne(carte, tmp, largeur, 1, y * largeur, r, g, d)
  maxColonnes(tmp, sortie, largeur, hauteur, r)
  return sortie
}

/* UN LOGO EN DÉGRADÉ (un phénix ombré, un doré qui brille) : plus d'un
   pixel sur sept à plus de 20 niveaux de toute teinte à plat (un aplat de
   JPEG en compte moins d'un sur cent). Ses aplats perdraient le modelé : il
   garde alors les couleurs de l'image dans son contour. Le dégradé se juge
   aussi HORS DE LA TEINTE QUI DOMINE (27 septembre 2026) : des filets dorés
   qui brillent sur un grand disque noir — le noir, à plat, cachait leur
   dégradé, et leur reflet sortait en taches blanches. Plus d'un vingtième
   du logo hors d'elle, à plus de 40 % loin de ses teintes : un dégradé. */
export function estDegrade(data, logo) {
  if (!logo.length) return false
  const compte = logo.map(() => 0), loins = logo.map(() => 0)
  let n = 0, loin = 0
  const pas = Math.max(1, Math.floor(data.length / 4 / 60000))
  for (let p = 0; p < data.length / 4; p += pas) {
    const i = p * 4
    if (data[i + 3] < 250) continue
    n++
    let m = Infinity, k = 0
    logo.forEach((c, j) => { const d = (data[i] - c[0]) ** 2 + (data[i + 1] - c[1]) ** 2 + (data[i + 2] - c[2]) ** 2; if (d < m) { m = d; k = j } })
    compte[k]++
    if (m > 20 * 20) { loin++; loins[k]++ }
  }
  if (!n) return false
  if (loin / n > 0.15) return true
  const k0 = compte.indexOf(Math.max(...compte))
  const reste = n - compte[k0]
  return reste > n * 0.05 && (loin - loins[k0]) / reste > 0.4
}

/* LA COULEUR POSÉE À PLAT : un pixel dont les voisins de part et d'autre
   (à gauche et à droite, dessus et dessous) ne s'écartent pas de plus de
   `seuil` niveaux l'un de l'autre. Un aplat, un dégradé doux, le milieu
   d'un filet fin (ses deux bords se ressemblent) le sont ; la rampe d'un
   bord anticrénelé — le doré qui passe au fond — ne l'est jamais. C'est là
   seulement qu'une couleur se lit comme un ton du logo. */
export function plats(data, largeur, hauteur, seuil = 18, pas = 1) {
  const n = largeur * hauteur
  const plat = new Uint8Array(n)
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      const p = y * largeur + x
      if (data[p * 4 + 3] < 250) continue
      const g = (x >= pas ? p - pas : p) * 4, d = (x < largeur - pas ? p + pas : p) * 4
      const h = (y >= pas ? p - pas * largeur : p) * 4, b = (y < hauteur - pas ? p + pas * largeur : p) * 4
      let e = 0
      for (let c = 0; c < 3; c++) e = Math.max(e, Math.abs(data[g + c] - data[d + c]), Math.abs(data[h + c] - data[b + c]))
      if (e <= seuil) plat[p] = 1
    }
  }
  return plat
}

/* LE GRAIN S'EFFACE, LES BORDS RESTENT (diffusion de Perona et Malik) :
   à chaque tour, chaque pixel se rapproche de ses quatre voisins — d'autant
   moins qu'ils s'en écartent. Le grain d'un JPEG, le bruit de l'IA (quelques
   niveaux) fondent ; un vrai bord (des dizaines de niveaux) ne bouge pas.
   Sur un dégradé tracé en tons, la frontière entre deux tons suit alors une
   courbe douce au lieu de trembler avec le grain (27 septembre 2026, un
   phénix en 24 tons, « déchiqueté »). `seuil` : l'écart, en niveaux, où un
   voisin ne compte plus qu'à moitié. */
export function diffuser(data, largeur, hauteur, tours = 8, seuil = 12) {
  const n = largeur * hauteur
  let a = new Float32Array(n * 3), b = new Float32Array(n * 3)
  for (let p = 0; p < n; p++) { a[p * 3] = data[p * 4]; a[p * 3 + 1] = data[p * 4 + 1]; a[p * 3 + 2] = data[p * 4 + 2] }
  const k2 = seuil * seuil
  for (let t = 0; t < tours; t++) {
    for (let y = 0; y < hauteur; y++) {
      for (let x = 0; x < largeur; x++) {
        const p = y * largeur + x, i = p * 3
        let s0 = 0, s1 = 0, s2 = 0
        for (let v = 0; v < 4; v++) {
          const q = v === 0 ? (x > 0 ? p - 1 : p) : v === 1 ? (x < largeur - 1 ? p + 1 : p) : v === 2 ? (y > 0 ? p - largeur : p) : (y < hauteur - 1 ? p + largeur : p)
          const j = q * 3
          const d0 = a[j] - a[i], d1 = a[j + 1] - a[i + 1], d2 = a[j + 2] - a[i + 2]
          const g = 1 / (1 + (d0 * d0 + d1 * d1 + d2 * d2) / k2)
          s0 += g * d0; s1 += g * d1; s2 += g * d2
        }
        b[i] = a[i] + 0.2 * s0; b[i + 1] = a[i + 1] + 0.2 * s1; b[i + 2] = a[i + 2] + 0.2 * s2
      }
    }
    const c = a; a = b; b = c
  }
  const sortie = new Uint8ClampedArray(data)
  for (let p = 0; p < n; p++) { sortie[p * 4] = a[p * 3]; sortie[p * 4 + 1] = a[p * 3 + 1]; sortie[p * 4 + 2] = a[p * 3 + 2] }
  return sortie
}

/* LES TONS D'UN DÉGRADÉ (27 septembre 2026 : « quand on zoome, tout n'est
   pas parfait — le trait blanc en arc de cercle, il va de soi qu'il doit
   être parfait »). Un dégradé ne se garde plus en image dans son contour :
   il se trace en tons — le doré sombre, le doré, sa lumière, le filet
   clair —, chacun une vraie forme vectorielle, nette à tous les zooms.
   Des k-moyennes sur les pixels pleins du dessin où la couleur est posée à
   plat (`plat`, voir `plats` : pas la rampe d'un bord, où deux couleurs se
   mêlent), de plus en plus de tons jusqu'à ce que presque tous les pixels
   (97 %) soient à moins de 14 niveaux du leur, 16 au plus ; deux tons à
   moins de 10 niveaux n'en font qu'un. Une ombre du fond n'en est pas un.
   Les dégradés restent entiers dans la version image, toujours là. */
export function tons(data, fonds = [], max = TONS_MAX, plat = null) {
  const n = data.length / 4
  const pas = Math.max(1, Math.floor(n / 80000))
  const pts = []
  for (let p = 0; p < n; p += pas) {
    const i = p * 4
    if (data[i + 3] < 250 || (plat && !plat[p])) continue
    const c = [data[i], data[i + 1], data[i + 2]]
    if (estOmbre(c, fonds)) continue
    pts.push(c[0], c[1], c[2], 255)
  }
  if (!pts.length) return []
  const echantillon = Uint8ClampedArray.from(pts)
  const m = echantillon.length / 4
  let centres = []
  for (const k of [6, 9, 12, max]) {
    centres = palette(echantillon, Math.min(k, max))
    let loin = 0
    for (let i = 0; i < echantillon.length; i += 4) {
      let d = Infinity
      for (const c of centres) d = Math.min(d, (echantillon[i] - c[0]) ** 2 + (echantillon[i + 1] - c[1]) ** 2 + (echantillon[i + 2] - c[2]) ** 2)
      if (d > 14 * 14) loin++
    }
    if (loin <= m * 0.03 || k >= max) break
  }
  const gardes = []
  for (const c of centres) if (!gardes.some(g => Math.hypot(g[0] - c[0], g[1] - c[1], g[2] - c[2]) < 10)) gardes.push(c)
  return gardes
}

/* L'IMAGE DANS LE CONTOUR, PLEINE : le contour vectoriel fait le bord, pas
   la transparence. LE DEDANS DU LOGO GARDE SES COULEURS, telles que le
   fichier les donne (27 septembre 2026 : « le résultat pendant la
   vectorisation est parfait, l'intérieur des lettres, les couleurs — une
   fois terminé, non ») : le blanc entre un O noir et sa pastille jaune, le
   reflet pâle d'une aile, l'ombre d'un pétale de papier sont du dessin, même
   couleur de fond. Seul LE BORD, à deux pixels du vide, peut être teinté de
   fond (l'anticrénelage, le halo d'un JPEG) : un pixel du bord plus près du
   fond que du logo, ou à moins de moitié opaque, prend la couleur d'un
   voisin sûr — un filet doré sur fond noir ne sort ni pâle ni sali. Tout
   devient opaque. */
export function remplir(rgba, largeur, hauteur, logo, fond = []) {
  const n = largeur * hauteur
  const sortie = new Uint8ClampedArray(rgba)
  const sur = new Uint8Array(n)
  const proche = (r, g, b, liste) => { let m = Infinity, k = -1; liste.forEach((c, j) => { const d = (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2; if (d < m) { m = d; k = j } }); return [m, k] }
  const vide = new Float32Array(n)
  for (let p = 0; p < n; p++) if (rgba[p * 4 + 3] < 128) vide[p] = 1
  const bord = maxLocal(vide, largeur, hauteur, 2)
  for (let p = 0; p < n; p++) {
    const i = p * 4
    if (vide[p]) continue
    if (!bord[p] || !fond.length) { sur[p] = 1; continue }
    const [dl] = proche(rgba[i], rgba[i + 1], rgba[i + 2], logo)
    const [df] = proche(rgba[i], rgba[i + 1], rgba[i + 2], fond)
    if (dl <= df) sur[p] = 1
  }
  /* Les autres prennent la couleur du pixel sûr le plus proche : une vague
     part des pixels sûrs et remplit tout le reste. */
  const file = new Int32Array(n)
  let tete = 0, queue = 0
  for (let p = 0; p < n; p++) if (sur[p]) file[queue++] = p
  while (tete < queue) {
    const p = file[tete++]
    const x = p % largeur
    for (let v = 0; v < 4; v++) {
      const q = v === 0 ? (x > 0 ? p - 1 : -1) : v === 1 ? (x < largeur - 1 ? p + 1 : -1) : v === 2 ? p - largeur : p + largeur
      if (q < 0 || q >= n || sur[q]) continue
      sur[q] = 2
      sortie.set(sortie.subarray(p * 4, p * 4 + 3), q * 4)
      file[queue++] = q
    }
  }
  for (let p = 0; p < n; p++) {
    const i = p * 4
    if (!sur[p] && logo.length) sortie.set(logo[proche(rgba[i], rgba[i + 1], rgba[i + 2], logo)[1]].map(Math.round), i)
    sortie[i + 3] = 255
  }
  return sortie
}

/* LES COULEURS DU FOND, lues sur l'image reçue là où le détourage a tout
   effacé : les teintes qui pèsent au moins un dixième. Un pixel déjà
   transparent dans le fichier (un PNG détouré) n'a pas de couleur : son
   « noir invisible » n'est pas un fond. */
export function fondsLus(source, detoure) {
  const n = detoure.length / 4
  const pas = Math.max(1, Math.floor(n / 60000))
  const pts = []
  for (let p = 0; p < n; p += pas) {
    const i = p * 4
    if (detoure[i + 3] === 0 && source[i + 3] >= 128) pts.push(source[i], source[i + 1], source[i + 2], 255)
  }
  if (pts.length < 40) return []
  const data = Uint8ClampedArray.from(pts)
  const centres = palette(data, 3)
  const poids = centres.map(() => 0)
  for (let i = 0; i < data.length; i += 4) {
    let m = Infinity, k = 0
    centres.forEach((c, j) => { const d = (data[i] - c[0]) ** 2 + (data[i + 1] - c[1]) ** 2 + (data[i + 2] - c[2]) ** 2; if (d < m) { m = d; k = j } })
    poids[k]++
  }
  return centres.filter((_, j) => poids[j] >= data.length / 4 * 0.1).map(c => c.map(Math.round))
}

/* LA ZONE DU LOGO, élargie de `r` pixels. */
export function elargir(data, largeur, hauteur, r) {
  const n = largeur * hauteur
  const a = new Float32Array(n)
  /* Un pixel que l'IA ne croit qu'à moitié compte en entier : c'est la
     couleur de l'image reçue qui tranche. */
  for (let p = 0; p < n; p++) a[p] = data[p * 4 + 3] > 12 ? 1 : 0
  return maxLocal(a, largeur, hauteur, r)
}

/* LA COUVERTURE DE CHAQUE TEINTE, de 0 à 1. Un pixel se range sur le
   segment qui le relie le mieux à deux couleurs (deux teintes, ou une
   teinte et le fond) : sa place sur ce segment dit sa part de chacune. */
export function couvertures(data, largeur, hauteur, logo, fond, masques = null) {
  const n = largeur * hauteur
  /* `masques` : pour chaque pixel, les teintes du logo présentes autour
     (voir `voisinage`) — un pixel ne se lit que comme un mélange de
     celles-là (et du fond). */
  const tout = 2 ** logo.length - 1
  const permis = (k, m) => k < 0 || (m >> k) & 1
  const cartes = logo.map(() => new Float32Array(n))
  const bouts = logo.map((c, i) => ({ c, id: i })).concat(fond.map(c => ({ c, id: -1 })))
  const paires = []
  for (let i = 0; i < bouts.length; i++) {
    for (let j = i + 1; j < bouts.length; j++) {
      if (bouts[i].id < 0 && bouts[j].id < 0) continue
      /* Au-delà de six teintes, deux teintes ne se mêlent que là où le
         voisinage les permet (les tons d'un dégradé). */
      if (bouts[i].id >= 0 && bouts[j].id >= 0 && logo.length > 6 && !masques) continue
      paires.push([bouts[i], bouts[j]])
    }
  }
  const memoire = new Map()
  const part = (r, g, b, masque) => {
    const cle = ((r >> 2) << 12 | (g >> 2) << 6 | (b >> 2)) * (tout + 1) + masque
    let v = memoire.get(cle)
    if (v) return v
    let m = Infinity
    v = [-1, 1, -1, 0]
    for (const bo of bouts) {
      if (!permis(bo.id, masque)) continue
      const d = (r - bo.c[0]) ** 2 + (g - bo.c[1]) ** 2 + (b - bo.c[2]) ** 2
      if (d < m) { m = d; v = [bo.id, 1, -1, 0] }
    }
    for (const [A, B] of paires) {
      if (!permis(A.id, masque) || !permis(B.id, masque)) continue
      const a = A.c, v0 = B.c[0] - a[0], v1 = B.c[1] - a[1], v2 = B.c[2] - a[2]
      const l2 = v0 * v0 + v1 * v1 + v2 * v2
      if (!l2) continue
      const t = Math.max(0, Math.min(1, ((r - a[0]) * v0 + (g - a[1]) * v1 + (b - a[2]) * v2) / l2))
      const d = (r - a[0] - t * v0) ** 2 + (g - a[1] - t * v1) ** 2 + (b - a[2] - t * v2) ** 2
      if (d < m) { m = d; v = [A.id, 1 - t, B.id, t] }
    }
    memoire.set(cle, v)
    return v
  }
  for (let p = 0; p < n; p++) {
    const i = p * 4
    const a = data[i + 3] / 255
    if (!a) continue
    const v = part(data[i], data[i + 1], data[i + 2], (masques && masques[p]) || tout)
    if (v[0] >= 0) cartes[v[0]][p] += a * v[1]
    if (v[2] >= 0) cartes[v[2]][p] += a * v[3]
  }
  return cartes
}

/* LE DÉTOURAGE FAIT FOI, L'IMAGE REÇUE FAIT LE BORD : loin du vide, ce que
   le détourage a gardé opaque est du logo, quelle que soit sa couleur (le
   blanc d'un script dans un disque noir) ; près du vide, le détourage est
   dentelé — la couleur de l'image reçue dit, au centième, où le logo
   s'arrête sur le fond. Chaque teinte en prend sa part. */
/* LES TEINTES PRÉSENTES AUTOUR DE CHAQUE PIXEL (27 septembre 2026). Un
   orange un peu sombre, au bord d'une forme, est aussi « à mi-chemin »
   entre le jaune et le magenta du logo : lu comme leur mélange, il semait
   des éclats jaunes et magenta dans l'orange. Un pixel ne mélange que des
   teintes qu'on trouve à moins de `r` pixels : chaque pixel vote pour la
   teinte du logo dont il est le plus près (s'il est plus près d'elle que
   du fond — un filet doré à moitié dans le noir vote encore doré), et ce
   vote s'étend de `r` pixels. Rend un masque de bits par pixel ; null
   au-delà de 30 teintes. (Les tons d'un dégradé : `voisinageTons`.) */
export function voisinage(src, largeur, hauteur, logo, fond, r) {
  if (logo.length > 30 || logo.length < 3) return null
  const n = largeur * hauteur
  const cartes = logo.map(() => new Float32Array(n))
  for (let p = 0; p < n; p++) {
    const i = p * 4
    if (src[i + 3] === 0) continue
    let dk = Infinity, k = -1
    logo.forEach((c, j) => { const d = (src[i] - c[0]) ** 2 + (src[i + 1] - c[1]) ** 2 + (src[i + 2] - c[2]) ** 2; if (d < dk) { dk = d; k = j } })
    let df = Infinity
    for (const c of fond) df = Math.min(df, (src[i] - c[0]) ** 2 + (src[i + 1] - c[1]) ** 2 + (src[i + 2] - c[2]) ** 2)
    if (k >= 0 && dk < df) cartes[k][p] = 1
  }
  const masques = new Uint32Array(n)
  cartes.forEach((c, k) => {
    const m = maxLocal(c, largeur, hauteur, r)
    for (let p = 0; p < n; p++) if (m[p]) masques[p] |= 1 << k
  })
  return masques
}

/* LES TONS PRÉSENTS AUTOUR DE CHAQUE POINT, pour un dégradé tracé en tons
   (voir `tons`), lus sur le fichier À SA TAILLE : un filet clair d'un
   pixel y a encore sa couleur — agrandi, il se mêle au doré qui l'entoure
   et ne ressemble plus qu'à un doré pâle (27 septembre 2026, le trait
   crème d'un monogramme). Vote chaque pixel du dessin (`detoure` : gardé
   plein) posé à plat (voir `plats` : le milieu d'un filet fin l'est, la
   frange colorée que l'IA laisse au bord d'une lettre noire ne l'est
   jamais) et tout près d'un ton (à 24 niveaux) ; ce vote s'étend de `r`
   pixels, puis s'agrandit à la taille de travail (`W` × `H`).
   `votants` : les tons d'avant leur fusion (`tons`) et, pour chacun, la
   teinte qui l'a repris (`groupe`, voir `nuancesGroupees`). Un aplat vote
   pour le ton dont il est tout près, donc pour sa teinte — même loin de la
   moyenne de celle-ci (28 septembre 2026 : la panse rouge d'un R, à 32
   niveaux du rouge moyen d'un phénix, ne votait pour rien ; lue alors
   comme un mélange de n'importe quelles teintes, elle sortait gribouillée
   de jaune et de magenta). Loin de tout ton, il vote encore pour la teinte
   la plus proche, à 48 niveaux. Un point où rien n'a voté prend les
   teintes du vote le plus proche. */
export function voisinageTons(source, detoure, largeur, hauteur, W, H, logo, r, votants = null) {
  if (logo.length > 30 || logo.length < 3) return null
  const n = largeur * hauteur
  const cartes = logo.map(() => new Float32Array(n))
  const plat = plats(source, largeur, hauteur)
  const tonsV = votants ? votants.tons : logo
  const groupe = votants ? votants.groupe : logo.map((_, i) => i)
  const pres = (i, liste) => { let dk = Infinity, k = -1; liste.forEach((c, j) => { const d = (source[i] - c[0]) ** 2 + (source[i + 1] - c[1]) ** 2 + (source[i + 2] - c[2]) ** 2; if (d < dk) { dk = d; k = j } }); return [dk, k] }
  for (let p = 0; p < n; p++) {
    const i = p * 4
    if (detoure[i + 3] < 250 || !plat[p]) continue
    const [dt, t] = pres(i, tonsV)
    if (t >= 0 && dt <= 24 * 24) { cartes[groupe[t]][p] = 1; continue }
    const [dk, k] = pres(i, logo)
    if (k >= 0 && dk <= 48 * 48) cartes[k][p] = 1
  }
  const petits = new Uint32Array(n)
  cartes.forEach((c, k) => {
    const m = maxLocal(c, largeur, hauteur, r)
    for (let p = 0; p < n; p++) if (m[p]) petits[p] |= 1 << k
  })
  /* Là où rien n'a voté, le vote le plus proche (une vague). */
  const file = new Int32Array(n)
  let tete = 0, queue = 0
  for (let p = 0; p < n; p++) if (petits[p]) file[queue++] = p
  while (tete < queue) {
    const p = file[tete++], x = p % largeur
    for (const q of [x > 0 ? p - 1 : -1, x < largeur - 1 ? p + 1 : -1, p - largeur, p + largeur]) {
      if (q < 0 || q >= n || petits[q]) continue
      petits[q] = petits[p]
      file[queue++] = q
    }
  }
  if (W === largeur && H === hauteur) return petits
  const masques = new Uint32Array(W * H)
  for (let y = 0; y < H; y++) {
    const sy = Math.min(hauteur - 1, Math.floor((y + 0.5) * hauteur / H)) * largeur
    for (let x = 0; x < W; x++) masques[y * W + x] = petits[sy + Math.min(largeur - 1, Math.floor((x + 0.5) * largeur / W))]
  }
  return masques
}

/* UN APLAT, UNE TEINTE (28 septembre 2026 : « les couleurs à l'intérieur
   des lettres ne sont pas parfaites »). Pixel à pixel, un aplat d'un
   dégradé tracé en tons se partageait entre deux tons voisins — la panse
   rouge d'un R sortait moitié rouge, moitié orange, en dents de scie. Une
   zone posée à plat (voir `plats`), d'un seul tenant à `pres` niveaux près
   de proche en proche et restée dans `etendue` niveaux de sa moyenne, est
   un aplat : toute sa couverture va à la teinte la plus proche de sa
   couleur moyenne. Un
   dégradé (une plume qui passe du rouge à l'orange) s'étend bien plus loin
   que sa moyenne : il garde ses tons. `rvb` : l'image lue (RVBA), à la
   taille des cartes ; `cartes` et `teintes` sont modifiées (une teinte peut
   s'ajouter, voir plus bas). */
export function aplatsUnis(cartes, teintes, rvb, largeur, hauteur, { pres = 6, etendue = 18, aireMin = 24, exacte = 24, aireTeinte = Math.max(120, largeur * hauteur * 0.0002) } = {}) {
  const n = largeur * hauteur
  if (cartes.length < 2) return 0
  const base = teintes.length, poidsAjout = []
  let ajoutees = 0
  const plat = plats(rvb, largeur, hauteur, 12)
  const vu = new Uint8Array(n)
  const file = new Int32Array(n)
  let unis = 0
  for (let p0 = 0; p0 < n; p0++) {
    if (!plat[p0] || vu[p0]) continue
    let tete = 0, queue = 0
    vu[p0] = 1
    file[queue++] = p0
    let sr = 0, sg = 0, sb = 0
    while (tete < queue) {
      const p = file[tete++], i = p * 4, x = p % largeur
      sr += rvb[i]; sg += rvb[i + 1]; sb += rvb[i + 2]
      for (const q of [x > 0 ? p - 1 : -1, x < largeur - 1 ? p + 1 : -1, p - largeur, p + largeur]) {
        if (q < 0 || q >= n || vu[q] || !plat[q]) continue
        const j = q * 4
        if (Math.abs(rvb[i] - rvb[j]) > pres || Math.abs(rvb[i + 1] - rvb[j + 1]) > pres || Math.abs(rvb[i + 2] - rvb[j + 2]) > pres) continue
        vu[q] = 1
        file[queue++] = q
      }
    }
    if (queue < aireMin) continue
    const mr = sr / queue, mg = sg / queue, mb = sb / queue
    let loin = 0, pasUni = 0
    for (let k = 0; k < queue; k++) {
      const i = file[k] * 4, e = Math.max(Math.abs(rvb[i] - mr), Math.abs(rvb[i + 1] - mg), Math.abs(rvb[i + 2] - mb))
      if (e > etendue) loin++
      if (e > 8) pasUni++
    }
    if (loin > queue * 0.03) continue
    let meilleur = 0, d = Infinity
    teintes.forEach((c, j) => { const e = Math.max(Math.abs(c[0] - mr), Math.abs(c[1] - mg), Math.abs(c[2] - mb)); if (e < d) { d = e; meilleur = j } })
    /* SA COULEUR EXACTE : un aplat vraiment uni (à 8 niveaux près),
       franchement loin de toute teinte (la panse rouge vif d'un R, fondue
       avec le rouge sombre du phénix) et assez grand pour compter devient
       une teinte à lui — partagée par les aplats de sa couleur. Un morceau
       de dégradé (le V d'un monogramme doré) garde la teinte de sa
       famille. */
    if (d > exacte && queue >= aireTeinte && ajoutees < 8 && pasUni <= queue * 0.03) {
      meilleur = teintes.length
      teintes.push([mr, mg, mb])
      cartes.push(new Float32Array(n))
      poidsAjout.push(queue)
      ajoutees++
    } else if (meilleur >= base) {
      /* Une teinte ajoutée se précise de chaque aplat qui la rejoint. */
      const w = poidsAjout[meilleur - base], c = teintes[meilleur]
      teintes[meilleur] = [(c[0] * w + mr * queue) / (w + queue), (c[1] * w + mg * queue) / (w + queue), (c[2] * w + mb * queue) / (w + queue)]
      poidsAjout[meilleur - base] = w + queue
    }
    for (let k = 0; k < queue; k++) {
      const p = file[k]
      let t = 0
      for (const c of cartes) { t += c[p]; c[p] = 0 }
      cartes[meilleur][p] = t
    }
    /* Son bord aussi : sur trois pixels autour, la rampe (ce qui n'est pas
       posé à plat) lui rend la part d'une teinte de sa famille — le rouge
       sombre du phénix ne fait plus de liseré autour du rouge vif du R. */
    if (meilleur >= base) {
      const sien = teintes[meilleur].map(Math.round)
      const famille = teintes.map((c, j) => j !== meilleur && memeFamille(c, sien))
      const dist = new Map()
      for (let k = 0; k < queue; k++) dist.set(file[k], 0)
      let front = file.slice(0, queue)
      for (let r = 1; r <= 3; r++) {
        const suivant = []
        for (const p of front) {
          const x = p % largeur
          for (const q of [x > 0 ? p - 1 : -1, x < largeur - 1 ? p + 1 : -1, p - largeur, p + largeur]) {
            if (q < 0 || q >= n || dist.has(q)) continue
            dist.set(q, r)
            suivant.push(q)
            if (!plat[q]) famille.forEach((f, j) => { if (f && cartes[j][q]) { cartes[meilleur][q] += cartes[j][q]; cartes[j][q] = 0 } })
          }
        }
        front = suivant
      }
    }
    unis++
  }
  for (let j = base; j < teintes.length; j++) teintes[j] = teintes[j].map(Math.round)
  return unis
}

export function coutures({ data, largeur, hauteur }, src, logo, fond, ombres, masques = null, trouer = true) {
  const n = largeur * hauteur
  const r = Math.max(2, Math.round(Math.max(largeur, hauteur) / 400))
  const zone = elargir(data, largeur, hauteur, r)
  const vide = new Uint8ClampedArray(n * 4)
  for (let p = 0; p < n; p++) vide[p * 4 + 3] = data[p * 4 + 3] < 250 ? 255 : 0
  const bord = elargir(vide, largeur, hauteur, r)
  /* Au bord, une teinte du logo pareille au fond (le blanc du script, le
     blanc du papier) compte pour du fond : on ne peut pas les départager. */
  const clairs = logo.map(c => fond.some(f => Math.hypot(c[0] - f[0], c[1] - f[1], c[2] - f[2]) < 40))
  const loin = logo.filter((c, j) => !clairs[j])
  const surFond = couvertures(src, largeur, hauteur, loin.length ? loin : logo, fond, loin.length && loin.length < logo.length ? null : masques)
  const opaque = Uint8ClampedArray.from(src)
  for (let p = 0; p < n; p++) opaque[p * 4 + 3] = 255
  /* La part de chaque teinte, le fond mis à part (un pixel du bord, mi-orange
     mi-blanc, est orange — pas le jaune qui passe entre les deux). */
  const pres = (c, l) => l.some(f => Math.hypot(c[0] - f[0], c[1] - f[1], c[2] - f[2]) < 40)
  const parts = couvertures(opaque, largeur, hauteur, logo, fond.filter(f => !pres(f, logo)).concat(ombres), masques)
  for (let p = 0; p < n; p++) {
    let a
    if (bord[p]) { a = 0; for (const c of surFond) a += c[p]; a = Math.min(1, a) * zone[p] } else a = data[p * 4 + 3] / 255
    /* Au bord, la part du fond est déjà dans `a`, et une teinte du logo
       pareille au fond (le blanc d'un reflet) ne se départage pas du fond :
       elle n'y compte pas — sinon un liseré blanc longerait le dessin.
       À L'INTÉRIEUR, avec « Intérieur du logo aussi » (`trouer`), un pixel
       couleur de fond reste un jour, et un pixel mi-fond l'est à moitié (le
       filet blanc d'un script, flou, dans un disque noir). Avec « Extérieur
       seulement », le détourage fait foi (27 septembre 2026, « j'ai des
       trous dans le logo ») : ce qu'il a gardé opaque est du logo, en
       entier, même clair — le dégradé d'une aile qui pâlit vers le blanc se
       lisait « à moitié fond » et se perçait. Les teintes se partagent alors
       ce qu'il a gardé ; un pixel couleur de fond va à la teinte du logo la
       plus proche. */
    if (bord[p]) {
      let t = 0
      parts.forEach((c, j) => { if (!clairs[j]) t += c[p] })
      const k = t > 0.05 ? a / t : 0
      parts.forEach((c, j) => { c[p] = clairs[j] ? 0 : c[p] * k })
    } else if (trouer) {
      for (const c of parts) c[p] *= a
    } else {
      let t = 0
      for (const c of parts) t += c[p]
      if (t > 0.05) { for (const c of parts) c[p] *= a / t; continue }
      const i = p * 4
      let m = Infinity, kk = 0
      logo.forEach((c, j) => { const d = (src[i] - c[0]) ** 2 + (src[i + 1] - c[1]) ** 2 + (src[i + 2] - c[2]) ** 2; if (d < m) { m = d; kk = j } })
      for (const c of parts) c[p] = 0
      if (parts[kk]) parts[kk][p] = a
    }
  }
  return parts
}

/* LES COULEURS PURES : le noir d'un JPEG sort à 14, 14, 14, son blanc à
   250 — un logo haut de gamme est en vrai noir, en vrai blanc. Un gris
   presque neutre tout près de l'un d'eux y passe ; une vraie teinte, un
   vrai gris restent. */
export function pure([r, g, b]) {
  const M = Math.max(r, g, b), m = Math.min(r, g, b)
  if (M - m <= 14 && M <= 48) return [0, 0, 0]
  if (M - m <= 14 && m >= 232) return [255, 255, 255]
  return [r, g, b]
}

/* LES MIETTES (27 septembre 2026, « d'un logo pourri à un logo haut de
   gamme »). Un JPEG écrasé, un logo redessiné par l'IA laissent au bord des
   formes un liseré plus sombre ou plus clair — un fil noir le long d'un
   cercle bleu — et, çà et là, des éclats d'une autre teinte. Chaque pixel
   prend la teinte qui le couvre le plus ; chaque morceau d'une même teinte
   se mesure : trop petit (`aireMax`), ou trop mince en moyenne (deux fois
   son aire sur son pourtour, sous `epaisseurMin`), c'est une miette. Ses
   voisins la reprennent, chacun sa moitié (le plus proche l'emporte) : le
   bord du cercle se referme sur le fil, l'éclat prend la couleur qui
   l'entoure. Un petit morceau (`isole.aire`) qu'aucun grand morceau de sa
   teinte n'approche à `isole.rayon` près est un éclat aussi : l'orange
   que l'IA a semé dans un texte blanc, loin du triangle orange (le point
   d'un i, lui, touche presque sa lettre). Rend les cartes nettoyées (les
   mêmes, modifiées) et le nombre de miettes. */
export function sansMiettes(cartes, largeur, hauteur, { aireMax, epaisseurMin, isole = null }) {
  const n = largeur * hauteur
  if (!cartes.length) return { cartes, miettes: 0 }
  const lab = new Int8Array(n).fill(-1)
  for (let p = 0; p < n; p++) {
    let t = 0, m = 0, k = -1
    for (let j = 0; j < cartes.length; j++) { const v = cartes[j][p]; t += v; if (v > m) { m = v; k = j } }
    if (t >= 0.5) lab[p] = k
  }
  /* Les morceaux : leur numéro par pixel, leur aire, leur pourtour. */
  const num = new Int32Array(n).fill(-1)
  const pile = new Int32Array(n)
  const aires = [], tours = []
  for (let p0 = 0; p0 < n; p0++) {
    if (lab[p0] < 0 || num[p0] >= 0) continue
    const id = aires.length, c = lab[p0]
    let haut = 0, a = 0, t = 0
    num[p0] = id
    pile[haut++] = p0
    while (haut) {
      const p = pile[--haut]
      a++
      const x = p % largeur
      for (let v = 0; v < 4; v++) {
        const q = v === 0 ? (x > 0 ? p - 1 : -1) : v === 1 ? (x < largeur - 1 ? p + 1 : -1) : v === 2 ? p - largeur : p + largeur
        if (q < 0 || q >= n || lab[q] !== c) { t++; continue }
        if (num[q] < 0) { num[q] = id; pile[haut++] = q }
      }
    }
    aires.push(a)
    tours.push(t)
  }
  const miette = aires.map((a, i) => a < aireMax || 2 * a / tours[i] < epaisseurMin)
  if (isole) {
    for (let c = 0; c < cartes.length; c++) {
      const grand = new Float32Array(n)
      let petits = false
      for (let p = 0; p < n; p++) {
        if (lab[p] !== c) continue
        const id = num[p]
        if (miette[id]) continue
        if (aires[id] >= isole.aire) grand[p] = 1
        else petits = true
      }
      if (!petits) continue
      const pres = maxLocal(grand, largeur, hauteur, isole.rayon)
      const voisin = new Set()
      for (let p = 0; p < n; p++) if (lab[p] === c && aires[num[p]] < isole.aire && pres[p]) voisin.add(num[p])
      for (let p = 0; p < n; p++) if (lab[p] === c && aires[num[p]] < isole.aire && !voisin.has(num[p])) miette[num[p]] = true
    }
  }
  let compte = 0
  for (const m of miette) if (m) compte++
  if (!compte) return { cartes, miettes: 0 }
  /* Les voisins la reprennent : une vague part du DESSIN qui n'est pas
     miette et la remplit, pixel après pixel — jamais du vide (29 septembre
     2026 : une petite lettre grise, partagée entre deux gris, perdait ses
     morceaux « trop minces » dans le vide, et « l'Orthopédie de la tête
     aux pieds » ressortait en éclats). */
  const nouv = new Int8Array(n)
  const pris = new Uint8Array(n)
  let tete = 0, queue = 0
  for (let p = 0; p < n; p++) {
    if (lab[p] >= 0 && miette[num[p]]) continue
    nouv[p] = lab[p]
    pris[p] = 1
  }
  for (let p = 0; p < n; p++) {
    if (!pris[p] || lab[p] < 0) continue
    const x = p % largeur
    if ((x > 0 && !pris[p - 1]) || (x < largeur - 1 && !pris[p + 1]) || (p >= largeur && !pris[p - largeur]) || (p < n - largeur && !pris[p + largeur])) pile[queue++] = p
  }
  while (tete < queue) {
    const p = pile[tete++]
    const x = p % largeur
    for (let v = 0; v < 4; v++) {
      const q = v === 0 ? (x > 0 ? p - 1 : -1) : v === 1 ? (x < largeur - 1 ? p + 1 : -1) : v === 2 ? p - largeur : p + largeur
      if (q < 0 || q >= n || pris[q]) continue
      pris[q] = 1
      nouv[q] = nouv[p]
      pile[queue++] = q
    }
  }
  /* Les miettes seules au monde — un dessin fait tout entier de miettes
     (un trait fin partagé entre deux gris) : ensemble, d'un seul tenant,
     plus grandes qu'une poussière, elles sont une forme, qui prend la
     teinte de la plupart d'entre elles. Une poussière part. */
  const compte0 = new Float64Array(cartes.length)
  for (let p0 = 0; p0 < n; p0++) {
    if (pris[p0]) continue
    let t = 0, q = 0
    pile[q++] = p0
    pris[p0] = 2
    compte0.fill(0)
    while (t < q) {
      const p = pile[t++], x = p % largeur
      if (lab[p] >= 0) compte0[lab[p]]++
      for (const v of [x > 0 ? p - 1 : -1, x < largeur - 1 ? p + 1 : -1, p - largeur, p + largeur]) {
        if (v < 0 || v >= n || pris[v]) continue
        pris[v] = 2
        pile[q++] = v
      }
    }
    let k = 0
    for (let j = 1; j < cartes.length; j++) if (compte0[j] > compte0[k]) k = j
    for (let i = 0; i < q; i++) nouv[pile[i]] = q >= aireMax ? k : -1
  }
  /* La couverture suit : celle de la miette passe à qui la reprend — et,
     tout autour, le reste de sa teinte à la teinte du pixel. */
  const bord = new Uint8Array(n)
  for (let p = 0; p < n; p++) {
    if (lab[p] < 0 || !miette[num[p]]) continue
    const o = lab[p], q = nouv[p], v = cartes[o][p]
    cartes[o][p] = 0
    if (q >= 0) cartes[q][p] += v
    bord[p] = o + 1
  }
  const autour = maxLocal(Float32Array.from(bord), largeur, hauteur, 2)
  for (let p = 0; p < n; p++) {
    const o = autour[p] - 1
    if (o < 0 || bord[p] || lab[p] === o) continue
    const v = cartes[o][p]
    if (!v || lab[p] < 0) continue
    cartes[o][p] = 0
    cartes[lab[p]][p] += v
  }
  return { cartes, miettes: compte }
}

/* LE MODELÉ QUE LE VECTEUR PERD (29 septembre 2026 : Orthopédib, un logo
   à plat, s'ouvrait sur la version image — ses petites lettres marbrées
   par le grain de l'IA — parce que son anneau argenté « dégradait »). Deux
   mesures, sur les couleurs de l'image (`rvb`) :
   - LES FAUX CONTOURS : entre deux couches du dessin, la frontière d'un
     logo à plat tombe sur un vrai bord — d'un côté à l'autre, à `r`
     pixels, l'image change autant que les deux couleurs ; celle d'un
     dégradé tranché en aplats tombe en plein milieu d'une pente douce
     (l'image y change moins de moitié). Rend la part de ces frontières-là ;
   - LE GRAIN : au cœur de chaque couche (à `r` pixels de tout bord), la
     part des pixels à plus de 6 (lib/lab.js) de la couleur de leur couche
     — une texture, une broderie, une peinture. */
export function modelePerdu(rang, tout, rvb, couleurs, largeur, hauteur, r) {
  const n = largeur * hauteur
  const bord = new Float32Array(n)
  const labs = couleurs.map(lab), memoire = new Map()
  const labDe = p => {
    const i = p * 4, cle = (rvb[i] >> 2) << 12 | (rvb[i + 1] >> 2) << 6 | rvb[i + 2] >> 2
    let v = memoire.get(cle)
    if (!v) memoire.set(cle, v = lab([rvb[i], rvb[i + 1], rvb[i + 2]]))
    return v
  }
  let frontiere = 0, faux = 0
  for (let p = 0; p < n; p++) {
    if (tout[p] < 0.5) { bord[p] = 1; continue }
    const x = p % largeur, y = (p - x) / largeur
    for (const [q, dx, dy] of [[x < largeur - 1 ? p + 1 : -1, 1, 0], [p < n - largeur ? p + largeur : -1, 0, 1]]) {
      if (q < 0 || rang[q] === rang[p]) continue
      bord[p] = 1
      if (tout[q] < 0.5 || rang[q] < 0 || rang[p] < 0) continue
      const xa = x - dx * r, ya = y - dy * r, xb = x + dx * (r + 1), yb = y + dy * (r + 1)
      if (xa < 0 || ya < 0 || xb >= largeur || yb >= hauteur) continue
      const pa = ya * largeur + xa, pb = yb * largeur + xb
      if (tout[pa] < 0.5 || tout[pb] < 0.5) continue
      frontiere++
      if (ecartLab(labDe(pa), labDe(pb)) < 0.5 * ecartLab(labs[rang[p]], labs[rang[q]])) faux++
    }
  }
  const pres = maxLocal(bord, largeur, hauteur, r)
  let coeur = 0, loin = 0, dessin = 0
  for (let p = 0; p < n; p += 3) {
    if (tout[p] < 0.5) continue
    dessin++
    if (pres[p] || rang[p] < 0) continue
    coeur++
    if (ecartLab(labDe(p), labs[rang[p]]) > 6) loin++
  }
  return { faux: frontiere ? faux / frontiere : 0, frontiere, grain: coeur ? loin / coeur : 0, dessin: dessin * 3 }
}

/* LA COUCHE DE CHAQUE POINT, pour empiler les couleurs sur la silhouette
   (voir `vectoriserLisse`). Là où le dessin est franc (`tout`, la
   couverture de toutes les couches, passe `franc`), la couche qui le
   couvre le plus ; ailleurs — la rampe du bord, le vide autour —, celle
   du point franc le plus proche (une vague) : le bord d'une lettre est de
   la couleur de la lettre, jamais de celle d'une trace voisine. `cartes`
   dans l'ordre des couches (la première, dessous). Rend le rang de chaque
   point (-1 : aucun dessin nulle part).
   UNE PETITE FORME, UNE COULEUR (29 septembre 2026, « l'Orthopédie de la
   tête aux pieds » : l'IA fonce le cœur des petites lettres grises, et
   chacune sortait moitié gris, moitié gris foncé, semée d'éclats bleus).
   Un morceau de dessin d'un seul tenant pas plus grand que `petit` pixels
   (une lettre, un point, un accent) prend une seule couleur :
   - un trait fin (moins de `mince` pixels d'épaisseur moyenne) ne peut
     pas porter deux couleurs : il prend celle, parmi ses tons, qui est la
     plus proche de sa couleur moyenne (`rvb`, sur ses pixels pleins) —
     sauf si un ton qui en couvre un sixième est d'une tout autre couleur
     (plus de 45, lib/lab.js — deux gris, du noir au blanc, sont parents) ;
   - un morceau plus épais, quand ses tons comptés (3 % de lui au moins)
     sont tous à moins de `voisins` du plus présent : celui-là.
   Une lettre noire cernée de blanc, un drapeau, un grand dessin gardent
   leurs couleurs. `couleurs` : la couleur de chaque couche. */
export function rangs(cartes, tout, largeur, hauteur, franc = 0.5, { couleurs = null, petit = 0, voisins = 25, rvb = null, mince = 0, liseré = 0 } = {}) {
  const n = largeur * hauteur
  const rang = new Int8Array(n).fill(-1)
  const file = new Int32Array(n)
  let queue = 0
  for (let seuil = franc; !queue && seuil > 0; seuil = seuil > 0.05 ? 0.05 : 0) {
    for (let p = 0; p < n; p++) {
      if (tout[p] < seuil || rang[p] >= 0 || !tout[p]) continue
      let m = -1, k = -1
      for (let r = 0; r < cartes.length; r++) { const v = cartes[r][p]; if (v > m) { m = v; k = r } }
      rang[p] = k
      file[queue++] = p
    }
  }
  if (couleurs && petit > 0 && cartes.length > 1) {
    const labs = couleurs.map(lab)
    /* Deux couleurs parentes : à moins de 45 (lib/lab.js), ou deux gris,
       du noir au gris clair. */
    /* Deux gris — pas le blanc : le blanc gardé dans le creux d'une lettre
       (« Autour ») n'est pas un gris de plus. */
    const neutre = c => Math.hypot(lab(c)[1], lab(c)[2]) < 12 && lab(c)[0] < 90
    const proches = (a, b) => ecartLab(labs[a], labs[b]) < 45 || (neutre(couleurs[a]) && neutre(couleurs[b]))
    const vu = new Uint8Array(n), tous = new Int32Array(n), poids = new Float64Array(cartes.length)
    const formes = []
    let q = 0
    for (let p0 = 0; p0 < n; p0++) {
      if (rang[p0] < 0 || vu[p0]) continue
      const debut = q
      let t = q, x0 = largeur, y0 = hauteur, x1 = 0, y1 = 0, tour = 0
      let sr = 0, sg = 0, sb = 0, sn = 0
      vu[p0] = 1
      tous[q++] = p0
      poids.fill(0)
      while (t < q) {
        const p = tous[t++], x = p % largeur, y = (p - x) / largeur
        poids[rang[p]] += tout[p]
        if (rvb && tout[p] >= 0.9) { const i = p * 4; sr += rvb[i]; sg += rvb[i + 1]; sb += rvb[i + 2]; sn++ }
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
        for (const v of [x > 0 ? p - 1 : -1, x < largeur - 1 ? p + 1 : -1, p >= largeur ? p - largeur : -1, p < n - largeur ? p + largeur : -1]) {
          if (v < 0 || rang[v] < 0) { tour++; continue }
          if (!vu[v]) { vu[v] = 1; tous[q++] = v }
        }
      }
      if (Math.max(x1 - x0, y1 - y0) + 1 > petit) continue
      let d = 0, somme = 0
      for (let r = 0; r < poids.length; r++) { somme += poids[r]; if (poids[r] > poids[d]) d = r }
      const comptes = []
      for (let r = 0; r < poids.length; r++) if (poids[r] >= 0.03 * somme) comptes.push(r)
      let choix = -1
      const fin = mince > 0 && 2 * (q - debut) / Math.max(1, tour) < mince
      if (fin && sn) {
        /* Le trait fin : sa couleur moyenne dit laquelle. */
        const moy = lab([sr / sn, sg / sn, sb / sn])
        let m = Infinity
        for (const r of comptes) { const e = ecartLab(labs[r], moy); if (e < m) { m = e; choix = r } }
        for (let r = 0; r < poids.length && choix >= 0; r++) if (r !== choix && poids[r] >= somme / 6 && !proches(r, choix)) choix = -1
      }
      if (choix < 0 && voisins > 0) {
        choix = d
        for (const r of comptes) if (r !== d && ecartLab(labs[r], labs[d]) >= voisins) { choix = -1; break }
      }
      if (choix >= 0) formes.push({ debut, fin: q, x0, y0, x1, y1, comptes, choix, aire: somme, parts: comptes.map(r => poids[r] / somme), mince: fin })
    }
    /* UNE LIGNE, UNE COULEUR (l'IA a pu foncer le cœur d'une lettre : un
       « t », un « é » sortaient noirs dans un texte gris). Les lettres
       d'une même ligne (leur écart sous une fois et un cinquième leur
       hauteur) se suivent de gauche à droite :
       - une lettre prend une couleur qu'elle porte déjà (un cinquième
         d'elle au moins) et proche de la sienne — ou deux gris, du noir au
         blanc — quand ses lettres voisines l'ont en plus grand nombre ;
       - une ou deux lettres fines d'un gris, entre deux voisines d'un
         autre gris, prennent le leur ; trois de suite restent — deux mots
         en deux gris restent deux ;
       - un accent prend la couleur de sa lettre s'il la porte déjà un peu,
         ou si ce sont deux gris — le point rouge d'un i noir reste rouge.
       « ORTHOPÉ » en bleu et « DIB » en gris restent deux. */
    const chef = formes.map((_, i) => i)
    const trouver = i => { while (chef[i] !== i) i = chef[i] = chef[chef[i]]; return i }
    const parX = formes.map((_, i) => i).sort((i, j) => formes[i].x0 - formes[j].x0)
    for (let u = 0; u < parX.length; u++) {
      const A = formes[parX[u]], hA = A.y1 - A.y0 + 1
      for (let v = u + 1; v < parX.length; v++) {
        const B = formes[parX[v]], hB = B.y1 - B.y0 + 1, h = Math.max(hA, hB)
        if (B.x0 - A.x1 > 1.2 * h) break
        const commun = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0) + 1
        /* L'accent posé sur sa lettre (ou le point d'un i) : juste
           au-dessus d'elle, moitié moins haut au plus, et pas plus loin
           que sa propre hauteur. */
        const [petite, grande] = hA < hB ? [A, B] : [B, A]
        const hp = petite.y1 - petite.y0 + 1
        if (hp <= 0.5 * (grande.y1 - grande.y0 + 1) && petite.y1 <= grande.y0 + 0.2 * hp && grande.y0 - petite.y1 <= Math.max(2, 1.2 * hp)
          && Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0) + 1 >= 0.3 * (petite.x1 - petite.x0 + 1)) {
          if (petite.lettre === undefined) petite.lettre = grande
          continue
        }
        if (commun >= 0.4 * Math.min(hA, hB)) chef[trouver(parX[v])] = trouver(parX[u])
      }
    }
    const votes = new Map()
    formes.forEach((f, i) => {
      if (f.lettre) return
      const g = trouver(i)
      if (!votes.has(g)) votes.set(g, new Float64Array(cartes.length))
      votes.get(g)[f.choix] += f.aire
    })
    formes.forEach((f, i) => {
      if (f.lettre) return
      const v = votes.get(trouver(i))
      let m = f.choix
      f.comptes.forEach((r, j) => { if (v[r] > v[m] && f.parts[j] >= 0.2 && proches(r, f.choix)) m = r })
      f.choix = m
    })
    /* La lettre fine seule de sa couleur entre deux voisines. */
    const lignes = new Map()
    for (const i of parX) {
      if (formes[i].lettre) continue
      const g = trouver(i)
      if (!lignes.has(g)) lignes.set(g, [])
      lignes.get(g).push(formes[i])
    }
    for (const l of lignes.values()) {
      const avant = l.map(f => f.choix)
      for (let j = 0; j < l.length; j++) {
        const f = l[j]
        if (!f.mince || !neutre(couleurs[f.choix])) continue
        /* Sa suite de lettres de la même couleur : deux au plus, bordée des
           deux côtés par un même gris (au bout de la ligne, par deux
           lettres de ce gris). */
        let d = j, e = j
        while (d > 0 && avant[d - 1] === avant[j]) d--
        while (e < l.length - 1 && avant[e + 1] === avant[j]) e++
        if (e - d > 1) continue
        const g = d > 0 ? avant[d - 1] : e + 2 < l.length && avant[e + 2] === avant[e + 1] ? avant[e + 1] : undefined
        const h = e < l.length - 1 ? avant[e + 1] : d > 1 && avant[d - 2] === avant[d - 1] ? avant[d - 1] : undefined
        if (g !== undefined && g === h && (e === d || (d > 0 && e < l.length - 1)) && neutre(couleurs[g]) && l.slice(d, e + 1).every(x => x.mince)) f.choix = g
      }
    }
    for (const f of formes) {
      if (f.lettre && f.lettre.choix !== f.choix && (f.comptes.includes(f.lettre.choix) || (neutre(couleurs[f.lettre.choix]) && neutre(couleurs[f.choix])))) f.choix = f.lettre.choix
      for (let k = f.debut; k < f.fin; k++) rang[tous[k]] = f.choix
    }
  }
  /* LE LISERÉ (29 septembre 2026, un liseré bleu nuit autour d'une main
     bleue) : le JPEG, puis l'IA, laissent au bord des formes une bande
     plus sombre ou plus claire, d'un pixel du fichier. Une bande d'une
     couleur plus mince que `liseré` pixels (ce qu'une ouverture de ce
     rayon efface), au bord d'une forme franche d'une autre couleur — entre
     elle et le vide, ou entre elle et une troisième couleur —, est ce
     liseré : elle prend la couleur la plus proche de la sienne. Un filet au
     milieu d'une seule couleur (le trait crème d'un monogramme doré), une
     lettre fine posée seule, un vrai contour plus épais restent. */
  if (liseré > 0 && cartes.length > 1 && couleurs) {
    const labs = couleurs.map(lab)
    const vide = new Float32Array(n)
    for (let p = 0; p < n; p++) if (rang[p] < 0) vide[p] = 1
    const presVide = maxLocal(vide, largeur, hauteur, liseré + 1)
    const epais = [], pres = []
    for (let r = 0; r < cartes.length; r++) {
      const hors = new Float32Array(n)
      let a = 0
      for (let p = 0; p < n; p++) if (rang[p] !== r) hors[p] = 1; else a++
      if (!a) { epais.push(null); pres.push(null); continue }
      /* L'ouverture : ce qui reste d'elle, érodée puis regonflée. */
      const erodee = maxLocal(hors, largeur, hauteur, liseré)
      for (let p = 0; p < n; p++) erodee[p] = 1 - erodee[p]
      const e = maxLocal(erodee, largeur, hauteur, liseré)
      epais.push(e)
      pres.push(maxLocal(e, largeur, hauteur, liseré + 1))
    }
    const change = []
    for (let p = 0; p < n; p++) {
      const a = rang[p]
      if (a < 0 || epais[a][p]) continue
      let m = Infinity, b = -1, autour = 0
      for (let r = 0; r < cartes.length; r++) {
        if (r === a || !pres[r] || !pres[r][p]) continue
        autour++
        const e = ecartLab(labs[a], labs[r])
        if (e < m) { m = e; b = r }
      }
      if (b >= 0 && (presVide[p] || autour >= 2)) change.push(p, b)
    }
    for (let i = 0; i < change.length; i += 2) rang[change[i]] = change[i + 1]
  }
  let tete = 0
  while (tete < queue) {
    const p = file[tete++], x = p % largeur, k = rang[p]
    if (x > 0 && rang[p - 1] < 0) { rang[p - 1] = k; file[queue++] = p - 1 }
    if (x < largeur - 1 && rang[p + 1] < 0) { rang[p + 1] = k; file[queue++] = p + 1 }
    if (p >= largeur && rang[p - largeur] < 0) { rang[p - largeur] = k; file[queue++] = p - largeur }
    if (p < n - largeur && rang[p + largeur] < 0) { rang[p + largeur] = k; file[queue++] = p + largeur }
  }
  return rang
}

/* LE CADRE D'UNE CARTE : [x0, y0, x1, y1] de ce qu'elle couvre, ou null. */
function cadreCarte(c, W, H) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1
  for (let y = 0; y < H; y++) {
    const o = y * W
    for (let x = 0; x < W; x++) if (c[o + x] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  }
  return x1 < 0 ? null : [x0, y0, x1, y1]
}

/* LE FLOU GAUSSIEN, en deux passes (lignes puis colonnes). */
export function flou(carte, largeur, hauteur, sigma) {
  if (sigma <= 0) return carte
  /* Trois boîtes de suite valent une gaussienne (à 3 % près) et coûtent
     le même prix quel que soit le flou. Hors de l'image : du vide. */
  const n = 3
  const ideal = Math.sqrt(12 * sigma * sigma / n + 1)
  let wl = Math.floor(ideal); if (wl % 2 === 0) wl--
  const wu = wl + 2
  const mIdeal = (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4)
  const m = Math.round(mIdeal)
  let a = Float32Array.from(carte), b = new Float32Array(carte.length)
  const ligne = new Float64Array(Math.max(largeur, hauteur) + 1)
  for (let k = 0; k < n; k++) {
    const r = ((k < m ? wl : wu) - 1) / 2
    boite(a, b, largeur, hauteur, 1, largeur, r, ligne)
    boiteColonnes(b, a, largeur, hauteur, r)
  }
  return a
}
/* La même boîte de haut en bas, ligne après ligne (la mémoire se lit dans
   l'ordre : quatre fois plus vite qu'en descendant chaque colonne). */
function boiteColonnes(src, dst, largeur, hauteur, r) {
  const somme = new Float64Array(largeur)
  const w = 2 * r + 1
  for (let y = 0; y < Math.min(r, hauteur); y++) for (let x = 0; x < largeur; x++) somme[x] += src[y * largeur + x]
  for (let y = 0; y < hauteur; y++) {
    const entre = y + r, sort = y - r - 1
    if (entre < hauteur) { const o = entre * largeur; for (let x = 0; x < largeur; x++) somme[x] += src[o + x] }
    if (sort >= 0) { const o = sort * largeur; for (let x = 0; x < largeur; x++) somme[x] -= src[o + x] }
    const o = y * largeur
    for (let x = 0; x < largeur; x++) dst[o + x] = somme[x] / w
  }
}
/* Une boîte de rayon r le long de chaque ligne (`pas` entre deux points,
   `saut` entre deux lignes), par sommes cumulées. */
function boite(src, dst, n, lignes, pas, saut, r, cumul) {
  const w = 2 * r + 1
  for (let l = 0; l < lignes; l++) {
    const o = l * saut
    cumul[0] = 0
    for (let i = 0; i < n; i++) cumul[i + 1] = cumul[i] + src[o + i * pas]
    for (let i = 0; i < n; i++) dst[o + i * pas] = (cumul[Math.min(n, i + r + 1)] - cumul[Math.max(0, i - r)]) / w
  }
}

/* LES CONTOURS OÙ LA CARTE VAUT `iso` : des boucles fermées de points
   (le pourtour de l'image compte pour du vide : tout se referme). */
export function contours(carte, largeur, hauteur, iso = 0.5) {
  const W = largeur + 2
  const val = (x, y) => (x < 0 || y < 0 || x >= largeur || y >= hauteur) ? 0 : carte[y * largeur + x]
  /* Les arêtes : horizontale (x,y)-(x+1,y) = 2k, verticale (x,y)-(x,y+1) = 2k+1. */
  const H = (x, y) => ((y + 1) * W + (x + 1)) * 2
  const V = (x, y) => ((y + 1) * W + (x + 1)) * 2 + 1
  const points = new Map()
  const voisins = new Map()
  const point = (e, x, y, vertical) => {
    if (points.has(e)) return
    const a = val(x, y)
    const b = vertical ? val(x, y + 1) : val(x + 1, y)
    const t = b === a ? 0.5 : (iso - a) / (b - a)
    points.set(e, vertical ? [x + 0.5, y + t + 0.5] : [x + t + 0.5, y + 0.5])
  }
  const lier = (e1, e2) => {
    let v = voisins.get(e1); if (!v) voisins.set(e1, v = []); v.push(e2)
    v = voisins.get(e2); if (!v) voisins.set(e2, v = []); v.push(e1)
  }
  for (let y = -1; y < hauteur; y++) {
    for (let x = -1; x < largeur; x++) {
      const tl = val(x, y), tr = val(x + 1, y), br = val(x + 1, y + 1), bl = val(x, y + 1)
      const cas = (tl >= iso ? 1 : 0) | (tr >= iso ? 2 : 0) | (br >= iso ? 4 : 0) | (bl >= iso ? 8 : 0)
      if (cas === 0 || cas === 15) continue
      const T = H(x, y), B = H(x, y + 1), L = V(x, y), R = V(x + 1, y)
      const centre = (tl + tr + br + bl) / 4 >= iso
      let segs
      switch (cas) {
        case 1: case 14: segs = [[L, T]]; break
        case 2: case 13: segs = [[T, R]]; break
        case 3: case 12: segs = [[L, R]]; break
        case 4: case 11: segs = [[R, B]]; break
        case 6: case 9: segs = [[T, B]]; break
        case 7: case 8: segs = [[L, B]]; break
        case 5: segs = centre ? [[T, R], [B, L]] : [[L, T], [R, B]]; break
        case 10: segs = centre ? [[L, T], [R, B]] : [[T, R], [B, L]]; break
      }
      for (const [e1, e2] of segs) {
        for (const e of [e1, e2]) {
          if (e === T) point(e, x, y, false)
          else if (e === B) point(e, x, y + 1, false)
          else if (e === L) point(e, x, y, true)
          else point(e, x + 1, y, true)
        }
        lier(e1, e2)
      }
    }
  }
  const vus = new Set()
  const boucles = []
  for (const depart of voisins.keys()) {
    if (vus.has(depart)) continue
    const boucle = []
    let prec = -1, e = depart
    while (e !== undefined && !vus.has(e)) {
      vus.add(e)
      boucle.push(points.get(e))
      const v = voisins.get(e)
      const suite = v[0] !== prec ? v[0] : v[1]
      prec = e
      e = suite
    }
    if (boucle.length >= 3) boucles.push(boucle)
  }
  return boucles
}

export function aire(pts) {
  let s = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) s += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1])
  return s / 2
}

/* LES POINTES : là où le contour tourne franchement, mesuré de part et
   d'autre sur `k` points — et seulement au plus fort du virage. */
export function pointes(pts, angleMin = 50, k = 4) {
  const n = pts.length
  if (n < 2 * k + 2) return []
  const virage = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const a = pts[(i - k + n) % n], p = pts[i], b = pts[(i + k) % n]
    const u = [p[0] - a[0], p[1] - a[1]], v = [b[0] - p[0], b[1] - p[1]]
    const nu = Math.hypot(u[0], u[1]), nv = Math.hypot(v[0], v[1])
    if (!nu || !nv) continue
    const c = Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (nu * nv)))
    virage[i] = Math.acos(c) * 180 / Math.PI
  }
  const sortie = []
  for (let i = 0; i < n; i++) {
    if (virage[i] < angleMin) continue
    let max = true
    for (let d = -k; d <= k && max; d++) if (d && (virage[(i + d + n) % n] > virage[i] || (virage[(i + d + n) % n] === virage[i] && d < 0))) max = false
    if (max) sortie.push(i)
  }
  return sortie
}

/* LISSER UNE BOUCLE, les pointes tenues en place. */
export function lisser(pts, fixes, passes = 3) {
  const n = pts.length
  const tenu = new Uint8Array(n)
  for (const i of fixes) tenu[i] = 1
  let p = pts.map(q => q.slice())
  for (let s = 0; s < passes; s++) {
    const q = p.map(v => v.slice())
    for (let i = 0; i < n; i++) {
      if (tenu[i]) continue
      const a = p[(i - 1 + n) % n], b = p[(i + 1) % n]
      q[i] = [(a[0] + 2 * p[i][0] + b[0]) / 4, (a[1] + 2 * p[i][1] + b[1]) / 4]
    }
    p = q
  }
  return p
}

/* ---------------------------------------------------- LES COURBES DE BÉZIER
   L'ajustement de Philip J. Schneider (Graphics Gems, 1990) : une cubique
   par les moindres carrés ; trop loin des points, on la recale, puis on
   coupe en deux au pire point. */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]]
const add = (a, b) => [a[0] + b[0], a[1] + b[1]]
const mul = (a, k) => [a[0] * k, a[1] * k]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1]
const norm = a => { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l] }
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])

function bezier(c, t) {
  const u = 1 - t
  return add(add(mul(c[0], u * u * u), mul(c[1], 3 * u * u * t)), add(mul(c[2], 3 * u * t * t), mul(c[3], t * t * t)))
}

function parametres(pts) {
  const u = [0]
  for (let i = 1; i < pts.length; i++) u.push(u[i - 1] + dist(pts[i], pts[i - 1]))
  const L = u[u.length - 1] || 1
  return u.map(v => v / L)
}

function generer(pts, u, t1, t2) {
  const p0 = pts[0], p3 = pts[pts.length - 1]
  let c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0
  for (let i = 0; i < pts.length; i++) {
    const t = u[i], s = 1 - t
    const a1 = mul(t1, 3 * s * s * t), a2 = mul(t2, 3 * s * t * t)
    c00 += dot(a1, a1); c01 += dot(a1, a2); c11 += dot(a2, a2)
    const tmp = sub(pts[i], add(mul(p0, s * s * s + 3 * s * s * t), mul(p3, 3 * s * t * t + t * t * t)))
    x0 += dot(a1, tmp); x1 += dot(a2, tmp)
  }
  const det = c00 * c11 - c01 * c01
  let al = det ? (x0 * c11 - x1 * c01) / det : 0
  let ar = det ? (c00 * x1 - c01 * x0) / det : 0
  const seg = dist(p0, p3)
  if (al < 1e-6 * seg || ar < 1e-6 * seg || !det) al = ar = seg / 3
  return [p0, add(p0, mul(t1, al)), add(p3, mul(t2, ar)), p3]
}

function pire(pts, c, u) {
  let max = 0, ou = pts.length >> 1
  for (let i = 1; i < pts.length - 1; i++) {
    const d = dist(bezier(c, u[i]), pts[i])
    if (d > max) { max = d; ou = i }
  }
  return [max, ou]
}

function newton(c, p, t) {
  const q = bezier(c, t)
  const d1 = [0, 1, 2].map(i => mul(sub(c[i + 1], c[i]), 3))
  const d2 = [0, 1].map(i => mul(sub(d1[i + 1], d1[i]), 2))
  const u = 1 - t
  const q1 = add(add(mul(d1[0], u * u), mul(d1[1], 2 * u * t)), mul(d1[2], t * t))
  const q2 = add(mul(d2[0], u), mul(d2[1], t))
  const num = dot(sub(q, p), q1)
  const den = dot(q1, q1) + dot(sub(q, p), q2)
  return den ? t - num / den : t
}

export function ajuster(pts, t1, t2, erreur, sortie = [], profondeur = 0) {
  if (pts.length === 2) {
    const d = dist(pts[0], pts[1]) / 3
    sortie.push([pts[0], add(pts[0], mul(t1, d)), add(pts[1], mul(t2, d)), pts[1]])
    return sortie
  }
  let u = parametres(pts)
  let c = generer(pts, u, t1, t2)
  let [e, ou] = pire(pts, c, u)
  if (e < erreur) { sortie.push(c); return sortie }
  if (e < erreur * 4) {
    for (let k = 0; k < 6; k++) {
      u = u.map((t, i) => newton(c, pts[i], t))
      c = generer(pts, u, t1, t2);
      [e, ou] = pire(pts, c, u)
      if (e < erreur) { sortie.push(c); return sortie }
    }
  }
  if (profondeur > 40 || pts.length < 4) { sortie.push(c); return sortie }
  ou = Math.max(1, Math.min(pts.length - 2, ou))
  const tc = norm(sub(pts[ou - 1], pts[ou + 1]))
  ajuster(pts.slice(0, ou + 1), t1, tc, erreur, sortie, profondeur + 1)
  ajuster(pts.slice(ou), mul(tc, -1), t2, erreur, sortie, profondeur + 1)
  return sortie
}

/* LA TANGENTE au bout d'un morceau, lue sur quelques points. */
function tangente(pts, i, sens) {
  const n = pts.length
  const j = Math.max(0, Math.min(n - 1, i + sens * Math.min(3, n - 1)))
  return norm(sub(pts[j], pts[i]))
}

/* UNE BOUCLE EN COURBES : coupée à ses pointes (ou n'importe où si elle
   n'en a pas — un rond), chaque morceau ajusté à part. */
/* LES ANGLES REDEVIENNENT VIFS : le flou arrondit le coin d'un E ; ses deux
   côtés, prolongés en droites, se croisent là où était le vrai coin. Les
   points de l'arrondi partent, le croisement les remplace.
   Seulement l'arrondi que le flou a pu faire (`arrondi`, en pixels : il
   grandit quand l'angle se ferme) et entre deux côtés vraiment droits (29
   septembre 2026 : sur un petit texte, le bout arrondi d'un « e », le pied
   d'un « t » se prolongeaient en épines). */
export function aiguiser(pts, coins, k, arrondi = Infinity) {
  const n = pts.length
  if (!coins.length || n < 6 * k) return { pts, coins }
  const pris = new Uint8Array(n)
  const vers = new Map()
  const at = i => pts[((i % n) + n) % n]
  /* Un côté droit : ses points à moins d'un quart de pixel (ou du
     dixième de sa longueur) de la corde. */
  const droit = (i0, i1) => {
    const A = at(i0), B = at(i1), u = sub(B, A), l = Math.hypot(u[0], u[1])
    if (!l) return false
    for (let i = i0 + 1; i < i1; i++) {
      const v = sub(at(i), A)
      if (Math.abs(u[0] * v[1] - u[1] * v[0]) / l > Math.max(0.25, 0.1 * l)) return false
    }
    return true
  }
  coins.forEach((c, j) => {
    const prec = coins[(j - 1 + coins.length) % coins.length], suiv = coins[(j + 1) % coins.length]
    const ecart = (a, b) => ((b - a) % n + n) % n
    /* Deux angles proches (le haut d'un M) : chacun ne regarde que sa moitié
       du côté qu'ils partagent. */
    const kk = coins.length > 1 ? Math.min(k, Math.floor(Math.min(ecart(prec, c), ecart(c, suiv)) / 2.2)) : k
    if (kk < 3) return
    const p1 = at(c - kk), a = norm(sub(p1, at(c - 2 * kk)))
    const p2 = at(c + kk), b = norm(sub(at(c + 2 * kk), p2))
    const det = a[0] * b[1] - a[1] * b[0]
    if (Math.abs(det) < 0.2) return
    if (arrondi < Infinity && (!droit(c - 2 * kk, c - kk) || !droit(c + kk, c + 2 * kk))) return
    const d = sub(p2, p1)
    const t = (d[0] * b[1] - d[1] * b[0]) / det
    const x = add(p1, mul(a, t))
    const demi = Math.sqrt(Math.max(0.01, (1 + dot(a, b)) / 2))
    if (dist(x, pts[c]) > Math.min(3 * k, arrondi / demi) || t < 0) return
    for (let i = c - kk + 1; i < c + kk; i++) if (i !== c) pris[((i % n) + n) % n] = 1
    vers.set(c, x)
  })
  const sortie = [], nouveaux = []
  const est = new Set(coins)
  for (let i = 0; i < n; i++) {
    if (pris[i]) continue
    if (est.has(i)) nouveaux.push(sortie.length)
    sortie.push(vers.get(i) || pts[i])
  }
  return { pts: sortie, coins: nouveaux }
}

/* `geo` : la géométrie parfaite (lib/geometrie.js) — ses ronds, ses
   droites ; null, tout en courbes. */
export function boucleEnCourbes(pts, erreur, angleMin, passes = 3, k = 4, geo = null, arrondi = Infinity) {
  const vif = aiguiser(pts, pointes(pts, angleMin, k), k, arrondi)
  pts = vif.pts
  const fixes = vif.coins
  const lisse = lisser(pts, fixes, passes)
  if (geo) {
    const g = formesParfaites(lisse, fixes, Object.assign({ erreur, ajuster }, geo))
    if (g) return g
  }
  const n = lisse.length
  const coupes = fixes.length ? fixes : [0]
  const courbes = []
  for (let k = 0; k < coupes.length; k++) {
    const a = coupes[k]
    const b = coupes.length === 1 ? a + n : (coupes[(k + 1) % coupes.length] + (k + 1 === coupes.length ? n : 0))
    const morceau = []
    for (let i = a; i <= b; i++) morceau.push(lisse[i % n])
    let t1, t2
    if (fixes.length) {
      t1 = tangente(morceau, 0, 1)
      t2 = tangente(morceau, morceau.length - 1, -1)
    } else {
      /* Un rond : la même tangente au départ et à l'arrivée, pas de pli. */
      t1 = norm(sub(lisse[1 % n], lisse[n - 1]))
      t2 = mul(t1, -1)
    }
    ajuster(morceau, t1, t2, erreur, courbes)
  }
  return courbes
}

const f = v => { const r = Math.round(v * 100) / 100; return Object.is(r, -0) ? '0' : String(r) }

/* Une droite ([p0, p1]) s'écrit L — un segment sans poignées ; la
   dernière, qui revient au départ, est la fermeture (Z). */
/* LES COURBES EN POINTS : chaque segment de Bézier coupé en petits pas
   (un demi-pixel de l'image reçue au plus), à l'échelle `k`. */
function aplatir(courbes, k) {
  const pts = [courbes[0][0][0] * k, courbes[0][0][1] * k]
  for (const c of courbes) {
    if (c.length === 2) { pts.push(c[1][0] * k, c[1][1] * k); continue }
    const long = (dist(c[0], c[1]) + dist(c[1], c[2]) + dist(c[2], c[3])) * k
    const pas = Math.max(2, Math.min(64, Math.ceil(long / 0.5)))
    for (let i = 1; i <= pas; i++) { const q = bezier(c, i / pas); pts.push(q[0] * k, q[1] * k) }
  }
  return Float32Array.from(pts)
}

function cheminSvg(courbes, k) {
  if (!courbes.length) return ''
  let d = 'M' + f(courbes[0][0][0] * k) + ' ' + f(courbes[0][0][1] * k)
  courbes.forEach((c, i) => {
    if (c.length === 2) { if (i < courbes.length - 1) d += 'L' + f(c[1][0] * k) + ' ' + f(c[1][1] * k) }
    else d += 'C' + [c[1], c[2], c[3]].map(p => f(p[0] * k) + ' ' + f(p[1] * k)).join(' ')
  })
  return d + 'Z'
}

/* LE TRAVAIL QUI NE DÉPEND PAS DU LISSAGE : l'image à la bonne taille,
   ses teintes et la couverture de chacune. */
function preparer(data, largeur, hauteur, fonds, source, alpha, cote = 0, trouer = true, nuances = false, fusion = 1, origine = 0) {
  /* Un petit logo (512 px) se trace agrandi : le contour passe entre les
     pixels au lieu de suivre leur escalier, le lissage ne mange plus les
     angles des lettres. */
  const cible = cote || (Math.max(largeur, hauteur) < COTE_MIN ? COTE_MIN : COTE_MAX)
  const aLaTaille = c => Math.max(largeur, hauteur) < c ? (d => agrandir(d, largeur, hauteur, c)) : (d => reduire(d, largeur, hauteur, c))
  let taille = aLaTaille(cible)
  let petit = taille(data)
  let k = largeur / petit.largeur
  let src = source ? taille(source).data : null
  /* Le sujet trouvé par l'IA n'a pas de « couleur retirée » : on la lit
     sur l'image reçue, là où le détourage a tout effacé. */
  if (src && !fonds.length) fonds = fondsLus(src, petit.data)
  /* Un pixel du fichier d'origine (avant l'IA), en pixels de travail. */
  const pasFichier = petit.largeur / largeur * (origine ? Math.max(largeur, hauteur) / origine : 1)
  let { logo, fond, ombres } = teintes(petit.data, fonds, alpha, trouer, fusion, petit.largeur, pasFichier)
  /* Un dégradé se trace en tons, de vraies formes (voir `tons`). */
  const degrade = estDegrade(petit.data, logo)
  let lu = src || petit.data
  let plat = nuances && degrade ? plats(lu, petit.largeur, petit.hauteur) : null
  let enTons = false
  let votants = null
  if (plat) {
    /* Les tons d'une même couleur n'en font qu'une (voir `nuancesFondues`) :
       le vecteur dit la forme — l'or franc d'un monogramme, ses filets
       crème —, la version image garde le dégradé (« le vectoriel sert pour
       le monogramme ; les dégradés or, je les obtiens avec une image »). */
    const brut = tons(petit.data, fond, TONS_MAX, plat)
    const { teintes: t, groupe } = nuancesGroupees(petit.data, brut, fusion, petit.largeur, pasFichier)
    if (t.length) {
      logo = t
      enTons = true
      votants = { tons: brut, groupe }
      if (!cote && Math.max(petit.largeur, petit.hauteur) > COTE_TONS) {
        taille = aLaTaille(COTE_TONS)
        petit = taille(data)
        k = largeur / petit.largeur
        if (src) src = taille(source).data
        lu = src || petit.data
      }
      /* Le grain parti, les frontières des tons suivent des courbes. */
      lu = diffuser(lu, petit.largeur, petit.hauteur)
      if (src) src = lu
    }
  }
  /* Les teintes présentes à deux pixels et demi de l'image reçue autour de
     chaque point (voir `voisinage`). */
  const rayon = Math.max(3, Math.round(2.5 * petit.largeur / largeur))
  const masques = enTons
    ? voisinageTons(source || data, data, largeur, hauteur, petit.largeur, petit.hauteur, logo, 3, votants)
    : voisinage(lu, petit.largeur, petit.hauteur, logo, fond, rayon)
  const cartes = alpha ? (src && fond.length ? coutures(petit, src, logo, fond, ombres, masques, trouer) : couvertures(petit.data, petit.largeur, petit.hauteur, logo, ombres, masques)) : couvertures(src || petit.data, petit.largeur, petit.hauteur, logo, fond, masques)
  /* Un aplat, une teinte : seuls les dégradés gardent leurs tons. */
  if (enTons) aplatsUnis(cartes, logo, lu, petit.largeur, petit.hauteur)
  /* Avec l'image reçue, le détourage ne dit plus que OÙ est le logo (un peu
     élargi : un bord grignoté se retrouve) ; ses couleurs disent le bord. */
  if (src && !alpha) {
    const zone = elargir(petit.data, petit.largeur, petit.hauteur, Math.max(2, Math.round(Math.max(petit.largeur, petit.hauteur) / 400)))
    for (const c of cartes) for (let i = 0; i < c.length; i++) c[i] *= zone[i]
  }
  return { petit, k, logo, fond, cartes, degrade, enTons, lu }
}

/* TOUT LE VECTEUR LISSE. `data` : l'image détourée (RVBA) ; `fonds` : les
   couleurs retirées (lib/detourage.js), pour reconnaître l'ombre.
   `source` : l'image reçue, avant détourage — ses bords sont nets, là où
   le détourage a pu en grignoter. `alpha` : le bord est celui du
   détourage (le sujet de l'IA, au bord déjà juste ; les faces grises d'un
   relief, trop proches du fond en couleur, y restent entières) — les
   couleurs ne tranchent plus qu'entre teintes et ombres. `mono` : une
   seule forme, une seule couleur. `lissage` (0 à 100) : le flou et l'écart
   toléré au vrai bord. Rend le SVG (rogné au dessin), son cadre, ses
   teintes, et le nombre de formes. */
export function vectoriserLisse(data, largeur, hauteur, { fonds = [], lissage = 70, source = null, alpha = false, mono = false, memo = null, coteTravail = 0, trouer = true, geometrie = true, miettes = true, origine = 0, sans = [], nuances = false, fusion = 1, texte = false, remplacements = [] } = {}) {
  /* `memo` : les couvertures d'un même détourage, gardées d'un appel à
     l'autre — le curseur du lissage ne refait que le tracé. */
  /* `coteTravail` : la taille de travail imposée (l'aperçu du curseur, plus petit). */
  const cle = 'base' + coteTravail + trouer + nuances + '|' + fusion
  const base = (memo && memo[cle]) || preparer(data, largeur, hauteur, fonds, source, alpha, coteTravail, trouer, nuances, fusion, origine)
  if (memo) memo[cle] = base
  const { petit, k, logo, fond } = base
  let cartes = base.cartes
  /* LE PIXEL D'ORIGINE, en pixels de travail : `origine` est le grand côté
     du fichier reçu — celui d'avant le nettoyage IA, qui l'a agrandi quatre
     fois sans y ajouter d'information. C'est à lui que se mesure ce qui
     est un détail ou un accroc. */
  const ech = Math.max(petit.largeur, petit.hauteur) / Math.max(largeur, hauteur)
  const echO = Math.max(ech, Math.max(petit.largeur, petit.hauteur) / (origine || Math.max(largeur, hauteur)))
  /* LES MIETTES PARTENT (voir `sansMiettes`) : sous un pixel et demi de
     l'image reçue, moins épaisses qu'un pixel de l'image — ou qu'un
     demi-pixel du fichier d'origine —, ou sous trois pixels de côté et
     seules de leur teinte à quatre pixels à la ronde. Gardé d'un lissage à
     l'autre : ça ne dépend que du détourage. */
  /* Un dégradé tracé en tons (voir `tons`) n'a pas de liseré : ses tons ne
     se lisent que là où la couleur est posée à plat. Un filet fin y est du
     dessin — le trait clair d'un monogramme doré, un pixel et demi de large
     (27 septembre 2026, « le trait blanc en arc de cercle doit être
     parfait ») : seules les poussières partent. */
  if (miettes) {
    const cleM = 'miettes' + origine
    if (!base[cleM]) base[cleM] = sansMiettes(cartes.map(c => Float32Array.from(c)), petit.largeur, petit.hauteur, { aireMax: Math.max(1.5 * ech, 0.8 * echO) ** 2, epaisseurMin: base.enTons ? 0 : Math.max(0.9 * ech, 0.5 * echO), isole: { aire: (3 * echO) ** 2, rayon: Math.max(2, Math.round(4 * echO)) } })
    cartes = base[cleM].cartes
  }
  /* Les couches, de la plus grande à la plus petite ; une teinte retirée à
     la main (`sans`, en couleurs pures) n'en fait plus partie : là où elle
     était, le logo est à jour. */
  const poids = cartes.map(c => { let s = 0; for (let i = 0; i < c.length; i += 7) s += c[i]; return s })
  const retiree = i => sans.some(c => c.every((v, j) => v === pure(logo[i])[j]))
  const ordre = logo.map((_, i) => i).filter(i => !retiree(i)).sort((a, b) => poids[b] - poids[a])
  if (!ordre.length) return { svg: '', couleurs: [], formes: 0, noeuds: 0, cadre: null }
  /* UNE SEULE COULEUR : toutes les teintes ne font plus qu'une forme, de la
     couleur la plus présente — le DTF d'une couleur, qu'on teinte ensuite. */
  if (mono && ordre.length > 1) {
    /* Le blanc ENFERMÉ dans un logo foncé (un script dans un disque noir)
       reste un jour : sur le t-shirt, c'est le tissu qui le fait (`mono:
       'fonce'`, le DTF d'une couleur ; `mono: true`, la silhouette
       entière). Le blanc qui borde le vide — un texte blanc, le reflet d'un
       filet — est du dessin : il prend la couleur (voir `jours`). */
    const clair = c => Math.min(...c) > 215
    const fonces = ordre.filter(i => !clair(logo[i]))
    const union = new Float32Array(cartes[ordre[0]].length)
    if (mono === 'fonce' && fonces.length && fonces.length < ordre.length) {
      const clairs = new Float32Array(union.length)
      for (const i of ordre) { const c = cartes[i], cible = clair(logo[i]) ? clairs : union; for (let j = 0; j < union.length; j++) cible[j] += c[j] }
      const jour = jours(clairs, union, petit.largeur, petit.hauteur)
      for (let j = 0; j < union.length; j++) union[j] += clairs[j] * (1 - jour[j])
      ordre.splice(0, ordre.length, fonces[0])
    } else {
      for (const i of ordre) { const c = cartes[i]; for (let j = 0; j < union.length; j++) union[j] += c[j] }
    }
    cartes = cartes.slice()
    cartes[ordre[0]] = union
    ordre.length = 1
  }
  const l = Math.max(0, Math.min(100, lissage)) / 100
  const cote = Math.max(petit.largeur, petit.hauteur)
  /* Le flou se mesure en pixels de l'image reçue : agrandie, elle garde ses
     marches, qu'il faut fondre. */
  /* Le flou de la taille de travail normale, ramené à celle-ci (l'aperçu,
     plus petit, floute autant l'image reçue). */
  /* Un pixel de l'image tracée, en pixels de travail. Le flou vaut un
     pixel d'elle, pas plus (29 septembre 2026) : il grandissait avec
     l'image — sur le logo agrandi quatre fois par l'IA, huit pixels de
     flou éteignaient les déliés d'un « BOAT » ou d'un « CHARTERS » que
     l'IA avait pourtant dessinés nets. */
  const orig = Math.max(largeur, hauteur)
  const sigma = Math.max(0.7, 0.7 * (0.6 + l * 0.9) * cote / orig)
  const erreur = 0.25 + l * 0.6
  const passes = Math.round(2 + l * l * 30)
  /* LA PLUS PETITE FORME : moins de quatre cinquièmes d'un pixel du
     fichier de côté — une poussière. Au-delà, un point sur un « i », un
     accent, une apostrophe (29 septembre 2026 : sous un cent-millième de
     l'image, ils partaient — les accents de « tête » avec). Sur une couche
     du dessus, pareil : ce qu'elle perdrait, la couche du dessous le
     peindrait d'une autre couleur. */
  const aireMin = Math.max(4, (0.8 * echO) ** 2)
  const aireMinDessus = aireMin
  /* LA GÉOMÉTRIE PARFAITE (lib/geometrie.js) : une droite ou un rond tient
     à un demi-pixel du fichier d'origine — ou à l'écart du tracé, s'il est
     plus large. */
  const tolG = Math.max(erreur * 1.2, 0.45 * echO)
  const geo = geometrie ? { tol: tolG, longMin: Math.max(8 * tolG, cote * 0.008), droit: 2, pli: Math.max(6, Math.round(3 * sigma), Math.round(3 * echO)) } : null
  const formes = []
  let nombre = 0, noeuds = 0
  const boite = [Infinity, Infinity, -Infinity, -Infinity]
  const W = petit.largeur, H = petit.hauteur
  const rr = Math.ceil(2 * sigma) + 1
  /* Chaque couche se calcule dans son cadre, élargi de ce que le flou et le
     renfort étalent : une petite teinte ne coûte que sa place. */
  const marge = Math.ceil(3 * sigma) + 2 * rr + 4
  /* Le cadre de chaque couche, une fois ; celui de tout ce qui est posé
     au-dessus d'elle, en remontant. */
  const N = ordre.length
  const cadres = ordre.map(i => cadreCarte(cartes[i], W, H))
  const dessus = new Array(N)
  for (let r = N - 1, acc = null; r >= 0; r--) {
    const c = cadres[r]
    if (c) acc = acc ? [Math.min(acc[0], c[0]), Math.min(acc[1], c[1]), Math.max(acc[2], c[2]), Math.max(acc[3], c[3])] : c.slice()
    dessus[r] = acc
  }
  /* UNE COUCHE TRACÉE : sa couverture (`union`, recadrée en x0, y0), floutée,
     ses filets remontés, son contour à mi-hauteur, ses courbes. */
  /* Les anneaux redessinés (lib/geometrie.js, `anneaux`) : une boucle qui
     en suit un bord devient ce cercle exact, ou ce bord tendu s'il est
     dessiné — le même pour toutes les couches qui le partagent. */
  let ronds = []
  const tolRond = Math.max(1.5, echO)
  const auCompas = b => {
    for (const a of ronds) {
      /* Un anneau qui n'est qu'un rond abîmé se trace au compas ; un
         anneau au dessin irrégulier, par son bord tendu — la boucle doit
         en faire le tour. */
      if (a.geometrique) {
        for (const c of [a.c1, a.c2]) {
          const e = b.map(p => Math.abs(Math.hypot(p[0] - c.cx, p[1] - c.cy) - c.r)).sort((u, v) => u - v)
          if (e[e.length >> 1] <= 1.5 * tolRond && e[Math.floor(e.length * 0.85)] <= 2 * tolRond) return arcs(c.cx, c.cy, c.r, c.r, aire(b))
        }
        continue
      }
      let tour = 0
      for (let i = 0; i < b.length; i++) {
        const p = b[i], q = b[(i + 1) % b.length]
        let d = Math.atan2(q[1] - a.cy, q[0] - a.cx) - Math.atan2(p[1] - a.cy, p[0] - a.cx)
        if (d > Math.PI) d -= 2 * Math.PI
        if (d < -Math.PI) d += 2 * Math.PI
        tour += d
      }
      if (Math.abs(Math.abs(tour) - 2 * Math.PI) > 0.5) continue
      for (const r of [a.profil.rout, a.profil.rin]) {
        const e = b.map(p => Math.abs(Math.hypot(p[0] - a.cx, p[1] - a.cy) - rayonProfil(r, Math.atan2(p[1] - a.cy, p[0] - a.cx)))).sort((u, v) => u - v)
        if (e[e.length >> 1] <= 1.5 * tolRond && e[Math.floor(e.length * 0.85)] <= 2 * tolRond) return bordDessine(a.cx, a.cy, r, aire(b))
      }
    }
    return null
  }
  const tracerUnion = (union, x0, y0, cw, ch, amin) => {
    const B = flou(union, cw, ch, sigma)
    /* Les filets fins, pleins (un trait doré) comme vides (un script blanc
       dans un disque noir, le jour entre deux plumes). */
    /* Un dégradé tracé en tons additionne de faibles traces au bord des
       lettres (l'anticrénelage, partagé entre ses tons) : seul un sommet
       d'un quart s'y remonte — un vrai filet d'un pixel culmine là. */
    const trace = base.enTons ? 0.25 : 0.05
    const plein = renforcer(B, cw, ch, rr, trace, union)
    const vide = renforcer(B.map(v => 1 - v), cw, ch, rr, trace, union.map(v => 1 - v))
    const lisse = B.map((v, i) => Math.max(0, Math.min(1, plein[i] - vide[i] + 1 - v)))
    const boucles = contours(lisse, cw, ch, 0.5).filter(b => Math.abs(aire(b)) >= amin)
    for (const b of boucles) for (const p of b) { p[0] += x0; p[1] += y0 }
    if (!boucles.length) return null
    for (const b of boucles) {
      for (const p of b) {
        if (p[0] < boite[0]) boite[0] = p[0]
        if (p[1] < boite[1]) boite[1] = p[1]
        if (p[0] > boite[2]) boite[2] = p[0]
        if (p[1] > boite[3]) boite[3] = p[1]
      }
    }
    const polys = []
    let nn = 0
    const d = boucles.map(b => {
      const courbes = auCompas(b) || boucleEnCourbes(b, erreur, 50, passes, Math.max(4, Math.round(2 * sigma) + 2, geometrie ? Math.round(echO) : 0), geo, 1.5 * sigma + 0.5)
      nn += courbes.length
      polys.push(aplatir(courbes, k))
      return cheminSvg(courbes, k)
    }).join('')
    return { d, polys, boucles: boucles.length, noeuds: nn }
  }
  const recadrer = (u) => {
    const x0 = Math.max(0, u[0] - marge), y0 = Math.max(0, u[1] - marge)
    const x1 = Math.min(W - 1, u[2] + marge), y1 = Math.min(H - 1, u[3] + marge)
    return [x0, y0, x1 - x0 + 1, y1 - y0 + 1]
  }
  /* LA SILHOUETTE D'ABORD, LES COULEURS PAR-DESSUS (29 septembre 2026 :
     « on ne doit pas voir les lettres disparaître »). Une petite lettre
     grise se partage entre deux gris, un délié entre le doré et sa
     lumière : tracé chacun de son côté, chaque morceau, trop mince,
     s'éteignait — et la lettre avec. Ici, la couche du dessous est TOUT le
     dessin (la silhouette, d'une pièce : rien ne s'y perd), et chaque
     couche du dessus est la silhouette là où elle, ou une couche posée
     sur elle, fait la couleur (`rangs`). Les couches s'emboîtent : pas de
     jour entre deux couleurs. Et là où une couleur touche le vide, son
     bord est celui de la silhouette — la même carte, le même contour :
     pas de liseré de la couche du dessous autour des lettres (28
     septembre 2026, un liseré orange cernait les lettres noires d'un
     phénix). */
  const tout = new Float32Array(W * H)
  for (const i of ordre) { const c = cartes[i]; for (let q = 0; q < c.length; q++) tout[q] += c[q] }
  for (let q = 0; q < tout.length; q++) if (tout[q] > 1) tout[q] = 1
  const rang = fusion > 0 ? rangs(ordre.map(i => cartes[i]), tout, W, H, 0.5, { couleurs: ordre.map(i => logo[i]), petit: Math.round(0.1 * cote), voisins: 25 * Math.min(fusion, 1.6), rvb: base.lu, mince: 3.5 * echO, liseré: Math.max(1, Math.round(0.7 * echO)) }) : rangs(ordre.map(i => cartes[i]), tout, W, H)
  /* LES ANNEAUX (lib/geometrie.js, `anneaux`) : un rond d'au moins un
     vingtième du logo, qui entoure quelque chose ; au compas s'il n'est
     qu'un rond abîmé, sinon son dessin, tendu. */
  if (geometrie && ordre.length) {
    /* Les familles : des couleurs voisines (deux gris d'un anneau argenté,
       pas le blanc qu'il entoure) cherchées ensemble. */
    const cols = ordre.map(i => logo[i]), chef = cols.map((_, i) => i)
    const trouver = i => { while (chef[i] !== i) i = chef[i] = chef[chef[i]]; return i }
    const neutre = c => Math.hypot(lab(c)[1], lab(c)[2]) < 12
    for (let i = 0; i < cols.length; i++) for (let j = i + 1; j < cols.length; j++) {
      const gris = neutre(cols[i]) && neutre(cols[j])
      if (gris ? Math.abs(lab(cols[i])[0] - lab(cols[j])[0]) < 35 && Math.max(lab(cols[i])[0], lab(cols[j])[0]) < 92 : ecartOeil(cols[i], cols[j]) < 20) chef[trouver(j)] = trouver(i)
    }
    const familles = [...new Set(cols.map((_, i) => trouver(i)))].map(g => cols.map((_, i) => i).filter(i => trouver(i) === g)).filter(f => f.length > 1)
    ronds = anneaux(rang, tout, W, H, ordre.length, { tol: tolRond, rayonMin: Math.max(12, 0.05 * cote), familles })
  }
  /* UN VRAI MODELÉ (voir `modelePerdu`) : des faux contours sur une bonne
     longueur — un dégradé tranché en aplats —, ou une texture. Le
     graphiste ouvre alors sur la version image ; sinon sur le vecteur,
     même si le fichier avait un peu de grain ou un anneau argenté. */
  let degrade = false
  if (base.degrade) {
    const m = modelePerdu(rang, tout, base.lu, ordre.map(i => logo[i]), W, H, Math.max(2, Math.round(1.5 * echO)))
    degrade = (m.faux >= 0.4 && m.frontiere >= 0.3 * Math.sqrt(m.dessin)) || m.grain >= 0.15
    if (globalThis.process?.env?.DEBUG_MODELE) console.log('modele', JSON.stringify(m), 'degrade', degrade)
  }
  /* LE TEXTE (lib/polices.js) : les lignes de lettres du dessin, pour les
     lire (`texte`) ; et, pour celles dont la police est choisie
     (`remplacements` : { boite, texte, police } — la ligne retrouvée à son
     cadre), les lettres de la police
     à la place des lettres tracées — ce qu'elles couvraient rendu à ce qui
     les entourait (le vide, ou la forme sur laquelle elles étaient
     posées), elles posées par-dessus, chacune de sa couleur. */
  /* Le texte se cherche sur l'encre du dessin : pas sur ce qui a la couleur
     du fond (le blanc gardé dans les creux, un disque blanc) — sans quoi
     les lettres collent à ce qui les entoure. */
  let encre = tout
  if ((texte || remplacements.length) && !coteTravail) {
    const commeFond = ordre.map(i => fond.some(f => ecartOeil(logo[i], f) < 12))
    if (commeFond.some(Boolean)) {
      encre = new Float32Array(tout.length)
      for (let p = 0; p < tout.length; p++) if (rang[p] >= 0 && !commeFond[rang[p]]) encre[p] = tout[p]
    }
  }
  const lignesT = (texte || remplacements.length) && !coteTravail ? lignesTexte(encre, W, H) : null
  const lettresPolice = new Map()
  /* Les pixels de toutes les lettres : une voisine ne dit pas ce qu'il y a
     autour d'une lettre. */
  let dansTexte = null
  if (lignesT && remplacements.length) {
    dansTexte = new Uint8Array(W * H)
    for (const li of lignesT) for (const l of li) for (const p of l.pixels) dansTexte[p] = 1
  }
  for (const rp of lignesT ? remplacements : []) {
    const li = ligneDe(lignesT, rp.boite)
    if (li && rp.ecriture) {
      /* UNE ÉCRITURE (lib/ecriture.js) : la ligne d'un tenant, reposée sur
         son encre ; ses lettres tracées rendues à ce qui les entourait, le
         texte de la police par-dessus, de la couleur de la ligne. */
      const obs = encreLigne(li, W)
      const brute = poserTexte(rp.police, rp.texte, obs)
      const fine = brute && poserTexte(rp.police, rp.texte, obs, { autour: brute })
      const pose = fine && fine.note >= brute.note ? fine : brute
      if (!pose) continue
      const votes = new Map()
      for (const l of li) for (const p of l.pixels) if (rang[p] >= 0 && tout[p] >= 0.5) votes.set(rang[p], (votes.get(rang[p]) || 0) + 1)
      let couleur = -1, mieux = 0
      for (const [v, k] of votes) if (k > mieux) { mieux = k; couleur = v }
      if (couleur < 0) continue
      for (const l of li) effacerLettre(l, rang, tout, W, H, dansTexte)
      if (!lettresPolice.has(couleur)) lettresPolice.set(couleur, [])
      lettresPolice.get(couleur).push({ chemin: cheminEcriture(pose, obs) })
      continue
    }
    const glyphes = li && glyphesDe(li, rp.texte, W)
    if (!glyphes) continue
    const pose = noter(glyphes, rp.police)
    /* La couleur de chaque lettre : celle de la plupart de ses pixels ; et
       celle de la ligne, qu'une lettre d'un gris voisin rejoint (un i
       resté plus pâle que ses voisines). */
    const couleurDe = g => {
      const votes = new Map()
      for (const p of g.pixels) votes.set(rang[p], (votes.get(rang[p]) || 0) + 1)
      let c = -1, m = 0
      for (const [v, k] of votes) if (v >= 0 && k > m) { m = k; c = v }
      return c
    }
    const parLettre = glyphes.map(g => g.ponctuation ? -1 : couleurDe(g))
    const poidsCouleur = new Map()
    glyphes.forEach((g, i) => { if (parLettre[i] >= 0) poidsCouleur.set(parLettre[i], (poidsCouleur.get(parLettre[i]) || 0) + g.pixels.length) })
    let deLigne = -1, pm = 0
    for (const [c, k] of poidsCouleur) if (k > pm) { pm = k; deLigne = c }
    const gris = c => { const l = lab(logo[ordre[c]]); return Math.hypot(l[1], l[2]) < 12 && l[0] < 90 }
    glyphes.forEach((g, i) => {
      const ps = pose.poses && pose.poses[i]
      if (g.ponctuation || !ps) return
      let couleur = parLettre[i]
      if (couleur < 0) return
      if (couleur !== deLigne && deLigne >= 0 && gris(couleur) && gris(deLigne)) couleur = deLigne
      effacerLettre(g, rang, tout, W, H, dansTexte)
      if (!lettresPolice.has(couleur)) lettresPolice.set(couleur, [])
      lettresPolice.get(couleur).push({ pose: ps, echelle: pose.echelle, base: pose.base, police: rp.police })
    })
  }
  const traces = new Array(N)
  const couches = new Array(N)
  let silhouette = ''
  for (let r = N - 1; r >= 0; r--) {
    const u = dessus[r]
    if (!u) continue
    const [x0, y0, cw, ch] = recadrer(u)
    const union = new Float32Array(cw * ch)
    for (let y = 0; y < ch; y++) {
      const o = (y + y0) * W + x0
      for (let x = 0; x < cw; x++) if (rang[o + x] >= r) union[y * cw + x] = tout[o + x]
    }
    const t = tracerUnion(union, x0, y0, cw, ch, r ? aireMinDessus : aireMin)
    if (!t) continue
    nombre += t.boucles
    noeuds += t.noeuds
    const c = pure(logo[ordre[r]].map(Math.round))
    traces[r] = '<path fill="rgb(' + c.join(',') + ')" fill-rule="evenodd" d="' + t.d + '"/>'
    /* LA SILHOUETTE : la couche du dessous — la découpe de la version
       image, le blanc DTF d'un dégradé. */
    if (!r) silhouette = traces[r]
    /* Ses courbes, aplaties en pixels de l'image reçue : la version image
       s'y découpe (lib/image-nette.js, `imageParCouches`) — les mêmes
       coins vifs, les mêmes ronds que le vecteur. */
    couches[r] = { couleur: logo[ordre[r]].map(Math.round), boucles: t.polys }
  }
  for (const t of traces) if (t) formes.push(t)
  /* Les lettres des polices, par-dessus, une forme par couleur. */
  for (const [r, lettres] of lettresPolice) {
    let d = ''
    const boucles = []
    /* Les écritures : leurs lettres se chevauchent aux liaisons, et tout
       se remplit en pair-impair (le SVG, le PDF, l'EPS, la version image).
       Rendues en couverture (quatre sous-pixels de côté), puis retracées,
       elles sortent en contours nets, d'un seul tenant. */
    const ecrites = lettres.filter(l => l.chemin)
    if (ecrites.length) {
      const polys = ecrites.flatMap(l => polygones(l.chemin, 24))
      let X0 = Infinity, Y0 = Infinity, X1 = -Infinity, Y1 = -Infinity
      for (const p of polys) for (const [x, y] of p) { X0 = Math.min(X0, x); Y0 = Math.min(Y0, y); X1 = Math.max(X1, x); Y1 = Math.max(Y1, y) }
      const x0 = Math.max(0, Math.floor(X0) - 3), y0 = Math.max(0, Math.floor(Y0) - 3)
      const cw = Math.min(W, Math.ceil(X1) + 4) - x0, ch = Math.min(H, Math.ceil(Y1) + 4) - y0
      if (cw > 0 && ch > 0) {
        const SS = 4
        const fin = remplirPolys(polys.map(p => p.map(([x, y]) => [(x - x0) * SS, (y - y0) * SS])), 0, 0, cw * SS, ch * SS)
        const union = new Float32Array(cw * ch)
        for (let y = 0; y < ch * SS; y++) for (let x = 0; x < cw * SS; x++) if (fin[y * cw * SS + x]) union[((y / SS) | 0) * cw + ((x / SS) | 0)] += 1 / (SS * SS)
        const t = tracerUnion(union, x0, y0, cw, ch, aireMinDessus)
        if (t) {
          d += t.d
          for (const b of t.polys) boucles.push(b)
          nombre += t.boucles
          noeuds += t.noeuds
          boite[0] = Math.min(boite[0], X0); boite[1] = Math.min(boite[1], Y0); boite[2] = Math.max(boite[2], X1); boite[3] = Math.max(boite[3], Y1)
        }
      }
    }
    for (const l of lettres) {
      if (l.chemin) continue
      d += glyphesSvg([l.pose], l.echelle, l.base, l.police, k)
      for (const poly of polygones(cheminPose(l.pose, l.echelle, l.base, l.police))) {
        const plat = new Float32Array(poly.length * 2)
        poly.forEach(([x, y], j) => {
          plat[2 * j] = x * k; plat[2 * j + 1] = y * k
          if (x < boite[0]) boite[0] = x
          if (y < boite[1]) boite[1] = y
          if (x > boite[2]) boite[2] = x
          if (y > boite[3]) boite[3] = y
        })
        boucles.push(plat)
      }
      nombre++
    }
    const c = pure(logo[ordre[r]].map(Math.round))
    const chemin = '<path fill="rgb(' + c.join(',') + ')" fill-rule="evenodd" d="' + d + '"/>'
    formes.push(chemin)
    silhouette += chemin
    couches.push({ couleur: logo[ordre[r]].map(Math.round), boucles, aplat: true })
  }
  if (!nombre) return { svg: '', couleurs: [], formes: 0, noeuds: 0, cadre: null }
  /* LE CADRE : rogné au dessin, en pixels de l'image reçue. */
  const x = Math.max(0, Math.floor(boite[0] * k)), y = Math.max(0, Math.floor(boite[1] * k))
  const cadre = { x, y, largeur: Math.min(largeur, Math.ceil(boite[2] * k)) - x, hauteur: Math.min(hauteur, Math.ceil(boite[3] * k)) - y }
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="' + cadre.largeur + '" height="' + cadre.hauteur
    + '" viewBox="' + [cadre.x, cadre.y, cadre.largeur, cadre.hauteur].join(' ') + '"><title>Logo vectorisé — OLDA Print Studio</title>'
    + formes.join('') + '</svg>'
  /* `degrade` : le dessin a du modelé (un dégradé, une texture) — sa
     version image le garde tel quel ; `nuances` : son vecteur est tracé en
     tons. */
  return { svg, silhouette, couleurs: ordre.map(i => pure(logo[i].map(Math.round))), fond, formes: nombre, noeuds, cadre, degrade, nuances: base.enTons, couches: couches.filter(Boolean), lignes: lignesT, largeurTravail: W }
}

/* UNE LETTRE TRACÉE S'EFFACE : ses pixels, et le liseré pâle qui les borde
   (deux pixels), reprennent ce qui l'entourait — le vide, ou la forme sur
   laquelle elle était posée (la plus présente juste autour d'elle, les
   autres lettres mises à part : `dansTexte`). */
export function effacerLettre(g, rang, tout, W, H, dansTexte = null) {
  const x0 = Math.max(0, g.x0 - 5), y0 = Math.max(0, g.y0 - 5), x1 = Math.min(W - 1, g.x1 + 5), y1 = Math.min(H - 1, g.y1 + 5)
  const l = x1 - x0 + 1, h = y1 - y0 + 1
  const sienne = new Float32Array(l * h)
  for (const p of g.pixels) { const x = p % W, y = (p - x) / W; sienne[(y - y0) * l + x - x0] = 1 }
  const pres = maxLocal(sienne, l, h, 2), loin = maxLocal(sienne, l, h, 4)
  const votes = new Map()
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      const i = y * l + x
      if (!loin[i] || pres[i]) continue
      const p = (y + y0) * W + x + x0
      if (dansTexte && dansTexte[p]) continue
      const v = tout[p] < 0.5 ? -1 : rang[p]
      votes.set(v, (votes.get(v) || 0) + 1)
    }
  }
  let autour = -1, m = -1
  for (const [v, k] of votes) if (k > m) { m = k; autour = v }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      const i = y * l + x, p = (y + y0) * W + x + x0
      if (!pres[i] || (!sienne[i] && tout[p] >= 0.5)) continue
      if (autour < 0) tout[p] = 0
      else { rang[p] = autour; tout[p] = 1 }
    }
  }
}

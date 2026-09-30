/* =============================================================== L'ÉCRITURE
   29 septembre 2026 : « sur La Piscine, en bas, St Martin c'est aussi une
   police » ; « j'ai souvent des polices dans le genre script comme ça,
   c'est important que ça fonctionne ». Un texte manuscrit — lettres liées,
   penchées, un trait de pinceau ou de stylo — ne se découpe pas en lettres
   (lib/polices.js les rapproche une à une) et l'OCR le lit mal (« St
   Morton », « Versonal Training »). Ici, la ligne entière :
   1. ce qu'on en a lu (plusieurs lectures, l'image redressée) et les mots
      proches du lexique (`relectures`, vendor/lexique/) ;
   2. les écritures de la réserve (les 360 familles manuscrites de Google
      Fonts) triées sur l'index — la longueur prévue du texte, son profil,
      l'épaisseur de son trait, son inclinaison (`trierEcritures`) ;
   3. les meilleures posées pour de vrai sur l'encre de la ligne — taille,
      étirement, espace entre les mots, place (`poserTexte`) : le trait qui
      suit au plus près celui du logo (la distance moyenne d'un trait à
      l'autre), de la même épaisseur, penché pareil ;
   4. le texte qui s'y pose le mieux l'emporte (« Martin », pas
      « Morton »), et ses écritures sont proposées.
   Rien ici ne dépend du navigateur : les polices arrivent lues
   (opentype.js), la ligne en pixels. */
import { polygones, remplir, epaisseur, cadreLigne } from './polices.js'
import { lab } from './lab.js'

/* La hauteur de travail d'une ligne, en pixels. */
export const HAUTEUR = 48

/* ------------------------------------------------------------ L'ENCRE
   Les pixels d'une ligne (ses lettres, `pixels` dans une image de
   `largeur`), ramenés à `hauteur` pixels de haut, une marge autour. Rend
   { masque, l, h, m, f, x0, y0 } — `f` : pixels de travail → pixels de la
   ligne, (`x0`, `y0`) : le coin de son cadre. */
export function encreLigne(ligne, largeur, hauteur = HAUTEUR) {
  const [x0, y0, x1, y1] = cadreLigne(ligne)
  const f = hauteur / (y1 - y0 + 1), m = Math.ceil(0.12 * hauteur)
  const l = Math.ceil((x1 - x0 + 1) * f) + 2 * m, h = hauteur + 2 * m
  const somme = new Float32Array(l * h)
  const pas = f > 1 ? Math.ceil(f) : 1
  for (const le of ligne) {
    for (const p of le.pixels) {
      const x = p % largeur, y = (p - x) / largeur
      for (let j = 0; j < pas; j++) {
        for (let i = 0; i < pas; i++) {
          const X = Math.floor((x - x0 + (i + 0.5) / pas) * f) + m, Y = Math.floor((y - y0 + (j + 0.5) / pas) * f) + m
          if (X >= 0 && Y >= 0 && X < l && Y < h) somme[Y * l + X] += f * f / (pas * pas)
        }
      }
    }
  }
  /* Un trait fin (un stylo) garde sa trace réduite : un quart de pixel. */
  const masque = Uint8Array.from(somme, v => v >= 0.25 ? 1 : 0)
  return { masque, l, h, m, f, x0, y0 }
}

/* UNE LIGNE D'UNE SEULE TEINTE ? Une écriture l'est — un dégradé doré
   aussi : la même teinte, plus ou moins claire — ; un morceau de dessin lu
   comme du texte, les facettes roses, orange et vertes d'un crabe, ne l'est
   pas. Ses pixels (dans une image de travail de `largeur` de large) lus
   dans l'image détourée (`data`, `L` × `H`) : les quatre cinquièmes de ses
   pixels colorés à moins de 25° de leur teinte médiane — ou presque tous
   gris. */
export function ligneUnie(ligne, largeur, data, L, H) {
  const f = L / largeur, teintes = []
  const tous = ligne.reduce((t, l) => t + l.pixels.length, 0)
  const pas = Math.max(1, Math.floor(tous / 1500))
  let k = 0, lus = 0
  for (const l of ligne) {
    for (const p of l.pixels) {
      if (k++ % pas) continue
      const x = Math.min(L - 1, Math.floor(((p % largeur) + 0.5) * f)), y = Math.min(H - 1, Math.floor((Math.floor(p / largeur) + 0.5) * f))
      const i = (y * L + x) * 4
      if (data[i + 3] < 128) continue
      lus++
      const c = lab([data[i], data[i + 1], data[i + 2]])
      if (Math.hypot(c[1], c[2]) >= 12) teintes.push(Math.atan2(c[2], c[1]) * 180 / Math.PI)
    }
  }
  if (teintes.length < Math.max(10, 0.25 * lus)) return true
  teintes.sort((u, v) => u - v)
  const med = teintes[teintes.length >> 1]
  return teintes.filter(t => Math.abs(((t - med + 540) % 360) - 180) < 25).length >= 0.8 * teintes.length
}

/* LA DISTANCE AU TRAIT le plus proche, en pixels (chanfrein 3-4). */
export function distances(m, l, h, sortie = null) {
  const d = sortie && sortie.length >= l * h ? sortie : new Float32Array(l * h)
  const LOIN = 1e6
  for (let k = 0; k < l * h; k++) d[k] = m[k] ? 0 : LOIN
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      const k = y * l + x
      let v = d[k]
      if (x > 0 && d[k - 1] + 3 < v) v = d[k - 1] + 3
      if (y > 0) {
        if (d[k - l] + 3 < v) v = d[k - l] + 3
        if (x > 0 && d[k - l - 1] + 4 < v) v = d[k - l - 1] + 4
        if (x < l - 1 && d[k - l + 1] + 4 < v) v = d[k - l + 1] + 4
      }
      d[k] = v
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = l - 1; x >= 0; x--) {
      const k = y * l + x
      let v = d[k]
      if (x < l - 1 && d[k + 1] + 3 < v) v = d[k + 1] + 3
      if (y < h - 1) {
        if (d[k + l] + 3 < v) v = d[k + l] + 3
        if (x < l - 1 && d[k + l + 1] + 4 < v) v = d[k + l + 1] + 4
        if (x > 0 && d[k + l - 1] + 4 < v) v = d[k + l - 1] + 4
      }
      d[k] = v
    }
  }
  for (let k = 0; k < l * h; k++) d[k] /= 3
  return d
}

/* L'INCLINAISON d'une écriture : le cisaillement (x += s·y) qui redresse le
   mieux ses traits — la projection sur les colonnes la plus nette. */
export function pente(m, l, h) {
  let meilleure = 0, net = -1
  const o = Math.ceil(h) + 2, cols = new Float64Array(l + 2 * o)
  for (let k = -4; k <= 18; k++) {
    const s = k * 0.05
    cols.fill(0)
    for (let y = 0; y < h; y++) {
      const dx = s * (y - h / 2)
      for (let x = 0; x < l; x++) if (m[y * l + x]) cols[Math.round(x + dx) + o]++
    }
    let v = 0
    for (const c of cols) v += c * c
    if (v > net) { net = v; meilleure = s }
  }
  return meilleure
}

/* ----------------------------------------------------------- LE TEXTE
   Un texte posé dans une police, glyphe après glyphe (l'avance, le
   crénage) — sans les substitutions contextuelles, qu'opentype.js ne sait
   pas toutes lire. `espace` : l'espace entre les mots, en part de celui
   de la police. Rend ses commandes (y vers le bas, la ligne de base à 0). */
export function cheminTexte(police, texte, taille, espace = 1) {
  const s = taille / police.unitsPerEm
  let x = 0, prec = null
  const commandes = []
  for (const c of String(texte)) {
    if (/\s/.test(c)) {
      const g = police.charToGlyph(' ')
      x += (g && g.advanceWidth ? g.advanceWidth : police.unitsPerEm / 4) * s * espace
      prec = null
      continue
    }
    const gl = police.charToGlyph(c)
    if (!gl || !gl.index) { x += police.unitsPerEm / 3 * s; prec = null; continue }
    if (prec) { try { x += (police.getKerningValue(prec, gl) || 0) * s } catch {} }
    for (const k of gl.getPath(x, 0, taille).commands) commandes.push(k)
    x += gl.advanceWidth * s
    prec = gl
  }
  return commandes
}

/* Les commandes transformées : x' = a·x + c, y' = b·y + d. */
export function transformer(commandes, a, b, c, d) {
  return commandes.map(k => {
    const o = { type: k.type }
    if ('x' in k) { o.x = a * k.x + c; o.y = b * k.y + d }
    if ('x1' in k) { o.x1 = a * k.x1 + c; o.y1 = b * k.y1 + d }
    if ('x2' in k) { o.x2 = a * k.x2 + c; o.y2 = b * k.y2 + d }
    return o
  })
}

function cadre(polys) {
  let X0 = Infinity, Y0 = Infinity, X1 = -Infinity, Y1 = -Infinity
  for (const p of polys) for (const [x, y] of p) { if (x < X0) X0 = x; if (y < Y0) Y0 = y; if (x > X1) X1 = x; if (y > Y1) Y1 = y }
  return X1 > X0 && Y1 > Y0 ? [X0, Y0, X1, Y1] : null
}

/* ------------------------------------------------------------ LA POSE
   Un texte dans une police, posé sur l'encre d'une ligne (`obs`,
   `encreLigne`) : calé sur le gros de son encre (`etendue`), puis la
   taille (`ks`), l'étirement (`ke`), l'espace entre les mots et la place
   (`dx`, `dy`) qui mettent son trait au plus près de celui du logo. La note : 1 / (1 + distance
   moyenne d'un trait à l'autre / 2 pixels), fois l'accord des épaisseurs
   et des inclinaisons (une écriture grasse ne remplace pas un trait de
   plume), fois sa déformation (l'étirement qui la couche sur la ligne).
   Rend { note, distance, accord,
   commandes (dans le repère de la ligne réduite) } ou null. */
/* LE GROS DE L'ENCRE d'un masque : de 3 à 97 % de ses pixels en hauteur,
   de 1 à 99 % en largeur — un point de i perché loin, un paraphe ne
   décident pas de la taille. */
function etendue(m, l, h) {
  const rangees = new Float64Array(h), colonnes = new Float64Array(l)
  let n = 0
  for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) if (m[y * l + x]) { rangees[y]++; colonnes[x]++; n++ }
  const quantile = (t, q) => { let s = 0; for (let i = 0; i < t.length; i++) { s += t[i]; if (s >= q * n) return i + 0.5 } return t.length - 0.5 }
  return { y0: quantile(rangees, 0.03), y1: quantile(rangees, 0.97), x0: quantile(colonnes, 0.01), x1: quantile(colonnes, 0.99) }
}

/* Ce que la pose et le tri lisent de la ligne, mesuré une fois : la
   distance à son trait, son épaisseur, son inclinaison, ses pixels, le gros
   de son encre. */
function mesurer(obs) {
  if (obs.dist) return obs
  obs.dist = distances(obs.masque, obs.l, obs.h)
  obs.trait = epaisseur(obs.masque, obs.l, obs.h)
  obs.pente = pente(obs.masque, obs.l, obs.h)
  const encre = []
  for (let k = 0; k < obs.masque.length; k++) if (obs.masque[k]) encre.push(k)
  obs.encre = Int32Array.from(encre)
  obs.etendue = etendue(obs.masque, obs.l, obs.h)
  return obs
}
export function poserTexte(police, texte, obs, { autour = null } = {}) {
  mesurer(obs)
  if (!obs.encre.length) return null
  const L = obs.l, H = obs.h, E = obs.etendue
  /* `autour` : une pose déjà trouvée (le même texte, ou un texte voisin),
     affinée de près. */
  const mots = /\S\s+\S/.test(texte)
  const tailles = autour ? [0.97, 1, 1.03].map(k => k * autour.ks) : [0.84, 0.92, 1, 1.08, 1.16]
  const etirements = autour ? [0.96, 1, 1.04].map(k => k * autour.ke) : [0.88, 1, 1.12]
  const espaces = !mots ? [1] : autour ? [0.85, 1, 1.18].map(k => k * autour.espace) : [0.6, 1, 1.6, 2.4]
  const pasX = autour ? [-1, 0, 1].map(d => d + autour.dx) : [-4, -2, 0, 2, 4]
  const pasY = autour ? [-1, 0, 1].map(d => d + autour.dy) : [-4, -2, 0, 2, 4]
  /* Le texte se trace sur une grille plus grande que la ligne (`P` de
     marge) : ce qui en déborde compte, loin du trait. */
  const P = Math.ceil(H / 2), LP = L + 2 * P, HP = H + 2 * P
  const dR = new Float32Array(LP * HP)
  const ox = new Int32Array(obs.encre.length), oy = new Int32Array(obs.encre.length)
  obs.encre.forEach((k, i) => { ox[i] = k % L; oy[i] = (k - ox[i]) / L })
  let meilleur = null
  for (const espace of espaces) {
    const polys = polygones(cheminTexte(police, texte, 100, espace), 24)
    const c = cadre(polys)
    if (!c) return null
    const [X0, Y0, X1, Y1] = c
    /* Le gros de son encre (en unités du chemin), son trait et son
       inclinaison — mesurés une fois, à la taille du logo. */
    const s0 = (H - 2 * obs.m) / (Y1 - Y0)
    const l0 = Math.ceil((X1 - X0) * s0) + 2, h0 = Math.ceil((Y1 - Y0) * s0) + 2
    const r0 = remplir(polys.map(p => p.map(([x, y]) => [(x - X0) * s0 + 1, (y - Y0) * s0 + 1])), 0, 0, l0, h0)
    const e0 = etendue(r0, l0, h0)
    const fx0 = X0 + (e0.x0 - 1) / s0, fx1 = X0 + (e0.x1 - 1) / s0, fy0 = Y0 + (e0.y0 - 1) / s0, fy1 = Y0 + (e0.y1 - 1) / s0
    if (!(fx1 > fx0 && fy1 > fy0)) continue
    const trait0 = epaisseur(r0, l0, h0) / s0, pente0 = pente(r0, l0, h0)
    const syB = (E.y1 - E.y0) / (fy1 - fy0), sxB = (E.x1 - E.x0) / (fx1 - fx0)
    const fxc = (fx0 + fx1) / 2, fyc = (fy0 + fy1) / 2, oxc = (E.x0 + E.x1) / 2, oyc = (E.y0 + E.y1) / 2
    for (const ks of tailles) {
      for (const ke of etirements) {
        const sy = syB * ks, sx = sxB * ke
        if (sx / sy < 0.6 || sx / sy > 1.6) continue
        /* L'accord : l'épaisseur et l'inclinaison de son trait (un
           étirement couche ou redresse les traits). */
        const accord = Math.exp(-Math.abs(Math.log(Math.max(0.3, trait0 * Math.sqrt(sx * sy)) / Math.max(0.3, obs.trait)))) * Math.exp(-2 * Math.abs(pente0 * sx / sy - obs.pente))
        const R = remplir(polys.map(p => p.map(([x, y]) => [(x - fxc) * sx + oxc + P, (y - fyc) * sy + oyc + P])), 0, 0, LP, HP)
        const rx = [], ry = []
        for (let k = 0; k < R.length; k++) if (R[k]) { const x = k % LP; rx.push(x - P); ry.push((k - x) / LP - P) }
        if (!rx.length) continue
        distances(R, LP, HP, dR)
        for (const dy of pasY) {
          for (const dx of pasX) {
            /* Le texte décalé de (dx, dy) : ses pixels lus sur la distance
               au logo (hors de la ligne : loin), ceux du logo sur la
               distance au texte. */
            let a = 0, b = 0
            for (let i = 0; i < rx.length; i++) {
              const X = rx[i] + dx, Y = ry[i] + dy
              a += X < 0 || Y < 0 || X >= L || Y >= H ? H / 2 : obs.dist[Y * L + X]
            }
            for (let i = 0; i < ox.length; i++) {
              const X = ox[i] - dx + P, Y = oy[i] - dy + P
              b += X < 0 || Y < 0 || X >= LP || Y >= HP ? H : dR[Y * LP + X]
            }
            const distance = 0.5 * a / rx.length + 0.5 * b / ox.length
            /* Une police qu'il faut déformer pour couvrir la ligne (un
               texte trop court, des lettres d'une autre chasse) s'éloigne. */
            const note = Math.sqrt(accord) * Math.exp(-Math.abs(Math.log(sx / sy))) / (1 + distance / 2)
            if (!meilleur || note > meilleur.note) meilleur = { note, distance, accord, espace, ks, ke, dx, dy, sx, sy, fxc, fyc, oxc, oyc }
          }
        }
      }
    }
  }
  if (!meilleur) return null
  const { sx, sy, fxc, fyc, oxc, oyc, dx, dy, espace } = meilleur
  meilleur.commandes = transformer(cheminTexte(police, texte, 100, espace), sx, sy, oxc + dx - fxc * sx, oyc + dy - fyc * sy)
  return meilleur
}

/* LE TEXTE POSÉ, dans les pixels de l'image de travail (celle de la
   ligne) : les commandes de `poserTexte` ramenées de la ligne réduite. */
export function cheminEcriture(pose, obs) {
  return transformer(pose.commandes, 1 / obs.f, 1 / obs.f, obs.x0 - obs.m / obs.f, obs.y0 - obs.m / obs.f)
}

/* L'INCLINAISON D'UNE POLICE, sur des lettres à hampes : pour l'index
   (outils/index-polices.mjs). */
export function penteDe(police) {
  const polys = polygones(cheminTexte(police, 'Hhlkdbft', 100), 24)
  const c = cadre(polys)
  if (!c) return 0
  const [X0, Y0, X1, Y1] = c, l = Math.ceil(X1 - X0) + 2, h = Math.ceil(Y1 - Y0) + 2
  return pente(remplir(polys.map(p => p.map(([x, y]) => [x - X0 + 1, y - Y0 + 1])), 0, 0, l, h), l, h)
}

/* ------------------------------------------------------------ LE TRI
   Sans rien charger, chaque écriture de l'index (`famillesDe`, qui a
   l'avance de ses lettres, `av`, et son inclinaison, `pente`) prévoit le
   texte : sa longueur rapportée à sa hauteur, le profil de ses lettres
   (le haut et le bas de l'encre, colonne par colonne), l'épaisseur de son
   trait, son inclinaison — comparés à ceux de la ligne. Rend les familles
   du plus proche au moins proche : [{ fam, fichier, ecart }]. */
const COLONNES = 48
function profilObserve(obs) {
  const lo = obs.l - 2 * obs.m, ho = obs.h - 2 * obs.m
  const haut = [], bas = []
  for (let k = 0; k < COLONNES; k++) {
    const xa = obs.m + Math.floor(k * lo / COLONNES), xb = Math.max(xa + 1, obs.m + Math.floor((k + 1) * lo / COLONNES))
    let t = null, b = null
    for (let y = 0; y < obs.h; y++) for (let x = xa; x < xb; x++) if (obs.masque[y * obs.l + x]) { if (t === null) t = y; b = y }
    haut.push(t === null ? null : (t - obs.m) / ho)
    bas.push(b === null ? null : (b - obs.m) / ho)
  }
  return { haut, bas, ratio: lo / ho }
}
export function prevoirTexte(fam, texte) {
  let pen = 0
  const boites = []
  for (const c of String(texte)) {
    if (/\s/.test(c)) { pen += fam.espace; continue }
    const b = fam.boite(c), a = fam.avance(c)
    if (a === null) return null
    if (b) boites.push([pen + b.x1, pen + b.x2, b.y1, b.y2])
    pen += a
  }
  if (!boites.length) return null
  let X0 = Infinity, X1 = -Infinity, Y0 = Infinity, Y1 = -Infinity
  for (const b of boites) { X0 = Math.min(X0, b[0]); X1 = Math.max(X1, b[1]); Y0 = Math.min(Y0, b[2]); Y1 = Math.max(Y1, b[3]) }
  if (!(X1 > X0 && Y1 > Y0)) return null
  const haut = [], bas = []
  for (let k = 0; k < COLONNES; k++) {
    const xa = X0 + k * (X1 - X0) / COLONNES, xb = X0 + (k + 1) * (X1 - X0) / COLONNES
    let t = -Infinity, b = Infinity
    for (const x of boites) if (x[1] >= xa && x[0] <= xb) { t = Math.max(t, x[3]); b = Math.min(b, x[2]) }
    haut.push(t === -Infinity ? null : (Y1 - t) / (Y1 - Y0))
    bas.push(b === Infinity ? null : (Y1 - b) / (Y1 - Y0))
  }
  return { ratio: (X1 - X0) / (Y1 - Y0), haut, bas, cap: fam.cap / (Y1 - Y0) }
}
export function trierEcritures(obs, texte, familles) {
  mesurer(obs)
  const vu = obs.profil || (obs.profil = profilObserve(obs))
  const ho = obs.h - 2 * obs.m
  const tries = []
  for (const fam of familles) {
    if (!fam.avance || fam.pente === undefined) continue
    const pr = prevoirTexte(fam, texte)
    if (!pr) continue
    let e = 0, n = 0
    for (let k = 0; k < COLONNES; k++) {
      const a = vu.haut[k] !== null, b = pr.haut[k] !== null
      if (a && b) { e += Math.abs(vu.haut[k] - pr.haut[k]) + Math.abs(vu.bas[k] - pr.bas[k]); n++ } else if (a !== b) { e += 0.5; n++ }
    }
    /* Le trait : celui du fichier le plus proche (rapporté à la capitale). */
    const eRel = obs.trait / (ho * pr.cap)
    let fichier = null, eTrait = Infinity
    for (const fi of fam.fichiers) {
      const d = Math.abs(Math.log(Math.max(0.005, fi.e) / Math.max(0.005, eRel)))
      if (d < eTrait) { eTrait = d; fichier = fi }
    }
    const ecart = Math.abs(Math.log(vu.ratio / pr.ratio)) + (n ? e / n : 1) + 0.5 * eTrait + 1.5 * Math.abs(fam.pente - obs.pente)
    tries.push({ fam, fichier, ecart })
  }
  return tries.sort((a, b) => a.ecart - b.ecart)
}

/* ------------------------------------------------------- LES LECTURES
   Ce que l'OCR a lu d'une ligne manuscrite, sous plusieurs angles
   (`lectures` : [{ texte, confiance }]), en textes à essayer : chaque
   lecture nettoyée, et, mot par mot, les mots du lexique qui en sont à une
   ou deux fautes près (« Versonal » → « Personal ») — la casse gardée. Une
   lecture `impose` (le texte tapé dans le panneau) passe seule. Rend au
   plus `n` textes, du plus sûr au moins sûr : { texte, corrections (les
   mots changés), inconnus et connus (ses mots de trois lettres et plus,
   hors du lexique et dedans), longs (ses mots connus de quatre lettres et
   plus) }. */
export function relectures(lectures, lexique, { n = 16 } = {}) {
  const nettes = []
  for (const l of lectures || []) {
    const t = String(l.texte || '').replace(/[^\p{L}\p{N}&'’\- ]+/gu, ' ').replace(/\s+/g, ' ').trim()
    if ([...t.replace(/[^\p{L}]/gu, '')].length < 3) continue
    /* Un texte tapé à la main s'impose : on ne le corrige pas. */
    if (l.impose) return [{ texte: t, corrections: 0, cout: 0, inconnus: 0, connus: 0, longs: 0 }]
    const deja = nettes.find(x => x.texte === t)
    if (deja) deja.poids += 1 + (l.confiance || 0) / 100
    else nettes.push({ texte: t, poids: 1 + (l.confiance || 0) / 100 })
  }
  const connus = new Set(lexique || [])
  /* LE VOTE MOT À MOT : les lectures d'autant de mots, alignées ; à chaque
     place, le mot le plus lu (un mot connu du lexique pèse un peu plus) —
     « SE Martin », « St Morton », « St Motion » font « St Martin ». */
  const parTaille = new Map()
  for (const x of nettes) {
    const mots = x.texte.split(' ')
    if (!parTaille.has(mots.length)) parTaille.set(mots.length, [])
    parTaille.get(mots.length).push({ mots, poids: x.poids })
  }
  for (const groupe of parTaille.values()) {
    if (groupe.length < 2) continue
    const vote = groupe[0].mots.map((_, k) => {
      const voix = new Map()
      for (const g of groupe) {
        const m = g.mots[k], cle = m.toLowerCase()
        const v = voix.get(cle) || { m, poids: connus.has(cle) ? 0.5 : 0 }
        v.poids += g.poids
        voix.set(cle, v)
      }
      return [...voix.values()].sort((a, b) => b.poids - a.poids)[0].m
    }).join(' ')
    const somme = groupe.reduce((t, g) => t + g.poids, 0)
    const deja = nettes.find(x => x.texte === vote)
    if (deja) deja.poids = Math.max(deja.poids, somme)
    else nettes.push({ texte: vote, poids: somme })
  }
  nettes.sort((a, b) => b.poids - a.poids)
  const sortie = new Map()
  const ajouter = (texte, corrections, cout) => {
    const x = sortie.get(texte)
    if (!x || x.cout > cout) sortie.set(texte, { texte, corrections, cout })
  }
  nettes.forEach(({ texte }, rang) => {
    ajouter(texte, 0, rang * 0.01)
    if (!lexique) return
    /* Chaque mot et ses voisins du lexique ; les combinaisons les moins
       corrigées d'abord. */
    const mots = texte.split(' ').map(m => [{ m, cout: 0 }].concat(voisins(m, lexique)))
    let combis = [{ t: [], cout: 0, k: 0 }]
    for (const choix of mots) {
      const suite = []
      for (const c of combis) for (const v of choix) suite.push({ t: c.t.concat(v.m), cout: c.cout + v.cout, k: c.k + (v.cout ? 1 : 0) })
      combis = suite.sort((a, b) => a.cout - b.cout).slice(0, 2 * n)
    }
    for (const c of combis) ajouter(c.t.join(' '), c.k, c.cout + rang * 0.01)
  })
  return [...sortie.values()].sort((a, b) => a.cout - b.cout).slice(0, n).map(x => ({
    texte: x.texte, corrections: x.corrections, cout: x.cout,
    /* Les mots de trois lettres et plus que le lexique ne connaît pas. */
    inconnus: lexique ? x.texte.split(' ').filter(m => m.length >= 3 && !connus.has(m.toLowerCase())).length : 0,
    connus: lexique ? x.texte.split(' ').filter(m => m.length >= 3 && connus.has(m.toLowerCase())).length : 0,
    longs: lexique ? x.texte.split(' ').filter(m => m.length >= 4 && connus.has(m.toLowerCase())).length : 0,
  }))
}

/* Les mots du lexique (`lexique` : ses mots du plus courant au plus rare)
   à une faute près (deux pour un mot de plus de cinq lettres, fautes
   pondérées : `distanceMots`), la casse de `mot` reportée ; au plus `max`,
   les plus proches puis les plus courants. */
export function voisins(mot, lexique, max = 6) {
  const bas = mot.toLowerCase()
  if (!/^[\p{L}'’-]+$/u.test(bas) || bas.length < 3) return []
  const limite = bas.length > 5 ? 2 : 1
  const trouves = []
  for (let r = 0; r < lexique.length; r++) {
    const w = lexique[r]
    if (w === bas || Math.abs(w.length - bas.length) * INSERTION > limite) continue
    const d = distanceMots(bas, w, limite)
    if (d <= limite) trouves.push({ m: casse(w, mot), cout: d + 0.5 * r / lexique.length })
  }
  return trouves.sort((a, b) => a.cout - b.cout).slice(0, max)
}
const casse = (w, modele) => modele === modele.toUpperCase() && modele.length > 1 ? w.toUpperCase() : modele[0] === modele[0].toUpperCase() ? w[0].toUpperCase() + w.slice(1) : w

/* LES LETTRES QUE L'OCR CONFOND dans une écriture liée : les rondes (un
   « a » fermé lu « o »), les jambages (« n », « u », « m »), les hampes,
   le « r » et le « s » d'un script. Les confondre coûte une demi-faute ;
   une lettre de plus ou de moins, une faute et quart (l'OCR garde à peu
   près le compte des lettres). */
const PROCHES = ['aoueci', 'nmurvwi', 'iltfjkhbd', 'rsz', 'gqyj', 'pb']
const proches = new Set()
for (const g of PROCHES) for (const x of g) for (const y of g) if (x !== y) proches.add(x + y)
const SANS_ACCENT = c => c.normalize('NFD').replace(/[̀-ͯ]/g, '')
function coutLettre(x, y) {
  if (x === y) return 0
  const a = SANS_ACCENT(x), b = SANS_ACCENT(y)
  if (a === b) return 0.25
  return proches.has(a + b) ? 0.5 : 1
}
const INSERTION = 1.25

/* La distance d'édition pondérée (Damerau : une inversion de deux lettres
   compte une faute), arrêtée au-delà de `limite`. */
export function distanceMots(a, b, limite = Infinity) {
  const n = a.length, m = b.length
  if (Math.abs(n - m) * INSERTION > limite) return limite + 1
  let p2 = new Array(m + 1).fill(0), p = Array.from({ length: m + 1 }, (_, j) => j * INSERTION), c = new Array(m + 1)
  for (let i = 1; i <= n; i++) {
    c[0] = i * INSERTION
    let mini = c[0]
    for (let j = 1; j <= m; j++) {
      c[j] = Math.min(p[j] + INSERTION, c[j - 1] + INSERTION, p[j - 1] + coutLettre(a[i - 1], b[j - 1]))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) c[j] = Math.min(c[j], p2[j - 2] + 1)
      if (c[j] < mini) mini = c[j]
    }
    if (mini > limite) return limite + 1
    ;[p2, p, c] = [p, c, p2]
  }
  return p[m]
}

/* ------------------------------------------------------------ LE CHOIX
   La ligne (`ligne`, dans une image de `largeur`), ce qu'on en a lu
   (`lectures`), la réserve (`familles`) et le lexique : les textes à
   essayer (`relectures`) ; les écritures triées sur le premier, les
   `essai` premières posées pour de vrai ; les textes départagés sur les
   deux meilleures (leur note moyenne, posés de près là où elles se
   posaient) ; puis, sur le texte retenu, les `n` meilleures affinées. `charger(fichier)` : la police lue (une
   promesse, null si elle manque). Rend { texte, props : [{ fichier,
   police, note, pose }] } ou null. */
export async function choisirEcriture(ligne, largeur, lectures, familles, charger, lexique, { n = 5, essai = 24 } = {}) {
  /* Un texte a été lu avec quelque assurance, et il a un mot connu d'au
     moins quatre lettres — de trois, lu avec une vraie assurance — (sauf
     tapé à la main) : un morceau de dessin lu « of w », « RDA », « DIP »
     n'en est pas un. */
  const tape = (lectures || []).some(l => l.impose)
  const assurance = Math.max(0, ...(lectures || []).map(l => l.confiance || 0))
  if (!tape && assurance < 40) return null
  const textes = relectures(lectures, lexique).filter(t => tape || !lexique || t.longs > 0 || (t.connus > 0 && assurance >= 85))
  if (!textes.length) return null
  const obs = encreLigne(ligne, largeur)
  const premier = textes[0].texte
  const tries = trierEcritures(obs, premier, familles).slice(0, essai)
  const posees = []
  await Promise.all(tries.map(async t => {
    const police = await charger(t.fichier)
    if (!police) return
    const pose = poserTexte(police, premier, obs)
    if (pose) posees.push({ fichier: t.fichier, police, note: pose.note, pose })
  }))
  if (!posees.length) return null
  posees.sort((a, b) => b.note - a.note)
  /* Le texte : celui qui se pose le mieux dans les deux meilleures — un
     mot hors du lexique en retrait (« Versonal »), une correction aussi,
     selon ce qu'elle change : l'image doit la justifier. */
  let texte = premier
  if (textes.length > 1) {
    const juges = posees.slice(0, 2)
    let mieux = -Infinity
    for (const t of textes) {
      let s = 0
      for (const j of juges) { const p = poserTexte(j.police, t.texte, obs, { autour: j.pose }); s += p ? p.note : 0 }
      s = s / juges.length - 0.06 * t.inconnus - 0.03 * t.cout
      if (s > mieux + 1e-9) { mieux = s; texte = t.texte }
    }
  }
  const props = []
  for (const p of posees.slice(0, n + 3)) {
    const debut = texte === premier ? p.pose : poserTexte(p.police, texte, obs)
    const pose = debut && poserTexte(p.police, texte, obs, { autour: debut })
    const meilleure = pose && (!debut || pose.note >= debut.note) ? pose : debut
    if (meilleure) props.push({ fichier: p.fichier, police: p.police, note: meilleure.note, pose: meilleure })
  }
  props.sort((a, b) => b.note - a.note)
  return { texte, props: props.slice(0, n), obs }
}

/* ========================================================= LES LIGNES COURBES
   30 septembre 2026, le t-shirt « SAINT MARTIN · Antilles · THE FRIENDLY
   ISLAND » : « s'il y a des mots écrits en rond, ou comme THE FRIENDLY
   ISLAND, ils doivent pouvoir être sélectionnés ; toutes les polices de
   cette image doivent être disponibles ». Les lignes de lib/polices.js
   (`lignes`) sont droites : leurs lettres partagent une ligne de base. Un
   titre en arc, un texte sur un ruban qui ondule, une ligne penchée n'en
   ont pas — chaque lettre tourne avec la courbe, et rien ne s'y lisait.
   Ici, comme le graphiste qui retape un texte sur un tracé :
   1. LA CHAÎNE (`chainer`) : de lettre en lettre, la voisine de même
      taille, de même couleur, à l'espacement de la chaîne (un mot plus
      loin, pas davantage), qui continue dans sa direction — le virage
      d'une lettre à l'autre reste doux ;
   2. LA COURBE (`ajuster`) : la ligne lisse qui passe au plus près des
      centres des lettres — un arc de cercle, ou un polynôme dans le repère
      de la corde (un ruban qui ondule) ;
   3. LE REDRESSEMENT (`redresser`) : chaque lettre tournée de l'angle de la
      courbe à sa place, posée à plat, à la distance où elle est le long de
      la courbe. La ligne devient droite, dans sa propre toile (`courbe.W`
      de large) : la lecture, le choix de la police et la pose la prennent
      comme les autres. Chaque lettre garde de quoi revenir sur la courbe
      (`versImage`) et ses pixels dans l'image (`image`).
   Du calcul pur : des pixels de lecture (lib/texte.js) qui entrent, des
   lignes qui sortent. */

const mediane = v => { const t = v.slice().sort((a, b) => a - b); return t[t.length >> 1] }

/* Le centre d'encre d'une lettre (au centre de ses pixels), dans une image
   de `largeur` de large ; le milieu de son cadre sans pixels. */
export function centreDe(l, largeur) {
  if (!l.pixels || !l.pixels.length) return [(l.x0 + l.x1 + 1) / 2, (l.y0 + l.y1 + 1) / 2]
  let sx = 0, sy = 0
  for (const p of l.pixels) { const x = p % largeur; sx += x; sy += (p - x) / largeur }
  return [sx / l.pixels.length + 0.5, sy / l.pixels.length + 0.5]
}

/* --------------------------------------------------------------- LA CHAÎNE
   Les réglages : deux lettres voisines ont des tailles (le grand côté de
   leur cadre : une lettre tournée garde à peu près le sien) à moins du
   double l'une de l'autre, et leurs centres (le milieu du cadre : celui
   d'un T, d'un L ne monte ni ne descend avec leur encre) à moins de
   `PORTEE` fois la plus grande ; la chaîne continue vers la lettre dont le
   pas s'écarte de moins de `VIRAGE` degrés du pas attendu (le précédent,
   tourné du virage moyen de la chaîne ; `VIRAGE_UN` au premier, quand la
   direction n'est lue que sur deux lettres), à un pas de `PAS_MIN` à
   `PAS_MOT` fois celui de la chaîne (l'espace entre deux mots). */
const PORTEE = 2.2
const TAILLES = 2
const VIRAGE = 28
const VIRAGE_UN = 40
const REPRISE = 6
const PAS_MIN = 0.45
const PAS_MOT = 2.2
const COULEUR = 25

const angle = (ax, ay, bx, by) => Math.atan2(ax * by - ay * bx, ax * bx + ay * by)
const ecartLab = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const centreCadre = l => [(l.x0 + l.x1 + 1) / 2, (l.y0 + l.y1 + 1) / 2]

/* LES CHAÎNES de `lettres` ({ x0, y0, x1, y1, corps, couleur }, `couleur`
   en CIELAB ou absente) : chacune la liste ordonnée de ses lettres (de gauche
   à droite le long de la courbe), d'au moins `min` lettres ; une lettre
   n'est que dans une chaîne. */
export function chainer(lettres, { min = 3 } = {}) {
  const N = lettres.length
  if (N < min) return []
  /* Le corps de la lettre (`corps`, sa plus grande forme) quand on l'a :
     un point posé au-dessus — un accent, ou une miette du dessin prise
     pour lui — ne la grandit ni ne la déplace. */
  const I = lettres.map(l => { const b = l.corps || l, [cx, cy] = centreCadre(b); return { cx, cy, s: Math.max(b.x1 - b.x0 + 1, b.y1 - b.y0 + 1), c: l.couleur || null } })
  /* Les voisines possibles, par une grille des centres. */
  const C = Math.max(16, mediane(I.map(x => x.s)) * PORTEE)
  const grille = new Map()
  I.forEach((x, i) => {
    const k = Math.floor(x.cy / C) * 1e6 + Math.floor(x.cx / C)
    if (!grille.has(k)) grille.set(k, [])
    grille.get(k).push(i)
  })
  const proches = (a, b) => Math.max(a.s, b.s) <= TAILLES * Math.min(a.s, b.s) && !(a.c && b.c && ecartLab(a.c, b.c) > COULEUR)
  const voisines = I.map((a, i) => {
    const v = []
    const r = Math.ceil(a.s * PORTEE / C)
    const gx = Math.floor(a.cx / C), gy = Math.floor(a.cy / C)
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        for (const j of grille.get((gy + dy) * 1e6 + gx + dx) || []) {
          if (j === i) continue
          const b = I[j], d = Math.hypot(b.cx - a.cx, b.cy - a.cy)
          if (!proches(a, b) || d > PORTEE * Math.max(a.s, b.s) || d < 0.25 * Math.min(a.s, b.s)) continue
          v.push(j)
        }
      }
    }
    return v
  })
  const pas = ch => {
    const v = []
    for (let i = 1; i < ch.length; i++) v.push(Math.hypot(I[ch[i]].cx - I[ch[i - 1]].cx, I[ch[i]].cy - I[ch[i - 1]].cy))
    /* Le plus courant de ses pas, pas l'espace entre deux mots. */
    return v.length > 2 ? Math.min(mediane(v), 1.3 * mediane(v.slice().sort((a, b) => a - b).slice(0, Math.ceil(v.length / 2)))) : mediane(v)
  }
  /* La direction au bout de `ch` et son virage par pixel. */
  const bout = ch => {
    const k = ch.length
    const a = I[ch[k - 1]], b = I[ch[k - 2]]
    const l = Math.hypot(a.cx - b.cx, a.cy - b.cy) || 1
    let virage = 0, long = 0
    for (let i = Math.max(2, k - 3); i < k; i++) {
      const u = I[ch[i - 2]], v = I[ch[i - 1]], w = I[ch[i]]
      virage += angle(v.cx - u.cx, v.cy - u.cy, w.cx - v.cx, w.cy - v.cy)
      long += Math.hypot(w.cx - v.cx, w.cy - v.cy)
    }
    return { x: a.cx, y: a.cy, dx: (a.cx - b.cx) / l, dy: (a.cy - b.cy) / l, parPx: long ? Math.max(-0.3, Math.min(0.3, virage / long)) : 0, tol: k > 2 ? VIRAGE : VIRAGE_UN }
  }
  /* L'écart (en degrés) d'un pas (vx, vy) depuis le bout `b` au pas attendu. */
  const ecartAu = (b, vx, vy) => {
    const d = Math.hypot(vx, vy), t = b.parPx * d
    const ex = b.dx * Math.cos(t) - b.dy * Math.sin(t), ey = b.dx * Math.sin(t) + b.dy * Math.cos(t)
    return Math.abs(angle(ex, ey, vx, vy)) * 180 / Math.PI
  }
  const pris = new Int32Array(N).fill(-1)
  /* Prolonger `ch` par son bout : la voisine qui continue le mieux. */
  /* `libre(j)` : la lettre peut rejoindre la chaîne (d'office : prise par
     aucune). */
  const prolonger = (ch, tailleRef, libre = j => pris[j] < 0, marge = 0) => {
    for (;;) {
      const b = bout(ch), p = pas(ch)
      b.tol += marge
      let mieux = -1, note = Infinity
      for (const j of voisines[ch[ch.length - 1]]) {
        if (!libre(j) || ch.includes(j)) continue
        const c = I[j]
        if (Math.max(c.s, tailleRef) > TAILLES * Math.min(c.s, tailleRef)) continue
        const vx = c.cx - b.x, vy = c.cy - b.y, d = Math.hypot(vx, vy)
        if (d < PAS_MIN * p || d > PAS_MOT * p) continue
        const e = ecartAu(b, vx, vy)
        if (e > b.tol) continue
        const n = e / b.tol + Math.abs(Math.log(d / p))
        if (n < note) { note = n; mieux = j }
      }
      if (mieux < 0) return
      ch.push(mieux)
    }
  }
  /* Les paires de départ : les plus serrées d'abord (le pas rapporté à la
     taille). */
  const paires = []
  I.forEach((a, i) => { for (const j of voisines[i]) if (j > i) paires.push([i, j, Math.hypot(I[j].cx - a.cx, I[j].cy - a.cy) / Math.max(a.s, I[j].s)]) })
  paires.sort((a, b) => a[2] - b[2])
  let chaines = []
  for (const [i, j] of paires) {
    if (pris[i] >= 0 || pris[j] >= 0) continue
    const tailleRef = Math.max(I[i].s, I[j].s)
    const ch = [i, j]
    prolonger(ch, tailleRef)
    ch.reverse()
    prolonger(ch, tailleRef)
    for (const k of ch) pris[k] = chaines.length
    chaines.push(ch)
  }
  /* LES MORCEAUX RECOLLÉS : deux chaînes dont l'une continue l'autre (le
     pas, la direction aux deux bouts, la taille) n'en font qu'une — une
     paire de départ mal orientée (le I étroit et sa voisine) coupait un
     titre en deux. */
  /* La taille et le pas d'une chaîne se calculent une fois : elle ne
     change pas sur place (une fusion en fait une nouvelle). Retournée,
     elle a la même taille et le même pas. */
  const tailles = new WeakMap(), pasDe = new WeakMap()
  const taille = ch => { let v = tailles.get(ch); if (v === undefined) { v = mediane(ch.map(k => I[k].s)); tailles.set(ch, v) } return v }
  const pasM = ch => { let v = pasDe.get(ch); if (v === undefined) { v = pas(ch); pasDe.set(ch, v) } return v }
  for (let fusion = true; fusion;) {
    fusion = false
    for (let a = 0; a < chaines.length && !fusion; a++) {
      for (let b = 0; b < chaines.length && !fusion; b++) {
        if (a === b) continue
        const A = chaines[a], B0 = chaines[b]
        if (Math.max(taille(A), taille(B0)) > TAILLES * Math.min(taille(A), taille(B0))) continue
        for (const B of [B0, B0.slice().reverse()]) {
          const u = I[A[A.length - 1]], v = I[B[0]]
          if (!proches(u, v)) break
          const vx = v.cx - u.cx, vy = v.cy - u.cy, d = Math.hypot(vx, vy)
          const p = Math.min(pasM(A), B.length > 1 ? pasM(B0) : Infinity)
          if (d < PAS_MIN * p || d > PAS_MOT * p) continue
          if (ecartAu(bout(A), vx, vy) > VIRAGE_UN) continue
          if (B.length > 1) {
            const r = bout(B.slice().reverse())
            if (ecartAu(r, -vx, -vy) > VIRAGE_UN) continue
          }
          chaines[a] = A.concat(B)
          chaines.splice(b, 1)
          fusion = true
          break
        }
      }
    }
  }
  /* LES TROUS REBOUCHÉS : entre deux lettres d'une chaîne plus loin que
     son pas, une lettre posée entre elles (à mi-chemin, dans le
     couloir) qu'une chaîne trop courte avait prise y revient — le second E
     de « CERCLE DES », pris par une miette, faisait sauter l'arc du D au
     S. */
  pris.fill(-1)
  chaines.forEach((ch, i) => { for (const k of ch) pris[k] = i })
  /* LES BOUTS REPRIS : une chaîne assez longue se prolonge encore, au
     besoin d'une lettre qu'une chaîne trop courte avait prise, et à
     `REPRISE` degrés de plus — sa direction est sûre (le V tourné de
     « VACATION RENTAL », son cadre un peu décalé, à 28,1°). */
  const courte = j => pris[j] < 0 || chaines[pris[j]].length < min
  for (const ch of chaines) {
    if (ch.length < min) continue
    const avant = new Set(ch)
    const tailleRef = mediane(ch.map(k => I[k].s))
    prolonger(ch, tailleRef, courte, REPRISE)
    ch.reverse()
    prolonger(ch, tailleRef, courte, REPRISE)
    ch.reverse()
    for (const k of ch) {
      if (avant.has(k)) continue
      if (pris[k] >= 0) { const c = chaines[pris[k]]; c.splice(c.indexOf(k), 1) }
      pris[k] = chaines.indexOf(ch)
    }
  }
  for (const ch of chaines) {
    if (ch.length < min) continue
    for (let i = 0; i + 1 < ch.length; i++) {
      const a = I[ch[i]], b = I[ch[i + 1]], p = pas(ch)
      const dx = b.cx - a.cx, dy = b.cy - a.cy, d = Math.hypot(dx, dy)
      if (d < 1.4 * p) continue
      let mieux = -1, m = Infinity
      for (const k of voisines[ch[i]]) {
        const c = pris[k] >= 0 ? chaines[pris[k]] : null
        if (c === ch || (c && c.length >= min)) continue
        const u = ((I[k].cx - a.cx) * dx + (I[k].cy - a.cy) * dy) / (d * d)
        const v = Math.abs(-(I[k].cx - a.cx) * dy + (I[k].cy - a.cy) * dx) / d
        if (u < 0.2 || u > 0.8 || v > 0.5 * Math.max(a.s, b.s)) continue
        if (v < m) { m = v; mieux = k }
      }
      if (mieux < 0) continue
      const c = pris[mieux] >= 0 ? chaines[pris[mieux]] : null
      if (c) c.splice(c.indexOf(mieux), 1)
      ch.splice(i + 1, 0, mieux)
      pris[mieux] = chaines.indexOf(ch)
    }
  }
  return chaines.filter(ch => ch.length >= min).map(ch => {
    /* De gauche à droite le long de la corde. */
    if (I[ch[ch.length - 1]].cx < I[ch[0]].cx) ch.reverse()
    return ch.map(k => lettres[k])
  })
}

/* --------------------------------------------------------------- LA COURBE
   La ligne lisse qui passe au plus près des `centres` ([x, y], dans
   l'ordre de lecture) : un polynôme (jusqu'au troisième degré selon le
   nombre de lettres) de l'écart à la corde, ou un arc de cercle s'il passe
   aussi près (un texte autour d'un badge en fait le tour, la corde n'y
   suffit plus). Échantillonnée tous les pixels de `debut` à `fin` pixels au
   delà des lettres extrêmes. Rend { x, y (les points), s (la longueur
   jusqu'à chacun), residu (l'écart moyen des centres) } ou null. */
export function ajuster(centres, { marge = 0 } = {}) {
  const n = centres.length
  if (n < 2) return null
  const [ax, ay] = centres[0], [bx, by] = centres[n - 1]
  const L = Math.hypot(bx - ax, by - ay)
  if (!(L > 0)) return null
  const ex = (bx - ax) / L, ey = (by - ay) / L
  /* Dans le repère de la corde : t le long, d en travers (vers le bas de
     la lecture). */
  const ts = centres.map(([x, y]) => (x - ax) * ex + (y - ay) * ey)
  const ds = centres.map(([x, y]) => -(x - ax) * ey + (y - ay) * ex)
  const degre = n >= 7 ? 3 : n >= 4 ? 2 : 1
  const coef = moindresCarres(ts.map(t => t / L), ds, degre)
  const poly = t => { let v = 0, u = 1; for (const c of coef) { v += c * u; u *= t / L } return v }
  let residu = 0
  ts.forEach((t, i) => { residu += Math.abs(poly(t) - ds[i]) })
  residu /= n
  /* L'arc de cercle (Kåsa) : un rayon fini, aussi près que le polynôme. */
  const cercle = n >= 4 ? cercleDe(centres) : null
  let arc = null
  if (cercle && cercle.r < 50 * L) {
    let e = 0
    for (const [x, y] of centres) e += Math.abs(Math.hypot(x - cercle.x, y - cercle.y) - cercle.r)
    e /= n
    if (e <= residu * 1.05 + 0.5) arc = Object.assign(cercle, { residu: e })
  }
  const xs = [], ys = []
  if (arc) {
    /* Le sens de la lecture : du premier centre au dernier, par le plus
       court (l'arc qui passe par les lettres du milieu). */
    const a0 = Math.atan2(ay - arc.y, ax - arc.x)
    let tour = 0
    const angles = centres.map(([x, y]) => Math.atan2(y - arc.y, x - arc.x))
    const deroule = [0]
    for (let i = 1; i < n; i++) {
      let d = angles[i] - angles[i - 1]
      while (d > Math.PI) d -= 2 * Math.PI
      while (d < -Math.PI) d += 2 * Math.PI
      tour += d
      deroule.push(tour)
    }
    const sens = tour >= 0 ? 1 : -1
    const de = Math.min(...deroule) - marge / arc.r, a = Math.max(...deroule) + marge / arc.r
    const pas = 1 / arc.r
    for (let t = sens > 0 ? de : a; sens > 0 ? t <= a + 1e-9 : t >= de - 1e-9; t += sens * pas) {
      xs.push(arc.x + arc.r * Math.cos(a0 + t)); ys.push(arc.y + arc.r * Math.sin(a0 + t))
    }
    residu = arc.residu
  } else {
    const t0 = Math.min(...ts) - marge, t1 = Math.max(...ts) + marge
    for (let t = t0; t <= t1 + 1e-9; t += 1) { const d = poly(t); xs.push(ax + t * ex - d * ey); ys.push(ay + t * ey + d * ex) }
  }
  if (xs.length < 2) return null
  const s = new Float64Array(xs.length)
  for (let i = 1; i < xs.length; i++) s[i] = s[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1])
  return { x: Float64Array.from(xs), y: Float64Array.from(ys), s, residu }
}

/* Les moindres carrés d'un polynôme de degré `k` (équations normales,
   Gauss avec pivot). */
function moindresCarres(xs, ys, k) {
  const m = k + 1
  const A = Array.from({ length: m }, () => new Float64Array(m + 1))
  xs.forEach((x, i) => {
    const p = [1]
    for (let j = 1; j < 2 * m; j++) p.push(p[j - 1] * x)
    for (let r = 0; r < m; r++) {
      for (let c = 0; c < m; c++) A[r][c] += p[r + c]
      A[r][m] += p[r] * ys[i]
    }
  })
  for (let c = 0; c < m; c++) {
    let piv = c
    for (let r = c + 1; r < m; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r
    ;[A[c], A[piv]] = [A[piv], A[c]]
    if (Math.abs(A[c][c]) < 1e-12) return Array(m).fill(0).map((_, i) => i ? 0 : ys.reduce((s, v) => s + v, 0) / ys.length)
    for (let r = 0; r < m; r++) {
      if (r === c) continue
      const f = A[r][c] / A[c][c]
      for (let j = c; j <= m; j++) A[r][j] -= f * A[c][j]
    }
  }
  return A.map((r, i) => r[m] / r[i])
}

/* Le cercle des moindres carrés algébriques (Kåsa), ou null. */
function cercleDe(pts) {
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0, sz = 0
  const n = pts.length
  const mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n
  for (const [X, Y] of pts) {
    const x = X - mx, y = Y - my, z = x * x + y * y
    sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; sxz += x * z; syz += y * z; sz += z
  }
  const det = sxx * syy - sxy * sxy
  if (Math.abs(det) < 1e-9) return null
  const a = (sxz * syy - syz * sxy) / (2 * det), b = (syz * sxx - sxz * sxy) / (2 * det)
  const r = Math.sqrt(a * a + b * b + sz / n)
  return Number.isFinite(r) ? { x: a + mx, y: b + my, r } : null
}

/* LE POINT DE LA COURBE à la longueur `u` : [x, y, tx, ty] (la tangente,
   unitaire, dans le sens de la lecture). Au-delà des bouts, la droite
   continue. */
export function pointA(courbe, u) {
  const { x, y, s } = courbe
  const n = s.length
  let i = 0, j = n - 1
  if (u <= 0) i = 0, j = 1
  else if (u >= s[n - 1]) i = n - 2, j = n - 1
  else {
    while (j - i > 1) { const m = (i + j) >> 1; if (s[m] <= u) i = m; else j = m }
  }
  const l = s[j] - s[i] || 1
  const tx = (x[j] - x[i]) / l, ty = (y[j] - y[i]) / l
  const t = u - s[i]
  return [x[i] + tx * t, y[i] + ty * t, tx, ty]
}

/* LA PROJECTION d'un point sur la courbe : { u (la longueur), n (l'écart,
   vers le bas de la lecture) }. */
export function projeter(courbe, px, py) {
  const { x, y, s } = courbe
  let mieux = Infinity, u = 0, nn = 0
  for (let i = 0; i + 1 < s.length; i++) {
    const dx = x[i + 1] - x[i], dy = y[i + 1] - y[i], l2 = dx * dx + dy * dy || 1
    const t = Math.max(0, Math.min(1, ((px - x[i]) * dx + (py - y[i]) * dy) / l2))
    const qx = x[i] + t * dx, qy = y[i] + t * dy
    const d = (px - qx) ** 2 + (py - qy) ** 2
    if (d < mieux) {
      mieux = d
      const l = Math.sqrt(l2)
      u = s[i] + t * l
      nn = (-(px - qx) * dy + (py - qy) * dx) / l
    }
  }
  return { u, n: nn }
}

/* --------------------------------------------------------- LE REDRESSEMENT
   Le pied de chaque lettre suit la courbe (son angle θ à sa place) ; ses
   jambages, eux, penchent selon la façon dont le texte a été posé :
   - TOURNÉ (le texte sur un tracé d'Illustrator, un titre en arc) : de θ
     tout entier, la lettre tourne avec la courbe ;
   - CISAILLÉ (la déformation « drapeau » d'un ruban) : pas du tout, les
     jambages restent verticaux, chaque colonne monte ou descend ;
   - entre les deux : le ruban de « THE FRIENDLY ISLAND » penche ses
     jambages de la moitié de sa pente (30 septembre 2026 : tournées, les
     lettres du bout du ruban penchaient ; cisaillées, celles du milieu).
   La part `alpha` (de 0, cisaillé, à 1, tourné) se mesure sur la ligne :
   pour chaque lettre, l'angle de ses jambages qui les remet le plus nets
   (`nettete` : des colonnes qui montent d'un coup), rapporté à θ — la
   médiane, sur les lettres qui penchent assez pour en juger (un R, un Y
   s'y trompent, la médiane non). Chaque lettre a sa transformation (une
   affine : `a`, `b`, `c`, `d`, `e`, `f`, de la toile vers l'image de
   lecture), exacte pour les courbes d'une police. */

/* LA NETTETÉ DES COLONNES d'une lettre (ses `pixels` dans une image de
   `largeur`) dont les jambages iraient le long de (vx, vy), unitaire,
   autour de (cx, cy) : ses pixels projetés en travers des jambages, en
   pixels de l'image (partagés entre deux colonnes : aucune n'est vide
   par repliement), la somme des carrés des sauts d'une colonne à la
   suivante, sur son encre — un jambage droit monte d'un coup, un jambage
   penché en rampe. */
function nettete(pixels, largeur, cx, cy, vx, vy) {
  const cols = new Map()
  for (const p of pixels) {
    const x = p % largeur, y = (p - x) / largeur
    const t = (x + 0.5 - cx) * vy - (y + 0.5 - cy) * vx
    const k = Math.floor(t), w = t - k
    cols.set(k, (cols.get(k) || 0) + 1 - w)
    cols.set(k + 1, (cols.get(k + 1) || 0) + w)
  }
  const ks = [...cols.keys()].sort((a, b) => a - b)
  let q = 0
  for (let k = ks[0] - 1; k <= ks[ks.length - 1]; k++) { const v = (cols.get(k + 1) || 0) - (cols.get(k) || 0); q += v * v }
  return q / pixels.length
}

/* LA PART TOURNÉE d'une ligne (`base` : ses lettres, leur angle θ), de 0
   à 1 ; tournée tout à fait faute de lettres qui penchent assez — et le
   nombre de lettres qui en ont jugé (`penchees`). */
const PENCHE = 6 * Math.PI / 180
function partTournee(base, largeur) {
  const parts = []
  for (const x of base) {
    if (Math.abs(x.t) < PENCHE) continue
    let mieux = -Infinity, phi = 0
    for (let k = -0.5; k <= 1.5 + 1e-9; k += 0.05) {
      const f = k * x.t
      const v = nettete(x.l.pixels, largeur, x.cx, x.cy, -Math.sin(f), Math.cos(f))
      if (v > mieux) { mieux = v; phi = k }
    }
    parts.push(phi)
  }
  return { alpha: parts.length < 3 ? 1 : Math.max(0, Math.min(1, mediane(parts))), penchees: parts.length }
}

/* La ligne `chaine` (ses lettres dans l'image de lecture, `largeur` de
   large, `pixels` compris) le long de `courbe`, remise à plat dans une
   toile à elle. Rend la ligne droite — ses lettres { x0, y0, x1, y1,
   pixels } dans la toile, et pour chacune `image` (ses pixels dans l'image
   de lecture), `cx`, `cy` (son centre dans l'image), `X`, `Y` (dans la
   toile), sa transformation (`a`…`f`) — et `courbe` : { W, H (la toile),
   alpha (la part tournée), de quoi suivre la courbe }. */
export function redresser(chaine, courbe, largeur, { alpha = null } = {}) {
  const base = chaine.map(l => {
    const [cx, cy] = l.cx !== undefined ? [l.cx, l.cy] : centreDe(l, largeur)
    const { u, n } = projeter(courbe, cx, cy)
    const [, , tx, ty] = pointA(courbe, u)
    return { l, cx, cy, u, n, t: Math.atan2(ty, tx) }
  })
  let penchees = null
  if (alpha === null) ({ alpha, penchees } = partTournee(base, largeur))
  /* La transformation de chaque lettre, de la toile vers son voisinage
     dans l'image : le pied le long de la courbe, les jambages penchés de
     `alpha` θ — et son inverse. */
  const lettres = base.map(x => {
    /* Les jambages ne s'écartent pas de plus de 50° de la perpendiculaire
       au pied : au-delà (un texte vertical cisaillé), la lettre s'écrase. */
    const f = x.t - Math.max(-0.87, Math.min(0.87, x.t - alpha * x.t))
    const A = { a: Math.cos(x.t), b: -Math.sin(f), d: Math.sin(x.t), e: Math.cos(f) }
    const det = A.a * A.e - A.b * A.d
    const inv = { a: A.e / det, b: -A.b / det, d: -A.d / det, e: A.a / det }
    /* L'étendue de la lettre à plat, autour de son centre. */
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity
    for (const p of x.l.pixels) {
      const px = p % largeur, py = (p - px) / largeur
      for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const dx = px + ox - x.cx, dy = py + oy - x.cy
        const a = inv.a * dx + inv.b * dy, b = inv.d * dx + inv.e * dy
        if (a < a0) a0 = a; if (a > a1) a1 = a; if (b < b0) b0 = b; if (b > b1) b1 = b
      }
    }
    return Object.assign(x, A, { a0, a1, b0, b1 })
  }).filter(x => Number.isFinite(x.a0) && x.a1 - x.a0 < 8 * (x.l.x1 - x.l.x0 + x.l.y1 - x.l.y0 + 2))
  if (!lettres.length) return Object.assign([], { courbe: Object.assign({}, courbe, { W: 1, H: 1, u0: 0, v0: 0, alpha, penchees }) })
  const h = mediane(lettres.map(x => x.b1 - x.b0))
  const M = Math.ceil(Math.max(4, h))
  const u0 = Math.min(...lettres.map(x => x.u + x.a0)) - M, u1 = Math.max(...lettres.map(x => x.u + x.a1)) + M
  const v0 = Math.min(...lettres.map(x => x.n + x.b0)) - M, v1 = Math.max(...lettres.map(x => x.n + x.b1)) + M
  const W = Math.ceil(u1 - u0), H = Math.ceil(v1 - v0)
  const sortie = lettres.map(x => {
    const { l, cx, cy, a, b, d, e } = x
    const X = x.u - u0, Y = x.n - v0
    /* Le masque de la lettre dans son cadre de l'image, pour la lire à
       rebours. */
    const lx = l.x1 - l.x0 + 1, ly = l.y1 - l.y0 + 1
    const masque = new Uint8Array(lx * ly)
    for (const p of l.pixels) { const px = p % largeur, py = (p - px) / largeur; masque[(py - l.y0) * lx + px - l.x0] = 1 }
    const pixels = []
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1
    const X0 = Math.floor(X + x.a0) - 1, X1 = Math.ceil(X + x.a1) + 1, Y0 = Math.floor(Y + x.b0) - 1, Y1 = Math.ceil(Y + x.b1) + 1
    for (let Yy = Math.max(0, Y0); Yy <= Math.min(H - 1, Y1); Yy++) {
      for (let Xx = Math.max(0, X0); Xx <= Math.min(W - 1, X1); Xx++) {
        const da = Xx + 0.5 - X, db = Yy + 0.5 - Y
        const px = Math.floor(cx + a * da + b * db), py = Math.floor(cy + d * da + e * db)
        if (px < l.x0 || py < l.y0 || px > l.x1 || py > l.y1 || !masque[(py - l.y0) * lx + px - l.x0]) continue
        pixels.push(Yy * W + Xx)
        if (Xx < x0) x0 = Xx; if (Xx > x1) x1 = Xx; if (Yy < y0) y0 = Yy; if (Yy > y1) y1 = Yy
      }
    }
    return Object.assign({ formes: l.formes, x0, y0, x1, y1, pixels: Int32Array.from(pixels), image: l.pixels, cx, cy, X, Y, a, b, c: cx - a * X - b * Y, d, e, f: cy - d * X - e * Y }, l.lettrine ? { lettrine: true } : {}, l.anneau ? { anneau: l.anneau } : {})
  }).filter(l => l.pixels.length)
  return Object.assign(sortie, { courbe: Object.assign({}, courbe, { W, H, u0, v0, alpha, penchees }) })
}

/* UN POINT DE LA TOILE REDRESSÉE (`X`, `Y`) dans l'image de lecture : par
   la lettre `l` (sa transformation), ou, sans lettre, le long de la courbe
   elle-même (une écriture liée, d'un tenant). */
export function versImage(ligne, X, Y, l = null) {
  if (l) return [l.a * X + l.b * Y + l.c, l.d * X + l.e * Y + l.f]
  const c = ligne.courbe
  const [x, y, tx, ty] = pointA(c, X + c.u0)
  const n = Y + c.v0, f = c.alpha * Math.atan2(ty, tx)
  return [x - n * Math.sin(f), y + n * Math.cos(f)]
}

/* LE CONTOUR d'une ligne courbe dans l'image de lecture : la bande de ses
   lettres le long de la courbe, `m` pixels autour — [[x, y], …], le bord du
   haut de gauche à droite puis celui du bas de droite à gauche. */
export function contourCourbe(ligne, m = 0) {
  const X0 = Math.min(...ligne.map(l => l.x0)) - m, X1 = Math.max(...ligne.map(l => l.x1)) + 1 + m
  const Y0 = Math.min(...ligne.map(l => l.y0)) - m, Y1 = Math.max(...ligne.map(l => l.y1)) + 1 + m
  const k = Math.max(2, Math.ceil((X1 - X0) / 24))
  const haut = [], bas = []
  for (let i = 0; i <= k; i++) {
    const X = X0 + (X1 - X0) * i / k
    haut.push(versImage(ligne, X, Y0))
    bas.push(versImage(ligne, X, Y1))
  }
  return haut.concat(bas.reverse())
}

/* LES PIQÛRES BOUCHÉES : une lettre tramée (le turquoise pointillé de
   « SAINT MARTIN ») est criblée de petits trous que sa police n'a pas.
   Dans la toile, chaque trou de la lettre plus petit que `part` de sa
   hauteur au carré (0,4 % : quinze pixels de côté sur une lettre de
   225 ; le creux d'un A, d'un R en fait dix fois plus) se remplit. Les
   lettres sont modifiées sur place (`pixels`, leur cadre ne bouge pas). */
export function boucher(ligne, part = 0.004) {
  const W = ligne.courbe.W
  for (const l of ligne) {
    const lx = l.x1 - l.x0 + 3, ly = l.y1 - l.y0 + 3
    const m = new Uint8Array(lx * ly)
    for (const p of l.pixels) { const x = p % W, y = (p - x) / W; m[(y - l.y0 + 1) * lx + x - l.x0 + 1] = 1 }
    /* Le dehors, depuis le bord du cadre élargi d'un pixel. */
    const dehors = new Uint8Array(lx * ly)
    const pile = [0]
    dehors[0] = 1
    while (pile.length) {
      const q = pile.pop(), x = q % lx, y = (q - x) / lx
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy
        if (X < 0 || Y < 0 || X >= lx || Y >= ly) continue
        const v = Y * lx + X
        if (dehors[v] || m[v]) continue
        dehors[v] = 1
        pile.push(v)
      }
    }
    const h = l.y1 - l.y0 + 1, max = part * h * h
    const vu = new Uint8Array(lx * ly)
    const ajout = []
    for (let q0 = 0; q0 < lx * ly; q0++) {
      if (m[q0] || dehors[q0] || vu[q0]) continue
      const trou = [q0]
      vu[q0] = 1
      for (let k = 0; k < trou.length; k++) {
        const q = trou[k], x = q % lx, y = (q - x) / lx
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const v = (y + dy) * lx + x + dx
          if (m[v] || dehors[v] || vu[v]) continue
          vu[v] = 1
          trou.push(v)
        }
      }
      if (trou.length <= max) for (const q of trou) { const x = q % lx, y = (q - x) / lx; ajout.push((y + l.y0 - 1) * W + x + l.x0 - 1) }
    }
    if (ajout.length) l.pixels = Int32Array.from([...l.pixels, ...ajout])
  }
  return ligne
}

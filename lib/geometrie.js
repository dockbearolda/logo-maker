/* ===================================================== LA GÉOMÉTRIE PARFAITE
   27 septembre 2026 : « passer d'un logo pourri à un logo vectorisé
   parfaitement utilisable, haut de gamme et professionnel ». Un graphiste
   qui redessine un logo trace ses droites à la règle et ses ronds au
   compas : le Logo maker aussi. Sur le contour lissé de chaque forme
   (lib/vecteur-lisse.js) :
   - UN ROND devient un vrai cercle — ou une vraie ellipse — : quatre arcs,
     au lieu d'une vingtaine de courbes qui ondulent ;
   - UNE DROITE devient un segment, sans poignées ; presque horizontale ou
     verticale, elle l'est tout à fait ;
   - deux droites qui se suivent se coupent en un angle vif ;
   - la courbe qui part d'une droite en prend la direction : pas de pli.
   Rien n'est forcé : une forme n'est redressée que si elle tient, sur
   toute sa longueur, à `tol` de sa droite ou de son cercle — sinon elle se
   trace en courbes, comme avant. */

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
const KAPPA = 0.5522847498307936

/* L'AIRE SIGNÉE d'une boucle : son signe dit son sens. */
function aire(pts) {
  let s = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) s += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1])
  return s / 2
}

/* LE CERCLE LE PLUS PROCHE (moindres carrés algébriques, centrés). */
export function cercle(pts) {
  const n = pts.length
  if (n < 8) return null
  let mx = 0, my = 0
  for (const p of pts) { mx += p[0]; my += p[1] }
  mx /= n; my /= n
  let suu = 0, svv = 0, suv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0
  for (const p of pts) {
    const u = p[0] - mx, v = p[1] - my
    suu += u * u; svv += v * v; suv += u * v
    suuu += u * u * u; svvv += v * v * v; suvv += u * v * v; svuu += v * u * u
  }
  const det = suu * svv - suv * suv
  if (Math.abs(det) < 1e-9) return null
  const b1 = (suuu + suvv) / 2, b2 = (svvv + svuu) / 2
  const uc = (b1 * svv - b2 * suv) / det, vc = (suu * b2 - suv * b1) / det
  return { cx: uc + mx, cy: vc + my, r: Math.sqrt(uc * uc + vc * vc + (suu + svv) / n) }
}

/* L'ELLIPSE DROITE LA PLUS PROCHE (axes horizontal et vertical) :
   A u² + C v² + D u + E v = 1, aux moindres carrés, sur les points centrés. */
export function ellipseDroite(pts) {
  const n = pts.length
  if (n < 12) return null
  let mx = 0, my = 0
  for (const p of pts) { mx += p[0]; my += p[1] }
  mx /= n; my /= n
  const M = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], B = [0, 0, 0, 0]
  for (const p of pts) {
    const u = p[0] - mx, v = p[1] - my
    const x = [u * u, v * v, u, v]
    for (let i = 0; i < 4; i++) {
      B[i] += x[i]
      for (let j = 0; j < 4; j++) M[i][j] += x[i] * x[j]
    }
  }
  const s = resoudre(M, B)
  if (!s) return null
  const [A, C, D, E] = s
  if (!(A > 0 && C > 0)) return null
  const u0 = -D / (2 * A), v0 = -E / (2 * C)
  const G = 1 + A * u0 * u0 + C * v0 * v0
  if (!(G > 0)) return null
  return { cx: u0 + mx, cy: v0 + my, rx: Math.sqrt(G / A), ry: Math.sqrt(G / C) }
}

/* Un petit système linéaire (Gauss, pivot partiel). */
function resoudre(M, B) {
  const n = B.length
  const a = M.map((l, i) => l.concat(B[i]))
  for (let c = 0; c < n; c++) {
    let p = c
    for (let l = c + 1; l < n; l++) if (Math.abs(a[l][c]) > Math.abs(a[p][c])) p = l
    if (Math.abs(a[p][c]) < 1e-12) return null
    ;[a[c], a[p]] = [a[p], a[c]]
    for (let l = c + 1; l < n; l++) {
      const f = a[l][c] / a[c][c]
      for (let k = c; k <= n; k++) a[l][k] -= f * a[c][k]
    }
  }
  const x = new Array(n).fill(0)
  for (let l = n - 1; l >= 0; l--) {
    let s = a[l][n]
    for (let k = l + 1; k < n; k++) s -= a[l][k] * x[k]
    x[l] = s / a[l][l]
  }
  return x
}

/* L'ÉCART D'UN POINT À L'ELLIPSE (au premier ordre : la valeur divisée
   par la pente). */
function ecartEllipse(p, e) {
  const u = (p[0] - e.cx) / e.rx, v = (p[1] - e.cy) / e.ry
  const g = Math.hypot(2 * u / e.rx, 2 * v / e.ry)
  return g ? Math.abs(u * u + v * v - 1) / g : Infinity
}

/* QUATRE ARCS, dans le sens de la boucle d'origine (`sens`, le signe de
   son aire). */
export function arcs(cx, cy, rx, ry, sens = 1) {
  const kx = KAPPA * rx, ky = KAPPA * ry
  const e = [cx + rx, cy], s = [cx, cy + ry], o = [cx - rx, cy], n = [cx, cy - ry]
  let a = [
    [e, [cx + rx, cy + ky], [cx + kx, cy + ry], s],
    [s, [cx - kx, cy + ry], [cx - rx, cy + ky], o],
    [o, [cx - rx, cy - ky], [cx - kx, cy - ry], n],
    [n, [cx + kx, cy - ry], [cx + rx, cy - ky], e],
  ]
  if (Math.sign(aire([e, s, o, n])) !== Math.sign(sens || 1)) a = a.reverse().map(c => [c[3], c[2], c[1], c[0]])
  return a
}

/* LE RAYON D'UN BORD D'ANNEAU DESSINÉ (`profilAnneau`) à l'angle `t`. */
export function rayonProfil(r, t) {
  const n = r.length, u = (t + Math.PI) / (2 * Math.PI) * n - 0.5, j = Math.floor(u), f = u - j
  const j0 = ((j % n) + n) % n
  return r[j0] * (1 - f) + r[(j0 + 1) % n] * f
}

/* UN BORD D'ANNEAU DESSINÉ EN COURBES : une quarantaine de points pris
   sur le bord tendu, reliés en courbes qui passent par chacun sans pli
   (Catmull-Rom), dans le sens `sens`. */
export function bordDessine(cx, cy, r, sens = 1) {
  const n = r.length, m = Math.max(24, Math.min(96, Math.round(n / 16)))
  const P = Array.from({ length: m }, (_, i) => {
    const t = (i + 0.5) / m * 2 * Math.PI - Math.PI, v = rayonProfil(r, t)
    return [cx + v * Math.cos(t), cy + v * Math.sin(t)]
  })
  let a = P.map((p, i) => {
    const av = P[(i - 1 + m) % m], q = P[(i + 1) % m], ap = P[(i + 2) % m]
    return [p, [p[0] + (q[0] - av[0]) / 6, p[1] + (q[1] - av[1]) / 6], [q[0] - (ap[0] - p[0]) / 6, q[1] - (ap[1] - p[1]) / 6], q]
  })
  if (Math.sign(aire(P)) !== Math.sign(sens || 1)) a = a.reverse().map(c => [c[3], c[2], c[1], c[0]])
  return a
}

/* UN ROND PARFAIT, s'il y en a un : un cercle d'abord, sinon une ellipse
   droite. Il tient sur tout le tour, à un centième de son rayon — à une
   accroche près : un éclat que le JPEG a mordu dans le bord (au plus 4 %
   du tour, à moins de 4 % du rayon) ne défait pas le cercle, le compas le
   redessine. Le rond est ajusté sur les points qui tiennent, le défaut
   mis à part. */
export function rondParfait(P, tol) {
  const sens = aire(P)
  /* Le rond doit avoir la taille de la forme : un éclat presque droit
     tiendrait sur un très grand cercle. */
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const p of P) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]) }
  const A = Math.abs(sens)
  const essai = (ajuste, ecart, rayon, axes) => {
    let f = ajuste(P)
    for (let tour = 0; f && tour < 2; tour++) {
      const bons = P.filter(p => ecart(p, f) <= 3 * tol)
      if (bons.length < 0.9 * P.length) return null
      f = ajuste(bons)
    }
    if (!f || rayon(f) <= Math.max(2, 3 * tol)) return null
    const [ax, ay] = axes(f)
    if (Math.abs(2 * ax - (x1 - x0)) > 0.1 * 2 * ax + 2 * tol || Math.abs(2 * ay - (y1 - y0)) > 0.1 * 2 * ay + 2 * tol) return null
    if (Math.abs(Math.PI * ax * ay - A) > 0.1 * Math.PI * ax * ay) return null
    /* À un centième du rayon, c'est un rond : l'œil ne voit pas l'écart,
       il voit qu'un rond redessiné à la main ondule. */
    const t = Math.max(tol, 0.01 * rayon(f))
    let hors = 0, pire = 0
    for (const p of P) {
      const e = ecart(p, f)
      if (e > t) hors++
      pire = Math.max(pire, e)
    }
    return hors <= 0.04 * P.length && pire <= Math.max(4 * tol, 0.04 * rayon(f)) ? f : null
  }
  const c = essai(cercle, (p, c) => Math.abs(Math.hypot(p[0] - c.cx, p[1] - c.cy) - c.r), c => c.r, c => [c.r, c.r])
  if (c) return arcs(c.cx, c.cy, c.r, c.r, sens)
  const e = essai(ellipseDroite, ecartEllipse, e => Math.max(e.rx, e.ry) < 4 * Math.min(e.rx, e.ry) ? Math.min(e.rx, e.ry) : 0, e => [e.rx, e.ry])
  if (e) return arcs(e.cx, e.cy, e.rx, e.ry, sens)
  return null
}

/* LES LONGUEURS CUMULÉES le long d'une suite de points. */
function cumul(Q) {
  const S = new Float64Array(Q.length)
  for (let i = 1; i < Q.length; i++) S[i] = S[i - 1] + dist(Q[i], Q[i - 1])
  return S
}

/* LES POINTS i..j TIENNENT-ILS À `tol` DE LEUR CORDE, sans revenir sur
   leurs pas ? Sur une longue droite, quelques points (4 %) peuvent s'en
   écarter jusqu'à trois fois plus : l'accroc d'un JPEG ne casse pas un
   côté en trois. */
function tient(Q, S, i, j, tol) {
  const a = Q[i], b = Q[j]
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy)
  if (!L || L < 0.9 * (S[j] - S[i])) return false
  const permis = Math.floor((j - i) * 0.04)
  let hors = 0
  for (let k = i + 1; k < j; k++) {
    const e = Math.abs((Q[k][0] - a[0]) * dy - (Q[k][1] - a[1]) * dx)
    if (e > tol * L && (e > 3 * tol * L || ++hors > permis)) return false
  }
  return true
}

/* LA FLÈCHE d'une suite de points sur sa corde : un arc de cercle se
   bombe, une droite bruitée non (les écarts s'y compensent). L'écart est
   lu comme un décalage plus une bosse : deux bouts arrondis, qui tirent la
   corde de côté, ne font pas une bosse. */
function fleche(Q, S, i, j) {
  const a = Q[i], b = Q[j]
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1
  const T = S[j] - S[i] || 1
  let n = 0, sw = 0, sww = 0, sd = 0, sdw = 0
  for (let k = i + 1; k < j; k++) {
    const t = (S[k] - S[i]) / T
    const w = t * (1 - t)
    const d = ((Q[k][0] - a[0]) * dy - (Q[k][1] - a[1]) * dx) / L
    n++; sw += w; sww += w * w; sd += d; sdw += d * w
  }
  const det = n * sww - sw * sw
  return det > 1e-12 ? (n * sdw - sw * sd) / det / 4 : 0
}

/* LES DROITES D'UNE SUITE OUVERTE de points Q[0..m] : les plus longues
   suites qui tiennent à `tol` de leur corde, d'au moins `longMin`, sans
   bosse (un arc, même très ouvert, se bombe au-delà de `bosse` : coupé en
   cordes, il ferait un polygone). Une droite qui couvre presque tout le
   morceau (85 %) n'a pas à passer ce dernier examen : c'est tout le côté
   qui est droit ; une droite qui n'en couvre qu'une partie doit être
   deux fois plus longue. Rend des paires [i, j] qui se suivent. */
export function droites(Q, tol, longMin, bosse = tol * 0.4) {
  const S = cumul(Q)
  const m = Q.length - 1
  const sortie = []
  let i = 0
  while (i < m - 1) {
    let bon = -1, j = i + 2, pas = 2
    while (j <= m && tient(Q, S, i, j, tol)) { bon = j; j += pas; pas *= 2 }
    if (bon < 0) { i++; continue }
    let a = bon, b = Math.min(j, m + 1)
    while (b - a > 1) { const c = (a + b) >> 1; if (tient(Q, S, i, c, tol)) a = c; else b = c }
    const entier = a - i >= 0.85 * m
    if (dist(Q[i], Q[a]) >= (entier ? 1 : 2) * longMin && (entier || Math.abs(fleche(Q, S, i, a)) <= bosse)) {
      /* Deux droites bout à bout, alignées : une seule. */
      const der = sortie[sortie.length - 1]
      if (der && i - der[1] <= 1 && tient(Q, S, der[0], a, tol) && Math.abs(fleche(Q, S, der[0], a)) <= bosse) der[1] = a
      else sortie.push([i, a])
      i = a
    } else i++
  }
  return sortie
}

/* LA DROITE DES MOINDRES CARRÉS d'une suite de points : son centre et sa
   direction (orientée du premier point vers le dernier) — calculée deux
   fois, la seconde sans les points écartés de plus de `tol` (un accroc ne
   la fait pas pencher). */
function droiteDe(Q, i, j, tol = Infinity) {
  let l = null
  for (let tour = 0; tour < 2; tour++) {
    let mx = 0, my = 0, n = 0
    const garde = k => !l || ecartDroite(Q[k], l) <= tol
    for (let k = i; k <= j; k++) if (garde(k)) { mx += Q[k][0]; my += Q[k][1]; n++ }
    if (n < 2) return l
    mx /= n; my /= n
    let sxx = 0, syy = 0, sxy = 0
    for (let k = i; k <= j; k++) {
      if (!garde(k)) continue
      const u = Q[k][0] - mx, v = Q[k][1] - my
      sxx += u * u; syy += v * v; sxy += u * v
    }
    const th = Math.atan2(2 * sxy, sxx - syy) / 2
    let d = [Math.cos(th), Math.sin(th)]
    if ((Q[j][0] - Q[i][0]) * d[0] + (Q[j][1] - Q[i][1]) * d[1] < 0) d = [-d[0], -d[1]]
    l = { c: [mx, my], d }
  }
  return l
}

const ecartDroite = (p, l) => Math.abs((p[0] - l.c[0]) * l.d[1] - (p[1] - l.c[1]) * l.d[0])
/* Les points i..j tiennent-ils sur la droite `l` (4 % d'accrocs permis,
   comme `tient`) ? */
function tientDroite(Q, i, j, l, tol) {
  let hors = 0
  for (let k = i; k <= j; k++) { const e = ecartDroite(Q[k], l); if (e > tol && (e > 3 * tol || ++hors > (j - i) * 0.04)) return false }
  return true
}
const projeter = (p, l) => { const t = (p[0] - l.c[0]) * l.d[0] + (p[1] - l.c[1]) * l.d[1]; return [l.c[0] + t * l.d[0], l.c[1] + t * l.d[1]] }

/* PRESQUE HORIZONTALE OU VERTICALE (à `droit` degrés près), elle l'est
   tout à fait — si ses points tiennent encore. */
function redresser(l, Q, i, j, tol, droit) {
  const a = Math.atan2(l.d[1], l.d[0]) * 180 / Math.PI
  const q = Math.round(a / 90) * 90
  if (Math.abs(a - q) > droit || Math.abs(a - q) < 1e-9) return l
  const r = q * Math.PI / 180
  const m = { c: l.c, d: [Math.round(Math.cos(r)), Math.round(Math.sin(r))] }
  let hors = 0
  for (let k = i; k <= j; k++) { const e = ecartDroite(Q[k], m); if (e > tol && (e > 2 * tol || ++hors > (j - i) * 0.04)) return l }
  return m
}

/* LE POINT OÙ DEUX DROITES SE COUPENT (null si elles sont presque
   parallèles). */
function croisement(a, b) {
  const det = a.d[0] * b.d[1] - a.d[1] * b.d[0]
  if (Math.abs(det) < 0.08) return null
  const dx = b.c[0] - a.c[0], dy = b.c[1] - a.c[1]
  const t = (dx * b.d[1] - dy * b.d[0]) / det
  return [a.c[0] + t * a.d[0], a.c[1] + t * a.d[1]]
}

function tangenteDe(Q, i, sens, n) {
  const j = Math.max(0, Math.min(n, i + sens * Math.min(3, n)))
  const v = [Q[j][0] - Q[i][0], Q[j][1] - Q[i][1]]
  const l = Math.hypot(v[0], v[1]) || 1
  return [v[0] / l, v[1] / l]
}

/* UNE BOUCLE EN FORMES PARFAITES. `P` : ses points lissés ; `coins` : ses
   pointes (indices croissants, lib/vecteur-lisse.js). Rend ses morceaux —
   [p0, p1] pour une droite, [p0, c1, c2, p3] pour une courbe (ajustée par
   `ajuster`, à `erreur` près) — ou null quand elle n'a ni rond ni droite :
   elle se trace alors en courbes, comme avant.
   `tol` : l'écart permis à une droite ou à un rond ; `longMin` : la plus
   courte droite ; `droit` : l'angle, en degrés, sous lequel une droite
   presque horizontale ou verticale est redressée ; `pli` : le plus long
   arrondi (en points) entre deux droites qui redevient un angle vif. */
export function formesParfaites(P, coins, { tol, longMin, droit = 2, pli = 6, erreur, ajuster }) {
  const n = P.length
  if (n < 8) return null
  /* Deux pointes au plus : un rond que le bruit a cassé en est peut-être un. */
  if (coins.length <= 2) {
    const rond = rondParfait(P, Math.max(tol, 0.004 * Math.sqrt(Math.abs(aire(P)) / Math.PI)))
    if (rond) return rond
  }
  /* LA BOUCLE DÉROULÉE depuis une jointure : sa première pointe ; sans
     pointe, le début de sa première droite (et sans droite, rien à faire). */
  let depart = coins.length ? coins[0] : -1
  if (depart < 0) {
    const Q = P.concat(P.slice(0, Math.min(n, 64)))
    const d = droites(Q, tol, longMin).find(([a]) => a > 0 && a < n)
    if (!d) return null
    depart = d[0] % n
  }
  const U = P.slice(depart).concat(P.slice(0, depart))
  U.push(U[0])
  const bornes = coins.length ? coins.map(c => (c - depart + n) % n).sort((a, b) => a - b).concat(n) : [0, n]

  /* LES ÉLÉMENTS : droites (L) et courbes (C), bout à bout. `fa`–`fb` :
     les points d'où se calcule une droite. */
  const el = []
  let trouve = false
  for (let k = 0; k + 1 < bornes.length; k++) {
    const s = bornes[k], e = bornes[k + 1]
    if (e - s < 2) { el.push({ t: 'C', a: s, b: e }); continue }
    const runs = droites(U.slice(s, e + 1), tol, longMin).map(([a, b]) => [a + s, b + s])
    let cur = s
    for (const [a0, b] of runs) {
      trouve = true
      let a = a0
      if (a - cur <= 1) a = cur
      else el.push({ t: 'C', a: cur, b: a })
      el.push({ t: 'L', a, b, fa: a0, fb: b })
      cur = b
    }
    if (cur < e) {
      const der = el[el.length - 1]
      if (e - cur <= 1 && der && der.t === 'L' && der.b === cur) der.b = e
      else el.push({ t: 'C', a: cur, b: e })
    }
  }
  if (!trouve) return null
  /* Les jointures : une pointe est un angle ; entre une droite et la courbe
     qui la prolonge, un raccord lisse. */
  const pointe = new Set(coins.length ? bornes : [])
  for (const x of el) if (x.t === 'L') x.l = droiteDe(U, x.fa, x.fb, tol)

  /* UN CÔTÉ COUPÉ EN DEUX (un accroc de l'image, ou un départ pris dans
     l'arrondi d'un angle) : deux droites qui se suivent, alignées à 4° près,
     n'en font qu'une — si leurs points, l'arrondi mis à part, tiennent
     ensemble sur une seule. */
  for (let k = 0; k + 1 < el.length; k++) {
    const x = el[k], y = el[k + 1]
    if (x.t !== 'L' || y.t !== 'L') continue
    const sin = Math.abs(x.l.d[0] * y.l.d[1] - x.l.d[1] * y.l.d[0])
    if (sin > Math.sin(4 * Math.PI / 180)) continue
    const ref = x.fb - x.fa >= y.fb - y.fa ? x.l : y.l
    let fa = x.fa, fb = y.fb
    while (fa < x.fb && ecartDroite(U[fa], ref) > tol) fa++
    while (fb > y.fa && ecartDroite(U[fb], ref) > tol) fb--
    const l = droiteDe(U, fa, fb, tol)
    if (!l || !tientDroite(U, fa, fb, l, tol)) continue
    x.b = y.b
    x.fa = fa
    x.fb = fb
    x.l = l
    pointe.delete(y.a)
    el.splice(k + 1, 1)
    k--
  }

  /* ENTRE DEUX DROITES, UN ARRONDI COURT redevient l'angle vif que le flou a
     arrondi (un octogone, dont les angles sont trop doux pour des pointes). */
  for (let k = 0; k < el.length; k++) {
    const x = el[k]
    if (x.t !== 'C' || x.b - x.a > pli || el.length < 3) continue
    const avant = el[(k - 1 + el.length) % el.length], apres = el[(k + 1) % el.length]
    if (avant.t !== 'L' || apres.t !== 'L' || avant === apres) continue
    const X = croisement(avant.l, apres.l)
    if (!X || dist(X, U[(x.a + x.b) >> 1]) > (x.b - x.a) + 2 * tol) continue
    const milieu = (x.a + x.b) >> 1
    avant.b = milieu
    apres.a = milieu
    x.mort = true
    pointe.add(milieu)
  }
  const E = el.filter(x => !x.mort)
  for (const x of E) if (x.t === 'L') x.l = redresser(x.l, U, x.fa, x.fb, tol * 1.5, droit)
  const m = E.length
  const lisse = k => !pointe.has(k % n) && !(k % n === 0 && pointe.has(n))

  /* OÙ LA DROITE S'ARRÊTE VRAIMENT : devant une courbe qui la prolonge (un
     coin arrondi), ses derniers points s'en écartent déjà — le côté mord
     sur l'arrondi, qui repartirait de travers (une oreille). Ils rendent la
     main à la courbe. */
  for (const x of E) {
    if (x.t !== 'L') continue
    const lim = Math.floor((x.b - x.a) * 0.3)
    x.ta = x.a
    x.tb = x.b
    if (lisse(x.a)) while (x.ta - x.a < lim && ecartDroite(U[x.ta], x.l) > 0.35 * tol) x.ta++
    if (lisse(x.b)) while (x.b - x.tb < lim && ecartDroite(U[x.tb], x.l) > 0.35 * tol) x.tb--
  }

  /* LES POINTS DE JOINTURE, d'un élément au suivant : `ji`, leur place dans
     la boucle (au-delà de n : le tour d'après). */
  const joint = new Array(m), ji = new Array(m)
  for (let k = 0; k < m; k++) {
    const x = E[(k - 1 + m) % m], y = E[k]
    let i = y.a
    let p = U[i]
    if (x.t === 'L' && y.t === 'L') {
      const X = croisement(x.l, y.l)
      p = X && dist(X, U[i]) <= 4 * tol + 2 ? X : (a => [(a[0][0] + a[1][0]) / 2, (a[0][1] + a[1][1]) / 2])([projeter(U[i], x.l), projeter(U[i], y.l)])
    } else if (x.t === 'L') {
      i = x.tb
      p = projeter(U[i], x.l)
    } else if (y.t === 'L') {
      i = y.ta
      p = projeter(U[i], y.l)
    }
    joint[k] = p
    ji[k] = i
  }
  /* La boucle, prolongée de ce que la dernière courbe reprend au début. */
  const V = U.concat(U.slice(1, (ji[0] || 0) + 1))

  const sortie = []
  for (let k = 0; k < m; k++) {
    const x = E[k]
    const p0 = joint[k], p3 = joint[(k + 1) % m]
    if (x.t === 'L') {
      /* Une droite qui se retourne : le calcul a déraillé, on renonce. */
      if ((p3[0] - p0[0]) * x.l.d[0] + (p3[1] - p0[1]) * x.l.d[1] <= 0) return null
      sortie.push([p0, p3])
      continue
    }
    const fin = k + 1 < m ? ji[k + 1] : ji[0] + n
    if (fin <= ji[k]) return null
    const pts = V.slice(ji[k], fin + 1)
    pts[0] = p0
    pts[pts.length - 1] = p3
    if (pts.length === 2) { sortie.push([p0, p3]); continue }
    const avant = E[(k - 1 + m) % m], apres = E[(k + 1) % m]
    const lisseAvant = avant.t === 'L' && lisse(x.a)
    const lisseApres = apres.t === 'L' && lisse(x.b)
    const t1 = lisseAvant ? avant.l.d : tangenteDe(pts, 0, 1, pts.length - 1)
    const t2 = lisseApres ? [-apres.l.d[0], -apres.l.d[1]] : tangenteDe(pts, pts.length - 1, -1, pts.length - 1)
    ajuster(pts, t1, t2, erreur, sortie)
  }
  return sortie
}

/* ============================================================ LES ANNEAUX
   29 septembre 2026 : « le rond gris autour du personnage doit être
   parfait — tu dois capter très facilement que ce genre de forme est un
   rond ». Un anneau argenté, dans un JPEG : un gris, un reflet blanc, un
   halo ; tracé couleur par couleur, il ressortait en arcs cassés, bordé
   d'éclats. Le graphiste, lui, voit un rond, et le redessine au compas.
   Sur la carte des couches (`rang`, -1 le vide) et la couverture du dessin
   (`tout`), `largeur` × `hauteur` :
   1. LE CERCLE : pour chaque couche, le cercle qui passe par le plus de
      points de son bord (RANSAC : trois points tirés au sort, cent fois ;
      puis ajusté aux moindres carrés sur ceux qui tiennent, à `tol`) —
      même cassé, même bordé d'éclats, il en porte plus de la moitié du
      tour ;
   2. L'ANNEAU : autour de ce centre, les rayons où la couche fait le tour
      — à moitié au moins de là où elle le fait le plus — (le reflet d'un
      pixel ou deux qui la coupe ne compte pas), d'une
      épaisseur égale tout du long (un O d'imprimerie, gras sur les côtés,
      maigre en haut, n'en est pas un) et mince (moins du tiers du rayon) ;
   3. LE COMPAS : l'anneau devient exact — la couche entre ses deux cercles,
      au centième de pixel (anticrénelé), ce qui était dehors dehors, ce
      qui était dedans dedans ; les éclats et le halo qui le bordaient, à
      son épaisseur près, partent avec.
   `rayonMin` : le plus petit rond qu'on redessine (une lettre o n'est pas
   touchée). Modifie `rang` et `tout` ; rend les anneaux redessinés. */
export function anneaux(rang, tout, largeur, hauteur, couches, { tol = 1.5, rayonMin = 20, graine = 7, familles = null } = {}) {
  const n = largeur * hauteur
  let s = graine
  const hasard = () => (s = (s * 16807) % 2147483647) / 2147483647
  const trouves = []
  /* Une couche seule, ou une famille de couches (deux gris qui se
     partagent l'anneau). */
  const groupes = (familles || []).concat(Array.from({ length: couches }, (_, i) => [i]))
  for (const groupe of groupes) {
    const dans = new Uint8Array(couches + 1)
    for (const i of groupe) dans[i + 1] = 1
    const est = p => dans[rang[p] + 1] === 1 && tout[p] >= 0.5
    if (trouves.some(a => groupe.includes(a.couche))) continue
    /* Le bord de la couche. */
    const bx = [], by = []
    for (let y = 1; y < hauteur - 1; y++) {
      for (let x = 1; x < largeur - 1; x++) {
        const p = y * largeur + x
        if (!est(p)) continue
        if (!est(p - 1) || !est(p + 1) || !est(p - largeur) || !est(p + largeur)) { bx.push(x); by.push(y) }
      }
    }
    const m = bx.length
    if (m < 2 * Math.PI * rayonMin * 0.5) continue
    /* 1. Le cercle qui porte le plus de points. */
    const pas = Math.max(1, Math.floor(m / 6000))
    let meilleur = null, score = 0
    for (let it = 0; it < 300; it++) {
      const i = Math.floor(hasard() * m), j = Math.floor(hasard() * m), k = Math.floor(hasard() * m)
      const c = cercle3(bx[i], by[i], bx[j], by[j], bx[k], by[k])
      if (!c || c.r < rayonMin || c.r > Math.max(largeur, hauteur)) continue
      let t = 0
      for (let q = 0; q < m; q += pas) if (Math.abs(Math.hypot(bx[q] - c.cx, by[q] - c.cy) - c.r) <= tol) t++
      if (t > score) { score = t; meilleur = c }
    }
    if (!meilleur) continue
    /* Le centre se précise sur les pixels de la couche autour du cercle
       (pas seulement son bord : un côté bien net le tirait à lui), dans une
       fenêtre qui se resserre. */
    let c = meilleur
    for (let tour = 0, fen = Math.max(4 * tol, 0.04 * c.r); tour < 4; tour++, fen = Math.max(2 * tol, 0.7 * fen)) {
      const pts = []
      const X0 = Math.max(0, Math.floor(c.cx - c.r - fen)), X1 = Math.min(largeur - 1, Math.ceil(c.cx + c.r + fen))
      const Y0 = Math.max(0, Math.floor(c.cy - c.r - fen)), Y1 = Math.min(hauteur - 1, Math.ceil(c.cy + c.r + fen))
      const saut = Math.max(1, Math.round(Math.sqrt((X1 - X0) * (Y1 - Y0) / 400000)))
      for (let y = Y0; y <= Y1; y += saut) {
        for (let x = X0; x <= X1; x += saut) {
          const p = y * largeur + x
          if (est(p) && Math.abs(Math.hypot(x - c.cx, y - c.cy) - c.r) <= fen) pts.push([x, y])
        }
      }
      const f = pts.length >= 8 ? cercle(pts) : null
      if (!f) break
      c = f
    }
    /* Il porte plus de la moitié du tour, sur les trois quarts des angles :
       sur son bord le plus net autour de ce centre — le dedans ou le dehors
       d'un anneau épais, dont le cercle précisé suit le milieu. */
    const h0 = c.r * 5 / 6 - 2 * tol, nh = Math.ceil((c.r / 3 + 4 * tol) * 2) + 1
    const hist = new Float64Array(nh)
    for (let q = 0; q < m; q++) {
      const b = Math.floor((Math.hypot(bx[q] - c.cx, by[q] - c.cy) - h0) * 2)
      if (b >= 0 && b < nh) hist[b]++
    }
    const demi = Math.round(4 * tol)
    let rBord = c.r, plus = -1
    for (let b = 0; b < nh; b++) {
      let t = 0
      for (let k = Math.max(0, b - demi); k <= Math.min(nh - 1, b + demi); k++) t += hist[k]
      if (t > plus) { plus = t; rBord = h0 + (b + 0.5) / 2 }
    }
    const secteurs = new Uint8Array(90)
    let portes = 0
    for (let q = 0; q < m; q++) {
      if (Math.abs(Math.hypot(bx[q] - c.cx, by[q] - c.cy) - rBord) > 2 * tol) continue
      portes++
      secteurs[Math.floor((Math.atan2(by[q] - c.cy, bx[q] - c.cx) + Math.PI) / (2 * Math.PI) * 90) % 90] = 1
    }
    let couverts = 0
    for (const v of secteurs) couverts += v
    if (portes < Math.PI * rBord || couverts < 68) continue
    /* 2. L'anneau : la part du tour que la couche couvre, rayon par rayon
       (au demi-pixel), de la moitié au double du rayon. */
    const R0 = Math.floor(c.r * 0.5), R1 = Math.ceil(c.r * 1.5)
    const nb = (R1 - R0) * 2 + 1, compte = new Float64Array(nb)
    const x0 = Math.max(0, Math.floor(c.cx - R1)), x1 = Math.min(largeur - 1, Math.ceil(c.cx + R1))
    const y0 = Math.max(0, Math.floor(c.cy - R1)), y1 = Math.min(hauteur - 1, Math.ceil(c.cy + R1))
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - c.cx, y - c.cy)
        if (d < R0 || d >= R1) continue
        const p = y * largeur + x
        if (est(p)) compte[Math.floor((d - R0) * 2)]++
      }
    }
    const part = b => compte[b] / (2 * Math.PI * (R0 + (b + 0.5) / 2) * 0.5)
    /* Le rayon du bord trouvé, et la bande pleine qui le touche — un
       creux de moins de `trou` rayons au plus (le reflet) la traverse. */
    const b0 = Math.min(nb - 1, Math.max(0, Math.floor((c.r - R0) * 2)))
    let bIn = b0, bOut = b0
    const trou = Math.max(4, Math.round(4 * tol))
    /* Plein : à la moitié du plus plein des rayons voisins (un anneau cassé
       n'est jamais plein partout), un cinquième du tour au moins. */
    let sommet = 0
    for (let q = Math.max(0, b0 - 2 * trou); q <= Math.min(nb - 1, b0 + 2 * trou); q++) sommet = Math.max(sommet, part(q))
    const seuil = Math.max(0.2, Math.min(0.45, 0.5 * sommet))
    const plein = b => b >= 0 && b < nb && part(b) >= seuil
    const etendre = (b, sens) => {
      let dernier = b
      for (let q = b + sens, vide = 0; q >= 0 && q < nb && vide <= trou; q += sens) {
        if (plein(q)) { dernier = q; vide = 0 } else vide++
      }
      return dernier
    }
    /* Le bord trouvé est celui du dedans ou du dehors : la bande est du
       côté plein. */
    if (!plein(b0) && !plein(b0 - 1) && !plein(b0 + 1)) {
      let q = b0 - 2
      while (q > b0 - 2 * trou && !plein(q)) q--
      let o = b0 + 2
      while (o < b0 + 2 * trou && !plein(o)) o++
      const choix = plein(q) && (!plein(o) || b0 - q <= o - b0) ? q : plein(o) ? o : -1
      if (choix < 0) continue
      bIn = bOut = choix
    }
    bIn = etendre(bIn, -1)
    bOut = etendre(bOut, 1)
    const Ri = R0 + bIn / 2, Ro = R0 + (bOut + 1) / 2, w = Ro - Ri
    if (w < 1 || w > c.r / 3) continue
    /* UN ANNEAU ENTOURE QUELQUE CHOSE (un personnage, un texte, un
       disque) ; un O est vide : dedans, rien qu'un seul fond. */
    const R = Ri - Math.max(3 * tol, w)
    if (R <= 0) continue
    {
      const votes = new Map()
      let total = 0
      const saut = Math.max(1, Math.round(R / 60))
      for (let y = Math.max(0, Math.ceil(c.cy - R)); y <= Math.min(hauteur - 1, Math.floor(c.cy + R)); y += saut) {
        for (let x = Math.max(0, Math.ceil(c.cx - R)); x <= Math.min(largeur - 1, Math.floor(c.cx + R)); x += saut) {
          if (Math.hypot(x - c.cx, y - c.cy) > R) continue
          const p = y * largeur + x, v = tout[p] < 0.5 ? -1 : rang[p]
          votes.set(v, (votes.get(v) || 0) + 1)
          total++
        }
      }
      let fond = 0
      for (const k of votes.values()) fond = Math.max(fond, k)
      if (fond > 0.98 * total) continue
    }
    /* D'une épaisseur égale : son étendue, secteur par secteur. */
    const ext = []
    const lo = new Float64Array(90).fill(Infinity), hi = new Float64Array(90).fill(-Infinity)
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - c.cx, y - c.cy)
        if (d < Ri - 1 || d > Ro + 1) continue
        const p = y * largeur + x
        if (!est(p)) continue
        const a = Math.floor((Math.atan2(y - c.cy, x - c.cx) + Math.PI) / (2 * Math.PI) * 90) % 90
        lo[a] = Math.min(lo[a], d); hi[a] = Math.max(hi[a], d)
      }
    }
    for (let a = 0; a < 90; a++) if (hi[a] >= lo[a]) ext.push(hi[a] - lo[a])
    if (ext.length < 68) continue
    ext.sort((u, v) => u - v)
    const med = ext[ext.length >> 1]
    if (ext[Math.floor(ext.length * 0.1)] < 0.25 * med || ext[Math.floor(ext.length * 0.9)] > 1.6 * med + 2 * tol) continue
    /* La couleur de l'anneau : la couche de la famille qui en couvre le
       plus. */
    const parCouche = new Float64Array(couches)
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - c.cx, y - c.cy), p = y * largeur + x
        if (d >= Ri && d <= Ro && est(p)) parCouche[rang[p]]++
      }
    }
    let r = groupe[0]
    for (const i of groupe) if (parCouche[i] > parCouche[r]) r = i
    trouves.push({ couche: r, famille: groupe, cx: c.cx, cy: c.cy, ri: Ri, ro: Ro })
  }
  /* 3. LE DESSIN DE L'ANNEAU. Ce qui le borde, dedans et dehors, se lit
     juste au-delà de sa bordure (`g` : son épaisseur, au moins trois
     `tol`), secteur par secteur (deux degrés) : le vide ou la couche
     d'à côté. */
  for (const a of trouves) {
    const g = Math.max(3 * tol, a.ro - a.ri)
    /* SES PARTIES CLAIRES : une couche qui le suit en longs arcs dans sa
       bande (le reflet d'un anneau argenté, son côté presque blanc) en
       est — pas des lettres posées dessus (courtes), ni le disque qu'il
       entoure (dedans), ni une forme qui le croise (surtout dehors). */
    {
      const w = a.ro - a.ri, R1 = a.ro + g
      const dansBande = new Float64Array(couches), dansZone = new Float64Array(couches), tours = Array.from({ length: couches }, () => new Uint8Array(720))
      const x0 = Math.max(0, Math.floor(a.cx - R1)), x1 = Math.min(largeur - 1, Math.ceil(a.cx + R1))
      const y0 = Math.max(0, Math.floor(a.cy - R1)), y1 = Math.min(hauteur - 1, Math.ceil(a.cy + R1))
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const d = Math.hypot(x - a.cx, y - a.cy), p = y * largeur + x
          if (d < a.ri - g || d > R1 || tout[p] < 0.5 || a.famille.includes(rang[p])) continue
          const v = rang[p]
          dansZone[v]++
          if (d >= a.ri && d <= a.ro) {
            dansBande[v]++
            tours[v][Math.floor((Math.atan2(y - a.cy, x - a.cx) + Math.PI) / (2 * Math.PI) * 720) % 720] = 1
          }
        }
      }
      const compagnons = []
      for (let v = 0; v < couches; v++) {
        if (dansBande[v] < 0.4 * dansZone[v] || dansBande[v] < 4 * w) continue
        /* Ses arcs, d'un seul tenant : leur longueur moyenne. */
        let pleins = 0, suites = 0
        for (let j = 0; j < 720; j++) { if (tours[v][j]) { pleins++; if (!tours[v][(j + 719) % 720]) suites++ } }
        if (!suites || pleins < 0.1 * 720) continue
        const longueur = pleins / suites / 720 * 2 * Math.PI * (a.ri + a.ro) / 2
        if (longueur >= 4 * w) compagnons.push(v)
      }
      if (compagnons.length) a.famille = a.famille.concat(compagnons)
    }
    /* Ce qui borde, secteur par secteur : ce qu'on trouve le plus entre
       `de` et `a` rayons, la couleur de l'anneau mise à part (son biseau,
       ses éclats) — s'il n'y a qu'elle, elle. */
    const Z0 = Math.max(5 * (a.ro - a.ri), 8 * tol)
    const lire = (de, jusque, secteur) => {
      const votes = new Map()
      const pas = Math.max(1, (jusque - de) / 12)
      for (let k = 0; k < 5; k++) {
        const t = (secteur + (k + 0.5) / 5) / 180 * 2 * Math.PI - Math.PI
        for (let rr = de; rr <= jusque; rr += pas) {
          const x = Math.round(a.cx + rr * Math.cos(t)), y = Math.round(a.cy + rr * Math.sin(t))
          const v = x < 0 || y < 0 || x >= largeur || y >= hauteur ? -1 : tout[y * largeur + x] < 0.5 ? -1 : rang[y * largeur + x]
          votes.set(v, (votes.get(v) || 0) + 1)
        }
      }
      let m = -1, best = a.couche
      for (const [v, k] of votes) if (!a.famille.includes(v) && k > m) { m = k; best = v }
      return best
    }
    const dehors = [], dedans = []
    for (let q = 0; q < 180; q++) { dehors.push(lire(a.ro + 1, a.ro + Z0, q)); dedans.push(lire(Math.max(0, a.ri - Z0), a.ri - 1, q)) }
    /* SES DEUX BORDS (29 septembre 2026 : « c'est fait exprès que le
       cercle ne soit pas parfait, c'est le logo qui est fait comme ça ») :
       lus angle par angle sur la couche, puis tendus (`profilAnneau`). Un
       anneau au dessin irrégulier — épais ici, fin là — garde son dessin,
       net ; un anneau qui n'est qu'un rond abîmé (ses deux bords tiennent
       chacun sur un cercle, à `tol` près) redevient deux cercles exacts.
       Un bord que la courbe tendue n'explique pas (festonné, crénelé : un
       vrai motif) laisse l'anneau tel quel. */
    const dansFamille = new Uint8Array(couches + 1)
    for (const i of a.famille) dansFamille[i + 1] = 1
    const est = p => dansFamille[rang[p] + 1] === 1 && tout[p] >= 0.5
    const profil = profilAnneau(a, est, largeur, hauteur, tol, g)
    if (!profil) { a.laisse = true; continue }
    const n = profil.n
    const ext = cercleDe(profil.dehors), int = cercleDe(profil.dedans)
    a.geometrique = !!(ext && int && ext.p90 <= 1.2 * tol && int.p90 <= 1.2 * tol && int.c.r < ext.c.r)
    let rin = profil.rin, rout = profil.rout
    if (a.geometrique) {
      a.c1 = ext.c; a.c2 = int.c
      /* Le long d'un rayon parti du centre, là où il sort du cercle `c`. */
      const sortie = (c, t) => {
        const ox = a.cx - c.cx, oy = a.cy - c.cy, b = Math.cos(t) * ox + Math.sin(t) * oy
        return -b + Math.sqrt(Math.max(0, b * b - (ox * ox + oy * oy - c.r * c.r)))
      }
      rin = new Float64Array(n); rout = new Float64Array(n)
      for (let j = 0; j < n; j++) { const t = (j + 0.5) / n * 2 * Math.PI - Math.PI; rin[j] = sortie(int.c, t); rout[j] = sortie(ext.c, t) }
    } else a.profil = { n, rin, rout }
    const bande = t => {
      const u = (t + Math.PI) / (2 * Math.PI) * n - 0.5, j = Math.floor(u), f = u - j
      const j0 = ((j % n) + n) % n, j1 = (j0 + 1) % n
      return [rin[j0] * (1 - f) + rin[j1] * f, rout[j0] * (1 - f) + rout[j1] * f]
    }
    /* Ce que chaque pixel autour doit être : l'anneau entre ses bords (son
       bord anticrénelé : la part du pixel dedans), ce qui le borde
       au-delà. */
    let rMax = 0
    for (let j = 0; j < n; j++) rMax = Math.max(rMax, rout[j])
    const X0 = Math.max(0, Math.floor(a.cx - rMax - g - 1)), X1 = Math.min(largeur - 1, Math.ceil(a.cx + rMax + g + 1))
    const Y0 = Math.max(0, Math.floor(a.cy - rMax - g - 1)), Y1 = Math.min(hauteur - 1, Math.ceil(a.cy + rMax + g + 1))
    const zl = X1 - X0 + 1, zh = Y1 - Y0 + 1
    /* `ecart` : 0 hors de la zone, 1 juste, 2 un manque dans l'anneau, 3 un
       débord au-delà, 4 un débord loin du bord (plus de `pres`) ;
       `limite` : au bord de la zone. */
    const ecart = new Uint8Array(zl * zh), limite = new Uint8Array(zl * zh)
    const cible = new Int8Array(zl * zh), part = new Float32Array(zl * zh), secteur = new Uint8Array(zl * zh)
    for (let y = Y0; y <= Y1; y++) {
      for (let x = X0; x <= X1; x++) {
        const d = Math.hypot(x - a.cx, y - a.cy), t = Math.atan2(y - a.cy, x - a.cx)
        const [ri, ro] = bande(t)
        if (d < ri - g || d > ro + g) continue
        const i = (y - Y0) * zl + x - X0, p = y * largeur + x
        const q = Math.floor((t + Math.PI) / (2 * Math.PI) * 180) % 180
        let k, dehorsDuMilieu
        if (a.geometrique) {
          const d1 = Math.hypot(x - a.c1.cx, y - a.c1.cy), d2 = Math.hypot(x - a.c2.cx, y - a.c2.cy)
          k = Math.max(0, Math.min(1, a.c1.r + 0.5 - d1)) * Math.max(0, Math.min(1, d2 - a.c2.r + 0.5))
          dehorsDuMilieu = d1 - a.c1.r > a.c2.r - d2
        } else {
          k = Math.max(0, Math.min(1, ro + 0.5 - d)) * Math.max(0, Math.min(1, d - ri + 0.5))
          dehorsDuMilieu = d > (ri + ro) / 2
        }
        const autre = dehorsDuMilieu ? dehors[q] : dedans[q]
        const doit = k >= 0.5 ? a.couche : autre, v = tout[p] < 0.5 ? -1 : rang[p]
        cible[i] = autre; part[i] = k; secteur[i] = q
        const pres = Math.max(2 * tol, 0.25 * (ro - ri))
        ecart[i] = k >= 0.5 ? (dansFamille[v + 1] ? 1 : 2) : v === doit ? 1 : Math.max(d - ro, ri - d) <= pres ? 3 : 4
        if (d < ri - g + 1.5 || d > ro + g - 1.5 || x === 0 || y === 0 || x === largeur - 1 || y === hauteur - 1) limite[i] = 1
      }
    }
    /* Continue-t-il au-delà de la zone ? Le pixel deux pas plus loin, sur
       le même rayon, est de la même couleur. */
    const vaAuDela = (X, Y, v) => {
      const d = Math.hypot(X - a.cx, Y - a.cy), t = Math.atan2(Y - a.cy, X - a.cx)
      const [ri, ro] = bande(t), r = d > ro ? d + 2 : d < ri ? d - 2 : -1
      if (r < 0) return false
      const x = Math.round(a.cx + r * Math.cos(t)), y = Math.round(a.cy + r * Math.sin(t))
      if (x < 0 || y < 0 || x >= largeur || y >= hauteur) return true
      const p = y * largeur + x
      return (tout[p] < 0.5 ? -1 : rang[p]) === v
    }
    const vu = new Uint8Array(zl * zh), garde = new Uint8Array(zl * zh)
    /* UNE FORME QUI PASSE : d'une autre couleur que l'anneau et ce qui le
       borde, elle continue au-delà de la zone (un bras, un ruban qui
       croise l'anneau) — on n'y touche pas. Un reflet d'un gris plus clair
       reste dans l'anneau : il y rentre. */
    for (let i0 = 0; i0 < zl * zh; i0++) {
      if (!ecart[i0] || vu[i0]) continue
      const x0 = i0 % zl, y0 = (i0 - x0) / zl, p0 = (y0 + Y0) * largeur + x0 + X0
      const v = tout[p0] < 0.5 ? -1 : rang[p0]
      if (v < 0 || dansFamille[v + 1] || v === dedans[secteur[i0]] || v === dehors[secteur[i0]]) continue
      const morceau = [i0]
      vu[i0] = 1
      let passe = false
      for (let s = 0; s < morceau.length; s++) {
        const i = morceau[s], x = i % zl, y = (i - x) / zl
        if (limite[i] && vaAuDela(x + X0, y + Y0, v)) passe = true
        for (const j of [x > 0 ? i - 1 : -1, x < zl - 1 ? i + 1 : -1, y > 0 ? i - zl : -1, y < zh - 1 ? i + zl : -1]) {
          if (j < 0 || vu[j] || !ecart[j]) continue
          const pj = (((j - j % zl) / zl) + Y0) * largeur + j % zl + X0
          if ((tout[pj] < 0.5 ? -1 : rang[pj]) !== v) continue
          vu[j] = 1
          morceau.push(j)
        }
      }
      if (passe) for (const i of morceau) { garde[i] = 1; ecart[i] = 1 }
    }
    vu.fill(0)
    /* LES ACCROCS : ce qui s'écarte du dessin tendu part — ce qui dépasse
       de son bord de peu (une bosse, le grain), ce qui y manque (une
       encoche, un reflet, un jour entre deux traits du crayon), un éclat
       isolé —, sauf ce qui est vraiment dessiné là : une lettre ou un
       point posé sur l'anneau (trapu : enclos, ou d'une autre couleur),
       une forme au large qui sort de la zone ou tient de la place, une
       vraie coupure dans un anneau plein autour (un anneau ouvert, un C).
       Chaque morceau d'un tenant, manques d'un côté, débords lointains de
       l'autre. */
    for (let i0 = 0; i0 < zl * zh; i0++) {
      const sorte = ecart[i0]
      if (sorte < 2 || sorte === 3 || vu[i0]) continue
      const morceau = [i0]
      vu[i0] = 1
      let passe = false, ouvert = false, etrangers = 0, dmin = Infinity, dmax = -Infinity, amin = 0, amax = 0, t0 = NaN, epaisseur = 0
      for (let s = 0; s < morceau.length; s++) {
        const i = morceau[s], x = i % zl, y = (i - x) / zl, X = x + X0, Y = y + Y0
        const d = Math.hypot(X - a.cx, Y - a.cy), t = Math.atan2(Y - a.cy, X - a.cx)
        const [ri, ro] = bande(t)
        dmin = Math.min(dmin, d - ri); dmax = Math.max(dmax, d - ri)
        epaisseur += ro - ri
        /* Les angles, comptés depuis le premier pixel : un morceau à
           cheval sur le demi-tour ne fait pas le tour. */
        if (Number.isNaN(t0)) t0 = t
        let u = t - t0
        if (u > Math.PI) u -= 2 * Math.PI
        if (u < -Math.PI) u += 2 * Math.PI
        amin = Math.min(amin, u); amax = Math.max(amax, u)
        const p = Y * largeur + X, v = tout[p] < 0.5 ? -1 : rang[p]
        if (limite[i] && vaAuDela(X, Y, v)) passe = true
        if (v >= 0 && !dansFamille[v + 1] && v !== dedans[secteur[i]] && v !== dehors[secteur[i]]) etrangers++
        for (const j of [x > 0 ? i - 1 : -1, x < zl - 1 ? i + 1 : -1, y > 0 ? i - zl : -1, y < zh - 1 ? i + zl : -1]) {
          if (j < 0) continue
          if (ecart[j] === 1 && part[j] < 0.5 && !garde[j]) ouvert = true
          if (vu[j] || ecart[j] !== sorte) continue
          vu[j] = 1
          morceau.push(j)
        }
      }
      const w = epaisseur / morceau.length, radial = dmax - dmin, tangent = (amax - amin) * (a.ri + a.ro) / 2
      const trapu = radial >= Math.max(2 * tol, 0.4 * w) && tangent >= 2 * tol && tangent <= 3 * w && morceau.length > 6 * tol * tol
      let reste = false
      if (sorte === 4) reste = passe || (radial >= 0.5 * w && tangent >= 0.5 * w && morceau.length >= 0.5 * w * w)
      else if (trapu && (!ouvert || etrangers > 0.5 * morceau.length)) reste = true
      else if (tangent > Math.max(2 * w, 6 * tol)) {
        /* Une coupure franche — rien de l'anneau sur ces angles — dans un
           anneau plein autour : voulue. Là où l'anneau s'efface par
           bribes (un gris trop clair, lu par traits), un jour de plus à
           combler. */
        const j0 = Math.floor(((t0 + amin + Math.PI) / (2 * Math.PI)) * n), jn = Math.max(1, Math.ceil((amax - amin) / (2 * Math.PI) * n))
        let vide = 0, lu = 0, tous = 0
        for (let j = j0; j < j0 + jn; j++) if (!profil.lu[((j % n) + n) % n]) vide++
        for (const [de, jusque] of [[j0 - jn, j0], [j0 + jn, j0 + 2 * jn]]) for (let j = de; j < jusque; j++) { tous++; lu += profil.lu[((j % n) + n) % n] }
        if (vide >= 0.9 * jn && lu >= 0.8 * tous) reste = true
      }
      if (reste) for (const i of morceau) garde[i] = 1
    }
    for (let i = 0; i < zl * zh; i++) {
      if (!ecart[i] || garde[i]) continue
      const x = i % zl, y = (i - x) / zl, p = (y + Y0) * largeur + x + X0, k = part[i], autre = cible[i]
      if (autre < 0) { rang[p] = a.couche; tout[p] = k }
      else { rang[p] = k >= 0.5 ? a.couche : autre; tout[p] = 1 }
    }
    /* LES ÉCLATS D'ARC, plus loin : un morceau mince qui suit le rond (le
       biseau d'un anneau argenté, son reflet), dans les cinq épaisseurs
       autour, part aussi — pas une lettre ni un dessin posé près du rond,
       plus hauts que minces. */
    const Z = Math.max(5 * (a.ro - a.ri), 8 * tol)
    const zx0 = Math.max(0, Math.floor(a.cx - rMax - Z)), zx1 = Math.min(largeur - 1, Math.ceil(a.cx + rMax + Z))
    const zy0 = Math.max(0, Math.floor(a.cy - rMax - Z)), zy1 = Math.min(hauteur - 1, Math.ceil(a.cy + rMax + Z))
    const el = zx1 - zx0 + 1, eh = zy1 - zy0 + 1
    const etat = new Int8Array(el * eh).fill(-2), vuE = new Uint8Array(el * eh)
    for (let y = zy0; y <= zy1; y++) {
      for (let x = zx0; x <= zx1; x++) {
        const d = Math.hypot(x - a.cx, y - a.cy), t = Math.atan2(y - a.cy, x - a.cx)
        const [ri, ro] = bande(t)
        if (d <= ri - Z || d >= ro + Z || (d > ri - 0.5 && d < ro + 0.5)) continue
        const q = Math.floor((t + Math.PI) / (2 * Math.PI) * 180) % 180
        const p = y * largeur + x, cote = d > ro ? dehors[q] : dedans[q]
        /* Une trace pâle de sa couleur compte aussi : le tracé la
           remonterait (un filet fin s'y renforce). */
        const v = tout[p] >= 0.5 ? rang[p] : tout[p] > 0.02 && dansFamille[rang[p] + 1] ? rang[p] : -1
        if (v !== cote) etat[(y - zy0) * el + x - zx0] = cote
      }
    }
    for (let i0 = 0; i0 < el * eh; i0++) {
      if (etat[i0] === -2 || vuE[i0]) continue
      const morceau = [i0]
      vuE[i0] = 1
      let dmin = Infinity, dmax = -Infinity, bord = false, amin = Infinity, amax = -Infinity, siens = 0
      for (let s = 0; s < morceau.length; s++) {
        const i = morceau[s], x = i % el, y = (i - x) / el
        const pp = (y + zy0) * largeur + x + zx0
        if (a.famille.includes(rang[pp]) && tout[pp] >= 0.5) siens++
        const d = Math.hypot(x + zx0 - a.cx, y + zy0 - a.cy), t = Math.atan2(y + zy0 - a.cy, x + zx0 - a.cx)
        const [ri, ro] = bande(t)
        if (d < dmin) dmin = d
        if (d > dmax) dmax = d
        if (d <= ri - Z + 1.5 || d >= ro + Z - 1.5) bord = true
        if (t < amin) amin = t
        if (t > amax) amax = t
        for (const j of [x > 0 ? i - 1 : -1, x < el - 1 ? i + 1 : -1, y > 0 ? i - el : -1, y < eh - 1 ? i + el : -1]) {
          if (j < 0 || vuE[j] || etat[j] === -2) continue
          vuE[j] = 1
          morceau.push(j)
        }
      }
      const ouverture = Math.min(amax - amin, 2 * Math.PI - (amax - amin))
      const radial = dmax - dmin, tangent = ouverture * (dmin + dmax) / 2
      const w = a.ro - a.ri
      /* Un arc mince qui suit le rond, ou un petit accroc de sa couleur. */
      const arc = radial <= 4 * w + tol && tangent >= 2 * radial
      const accroc = siens >= 0.5 * morceau.length && morceau.length <= 4 * w * w + 9 * tol * tol
      if (bord || !(arc || accroc)) continue
      for (const i of morceau) {
        const x = i % el, y = (i - x) / el, p = (y + zy0) * largeur + x + zx0
        if (etat[i] < 0) tout[p] = 0
        else { rang[p] = etat[i]; tout[p] = 1 }
      }
    }
  }
  return trouves.filter(a => !a.laisse)
}

/* LE CERCLE PAR TROIS POINTS, ou null s'ils sont alignés. */
function cercle3(ax, ay, bx, by, cx, cy) {
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
  if (Math.abs(d) < 1e-9) return null
  const a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx * cx + cy * cy
  const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d
  const uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d
  return { cx: ux, cy: uy, r: Math.hypot(ax - ux, ay - uy) }
}

/* LE PROFIL D'UN ANNEAU : pour `n` angles (un pas d'un pixel et demi sur
   son tour), ses bords du dedans et du dehors, lus depuis le milieu de sa
   bande sur les pixels de sa couche (`est`) — un trou de moins de `trou`
   pixels franchi (au-delà de sa bande ; dedans, tout creux : le reflet
   entre les deux filets d'un anneau argenté, une lettre posée dessus), les
   éclats d'au-delà laissés — ; puis
   chaque bord tendu en une courbe lisse du tour (`bordTendu`) : le dessin
   (épais ici, fin là, qui ondule en grand) reste, le grain, les bosses et
   les encoches partent, un angle sans rien se comble. Rend `lu` (l'angle
   a-t-il été lu ?) et les points des deux bords ; null si la courbe
   tendue n'explique pas le bord (un feston, un créneau : un vrai motif,
   pas un défaut). */
export function profilAnneau(a, est, largeur, hauteur, tol, g) {
  const n = Math.max(180, Math.ceil(2 * Math.PI * a.ro / 1.5))
  const rin = new Float64Array(n).fill(NaN), rout = new Float64Array(n).fill(NaN), lu = new Uint8Array(n)
  const trou = Math.max(2, 1.5 * tol)
  const dans = (r, c, s) => { const x = Math.round(a.cx + r * c), y = Math.round(a.cy + r * s); return x >= 0 && y >= 0 && x < largeur && y < hauteur && est(y * largeur + x) }
  for (let j = 0; j < n; j++) {
    const t = (j + 0.5) / n * 2 * Math.PI - Math.PI, c = Math.cos(t), s = Math.sin(t)
    let depart = -1
    for (let r = (a.ri + a.ro) / 2, dr = 0; dr <= (a.ro - a.ri) / 2 + 1; dr += 0.5) {
      if (dans(r + dr, c, s)) { depart = r + dr; break }
      if (dans(r - dr, c, s)) { depart = r - dr; break }
    }
    if (depart < 0) continue
    lu[j] = 1
    let dernier = depart
    for (let r = depart; r <= a.ro + g; r += 0.5) { if (dans(r, c, s)) dernier = r; else if (r - dernier > trou && r > a.ro) break }
    rout[j] = dernier + 0.5
    let premier = depart
    for (let r = depart; r >= a.ri - g; r -= 0.5) { if (dans(r, c, s)) premier = r; else if (premier - r > trou && r < a.ri) break }
    rin[j] = premier - 0.5
  }
  const lisseIn = bordTendu(rin, tol), lisseOut = bordTendu(rout, tol)
  if (!lisseIn || !lisseOut) return null
  /* Là où l'anneau s'amincit jusqu'à rien (un bout effilé), il n'est plus. */
  for (let j = 0; j < n; j++) {
    if (lisseOut[j] - lisseIn[j] < 0.5) { const m = (lisseOut[j] + lisseIn[j]) / 2; lisseIn[j] = lisseOut[j] = m }
  }
  const points = r => Array.from(r, (v, j) => { const t = (j + 0.5) / n * 2 * Math.PI - Math.PI; return [a.cx + v * Math.cos(t), a.cy + v * Math.sin(t)] })
  return { n, rin: lisseIn, rout: lisseOut, lu, dedans: points(lisseIn), dehors: points(lisseOut) }
}

/* UN BORD TENDU : r(θ) = a₀ + Σ (aₖ cos kθ + bₖ sin kθ), k ≤ 8 — de quoi
   suivre un dessin qui change sur un huitième de tour, pas un grain d'un
   degré —, ajusté aux moindres carrés sur les angles lus. Trois passes
   mettent les écarts francs à part (un éclat, une encoche, une forme
   collée) ; une retenue qui croît comme k⁴ garde la courbe tendue là où
   rien n'est lu. Null si plus d'un angle lu sur trois reste franchement
   loin de la courbe : elle n'explique pas le bord. */
const HARMONIQUES = 8
function bordTendu(v, tol) {
  const n = v.length, K = HARMONIQUES, m = 2 * K + 1
  const lus = []
  for (let j = 0; j < n; j++) if (!Number.isNaN(v[j])) lus.push(j)
  if (lus.length < Math.max(3 * m, 0.25 * n)) return null
  const base = j => {
    const t = (j + 0.5) / n * 2 * Math.PI - Math.PI, f = new Float64Array(m)
    f[0] = 1
    for (let k = 1; k <= K; k++) { f[2 * k - 1] = Math.cos(k * t); f[2 * k] = Math.sin(k * t) }
    return f
  }
  const valeur = (coef, j) => { const f = base(j); let s = 0; for (let r = 0; r < m; r++) s += coef[r] * f[r]; return s }
  let gardes = lus, coef = null
  for (let passe = 0; passe < 3; passe++) {
    const A = Array.from({ length: m }, () => new Array(m).fill(0)), B = new Array(m).fill(0)
    for (const j of gardes) {
      const f = base(j)
      for (let r = 0; r < m; r++) { B[r] += f[r] * v[j]; for (let c = r; c < m; c++) A[r][c] += f[r] * f[c] }
    }
    for (let r = 0; r < m; r++) for (let c = 0; c < r; c++) A[r][c] = A[c][r]
    const retenue = 1e-4 * gardes.length
    for (let k = 1; k <= K; k++) { A[2 * k - 1][2 * k - 1] += retenue * k ** 4; A[2 * k][2 * k] += retenue * k ** 4 }
    coef = resoudre(A, B)
    if (!coef) return null
    const ecarts = lus.map(j => Math.abs(v[j] - valeur(coef, j)))
    const tries = gardes.map(j => Math.abs(v[j] - valeur(coef, j))).sort((x, y) => x - y)
    const seuil = Math.max(1.5 * tol, 3 * 1.4826 * tries[tries.length >> 1])
    gardes = lus.filter((_, i) => ecarts[i] <= seuil)
  }
  let loin = 0
  for (const j of lus) if (Math.abs(v[j] - valeur(coef, j)) > 3 * tol) loin++
  if (loin > lus.length / 3) return null
  return Float64Array.from({ length: n }, (_, j) => valeur(coef, j))
}

/* LE CERCLE D'UN BORD d'anneau et son écart (le 90e centile, en pixels). */
function cercleDe(pts) {
  const c = cercle(pts)
  if (!c) return null
  const e = pts.map(p => Math.abs(Math.hypot(p[0] - c.cx, p[1] - c.cy) - c.r)).sort((x, y) => x - y)
  return { c, p90: e[Math.floor(e.length * 0.9)] }
}

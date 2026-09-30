/* ================================================================ LES POLICES
   29 septembre 2026 : « quand on a ce genre de résultat il faudrait
   réécrire directement les lettres avec une police équivalente, comme tu
   es capable facilement de reconnaître les lettres ». Un petit texte tracé
   depuis un JPEG garde toujours un peu de son flou : un « d » qui ondule, un
   « t » un peu gras. Le graphiste, lui, reconnaît la police et la retape.
   Ici, sur le poste :
   1. le texte est lu (l'OCR, lib/lecture.js) : ses lignes, ses lettres ;
   2. chaque lettre lue est rapprochée de sa forme dans le logo (`glyphesObserves`) ;
   3. chaque police de la bibliothèque (vendor/polices/, des polices libres)
      pose ces mêmes lettres, à la taille et sur la ligne de base que le
      logo impose (`ajuster`), chacune à la place de la sienne — l'espacement
      du logo est gardé ; la police dont les lettres recouvrent le mieux
      celles du logo gagne (`noter`) ;
   4. assez ressemblante, elle remplace les lettres tracées : de vraies
      lettres, les contours de la police (`glyphesSvg`).
   Rien ici ne dépend du navigateur : les polices arrivent déjà lues
   (opentype.js), les formes en masques de pixels. */

/* ---------------------------------------------------------- LE TRACÉ D'UN GLYPHE
   Les commandes d'un chemin (M, L, Q, C, Z : celles d'opentype.js, y vers
   le bas) en polygones, chaque courbe coupée en segments d'un pixel et
   demi au plus (entre 2 et `pas`). */
export function polygones(commandes, pas = 12) {
  const polys = []
  let cour = null, x = 0, y = 0
  const n = l => Math.max(2, Math.min(pas, Math.ceil(l / 1.5)))
  for (const c of commandes) {
    if (c.type === 'M') { if (cour && cour.length > 2) polys.push(cour); cour = [[c.x, c.y]]; x = c.x; y = c.y }
    else if (c.type === 'L') { cour.push([c.x, c.y]); x = c.x; y = c.y }
    else if (c.type === 'Q') {
      const k = n(Math.hypot(c.x1 - x, c.y1 - y) + Math.hypot(c.x - c.x1, c.y - c.y1))
      for (let i = 1; i <= k; i++) {
        const t = i / k, u = 1 - t
        cour.push([u * u * x + 2 * u * t * c.x1 + t * t * c.x, u * u * y + 2 * u * t * c.y1 + t * t * c.y])
      }
      x = c.x; y = c.y
    } else if (c.type === 'C') {
      const k = n(Math.hypot(c.x1 - x, c.y1 - y) + Math.hypot(c.x2 - c.x1, c.y2 - c.y1) + Math.hypot(c.x - c.x2, c.y - c.y2))
      for (let i = 1; i <= k; i++) {
        const t = i / k, u = 1 - t
        cour.push([u * u * u * x + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x, u * u * u * y + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y])
      }
      x = c.x; y = c.y
    } else if (c.type === 'Z') { if (cour && cour.length > 2) polys.push(cour); cour = null }
  }
  if (cour && cour.length > 2) polys.push(cour)
  return polys
}

/* LE MASQUE DE POLYGONES sur une grille `l` × `h` dont le coin est
   (`x0`, `y0`) : 1 là où le centre du pixel est dedans (règle du nombre
   d'enroulements non nul, celle des polices). Chaque arête ne visite que
   les rangées qu'elle traverse ; les croisements d'une rangée se trient
   sur place. */
export function remplir(polys, x0, y0, l, h) {
  const m = new Uint8Array(l * h)
  const compte = new Int32Array(h + 1)
  let total = 0
  const rangees = (ay, by) => [Math.max(0, Math.ceil(ay - y0 - 0.5)), Math.min(h - 1, Math.ceil(by - y0 - 0.5) - 1)]
  for (const p of polys) {
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const ay = Math.min(p[j][1], p[i][1]), by = Math.max(p[j][1], p[i][1])
      if (ay === by) continue
      const [r0, r1] = rangees(ay, by)
      for (let r = r0; r <= r1; r++) { compte[r]++; total++ }
    }
  }
  if (!total) return m
  const debut = new Int32Array(h + 1)
  for (let r = 0; r < h; r++) debut[r + 1] = debut[r] + compte[r]
  const xs = new Float64Array(total), ss = new Int8Array(total), rempli = new Int32Array(h)
  for (const p of polys) {
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      let ax = p[j][0], ay = p[j][1], bx = p[i][0], by = p[i][1], s = 1
      if (ay === by) continue
      if (ay > by) { [ax, bx] = [bx, ax]; [ay, by] = [by, ay]; s = -1 }
      const [r0, r1] = rangees(ay, by)
      const pente = (bx - ax) / (by - ay)
      for (let r = r0; r <= r1; r++) {
        const k = debut[r] + rempli[r]++
        xs[k] = ax + (y0 + r + 0.5 - ay) * pente
        ss[k] = s
      }
    }
  }
  for (let r = 0; r < h; r++) {
    const a = debut[r], b = debut[r + 1]
    if (b - a < 2) continue
    for (let i = a + 1; i < b; i++) {
      const x = xs[i], s = ss[i]
      let j = i - 1
      while (j >= a && xs[j] > x) { xs[j + 1] = xs[j]; ss[j + 1] = ss[j]; j-- }
      xs[j + 1] = x; ss[j + 1] = s
    }
    let w = 0
    for (let k = a; k < b - 1; k++) {
      w += ss[k]
      if (!w) continue
      const c0 = Math.max(0, Math.ceil(xs[k] - x0 - 0.5)), c1 = Math.min(l - 1, Math.floor(xs[k + 1] - x0 - 0.5))
      for (let c = c0; c <= c1; c++) m[r * l + c] = 1
    }
  }
  return m
}

/* ------------------------------------------------------------- L'AJUSTEMENT
   Les lettres observées d'une ligne (`glyphes` : { c, x0, y0, x1, y1 },
   leur cadre d'encre, en pixels, y vers le bas) et une police : l'échelle
   (pixels par unité de la police) et la ligne de base qui posent le mieux
   ses lettres sur celles du logo — le haut et le bas de chaque cadre, aux
   moindres carrés, les écarts trop grands écartés (une lettre mal lue).
   Rend { echelle, base, poses : [{ glyphe, x }] } ou null. */
export function ajuster(glyphes, police, boite = null) {
  const eq = []
  const poses = []
  for (const g of glyphes) {
    if (g.ponctuation) { poses.push(null); continue }
    /* `boite` : les cadres des lettres sans lire la police (le catalogue,
       `boites`) — l'échelle et la ligne de base seules. */
    const gl = boite ? null : police.charToGlyph(g.c)
    if (!boite && (!gl || !gl.index)) { poses.push(null); continue }
    const b = boite ? boite(g.c) : gl.getBoundingBox()
    if (!b || !(b.y2 > b.y1)) { poses.push(null); continue }
    poses.push({ gl, b })
    /* bas = base − s·y1 ; haut = base − s·y2 (y de la police vers le haut ;
       le bas de l'encre est sous sa dernière rangée de pixels). */
    eq.push([1, -b.y1, g.y1 + 1], [1, -b.y2, g.y0])
  }
  if (eq.length < 2) return null
  let actifs = eq.map(() => true), base = 0, s = 0
  for (let tour = 0; tour < 3; tour++) {
    let n = 0, sa = 0, sb = 0, sab = 0, sbb = 0, sy = 0, sby = 0
    eq.forEach(([a, b, y], i) => { if (!actifs[i]) return; n++; sb += b; sbb += b * b; sy += y; sby += b * y; sa += a; sab += a * b })
    const det = n * sbb - sb * sb
    if (n < 2 || Math.abs(det) < 1e-9) return null
    s = (n * sby - sb * sy) / det
    base = (sy - s * sb) / n
    const res = eq.map(([, b, y]) => Math.abs(base + s * b - y))
    const tri = res.filter((_, i) => actifs[i]).sort((u, v) => u - v)
    const lim = Math.max(1.5, 3 * tri[tri.length >> 1])
    actifs = res.map(r => r <= lim)
  }
  if (!(s > 0)) return null
  if (boite) {
    let r = 0, n = 0
    eq.forEach(([, b, y], i) => { if (actifs[i]) { r += Math.abs(base + s * b - y); n++ } })
    return { echelle: s, base, residu: n ? r / n : 0 }
  }
  return {
    echelle: s, base,
    poses: glyphes.map((g, i) => {
      const p = poses[i]
      if (!p) return null
      /* Au centre de la lettre du logo : son espacement est gardé. Le
         centre de son encre (`cx`) quand on l'a — plus sûr que le milieu
         de son cadre, qu'un empattement ou un accent décentre. */
      if (g.cx !== undefined) {
        const polys = polygones(p.gl.getPath(0, base, s * police.unitsPerEm).commands)
        const c = centre(polys)
        if (c) return { gl: p.gl, x: g.cx - c }
      }
      return { gl: p.gl, x: (g.x0 + g.x1 + 1) / 2 - s * (p.b.x1 + p.b.x2) / 2 }
    }),
  }
}

/* LE CENTRE D'ENCRE (en x) de polygones remplis — l'abscisse du centre de
   gravité de leur aire, enroulements compris. */
export function centre(polys) {
  let a = 0, cx = 0
  for (const p of polys) {
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const cr = p[j][0] * p[i][1] - p[i][0] * p[j][1]
      a += cr
      cx += (p[j][0] + p[i][0]) * cr
    }
  }
  return Math.abs(a) > 1e-9 ? cx / (3 * a) : null
}

/* LE CHEMIN D'UN GLYPHE POSÉ, en commandes (y vers le bas). */
export function cheminPose(pose, echelle, base, police) {
  return pose.gl.getPath(pose.x, base + (pose.dy || 0), echelle * police.unitsPerEm).commands
}

/* Les décalages essayés, en pixels : chaque lettre du logo a pu grossir ou
   glisser d'un demi-pixel au tracé. */
const DECALAGES = [-1, -0.5, 0, 0.5, 1]

/* ------------------------------------------------------------------ LA NOTE
   Ce que les lettres de la police recouvrent de celles du logo : pour
   moitié leurs pixels communs sur leurs pixels réunis (la ligne entière),
   pour moitié ce que chacune couvre de l'autre à un pixel près, chaque lettre
   décalée d'un pixel au plus, par demi-pixels, pour s'y poser au mieux — et
   posée là. `glyphes` : les
   lettres observées, chacune avec son masque (`masque`, sur son cadre
   élargi `mx0`, `my0`, `ml`, `mh`). Rend { note, echelle, base, poses }. */
let autour = new Uint8Array(0)
/* UNE LETTRE POSÉE (`pose`, à `echelle` et `base`) CONTRE LA SIENNE
   (`g`) : la meilleure de ses places à un pixel près (par demi-pixels,
   `decaler`). Rend { note, ii, u, f, dx, dy, obs }. */
export function noterLettre(g, pose, echelle, base, police, decaler = true) {
  let obs = 0
  for (const v of g.masque) obs += v
  const polys = polygones(cheminPose(pose, echelle, base, police))
  const dil = g.dilate || (g.dilate = dilater(g.masque, g.ml, g.mh))
  let meilleur = null
  for (const dx of decaler ? DECALAGES : [0]) {
    for (const dy of decaler ? DECALAGES : [0]) {
      const m = remplir(polys, g.mx0 - dx, g.my0 - dy, g.ml, g.mh)
      let ii = 0, pp = 0, pres = 0, vus = 0
      if (autour.length < m.length) autour = new Uint8Array(m.length * 2)
      const dm = dilater(m, g.ml, g.mh, autour)
      for (let k = 0; k < m.length; k++) {
        pp += m[k]
        if (m[k] && g.masque[k]) ii++
        if (m[k] && dil[k]) pres++
        if (g.masque[k] && dm[k]) vus++
      }
      /* Deux mesures : les pixels communs sur les pixels réunis (la
         forme exacte), et, à un pixel près, ce que chacune couvre de
         l'autre (un trait fin décalé d'un pixel n'est pas faux). */
      const u = obs + pp - ii
      const f = pp && obs ? 2 * (pres / pp) * (vus / obs) / ((pres / pp) + (vus / obs) || 1) : 0
      const note = u ? 0.5 * (ii / u) + 0.5 * f : 0
      if (!meilleur || note > meilleur.note) meilleur = { ii, u, dx, dy, note, f, obs }
    }
  }
  return meilleur
}

export function noter(glyphes, police, { decaler = true } = {}) {
  const a = ajuster(glyphes, police)
  if (!a) return { note: 0 }
  let inter = 0, union = 0, manquants = 0, tol = 0, total = 0
  const decalages = [], notes = []
  glyphes.forEach((g, i) => {
    const p = a.poses[i]
    if (g.ponctuation) return
    if (!p) {
      let obs = 0
      for (const v of g.masque) obs += v
      union += obs; total += obs; manquants++; notes.push(0)
      return
    }
    const meilleur = noterLettre(g, p, a.echelle, a.base, police, decaler)
    inter += meilleur.ii
    union += meilleur.u
    tol += meilleur.f * meilleur.obs
    total += meilleur.obs
    notes.push(meilleur.note)
    decalages.push([meilleur.dx, meilleur.dy])
    /* La lettre se pose là où elle recouvre le mieux la sienne. */
    a.poses[i] = { gl: p.gl, x: p.x + meilleur.dx, dy: meilleur.dy }
  })
  /* `notes` : chaque lettre (hors ponctuation) ; `pire` : la moins
     ressemblante — une seule lettre mal lue (un « J » pour un « d ») et la
     ligne n'est plus sûre. */
  return { note: union ? 0.5 * inter / union + 0.5 * (total ? tol / total : 0) : 0, recouvre: union ? inter / union : 0, manquants, echelle: a.echelle, base: a.base, poses: a.poses, decalages, notes, pire: notes.length ? Math.min(...notes) : 0 }
}

/* LA LECTURE CORRIGÉE PAR LA POLICE (29 septembre 2026 : « tu es capable
   facilement de reconnaître les lettres »). L'OCR lit parfois un « J » pour
   un « d » abîmé. Chaque lettre qui ressemble mal à la sienne (sous
   `seuil`) essaie, dans la police trouvée, les autres caractères de sa
   casse (`CANDIDATS`) posés à sa place ; si l'un colle nettement mieux (de
   `marge`), c'est lui — à moins que la ligne elle-même ne le démente
   (30 septembre 2026, « CARAÏBES » devenu « CRRRÏBES ») : la lettre a la
   forme d'une autre lue comme elle, ou les lettres de la ligne lues comme
   le nouveau caractère ont une autre forme. Rend les lettres (corrigées) et
   le nombre de corrections. */
export const CANDIDATS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789àâçéèêëîïôùûü&'
const casse = c => /\p{Lu}/u.test(c) ? 'M' : /\p{Ll}/u.test(c) ? 'm' : 'x'
export function corriger(glyphes, police, { seuil = 0.75, marge = 0.08 } = {}) {
  const r = noter(glyphes, police, { decaler: false })
  if (!r.poses) return { glyphes, corrections: 0 }
  let k = 0
  const nouveaux = glyphes.map(g => {
    if (g.ponctuation) return null
    const note = r.notes[k++]
    if (note >= seuil) return null
    let meilleur = { c: g.c, note }
    for (const c of CANDIDATS) {
      if (c === g.c || (casse(c) !== casse(g.c) && casse(c) !== 'x' && casse(g.c) !== 'x')) continue
      const gl = police.charToGlyph(c)
      if (!gl || !gl.index) continue
      const b = gl.getBoundingBox()
      const cx = g.cx !== undefined ? g.cx : (g.x0 + g.x1 + 1) / 2
      const polys = polygones(gl.getPath(0, r.base, r.echelle * police.unitsPerEm).commands)
      const x = cx - (centre(polys) ?? r.echelle * (b.x1 + b.x2) / 2)
      const n = noterLettre(g, { gl, x }, r.echelle, r.base, police, false).note
      if (n > meilleur.note) meilleur = { c, note: n }
    }
    return meilleur.c !== g.c && meilleur.note >= note + marge ? { c: meilleur.c, note: meilleur.note, avant: note } : null
  })
  let corrections = 0
  const sortie = glyphes.map((g, i) => {
    const n = nouveaux[i]
    if (!n) return g
    /* Deux lettres de la même forme, lues pareil : l'OCR est cohérent. */
    if (glyphes.some((h, j) => j !== i && !h.ponctuation && h.c === g.c && semblables(g, h) >= 0.8)) return g
    /* Les lettres de la ligne lues comme le nouveau caractère : elle doit
       être leur jumelle ; sans elles, coller nettement mieux. */
    const autres = glyphes.filter((h, j) => j !== i && !nouveaux[j] && !h.ponctuation && h.c === n.c)
    if (autres.length ? !autres.some(h => semblables(g, h) >= 0.9) : n.note < Math.max(seuil, n.avant + 2 * marge)) return g
    corrections++
    return Object.assign({}, g, { c: n.c, dilate: g.dilate })
  })
  return { glyphes: sortie, corrections }
}

/* DEUX LETTRES DE LA MÊME FORME ? Leurs masques ramenés à la même grille
   (leurs cadres), les pixels communs sur les pixels réunis ; 0 si leurs
   proportions diffèrent franchement. */
export function semblables(a, b, n = 32) {
  const la = a.x1 - a.x0 + 1, ha = a.y1 - a.y0 + 1, lb = b.x1 - b.x0 + 1, hb = b.y1 - b.y0 + 1
  if (Math.abs(Math.log((la / ha) / (lb / hb))) > 0.3) return 0
  const grille = g => {
    const l = g.x1 - g.x0 + 1, h = g.y1 - g.y0 + 1, m = new Uint8Array(n * n)
    for (let v = 0; v < n; v++) {
      for (let u = 0; u < n; u++) {
        const x = Math.floor(g.x0 + (u + 0.5) * l / n) - g.mx0, y = Math.floor(g.y0 + (v + 0.5) * h / n) - g.my0
        m[v * n + u] = x >= 0 && y >= 0 && x < g.ml && y < g.mh ? g.masque[y * g.ml + x] : 0
      }
    }
    return m
  }
  const A = grille(a), B = grille(b)
  let inter = 0, union = 0
  for (let q = 0; q < n * n; q++) { inter += A[q] & B[q]; union += A[q] | B[q] }
  return union ? inter / union : 0
}

/* LE CHEMIN SVG des lettres d'une police posées, à l'échelle `k` (des
   pixels de travail aux unités du SVG). */
export function glyphesSvg(poses, echelle, base, police, k = 1) {
  const f = v => { const r = Math.round(v * k * 100) / 100; return Object.is(r, -0) ? '0' : String(r) }
  let d = ''
  for (const p of poses) {
    if (!p) continue
    for (const c of cheminPose(p, echelle, base, police)) {
      if (c.type === 'M' || c.type === 'L') d += c.type + f(c.x) + ' ' + f(c.y)
      else if (c.type === 'Q') d += 'Q' + f(c.x1) + ' ' + f(c.y1) + ' ' + f(c.x) + ' ' + f(c.y)
      else if (c.type === 'C') d += 'C' + f(c.x1) + ' ' + f(c.y1) + ' ' + f(c.x2) + ' ' + f(c.y2) + ' ' + f(c.x) + ' ' + f(c.y)
      else if (c.type === 'Z') d += 'Z'
    }
  }
  return d
}

/* --------------------------------------------------- LES LETTRES DU LOGO
   L'OCR lit les lettres dans l'ordre, mais ses cadres sont approximatifs
   (le D d'« ORTHOPÉDIB » à cheval sur le I). Les formes d'encre de la ligne
   (`formes` : { x0, y0, x1, y1, n }, n pixels) se réunissent d'abord en
   lettres — l'accent, le point d'un i, posés au-dessus d'une forme plus
   grande, la rejoignent — puis se rangent de gauche à droite ; autant de
   lettres que de caractères lus : l'une pour l'autre, dans l'ordre. Sinon
   (deux lettres qui se touchent, une lettre cassée), chaque forme va au
   caractère dont le cadre la recouvre le plus. `symboles` : { c, x0, x1 }.
   Rend, pour chaque caractère, la liste des formes qui le font. */
export function associer(symboles, formes) {
  const lettres = reunir(formes)
  lettres.sort((a, b) => (a.x0 + a.x1) - (b.x0 + b.x1))
  if (lettres.length === symboles.length) return lettres.map(l => l.formes)
  const par = symboles.map(() => [])
  for (const f of formes) {
    let best = -1, bo = 0
    symboles.forEach((s, i) => { const o = Math.min(f.x1, s.x1) - Math.max(f.x0, s.x0); if (o > bo) { bo = o; best = i } })
    if (best < 0) { let dm = Infinity; symboles.forEach((s, i) => { const d = Math.abs(f.x0 + f.x1 - s.x0 - s.x1); if (d < dm) { dm = d; best = i } }) }
    par[best].push(f)
  }
  return par
}

/* ------------------------------------------------------------ LES LIGNES
   Les lettres du logo (`lettres` : { x0, y0, x1, y1 }, les formes d'encre
   déjà réunies à leurs accents — `reunir`) rangées en lignes de texte :
   1. deux lettres d'une même ligne se recouvrent en hauteur (la moitié de
      la plus petite), n'ont pas plus du double de hauteur l'une de
      l'autre, partagent leur ligne de base ou leur ligne de tête (à un
      quart de hauteur près), et ne sont pas plus loin que `ecart` fois leur
      hauteur (un texte espacé, « L A  P I S C I N E », en est à une fois) ;
   2. le point d'un i, l'accent rejoignent leur lettre ; la ponctuation —
      un point, une puce, un tiret, plus petits, mais pas une poussière
      (moins d'un huitième de la hauteur) — rejoint la ligne dans la bande
      de laquelle elle est posée, entre ses lettres ou tout contre ;
   3. deux morceaux d'une même bande (même hauteur, même ligne de base, à
      six hauteurs l'un de l'autre au plus) n'en font qu'un :
      « POOL • BAR • RESTAURANT ».
   Rend des lignes d'au moins `min` lettres, chacune de gauche à droite. */
export function lignes(lettres, { ecart = 2, min = 2 } = {}) {
  const ordre = lettres.map((_, i) => i).sort((a, b) => lettres[a].x0 - lettres[b].x0)
  const chef = lettres.map((_, i) => i)
  const trouver = i => { while (chef[i] !== i) i = chef[i] = chef[chef[i]]; return i }
  for (let u = 0; u < ordre.length; u++) {
    const A = lettres[ordre[u]], hA = A.y1 - A.y0 + 1
    for (let v = u + 1; v < ordre.length; v++) {
      const B = lettres[ordre[v]], hB = B.y1 - B.y0 + 1, h = Math.max(hA, hB)
      if (B.x0 - A.x1 > ecart * h) break
      if (h > 2 * Math.min(hA, hB) + 2) continue
      const commun = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0) + 1
      if (commun < 0.5 * Math.min(hA, hB)) continue
      /* Sur une même ligne de base (ou sous une même ligne de tête : un
         jambage, une capitale) : pas les morceaux d'un dessin. */
      const m = Math.min(hA, hB)
      if (Math.abs(A.y1 - B.y1) > 0.25 * m + 1 && Math.abs(A.y0 - B.y0) > 0.25 * m + 1) continue
      chef[trouver(ordre[v])] = trouver(ordre[u])
    }
  }
  const groupes0 = new Map()
  for (const i of ordre) {
    const g = trouver(i)
    if (!groupes0.has(g)) groupes0.set(g, [])
    groupes0.get(g).push(lettres[i])
  }
  /* UN ÉCART HORS DE PROPORTION coupe la ligne : les lettres d'un mot sont
     à un dixième de hauteur l'une de l'autre, un texte espacé à une
     hauteur ; un dessin posé à côté, bien plus loin que d'habitude (la main
     d'un personnage à gauche d'« ORTHOPÉDIB »). */
  const groupes = new Map()
  let ng = 0
  for (const l of groupes0.values()) {
    const h = mediane(l.map(x => x.y1 - x.y0 + 1))
    const ecarts = []
    for (let i = 1; i < l.length; i++) ecarts.push(Math.max(0, l[i].x0 - Math.max(...l.slice(0, i).map(x => x.x1))))
    const limite = Math.max(1.2 * h, 4 * (ecarts.length ? mediane(ecarts) : 0))
    let cour = [l[0]]
    for (let i = 1; i < l.length; i++) {
      if (ecarts[i - 1] > limite) { groupes.set(ng++, cour); cour = [] }
      cour.push(l[i])
    }
    groupes.set(ng++, cour)
  }
  const cadre = l => ({ x0: Math.min(...l.map(x => x.x0)), x1: Math.max(...l.map(x => x.x1)), y0: mediane(l.map(x => x.y0)), y1: mediane(l.map(x => x.y1)), h: mediane(l.map(x => x.y1 - x.y0 + 1)) })
  let liste = [...groupes.values()]
  const grandes = liste.filter(l => l.length >= min)
  /* 2a. LE POINT D'UN I, L'ACCENT, posés au-dessus d'une lettre de la ligne
     (dans la hauteur des capitales) : ils rejoignent cette lettre — un i
     avec son point, pas un i et une ponctuation (29 septembre 2026 : le
     point à part, le i se lisait « t », « pieds » devenait « pteds »). */
  for (const seule of liste.filter(l => l.length === 1)) {
    const x = seule[0], hx = x.y1 - x.y0 + 1, lx = x.x1 - x.x0 + 1
    if (enRangee(x, lettres)) continue
    for (const l of grandes) {
      const c = cadre(l)
      if (hx > 0.45 * c.h || x.y1 > c.y1 - 0.25 * c.h || x.y0 < Math.min(...l.map(u => u.y0)) - 0.5 * c.h) continue
      /* Pas bien plus large que sa lettre — une apostrophe près d'un « l »
         fin, oui ; un filet posé au-dessus du texte n'est l'accent de
         personne. */
      const lettre = l.find(u => {
        const recouvre = Math.min(u.x1, x.x1) - Math.max(u.x0, x.x0) + 1
        return lx <= Math.max(1.5 * (u.x1 - u.x0 + 1), 0.5 * c.h) && recouvre >= 0.4 * Math.min(lx, u.x1 - u.x0 + 1) && u.y0 >= x.y1 - 0.15 * c.h && u.y0 - x.y1 <= 0.45 * c.h
      })
      if (!lettre) continue
      lettre.formes.push(...x.formes)
      lettre.x0 = Math.min(lettre.x0, x.x0); lettre.x1 = Math.max(lettre.x1, x.x1); lettre.y0 = Math.min(lettre.y0, x.y0)
      x.fondu = true
      break
    }
  }
  liste = liste.filter(l => !(l.length === 1 && l[0].fondu))
  /* 2b. La ponctuation : une lettre seule, petite, dans la bande d'une ligne. */
  for (const seule of liste.filter(l => l.length === 1)) {
    const x = seule[0], hx = x.y1 - x.y0 + 1
    const hote = grandes.find(l => {
      const c = cadre(l)
      return hx < 0.7 * c.h && Math.max(hx, x.x1 - x.x0 + 1) >= 0.12 * c.h && x.y0 >= c.y0 - 0.2 * c.h && x.y1 <= c.y1 + 0.35 * c.h && x.x0 >= c.x0 - 1.2 * c.h && x.x1 <= c.x1 + 1.2 * c.h
    })
    if (hote) { hote.push(x); x.ponctuation = true }
  }
  liste = grandes.map(l => l.sort((u, v) => u.x0 - v.x0))
  /* 3. Les morceaux d'une même bande. */
  for (let fusion = true; fusion;) {
    fusion = false
    for (let i = 0; i < liste.length && !fusion; i++) {
      for (let j = i + 1; j < liste.length && !fusion; j++) {
        const a = cadre(liste[i]), b = cadre(liste[j])
        const commun = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) + 1
        const loin = Math.max(b.x0 - a.x1, a.x0 - b.x1)
        const base = Math.abs(a.y1 - b.y1) <= 0.25 * Math.min(a.h, b.h) + 1
        if (Math.abs(a.h - b.h) <= 0.25 * Math.max(a.h, b.h) + 1 && commun >= 0.6 * Math.min(a.h, b.h) && base && loin <= 6 * Math.max(a.h, b.h)) {
          liste[i] = liste[i].concat(liste[j]).sort((u, v) => u.x0 - v.x0)
          liste.splice(j, 1)
          fusion = true
        }
      }
    }
  }
  return liste
}

const mediane = v => { const t = v.slice().sort((a, b) => a - b); return t[t.length >> 1] }

/* LES FORMES RÉUNIES EN LETTRES : l'accent, le point d'un i, posés juste
   au-dessus d'une forme plus grande (moins d'un quart de sa hauteur plus
   haut, moins de la moitié de sa taille), la rejoignent — pas un petit
   texte posé au-dessus d'une grande lettre de script. `formes` : { x0, y0,
   x1, y1 }. Rend { formes, x0, y0, x1, y1 }. */
/* UNE PETITE FORME AU MILIEU D'UNE RANGÉE de lettres à peine plus grandes
   qu'elle (`toutes`), de part et d'autre : c'est une puce de cette rangée,
   pas l'accent ni le point de la grande lettre dessous (30 septembre
   2026 : la puce de « BAR • RESTAURANT » partait avec le M de « St
   Martin », juste dessous). */
function enRangee(f, toutes) {
  const h = f.y1 - f.y0 + 1, cy = (f.y0 + f.y1) / 2
  let gauche = false, droite = false
  for (const g of toutes) {
    if (g === f || g.y0 > cy || g.y1 < cy || g.y1 - g.y0 + 1 > 4 * h || g.y1 - g.y0 + 1 < h) continue
    if (g.x1 < f.x0 && f.x0 - g.x1 <= 8 * h) gauche = true
    if (g.x0 > f.x1 && g.x0 - f.x1 <= 8 * h) droite = true
  }
  return gauche && droite
}
export function reunir(formes) {
  const grandes = formes.slice().sort((a, b) => (b.y1 - b.y0) - (a.y1 - a.y0))
  const lettres = []
  for (const f of grandes) {
    const h = f.y1 - f.y0 + 1
    const base = !enRangee(f, formes) && lettres.find(l => {
      const hl = l.y1 - l.y0 + 1
      const recouvre = Math.min(l.x1, f.x1) - Math.max(l.x0, f.x0) + 1
      return h <= 0.45 * hl && f.x1 - f.x0 <= 1.2 * (l.x1 - l.x0 + 1) && recouvre >= 0.4 * Math.min(f.x1 - f.x0 + 1, l.x1 - l.x0 + 1) && f.y1 <= l.y0 + 0.35 * hl && l.y0 - f.y1 <= Math.max(3, hl * 0.22)
    })
    if (base) { base.formes.push(f); base.x0 = Math.min(base.x0, f.x0); base.x1 = Math.max(base.x1, f.x1); base.y0 = Math.min(base.y0, f.y0); continue }
    lettres.push({ formes: [f], x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1 })
  }
  return lettres
}

/* ------------------------------------------------------------- LA GRAISSE
   L'épaisseur moyenne du trait d'un masque : deux fois son aire sur son
   pourtour (compté en arêtes de pixels). */
export function epaisseur(masque, l, h) {
  let a = 0, p = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      const v = masque[y * l + x]
      a += v
      if (x < l - 1 ? v !== masque[y * l + x + 1] : v) p++
      if (x === 0 && v) p++
      if (y < h - 1 ? v !== masque[(y + 1) * l + x] : v) p++
      if (y === 0 && v) p++
    }
  }
  return p ? 2 * a / p : 0
}

/* LA GRAISSE D'UNE POLICE, mesurée comme celle du logo : l'épaisseur du
   trait de « nHoae » posés à 100 pixels de hauteur de capitale, rapportée à
   cette hauteur ; et sa hauteur de capitale (celle du H), en unités. */
export const TEMOIN = 'nHoae'
export function graissePolice(police) {
  const H = police.charToGlyph('H')
  const bH = H && H.index ? H.getBoundingBox() : null
  const cap = bH && bH.y2 > bH.y1 ? bH.y2 - bH.y1 : police.unitsPerEm * 0.7
  const s = 100 / cap
  let a = 0, p = 0, x = 0
  for (const c of TEMOIN) {
    const g = police.charToGlyph(c)
    if (!g || !g.index) continue
    const b = g.getBoundingBox()
    const polys = polygones(g.getPath(x - b.x1 * s + 4, 120, s * police.unitsPerEm).commands)
    const l = Math.ceil((b.x2 - b.x1) * s) + 8, h = 180
    const m = remplir(polys, x, 0, l, h)
    const e = epaisseur(m, l, h)
    let n = 0
    for (const v of m) n += v
    a += n
    p += e ? 2 * n / e : 0
    x += l
  }
  return { e: p ? 2 * a / p / 100 : 0, cap }
}

/* LES CADRES D'ENCRE d'une police pour les caractères du catalogue
   (`CARACTERES`), en unités : { c: [y1, y2] } — de quoi caler une ligne
   sans lire la police (`ajuster` avec `boite`). */
export const CARACTERES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789àâäçéèêëîïôöùûüÿœæÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸŒÆ&’\'-.,!?@#/+:%€$'
export function boites(police) {
  const r = {}
  for (const c of CARACTERES) {
    const g = police.charToGlyph(c)
    if (!g || !g.index) continue
    const b = g.getBoundingBox()
    if (b.y2 > b.y1) r[c] = [Math.round(b.y1), Math.round(b.y2)]
  }
  return r
}

/* LE MASQUE ÉLARGI d'un pixel (les huit voisins) : en largeur, puis en
   hauteur. `sortie` : un tableau à réutiliser, s'il y en a un. */
let tampon = new Uint8Array(0)
export function dilater(m, l, h, sortie = null) {
  const n = l * h
  if (tampon.length < n) tampon = new Uint8Array(n * 2)
  const t = tampon, d = sortie && sortie.length >= n ? sortie : new Uint8Array(n)
  for (let y = 0; y < h; y++) {
    const o = y * l
    for (let x = 0; x < l; x++) t[o + x] = m[o + x] | (x > 0 ? m[o + x - 1] : 0) | (x < l - 1 ? m[o + x + 1] : 0)
  }
  for (let x = 0; x < l; x++) d[x] = t[x] | (h > 1 ? t[l + x] : 0)
  for (let y = 1; y < h - 1; y++) { const o = y * l; for (let x = 0; x < l; x++) d[o + x] = t[o + x] | t[o - l + x] | t[o + l + x] }
  if (h > 1) { const o = (h - 1) * l; for (let x = 0; x < l; x++) d[o + x] = t[o + x] | t[o - l + x] }
  return d
}

/* LES LETTRES RAMENÉES À `f` (moins de 1) : les comparer à 32 pixels de
   haut suffit à reconnaître une police, et coûte seize fois moins qu'à
   130. Chaque pixel réduit est plein quand la moitié de ce qu'il couvre
   l'est. */
export function reduireGlyphes(glyphes, f) {
  if (f >= 1) return glyphes
  return glyphes.map(g => {
    const mx0 = Math.floor(g.mx0 * f), my0 = Math.floor(g.my0 * f)
    const ml = Math.ceil((g.mx0 + g.ml) * f) - mx0, mh = Math.ceil((g.my0 + g.mh) * f) - my0
    const somme = new Float32Array(ml * mh), aire = new Float32Array(ml * mh)
    for (let y = 0; y < g.mh; y++) {
      const Y = Math.min(mh - 1, Math.floor((g.my0 + y + 0.5) * f) - my0)
      for (let x = 0; x < g.ml; x++) {
        const X = Math.min(ml - 1, Math.floor((g.mx0 + x + 0.5) * f) - mx0), k = Y * ml + X
        aire[k]++
        somme[k] += g.masque[y * g.ml + x]
      }
    }
    const masque = new Uint8Array(ml * mh)
    for (let k = 0; k < masque.length; k++) masque[k] = aire[k] && somme[k] >= 0.5 * aire[k] ? 1 : 0
    return { c: g.c, x0: g.x0 * f, y0: g.y0 * f, x1: (g.x1 + 1) * f - 1, y1: (g.y1 + 1) * f - 1, mx0, my0, ml, mh, masque, cx: g.cx === undefined ? undefined : g.cx * f }
  })
}

/* LE CARACTÈRE LU, remis d'aplomb : l'OCR lit parfois un l en barre, une
   apostrophe droite pour la courbe des polices. `ponctuation` : ce qui
   n'est ni lettre, ni chiffre, ni ponctuation ordinaire (une puce, lue
   « * » ou « « ») — gardé tel qu'il est tracé, sans se juger. */
export function caractere(c) {
  if (c === '|') return 'l'
  if (c === "'" || c === '`' || c === '‘') return '’'
  return c
}
export const ponctuation = c => !/[\p{L}\p{N}&’.,:!?\-]/u.test(c)

/* ------------------------------------------------------------- LE CHOIX
   LES FAMILLES DE L'INDEX (vendor/polices/index.json, outils/index-polices.mjs) :
   pour chaque famille et chaque style, de quoi la caler sans la lire — les
   cadres d'encre de ses lettres (`boite`) dans sa graisse la plus proche du
   Regular, la hauteur de sa capitale — et ses fichiers : graisse,
   épaisseur du trait (`e`), chasse (`w`). */
export function famillesDe(index) {
  const pos = new Map([...index.caracteres].map((c, i) => [c, i]))
  const sortie = []
  for (const f of index.familles) {
    for (const [style, d] of Object.entries(f.styles)) {
      sortie.push({
        cle: f.id + '|' + style, id: f.id, nom: f.nom, cat: f.cat, style, cap: d.cap,
        boite: c => {
          const i = pos.get(c)
          if (i === undefined || d.boites[4 * i] === null) return null
          return { x1: d.boites[4 * i], y1: d.boites[4 * i + 1], x2: d.boites[4 * i + 2], y2: d.boites[4 * i + 3] }
        },
        fichiers: d.fichiers.map(([graisse, e, w]) => ({ id: f.id, nom: f.nom, style, graisse, e, w })),
        /* Une écriture manuscrite : l'avance de chaque lettre, l'espace, son
           inclinaison (lib/ecriture.js). */
        avance: d.av ? c => { const i = pos.get(c); return i === undefined || d.av[i] === null ? null : d.av[i] } : null,
        espace: d.esp, pente: d.pente,
      })
    }
  }
  return sortie
}

/* LES POLICES CONNUES : celles que les graphistes (et les logos des
   clients) prennent le plus. À ressemblance presque égale, l'une d'elles
   passe devant une police rare qui lui ressemble (Montserrat avant une
   cousine sortie l'an dernier). */
export const CONNUES = new Set(('roboto open-sans montserrat lato poppins inter roboto-condensed oswald raleway nunito playfair-display merriweather rubik ubuntu '
  + 'noto-sans pt-sans lora work-sans mulish fira-sans quicksand barlow kanit manrope heebo ibm-plex-sans titillium-web libre-franklin josefin-sans '
  + 'dm-sans bebas-neue anton libre-baskerville source-sans-3 nunito-sans karla arimo cabin dosis jost outfit archivo hind oxygen dancing-script '
  + 'pacifico lobster great-vibes cinzel abril-fatface caveat satisfy cormorant-garamond eb-garamond crimson-text bitter exo-2 prompt teko '
  + 'varela-round comfortaa righteous permanent-marker shadows-into-light indie-flower amatic-sc fredoka baloo-2 sora lexend plus-jakarta-sans '
  + 'space-grotesk red-hat-display urbanist figtree assistant signika asap overpass questrial archivo-black alfa-slab-one russo-one orbitron '
  + 'staatliches bungee kaushan-script sacramento allura yellowtail cookie parisienne alex-brush league-spartan barlow-condensed roboto-slab '
  + 'zilla-slab arvo tinos didact-gothic tenor-sans marcellus prata bodoni-moda yeseva-one dm-serif-display cormorant fjalla-one passion-one '
  + 'lilita-one luckiest-guy titan-one bangers black-ops-one audiowide michroma syncopate poiret-one julius-sans-one gruppo lobster-two '
  + 'courgette playball pinyon-script tangerine italianno mr-dafoe homemade-apple rock-salt kalam handlee gloria-hallelujah '
  + 'architects-daughter chakra-petch saira-condensed big-shoulders-display philosopher spectral ibm-plex-serif source-serif-4 noto-serif '
  + 'montserrat-alternates nunito work-sans kumbh-sans mukta rajdhani cairo tajawal exo maven-pro catamaran sen gilda-display').split(' '))
const BONUS_CONNUE = 0.006

/* LA POLICE D'UNE LIGNE, et ses équivalents. `glyphes` : les lettres
   observées (en pleine taille) ; `familles` : `famillesDe(index)` ;
   `charger(fichier)` : la police lue (une promesse ; null si elle manque).
   0. LE TRI SUR L'INDEX, sans rien charger : chaque famille calée sur les
      lettres, dans la graisse dont le trait a l'épaisseur de celui du
      logo ; ses lettres ont-elles la largeur de celles du logo ? Les
      `tri` meilleures passent ;
   1. LEUR DESSIN : chacune posée sur les lettres réduites à 32 pixels ;
   2. LES GRAISSES des 2 `n` + 2 meilleures familles, toutes essayées ;
   3. LES PROPOSITIONS : la meilleure graisse des `n` + 3 meilleures,
      affinée (décalages d'un demi-pixel) ; les `n` premières restent, la
      première posée en pleine taille.
   Rend [{ fichier, police, note, echelle, base, poses }] du meilleur au
   moins bon. */
export async function choisirPolices(glyphes, familles, charger, { n = 5, tri = 80, hauteur = 32, relu = false } = {}) {
  const lettres = glyphes.filter(g => !g.ponctuation)
  /* Deux lettres ne disent pas une police (« AN », lu dans un dessin). */
  if (lettres.length < 3) return []
  const f = Math.min(1, hauteur / mediane(lettres.map(g => g.y1 - g.y0 + 1)))
  const petits = reduireGlyphes(glyphes, f)
  /* L'épaisseur du trait, lue en pleine taille (réduite, elle se sous-estime). */
  let A = 0, P = 0
  for (const g of glyphes) {
    if (g.ponctuation) continue
    const e = epaisseur(g.masque, g.ml, g.mh)
    let k = 0
    for (const v of g.masque) k += v
    A += k
    P += e ? 2 * k / e : 0
  }
  const eObs = (P ? 2 * A / P : 0) * f
  /* 0. Le tri sur l'index : chaque famille dans ses trois graisses les plus
     proches de celle du logo (le trait lu sur un tracé peut tromper d'un
     cran). */
  const tries = []
  for (const fam of familles) {
    const cal = ajuster(petits, null, fam.boite)
    if (!cal) continue
    const r = eObs / (cal.echelle * fam.cap)
    const proches = fam.fichiers.slice().sort((a, b) => Math.abs(a.e - r) - Math.abs(b.e - r)).slice(0, 3)
    let meilleur = null
    for (const fichier of proches) {
      let ecart = 0, k = 0
      for (const g of petits) {
        if (g.ponctuation) continue
        const b = fam.boite(g.c)
        if (!b || b.x2 <= b.x1) continue
        const attendu = cal.echelle * (b.x2 - b.x1) * (fichier.w || 1)
        ecart += Math.abs(Math.log((g.x1 - g.x0 + 1) / Math.max(0.5, attendu)))
        k++
      }
      if (!k) continue
      const e = ecart / k + cal.residu / (cal.echelle * fam.cap)
      if (!meilleur || e < meilleur.ecart) meilleur = { fam, fichiers: proches, ecart: e }
    }
    if (meilleur) tries.push(meilleur)
  }
  tries.sort((a, b) => a.ecart - b.ecart)
  /* 1. Leur dessin, dans ces trois graisses. */
  const etapeA = []
  await Promise.all(tries.slice(0, tri).map(async t => {
    let note = 0
    for (const fi of t.fichiers) {
      const police = await charger(fi)
      if (police) note = Math.max(note, noter(petits, police, { decaler: false }).note)
    }
    if (note) etapeA.push({ fam: t.fam, note: note + (CONNUES.has(t.fam.id) ? BONUS_CONNUE : 0) })
  }))
  etapeA.sort((a, b) => b.note - a.note)
  /* 2. et 3. */
  const props = []
  for (const { fam } of etapeA.slice(0, 2 * n + 2)) {
    let meilleur = null
    const polices = await Promise.all(fam.fichiers.map(async fi => ({ fi, police: await charger(fi) })))
    for (const { fi, police } of polices) {
      if (!police) continue
      const note = noter(petits, police, { decaler: false }).note
      if (!meilleur || note > meilleur.note) meilleur = { fichier: fi, police, note }
    }
    if (meilleur) props.push(meilleur)
  }
  /* Sans décalage, un demi-pixel d'écart brouille le classement : les
     meilleures sont toutes affinées avant d'être départagées. */
  props.sort((a, b) => b.note - a.note)
  props.splice(n + 3)
  for (let i = 0; i < props.length; i++) props[i] = { fichier: props[i].fichier, police: props[i].police, ...noter(petits, props[i].police) }
  const rang = p => p.note + (CONNUES.has(p.fichier.id) ? BONUS_CONNUE : 0)
  props.sort((a, b) => rang(b) - rang(a))
  /* Les jumelles (« Hind » et ses quatre versions pour d'autres écritures,
     le même dessin latin) ne comptent qu'une fois : la même note, la même
     graisse, les mêmes poses. */
  for (let i = props.length - 1; i > 0; i--) {
    if (props.slice(0, i).some(q => Math.abs(q.note - props[i].note) < 0.0005 && q.fichier.graisse === props[i].fichier.graisse && q.fichier.style === props[i].fichier.style)) props.splice(i, 1)
  }
  props.splice(n)
  if (!props.length) return props
  /* La lecture corrigée par la meilleure police : une lettre mal lue, et
     tout se refait avec la bonne (`lu` : le texte corrigé). */
  const c = corriger(petits, props[0].police)
  if (c.corrections && !relu) {
    const corrigees = glyphes.map((g, i) => Object.assign({}, g, { c: c.glyphes[i].c }))
    const refait = await choisirPolices(corrigees, familles, charger, { n, tri, hauteur, relu: true })
    const lu = corrigees.map(g => g.c).join('')
    return refait.map(p => Object.assign(p, { lu }))
  }
  props[0] = Object.assign({}, props[0], noter(glyphes, props[0].police), { note: props[0].note, pire: props[0].pire })
  return props
}

/* ------------------------------------------------- LES LIGNES DU TRACÉ
   Sur la couverture du dessin (`tout`, `largeur` × `hauteur`, pleine là où
   elle passe la moitié) : ses formes d'un seul tenant (huit voisins), les
   plus grandes mises à part (un dessin, un anneau : plus de 45 % de la
   hauteur ou de la moitié de la largeur), réunies en lettres et en lignes.
   Chaque lettre garde ses pixels (`pixels`, leurs indices). */
export function lignesTexte(tout, largeur, hauteur) {
  const n = largeur * hauteur
  const num = new Int32Array(n).fill(-1)
  const pile = new Int32Array(n)
  const formes = []
  for (let p0 = 0; p0 < n; p0++) {
    if (tout[p0] < 0.5 || num[p0] >= 0) continue
    const id = formes.length
    let q = 0, t = 0, x0 = largeur, y0 = hauteur, x1 = -1, y1 = -1
    num[p0] = id
    pile[q++] = p0
    while (t < q) {
      const p = pile[t++], x = p % largeur, y = (p - x) / largeur
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
      for (let dy = -1; dy <= 1; dy++) {
        const Y = y + dy
        if (Y < 0 || Y >= hauteur) continue
        for (let dx = -1; dx <= 1; dx++) {
          const X = x + dx
          if (X < 0 || X >= largeur) continue
          const v = Y * largeur + X
          if (tout[v] >= 0.5 && num[v] < 0) { num[v] = id; pile[q++] = v }
        }
      }
    }
    formes.push({ id, x0, y0, x1, y1, pixels: pile.slice(0, q) })
  }
  const petites = formes.filter(f => f.pixels.length >= 6 && f.y1 - f.y0 < 0.45 * hauteur && f.x1 - f.x0 < 0.5 * largeur)
  return lignes(reunir(petites)).map(l => {
    for (const x of l) x.pixels = x.formes.length === 1 ? x.formes[0].pixels : Int32Array.from(x.formes.flatMap(f => [...f.pixels]))
    return l
  })
}

/* L'IMAGE D'UNE LIGNE POUR LA LIRE : ses lettres en noir sur blanc,
   remises à 40 pixels de haut (la hauteur médiane de ses lettres), une
   marge autour. Rend { data (niveaux de gris), l, h, boite }. */
export function imageLigne(ligne, largeur) {
  const x0 = Math.min(...ligne.map(l => l.x0)), x1 = Math.max(...ligne.map(l => l.x1))
  const y0 = Math.min(...ligne.map(l => l.y0)), y1 = Math.max(...ligne.map(l => l.y1))
  const hm = mediane(ligne.map(l => l.y1 - l.y0 + 1))
  const f = 40 / hm, m = Math.round(0.5 * hm)
  const L = Math.max(8, Math.round((x1 - x0 + 1 + 2 * m) * f)), H = Math.max(8, Math.round((y1 - y0 + 1 + 2 * m) * f))
  const somme = new Float32Array(L * H), aire = new Float32Array(L * H)
  /* Chaque pixel du tracé verse son encre dans le pixel réduit où il tombe
     (ou dans chacun de ceux qu'il couvre, agrandi). */
  const encre = new Set()
  for (const l of ligne) for (const p of l.pixels) encre.add(p)
  const pas = Math.max(1, Math.ceil(f))
  for (let y = y0 - m; y <= y1 + m; y++) {
    for (let x = x0 - m; x <= x1 + m; x++) {
      const v = encre.has(y * largeur + x) ? 1 : 0
      for (let j = 0; j < pas; j++) {
        const Y = Math.floor(((y - y0 + m) + (j + 0.5) / pas) * f)
        if (Y < 0 || Y >= H) continue
        for (let i = 0; i < pas; i++) {
          const X = Math.floor(((x - x0 + m) + (i + 0.5) / pas) * f)
          if (X < 0 || X >= L) continue
          somme[Y * L + X] += v
          aire[Y * L + X]++
        }
      }
    }
  }
  const data = new Uint8Array(L * H)
  for (let k = 0; k < data.length; k++) data[k] = aire[k] ? Math.round(255 * (1 - somme[k] / aire[k])) : 255
  return { data, l: L, h: H, boite: cadreLigne(ligne) }
}

/* LE CADRE D'UNE LIGNE, [x0, y0, x1, y1] : la retrouver d'un tracé à
   l'autre (le lissage change, pas les lettres). */
export const cadreLigne = ligne => [Math.min(...ligne.map(l => l.x0)), Math.min(...ligne.map(l => l.y0)), Math.max(...ligne.map(l => l.x1)), Math.max(...ligne.map(l => l.y1))]
export function ligneDe(lignes, boite, pres = 3) {
  return lignes.find(l => cadreLigne(l).every((v, i) => Math.abs(v - boite[i]) <= pres)) || null
}

/* LES LETTRES OBSERVÉES D'UNE LIGNE LUE : autant de caractères (sans les
   espaces) que de lettres, l'un pour l'autre dans l'ordre — sinon null.
   Chaque lettre : son caractère, son cadre, son masque (sur son cadre
   élargi), le centre de son encre. */
export function glyphesDe(ligne, texte, largeur) {
  let cars = [...String(texte || '').replace(/\s+/g, '')]
  /* Une puce mal lue (« * », « ‘ » de trop) : sans la ponctuation, de part
     et d'autre, les lettres se comptent encore ; les puces gardent leur
     tracé. */
  if (cars.length !== ligne.length) {
    const lettres = cars.filter(c => !ponctuation(caractere(c)) && /[\p{L}\p{N}&]/u.test(c))
    const formes = ligne.filter(l => !l.ponctuation)
    if (lettres.length !== formes.length || !lettres.length) return null
    let k = 0
    cars = ligne.map(l => l.ponctuation ? '•' : lettres[k++])
  }
  const hm = mediane(ligne.map(l => l.y1 - l.y0 + 1))
  return ligne.map((l, i) => {
    const mm = Math.max(3, Math.round(0.15 * hm))
    const mx0 = l.x0 - mm, my0 = l.y0 - mm, ml = l.x1 - l.x0 + 1 + 2 * mm, mh = l.y1 - l.y0 + 1 + 2 * mm
    const masque = new Uint8Array(ml * mh)
    let sx = 0
    for (const p of l.pixels) {
      const x = p % largeur, y = (p - x) / largeur
      masque[(y - my0) * ml + (x - mx0)] = 1
      sx += x + 0.5
    }
    const c = caractere(cars[i])
    return { c, ponctuation: ponctuation(c), x0: l.x0, y0: l.y0, x1: l.x1, y1: l.y1, mx0, my0, ml, mh, masque, cx: sx / l.pixels.length, pixels: l.pixels }
  })
}

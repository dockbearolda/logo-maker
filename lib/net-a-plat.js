/* DES BORDS NETS POUR UN LOGO À PLAT (23 novembre 2026, « je ne comprends
   toujours pas pourquoi les lignes du logo refait via Logo maker sont aussi
   moches, floues et pixelisées : il faut de belles lignes » ; 27 novembre
   2026, « les contours doivent être parfaitement lisses, on fait du haut
   de gamme »).

   L'IA agrandit un JPEG de WhatsApp de 900 px : ses bords sortent mous, en
   aquarelle, un liseré pâle autour des traits foncés (le bloc du JPEG,
   agrandi), et `fidele` la tient à ce fichier. Un logo à plat n'a pourtant
   que quelques teintes, et chaque bord sépare deux d'entre elles. Alors :
   - chaque pixel se lit comme le mélange de ses deux teintes les plus
     proches (comme lib/reteindre.js) — sa part de chacune ;
   - un fichier qui n'est qu'un agrandissement au plus proche (chaque pixel
     en bloc, `pasDuFichier`) a des marches que l'IA recopie fidèlement :
     ses parts se moyennent LE LONG du bord (`leLong`), à l'échelle de son
     vrai pixel — la marche se fond, l'épaisseur et les coins restent ;
   - ces parts, teinte par teinte, sont lissées d'un flou léger (σ ≈ 0,25
     pixel du fichier reçu : le bruit du JPEG part, un trait d'un pixel du
     fichier reste) ;
   - chaque pixel prend la teinte qui l'emporte, et le bord se redessine à
     sa place exacte — là où les deux parts s'égalent —, anticrénelé : la
     part de sa surface de chaque côté (`couverture`, seize points).
   LE BORD DU VIDE (un logo détouré, son fond transparent) : l'opacité passe
   à l'IA comme une image grise et la couleur, posée sur du blanc, à part ;
   leurs bords sortaient en dents de scie, un liseré clair autour (sur un
   textile noir, il se voit), et rien ne les reprenait. L'opacité se
   redessine désormais comme une teinte — moyennée le long du bord, posée
   à sa place —, et les pixels du bord prennent les parts de l'encre
   voisine (`remplir`) : plus de blanc venu du fond. Seulement une opacité
   franche : un voile, une ombre douce gardent la leur (`voileOuVide`).
   Mesuré sur des logos nets réduits ×4 (le bord, en dB, contre l'original) :
   AVI détouré 24,1 → 36,4, Proof Studio 27,4 → 37,1, AVI sur blanc 28,1 →
   30,5, en JPEG 27,9 → 30,3.
   Les aplats sortent pleins, de la teinte du fichier ; les bords nets et
   doux à toutes les tailles. Des PIXELS, rien n'est tracé (Détouré et Image
   le gardent). Seulement si le logo est vraiment à plat : plus de 6 % de
   pixels loin de toute paire de teintes (une illustration, un dégradé, une
   photo), ou plus de 8 teintes, et rien ne change. */
import { paletteAuto } from './vectoriser.js'

const OPAQUE = 250
const LOIN = 56 * 56
export const HORS_MAX = 0.06
export const TEINTES_MAX = 8
export const DETAIL = 0.6

/* `source` : le fichier reçu ({ data, largeur, hauteur }), pour son pas. */
export function netAPlat(data, largeur, hauteur, { echelle = 4, palette, source } = {}) {
  const N = largeur * hauteur
  const pal = sansMelanges(palette && palette.length ? palette : paletteAuto(data)).slice(0, TEINTES_MAX + 1)
  if (pal.length < 2 || pal.length > TEINTES_MAX) return { change: false, raison: 'teintes', teintes: pal.length }
  const K = pal.length
  /* Les parts de chaque teinte (0 à 255), sur les pixels pleins. */
  const parts = Array.from({ length: K }, () => new Uint8ClampedArray(N))
  const memo = new Map()
  let opaques = 0, hors = 0
  for (let p = 0, i = 0; p < N; p++, i += 4) {
    if (data[i + 3] < OPAQUE) continue
    opaques++
    const cle = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]
    let m = memo.get(cle)
    if (m === undefined) memo.set(cle, m = melange(data[i], data[i + 1], data[i + 2], pal))
    if (m.loin) hors++
    parts[m.k1][p] += Math.round(255 * (1 - m.t))
    parts[m.k2][p] += Math.round(255 * m.t)
  }
  if (!opaques || hors > HORS_MAX * opaques) return { change: false, raison: 'pas-a-plat', hors: opaques ? hors / opaques : 0 }
  const pas = source ? pasDuFichier(source) : 1
  const alpha = new Uint8ClampedArray(N)
  for (let p = 0; p < N; p++) alpha[p] = data[p * 4 + 3]
  const vide = voileOuVide(alpha, largeur, hauteur, echelle * pas)
  /* Les parts du bord du vide, prises à l'encre voisine. */
  if (vide) remplir(parts, alpha, largeur, hauteur, Math.ceil(2 * echelle * pas) + 2)
  const champs = vide ? [...parts, alpha] : parts
  if (pas >= PAS_MIN) leLong(champs, largeur, hauteur, echelle * pas)
  /* Le flou, puis une part du détail d'origine rendue (`DETAIL`) : un
     trait fin et pâle (60 % d'encre sur quatre pixels) ne passe pas sous
     la moitié — il reste ; le bruit, lui, s'adoucit. */
  const sigma = Math.max(0.8, 0.25 * echelle)
  const lisses = champs.map(u => {
    const f = new Float32Array(u)
    flouter(f, largeur, hauteur, sigma)
    for (let p = 0; p < N; p++) f[p] += DETAIL * (u[p] - f[p])
    return f
  })
  const P = lisses.slice(0, K), A = vide ? lisses[K] : null
  /* La teinte qui l'emporte, pixel par pixel (VIDE : le vide). */
  const gagnant = new Uint8Array(N).fill(VIDE)
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      const p = y * largeur + x, i = p * 4
      if (A) {
        data[i + 3] = Math.round(255 * couverture(A, null, x, y, largeur, hauteur, 127.5))
        if (!data[i + 3]) continue
      } else if (data[i + 3] < OPAQUE) continue
      let k1 = 0, k2 = 1, u1 = -Infinity, u2 = -Infinity
      for (let k = 0; k < K; k++) {
        const u = P[k][p]
        if (u > u1) { u2 = u1; k2 = k1; u1 = u; k1 = k } else if (u > u2) { u2 = u; k2 = k }
      }
      gagnant[p] = k1
      const f = couverture(P[k1], P[k2], x, y, largeur, hauteur, 0)
      const a = pal[k1], b = pal[k2]
      data[i] = f * a[0] + (1 - f) * b[0]
      data[i + 1] = f * a[1] + (1 - f) * b[1]
      data[i + 2] = f * a[2] + (1 - f) * b[2]
    }
  }
  const liseres = sansLiseres(data, largeur, hauteur, gagnant, pal, LISERE * echelle)
  return { change: true, teintes: K, hors: hors / opaques, sigma, liseres, vide, pas }
}

/* LA COUVERTURE d'un pixel : la part de sa surface où le champ `u` (moins
   `v`, s'il y en a un) dépasse `seuil` — seize points du pixel, le champ
   lu entre les centres de ses voisins (bilinéaire). Le bord se pose à sa
   place au seizième de pixel, quelle que soit la raideur du champ (la
   pente, avant, le décalait d'un quart de pixel). */
const SOUS = [0.125, 0.375, 0.625, 0.875]
function couverture(u, v, x, y, L, H, seuil) {
  const e = v ? q => u[q] - v[q] - seuil : q => u[q] - seuil
  const dedans = e(y * L + x) > 0
  const xa = x > 0 ? x - 1 : x, xb = x < L - 1 ? x + 1 : x, ya = y > 0 ? y - 1 : y, yb = y < H - 1 ? y + 1 : y
  let franc = true
  for (let yy = ya; yy <= yb && franc; yy++) for (let xx = xa; xx <= xb; xx++) if ((e(yy * L + xx) > 0) !== dedans) { franc = false; break }
  if (franc) return dedans ? 1 : 0
  /* Le cœur d'un trait plus fin qu'un pixel (dehors des deux côtés) reste
     plein : un trait fin et pâle ne s'efface pas (23 novembre 2026). */
  if (dedans && ((e(y * L + xa) <= 0 && e(y * L + xb) <= 0) || (e(ya * L + x) <= 0 && e(yb * L + x) <= 0))) return 1
  let n = 0
  for (const sy of SOUS) {
    const fy = y + sy - 0.5, y0 = Math.floor(fy), ty = fy - y0
    const ha = Math.max(0, y0) * L, hb = Math.min(H - 1, y0 + 1) * L
    for (const sx of SOUS) {
      const fx = x + sx - 0.5, x0 = Math.floor(fx), tx = fx - x0
      const ga = Math.max(0, x0), gb = Math.min(L - 1, x0 + 1)
      const val = (e(ha + ga) * (1 - tx) + e(ha + gb) * tx) * (1 - ty) + (e(hb + ga) * (1 - tx) + e(hb + gb) * tx) * ty
      if (val > 0) n++
    }
  }
  return n / 16
}

/* LE PAS DU FICHIER (27 novembre 2026, le logo AVI : un fichier de 547 px
   qui n'est que l'agrandissement ×2 au plus proche d'un plus petit). Un
   tel fichier a des blocs de pixels égaux : dans un bord, deux voisins
   « entre deux » (ni le dedans ni le dehors) y sont égaux une fois sur
   (1 − 1/s), quand un fichier à sa vraie taille n'en a presque jamais.
   Rend s, borné à 4 (1 : un fichier à sa vraie taille). Mesuré sur les
   80 fichiers de ~/Downloads : AVI 1,47, un autre 1,73, tous les autres
   ≤ 1,14 ; un agrandissement ×2 exact, 2,04. */
export function pasDuFichier({ data, largeur: l, hauteur: h }, tol = 4) {
  const ecart = (i, j) => {
    const a = data[i + 3], b = data[j + 3]
    let d = Math.abs(a - b)
    for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(data[i + c] * a - data[j + c] * b) / 255)
    return d
  }
  const axe = pas => {
    let n = 0, egaux = 0
    for (let y = 2; y < h - 3; y++) {
      for (let x = 2; x < l - 3; x++) {
        const i = (y * l + x) * 4, e1 = i - 2 * pas, e2 = i + 3 * pas
        if (ecart(e1, e2) < 48 || ecart(i, e1) <= 3 * tol || ecart(i, e2) <= 3 * tol) continue
        n++
        if (ecart(i, i + pas) <= tol) egaux++
      }
    }
    return { n, taux: n ? egaux / n : 0 }
  }
  const hz = axe(4), vt = axe(4 * l)
  if (hz.n < 200 || vt.n < 200) return 1
  return Math.min(4, 1 / (1 - Math.min(0.75, Math.min(hz.taux, vt.taux))))
}

/* LE LONG DU BORD : chaque champ se moyenne le long du bord seulement, en
   suivant sa direction (le tenseur de structure, lu assez large pour que
   les marches s'y fondent — `LARGE` pixels du fichier) pas à pas (la
   ligne de courant suit la courbe) sur `LONG` pixels du fichier : la
   marche se fond dans le bord, l'épaisseur d'un trait ne bouge pas. Un
   coin arrête la moyenne : la direction n'y est plus franche (cohérence
   basse, `COH_MIN`), ou le bord y tourne de plus de `VIRAGE` degrés.
   `pixel` : la taille d'un vrai pixel du fichier dans l'image. Seulement
   pour un fichier qui a des marches (`PAS_MIN`) : sur un fichier net, la
   moyenne arrondissait les coins et les empattements (−3 à −6 dB au banc)
   et n'apportait rien. */
export const PAS_MIN = 1.25
export const LONG = 3
export const LARGE = 2
export const VIRAGE = 10
export const COH_MIN = 0.3
export const COH_PLEIN = 0.75
function leLong(champs, largeur, hauteur, pixel) {
  const N = largeur * hauteur
  const j11 = new Float32Array(N), j12 = new Float32Array(N), j22 = new Float32Array(N)
  for (const c of champs) {
    for (let y = 1; y < hauteur - 1; y++) {
      for (let x = 1, p = y * largeur + 1; x < largeur - 1; x++, p++) {
        const gx = c[p + 1] - c[p - 1], gy = c[p + largeur] - c[p - largeur]
        if (!gx && !gy) continue
        j11[p] += gx * gx; j12[p] += gx * gy; j22[p] += gy * gy
      }
    }
  }
  const rho = LARGE * pixel
  flouter(j11, largeur, hauteur, rho); flouter(j12, largeur, hauteur, rho); flouter(j22, largeur, hauteur, rho)
  const tx = new Float32Array(N), ty = new Float32Array(N), sig = new Float32Array(N)
  let tmax = 0
  for (let p = 0; p < N; p++) { const t = j11[p] + j22[p]; if (t > tmax) tmax = t }
  const seuil = tmax * 1e-4, sMax = LONG * pixel
  for (let p = 0; p < N; p++) {
    const a = j11[p], b = j12[p], d = j22[p], tr = a + d
    if (tr <= seuil) continue
    const theta = 0.5 * Math.atan2(2 * b, a - d)
    tx[p] = -Math.sin(theta); ty[p] = Math.cos(theta)
    const coh = Math.sqrt((a - d) * (a - d) + 4 * b * b) / tr
    sig[p] = sMax * Math.max(0, Math.min(1, (coh - COH_MIN) / (COH_PLEIN - COH_MIN)))
  }
  const virage = Math.cos(VIRAGE * Math.PI / 180)
  const sources = champs.map(c => c.slice())
  const K = champs.length, somme = new Float64Array(K), moitie = new Float64Array(K), r = Math.ceil(pixel), ecart = ECART * pixel
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      const p = y * largeur + x, s = sig[p]
      if (s < 0.5) continue
      /* Rien à moyenner loin de tout bord : chaque champ plein ou vide,
         le même à `r` pixels dans les quatre sens. */
      let plat = true
      for (let k = 0; k < K && plat; k++) {
        const c = sources[k], v = c[p]
        if ((v > 0 && v < 255) || (x >= r && c[p - r] !== v) || (x < largeur - r && c[p + r] !== v) || (y >= r && c[p - r * largeur] !== v) || (y < hauteur - r && c[p + r * largeur] !== v)) plat = false
      }
      if (plat) continue
      const n = Math.ceil(2 * s), inv = -1 / (2 * s * s)
      somme.fill(0); moitie.fill(0)
      let poids = 1, poidsAvant = 0
      for (let sens = 1; sens >= -1; sens -= 2) {
        if (sens < 0) { for (let k = 0; k < K; k++) moitie[k] = somme[k]; poidsAvant = poids - 1 }
        let px = x, py = y, vx = tx[p] * sens, vy = ty[p] * sens
        const ox = vx, oy = vy
        for (let j = 1; j <= n; j++) {
          px += vx; py += vy
          if (px < 0 || py < 0 || px > largeur - 1 || py > hauteur - 1) break
          const q = Math.round(py) * largeur + Math.round(px)
          let wx = tx[q], wy = ty[q]
          if (wx || wy) {
            if (wx * vx + wy * vy < 0) { wx = -wx; wy = -wy }
            vx = wx; vy = wy
          }
          if (vx * ox + vy * oy < virage) break
          /* Plus de bord à `ecart` pixels de part et d'autre : la ligne a
             quitté le bord (une marche n'en écarte jamais autant ; la
             direction penchée près d'un coin, si) — elle s'arrête. */
          if (horsDuBord(sources, px, py, -vy * ecart, vx * ecart, largeur, hauteur)) break
          const w = Math.exp(j * j * inv)
          const x0 = Math.floor(px), y0 = Math.floor(py), fx = px - x0, fy = py - y0
          const x1 = Math.min(largeur - 1, x0 + 1), y1 = Math.min(hauteur - 1, y0 + 1)
          const a00 = y0 * largeur + x0, a10 = y0 * largeur + x1, a01 = y1 * largeur + x0, a11 = y1 * largeur + x1
          for (let k = 0; k < K; k++) {
            const c = sources[k]
            somme[k] += w * ((c[a00] * (1 - fx) + c[a10] * fx) * (1 - fy) + (c[a01] * (1 - fx) + c[a11] * fx) * fy)
          }
          poids += w
        }
      }
      /* Les deux moitiés de la ligne ne disent pas la même chose (le plein
         d'un côté, le vide de l'autre) : un coin tout près, le pixel
         reste tel quel — une marche, elle, se moyenne pareil des deux
         côtés. */
      const poidsApres = poids - 1 - poidsAvant
      let coin = false
      if (poidsAvant > 0 && poidsApres > 0) {
        for (let k = 0; k < K && !coin; k++) if (Math.abs(moitie[k] / poidsAvant - (somme[k] - moitie[k]) / poidsApres) > ASYMETRIE * 255) coin = true
      }
      if (coin) continue
      for (let k = 0; k < K; k++) champs[k][p] = (somme[k] + sources[k][p]) / poids
    }
  }
}

/* Chaque champ plein ou vide, le même, au point (x, y) et à ±(nx, ny). */
export const ECART = 1.5
export const ASYMETRIE = 0.55
function horsDuBord(champs, x, y, nx, ny, L, H) {
  const ou = (a, b) => Math.min(H - 1, Math.max(0, Math.round(b))) * L + Math.min(L - 1, Math.max(0, Math.round(a)))
  const p = ou(x, y), q1 = ou(x + nx, y + ny), q2 = ou(x - nx, y - ny)
  for (const c of champs) {
    const v = c[p]
    if ((v !== 0 && v !== 255) || c[q1] !== v || c[q2] !== v) return false
  }
  return true
}

/* Les parts des pixels à demi transparents prises aux pixels pleins
   voisins, de proche en proche (`R` pixels au plus) : leur couleur est
   celle que l'IA a vue posée sur du blanc. */
function remplir(parts, alpha, l, h, R) {
  const n = l * h
  const fait = new Uint8Array(n)
  for (let p = 0; p < n; p++) if (alpha[p] >= OPAQUE) fait[p] = 1
  for (const u of parts) for (let p = 0; p < n; p++) if (!fait[p]) u[p] = 0
  const voisins = p => {
    const x = p % l, v = []
    if (x > 0) v.push(p - 1)
    if (x < l - 1) v.push(p + 1)
    if (p >= l) v.push(p - l)
    if (p < n - l) v.push(p + l)
    return v
  }
  let front = []
  for (let p = 0; p < n; p++) if (!fait[p] && voisins(p).some(q => fait[q])) front.push(p)
  for (let t = 0; t < R && front.length; t++) {
    const faits = []
    for (const p of front) {
      if (fait[p]) continue
      const vs = voisins(p).filter(q => fait[q] === 1)
      if (!vs.length) continue
      for (const u of parts) { let s = 0; for (const q of vs) s += u[q]; u[p] = s / vs.length }
      fait[p] = 2
      faits.push(p)
    }
    for (const p of faits) fait[p] = 1
    front = []
    for (const p of faits) for (const q of voisins(p)) if (!fait[q]) front.push(q)
  }
}

/* Une opacité franche : un logo posé sur du vide, ses bords adoucis — vrai.
   Pas de vide, ou un voile, une ombre douce (des plages à demi
   transparentes loin de tout bord, `VOILE_MAX` des pixels pleins) : faux,
   l'opacité ne bouge pas. */
export const VOILE_MAX = 0.01
function voileOuVide(a, largeur, hauteur, pixel) {
  const N = largeur * hauteur
  let pleins = 0, demi = 0
  for (let p = 0; p < N; p++) { if (a[p] >= OPAQUE) pleins++; else if (a[p] > 5) demi++ }
  if (!pleins || !demi) return false
  const r = Math.ceil(1.5 * pixel)
  const franc = v => v <= 15 || v >= 240
  let plages = 0
  for (let y = r; y < hauteur - r; y++) {
    for (let x = r, p = y * largeur + r; x < largeur - r; x++, p++) {
      if (franc(a[p])) continue
      if (!franc(a[p - r]) && !franc(a[p + r]) && !franc(a[p - r * largeur]) && !franc(a[p + r * largeur])) plages++
    }
  }
  return plages <= VOILE_MAX * pleins
}

/* LES LISERÉS (24 novembre 2026, essai sur le logo New Balance) : l'IA
   laisse au bord d'un aplat bleu sur du blanc une ligne d'un pixel plus
   sombre que le bleu — son écho, pas le dessin —, et la passe la rendait
   bleu nuit franc : un cerne partout où le fichier n'en a pas. Une bande
   d'une teinte plus fine que `LISERE` pixel du fichier reçu, prise entre
   deux AUTRES teintes, en est un : elle devient le fondu de ses deux
   voisines, au prorata de leur distance (le bord reste doux). Un vrai
   contour fait au moins un pixel du fichier ; un trait fin sur UN fond
   (du gris sur du blanc des deux côtés) n'est pas pris entre deux
   teintes : il reste. */
export const LISERE = 0.8
const VIDE = 255
function sansLiseres(data, largeur, hauteur, gagnant, pal, epaisseur) {
  const R = Math.ceil(epaisseur)
  if (R < 1) return 0
  const K = pal.length
  const dist = new Float32Array(K)
  /* Huit sondes à la distance R : toutes de la même teinte, le pixel est
     loin de tout bord assez proche pour faire une bande fine. */
  const sondes = []
  for (let a = 0; a < 8; a++) sondes.push([Math.round(R * Math.cos(a * Math.PI / 4)), Math.round(R * Math.sin(a * Math.PI / 4))])
  const fenetre = []
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const d = Math.hypot(dx, dy)
    if (d && d <= R + 0.5) fenetre.push([dx, dy, d])
  }
  let n = 0
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      const p = y * largeur + x, g = gagnant[p]
      if (g === VIDE) continue
      let pres = true
      for (const [dx, dy] of sondes) {
        const xx = Math.min(largeur - 1, Math.max(0, x + dx)), yy = Math.min(hauteur - 1, Math.max(0, y + dy))
        if (gagnant[yy * largeur + xx] !== g) { pres = false; break }
      }
      if (pres) continue
      dist.fill(Infinity)
      for (const [dx, dy, d] of fenetre) {
        const xx = x + dx, yy = y + dy
        if (xx < 0 || yy < 0 || xx >= largeur || yy >= hauteur) continue
        const t = gagnant[yy * largeur + xx]
        if (t !== VIDE && t !== g && d < dist[t]) dist[t] = d
      }
      let a = -1, b = -1
      for (let k = 0; k < K; k++) {
        if (k === g || dist[k] === Infinity) continue
        if (a < 0 || dist[k] < dist[a]) { b = a; a = k } else if (b < 0 || dist[k] < dist[b]) b = k
      }
      if (b < 0 || dist[a] + dist[b] - 1 >= epaisseur) continue
      const f = dist[b] / (dist[a] + dist[b]), A = pal[a], B = pal[b], i = p * 4
      data[i] = f * A[0] + (1 - f) * B[0]
      data[i + 1] = f * A[1] + (1 - f) * B[1]
      data[i + 2] = f * A[2] + (1 - f) * B[2]
      n++
    }
  }
  return n
}

/* LES TEINTES FRANCHES : un trait fin a plus de pixels de bord que de
   pixels pleins, et paletteAuto garde ses mélanges avec le fond (le gris
   d'un trait marine sur du blanc) comme des teintes. Ici, toute teinte
   posée sur le segment de deux autres (entre 12 et 88 %, à moins de 22
   niveaux du trait) part, quel que soit son poids : la plus alignée
   d'abord, jusqu'à ce qu'il n'en reste aucune. */
export function sansMelanges(pal) {
  const l = pal.map(c => c.slice())
  for (;;) {
    let pire = -1, mieux = 22 * 22
    for (let i = 0; i < l.length; i++) {
      for (let a = 0; a < l.length; a++) for (let b = a + 1; b < l.length; b++) {
        if (a === i || b === i) continue
        const A = l[a], B = l[b], C = l[i]
        const ab = [B[0] - A[0], B[1] - A[1], B[2] - A[2]]
        const l2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2
        if (!l2) continue
        const t = ((C[0] - A[0]) * ab[0] + (C[1] - A[1]) * ab[1] + (C[2] - A[2]) * ab[2]) / l2
        if (t < 0.12 || t > 0.88) continue
        const d = (C[0] - A[0] - t * ab[0]) ** 2 + (C[1] - A[1] - t * ab[1]) ** 2 + (C[2] - A[2] - t * ab[2]) ** 2
        if (d < mieux) { mieux = d; pire = i }
      }
    }
    if (pire < 0) return l
    l.splice(pire, 1)
  }
}

/* LA PAIRE DONT LE PIXEL EST LE MÉLANGE : de toutes les paires de
   teintes, celle dont le segment passe le plus près (un trait gris foncé
   fin sur du blanc est un mélange de gris et de blanc, même si le bleu
   est plus près de lui), et la part `t` de la seconde. `loin` : trop loin
   de tout segment pour en être un mélange. */
function melange(r, g, b, pal) {
  let k1 = 0, k2 = 0, t1 = 0, best = Infinity
  for (let i = 0; i < pal.length; i++) {
    for (let j = i + 1; j < pal.length; j++) {
      const a = pal[i], c = pal[j]
      const ab0 = c[0] - a[0], ab1 = c[1] - a[1], ab2 = c[2] - a[2]
      const l2 = ab0 * ab0 + ab1 * ab1 + ab2 * ab2
      let t = l2 ? ((r - a[0]) * ab0 + (g - a[1]) * ab1 + (b - a[2]) * ab2) / l2 : 0
      t = Math.max(0, Math.min(1, t))
      const d = (r - a[0] - t * ab0) ** 2 + (g - a[1] - t * ab1) ** 2 + (b - a[2] - t * ab2) ** 2
      if (d < best) { best = d; k1 = i; k2 = j; t1 = t }
    }
  }
  /* La teinte qui l'emporte en premier. */
  if (t1 > 0.5) return { k1: k2, k2: k1, t: 1 - t1, loin: best > LOIN }
  return { k1, k2, t: t1, loin: best > LOIN }
}

/* Un flou gaussien approché par trois moyennes glissantes (en place). */
function flouter(u, l, h, sigma) {
  const n = 3
  const wIdeal = Math.sqrt(12 * sigma * sigma / n + 1)
  let wl = Math.floor(wIdeal); if (wl % 2 === 0) wl--
  const wu = wl + 2
  const m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4))
  const tmp = new Float32Array(Math.max(l, h))
  for (let k = 0; k < n; k++) {
    const r = ((k < m ? wl : wu) - 1) / 2
    if (r < 1) continue
    boite(u, l, h, r, tmp)
  }
}
function boite(u, l, h, r, tmp) {
  const w = 2 * r + 1
  for (let y = 0; y < h; y++) {
    const o = y * l
    let s = 0
    for (let x = -r; x <= r; x++) s += u[o + Math.min(l - 1, Math.max(0, x))]
    for (let x = 0; x < l; x++) {
      tmp[x] = s / w
      s += u[o + Math.min(l - 1, x + r + 1)] - u[o + Math.max(0, x - r)]
    }
    for (let x = 0; x < l; x++) u[o + x] = tmp[x]
  }
  for (let x = 0; x < l; x++) {
    let s = 0
    for (let y = -r; y <= r; y++) s += u[Math.min(h - 1, Math.max(0, y)) * l + x]
    for (let y = 0; y < h; y++) {
      tmp[y] = s / w
      s += u[Math.min(h - 1, y + r + 1) * l + x] - u[Math.max(0, y - r) * l + x]
    }
    for (let y = 0; y < h; y++) u[y * l + x] = tmp[y]
  }
}

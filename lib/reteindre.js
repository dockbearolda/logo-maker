/* LES COULEURS DU LOGO CHANGÉES (22 novembre 2026, « sur un logo
   vectoriel, on doit pouvoir sélectionner les couleurs que l'on souhaite
   et les modifier : passer le bleu en vert, le blanc en transparent ») —
   sur les PIXELS du logo, sans le vectoriser.

   `consigne` : { palette, vers } — `palette`, les teintes du logo lues une
   fois (lib/vectoriser.js, `paletteAuto`) ; `vers`, par teinte d'origine
   (« r,g,b »), sa nouvelle couleur [r, g, b], ou `null` : transparente.

   Chaque pixel se lit comme un mélange de ses deux teintes les plus
   proches (l'anticrénelage entre le bleu et le blanc) : sa part de chacune
   prend sa nouvelle couleur, une part transparente emporte son opacité —
   le bord reste doux. Ce qui s'écarte de la teinte (le grain, le modelé)
   la suit, décalé d'autant. Un pixel dont aucune des deux teintes ne
   change n'est pas touché : sans changement, les mêmes octets. */

const LOIN = 40 * 40

export function reteindre(data, largeur, hauteur, consigne) {
  if (!consigne || !consigne.palette || !consigne.palette.length || !consigne.vers) return data
  const pal = consigne.palette
  const n = pal.length
  const change = pal.map(c => Object.prototype.hasOwnProperty.call(consigne.vers, c.join(',')))
  if (!change.some(Boolean)) return data
  const cible = pal.map((c, k) => change[k] ? consigne.vers[c.join(',')] : c)
  /* Un cache par couleur exacte : un logo à plat en a peu. */
  const memo = new Map()
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]
    if (!a) continue
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const cle = (r << 16) | (g << 8) | b
    let m = memo.get(cle)
    if (m === undefined) {
      m = melange(r, g, b, pal, n)
      if (!change[m.k1] && !(m.t > 0 && change[m.k2])) m = null
      memo.set(cle, m)
    }
    if (!m) continue
    const w1 = 1 - m.t, w2 = m.t
    const T1 = cible[m.k1], T2 = cible[m.k2]
    const g1 = T1 ? w1 : 0, g2 = T2 ? w2 : 0
    const garde = g1 + g2
    if (garde <= 0) { data[i + 3] = 0; continue }
    /* Le reste : ce que la teinte ne dit pas (le grain), gardé. */
    const c1 = pal[m.k1], c2 = pal[m.k2]
    const dr = r - (w1 * c1[0] + w2 * c2[0]), dg = g - (w1 * c1[1] + w2 * c2[1]), db = b - (w1 * c1[2] + w2 * c2[2])
    const R = ((g1 && T1[0] * g1) + (g2 && T2[0] * g2)) / garde + dr
    const G = ((g1 && T1[1] * g1) + (g2 && T2[1] * g2)) / garde + dg
    const B = ((g1 && T1[2] * g1) + (g2 && T2[2] * g2)) / garde + db
    data[i] = R; data[i + 1] = G; data[i + 2] = B
    data[i + 3] = Math.round(a * garde)
  }
  return data
}

/* Les deux teintes les plus proches, et la part `t` de la seconde : le
   pixel projeté sur le segment qui les relie — seulement s'il en est
   près (sinon, c'est la première, toute seule). */
function melange(r, g, b, pal, n) {
  let k1 = 0, k2 = 0, d1 = Infinity, d2 = Infinity
  for (let k = 0; k < n; k++) {
    const c = pal[k]
    const d = (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2
    if (d < d1) { d2 = d1; k2 = k1; d1 = d; k1 = k } else if (d < d2) { d2 = d; k2 = k }
  }
  if (n < 2) return { k1, k2: k1, t: 0 }
  const a = pal[k1], c = pal[k2]
  const ab = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
  const l2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2
  if (!l2) return { k1, k2, t: 0 }
  let t = ((r - a[0]) * ab[0] + (g - a[1]) * ab[1] + (b - a[2]) * ab[2]) / l2
  t = Math.max(0, Math.min(1, t))
  const p = [a[0] + t * ab[0], a[1] + t * ab[1], a[2] + t * ab[2]]
  if ((r - p[0]) ** 2 + (g - p[1]) ** 2 + (b - p[2]) ** 2 > LOIN) t = 0
  return { k1, k2, t }
}

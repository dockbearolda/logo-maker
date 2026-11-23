/* L'OR OLDA, EN DÉGRADÉ — le même que BAT Studio (src/js/couleurlogo.js,
   src/js/logoasset.js : Analyser et Logo maker sont la même appli,
   22 novembre 2026). On imprime à plat (pas de dorure à chaud) : un or uni
   sortirait moutarde. La pastille « Or » pose donc un dégradé métallique —
   sombre, éclat, sombre, comme une pièce qui prend la lumière —, en
   diagonale haut-gauche → bas-droite, tendu sur ce qui est doré. */
export const OR = { nom: 'Or', rvb: [201, 162, 63] }
export const OR_DEGRADE = [
  [0, '#7A4E0C'], [0.18, '#C8922C'], [0.36, '#F6DD7A'], [0.5, '#B8811F'],
  [0.68, '#E9C35A'], [0.84, '#FBEA9A'], [1, '#8F5F12'],
]
export const estOr = rvb => !!rvb && rvb[0] === OR.rvb[0] && rvb[1] === OR.rvb[1] && rvb[2] === OR.rvb[2]
/* Le fond CSS d'une pastille : le dégradé pour l'or. */
export const FOND_OR = 'linear-gradient(135deg, ' + OR_DEGRADE.map(([t, c]) => c + ' ' + t * 100 + '%').join(', ') + ')'

const hex = c => [1, 3, 5].map(k => parseInt(c.slice(k, k + 2), 16))
let lut = null
function degrade() {
  if (lut) return lut
  lut = new Float32Array(256 * 3)
  const st = OR_DEGRADE.map(([t, c]) => [t, hex(c)])
  for (let k = 0; k < 256; k++) {
    const t = k / 255
    let j = 0
    while (j < st.length - 2 && t > st[j + 1][0]) j++
    const [t0, c0] = st[j], [t1, c1] = st[j + 1]
    const u = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)))
    for (let q = 0; q < 3; q++) lut[k * 3 + q] = c0[q] + (c1[q] - c0[q]) * u
  }
  return lut
}

/* `part` : la part d'or de chaque pixel (0 à 1, lib/reteindre.js). Le
   pixel passe de l'or uni à la teinte du dégradé à sa place, d'autant —
   le bord doux et le grain gardés. */
export function dorer(data, largeur, hauteur, part) {
  let x0 = largeur, y0 = hauteur, x1 = -1, y1 = -1
  for (let y = 0; y < hauteur; y++) for (let x = 0; x < largeur; x++) {
    const i = y * largeur + x
    if (part[i] < 0.5 || data[i * 4 + 3] < 8) continue
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
  }
  if (x1 < 0) return data
  const L = degrade(), n = Math.max(1, x1 - x0 + y1 - y0)
  for (let y = 0; y < hauteur; y++) for (let x = 0; x < largeur; x++) {
    const i = y * largeur + x, w = part[i]
    if (!w) continue
    const k = Math.round(Math.min(1, Math.max(0, (x - x0 + y - y0) / n)) * 255) * 3
    for (let q = 0; q < 3; q++) data[i * 4 + q] += w * (L[k + q] - OR.rvb[q])
  }
  return data
}

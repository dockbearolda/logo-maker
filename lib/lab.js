/* ================================================================ L'ŒIL
   29 septembre 2026 : « tout mes logos doivent être vectorisés de façon
   ultra qualitative ». Deux couleurs se comparaient en niveaux de rouge,
   vert, bleu : le vert sauge d'un crabe et le vert plus sombre du texte
   « LA PISCINE » passaient pour la même teinte, un rose et un pêche aussi —
   fondus, le texte sortait plus pâle et plus gras qu'il n'est. Ici, l'écart
   que voit l'œil : l'espace CIELAB et la formule CIEDE2000 (la référence
   des imprimeurs). Sous 1, personne ne voit la différence ; vers 2 ou 3,
   un œil exercé ; au-delà de 10, ce sont deux couleurs. */

/* sRVB (0 à 255) → CIELAB, blanc D65. */
const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
const f = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116
export function lab([r, g, b]) {
  const R = lin(r), G = lin(g), B = lin(b)
  const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047
  const y = 0.2126729 * R + 0.7151522 * G + 0.0721750 * B
  const z = (0.0193339 * R + 0.1191920 * G + 0.9503041 * B) / 1.08883
  const fx = f(x), fy = f(y), fz = f(z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

/* L'ÉCART CIEDE2000 entre deux couleurs CIELAB. */
const rad = Math.PI / 180
export function ecartLab([L1, a1, b1], [L2, a2, b2]) {
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2)
  const Cm = (C1 + C2) / 2
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)))
  const A1 = (1 + G) * a1, A2 = (1 + G) * a2
  const c1 = Math.hypot(A1, b1), c2 = Math.hypot(A2, b2)
  const h = (b, a) => { if (!b && !a) return 0; const v = Math.atan2(b, a) / rad; return v < 0 ? v + 360 : v }
  const h1 = h(b1, A1), h2 = h(b2, A2)
  const dL = L2 - L1, dC = c2 - c1
  let dh = 0
  if (c1 * c2) { dh = h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360 }
  const dH = 2 * Math.sqrt(c1 * c2) * Math.sin(dh / 2 * rad)
  const Lm = (L1 + L2) / 2, cm = (c1 + c2) / 2
  let hm = h1 + h2
  if (c1 * c2) { hm = Math.abs(h1 - h2) > 180 ? (h1 + h2 + (h1 + h2 < 360 ? 360 : -360)) / 2 : (h1 + h2) / 2 }
  const T = 1 - 0.17 * Math.cos((hm - 30) * rad) + 0.24 * Math.cos(2 * hm * rad) + 0.32 * Math.cos((3 * hm + 6) * rad) - 0.2 * Math.cos((4 * hm - 63) * rad)
  const dT = 30 * Math.exp(-(((hm - 275) / 25) ** 2))
  const Rc = 2 * Math.sqrt(cm ** 7 / (cm ** 7 + 25 ** 7))
  const Sl = 1 + 0.015 * (Lm - 50) ** 2 / Math.sqrt(20 + (Lm - 50) ** 2)
  const Sc = 1 + 0.045 * cm, Sh = 1 + 0.015 * cm * T
  const Rt = -Math.sin(2 * dT * rad) * Rc
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh))
}

/* L'écart que voit l'œil entre deux couleurs sRVB. */
export const ecart = (a, b) => ecartLab(lab(a), lab(b))

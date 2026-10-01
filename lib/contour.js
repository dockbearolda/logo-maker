/* =============================================================== LE CONTOUR
   1er octobre 2026 (Illustrator : Objet › Tracé › Décalage) : un liseré
   autour du logo, de l'épaisseur qu'on veut (en millimètres imprimés) et
   d'une couleur du nuancier — le blanc qui détache un logo foncé d'un
   t-shirt noir, l'allure d'un autocollant. Le décalage d'Illustrator :
   l'encre élargie de la même distance partout, les angles arrondis ; un
   creux plus étroit que deux fois le contour se comble, un grand creux
   garde son jour (rétréci d'autant).
   Calculé sur le dessin à l'écran (ses formes, peintes dans une toile) :
   la distance de chaque pixel à l'encre (Felzenszwalb–Huttenlocher, exacte),
   puis le masque élargi tracé comme le reste (lib/vecteur-lisse.js) — une
   forme du vecteur, sous le logo, qui part dans tous les exports. Pur. */

/* LA DISTANCE À L'ENCRE : pour chaque pixel, le carré de la distance au
   centre du pixel d'encre le plus proche (0 sur l'encre). Deux passes de
   paraboles, en lignes puis en colonnes. */
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
export function distanceEncre(encre, l, h) {
  const m = Math.max(l, h)
  const g = new Float32Array(l * h)
  const f = new Float32Array(m), d = new Float32Array(m), v = new Int32Array(m), z = new Float32Array(m + 1)
  for (let x = 0; x < l; x++) {
    for (let y = 0; y < h; y++) f[y] = encre[y * l + x] ? 0 : INF
    paraboles(f, h, d, v, z)
    for (let y = 0; y < h; y++) g[y * l + x] = d[y]
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) f[x] = g[y * l + x]
    paraboles(f, l, d, v, z)
    for (let x = 0; x < l; x++) g[y * l + x] = d[x]
  }
  return g
}

/* L'ENCRE ÉLARGIE de `px` pixels (`encre` : 1 là où il y en a, sur
   `l` × `h`) : rend une image RVBA noire, opaque là où passe le contour —
   prête à tracer. La toile doit déjà avoir sa marge (au moins `px`). */
export function elargir(encre, l, h, px) {
  const d = distanceEncre(encre, l, h)
  const r2 = px * px
  const rgba = new Uint8ClampedArray(l * h * 4)
  for (let p = 0; p < l * h; p++) if (d[p] <= r2) rgba[p * 4 + 3] = 255
  return rgba
}

/* UN CHEMIN SVG (commandes absolues M, L, Q, C, Z, nombres par paires)
   ramené d'une toile à l'image : x' = x0 + x × k, y' = y0 + y × k. */
export function deplacerChemin(d, k, x0, y0) {
  let i = 0
  const f = v => { const r = Math.round(v * 100) / 100; return Object.is(r, -0) ? '0' : String(r) }
  return d.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, n => f(i++ % 2 === 0 ? x0 + Number(n) * k : y0 + Number(n) * k))
}

/* LE TEXTE RÉÉCRIT À LA MAIN (22 novembre 2026, « dans les cas où l'app
   n'arrive pas à repérer les polices, je dois pouvoir les recouvrir
   facilement pour les effacer, et réécrire à cet endroit : comme ça la
   police est parfaite »).

   Chaque consigne (`textesMain` des réglages, en fractions de l'image —
   la même vaut pour l'aperçu, l'image pleine et l'image agrandie par
   l'IA) : { cadre: [u0, v0, u1, v1], fond, texte, police, couleur }.
   - `fond` : ce qui recouvre le cadre — null (transparent : le film),
     [r, g, b] (la couleur du bandeau sous le texte), ou 'garder' (rien
     ne s'efface).
   - `texte` (une ou plusieurs lignes) dans `police` (une face du
     catalogue : { id, graisse, style } de Google, ou { source, local }),
     de `couleur`, posé au plus grand qui tient dans le cadre, centré.
   Les lettres sont les courbes de la police (opentype.js, lues dans le
   fil : `polices`, une Map de `cleFace` → police), remplies sur une grille
   suréchantillonnée : le bord est doux, net à toutes les tailles. */
import { polygones, remplir } from './polices.js'

export const cleFace = p => p.local ? p.source + ':' + p.local : p.id + '/' + p.graisse + (p.style || 'normal')

/* La grille fine : jusqu'à 4 × 4 sous-pixels, 40 millions au plus. */
const SOUS_MAX = 4
const GRILLE_MAX = 40e6
/* Une marge dans le cadre : les lettres ne touchent pas son bord. */
const MARGE = 0.04

export function poserTextes(data, largeur, hauteur, textes, polices) {
  if (!textes || !textes.length) return data
  for (const t of textes) {
    const c = pixelsDu(t.cadre, largeur, hauteur)
    if (!c) continue
    if (t.fond !== 'garder') couvrir(data, largeur, c, t.fond)
    const police = t.police && polices && polices.get(cleFace(t.police))
    const texte = String(t.texte || '').replace(/\s+$/, '')
    if (!police || !texte.trim()) continue
    const chemins = disposer(police, texte, c, t)
    if (!chemins.length) continue
    peindre(data, largeur, c, chemins, t.couleur || [0, 0, 0])
  }
  return data
}

function pixelsDu(cadre, largeur, hauteur) {
  if (!cadre || cadre.length !== 4) return null
  const x0 = Math.max(0, Math.floor(Math.min(cadre[0], cadre[2]) * largeur))
  const y0 = Math.max(0, Math.floor(Math.min(cadre[1], cadre[3]) * hauteur))
  const x1 = Math.min(largeur, Math.ceil(Math.max(cadre[0], cadre[2]) * largeur))
  const y1 = Math.min(hauteur, Math.ceil(Math.max(cadre[1], cadre[3]) * hauteur))
  return x1 - x0 >= 2 && y1 - y0 >= 2 ? { x0, y0, x1, y1, l: x1 - x0, h: y1 - y0 } : null
}

function couvrir(data, largeur, c, fond) {
  const [r, g, b] = Array.isArray(fond) ? fond : [0, 0, 0]
  const a = Array.isArray(fond) ? 255 : 0
  for (let y = c.y0; y < c.y1; y++) {
    for (let x = c.x0, i = (y * largeur + c.x0) * 4; x < c.x1; x++, i += 4) {
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a
    }
  }
}

/* LE SENS DU TEXTE (22 novembre 2026, « les textes en horizontal, vertical,
   etc. doivent être parfaitement adaptés ») : `sens` — 'h' (absent),
   'monte' (tourné d'un quart, se lit de bas en haut), 'descend' (de haut
   en bas), 'empile' (les lettres droites, l'une sous l'autre) ; `angle`,
   des degrés de plus (une inclinaison) ; `aligner` des lignes ('gauche',
   'centre' absent, 'droite') ; `espace`, l'interlettrage en millièmes de
   corps. Le bloc se mesure à plat, puis tourne et prend l'échelle qui fait
   tenir son cadre tourné dans le cadre : le plus grand possible, centré. */
export const ANGLE_DU_SENS = { h: 0, monte: -90, descend: 90, empile: 0 }
export const angleDe = t => ((ANGLE_DU_SENS[t.sens] || 0) + (Number(t.angle) || 0)) * Math.PI / 180

/* LES LIGNES DANS LE CADRE : mesurées à 100 unités, posées dans le bloc à
   plat, puis tournées et mises à l'échelle. Une ligne seule remplit le
   cadre par son dessin même (ses lettres de haut en bas, comme le texte
   qu'elle remplace) ; plusieurs s'empilent à l'interligne de la police ;
   empilées, chaque lettre a sa case, d'un même pas. → des listes de
   commandes en pixels de l'image. */
export function disposer(police, texte, c, o = {}) {
  const T = 100
  const opts = { letterSpacing: (Number(o.espace) || 0) / 1000, kerning: true }
  const empile = o.sens === 'empile'
  const lignes = empile ? [...texte.replace(/\n/g, ' ')].map(ch => ch === ' ' ? '' : ch) : texte.split('\n')
  const boites = lignes.map(l => {
    const b = l ? police.getPath(l, 0, 0, T, opts).getBoundingBox() : { x1: 0, x2: 0, y1: 0, y2: 0 }
    return { l, b, vide: !(b.x2 > b.x1 && b.y2 > b.y1) }
  })
  if (boites.every(x => x.vide)) return []
  const upm = police.unitsPerEm || 1000
  const asc = (police.ascender || upm * 0.8) / upm * T
  const desc = (police.descender || -upm * 0.2) / upm * T
  const larg = Math.max(...boites.map(x => x.vide ? 0 : x.b.x2 - x.b.x1))
  /* Les places à plat : { l, x, y } (ligne de base), et le cadre du bloc. */
  let places, bx0 = 0, by0, bx1 = larg, by1
  if (empile) {
    const hl = Math.max(...boites.map(x => x.vide ? 0 : x.b.y2 - x.b.y1))
    const pas = hl * 1.22
    places = boites.map((x, k) => x.vide ? null : { l: x.l, x: (larg - (x.b.x2 - x.b.x1)) / 2 - x.b.x1, y: k * pas + pas / 2 - (x.b.y1 + x.b.y2) / 2 })
    /* Les cases vides du bout (une espace finale) ne comptent pas. */
    const pleines = places.map((p, k) => p ? k : -1).filter(k => k >= 0)
    by0 = pleines[0] * pas; by1 = (pleines[pleines.length - 1] + 1) * pas
  } else if (lignes.length === 1) {
    const b = boites[0].b
    places = [{ l: lignes[0], x: -b.x1, y: 0 }]
    by0 = b.y1; by1 = b.y2
  } else {
    const interligne = asc - desc
    places = boites.map((x, k) => {
      if (x.vide) return null
      const w = x.b.x2 - x.b.x1
      const lx = o.aligner === 'gauche' ? 0 : o.aligner === 'droite' ? larg - w : (larg - w) / 2
      return { l: x.l, x: lx - x.b.x1, y: k * interligne + asc }
    })
    by0 = 0; by1 = interligne * lignes.length
  }
  const w = bx1 - bx0, h = by1 - by0
  const a = angleDe(o), cs = Math.cos(a), sn = Math.sin(a)
  const W = w * Math.abs(cs) + h * Math.abs(sn), H = w * Math.abs(sn) + h * Math.abs(cs)
  const L = c.l * (1 - 2 * MARGE), Hc = c.h * (1 - 2 * MARGE)
  const s = Math.min(L / W, Hc / H)
  if (!(s > 0) || !isFinite(s)) return []
  const mx = (bx0 + bx1) / 2, my = (by0 + by1) / 2
  const cx = c.x0 + c.l / 2, cy = c.y0 + c.h / 2
  const vers = (x, y) => { const dx = (x - mx) * s, dy = (y - my) * s; return [cx + dx * cs - dy * sn, cy + dx * sn + dy * cs] }
  const chemins = []
  for (const p of places) {
    if (!p) continue
    chemins.push(police.getPath(p.l, p.x, p.y, T, opts).commands.map(k => {
      const o2 = { type: k.type }
      for (const [px, py] of [['x', 'y'], ['x1', 'y1'], ['x2', 'y2']]) {
        if (k[px] === undefined) continue
        const [X, Y] = vers(k[px], k[py])
        o2[px] = X; o2[py] = Y
      }
      return o2
    }))
  }
  return chemins
}

function peindre(data, largeur, c, chemins, couleur) {
  const S = Math.max(1, Math.min(SOUS_MAX, Math.floor(Math.sqrt(GRILLE_MAX / (c.l * c.h)))))
  const L = c.l * S, H = c.h * S
  const polys = []
  for (const cmds of chemins) {
    const fines = cmds.map(k => {
      const o = { type: k.type }
      for (const p of ['x', 'y', 'x1', 'y1', 'x2', 'y2']) if (k[p] !== undefined) o[p] = (p[0] === 'x' ? k[p] - c.x0 : k[p] - c.y0) * S
      return o
    })
    for (const p of polygones(fines, 24)) polys.push(p)
  }
  const m = remplir(polys, 0, 0, L, H)
  const [r, g, b] = couleur
  const n = S * S
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.l; x++) {
      let k = 0
      for (let dy = 0; dy < S; dy++) {
        const ligne = (y * S + dy) * L + x * S
        for (let dx = 0; dx < S; dx++) k += m[ligne + dx]
      }
      if (!k) continue
      const a = k / n
      const i = ((c.y0 + y) * largeur + c.x0 + x) * 4
      const ad = data[i + 3] / 255
      const ao = a + ad * (1 - a)
      data[i] = (r * a + data[i] * ad * (1 - a)) / ao
      data[i + 1] = (g * a + data[i + 1] * ad * (1 - a)) / ao
      data[i + 2] = (b * a + data[i + 2] * ad * (1 - a)) / ao
      data[i + 3] = Math.round(ao * 255)
    }
  }
}

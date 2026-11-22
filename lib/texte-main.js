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
    const chemins = disposer(police, texte, c)
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

/* LES LIGNES DANS LE CADRE : mesurées à 100 unités, puis à l'échelle qui
   les fait tenir. Une ligne seule remplit le cadre par son dessin même
   (ses lettres de haut en bas, comme le texte qu'elle remplace) ; plusieurs
   s'empilent à l'interligne de la police. → des listes de commandes en
   pixels de l'image. */
export function disposer(police, texte, c) {
  const lignes = texte.split('\n')
  const T = 100
  const boites = lignes.map(l => {
    const p = police.getPath(l, 0, 0, T)
    const b = p.getBoundingBox()
    return { l, b, vide: !(b.x2 > b.x1 && b.y2 > b.y1) }
  })
  if (boites.every(x => x.vide)) return []
  const upm = police.unitsPerEm || 1000
  const asc = (police.ascender || upm * 0.8) / upm * T
  const desc = (police.descender || -upm * 0.2) / upm * T
  const seule = lignes.length === 1
  const interligne = asc - desc
  const larg = Math.max(...boites.map(x => x.vide ? 0 : x.b.x2 - x.b.x1))
  const haut = seule ? boites[0].b.y2 - boites[0].b.y1 : interligne * lignes.length
  const L = c.l * (1 - 2 * MARGE), H = c.h * (1 - 2 * MARGE)
  const s = Math.min(L / larg, H / haut)
  if (!(s > 0) || !isFinite(s)) return []
  const cx = c.x0 + c.l / 2
  const hautBloc = haut * s
  const chemins = []
  boites.forEach((x, k) => {
    if (x.vide) return
    const lx = cx - (x.b.x1 + x.b.x2) / 2 * s
    /* Ligne seule : son dessin centré ; sinon sa ligne de base. */
    const ly = seule
      ? c.y0 + c.h / 2 - (x.b.y1 + x.b.y2) / 2 * s
      : c.y0 + (c.h - hautBloc) / 2 + (k * interligne + asc) * s
    chemins.push(police.getPath(x.l, lx, ly, T * s).commands)
  })
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

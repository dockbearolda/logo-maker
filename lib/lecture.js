/* ================================================================ LA LECTURE
   Le texte d'un logo, lu sur le poste (lib/polices.js s'en sert pour
   retrouver sa police). 30 septembre 2026 : « la meilleure IA gratuite
   possible, l'app la plus haut de gamme ». PP-OCRv5 (latin, PaddleOCR,
   Apache-2.0 : vendor/ppocrv5-latin-rec.onnx, 7,9 Mo) remplace Tesseract.
   Mesuré sur 55 lignes de vrais logos clients, lues à la main : 89 % lues
   juste au caractère près contre 74,5 %, une erreur sur cent caractères
   contre huit — les écritures liées (« Persona », « Car Rental », « St
   Martin », « Collège Souamiga ») se lisent droites, sans être redressées.
   Et sa confiance dit vrai : à 95, 98 % des lignes gardées sont justes
   (Tesseract : 83 % à 80).
   Il tourne dans le fil de calcul (lib/detourage-travail.js), sur le
   processeur : une ligne en quelques dizaines de millisecondes. Ici, tout
   ce qui l'entoure, sans navigateur :
   1. L'ENTRÉE (`preparer`) : chaque ligne arrive déjà découpée
      (`imageLigne`, lib/polices.js), l'encre foncée sur du blanc. Recadrée
      sur son encre — les lettres remplissent les 48 pixels de haut que le
      modèle attend (entières dans l'image de ligne, elles n'en feraient que
      24 : neuf lignes sur cent de moins) —, sa largeur au prorata, arrondie
      au multiple de 8 : chaque pas de sortie couvre alors huit colonnes.
   2. LE DÉCODAGE (`decoder`) : à chaque pas, le caractère le plus probable ;
      un caractère par suite de pas identiques, les blancs retirés (CTC).
   3. LA LECTURE (`resultat`) : le texte, sa confiance (la moyenne de ses
      caractères, de 0 à 100), celle de son mot le moins sûr, et le cadre de
      chaque caractère (`symboles`) — ce que lib/polices.js attend. */

/* La hauteur que le modèle attend (son config.json dit 32 : il refuse). */
export const HAUT = 48
/* La marge laissée autour de l'encre, en hauteur d'encre (de 0,10 à 0,25,
   tout se vaut à deux lignes près ; 0,15 est la meilleure). */
export const MARGE = 0.15

/* LE DICTIONNAIRE : la classe 0 est le blanc du CTC, 1 à 502 les lignes de
   dict.txt, la dernière l'espace. */
export function lireDictionnaire(texte) {
  const lignes = String(texte).split(/\r?\n/)
  if (lignes[lignes.length - 1] === '') lignes.pop()
  return ['', ...lignes, ' ']
}

/* Le cadre de l'encre (sous 128), ou null. */
export function cadreEncre({ data, l, h }) {
  let x0 = l, x1 = -1, y0 = h, y1 = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      if (data[y * l + x] >= 128) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  return x1 < 0 ? null : { x0, x1, y0, y1 }
}

/* L'ENTRÉE DU MODÈLE : la ligne recadrée sur son encre, `MARGE` autour,
   remise à 48 de haut (chaque pixel d'arrivée prend la moyenne de ceux
   qu'il couvre ; hors de l'image, du blanc), complétée de blanc jusqu'au
   multiple de 8 ; (x − 127,5) / 127,5 sur trois plans égaux. Rend aussi de
   quoi ramener une colonne du modèle sur l'image de ligne : `sx`, et
   `echelle` pixels de ligne par colonne. */
export function preparer(im) {
  const { data, l, h } = im
  const c = cadreEncre(im)
  const m = Math.round(MARGE * (c.y1 - c.y0 + 1))
  const sx = c.x0 - m, sy = c.y0 - m, sl = c.x1 - c.x0 + 1 + 2 * m, sh = c.y1 - c.y0 + 1 + 2 * m
  const L = Math.max(8, Math.round(HAUT * sl / sh))
  const W = Math.ceil(L / 8) * 8
  const fx = sl / L, fy = sh / HAUT
  const px = (x, y) => (x < 0 || y < 0 || x >= l || y >= h ? 255 : data[y * l + x])
  const plan = W * HAUT
  const entree = new Float32Array(3 * plan).fill(1)
  for (let Y = 0; Y < HAUT; Y++) {
    const ay = sy + Y * fy, by = ay + fy
    for (let X = 0; X < L; X++) {
      const ax = sx + X * fx, bx = ax + fx
      let s = 0, a = 0
      for (let y = Math.floor(ay); y < Math.ceil(by); y++) {
        const wy = Math.min(by, y + 1) - Math.max(ay, y)
        if (wy <= 0) continue
        for (let x = Math.floor(ax); x < Math.ceil(bx); x++) {
          const w = wy * (Math.min(bx, x + 1) - Math.max(ax, x))
          if (w <= 0) continue
          s += w * px(x, y)
          a += w
        }
      }
      const v = s / a / 127.5 - 1
      entree[Y * W + X] = entree[plan + Y * W + X] = entree[2 * plan + Y * W + X] = v
    }
  }
  return { entree, W, sx, echelle: sl / L }
}

/* LE DÉCODAGE CTC : `probs`, T pas de C probabilités. Chaque caractère :
   { c, p (sa plus haute probabilité), t0, t1 (ses pas) }. */
export function decoder(probs, T, C, dict) {
  const cars = []
  let prec = 0
  for (let t = 0; t < T; t++) {
    let k = 0, p = probs[t * C]
    for (let j = 1; j < C; j++) if (probs[t * C + j] > p) { p = probs[t * C + j]; k = j }
    if (k && k === prec) {
      const d = cars[cars.length - 1]
      d.t1 = t
      if (p > d.p) d.p = p
    } else if (k) cars.push({ c: dict[k] ?? '', p, t0: t, t1: t })
    prec = k
  }
  return cars
}

/* LES CADRES EN X, en pixels de l'image de ligne. Le centre d'un
   caractère : le milieu de ses pas, décalé d'un quart de pas (le pic du
   CTC tombe un peu avant le centre de la lettre). La frontière entre deux
   caractères : entre leurs centres, la colonne la moins encrée (la plus
   proche du mi-chemin) ; le premier et le dernier s'arrêtent à un écart
   moyen de leur centre. Chaque cadre se resserre sur son encre — sans
   encre (le « i » d'une ligature « fi », dont le pic tombe dans le jour),
   il va d'un centre voisin à l'autre. Sur 2 036 lettres, à 1,1 pixel de
   leur forme (Tesseract : 2,3). */
export const DECALAGE = 0.25
export function symboles(cars, prep, im) {
  const pas = prep.W / prep.T
  const cs = cars.filter(x => x.c !== ' ').map(x => ({ c: x.c, m: prep.sx + ((x.t0 + x.t1) / 2 + 0.5 + DECALAGE) * pas * prep.echelle }))
  if (!cs.length) return []
  const { data, l, h } = im
  const encre = new Int32Array(l)
  for (let x = 0; x < l; x++) for (let y = 0; y < h; y++) if (data[y * l + x] < 128) encre[x]++
  const ecart = cs.length > 1 ? (cs[cs.length - 1].m - cs[0].m) / (cs.length - 1) : 3 * pas * prep.echelle
  /* La colonne la moins encrée de [a, b], la plus proche de c. */
  const creux = (a, b, c) => {
    a = Math.max(0, Math.round(a))
    b = Math.min(l - 1, Math.round(b))
    let k = -1
    for (let x = a; x <= b; x++) if (k < 0 || encre[x] < encre[k] || (encre[x] === encre[k] && Math.abs(x - c) < Math.abs(k - c))) k = x
    return k < 0 ? Math.round(c) : k
  }
  const bords = [creux(cs[0].m - ecart, cs[0].m, cs[0].m - ecart / 2)]
  for (let i = 0; i + 1 < cs.length; i++) bords.push(creux(cs[i].m, cs[i + 1].m, (cs[i].m + cs[i + 1].m) / 2))
  const z = cs[cs.length - 1].m
  bords.push(creux(z, z + ecart, z + ecart / 2) + 1)
  return cs.map((s, i) => {
    let x0 = Math.max(0, bords[i]), x1 = Math.max(x0, Math.min(l - 1, bords[i + 1] - 1))
    let u = x0, v = x1
    while (u < v && !encre[u]) u++
    while (v > u && !encre[v]) v--
    if (encre[u]) { x0 = u; x1 = v }
    else {
      x0 = Math.max(0, Math.round(i ? cs[i - 1].m : s.m - ecart / 2))
      x1 = Math.min(l - 1, Math.round(i < cs.length - 1 ? cs[i + 1].m : s.m + ecart / 2))
    }
    return { c: s.c, x0, x1 }
  })
}

/* CE QUE LE MODÈLE CONFOND, remis d'après l'encre. `cars` et `syms` sont
   modifiés sur place ; rend le texte.
   - LES PUCES : il lit un point là où le logo pose une puce (« POOL • BAR •
     RESTAURANT » lu « POOL•BAR.RESTAURANT »). Un point, un point médian ou
     une puce — une petite tache, pas une lettre — levé au-dessus du pied
     des lettres est une puce (grande) ou un point médian (petit) ; posé au
     pied, c'est un point : la fin d'une phrase le reste. La virgule basse
     (‚) est une virgule.
   - LE 1 ET LE l : il lit un 1 pour un l nu (« l Office français », son
     apostrophe perdue, lu « 1 Office ») — posé dans sa police, le chiffre
     aurait son drapeau. Dans une ligne de lettres sans autre chiffre, un 1
     (ou une barre) dont l'encre n'est qu'un trait droit, cinq fois plus
     haut que large, est un l — un I dans un mot, ou une ligne, en
     capitales. */
export function retoucher(cars, syms, im) {
  const encre = s => {
    let y0 = -1, y1 = -1
    for (let y = 0; y < im.h; y++) {
      for (let c = s.x0; c <= s.x1; c++) {
        if (im.data[y * im.l + c] < 128) { if (y0 < 0) y0 = y; y1 = y; break }
      }
    }
    return y0 < 0 ? null : { y0, y1 }
  }
  const lettres = syms.filter(s => /[\p{L}\p{N}]/u.test(s.c)).map(encre).filter(Boolean)
  const med = v => v.sort((a, b) => a - b)[v.length >> 1]
  const pied = lettres.length && med(lettres.map(e => e.y1)), haut = lettres.length && med(lettres.map(e => e.y1 - e.y0 + 1))
  let k = 0
  for (const x of cars) {
    if (x.c === ' ') continue
    const s = syms[k++]
    if (x.c === '‚') x.c = s.c = ','
    if (!haut || !'.·•'.includes(x.c)) continue
    const e = encre(s)
    if (!e || e.y1 - e.y0 + 1 > 0.55 * haut || s.x1 - s.x0 + 1 > 0.8 * haut) continue
    x.c = s.c = pied - e.y1 <= 0.2 * haut ? '.' : e.y1 - e.y0 + 1 >= 0.2 * haut ? '•' : '·'
  }
  const texte = cars.map(x => x.c).join('')
  if (/[0-9]/.test(texte.replace(/1/g, '')) || (texte.match(/\p{L}/gu) || []).length < 2) return texte.trim()
  const mots = texte.split(' ')
  let i = 0
  k = 0
  for (const mot of mots) {
    for (const c of mot) {
      const x = cars[i++], s = syms[k++]
      if (c !== '1' && c !== '|') continue
      let colonnes = 0, y0 = -1, y1 = -1
      for (let u = s.x0; u <= s.x1; u++) {
        let encre = false
        for (let y = 0; y < im.h; y++) if (im.data[y * im.l + u] < 128) { encre = true; if (y0 < 0 || y < y0) y0 = y; if (y > y1) y1 = y }
        if (encre) colonnes++
      }
      if (y0 < 0 || colonnes * 5 > y1 - y0 + 1) continue
      const lettres = (mot.match(/\p{L}/gu) || []).length ? mot : texte
      x.c = s.c = /\p{Lu}/u.test(lettres) && !/\p{Ll}/u.test(lettres) ? 'I' : 'l'
    }
    i++
  }
  return cars.map(x => x.c).join('').trim()
}

/* LA LECTURE D'UNE LIGNE : { texte, confiance, mot, symboles } — la
   confiance de la ligne (la moyenne de ses caractères, espaces exclus) et
   celle de son mot le moins sûr (la moyenne de ses caractères ; la
   ponctuation seule ne compte pas), de 0 à 100. */
export function resultat(cars, prep, im) {
  const syms = symboles(cars, prep, im)
  const texte = retoucher(cars, syms, im)
  const utiles = cars.filter(x => x.c !== ' ')
  const moyenne = v => 100 * v.reduce((s, x) => s + x.p, 0) / v.length
  let mot = utiles.length ? 100 : 0, courant = []
  const finir = () => {
    if (courant.some(x => /[\p{L}\p{N}]/u.test(x.c))) mot = Math.min(mot, moyenne(courant))
    courant = []
  }
  for (const x of cars) { if (x.c === ' ') finir(); else courant.push(x) }
  finir()
  return { texte, confiance: utiles.length ? moyenne(utiles) : 0, mot, symboles: syms }
}

/* LES LIGNES LUES, l'une après l'autre. `calculer(entree, W)` fait tourner
   le modèle sur une entrée de 1 × 3 × 48 × W et rend { probs, T, C }. Une
   ligne sans encre, ou que le modèle n'a pas lue, rend une lecture vide. */
export async function lireLignes(images, calculer, dict) {
  const sortie = []
  for (const im of images) {
    try {
      if (!cadreEncre(im)) throw new Error('vide')
      const prep = preparer(im)
      const { probs, T, C } = await calculer(prep.entree, prep.W)
      if (C !== dict.length) throw new Error('dictionnaire : ' + dict.length + ' classes, le modèle ' + C)
      sortie.push(resultat(decoder(probs, T, C, dict), Object.assign(prep, { T }), im))
    } catch (e) {
      if (/dictionnaire/.test(e.message)) throw e
      sortie.push({ texte: '', confiance: 0, mot: 0, symboles: [] })
    }
  }
  return sortie
}

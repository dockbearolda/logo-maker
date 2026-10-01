/* ====================================================== LES ÉQUIVALENTS
   1er octobre 2026. Une police libre de Google qui est la jumelle d'une
   police commerciale : la bulle le dit (« ≈ Futura »), et chercher le nom
   commercial la trouve (« Gotham » → Montserrat). La vendeuse sait ainsi
   ce que le client a pris, et ce qu'on pose à sa place. Seulement des
   paires connues des graphistes — métriquement compatibles (Arimo,
   Tinos, Carlito, Caladea, Gelasio) ou dessinées d'après l'originale ;
   pas de ressemblance de hasard. Toutes dans vendor/polices/index.json
   (lib/equivalents.test.mjs le vérifie). */
export const EQUIVALENTS = {
  arimo: ['Arial', 'Helvetica'],
  tinos: ['Times New Roman'],
  carlito: ['Calibri'],
  caladea: ['Cambria'],
  gelasio: ['Georgia'],
  'comic-neue': ['Comic Sans'],
  jost: ['Futura'],
  'league-spartan': ['Futura'],
  montserrat: ['Gotham'],
  anton: ['Impact'],
  oswald: ['Alternate Gothic'],
  'eb-garamond': ['Garamond'],
  'libre-baskerville': ['Baskerville'],
  'libre-caslon-text': ['Caslon'],
  'libre-bodoni': ['Bodoni'],
  'bodoni-moda': ['Bodoni'],
  'gfs-didot': ['Didot'],
  'libre-franklin': ['Franklin Gothic'],
  cinzel: ['Trajan'],
  michroma: ['Eurostile', 'Microgramma'],
  rokkitt: ['Rockwell'],
  'source-sans-3': ['Myriad'],
  'crimson-text': ['Minion'],
}

/* « ≈ Futura » : les noms commerciaux d'une famille libre, ou ''. */
export const equivalentDe = id => EQUIVALENTS[id] ? '≈ ' + EQUIVALENTS[id].join(', ') : ''

/* LA RECHERCHE D'UNE POLICE PAR SON NOM, dans `catalogue` ([{ id, nom,
   style, source }]) : les familles dont le nom — ou le nom commercial de
   leur jumelle — contient chaque mot tapé, sans accents ni casse ; celles
   dont le nom commence par la recherche d'abord, puis la police droite
   avant l'italique, celles du poste avant celles de Google à nom égal (la
   vraie avant sa copie). Au plus `n`. */
const plat = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
export function chercherPolices(catalogue, texte, n = 8) {
  const mots = plat(texte).split(/\s+/).filter(Boolean)
  if (!mots.length) return []
  const rang = { poste: 0, ajout: 0, google: 1 }
  const trouves = []
  for (const f of catalogue) {
    const nom = plat(f.nom)
    const autres = (EQUIVALENTS[f.id] || []).map(plat)
    const dans = t => mots.every(m => t.includes(m))
    const parNom = dans(nom)
    if (!parNom && !autres.some(dans)) continue
    const debut = parNom ? (nom.startsWith(mots[0]) ? 0 : 1) : 2
    trouves.push({ f, cle: [debut, f.style === 'italic' ? 1 : 0, nom.length, rang[f.source] ?? 1, nom] })
  }
  trouves.sort((a, b) => {
    for (let k = 0; k < a.cle.length; k++) if (a.cle[k] !== b.cle[k]) return a.cle[k] < b.cle[k] ? -1 : 1
    return 0
  })
  return trouves.slice(0, n).map(t => t.f)
}

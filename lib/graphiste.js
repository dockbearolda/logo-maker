/* =============================================================== LE GRAPHISTE
   27 septembre 2026 : « c'est devenu une usine à gaz. Intègre l'équivalent
   du meilleur graphiste au monde, qu'il comprenne exactement ce qu'on veut :
   conserver le plus fidèlement les logos pourris des clients, pour en faire
   le fichier vectorisé le plus propre et le plus parfait possible, du haut
   de gamme — qu'il prenne les décisions pour être fidèle au logo ».
   Le graphiste lit le fichier et décide, ici, en un seul endroit ; trois
   curseurs (le seuil du fond, le lissage du tracé, les nuances des
   couleurs) partent de ses choix et l'ajustent (28 septembre 2026). Ce
   qu'il fait :
   1. LE NET. Un petit fichier (jusqu'à 1 300 px de grand côté) est redessiné
      net, quatre fois plus grand, par l'IA (lib/nettoyage.js) — le JPEG de
      WhatsApp, la capture d'écran. Un fichier qui a de la MATIÈRE — une
      broderie, du cuir, de l'eau, du feu, des paillettes, une photo —
      passe à l'IA des photos, qui garde ses fils et son grain, jusqu'à
      1 800 px (29 septembre 2026, lib/detourage.js, `aDeLaMatiere`). Un logo
      à plat passe en ULTRA (30 septembre 2026) quand le poste la fait en
      moins d'une minute : des bords plus fidèles — une matière aussi (1er
      octobre 2026). Un fichier FLOU — une photo mise au point à côté, un
      logo agrandi de capture en capture — est RENDU NET d'abord, à toutes
      les tailles (30 septembre 2026, « la feature de PicWish »,
      lib/nettete.js) : son flou mesuré sur ses bords, retiré, puis l'IA.
   2. LE FOND. Un fond uni — blanc, noir, de couleur, le faux damier — part
      à la couleur près ; un vrai décor, une photo, passe à l'IA qui trouve
      le sujet (lib/detourage.js, `methodeConseillee`) — et une
      illustration peinte collée sur sa carte, par BiRefNet (voir
      `decider`).
   3. LES CREUX, PARTOUT. Le fond vu à travers le dessin part aussi : le
      creux d'un O, le blanc entre un O et sa pastille, le jour entre deux
      plumes, le noir enfermé dans un cercle de filets dorés (« il va de soi
      que je veux retirer le noir » ; « quand j'ouvre dans Illustrator, les
      intérieurs sont pleins : ça doit être transparent »). Seul part ce qui
      a la couleur du fond et un bord net ; le reflet pâle d'un dégradé,
      qui fond doucement, reste du dessin (lib/detourage.js, `creux`). Un
      clic sur « Autour » les garde.
   4. LE TRACÉ, toujours le même : le contour au demi-pixel de la couverture
      de chaque teinte, ronds au compas, droites à la règle, angles vifs,
      miettes du JPEG balayées, noir et blanc purs (lib/vecteur-lisse.js,
      lib/geometrie.js).
   5. LES COULEURS. Rien ne s'invente. Un logo à plat sort en aplats, ses
      teintes exactes ; un logo qui a du modelé — un dégradé, un doré qui
      brille — garde les couleurs du fichier dans son contour vectoriel
      (`estDegrade`, `remplir`).
   6. LA SORTIE : un PDF vectoriel, sans couche de blanc DTF (le RIP la
      fait, 17 novembre 2026).
   On le contredit au besoin, dans le panneau : l'IA, le fond, le seuil,
   le lissage, les nuances. */
import { methodeConseillee, aDeLaMatiere, imageCollee, estIllustration, HD_PX } from './detourage.js'
import { flouDe } from './nettete.js'
import { paletteAuto } from './vectoriser.js'

/* Jusqu'à 1 300 px de grand côté, le fichier se nettoie d'office (29
   septembre 2026 : à 900, « l'Orthopédie de la tête aux pieds », 1 078 px,
   ressortait inégal ; nettoyé, net — l'IA voit le fichier entier jusqu'à
   1 280 px, lib/nettoyage.js). */
export const PETIT = 1300

/* Jusqu'à 1 800 px, un fichier qui a de la matière s'agrandit d'office :
   une photo en dessous n'est pas HD (lib/detourage.js, `HD_PX`), et la
   broderie « BEA-16 », 1 447 px pour 30 cm de large, n'y a que 99 dpi —
   ses fils sortent mous. */
export const PETITE_MATIERE = HD_PX

/* Au-delà de 1 pixel de flou vu sur l'aperçu (lib/nettete.js, `flouDe`,
   `vu`), le fichier est flou : « Améliorer la netteté » d'office. Mesuré
   le 1er octobre 2026 (le flou lu aux trois quarts des bords, plus la
   médiane) sur les 70 fichiers clients de l'atelier, à leur taille
   (1 400 px au plus, comme l'aperçu) : le t-shirt photographié « I'M HIS
   FAVORITE EX », 2,2, et un selfie WhatsApp mou, 1,1, le dépassent ; tous
   les autres sont sous 0,9 (la photo du restaurant, son fond flou, 0,86 ;
   les logos nets, sous 0,7). Neuf logos floutés de 1,5 px et passés en
   JPEG : huit le dépassent, contre trois à 1,2 avec la médiane. */
export const FLOU_NET = 1

/* Le lissage du tracé (0 à 100, lib/vecteur-lisse.js) : les arrondis
   nets sans facettes, les angles francs — là où part le curseur. */
export const LISSAGE = 70

/* CE QU'IL DÉCIDE, sur l'aperçu de l'image de travail (`apercu` : ses
   pixels RVBA et ses dimensions) et les dimensions du fichier reçu :
   - `fond` : 'uni' (à la couleur) ou 'ia' (le sujet d'une photo) ;
   - `creux` : le fond enfermé dans le dessin part aussi (« Partout ») ;
   - `nettoyer` : l'IA redessine d'abord le fichier, net ;
   - `matiere` : il a de la matière (une photo en a toujours) — l'IA des
     photos le redessine, pas celle des logos ;
   - `birefnet` : le sujet, seulement si BiRefNet le trouve — sinon, à la
     couleur ;
   - `flou` : le flou à retirer, en pixels de l'image de travail (l'aperçu
     ramené à sa taille : `apercu.echelle`) ; `net` : le flou vu est assez
     grand pour le retirer d'office — l'IA passe alors, quelle que soit la
     taille.
   UNE ILLUSTRATION COLLÉE (30 septembre 2026, « Strong Together » et son
   ruban, deux fichiers d'une cliente passés par ChatGPT faute de mieux :
   « je souhaite que mon app arrive à ce genre d'équivalent, surtout au
   niveau de la transparence arrière »). Une image qui a de la matière,
   collée sur sa carte au milieu d'une toile transparente (le PNG de
   Canva), est une illustration peinte avec son décor — un ciel, la mer,
   l'ombre d'un ruban. Le fond à la couleur n'emporte que le blanc de la
   carte ; BiRefNet, qui ne regarde qu'elle (lib/sujet.js, `rogner`),
   trouve la femme, ses fleurs, son ruban, vide la boucle et laisse
   l'ombre. Le blanc de la carte part toujours avec (lib/detourage-travail.js,
   `detourage`) : le sujet ne garde jamais plus que la couleur. Sans
   BiRefNet (pas de carte graphique qui calcule en demi-précision), ISNet
   y perdrait le ruban : le fond reste à la couleur. */
/* LA VERSION (30 septembre 2026 : « que l'app devine directement le
   meilleur réglage pour un rendu optimal, si c'est une photo, une image ou
   si c'est parfaitement vectoriel ») : le graphiste lit le fichier et ouvre
   - une PHOTO (un vrai décor, le sujet trouvé par l'IA) en DÉTOURÉ : ses
     pixels, rien de tracé — le seul produit non vectoriel de l'atelier ;
   - une IMAGE — de la matière, une illustration peinte collée sur sa carte,
     une illustration aux couleurs sans nombre (`illustration`) — en IMAGE :
     les pixels du fichier dans le contour vectoriel, dégradés et textures
     intacts ;
   - un LOGO À PLAT en VECTEUR : de vraies formes, nettes à toute taille.
   Le tracé, quand il arrive, peut encore passer d'Image à Vecteur ou
   l'inverse selon le modelé qu'il mesure (lib/studio-detourage.js) ; un
   clic de la vendeuse sur une version l'emporte sur tout. */
/* UNE AQUARELLE N'EST PAS UN LOGO À PLAT (27 novembre 2026, Instant
   Floral : des pétales en lavis rose, des lettres au pinceau — « c'est une
   image, on doit pouvoir parfaitement la détourer, vecteur et image ; j'ai
   besoin que l'app sache gérer Instant Floral »). Elle tient en trois ou
   quatre teintes, `estIllustration` la prenait pour un logo, et Logo maker
   la traçait en aplats : ses lavis perdus, ses lettres pas remplies. Ce qui
   la trahit : des tons hors de ses teintes AU MILIEU de ses surfaces, loin
   de tout bord (un logo à plat n'en a qu'au ras de ses bords :
   l'anticrénelage, le JPEG), et LISSES (sans grain). Le grain d'un imprimé
   photographié — l'encre sur un papier, sur un tissu — en fait aussi, mais
   qui s'écartent FORT de leur teinte (un bleu nuit qui passe au bleu
   pâle) ; ceux d'un lavis, doucement. Une aquarelle : plus de `LAVIS` des
   pixels du dessin en tons lisses hors teintes, et pas plus de la moitié
   (`LAVIS_FORT`) de ses tons hors teintes à plus de 48 niveaux.
   Mesuré sur les logos de ~/Downloads : Instant Floral 31 % (0,16), sa
   version « Logo floral » 12 % (0,41), le flocon translucide de Clear Ice
   13 % (0,29) ; Aimé Leon Dore photographié sur papier 13 % (0,81) et New
   Balance 9 % restent des logos, les logos à plat sous 5 %. */
export const LAVIS = 0.1
export const LAVIS_FORT = 0.5
export function estAquarelle(data, L, H, fonds = []) {
  const m = mesurerLavis(data, L, H, fonds)
  return m.lisse >= LAVIS && m.fort <= LAVIS_FORT * m.hors
}
export function mesurerLavis(data, L, H, fonds = []) {
  const N = L * H
  /* Le dessin seul : le fond (à 28 niveaux près) mis à part. */
  const dessin = new Uint8ClampedArray(data)
  for (let i = 0; i < dessin.length; i += 4) {
    if (fonds.some(f => Math.abs(data[i] - f[0]) + Math.abs(data[i + 1] - f[1]) + Math.abs(data[i + 2] - f[2]) < 28)) dessin[i + 3] = 0
  }
  const pal = paletteAuto(dessin, fonds)
  if (!pal.length) return { lisse: 0, fort: 0, hors: 0 }
  /* Les bords francs (plus de 60 niveaux d'un voisin à l'autre), élargis
     d'un trois-centième du grand côté (3 pixels au moins). */
  const bord = new Uint8Array(N)
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < L - 1; x++) {
    const i = (y * L + x) * 4
    let g = 0
    for (const o of [4, 4 * L]) for (let c = 0; c < 4; c++) g = Math.max(g, Math.abs(data[i + o + c] - data[i - o + c]))
    if (g > 60) bord[y * L + x] = 1
  }
  const r = Math.max(3, Math.round(Math.max(L, H) / 300))
  const pres = elargir(elargir(bord, L, H, r, 1, L), H, L, r, L, 1)
  let n = 0, hors = 0, lisse = 0, fort = 0
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < L - 2; x++) {
    const p = y * L + x, i = p * 4
    if (dessin[i + 3] < 250) continue
    n++
    if (pres[p]) continue
    let m = Infinity
    for (const c of pal) m = Math.min(m, (data[i] - c[0]) ** 2 + (data[i + 1] - c[1]) ** 2 + (data[i + 2] - c[2]) ** 2)
    if (m <= 24 * 24) continue
    hors++
    if (m > 48 * 48) fort++
    let g = 0
    for (const o of [8, 8 * L]) for (let c = 0; c < 3; c++) g = Math.max(g, Math.abs(data[i + o + c] - data[i - o + c]))
    if (g < 12) lisse++
  }
  return n ? { lisse: lisse / n, fort: fort / n, hors: hors / n } : { lisse: 0, fort: 0, hors: 0 }
}
/* `m` élargi de `r` le long de lignes de `n` pixels (`pas` entre deux
   pixels d'une ligne, `saut` entre deux lignes, `lignes` lignes). */
function elargir(m, n, lignes, r, pas, saut) {
  const s = new Uint8Array(m.length)
  for (let l = 0; l < lignes; l++) {
    const o = l * saut
    let dernier = -Infinity
    for (let k = 0; k < n; k++) { if (m[o + k * pas]) dernier = k; if (k - dernier <= r) s[o + k * pas] = 1 }
    dernier = Infinity
    for (let k = n - 1; k >= 0; k--) { if (m[o + k * pas]) dernier = k; if (dernier - k <= r) s[o + k * pas] = 1 }
  }
  return s
}

export function decider(apercu, fichier) {
  const c = methodeConseillee(apercu.data, apercu.largeur, apercu.hauteur)
  const matiere = c.methode === 'ia' || aDeLaMatiere(apercu.data, apercu.largeur, apercu.hauteur, c.fonds)
  const grand = Math.max(fichier.largeur, fichier.hauteur)
  const collee = c.methode === 'uni' && matiere && !!imageCollee(apercu.data, apercu.largeur, apercu.hauteur)
  const illustration = c.methode === 'uni' && !c.logo && estIllustration(apercu.data, c.fonds)
  const aquarelle = c.methode === 'uni' && !matiere && !illustration && estAquarelle(apercu.data, apercu.largeur, apercu.hauteur, c.fonds)
  const f = flouDe(apercu.data, apercu.largeur, apercu.hauteur)
  const sigma = f ? f.sigma : 0
  const net = !!f && f.vu >= FLOU_NET
  const genre = c.methode === 'ia' && !collee ? 'photo' : matiere || illustration || aquarelle ? 'image' : 'logo'
  return {
    fond: collee ? 'ia' : c.methode,
    creux: true,
    /* Un imprimé photographié (un fond ombré, `c.ombre`) passe à l'IA
       jusqu'à 1 800 px, comme la matière : une photo n'a jamais le net
       d'un fichier — l'IA des logos y remet ses aplats à plat. */
    nettoyer: net || (matiere ? grand <= PETITE_MATIERE : c.methode === 'uni' && grand <= (c.ombre ? PETITE_MATIERE : PETIT)),
    matiere,
    birefnet: collee,
    flou: Math.round(sigma / (apercu.echelle || 1) * 100) / 100,
    net,
    genre,
    version: genre === 'photo' ? 'detoure' : genre === 'image' ? 'image' : 'vecteur',
    /* `ombre` : le fond est un tissu, un papier photographiés, à éclairer à
       plat avant de le retirer (lib/detourage.js, `fondOmbre`). */
    ombre: !!c.ombre,
    /* `aquarelle` : son blanc est le papier — le fond, même d'un bord doux
       (lib/detourage.js, `creux`). */
    aquarelle,
  }
}

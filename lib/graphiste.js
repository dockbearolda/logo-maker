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
      moins de 40 secondes : des bords plus fidèles.
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
   6. LA SORTIE : un PDF vectoriel, la couche de blanc DTF (Spot_1)
      comprise.
   On le contredit au besoin, dans le panneau : l'IA, le fond, le seuil,
   le lissage, les nuances. */
import { methodeConseillee, aDeLaMatiere, imageCollee, HD_PX } from './detourage.js'

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
     couleur.
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
export function decider(apercu, fichier) {
  const c = methodeConseillee(apercu.data, apercu.largeur, apercu.hauteur)
  const matiere = c.methode === 'ia' || aDeLaMatiere(apercu.data, apercu.largeur, apercu.hauteur, c.fonds)
  const grand = Math.max(fichier.largeur, fichier.hauteur)
  const collee = c.methode === 'uni' && matiere && !!imageCollee(apercu.data, apercu.largeur, apercu.hauteur)
  return {
    fond: collee ? 'ia' : c.methode,
    creux: true,
    nettoyer: matiere ? grand <= PETITE_MATIERE : c.methode === 'uni' && grand <= PETIT,
    matiere,
    birefnet: collee,
  }
}

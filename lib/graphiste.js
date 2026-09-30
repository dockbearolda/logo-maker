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
      WhatsApp, la capture d'écran.
   2. LE FOND. Un fond uni — blanc, noir, de couleur, le faux damier — part
      à la couleur près ; un vrai décor, une photo, passe à l'IA qui trouve
      le sujet (lib/detourage.js, `methodeConseillee`).
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
import { methodeConseillee } from './detourage.js'

/* Jusqu'à 1 300 px de grand côté, le fichier se nettoie d'office (29
   septembre 2026 : à 900, « l'Orthopédie de la tête aux pieds », 1 078 px,
   ressortait inégal ; nettoyé, net — l'IA voit le fichier entier jusqu'à
   1 280 px, lib/nettoyage.js). */
export const PETIT = 1300

/* Le lissage du tracé (0 à 100, lib/vecteur-lisse.js) : les arrondis
   nets sans facettes, les angles francs — là où part le curseur. */
export const LISSAGE = 70

/* CE QU'IL DÉCIDE, sur l'aperçu de l'image de travail (`apercu` : ses
   pixels RVBA et ses dimensions) et les dimensions du fichier reçu :
   - `fond` : 'uni' (à la couleur) ou 'ia' (le sujet d'une photo) ;
   - `creux` : le fond enfermé dans le dessin part aussi (« Partout ») ;
   - `nettoyer` : l'IA redessine d'abord le fichier, net. */
export function decider(apercu, fichier) {
  const c = methodeConseillee(apercu.data, apercu.largeur, apercu.hauteur)
  return {
    fond: c.methode,
    creux: true,
    nettoyer: c.methode === 'uni' && Math.max(fichier.largeur, fichier.hauteur) <= PETIT,
  }
}

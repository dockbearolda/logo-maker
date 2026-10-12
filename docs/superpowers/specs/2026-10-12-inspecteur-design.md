# L'inspecteur — conception

12 octobre 2026. Charlie : « Quand je veux modifier une forme, une lettre
ou autre, la bulle de modification s'ouvre directement sur l'objet que je
souhaite modifier, c'est insupportable. Fais le nécessaire pour avoir du
haut de gamme : tout doit être fluide et ultra agréable à utiliser, bien
pensé et intelligent. »

Ce qui existe (PR #33, #34) : un clic sur une ligne de texte ou une forme
du logo ouvre SA BULLE SUR LE PLAN — 320 px de large, jusqu'à 600 px de
haut (les polices, la recherche, le gras, la couleur, la géométrie,
Retirer) — posée sous l'élément, ou au-dessus faute de place. Sur un logo
qui remplit le plan (le cas normal), elle recouvre le texte qu'on édite et
ses voisins, déborde du plan en bas, et se referme au moindre clic
ailleurs (un curseur du panneau, la version, le fond).

## 1. Le principe : rien ne flotte sur le logo

Le plan montre la SÉLECTION (son cadre, ses poignées, le survol) ; le
panneau de droite montre SES PROPRIÉTÉS — un INSPECTEUR qui remplace les
réglages du logo tant qu'un élément est choisi, et s'efface quand on
désélectionne. C'est le modèle de Figma, Photoshop, Illustrator : la toile
reste entière, les réglages ont une place fixe où l'œil sait aller.

Ce qui remplace la décision du 30 septembre (« la police se choisit sur le
plan, pas dans une barre latérale qui s'allonge ») : la barre ne s'allonge
pas, elle CHANGE DE VUE — un seul élément à la fois, à la place des
réglages, jamais onze blocs de polices empilés. Le choix se fait toujours
depuis le plan (un clic sur le texte), chaque police toujours dans son
propre dessin.

## 2. Ce que voit la vendeuse

- Un clic sur un texte ou une forme du logo (sur le plan, ou sur sa ligne
  du bloc « Calques ») le SÉLECTIONNE — cadre, poignées — et le panneau
  GLISSE vers son inspecteur (180 ms) : en tête, « ← » (retour aux
  réglages du logo), le titre (pour une ligne : son texte, à corriger s'il
  est mal lu ; pour une forme : sa pastille et « Forme ») et « ‹ › » pour
  passer d'un élément du logo au suivant. Dessous, par blocs : POLICE (le
  dessin d'origine, les polices proposées chacune dans son dessin, la
  recherche par nom, les polices du poste), GRAS AUTOUR, COULEUR,
  GÉOMÉTRIE (X, Y, L, H, ∠, retourner, replacer), RETIRER. Pour une forme :
  COULEUR, GÉOMÉTRIE, RETIRER. Pour plusieurs éléments (Maj) : « 2
  éléments », retourner, replacer, retirer.
- Le plan reste entièrement visible. Un élément choisi depuis le bloc
  « Calques » vient à l'écran par un glissement de la vue (220 ms), pas
  d'un saut.
- Retour : Échap, « ← », ou un clic sur le vide du plan. Le panneau
  revient aux réglages du logo, à la position de défilement qu'il avait.
- L'inspecteur RESTE pendant un déplacement, un redimensionnement, une
  rotation (sa géométrie se met à jour au relâchement), un changement de
  police, un changement de version ou de fond. Il ne se ferme que par un
  geste qui change de mode : la gomme, Comparer, un autre fichier.
- Un clic sur de l'encre qui n'est pas une forme listée (une miette, une
  lettre soudée au dessin) ouvre toujours « Élément » (sa couleur,
  Retirer), sans cadre.
- Le pied du panneau (Taille DTF, Blanc DTF, le PDF) reste en bas dans
  les deux vues : on exporte sans quitter l'élément.
- La GOMME : la bulle du lasso (Combler, Retirer) se pose HORS du cadre du
  lasso — dessous, sinon dessus, sinon à côté — jamais sur ce qu'on vient
  d'entourer.

## 3. Le modèle : l'inspecteur est une vue de la sélection

Plus d'état « bulle ouverte » (`popPolice`, `popElement`) à côté de la
sélection : l'inspecteur SE DÉDUIT de `E.choix`.

- `ligneInspectee()` : la ligne choisie seule, ou -1.
- `elementInspecte()` : la forme choisie seule (`{ u, v, id }`), ou, sans
  sélection, le point d'encre cliqué (`E.point`, `{ u, v }`, id -1).
- Plusieurs éléments choisis : le groupe.
- `majInspecteur()` (depuis `majPolice`, comme les deux bulles avant) :
  bâtit le HTML du sujet, le pose s'il a changé (sans redessiner un champ
  qu'on tape, le bouton qui a la main la garde), bascule
  `.o-studio-defile` ↔ `.o-studio-inspecteur` avec l'animation, sauve et
  rend la position de défilement, revient en haut quand le SUJET change.
- Une sélection qui n'existe plus (une forme retirée, une ligne retirée,
  les formes recalculées sous un autre seuil) sort de `E.choix`
  (`elementsChoisis`) : l'inspecteur se ferme de lui-même. « Retirer »
  vide la sélection tout de suite (l'inspecteur ne traîne pas 200 ms sur
  un élément parti).

Les actions existantes gardent leurs noms (`ligne-police`,
`essayer-police`, `ligne-couleur`, `element-couleur`, `retirer-element`,
`retirer-ligne`, `geo-*`, `texte-ligne`, `cherche-police`, `gras`) ;
s'ajoutent `insp-retour` et `insp-suivant` (± 1 dans la liste des éléments
du logo : les lignes non retirées, puis les formes listées).

## 4. Ce qui ne change pas

Le calcul, les fils, les réglages, l'historique, les exports : pas un
octet. Les bancs de rejeu restent valables tels quels. La sélection sur le
plan (prise, poignées, guides, flèches, Suppr) ne change pas.

## 5. Vérification

- `node --test` vert.
- Chrome Playwright sans fenêtre : Logo SSV ouvert ; un clic sur « SEA
  VIEW » → l'inspecteur paraît dans le panneau, aucune bulle sur le plan,
  le cadre de la ligne entièrement visible ; une police choisie → la ligne
  reposée, l'inspecteur reste ; Échap → les réglages reviennent ; un clic
  sur une forme → son inspecteur ; « › » → l'élément suivant ; le lasso →
  sa bulle hors de son cadre.
- À l'œil, dans l'aperçu : 1 180 px et 1 024 px de large.

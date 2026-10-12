# Les calques déplacés — conception

12 octobre 2026. Charlie : « Déplacer ou redimensionner un calque, ça doit
être ultra pro et bien fait, je veux qu'on soit au niveau d'un logiciel
comme Photoshop, je dois pouvoir démonter un logo comme je le souhaite
ultra facilement. »

Ce qui existe (PR #33) : un calque est un élément lu — une LIGNE DE TEXTE
ou une FORME d'un seul tenant de l'image détourée (lib/calques.js) —, qu'on
retire, remet, recolore ; la gomme ; tout dans les réglages (photos de
l'historique, jamais de pixels). Ce document ajoute la TRANSFORMATION d'un
calque : déplacé, redimensionné, tourné, retourné — à la souris sur le
plan, au clavier, ou au millimètre dans sa bulle — et sa sélection
multiple.

## 1. Ce que voit la vendeuse

- Un clic sur un élément (sur le plan ou dans le bloc « Calques ») le
  SÉLECTIONNE : son cadre en plein, huit poignées (coins, milieux des
  côtés), et sa bulle (celle d'aujourd'hui — Retirer, couleur, police —
  avec une section GÉOMÉTRIE : X, Y, L, H en millimètres, un cadenas de
  proportions, l'angle en degrés, « Retourner » ↔ ↕, « Replacer »).
  Maj + clic ajoute ou retire un élément de la sélection (plusieurs
  formes et lignes ensemble : un cadre commun, pas de bulle).
- GLISSER l'élément (ou n'importe quel point de la sélection) le DÉPLACE ;
  glisser un élément non sélectionné le sélectionne et le déplace dans le
  même geste (Photoshop, « sélection automatique »). Pendant le geste :
  l'élément suit la souris à 60 fps (un aperçu : l'image sans lui, son
  trou rebouché, et ses pixels dessinés par la toile), les GUIDES
  MAGENTA de l'alignement (le centre et les bords de l'image, les bords et
  centres des autres éléments ; à 5 px d'écran, Ctrl les coupe), et une
  étiquette qui dit la position en mm. Au relâchement, le calcul repart
  (aperçu, pleine taille, tracé, polices) : les trois versions et les
  exports suivent. Ctrl Z défait.
- Une POIGNÉE DE COIN redimensionne EN PROPORTION, le coin opposé fixe
  (Maj : librement ; Alt : autour du centre). Une poignée de côté étire ce
  côté seul. L'étiquette dit L × H en mm et le pourcentage.
- Juste À L'EXTÉRIEUR d'un coin, le curseur devient une flèche courbe : on
  TOURNE autour du centre (Maj : par 15°). L'étiquette dit l'angle.
- Les flèches du clavier poussent la sélection d'un pixel d'écran (Maj :
  dix). Suppr ou Retour arrière la retire (comme « Retirer »). Échap
  désélectionne ; pendant un geste, l'annule.
- Dans la bulle, la GÉOMÉTRIE se tape : X et Y (le coin haut gauche du
  cadre, en mm du logo imprimé), L et H (le cadenas garde la proportion),
  l'angle ; « Retourner » renverse horizontalement ou verticalement ;
  « Replacer » remet l'élément à sa place et à sa taille d'origine.
- Un élément déplacé se superpose aux autres (il est posé par-dessus). Un
  logo qu'on ne touche pas ne change pas d'un octet.
- Rien n'est « recomposé » ailleurs que par la vendeuse : aucun
  déplacement d'office.

## 2. Le modèle : une transformation par élément, dans les réglages

`E.reglages.transformations` : une liste, une entrée au plus par élément,
chacune relative à la PLACE D'ORIGINE de l'élément (son adresse est celle
de `effaces` et `teintesElements`) :

```
{ u, v, aire,                       // une forme : son point sûr, sa part de l'image
  ligne: { cx, cy, h }, cadre, poly, // ou une ligne : sa place, son cadre (son tour en rond)
  pivot: [px, py], d: [dx, dy], angle, s: [sx, sy] }
```

Toutes les longueurs sont en LARGEURS D'IMAGE (x / L, y / L, pour les deux
axes) : un espace isotrope, où une rotation reste une rotation, et le même
nombre vaut pour l'aperçu (1 400 px), l'image pleine et l'image agrandie
par l'IA (même rapport). `pivot` : le centre du cadre d'origine de
l'élément, pris une fois (le studio le lit sur le cadre de la forme ; il ne
bouge plus). Un point `p` de l'élément va en

```
p' = pivot + d + R(angle) · S(sx, sy) · (p − pivot)
```

(le modèle de Photoshop : l'échelle dans les axes propres du calque, puis
la rotation, puis la translation). Cette forme est FERMÉE sous tous les
gestes — déplacer : `d += δ` ; tourner de φ autour du centre courant :
`angle += φ` ; redimensionner de (kx, ky) dans les axes propres autour
d'un point fixe F : `s *= (kx, ky)`, puis `d` recalculé pour que F ne
bouge pas ; retourner : `sx = −sx` — et jamais de cisaillement. Une entrée
revenue à l'identité (`d` nul, angle 0, `s` = (1, 1)) est retirée de la
liste : « Replacer ».

Pour un GROUPE (sélection multiple), le geste est un déplacement, une
rotation autour du centre du groupe, ou une mise à l'échelle UNIFORME
autour d'un coin ou du centre du groupe ; ces trois-là se reportent
exactement sur chaque entrée (la rotation et l'échelle uniforme commutent
avec la rotation propre). L'étirement d'un seul côté d'un groupe n'est
offert que si aucun élément du groupe n'est tourné.

L'historique photographie `reglages` : « Élément déplacé », « Élément
agrandi » / « réduit », « Élément tourné », « Élément retourné »,
« Élément replacé », et « Ligne … » pour une ligne (lib/historique.js,
`decrire`, par comparaison des entrées). Ctrl Z les défait comme le reste.
Les entrées se reportent d'une image à l'autre (l'IA qui refait l'image)
par leur adresse en fractions, comme `effaces`.

## 3. Le rendu : des pixels transformés, et des lettres de police
   transformées

### 3.1 Le pipeline du détourage (lib/detourage-travail.js, `detourage`)

```
detourer / poserSujet → calques() → effacer → recolorer → TRANSFORMER
```

`transformer(data, largeur, hauteur, transformations)` (nouveau
`lib/transformer.js`, pur, testé seul), en DEUX TEMPS pour que chaque
élément se lise sur l'image d'origine (deux éléments qui échangent leurs
places ne se gênent pas) :

1. Pour chaque entrée, LA SÉLECTION de ses pixels : la même règle
   qu'`effacer` (une forme : le pixel d'encre le plus proche du point à
   `PRES`, huit voisins, l'encre à un huitième d'opacité, la tolérance
   d'aire ×3 ; une ligne : chaque forme pour moitié dans son cadre ou son
   polygone) et son liseré presque transparent. La sélection est extraite
   de lib/effacer.js (`selection`) et partagée par `effacer`, `recolorer`
   et `transformer` — mêmes octets qu'avant pour les deux premiers (banc
   de rejeu). Chaque sélection devient un SPRITE (RVBA, son cadre), puis
   ses pixels sont coupés (alpha 0, le liseré aussi).
2. LE TROU se rebouche quand l'élément était posé sur du dessin : si la
   moitié au moins de l'anneau à deux pixels du trou est opaque, le trou
   est comblé par lib/combler.js (`combler` : l'aplat de l'anneau à ΔE 5,
   sinon de proche en proche puis détendu — le texte sur un badge laisse
   le badge entier) ; sinon (l'élément était sur le vide) il reste
   transparent. Sur une photo, c'est le même rebouchage à la couleur —
   pas MI-GAN : il faudrait une session du modèle dans chacun des trois
   fils de détourage (aperçu, pleine taille, tracé) ; la gomme et le texte
   reposé, qui passent par le fil de l'IA, gardent MI-GAN.
3. Chaque sprite est POSÉ à sa nouvelle place, dans l'ordre de la liste
   (le dernier déplacé dessus) : la matrice en pixels (M = pivot, d, angle,
   s multipliés par `largeur`), le cadre d'arrivée = M(cadre du sprite) ;
   pour chaque pixel d'arrivée, son antécédent par M⁻¹, échantillonné dans
   le sprite en alpha prémultiplié — bicubique (Catmull-Rom, borné) quand
   l'élément grandit ou tourne, bilinéaire sur-échantillonné (k × k
   points, k = ⌈1 / échelle⌉) quand il rétrécit (pas de crénelage) — et
   composé « dessus » (over) sur l'image. Le résultat est déterministe et
   indépendant de la résolution : l'aperçu et l'image pleine donnent le
   même dessin à leur échelle.

Les entrées des LIGNES DONT LA POLICE EST POSÉE ne passent pas par ce
pipeline (voir 3.2) : le studio construit les réglages envoyés aux fils
(`reglagesCalcul`) sans elles, et `cleFin` (la clé du détourage pleine
taille) les compte ainsi — le choix d'une police change ce que voient
les fils.

### 3.2 Les lettres de police (lib/texte.js, `poseLigne`)

Une ligne dont la police est posée n'a pas de sprite : ses anciennes
lettres s'effacent et se rebouchent comme aujourd'hui, À LEUR PLACE
D'ORIGINE (`lettres[].pixels`, le fond remis uni, `effacerLettre` dans le
tracé), et les LETTRES DE LA POLICE (`lettres[].commandes`, des courbes en
pixels de l'image) sont transformées par la même matrice avant d'être
peintes (`peindreLettres`) ou tracées (`ajouterPolice`). Le studio passe
l'entrée de la ligne avec son choix de police (`choixPolices` → `m`) ; le
fil du texte applique `transformerPose(pose, entree, largeur)` : les
commandes passent par M, le cadre de la pose devient l'union du cadre des
anciens pixels et de celui des nouvelles courbes (`zonesDe` couvre les
deux places), l'épaisseur d'un cerne suit l'échelle moyenne. Le gras
s'applique avant (il grandit avec la lettre, comme dans Photoshop). La
clé des poses (`clePoses`) compte l'entrée : le tracé gardé ne resservira
pas à une autre place. Résultat : des lettres exactes à toute taille et
tout angle, dans les trois versions et le PDF.

Une ligne SANS police (dessin d'origine) est un sprite comme une forme :
ses lettres (les formes pour moitié dans son cadre) bougent en pixels.
Des lettres soudées au dessin (le retrait l'a déjà mesuré :
`essayerRetrait`, moins de 30 % de l'encre du cadre qui partirait) ne se
déplacent pas sans police : on le dit (toast), le geste ne part pas.

### 3.3 Ce qui ne change pas

L'IA (le nettoyage, l'Ultra, la netteté) travaille avant le détourage ;
les transformations viennent après : rien ne bouge pour elle. Les
retraits et les recolorations s'appliquent avant les transformations
(un élément retiré n'a plus de sprite). Le tracé, l'image par couches, le
contour, la silhouette, les exports lisent l'image transformée : rien à
faire. Le fil du vecteur reçoit le détourage pleine taille du studio
(`detoure`) déjà transformé, ou le refait lui-même avec les mêmes
réglages.

## 4. Le studio (lib/studio-detourage.js)

### 4.1 La géométrie à l'écran

Les formes et les lignes du studio sont lues À LEUR PLACE D'ORIGINE
(`E.calques` : les formes, `carte` ; `E.textes.lignes` : les boîtes).
Chaque entrée de `transformations` se retrouve par `consignes` /
`touchees` (une forme : source `'x'`) ou par `placeLigne` (une ligne, à
0,6 hauteur près, comme `retraitLigne`). Pour tout ce qui se voit ou se
clique, le studio passe par la matrice :

- `coinsElement(el)` : les quatre coins du cadre d'origine, transformés,
  en pixels d'écran — le cadre signalé, les poignées, la bulle placée
  dessous ;
- `elementSous(x, y)` : d'abord les éléments transformés (ils sont
  dessus), du dernier au premier, par l'antécédent du point (M⁻¹) dans la
  `carte` ou le cadre d'origine ; puis les autres, dans la carte, en
  ignorant les pixels des éléments transformés (leur place d'origine est
  un trou) ;
- les lignes : `cadreLigneEcran` rend toujours un polygone (quatre coins,
  ou son tour en rond) transformé ; `ligneSous` le teste.

### 4.2 Les gestes sur le plan

`E.choix` : la sélection — des formes (id) et des lignes (k) — ; `E.geste`
pendant un glissé : son mode (`deplacer`, `coin`, `cote`, `tourner`), les
entrées de départ de chaque élément, le pivot, le point de départ. Le
`pointerdown` sur la toile :

1. sur une poignée (8 px) ou dans la zone de rotation (16 px au-delà
   d'un coin) de la sélection → le mode ;
2. sur un élément (sélectionné ou non) → `deplacer` (il se sélectionne
   seul, sauf Maj qui l'ajoute) ;
3. ailleurs → le plan se déplace (comme aujourd'hui) et la sélection se
   vide.

Un `pointerup` sans mouvement (3 px) est un clic : la bulle (comme
aujourd'hui). Dès 3 px, le geste commence : l'aperçu se bâtit
(`apercuGeste`) et la bulle se ferme. À chaque `pointermove` les
transformations de la sélection se recalculent depuis le départ (pas
d'accumulation d'erreurs), les guides se cherchent, `dessiner()`. Au
`pointerup`, `finirGeste` : les entrées écrites dans `E.reglages`
(`geste(...)` de l'historique), `recalculer()`, `planifierFin()`,
`poserPolices()` s'il y a une ligne, `majPanneau()`. L'aperçu du geste
reste à l'écran jusqu'à ce que le calcul de l'aperçu rende l'image qui le
contient (pas d'aller-retour visible).

L'APERÇU DU GESTE, sur l'aperçu de 1 400 px, bâti une fois au début :
- `fond` : la toile du résultat courant sans les pixels de la sélection à
  leur place courante (un élément déjà transformé se retrouve par M⁻¹
  dans la carte), le trou rebouché par `combler` (la même règle que le
  fil : l'anneau opaque) — l'aperçu ressemble au résultat ;
- un `sprite` par élément : ses pixels à leur place courante (toile).
`dessiner()` peint `fond`, puis chaque sprite avec la matrice du moment
(`setTransform`, lissage « high ») — en Vecteur aussi (le tracé revient
après le geste). La version Image et le Détouré zoomé font de même.

LES GUIDES : pendant `deplacer`, les candidats sont les bords et le centre
de l'image, puis les bords et centres des cadres (transformés, à l'écran)
des autres éléments visibles ; les trois lignes verticales et les trois
horizontales du cadre qui bouge s'aimantent au plus proche à 5 px d'écran
(Ctrl enfoncé : aucun aimant), les guides retenus se tracent en magenta
d'un bord à l'autre du plan. Pendant `coin`/`cote`/`tourner`, pas
d'aimant.

L'ÉTIQUETTE DU GESTE, près du curseur : « X 12,3 · Y 45,0 mm » (déplacer),
« 84 × 31 mm · 120 % » (redimensionner), « 15° » (tourner) — `mmParPx()`
donne l'échelle imprimée.

LE CLAVIER (le plan visible, pas dans un champ) : flèches (1 px d'écran,
Maj 10) → un geste d'historique par pression ; Suppr / Retour arrière →
retirer la sélection (le chemin de « Retirer ») ; Échap → vider la
sélection, ou annuler le geste en cours (les entrées de départ
reviennent, l'aperçu part).

### 4.3 La bulle : GÉOMÉTRIE

Dans la bulle d'une forme (`majPopElement`) et celle d'une ligne
(`majPopPolice`, en bas), une grille : `X`, `Y`, `L`, `H` (mm, une
décimale, du cadre transformé — son enveloppe), un cadenas (pressé
d'office), `∠` (degrés), deux boutons « Retourner » (↔, ↕) et
« Replacer » (visible quand une entrée existe). Un champ validé
(`change`) : X/Y → `d` ; L ou H → `s` (avec le cadenas, les deux), le
centre fixe ; l'angle → `angle` ; chaque validation est un geste. La
bulle se repositionne sous le cadre transformé.

### 4.4 Le bloc « Calques »

Inchangé, plus une pastille « déplacé » (petite icône `move`) sur une
forme ou une ligne transformée, et sa ligne surlignée quand sélectionnée.
Un clic sur une ligne du bloc sélectionne et ouvre la bulle (`cadrer`).

## 5. Les fichiers

- `lib/transformer.js` (nouveau) : `matriceDe(entree, L)`,
  `inverse(M)`, `appliquer(M, x, y)`, `composer`, `decomposer`
  (L, H, angle, retourné — pour l'étiquette et la bulle),
  `transformer(data, l, h, transformations)` (3.1 : sélection → sprites
  → trous → poses), `creuser(data, l, h, masque)` (le trou et sa règle,
  partagé avec l'aperçu du studio), `transformerPose(pose, entree, L)`
  (3.2). Tests : `lib/transformer.test.mjs` (une forme déplacée pixel pour
  pixel ; ×2 ; 90° ; retournée ; deux formes échangées ; une forme sur un
  badge, le trou de la couleur du badge ; sur le vide, transparent ; une
  ligne par son cadre ; l'identité ne change rien ; une pose transformée).
- `lib/effacer.js` : `selection(data, l, h, consigne, etat)` extraite ;
  `effacer` et `recolorer` l'utilisent (mêmes octets).
- `lib/detourage-travail.js` : `transformer` après `recolorer` dans les
  deux branches de `detourage` ; `poses` : `transformerPose` pour un
  choix avec `m`.
- `lib/studio-detourage.js` : 4.1 à 4.4 ; `reglagesCalcul()`,
  `cleFin` ; `messageCalcul` ; `consignesCalques` (source `'x'`) ;
  `choixPolices` (`m`) ; `clePoses` ; `photo()` inchangé (les
  transformations sont dans `reglages`).
- `lib/historique.js` : `decrire` lit `transformations`.
- `lib/icones.js` : `move`, `flip-horizontal`, `flip-vertical`,
  `rotate-cw`, `lock`, `unlock`.
- `index.html` : `modulepreload` de `lib/transformer.js` et
  `lib/combler.js` (désormais importé par la page) ; les styles de la
  grille GÉOMÉTRIE, du curseur de rotation (un SVG en `data:`), du
  surlignage de la sélection dans le bloc.
- `CLAUDE.md` : « Les calques déplacés », ce qui est tranché ; la ligne
  « Pas de calque déplacé ni redimensionné » part. `README.md`.

## 6. Ce qui est vérifié avant de fusionner

1. `node --test` : tout vert (les nouveaux tests, les anciens).
2. LES MÊMES OCTETS sur un logo qu'on ne touche pas (le banc de rejeu du
   scratchpad, `memes-octets.mjs`, HEAD contre l'arbre : détourage, SVG,
   image par couches, lignes, 8 logos, 0 écart) — l'extraction de
   `selection` ne change rien.
3. Dans un Chrome Playwright sans fenêtre : LOGO DIB — une forme glissée
   de 100 px (l'historique dit « Élément déplacé », le SVG et le PNG
   exportés la montrent déplacée, le Détouré aussi), un coin tiré (×1,5,
   « Élément agrandi »), tournée de 30°, retournée, replacée (les mêmes
   octets qu'avant le premier geste) ; « DIB » avec une police, déplacé :
   les lettres de la police à la nouvelle place, l'ancienne place
   rebouchée ; le t-shirt (photo) : « FAVORITE EX » déplacé avec sa
   police ; Ctrl Z / Ctrl Maj Z sur chaque geste ; Suppr sur une
   sélection ; les flèches ; les champs de la bulle.
4. La vitesse : le geste à 60 fps (un `pointermove` < 8 ms sur l'aperçu de
   1 400 px) ; le recalcul après un geste de l'ordre de celui d'un retrait
   (le transformeur sur l'image pleine : quelques dizaines de ms).

## 7. Hors de ce chantier

- Le rebouchage par MI-GAN sous un élément déplacé d'une PHOTO (voir
  3.1) : à la couleur pour l'instant ; la gomme (Combler) reste là pour
  finir le fond à l'IA.
- La duplication d'un élément (Alt + glisser), le cisaillement, l'ordre
  des calques à la main (un élément déplacé passe dessus), les calques
  dessinés (un texte neuf, une forme neuve).

## 8. Ce qui a été mesuré (12 octobre 2026, à la fin)

- `node --test` : 371 tests verts (14 pour `lib/transformer.js`, 1 pour
  l'historique en plus).
- Les mêmes octets sur un logo qu'on ne touche pas (banc de rejeu du
  scratchpad, `lib/` de `main` contre l'arbre, en Node) : détourage,
  SVG, image par couches, lignes identiques sur 8 logos (DIB, SSV, CERCLE
  DES CRÉATEURS, AUTOMAX, 6e3, CD44, La Piscine, 6e3 AME), 0 écart —
  l'extraction de `selection` ne change rien.
- Au banc Playwright sans fenêtre (`calques-deplaces.mjs`, Chrome WebGPU,
  1 440 × 900) : 32 contrôles sur 32. LOGO DIB : une forme glissée de
  120 × 40 px (« Élément déplacé », le tracé change, l'aperçu du geste
  part avec l'image calculée) ; un coin tiré (×1,500 en proportion,
  « Élément agrandi ») ; tournée de 30,0° (« Élément tourné ») ; la bulle
  (X, Y, L, H, ∠) ; retournée (sx = −1,5, « Élément retourné ») ; l'angle
  tapé ; replacée (« Élément replacé », le SVG octet pour octet celui
  d'avant) ; six Ctrl Z (le SVG d'origine) ; Échap ; Maj + flèche
  (10 px) ; Suppr (« Élément retiré ») ; « DIB » en Montserrat déplacé
  (« Ligne déplacée », la pose couvre les deux places, les lettres de
  police à la nouvelle place et l'ancienne rebouchée — captures) ; en
  dessin d'origine, son entrée passe au détourage ; le PNG du vecteur
  exporté porte « DIB » déplacé ; 0,11 ms par `pointermove` pendant le
  geste. Le t-shirt (photo, BiRefNet + Ultra matière) : « I'M HIS » en
  Caprasimo déplacé de 80 px (« Ligne déplacée »).
- Dans le volet de l'app : une pièce du pied de DIB glissée et remise par
  Ctrl Z ; la bulle et ses poignées.

Ce que ces essais ont corrigé en route : le `focus()` d'une ligne du bloc
faisait défiler la page sous la souris entre le pointerdown et le
pointerup (`preventScroll`) ; le plan est l'image — un élément poussé
dehors était coupé (les entrées se bornent, le bord se dessine pendant le
geste, un élément plus grand que l'image bute) ; deux lignes empilées se
prenaient l'une pour l'autre à 0,6 hauteur (`memeLigne` : 0,45 hauteur
et 0,25 largeur).

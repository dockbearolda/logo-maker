# Le fond gardé, et les arcs aux lettres reprises — conception

12 octobre 2026, Charlie, trois demandes dans la foulée de l'inspecteur :

1. « Il faut prendre en compte que j'ai des images avec fond parfois et
   que j'ai juste besoin de les améliorer en gardant le rectangle autour,
   comme une pochette d'album ou une affiche de film. »
2. « Il y a encore des logos où toute la police n'est pas reconnue » — le
   logo « LE CERCLE DES CRÉATRICES » (images.jpeg, 447 px, JPEG) : lu
   « LE CERCL » et « CRÉATR », la police proposée à 50 %.
3. « Défaut d'affichage en bas à droite quand je recherche une police » :
   dans l'inspecteur, les dessins « SEA VIEW » des polices trouvées,
   rognés en haut.

## 1. Le fond gardé : « Entier »

Un quatrième choix dans le bloc Fond, à côté d'Autour, Partout et Sujet.
Rien ne part : les pixels du fichier et son alpha, tels quels
(`methode: 'entier'`, `detourage`, lib/detourage-travail.js). Tout le
reste passe comme ailleurs : « Améliorer l'image » et la netteté (une
affiche est une photo pour l'IA : general ×4, jusqu'à 1 800 px), les
calques (les lignes de texte lues, leurs polices), la gomme, les couleurs,
les déplacements, l'historique (« Fond : Entier »), les exports (le
rectangle entier ; le blanc DTF le couvre). Un rectangle opaque est une
seule forme d'alpha : pas de « Retirer cet élément » dessus, c'est la
gomme (et les formes de 90 % de l'image et plus ne se listent pas).

Choisi, « Entier » ouvre en Détouré (ses pixels) tant que la vendeuse n'a
pas choisi la version ; le seuil, sans objet, se cache ; le bloc dit
« Gardé ».

D'office, seulement quand le sujet que l'IA trouve est toute l'image
(`ENTIER_AUTO` : 95 % des pixels au moins) — il n'y a rien à retirer, et
découper mangerait les bords. Pas d'autre détection automatique : rien
ne distingue sûrement une affiche d'une photo dont on veut le sujet (une
pochette carrée et une photo Instagram ont le même cadre), et dans les
deux sens l'erreur se rattrape d'un clic. Une affiche prise pour une
photo : « Entier », instantané. Une photo prise pour une affiche :
« Sujet », quelques secondes d'IA.

## 2. Les arcs aux lettres reprises

Ce que le logo révélait (diagnostic sur l'image agrandie par l'IA, celle
que lit le texte) :

- Les deux branches de feuilles autour du cercle passaient pour une
  « ligne » de deux lettres géantes (lib/polices.js, `lignes` : même
  hauteur, même pied, à moins de deux hauteurs l'une de l'autre). Cette
  ligne prenait le dernier E de « CERCLE » pour son accent (2a) et
  « D », « E », « S » pour sa ponctuation (2b) ; l'arc, lu ensuite sur les
  lettres restées libres, ne les voyait plus.
- Le « TR » de « CRÉATRICES », agrandi par l'IA, ne faisait qu'une forme :
  241 pixels de grand côté, un pixel au-delà du double des lettres
  (`TAILLES`, lib/courbes.js) — la chaîne s'y cassait.
- Les feuilles dorées au bout de l'arc (ΔE2000 de 10 à 16 du blanc des
  lettres, sous les 25 de la chaîne) passaient pour des lettres, et la
  lecture des polices (`lettresLues`) butait sur une forme sans caractère.

Tranché :

- LES LIGNES DROITES GARDENT LA MAIN. Essayé et écarté : lire les courbes
  avant les lignes droites, sur toutes les lettres — au banc des 71
  fichiers de ~/Downloads (outils/banc-lignes.mjs), 43 changeaient, de
  vraies lignes perdues. Puis, avec les lettres reprises à toute ligne
  droite : encore 28 (une courbe voisine volait sa ponctuation à une vraie
  ligne).
- UNE LETTRE REPRISE À UNE LIGNE BANCALE : ce qu'une ligne droite NON
  ENTIÈRE a pris pour un accent ou une ponctuation peut seulement
  prolonger une chaîne de trois lettres au moins, de sa taille et de sa
  couleur, dans son pas (`secondaires`, lib/courbes.js — jamais la
  commencer, jamais la reboucher) ; la courbe qui aboutit la lui rend
  (`rendre`, lib/texte.js : l'accent détaché de sa lettre, la ponctuation
  ôtée de la ligne).
- DEUX LETTRES SOUDÉES RESTENT DANS LA CHAÎNE : au bout d'une chaîne de
  trois lettres (sa direction est sûre), une forme jusqu'à 2,6 fois la
  lettre (`DOUBLE`), de sa couleur, pas plus haute que 1,3 lettre en
  travers du pas (`soudee`) ; deux chaînes se recollent même par une paire
  soudée (les tailles se comparent chaîne à chaîne). La lecture sépare
  les deux caractères (`lettresLues`, `colle`) ; ils ne comptent pas dans
  la note de la police.
- UN BOUT D'UNE AUTRE COULEUR ET D'UNE AUTRE FORME PART : à plus de
  `BOUT_COULEUR` (8, ΔE2000) de la couleur médiane des lettres — ou du
  double de leur écart de voisine à voisine, un dégradé — ET plus bas
  qu'elles (¾ de leur hauteur) ou bien plus large (1,5 fois), les bouts
  d'une courbe partent. Jamais au milieu, jamais une lettre faite comme
  les autres.

Résultat sur le logo : « LE CERCLE » (8 lettres) et « DES CRÉATRICES »
(12 formes, le TR soudé) lus en entier, en courbe ; la police proposée à
78 % (Kameron) contre 50 % avant — proposée, pas reconnue : des lettres de
30 pixels dans un JPEG de 447, agrandies par l'IA, ne disent pas la police
à coup sûr.

## 3. La recherche de police rognée

Dans l'inspecteur, la liste des polices trouvées gardait le plafond de
220 px de l'ancienne bulle (une règle de même spécificité, plus bas dans
la feuille), avec un débordement visible : la liste, en colonne flex,
rétrécissait ses lignes et chaque dessin perdait son haut. Dans
l'inspecteur, aucune liste de polices ne défile à part ni ne rétrécit
(`.o-studio-inspecteur .o-studio-pop-liste`, `.o-studio-pop-ligne {
flex:none }`) : c'est l'inspecteur qui défile.

## 4. Vérification

- `node --test` vert (373 : le fond gardé dans le fil, « Fond : Entier »
  dans l'historique).
- Le banc des lignes sur les 71 fichiers, avant/après, règle par règle
  (voir « Ce qui est tranché » dans CLAUDE.md pour les chiffres).
- Dans l'aperçu : images.jpeg (les deux arcs, la police) ; le lapin
  (photo : Sujet d'office, « Entier » d'un clic → l'image entière, Détouré,
  « Gardé », le seuil caché, l'historique) ; Logo SSV (la recherche « sa »,
  huit dessins entiers).

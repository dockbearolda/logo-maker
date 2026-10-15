# Le parcours en un geste — conception

15 octobre 2026. Charlie : « Je veux que mon app devienne une des
meilleures au monde car je souhaite la vendre (les modalités de vente, on
s'en occupera après). Elle doit être ultra simple d'utilisation, la
meilleure au monde, bien meilleure que la concurrence. » Précisé dans la
foulée : vendue **aux imprimeurs et ateliers (B2B)**, en **français et en
anglais selon le navigateur**, et au comptoir la vendeuse voit **le
résultat et les décisions en mots, changeables d'un clic** ; tout le reste
derrière « Retoucher ».

## 0. Le découpage, et ce que ce spec couvre

« La meilleure au monde » est trop gros pour un spec. Huit chantiers,
chacun son spec, son plan, sa PR, dans cet ordre :

1. **Le parcours en un geste** — ce spec.
2. **Français / anglais** : un dictionnaire unique, la langue du navigateur,
   un bouton pour changer, jusqu'aux libellés de l'historique et aux noms
   de fichiers. Juste après le 1, pour traduire les nouveaux mots.
3. **Multi-atelier** : nom et marque de l'atelier, son nuancier (import
   d'un .ase), ses tailles DTF, son format préféré ; gardé sur le poste,
   exportable en un fichier, en attendant les comptes. OLDA n'est que le
   premier atelier.
4. **Tenir sur n'importe quel PC** : premier chargement progressif et
   visible (238 Mo de modèles), Windows avec carte intégrée, messages
   clairs sans carte graphique.
5. **Les lots** : dix fichiers déposés, une file, un zip.
6. **La vitrine** : une page publique, exemples avant/après, « rien ne
   quitte votre poste ».
7. **Le halo DTF** (sorti de la veille) : les pixels semi-transparents
   d'un Détouré tramés ou nettoyés, la couleur du t-shirt retirée
   (knockout) — la plainte n° 1 des ateliers DTF (DTPrep, MyHalftone).
8. **Le BAT sur vêtement** (sorti de la veille) : le logo posé sur un
   t-shirt, à sa taille, pour l'accord du client.

Ce qui ne change pas d'un chantier à l'autre : PC + Chrome/Edge, souris et
clavier (les ateliers tournent sur PC, l'IA a besoin de WebGPU) ; tout
calcule sur le poste ; pas de compte ni de facturation avant que la vente
soit décidée.

### Ce que la veille du 15 octobre 2026 a établi

Vectorizer.ai, Vector Magic, Image Trace, Express, Kittl, remove.bg,
Clipping Magic, PicWish, Upscayl, Topaz, WhatTheFont, Ninja Transfers,
STAHLS', DTPrep, MyHalftone, Printavo, DecoNetwork : **personne ne fait la
chaîne entière**, personne ne repose une police (WhatTheFont identifie,
ne repose pas), tout le monde calcule sur un serveur (sauf MyHalftone et
Upscayl, pour une fonction), tout le monde sort du RVB. Ce que les
imprimeurs disent manquer : le texte cassé par tous les vectoriseurs
(« still struggles with text »), le logo de carte de visite voulu en
bannière, le halo blanc des pixels semi-transparents, le redessin facturé
20 à 85 $. Ce que nous battons déjà : tout en local, une chaîne en un
dépôt, la police reconnue ET reposée, l'agrandissement fidèle, le flou
mesuré et retiré, le CMJN FOGRA39 et la taille en mm, les calques. Ce
chantier rend cette avance **visible en un coup d'œil** : aujourd'hui elle
se devine dans un panneau de réglages.

## 1. Le principe : le panneau dit ce que l'app a fait

Aujourd'hui, le panneau de droite est une liste de réglages (Améliorer
l'image, Fond, Tracé, Couleurs, Contour, Calques) : la vendeuse y lit des
curseurs, des seuils, des nœuds. Ce qu'elle veut savoir, c'est **ce qui
s'est passé** et **si c'est bon**.

Le panneau devient une **fiche** : une ligne par décision du graphiste,
dans l'ordre de la chaîne, en mots de vendeuse — « Fond retiré · partout,
même dans les lettres », « Image améliorée · agrandie ×4, flou corrigé »,
« Vectorisé · net à toute taille », « 2 couleurs · d'origine », « CERCLE
DES CRÉATEURS · Kameron proposée ». Chaque ligne **s'ouvre d'un clic** sur
le réglage qui la change, **une seule ligne ouverte à la fois** ; une
ligne « Retoucher » cache ce qui est de graphiste (les formes et leur
œil, le contour, les polices du poste). Le pied ne change pas : taille
DTF, blanc DTF, Télécharger le PDF, Plus.

Ce qui tient : **rien ne flotte sur le logo** (12 octobre) — la fiche vit
dans le panneau, le plan en perd même le sélecteur de version ;
l'inspecteur d'un élément choisi remplace la fiche comme il remplace le
panneau aujourd'hui ; le calcul, les fils, les réglages, l'historique et
les exports ne bougent pas d'un octet. La fiche est une **vue** de l'état
du studio, comme l'inspecteur : elle se déduit, elle ne décide rien.

## 2. L'accueil

La carte « Dépose le logo du client » gagne trois lignes, sous le titre :

> Le fond part, le flou aussi, le texte retrouve sa police.
> Le fichier ressort prêt pour la presse.
> Rien ne quitte ce poste.

Puis « Choisir un fichier », les formats, Ctrl V, comme aujourd'hui. Sous
la carte, **« Ou essaie avec un exemple »** et trois vignettes (72 px) ; un
clic ouvre le fichier comme un dépôt (il passe par `charger`, l'historique
dit « Ouvert · décision du graphiste »). Un prospect voit la chaîne sans
avoir de fichier sous la main — c'est l'argument de vente en un clic.

Les exemples, dans `exemples/` (servis avec la page) : des **marques
fictives, fabriquées par nous** (`outils/exemples.py`, Pillow, comme les
logos synthétiques du modèle OLDA) :

- `carte-de-visite.jpg` — un logo à plat de deux couleurs avec son nom en
  police libre, 420 px, JPEG à 60, légèrement flou : le cas du comptoir.
  Attendu : flou corrigé, agrandi, Vecteur, police reconnue.
- `fond-couleur.png` — un logo sur un fond uni coloré, des lettres à
  creux : attendu « Fond retiré · partout ».
- `illustration.png` — une illustration à dégradés : attendue en Image.

Pas de photo d'exemple dans ce chantier (rien à fabriquer honnêtement ;
une photo libre de droits pourra s'ajouter, choisie par Charlie). Pas de
tutoriel, pas de visite guidée : les trois lignes et les exemples
suffisent.

## 3. La fiche

### Les lignes

Chaque ligne : une icône d'état à gauche, un **titre** (ce qui a été fait),
un **sous-titre** (comment), à droite la durée ou l'avancement, puis un
chevron. Dans l'ordre :

| Ligne | Titre · sous-titre selon l'état | Ouverte : les réglages |
|---|---|---|
| Image | « Image améliorée · agrandie ×4 » (+ « Ultra » si l'Ultra est passée, + « flou corrigé » si la netteté a tourné) / « Image gardée telle quelle · déjà nette et grande » (le graphiste n'a rien lancé) / « Sans amélioration · décochée » (l'interrupteur coupé à la main) / en cours : « Image en cours · Ultra 42 % » | Les deux interrupteurs (Améliorer l'image, Améliorer la netteté), le bouton de l'Ultra proposée avec son temps, comme aujourd'hui |
| Fond | « Fond retiré · partout, même dans les lettres » / « Fond retiré · autour du logo seulement » / « Sujet détouré · trouvé par l'IA » / « Fond gardé · l'image entière » ; les teintes retirées en pastilles dans le sous-titre (`fondsLus`), comme dans `res-fond` aujourd'hui | Le segment Autour / Partout / Sujet / Entier, le seuil (caché pour Entier) avec sa ligne d'aide : « Plus haut : plus de fond part » |
| Version | « Vectorisé · net à toute taille » / « Image · dégradés et textures gardés » / « Détouré · les pixels du fichier, sans le fond » ; en cours : « Tracé en cours » | Les trois versions (Détouré, Vecteur, Image — les boutons d'aujourd'hui, avec leurs titres), le lissage (caché en Détouré) avec son aide : « Plus haut : des courbes plus douces » |
| Couleurs (cachée en Détouré) | « 2 couleurs · d'origine » / « Dégradés · les couleurs du fichier » / « Une couleur · Noir » ; pendant le tracé : « Couleurs · en cours » | Nuances (aide : « Auto : le graphiste compte ») , la palette, D'origine / Une couleur, les pastilles du nuancier |
| Texte, une ligne par texte lu (cachées quand il n'y a rien) | « CERCLE DES CRÉATEURS · Kameron reconnue et posée » / « … · Kameron proposée » / « … · dessin d'origine » / « … · Montserrat, choisie » ; pendant la lecture, une seule ligne « Texte · lecture en cours » puis « Texte · recherche des polices » | Un clic n'ouvre pas de corps : il **sélectionne la ligne** et ouvre son inspecteur (`ouvrirLigne`, le panneau glisse), comme un clic sur le texte du plan |
| Retoucher | « Retoucher · calques, contour, gomme, déplacer » ; pendant un rebouchage : « Retoucher · rebouchage 40 % » | Les formes du dessin avec leur œil (le bloc « Calques » d'aujourd'hui, sans les lignes de texte, qui sont au-dessus), le Contour (épaisseur, couleur ; caché en Détouré), une ligne « La gomme est sur le plan (G) », Polices du poste, Ajouter |

Ce qui est à venir est grisé sans icône ; en cours, un point qui bat ;
fait, une coche ; passé (« déjà à jour », un réglage qui ne relance pas
cette étape), rien ; échoué, une croix rouge et l'erreur dans la ligne.

### Les gestes

- Un clic sur une ligne (son titre, sa flèche) l'**ouvre** ; un clic sur
  une autre ferme la première. Un clic sur la ligne ouverte la ferme.
  Les corps sont dans la page dès le montage (le HTML des blocs
  d'aujourd'hui, mêmes `data-a`, `data-c`, `data-r` : les gestionnaires ne
  changent pas), seulement cachés ; un curseur tenu en main garde sa
  place, comme aujourd'hui.
- Une ligne est un `<button aria-expanded>`, son corps un `role="region"`
  qui porte son `aria-labelledby` ; Entrée et Espace l'ouvrent, Tab
  parcourt les lignes puis les réglages de la ligne ouverte. Le focus
  reste visible (`--anneau`).
- Rien ne s'ouvre d'office à l'ouverture d'un fichier. Après un geste
  dans une ligne ouverte (un changement de version, de fond), elle reste
  ouverte : la vendeuse compare.
- Les raccourcis ne changent pas : D, V, I (la version), G (la gomme),
  C (Avant / après), R (les cotes), 0 (tout voir), Ctrl S, Ctrl O, Ctrl Z.
- L'inspecteur d'un élément choisi **remplace la fiche** (le panneau
  glisse, 200 ms) et la rend à la désélection, la ligne ouverte telle
  qu'elle était. La gomme, Avant / après, un autre fichier le ferment,
  comme aujourd'hui.
- Un survol d'une ligne de texte de la fiche **signale le texte sur le
  plan** (comme la ligne du bloc « Calques » aujourd'hui) ; un survol d'une
  forme dans Retoucher, pareil.
- Sous 1 100 px, le panneau passe sous le plan (règle existante) : la
  fiche y reste une colonne, le pied collé en bas de la fiche.

## 4. Le calcul lisible, dans la fiche

Le panneau « Préparation » en bas à gauche du plan (1er octobre 2026 :
« le calcul lisible ») **disparaît** : c'est la même information, mise sur
les lignes mêmes qu'elle concerne. Charlie l'a tranché le 15 octobre
(« Oui, écris le spec », contre l'option de garder le panneau du plan).
Ce qu'il disait tient toujours, autrement placé :

- **Les étapes se lisent sur l'état du studio** (`etatEtape`), les fils
  n'apportent que leurs durées, le modèle du sujet, le flou retiré, le
  temps jaugé de l'Ultra. Chaque étape nourrit une ligne :

  | Étape (`ETAPES`) | Ligne |
  |---|---|
  | `fichier` | l'en-tête de la fiche (« Lecture du fichier… ») |
  | `net`, `ia` | Image |
  | `sujet`, `detourage` | Fond |
  | `trace` | Version (et Couleurs, Retoucher › Contour, qui en sortent) |
  | `texte` | Texte |
  | `combler` | Retoucher |

- **Une étape de plus de 400 ms** (`MONTRER`) passe sa ligne « en cours »
  (le point qui bat, « 42 % » ou les secondes passées à droite, « encore
  ~14 s » dans le sous-titre quand on le sait — le temps jaugé de l'Ultra,
  l'allure régulière de l'IA). Plus court, rien ne clignote : la ligne
  passe de l'ancien résultat au nouveau.
- **Faite**, la ligne montre sa durée à droite (« 0,8 s ») tant que la
  préparation du fichier n'est pas finie, puis la garde en gris. L'en-tête
  de la fiche dit « Préparation… » pendant le calcul de l'ouverture, puis
  « Prêt · 3,4 s » (du dépôt à la dernière étape) ; un recalcul venu d'un
  réglage ne change pas l'en-tête.
- **Un échec reste dans sa ligne**, en rouge, avec le message, jusqu'au
  prochain calcul de cette étape — plus de toast pour ça. Il est dit une
  fois au lecteur d'écran (`role="status"`, le `prep-dit` d'aujourd'hui
  déplacé dans la fiche).
- **La fiche suit le calcul, elle ne le fait jamais attendre** : un dessin
  par image (`requestAnimationFrame`, comme `majPrep`), le HTML comparé
  avant d'être posé (`dataset.dessin`), jamais de recalcul déclenché par
  l'affichage.

Ce qui part avec le panneau du plan : `o-studio-prep` et son CSS, la croix
« prep-fermer ». Ce qui reste : `preparer`, `prevue`, `etatEtape`,
`avancement`, `resteEtape`, `dureeMot`, `environ` — la fiche les lit.

## 5. Le plan

- Le **sélecteur de version** en haut à gauche (`o-studio-modes`) part :
  la version se lit et se change dans la ligne Version de la fiche. Une
  chose de moins sur le logo.
- « **Comparer** » s'appelle « **Avant / après** » (même geste, même C,
  même Espace maintenu). Les mots « Avant » et « Après » sur la poignée
  restent.
- Le reste de la barre du bas ne change pas : les fonds de l'aperçu, les
  cotes, la gomme, le zoom. La barre du haut non plus (la marque sera au
  chantier 3).

## 6. Les mots

- Un titre, un sous-titre : **des mots de vendeuse**. Jamais « nœuds »,
  « seuil », « lissage », « nuances », « tolérance », « masque », « BiRefNet »
  dans une ligne fermée. Les réglages gardent leur nom une fois la ligne
  ouverte, chacun avec **une ligne d'aide dessous** (12 px, `--encre-2`),
  jamais seulement une bulle au survol.
- Pas de point final aux titres ; des minuscules après le « · » ; « ×4 »,
  « 42 % », « 0,8 s » comme aujourd'hui (`px`, `dureeMot`).
- **Tous les mots de la fiche dans un seul objet `MOTS`** en tête de
  `lib/fiche.js` (titres, sous-titres, aides, l'en-tête, les exemples de
  l'accueil). Le chantier 2 le traduira sans chercher dans le studio.
  Les mots des blocs existants (les boutons Autour / Partout…, les titres
  des curseurs) restent où ils sont jusqu'au chantier 2.

## 7. L'architecture

- **`lib/fiche.js`** (nouveau, pur, sans DOM) : `lignesDe(etat)` reçoit
  un objet plat tiré du studio — la version, la méthode du fond et
  `interieur`, la décision du graphiste, l'état du nettoyage (en cours,
  part, Ultra, netteté faite, `original`), l'état de l'IA du sujet, le
  résumé du vecteur (nombre de couleurs, dégradé rendu, nœuds), les
  textes et leur état, l'état et la durée de chaque étape — et rend la
  liste des lignes : `{ id, titre, detail, etat, valeur, part, erreur,
  corps, cachee }`. Rien d'autre : c'est elle qui est testée à sec.
- **Dans le studio** : `etatFiche()` construit cet objet plat depuis `E`
  et `prep` ; `majFiche()` (appelé là où `majPanneau`, `majPrep`,
  `majPolice`, `majFormes` et `majNettoyage` le sont — ils restent, ils
  mettent à jour les réglages dans les corps) dessine les lignes dans
  `.o-studio-fiche` par `requestAnimationFrame`, en ne touchant qu'aux
  têtes de ligne (le corps ouvert n'est jamais reconstruit : un curseur
  en main y reste). L'ouverture d'une ligne est un état d'affichage
  (`E.ficheOuverte`, l'`id` de la ligne), jamais un réglage : pas dans
  l'historique.
- **Le gabarit** (`gabarit`) : les sections d'aujourd'hui deviennent les
  corps des lignes (`<div class="o-studio-fiche-corps" data-corps="fond">`),
  avec exactement les mêmes attributs `data-a`, `data-c`, `data-r` ; les
  gestionnaires (`clic`, les `input` par `[data-c]`) ne changent pas.
  Les boutons de version quittent le plan pour le corps Version (mêmes
  `data-a="version"`). Les `data-besoin="image"` et `data-trace` gardent
  leur rôle (inertes sans image, cachés en Détouré).
- **L'accueil** : les trois lignes et les exemples dans `gabarit` ; un
  clic sur un exemple fait `fetch('exemples/…')` → `File` → `charger`.
- **Le style** : `.o-studio-fiche*` dans `index.html`, avec les jetons du
  studio seulement (30 septembre : `--t-*`, `--arrondi`, `--anneau`,
  `--encre-*`, `--accent` ; aucune ombre, aucun dégradé). Le point qui
  bat reprend l'animation du panneau Préparation ; `prefers-reduced-motion`
  l'arrête.
- **Le serveur** : `exemples/` servi comme le reste ; `lib/fiche.js`
  ajouté au `modulepreload` (serveur.test.mjs vérifie la liste).
- Rien dans `lib/detourage-travail.js` ni dans les fils.

## 8. Ce qui ne bouge pas

Les fils et leurs messages, `E.reglages`, l'historique et ses libellés,
les exports et leurs noms, l'inspecteur, le lasso et sa bulle, la taille
DTF, le nuancier, les raccourcis, les décisions du graphiste. Le banc de
rejeu (les vrais messages du studio à ses fils, ancien `lib/` contre
nouveau, chaque réponse en SHA-1) doit rendre **0 écart** sur les 8
logos de référence : la fiche n'est qu'une vue.

## 9. Les tests

- **À sec** (`lib/fiche.test.mjs`, `node --test`) : pour chaque ligne,
  chaque état → le titre et le sous-titre attendus (un logo à plat
  vectorisé, une photo en Détouré, une image, l'IA en cours à 42 %, l'Ultra
  passée, la netteté faite, un échec, un fond Entier, trois textes aux
  quatre états, un rebouchage) ; les lignes cachées en Détouré ; l'ordre ;
  l'en-tête (« Préparation… », « Prêt · 3,4 s »). Les mots sont vérifiés
  par ces tests : changer un mot, c'est changer un test.
- **Dans Chrome sans fenêtre** (Playwright, `headless`, WebGPU, le banc
  dans le scratchpad comme `calques-deplaces.mjs`) : ouvrir LOGO DIB, le
  6e3 et une photo ; lire les lignes au fil du calcul (« en cours » puis
  « Prêt ») ; cliquer la ligne Version, choisir Image, lire `E.version` ;
  cliquer la ligne Fond, choisir Autour, lire `E.reglages.interieur` ;
  cliquer un texte, lire que l'inspecteur s'ouvre, Échap, la fiche revient
  avec sa ligne ouverte ; l'exemple de l'accueil ouvre un fichier ; D/V/I
  au clavier ; le PNG exporté a les mêmes octets qu'avant le chantier.
- **Le banc de rejeu** : 8 logos, 0 écart.
- `node --test` entier et `serveur.test.mjs` (la liste `modulepreload`).

## 10. Hors de ce chantier

L'anglais (2), la marque et le nuancier de l'atelier (3), le premier
chargement des modèles (4), les lots (5), la vitrine (6), le halo DTF
(7), le BAT (8). Une photo d'exemple. Un tutoriel. Tout changement du
calcul ou d'un seuil.

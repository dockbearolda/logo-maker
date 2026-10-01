TABLETTE: non

# Logo maker · OLDA

Le Logo maker du comptoir OLDA Print Studio, sorti seul le 29 septembre 2026
(voir README.md). Pages statiques, en ligne sur Railway depuis `main`
(projet et service `logo-maker` → https://logomaker-olda.up.railway.app/,
la tuile du portail https://dockbearolda.github.io/) et toujours sur GitHub
Pages (https://dockbearolda.github.io/logo-maker/). Pas de build, pas de
paquet : `serveur.mjs` ne fait que servir les fichiers. On modifie les
fichiers, on vérifie dans l'aperçu `logo-maker`, `node --test`, on pousse.

## Ce qui est tranché (ne pas défaire)

- **PC + Chrome seulement**, souris et clavier. Pas de mise en page mobile
  ni tablette à prévoir. Vérifier à la largeur du volet de Charlie (lire
  `innerWidth`, souvent 1 024–1 270 px ; sous 1 100 le panneau passe sous le
  plan) et au bureau (1 440 / 1 920).
- **« Détouré » d'abord et d'office** : le fond autour part, les pixels du
  fichier restent, rien ne se trace. Aucun nouveau réglage ne doit forcer la
  vectorisation ni vider les creux dans Détouré. Seule exception (30
  septembre 2026, « les polices sont censées s'ajouter seules, en Détouré et
  Image aussi ») : les lignes dont la police est choisie y sont repeintes
  dans leur police (`lib/texte.js`, `poserZone`), le reste ne bouge pas.
  L'Amélioration IA y passe d'office comme ailleurs (l'Ultra d'un logo à
  plat, l'IA des photos pour la matière) : ses pixels agrandis, jamais
  tracés ; « Amélioration IA » décochée ramène le fichier reçu.
- **L'Amélioration IA reste vérifiable contre le fichier d'origine** (garde-fou
  `fidele`, aucune couleur inventée `borner`) : jamais d'IA qui réinvente des
  lettres sans ce contrôle.
- **La matière passe à l'IA des photos, jamais à celle des logos** : une
  broderie, du cuir, de l'eau, du feu, des paillettes, une photo
  (`aDeLaMatiere`, `lib/detourage.js`) s'agrandit ×4 avec Real-ESRGAN
  « general », d'office jusqu'à 1 800 px et même dans Détouré (ses pixels
  agrandis, jamais tracés). Dans le doute, c'est à plat : les logos pourris
  sont nettoyés — par « anime », ou par l'Ultra ci-dessous —, jamais
  agrandis d'une seule passe par l'IA des photos.
- **L'Ultra d'un logo à plat** : le « general » passé jusqu'à huit fois
  (retourné, pivoté), les dessins moyennés, ses teintes recalées sur le
  fichier (`recaler`) puis `fidele` et `borner`. D'office si le poste la
  fait en moins de 40 s (`ULTRA_AUTO`), sinon proposée avec son temps ;
  sans carte graphique, rien. Un modèle plus gros n'est pas forcément
  meilleur : « x4plus anime 6B » détourait les lettres d'un trait noir —
  mesurer sur des logos réduits ×4 et passés en JPEG avant d'en changer.
- **« Rendre net » (30 septembre 2026, « la feature de PicWish ») : le flou
  se retire avant l'IA, jamais en l'inventant.** Le flou se mesure sur les
  bords (`flouDe`, `lib/nettete.js`) ; au-delà de `FLOU_NET` (1,2 px sur
  l'aperçu, `lib/graphiste.js`) il part d'office, à toutes les tailles, dans
  les trois versions. Une déconvolution (Richardson–Lucy accélérée, sa
  variation totale contre l'écho des bords, ses couleurs bornées à celles
  du fichier) — tenue par le fichier par construction —, puis l'IA habituelle,
  gardée contre l'image défloutée (`garder`, `lib/detourage-travail.js`).
  Pas de modèle « qui défloute » : Real-ESRGAN réduit jusqu'à son flou
  réinventait les petites lettres (6e3) et le garde-fou re-flouté ne le
  voyait pas ; NAFNet (OpenCV, 92 Mo) rend n'importe quoi sur la carte
  graphique du navigateur et met 12 s par tuile sur le processeur.
  Changer `TV`, `SOUS` ou `FLOU_NET` : juger à l'œil sur le t-shirt « I'M
  HIS FAVORITE EX » (un contour de néon autour des lettres = trop), AUTOMAX
  et 6e3 floutés, pas au PSNR seul.
- **« Autour » vide les lettres posées dehors** (leurs creux, même pâles)
  sans toucher la marge blanche d'un sticker ni les grandes îles.
- **« Partout » reconnaît les éléments** (30 septembre 2026, le 6e3 AME :
  « il est primordial que tout intérieur de lettre, sans exception, soit
  parfaitement vidé ; que le logiciel reconnaisse les éléments pour éviter
  de retirer ce qui ne doit pas l'être ») : le dessin se lit en formes et
  en lignes de texte (`lib/elements.js`, les `lignes` de lib/polices.js).
  Le jour d'une lettre — un creux qui touche une lettre d'une ligne — part
  sans exception, même de deux pixels, même sans bord net. Dans une
  ILLUSTRATION (`estIllustration` : plus de 10 % des pixels loin de douze
  teintes), un creux net qui n'est ni grand (`GRAND`, 1 % de l'image) ni
  une bonne part de l'élément qui l'enferme (`PART`, 8 % de son cadre : le
  jour d'un anneau, d'un monogramme) est le blanc peint d'un élément —
  l'aigrette, le ventre de la baleine, la bouteille, l'écume — et reste.
  Un logo à plat se creuse comme avant. Essayé et écarté : relier un
  creux au fond à travers un filet d'un ou deux pixels (il traversait les
  contours noirs anticrénelés de l'illustration et rongeait l'écume) ;
  l'épaisseur du corps autour du creux ou la couleur dominante au-delà
  (un même critère tue l'aigrette ou garde les poches entre les
  racines). Juger sur `_essais/banc-elements.mjs` (avant/après, magenta =
  gardé en plus, cyan = retiré en plus).
- **Le graphiste choisit la version** (30 septembre 2026, « que l'app
  devine le meilleur réglage : une photo, une image ou parfaitement
  vectoriel ») : à l'ouverture de chaque fichier, une photo (vrai décor,
  sujet par l'IA) s'ouvre en Détouré, une image (de la matière, une
  illustration collée ou aux couleurs sans nombre) en Image, un logo à
  plat en Vecteur (`decider`, `genre` et `version`) ; le tracé peut encore
  passer d'Image à Vecteur selon le modelé qu'il mesure. Un clic de la
  vendeuse sur une version l'emporte pour ce fichier ; rien n'est plus
  retenu d'une visite à l'autre (ce qui remplace le « Détouré d'abord et
  d'office » du 29 septembre pour le choix de la version — Détouré reste
  la version des photos, et garde ses pixels intacts).
- **La police se choisit sur le plan, pas dans une barre latérale qui
  s'allonge** (30 septembre 2026, onze lignes lues sur le 6e3 : « on clique
  sur la police et on choisit directement, pour éviter une barre latérale
  trop grande »). Le panneau « Police » n'a qu'une ligne par texte lu
  (point vert : reconnue et posée ; bleu : choisie ; gris : le dessin).
  Chaque texte du logo se signale sous la souris ; un clic — là ou sur sa
  ligne du panneau — ouvre sa bulle sur le texte même (`ouvrirPopPolice`,
  `lib/studio-detourage.js`) : le texte à corriger, les polices proposées
  chacune rendue dans son propre dessin (`apercuPolice`, la police chargée
  dans la page depuis Fontsource), le dessin d'origine, le gras autour.
  Un bout de dessin lu de travers (confiance sous 50, une écriture à moins
  de 60 %) ne fait pas de ligne.
- **Le choix de la police se juge au banc** (30 septembre 2026, « les
  polices doivent réellement correspondre de façon très précise ») :
  `node --max-old-space-size=8000 outils/banc-polices.mjs 30 1` écrit des
  mots dans 30 familles tirées au sort, les rend en pixels et les
  reconnaît — la famille en tête (ou une jumelle : le même dessin latin,
  Noto Sans Balinese = Noto Sans), dans les cinq, la graisse juste. Les
  réglages de `choisirPolices` (200 familles au tri de l'index, une
  graisse, lettres à 48 px, la graisse affinée en pleine taille) y font
  99 % / 100 % / 61 sur 69, contre 89 % / 93 % / 45 avant ; sur les lignes
  du 6e3, chaque police « reconnue » l'est encore (note ≥ 0,9, pire ≥
  0,75). Changer un réglage : le banc avant et après, même tirage.
- **Une image collée sur une toile transparente** (le PNG de Canva : un
  rectangle à angles vifs, fond blanc, au milieu d'une toile vide) : son
  fond se lit sur son bord à elle (`cadreDuFond`, `lib/detourage.js`).
  Seulement un fond clair : un badge sombre déjà détouré reste un dessin,
  un autocollant aux coins arrondis garde sa marge blanche. Le même
  jugement à toutes les tailles : son retrait compte en pixels d'aperçu
  (`APERCU_MAX`) — sinon l'image pleine agrandie par l'IA, ses coins
  adoucis, gardait la carte au zoom et à l'export (30 septembre 2026).
- **Un anneau dessiné irrégulier garde son dessin** (« c'est le logo qui est
  fait comme ça ») : au compas seulement s'il est vraiment un cercle abîmé.
- **Les écritures (scripts) sont proposées, jamais imposées** ; une police
  n'est posée d'office que « reconnue », sur une ligne entière (pas une
  lettre collée au dessin) et assez grande pour en juger — dans les trois
  versions. Le texte se lit sur l'image en pleine taille (`lib/texte.js`),
  une fois par image, jamais sur le tracé.
- **Le sujet d'une vraie photo passe à BiRefNet**, jamais celui d'un logo
  (il remplit les jours d'un dessin au trait) : une photo, c'est moins de
  la moitié du pourtour à la couleur du fond (`PHOTO`, `lib/sujet.js`), et
  seulement sur une carte graphique qui calcule en demi-précision — ISNet
  partout ailleurs, et quand BiRefNet échoue. Ce qui a de la matière
  (`aDeLaMatiere`) passe aussi à BiRefNet quand on demande le sujet ; ses
  creux restent vides (pas de `recoudre`, fait pour ISNet sur les logos).
- **Une illustration peinte collée sur sa carte** (« Strong Together », 30
  septembre 2026 : de la matière, `imageCollee`) part d'office au sujet,
  par BiRefNet seulement (`birefnet`, `lib/graphiste.js`) — sans lui, à la
  couleur. Le modèle ne voit que la carte (`rogner`/`replacer`,
  `lib/sujet.js`) et le blanc de la carte part toujours avec : le sujet
  n'y garde jamais plus que la couleur.
- **Un creux ombré est un creux** (la boucle d'un ruban, 30 septembre
  2026) : le fond vu à travers avec son ombre grise douce part avec elle
  dans « Partout » (`creux`, `lib/detourage.js`) — seulement une vraie
  ombre (un demi-`s` de large en moyenne) sur un fond clair, bordée d'une
  vraie couleur. Le reflet blanc de la bouteille du logo 6e3 AME reste.
- **Le texte se lit avec PP-OCRv5** (`lib/lecture.js`) ; ses seuils (`LUE`,
  `LUE_SURE`, `LUE_CERTAINE`, `lib/studio-detourage.js`) ont été mesurés
  contre ceux de Tesseract sur 24 logos passés à toute la chaîne : chaque
  police posée d'office l'est encore.
- **Tout ce qui sort en PDF (et l'EPS) est en CMJN** (30 septembre 2026) :
  Coated FOGRA39, relatif colorimétrique, point noir compensé — ce
  qu'Illustrator fait en Europe (`lib/cmjn.js`, table refaite par
  `outils/table-cmjn.mjs`). Le noir pur sort en noir riche, le blanc sans
  encre ; le Spot_1 reste un ton direct. Le SVG et le PNG restent en RVB.
- **Le nuancier OLDA ne se convertit pas** (30 septembre 2026, « le
  choix de ces couleurs full CMJN, voici mon nuancier officiel ») : ses 17
  couleurs (`lib/nuancier.js`, refait depuis le .ase d'Illustrator par
  `outils/nuancier.mjs`) sont les pastilles de « Une couleur » et de la
  bulle d'une teinte ; une forme peinte de l'une d'elles sort en PDF et en
  EPS dans ses encres officielles, telles quelles (`cmjn`, `lib/cmjn.js`)
  — son Noir en N100 seul, pas en noir riche. À l'écran, leur rendu
  FOGRA39 ; au survol d'une pastille, son nom et ses quatre encres.
- **« Gras autour » : chaque ligne dont la police est choisie s'épaissit à
  la main** (0 à 100 ; à fond, 6 % de la hauteur de ses lettres tout
  autour), dans les trois versions et tous les exports. Les lettres
  gardent les courbes de la police (`epaissir`, `lib/polices.js`) et se
  remplissent au nombre d'enroulements : deux lettres épaissies qui se
  touchent se fondent. Rien n'est épaissi d'office.
- **Un voile se trace plein, de la couleur qu'il a sur la page blanche**
  (30 septembre 2026, l'ombre à 40 % de « Sea View Villas », un PNG de
  Canva) : en Vecteur et en Image seulement ; Détouré garde le fichier. Un
  voile se lit sur le fichier reçu, jamais sur un masque d'IA : une
  opacité égale, entre 6 et 88 %, sur une vraie surface (`voiles`,
  `lib/detourage.js`).
- **Rien ne sort sans l'IA en cours** : un export demandé pendant
  l'Amélioration IA l'attend, et part sur l'image nette.
- **Le calcul se lit étape par étape** (30 septembre 2026, « le calcul
  lisible ») : plus de pastille qui tourne ; le panneau « Préparation », en
  bas à gauche du plan (`dessinerPrep`, `lib/studio-detourage.js`), liste
  seulement les étapes qui tournent pour ce fichier, leur état et leur
  durée mesurée dans les fils (`etape`, `lib/detourage-travail.js`). Une
  préparation s'ouvre avec un fichier, l'IA, « Rendre net », l'Ultra, le
  fond ou la version — jamais avec un curseur. Il paraît au premier calcul
  de plus de 400 ms et part dès que le contrôle presse a fini, sans fondu ;
  un échec y reste en rouge, à la place du toast. L'état d'une étape se lit
  sur le studio (`etatEtape`) — un fil fermé ne laisse rien « en cours » —,
  les fils n'apportent que les durées ; « encore ~14 s » ne se dit que
  quand on le sait (le temps jaugé de l'Ultra, l'allure régulière de l'IA).
  Le panneau suit le calcul, il ne le fait jamais attendre.
- **Changer un seuil du tracé ou du texte : juger sur de vrais logos**
  clients avant et après (petits textes, puces, anneaux, en gros plan et sur
  fond noir), pas sur un seul. Le contrôle presse (`lib/controle.js`) le
  mesure : `node outils/banc-controle.mjs <logo.png>` trace un PNG en Node, donne
  l'accord, les îles perdues ou ajoutées et dessine la carte des
  désaccords. Essayé et écarté ainsi le 30 septembre 2026 : le lissage de
  Taubin (sans rétrécissement) à la place du laplacien de `lisser` — même
  fidélité (99,08 % → 99,08 % sur 6e3), 19 à 37 % de nœuds en plus.
- **Le contrôle presse dit la vérité, il ne l'arrange pas** (30 septembre
  2026, « qu'on puisse se reposer complètement dessus ») : le tracé final
  est mesuré dans le fil du vecteur contre l'image détourée qu'il a suivie
  (`controler`, jamais sur l'aperçu du curseur), et le bloc « Contrôle »
  du panneau le lit en millimètres à la **largeur imprimée** choisie
  (`E.largeurCm` ; vide : celle du fichier à 300 dpi, comme avant) — la
  même largeur que prennent le PDF, le SVG, le PNG et l'EPS. Les seuils
  (`TRAIT_MIN` 0,3 mm, `TRAIT_SUR` 0,5, `TEXTE_MIN` 2,5, `TEXTE_SUR` 4,
  `DPI_MIN` 90, `DPI_SUR` 150, `lib/studio-detourage.js`) sont ceux de la
  presse DTF. Un filet blanc perdu par le tracé (les stries de la baleine
  du 6e3) s'y voit : c'est le tracé à améliorer, pas la mesure à taire.
  « Au nuancier » ne recolore que les teintes à moins de ΔE 5 d'une
  couleur du nuancier, d'un clic, et chaque pastille garde son
  « d'origine ».
- **Une droite presque à 45° l'est tout à fait** (30 septembre 2026), à
  2° près et si ses points tiennent encore, comme l'horizontale et la
  verticale (`redresser`, `lib/geometrie.js`) ; pas d'autre angle.
- **Le studio ne s'écrit qu'avec ses jetons** (30 septembre 2026) : ni
  dégradé ni violet, aucune ombre aux boutons, `--ombre-flottant` pour ce
  qui flotte (menus, bulles, barres du plan, badges), trois tailles
  (`--t-*`), les rayons `--arrondi`, `--arrondi-carte`, `--arrondi-fenetre`,
  `--pilule` ou 50 %, un seul anneau de focus (`--anneau`). Restent écrits :
  les points ambre `#d97706`, le rose du Spot_1, le damier et les fonds du
  plan.
- **« Comparer » montre le fichier reçu en pleine taille au zoom**
  (`E.sourcePleine`), pas l'aperçu de 1 400 px agrandi.
- **Une barre fine au-dessus du studio, et l'historique des gestes** (30
  septembre 2026). La barre (`.o-studio-barre`, posée dans `index.html`,
  remplie par `gabaritBarre`) porte la marque, le fichier et ses
  dimensions (sortis du panneau), Annuler, Rétablir, Historique, Changer.
  L'historique (`lib/historique.js`) est une pile de **photos des
  réglages, jamais des pixels** : Annuler repose la photo d'avant et
  relance le calcul comme si on avait touché le réglage (`remettre`) — l'IA
  repart, les teintes et les polices d'une autre image s'y reportent par
  leur couleur et leur place. Un curseur glissé = une entrée, au
  relâchement ; 50 entrées au plus, l'ouverture (« Ouvert · décision du
  graphiste ») reste ; vidé à l'ouverture d'un autre fichier. Le point
  qu'on quitte reprend l'état vivant : ce que le graphiste décide après
  coup (la version après l'IA, les polices lues) y entre. Ctrl Z, Ctrl
  Maj Z, Ctrl Y — pas dans un champ texte. Annuler pendant l'Amélioration
  IA l'arrête d'abord quand la photo en veut une autre (le geste annulé
  l'avait lancée) ; un autre geste fait pendant l'IA s'annule sans la
  relancer de zéro. Le fond de l'aperçu, le zoom, « Comparer » et les
  exports ne sont pas des gestes.

## Avec le comptoir

Le même studio vit dans `OLDA-Print-Studio` (lib/ identique au départ). Une
amélioration faite ici n'y remonte pas toute seule, ni l'inverse :
`outils/logo-maker-statique.mjs` du comptoir ramène ici sa version et
remplace `index.html`, `favicon.svg`, `lib/`, `vendor/`. Avant de le relancer,
regarder ce qui a changé ici (git) pour ne rien perdre.

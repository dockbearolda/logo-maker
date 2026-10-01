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
  « Améliorer l'image » y passe d'office comme ailleurs (l'Ultra d'un logo à
  plat, l'IA des photos pour la matière) : ses pixels agrandis, jamais
  tracés ; « Améliorer l'image » décochée ramène le fichier reçu.
- **« Améliorer l'image » (ex-« Amélioration IA ») reste vérifiable contre
  le fichier d'origine** (garde-fou `fidele`, aucune couleur inventée
  `borner`) : jamais d'IA qui réinvente des lettres sans ce contrôle.
- **La matière passe à l'IA des photos, jamais à celle des logos** : une
  broderie, du cuir, de l'eau, du feu, des paillettes, une photo
  (`aDeLaMatiere`, `lib/detourage.js`) s'agrandit ×4 avec Real-ESRGAN
  « general », d'office jusqu'à 1 800 px et même dans Détouré (ses pixels
  agrandis, jamais tracés) — en Ultra comme un logo à plat quand le poste
  la tient (1er octobre 2026 : + 0,17 à + 0,53 dB sur sept matières et
  photos réduites ×4 et passées en JPEG, jamais pire, ses fils et son
  grain gardés à l'œil). Dans le doute, c'est à plat : les logos pourris
  sont nettoyés — par « anime », ou par l'Ultra ci-dessous —, jamais
  agrandis d'une seule passe par l'IA des photos.
- **L'Ultra d'un logo à plat** (et d'une matière) : le « general » passé
  jusqu'à huit fois (retourné, pivoté), les dessins moyennés, ses teintes
  recalées sur le fichier (`recaler`) puis `fidele` et `borner`. D'office
  si le poste la fait en moins de 60 s (`ULTRA_AUTO`, 40 s jusqu'au 1er
  octobre 2026), sinon proposée avec son temps ;
  sans carte graphique, rien. Un modèle plus gros n'est pas forcément
  meilleur : « x4plus anime 6B » détourait les lettres d'un trait noir —
  mesurer sur des logos réduits ×4 et passés en JPEG avant d'en changer.
- **« Améliorer la netteté » (ex-« Rendre net », 30 septembre 2026, « la
  feature de PicWish ») : le flou se retire avant l'IA, jamais en
  l'inventant.** Le flou se mesure sur les bords (`flouDe`,
  `lib/nettete.js`) ; au-delà de `FLOU_NET` — 1 px de flou *vu*, aux
  trois quarts des bords, sur l'aperçu (`lib/graphiste.js`) ; 1,2 px de
  médiane jusqu'au 1er octobre 2026, qui laissait passer les logos fins
  floutés — il part d'office, à toutes les tailles, dans les trois
  versions. Il se retire à la médiane (× `SOUS`) : plus fort (les trois
  quarts, 24 pas, une variation totale de 0,03 à 0,05), le t-shirt
  reprend son néon. Une déconvolution (Richardson–Lucy accélérée, sa
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
  1er octobre 2026 : le banc comptait en « jumelle » une vraie police
  mieux notée que la première (donc manquée) — une jumelle est désormais à
  0,005 près, ni au-dessus ni absente de la réserve ; mesure honnête des
  mêmes réglages : 89 % (graine 1). La chasse d'une graisse de Google
  s'ajoute à chaque lettre au tri de l'index (le trait gras élargit un
  « l » autant qu'un « m »), au lieu de la multiplier : 89 → 96 %
  (graine 1), 89 → 90 % (graine 7) ; le 6e3, DIB, La Piscine inchangés,
  « SEA VIEW » de Sea View Villas reconnue en Bebas Neue. Ce tri plus
  juste laisse passer 120 familles au lieu de 200 sans rien perdre (138
  lignes justes sur 149 aux deux graines, 99 % au poste) : 40 % de
  polices en moins à télécharger la première fois.
- **Les polices de Google se gardent sur le poste** (Cache Storage,
  `octetsGoogle`, lib/detourage-travail.js) : un premier logo en essaie
  des centaines (750 fichiers, 17 Mo pour quatre lignes) ; le cache du
  navigateur les revalide chaque jour et les oublie quand la place
  manque. Le fil du texte se prépare à l'ouverture de la page
  (`prechauffer` : la lecture, l'index des polices) — le premier logo
  ne les attend plus.
- **Les polices du poste et les polices déposées se reconnaissent comme
  celles de Google** (1er octobre 2026, « le meilleur détecteur de
  police au monde ») : Google n'a aucune police commerciale (Helvetica,
  Futura, Avenir, Gill Sans, Century Gothic, Cooper…), le poste si. Chrome
  les prête sur un clic (« Polices du poste », bloc Police ;
  `queryLocalFonts`, la permission « Polices » du site, gardée), on peut en
  déposer (TTF, OTF, WOFF, TTC ; « Ajouter », ou le fichier lâché sur le
  plan). Chaque face est mesurée une fois comme l'index mesure Google
  (`lib/polices-poste.js`) — ses propres cadres par graisse — et la mesure
  se garde sur le poste (`lib/coffre.js`, IndexedDB ; `MESURE` la
  refait). Les octets ne se lisent qu'à la demande du fil (ceux d'un Mac
  pèsent 1,2 Go). opentype.js a été retouché pour les polices Apple que
  Chrome reconstruit (`cmap` format 6, table Unicode d'abord :
  vendor/LISEZMOI.md). Au banc (`POSTE=1 TIRAGE=poste`), 40 familles du
  Mac : 0 % → 99 % en tête, graisse juste 111 sur 112 ; Google inchangé
  avec le poste ajouté. La bulle cherche aussi une police par son nom
  (Google, poste, déposées) et dit la jumelle commerciale d'une police
  libre (« ≈ Futura », `lib/equivalents.js` : seulement des paires
  connues) ; chercher « Gotham » trouve Montserrat.
- **Des outils d'Illustrator** (1er octobre 2026, « ajouter des features
  tirées d'Illustrator ») :
  - LE CONTOUR (Objet › Tracé › Décalage, `lib/contour.js`) : un liseré
    autour du logo, en mm imprimés (la taille DTF compte le contour : la
    largeur choisie est celle du film), d'une couleur du nuancier (ses
    encres officielles en PDF et EPS). Le dessin du vecteur peint dans une
    toile, l'encre élargie (distance exacte), tracée comme le reste, sous
    tout le dessin ; un petit creux se comble, un grand garde son jour. En
    Vecteur seulement (Détouré garde ses pixels).
  - RETIRER (sélectionner, Suppr, `lib/effacer.js`) : un clic sur un
    élément du logo propose « Retirer cet élément » (la forme d'un seul
    tenant) ; la bulle d'une ligne de texte, « Retirer cette ligne » (ses
    lettres, dans son cadre — son tour, en rond). Écrit dans les réglages
    du fond (`effaces`, en fractions de l'image) : les trois versions, les
    exports, l'image refaite par l'IA, l'historique (Ctrl Z le remet).
- **Pas de police posée d'office sur des lettres à ombre portée** (1er
  octobre 2026, « SEA VIEW » de Sea View Villas reconnue en Bebas Neue :
  la police posée effaçait son ombre à 40 %, il en restait des miettes) :
  `ombrePortee` (`lib/texte.js`) — les lettres décalées d'un même pas
  recouvrent une autre teinte, et pas au pas contraire ; un cerne, un fond
  uni, un dessin à côté n'en sont pas. La police reste proposée. Le 6e3,
  DIB inchangés.
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
  « Améliorer l'image » l'attend, et part sur l'image nette.
- **Le calcul se lit étape par étape** (30 septembre 2026, « le calcul
  lisible ») : plus de pastille qui tourne ; le panneau « Préparation », en
  bas à gauche du plan (`dessinerPrep`, `lib/studio-detourage.js`), liste
  seulement les étapes qui tournent pour ce fichier, leur état et leur
  durée mesurée dans les fils (`etape`, `lib/detourage-travail.js`). Une
  préparation s'ouvre avec un fichier, l'IA, « Améliorer la netteté », l'Ultra, le
  fond ou la version — jamais avec un curseur. Il paraît au premier calcul
  de plus de 400 ms et part dès que la dernière étape a fini, sans fondu ;
  un échec y reste en rouge, à la place du toast. L'état d'une étape se lit
  sur le studio (`etatEtape`) — un fil fermé ne laisse rien « en cours » —,
  les fils n'apportent que les durées ; « encore ~14 s » ne se dit que
  quand on le sait (le temps jaugé de l'Ultra, l'allure régulière de l'IA).
  Le panneau suit le calcul, il ne le fait jamais attendre.
- **La vitesse** (1er octobre 2026, « encore plus puissante » : le 6e3
  ouvert de bout en bout 72 → 44 s, LOGO DIB 27 → 14 s, Logo SSV 8 → 3 s).
  La page est isolée (`serveur.mjs`, COOP `same-origin`, COEP
  `credentialless`) : ONNX calcule sur 4 cœurs — la lecture ×2 à ×3, l'IA
  sans carte graphique ×3,6 ; ne pas retirer ces en-têtes (GitHub Pages
  ne peut pas les poser : un cœur là-bas). Au-delà de 4 cœurs, presque
  rien. Sur la carte graphique, Real-ESRGAN est limité par le calcul
  (~1,5 s par mégapixel en float32, Apple M) : regrouper les passages en
  lots n'y gagne rien ; ce qui gagne, c'est moins de pixels — tuiles de
  384 (`TUILE`), une tuile toute d'une couleur calculée une fois
  (`cleUnie`, la carte rend toujours le même dessin d'une même entrée) —
  et la demi-précision (`-fp16.onnx`, `outils/realesr-fp16.py`) sur une
  carte `shader-f16`, ses « NaN » repassant en float32. Jugé sur six
  logos réduits ×4 et passés en JPEG (`outils/banc-ultra.mjs`, dans le
  navigateur) : ±0,02 dB. Une optimisation du calcul en JS doit rendre les
  mêmes octets : SVG, image, détourage, lignes, comparés avant/après sur
  les logos de `~/Downloads` (empreintes sha1), pas « à l'œil ». Mesurer
  la vitesse dans un Chromium visible (Playwright), jamais dans le volet
  caché : ses fils y vont ~8 fois moins vite.
- **Changer un seuil du tracé ou du texte : juger sur de vrais logos**
  clients avant et après (petits textes, puces, anneaux, en gros plan et sur
  fond noir), pas sur un seul. Le contrôle presse (`lib/controle.js`) le
  mesure : `node outils/banc-controle.mjs <logo.png>` trace un PNG en Node, donne
  l'accord, les îles perdues ou ajoutées et dessine la carte des
  désaccords. Essayé et écarté ainsi le 30 septembre 2026 : le lissage de
  Taubin (sans rétrécissement) à la place du laplacien de `lisser` — même
  fidélité (99,08 % → 99,08 % sur 6e3), 19 à 37 % de nœuds en plus.
- **Pas de bloc « Contrôle » dans le panneau** (30 septembre 2026, « le
  contrôle à droite ne sert à rien ») : pas de verdict. `lib/controle.js`
  reste la mesure du banc (`outils/banc-controle.mjs`, juger un changement
  du tracé) et de la teinte du nuancier la plus proche (la bulle d'une
  teinte).
- **La taille DTF se choisit** (1er octobre 2026, « pouvoir choisir la
  taille du DTF ») : dans le pied du panneau, au-dessus du blanc DTF —
  pas un bloc de contrôle. TOUT EN MILLIMÈTRES (« toutes les tailles
  doivent être en mm ») : un préréglage du tableau d'OLDA (les largeurs
  par emplacement : cœur et poitrine 55–80 mm, dos 200–340, bébé
  110–140, tote bag 205 ou 250 ; `lib/tailles-dtf.js`), ou la largeur ou
  la hauteur tapée, l'autre côté suit (au millimètre). Sans choix, 300 dpi
  des pixels (« Taille du fichier »). Elle reste d'un fichier à l'autre
  (une commande), n'est pas un geste de l'historique, et le nom des
  exports la dit (« -280x322mm »). Le tracé sort à cette taille ; Détouré garde ses
  pixels (le PNG dit la résolution qui l'y met). Une seule ligne
  ambre quand une image (Détouré, Image) y tombe sous 200 dpi. Ses
  cotes se lisent sur le plan (R).
- **Les textes en rond se sélectionnent** (30 septembre 2026, le t-shirt
  « SAINT MARTIN » : « s'il y a des mots écrits en rond, ou comme THE
  FRIENDLY ISLAND, ils doivent pouvoir être sélectionnés ; toutes les
  polices de cette image doivent être disponibles »). Les lettres
  s'enchaînent de proche en proche (`chainer`, `lib/courbes.js` : même
  taille au double près, même couleur, virage doux, les trous rebouchés),
  une courbe passe par le milieu de leurs cadres (arc de cercle ou
  polynôme), chaque lettre est remise à plat dans une toile à elle — sa
  part tournée mesurée sur ses jambages (`alpha` : 1 l'arc de « SAINT
  MARTIN », 0,5 le ruban, 0 un « drapeau ») —, et la lecture, la police
  et la pose y marchent comme sur une ligne droite ; chaque lettre posée
  revient sur la courbe par sa transformation. Une ligne courbe n'est
  jamais posée d'office (proposée), 4 lettres au moins ; elle passe devant
  la ligne droite qui a pris ses lettres penchées si elle a autant de
  lettres ; une chaîne aux pieds alignés et aux jambages droits reste une
  ligne droite (« Réserve Naturelle »). Une grande lettre à paraphe juste
  avant la ligne (le A d'« ANTILLES ») est sa lettrine : lue avec elle,
  gardée dessinée. Une lettre cerclée (turquoise cerclé de marine) se lit
  dans sa silhouette pleine (`pleine`, `lib/texte.js`) et sa police se
  pose avec son cerne (`cerneDe` : la lettre de la couleur du cerne, puis
  amincie de son épaisseur de celle du cœur). Juger sur
  `node outils/banc-lignes.mjs --avant=<ref> <png…>` (les lignes avant/après,
  sur les PNG de ~/Downloads) : « CERCLE DES CRÉATEURS » (1600w…webp) s'y
  lit en entier, « La gourde de Mélina » et les lignes du 6e3 restent
  droites.
- **Sous une police posée, le fond est remis uni** (30 septembre 2026,
  « avec une police il faut modifier le fond pour qu'il soit uni, sinon ça
  devient illisible ») : à `UNI` (12 %) de la hauteur des lettres autour
  d'elles, le mélange de l'ancienne lettre et du fond, et l'ombre du fond
  (sa teinte, plus sombre), prennent la couleur du fond — la plus
  fréquente juste au-delà — d'un aplat (`poserZone`, `lib/texte.js`) ;
  dans le vecteur, les débris de calque restés dans cette marge
  rejoignent la forme autour (`nettoyerAutour`, `lib/vecteur-lisse.js`)
  et la version Image y peint la teinte de la couche. Ce qui déborde de
  la marge (la région voisine, un contour) reste ; un fond en dégradé se
  comble de proche en proche, comme avant.
- **Un imprimé photographié sur un tissu (ou un papier) ombré se détoure à
  la couleur** (30 septembre 2026, « les fonds en couleurs doivent être
  propres ; l'app doit faire la différence entre une couleur unie et une
  texture ») : le fond est une teinte dont la clarté varie en douceur
  (`fondOmbre`, `lib/detourage.js`), l'image est éclairée à plat
  (`sansOmbre`), les plis contre le bord partent avec lui (`tissu`). Le
  graphiste ne le décide (`ombre`) que sur un fond clair, si le dessin est
  cerné d'un trait foncé (`cerne`, la moitié de son pourtour) et ne touche
  pas le bord ; l'éclairage à plat ne sert qu'à trouver le fond, le
  dessin garde les couleurs du fichier —
  mesuré sur les 70 fichiers de ~/Downloads : seul le t-shirt change ;
  des gens devant un mur restent une photo. Alors : à la couleur,
  « Partout », version Image, et l'IA des logos jusqu'à 1 800 px — c'est
  elle qui remet les aplats à plat (le grain du tissu, la trame) sans
  toucher au trait. Une poche peinte de la couleur du fond, à plus de
  ΔE 5 de lui (le ruban crème, plus jaune que le tissu), reste.
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
  Maj Z, Ctrl Y — pas dans un champ texte. Annuler pendant « Améliorer
  l'image » l'arrête d'abord quand la photo en veut une autre (le geste annulé
  l'avait lancée) ; un autre geste fait pendant l'IA s'annule sans la
  relancer de zéro. Le fond de l'aperçu, le zoom, « Comparer » et les
  exports ne sont pas des gestes.
- **L'audit du 1er octobre 2026** (« tous les bugs, problèmes,
  ralentissements ») : ce qu'il a tranché.
  - L'export part sur le tracé des réglages du moment (`vecteurFrais`),
    jamais sur celui encore en vol ; un tracé devenu inutile se coupe net.
  - Le serveur : l'ETag est l'empreinte du contenu, pas la date (Railway
    date chaque fichier du dernier commit — les modèles repartaient à
    chaque mise en ligne). Ne pas revenir à la date.
  - Un SVG se rend à 2 400 px de grand côté, comme un PDF (`COTE_MAX`).
  - Un mot seul recadré (lettres à plus de 45 % de la hauteur) se relit
    avec ses formes hautes, seulement quand l'image n'a donné aucune
    ligne : une photo qui a ses lignes ne change pas (banc des lignes,
    70 fichiers, aucun ne change).
  - Laissé à décider : la géométrie parfaite perdue quand une boucle
    finit par une droite (`lib/geometrie.js`, `ji[0]`) — corrigée, elle
    redresse les logos (AUTOMAX) mais coupe droit la pointe des plumes du
    phénix (unnamed.png). Pas passée.

## Avec le comptoir

Le même studio vit dans `OLDA-Print-Studio` (lib/ identique au départ). Une
amélioration faite ici n'y remonte pas toute seule, ni l'inverse :
`outils/logo-maker-statique.mjs` du comptoir ramène ici sa version et
remplace `index.html`, `favicon.svg`, `lib/`, `vendor/`. Avant de le relancer,
regarder ce qui a changé ici (git) pour ne rien perdre.

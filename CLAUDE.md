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
- **« Autour » vide les lettres posées dehors** (leurs creux, même pâles)
  sans toucher la marge blanche d'un sticker ni les grandes îles.
- **Une image collée sur une toile transparente** (le PNG de Canva : un
  rectangle à angles vifs, fond blanc, au milieu d'une toile vide) : son
  fond se lit sur son bord à elle (`cadreDuFond`, `lib/detourage.js`).
  Seulement un fond clair : un badge sombre déjà détouré reste un dessin,
  un autocollant aux coins arrondis garde sa marge blanche.
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
- **« Gras autour » : chaque ligne dont la police est choisie s'épaissit à
  la main** (0 à 100 ; à fond, 6 % de la hauteur de ses lettres tout
  autour), dans les trois versions et tous les exports. Les lettres
  gardent les courbes de la police (`epaissir`, `lib/polices.js`) et se
  remplissent au nombre d'enroulements : deux lettres épaissies qui se
  touchent se fondent. Rien n'est épaissi d'office.
- **Changer un seuil du tracé ou du texte : juger sur de vrais logos**
  clients avant et après (petits textes, puces, anneaux, en gros plan et sur
  fond noir), pas sur un seul.

## Avec le comptoir

Le même studio vit dans `OLDA-Print-Studio` (lib/ identique au départ). Une
amélioration faite ici n'y remonte pas toute seule, ni l'inverse :
`outils/logo-maker-statique.mjs` du comptoir ramène ici sa version et
remplace `index.html`, `favicon.svg`, `lib/`, `vendor/`. Avant de le relancer,
regarder ce qui a changé ici (git) pour ne rien perdre.

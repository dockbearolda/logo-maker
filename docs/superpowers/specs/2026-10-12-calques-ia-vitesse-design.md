# Calques, IA de restauration, vitesse — conception

12 octobre 2026. Charlie : « optimise encore au maximum l'app, qu'elle
soit ultra efficace, et qu'on puisse modifier chaque logo : il faudrait un
système de calques — une photo de basse qualité avec des écrits dessus, je
dois pouvoir prendre l'écriture et la modifier, supprimer un objet qui me
plaît pas, etc. Il faut que l'amélioration IA des logos de basse qualité
soit ce qui se fait de mieux au monde actuellement. »

Trois chantiers, dans un seul ordre : les calques (le modèle de données
d'abord, l'écran ensuite), l'IA (mesurée au banc, jamais à l'œil seul), la
vitesse (mêmes octets, jugée au banc de rejeu). Rien ici n'est persisté
ailleurs qu'en mémoire de la page : tout se défait d'un `git revert`.

## 1. Les calques

### Ce qui existe déjà, et qui reste

- Les LIGNES DE TEXTE sont lues (PP-OCRv5), leur police retrouvée ; la
  bulle d'une ligne (`ouvrirPopPolice`) corrige son texte, choisit sa
  police, son gras ; « Retirer cette ligne » la fait partir
  (`effaces`, un cadre ou un tour).
- Un ÉLÉMENT (une forme d'un seul tenant) se retire d'un clic sur le plan
  (`effaces`, un point { u, v, aire }, lib/effacer.js) — dans les trois
  versions et les exports, car le retrait se fait au détourage.
- L'HISTORIQUE est une pile de photos des réglages, jamais de pixels :
  tout nouveau réglage s'y range de lui-même.

Ce qui manque pour « un système de calques » : une LISTE de ce que le
dessin contient (lignes et formes), chacun qu'on montre ou cache, qu'on
recolore ; la COULEUR d'une ligne de texte ; et, sur une PHOTO, un objet
qui part sans laisser de trou (le fond se rebouche), des lettres
remplacées sans aplat sous elles.

### Un calque est un élément lu

Un calque n'est jamais dessiné par la vendeuse : c'est un élément que le
graphiste a lu dans le fichier.

- une LIGNE DE TEXTE (celles de `E.textes.lignes`, inchangées) ;
- une FORME : une composante d'un seul tenant (huit voisins, encre à
  partir d'un huitième d'opacité — la règle de lib/effacer.js) de
  l'image détourée de l'aperçu, AVANT les retraits à la main (une forme
  retirée reste listée, l'œil fermé). Les formes dont la plupart des
  pixels tombent dans le cadre (ou le tour) d'une ligne de texte sont les
  lettres de cette ligne : elles ne sont pas listées à part. Seules les
  formes d'au moins 0,05 % de l'image sont listées, les 40 plus grandes
  au plus ; le reste (miettes, points) n'apparaît pas — il se retire au
  clic sur le plan, comme avant.

Chaque forme se dit en fractions de l'image, comme `effaces` : { id, u, v
(un pixel sûr de la forme : le plus proche de son centre), aire, cadre:
[u0, v0, u1, v1], rvb (sa couleur médiane) } — la même adresse vaut pour
l'aperçu, l'image pleine et l'image agrandie par l'IA.

### Les réglages (ce que l'historique photographie)

Tout s'écrit dans les réglages ; rien dans des pixels.

- `reglages.effaces` (existant) : un point, un cadre ou un tour. Un
  élément retiré par la liste des calques est le même `{ u, v, aire }`
  qu'un clic sur le plan.
- `reglages.teintesElements: [{ u, v, aire, rvb }]` : UN ÉLÉMENT
  RECOLORÉ. Appliqué dans le fil juste après `effacer`, sur l'image
  détourée : chaque pixel d'encre de la forme (la même adresse, la même
  tolérance d'aire que `effacer`) prend `rvb`, son opacité gardée. Les
  trois versions et les exports suivent, puisque le tracé part de là.
- `l.couleur` (ligne de texte, `rvb` ou null) : LA COULEUR D'UNE LIGNE.
  Passée au fil avec la police choisie (`poses`), elle remplace la
  couleur lue des lettres (`poserZone`, et `teinteDe` dans le tracé). Une
  ligne garde le dessin d'origine : pas de couleur (elle est à ses
  pixels) ; le choix d'une couleur sur une ligne sans police prend la
  police proposée en tête, comme « Gras autour ».
- `comblements: [{ poly: [[u, v]…] } | { u, v, aire } | { ligne: placeLigne }]`
  : « EFFACER ET COMBLER ». Une consigne qui transforme l'IMAGE DE
  TRAVAIL (comme « Améliorer l'image ») : ce qui est dedans part, et le
  fond se rebouche dessous. Rangée dans la photo de l'historique à côté
  de `ia` et `net` ; Annuler recalcule l'image de travail depuis le fichier
  reçu (`remettreImage`).

### Combler : à la couleur, ou par l'IA

- Un LOGO À PLAT (`decision.genre === 'logo'`) se rebouche de proche en
  proche, comme sous une police posée (la règle de `poserZone` : le fond
  uni si l'anneau autour l'est, sinon la moyenne des voisins connus) — du
  calcul pur, dans le fil, les mêmes octets partout.
- Une PHOTO ou une IMAGE (matière, illustration) passe à MI-GAN
  (Picsart, ICCV 2023, MIT ; ONNX 512 × 512, ~30 Mo, vendor/) sur la
  carte graphique, sinon le processeur : un recadrage carré autour du
  trou (le trou et son contexte, ramené à 512), le masque, l'image
  rebouchée recollée — seuls les pixels du trou changent. Fait dans le
  fil de l'IA, sur l'image de travail pleine (après l'IA ×4 si elle a
  tourné), comblement après comblement ; l'image rebouchée remplace
  l'image de travail (`remplacer`, source gardée pour « Comparer »).
  Déterministe sur la carte graphique (le même dessin d'une même entrée,
  vérifié pour Real-ESRGAN) ; le processeur sert de secours.
- Les lettres d'une ligne REMPLACÉES SUR UNE PHOTO : le masque des
  anciennes lettres (leurs pixels, élargis de la marge d'effacement) est
  comblé par MI-GAN AVANT que les lettres de la police se peignent
  (`poserZone` reçoit la zone déjà rebouchée et ne peint que les
  lettres). Dans Détouré seulement — les photos y vivent ; Vecteur et
  Image gardent l'aplat uni sous les lettres, comme aujourd'hui.

### Le fil

- Le message `calcul` (le détourage de l'aperçu) rend aussi `formes` —
  les composantes, avant `effacer` — et, pour chaque consigne de
  `effaces` et `teintesElements`, l'`id` de la forme qu'elle a touchée :
  le panneau sait quel œil fermer, quelle pastille montrer. Un seul
  parcours de l'aperçu (lib/elements.js, `elementsDu`, étendu) : quelques
  dizaines de millisecondes.
- `recolorer(data, largeur, hauteur, teintesElements)` dans
  lib/effacer.js, à côté de `effacer` : même adressage, même tolérance.
- `combler(data, largeur, hauteur, masque)` dans un nouveau
  lib/combler.js : le rebouchage de proche en proche (pur), et, dans
  lib/detourage-travail.js, `comblerIA` (MI-GAN) pour les photos.
- `poses` emporte `couleur` par ligne ; `poser` accepte des zones déjà
  rebouchées (`comble: true`).

### L'écran

- LE BLOC « CALQUES » remplace « Police » dans le panneau : d'abord les
  lignes de texte (une ligne par texte lu, point vert/bleu/gris, le texte,
  sa police — comme aujourd'hui), puis les formes (une pastille de sa
  couleur, « Forme », sa part de l'image en %). Chaque ligne du bloc a un
  ŒIL : ouvert, l'élément est là ; fermé, retiré (un retrait d'`effaces`
  de plus, ou de moins — Ctrl Z le remet aussi). Survoler une ligne du
  bloc signale l'élément sur le plan (son cadre en pointillé, comme les
  lignes de texte) ; cliquer ouvre sa bulle sur le plan.
- LA BULLE D'UN ÉLÉMENT (`pop-element`, aujourd'hui un seul bouton)
  s'enrichit : « Retirer » / « Remettre » ; « Couleur » : les 17
  pastilles du nuancier et « D'origine » ; sur une photo ou une image,
  « Effacer et combler ». Un clic sur une forme du plan ouvre la même
  bulle (le survol la signale, comme une ligne de texte).
- LA BULLE D'UNE LIGNE gagne « Couleur » (les pastilles, « D'origine »),
  sous le gras.
- LA GOMME (barre du plan, à côté de « Comparer » ; touche G) : un lasso
  tracé à la souris (un polygone, fermé au relâchement). Au relâchement,
  une bulle : « Retirer » (l'encre dedans part, transparente) ou
  « Combler » (le fond se rebouche dessous) — le graphiste propose
  Combler sur une photo ou une image, Retirer sur un logo à plat.
- L'HISTORIQUE dit : « Élément retiré/remis », « Élément : Rouge »,
  « Couleur du texte : Blanc », « Comblé », « Lasso retiré ».
- Les exports ne changent pas : tout est dans l'image détourée, le tracé,
  l'image de travail.

### Hors de ce chantier

Déplacer, redimensionner, faire tourner un calque : non — un logo client
se reproduit, il ne se recompose pas ; à proposer si Charlie le demande.
Pas de calque dessiné à la main (hors le lasso de la gomme).

### Tests

- lib/effacer.test.mjs : `recolorer` (une forme, sa tolérance d'aire,
  l'opacité gardée) ; lib/combler.test.mjs : un trou dans un aplat, dans
  un dégradé, au bord ; lib/elements.test.mjs : les formes listées, une
  lettre non listée, le seuil d'aire ; lib/historique.test.mjs : les
  libellés ; lib/texte.test.mjs : la couleur d'une ligne, une zone déjà
  comblée.
- Au banc : les mêmes octets (SVG, image, détourage) sur les 70 fichiers
  de ~/Downloads sans aucun calque touché — ce chantier ne doit rien
  changer à un logo qu'on ne touche pas.
- Dans le volet : une photo avec texte (le t-shirt « SAINT MARTIN ») — une
  ligne recolorée, remplacée, un objet comblé au lasso ; le 6e3 — une
  forme retirée par l'œil, remise par Ctrl Z.

## 2. L'IA de restauration des logos de basse qualité

### Le constat

La chaîne actuelle est déjà solide : Real-ESRGAN « general » ×4 passé en
huit orientations (l'Ultra), défloutage par Richardson–Lucy avant, et
trois garde-fous (`recaler`, `fidele`, `borner`) qui interdisent à l'IA
d'inventer une lettre. Ce qui se fait « de mieux au monde » en 2026 sur
les photos — la diffusion en une étape (OSEDiff et ses descendants,
NTIRE 2026) — réinvente les lettres, pèse des gigaoctets et ne tourne pas
dans un navigateur : hors de question ici, sauf comme service payant
(décision de Charlie, voir plus bas). Sur des LOGOS (aplats, lettres,
filets, JPEG), aucun modèle public n'est entraîné pour ça : les modèles
communautaires (OpenModelDB) visent les photos ou l'animation.

### Le banc

Celui de CLAUDE.md : six logos clients nets, réduits ×4 et passés en JPEG
75, agrandis, comparés à l'original, partout et sur leurs bords (PSNR),
dans le navigateur (`outils/banc-ultra.mjs`, étendu à une liste de
modèles et à un passage simple comme à l'Ultra). Un modèle entre dans
vendor/ s'il gagne sur les bords sans perdre sur un seul logo, et à un
temps comparable (l'Ultra d'office tient dans 60 s).

### Les candidats

1. `realesr-general-x4v3` (actuel, Compact 1,2 M de paramètres) ;
2. `4xNomosUni_span_multijpg` (SPAN, 2,2 M, CC-BY-4.0, entraîné sur du
   JPEG jusqu'à 40 — la dégradation du fichier d'un client) ;
3. `RealESRGAN_x4plus` (RRDB, 16,7 M, BSD) : la borne haute, dix fois le
   calcul ;
4. LE MODÈLE OLDA : le Compact actuel RÉENTRAÎNÉ sur des logos
   synthétiques — du texte dans des centaines de polices (celles du
   poste, celles de Google), des formes, des filets, des cernes, des
   ombres, sur fond uni ou dégradé — dégradés comme les fichiers des
   clients (flou, réduction ×4 par divers filtres, JPEG 30–95, parfois
   deux fois, rééchantillonnage de capture d'écran). Perte L1 pondérée
   sur les bords (ce que le banc mesure). Même architecture → même
   vitesse, même ONNX, l'Ultra et les garde-fous inchangés. Entraîné sur
   le poste (M5, PyTorch MPS), validé pendant l'entraînement sur le banc
   même (en Python, mêmes dégradations).

Écartés d'avance : les modèles sous licence non commerciale (ClearReality,
AnimeSharp : CC-BY-NC) — OLDA imprime pour des clients.

### Ce qui ne change pas

L'Ultra (huit orientations), `recaler`, `fidele`, `borner`, « Améliorer
la netteté » : un nouveau modèle se glisse à la place de l'ancien, sous
les mêmes garde-fous. La matière garde l'IA des photos (le « general »,
ou son successeur s'il gagne aussi sur les sept matières du banc du 1er
octobre).

### Décision laissée à Charlie

Un service de diffusion en ligne (Replicate, fal.ai : SUPIR, OSEDiff…)
coûterait quelques centimes par image et enverrait le logo du client hors
du poste : ni gratuit ni local — contraire à « tout doit être gratuit » et
« rien ne quitte le poste ». Pas fait ; proposé seulement si Charlie le
veut.

### Ce qui a été fait (12 octobre 2026, le soir)

- Les calques, la gomme, MI-GAN : faits comme ci-dessus (lib/calques.js,
  lib/combler.js, `recolorer` dans lib/effacer.js, `comblerIA` dans
  lib/detourage-travail.js, vendor/migan-512.onnx). Vérifié dans le
  volet : le DIB (13 formes listées, une recolorée en kaki, une retirée par
  l'œil et remise par Ctrl Z, « DIB » en beige), le lapin (un rectangle de
  gomme comblé par MI-GAN en 2,1 s, annulé par Ctrl Z), le t-shirt « I'M HIS
  FAVORITE EX » (la police Coustard posée sur « FAVORITE EX », le tissu
  rebouché sous les anciennes lettres). Mêmes octets sur 8 logos non
  touchés (détourage, SVG, image, lignes).
- Le banc des modèles (outils/banc-modeles.mjs), six logos réduits ×4 et
  passés en JPEG 75, PSNR sur les bords en dB :

  | Logo | general ×1 | general Ultra ×8 | anime ×1 | OLDA ×1 (6 000 it.) | OLDA Ultra ×8 |
  |---|---|---|---|---|---|
  | Logo SSV | 21,05 | 21,77 | 19,77 | 21,77 | 22,04 |
  | LOGO DIB | 16,57 | 17,27 | 17,78 | 19,16 | 19,42 |
  | CERCLE DES CRÉATEURS | 19,25 | 20,71 | 19,45 | 20,01 | 20,31 |
  | 6e3 AME | 15,19 | 15,75 | 15,03 | 15,77 | 15,97 |
  | CD44 (illustration) | 19,83 | 20,70 | 18,85 | 20,43 | 20,75 |
  | Strong Together (matière) | 18,32 | 18,80 | 18,19 | 18,46 | 18,74 |

  Le modèle OLDA en un passage bat « anime » et « general » en un passage
  sur les six, et vaut l'Ultra ×8 du general (meilleur sur deux, égal sur
  deux, −0,3 à −0,7 sur deux) pour un huitième du calcul. SPAN
  (4xNomosUni_span_multijpg) : `run` en erreur sur WebGPU (ORT Web
  1.30) — écarté ; RealESRGAN_x4plus (RRDB, 67 Mo) : dix fois le calcul,
  non mesuré en Ultra.

- LE MODÈLE FINAL (20 000 itérations, le meilleur sur les bords gardé à
  18 000 ; validation Python : bords 19,15 → 22,86 dB), au banc du
  navigateur (bords, dB) :

  | Logo | general ×8 (avant) | OLDA ×1 | OLDA ×4 (après) | OLDA ×8 | OLDA fp16 ×8 | general + OLDA ×4 + ×4 |
  |---|---|---|---|---|---|---|
  | Logo SSV | 21,77 | 22,41 | 22,49 | 22,50 | 22,49 | 22,53 |
  | LOGO DIB | 17,27 | 19,07 | 19,27 | 19,33 | 19,33 | 18,59 |
  | CERCLE DES CRÉATEURS | 20,71 | 20,68 | 20,90 | 20,91 | 20,90 | 21,06 |
  | 6e3 AME | 15,75 | 15,64 | 15,80 | 15,84 | 15,84 | 15,97 |
  | CD44 | 20,70 | 21,05 | 21,28 | 21,35 | 21,35 | 21,44 |
  | Strong Together (matière) | 18,80 | 18,14 | 18,40 | 18,44 | 18,44 | 18,87 |

  Tranché (CLAUDE.md) : OLDA ×4 pour un logo à plat ou une illustration
  (meilleur que l'Ultra d'avant sur chacun des cinq, la moitié du temps :
  SSV 3,8 → 1,8 s, DIB 0,9 → 0,5 s, CERCLE 4,1 → 2,0 s), le passage simple
  OLDA quand l'Ultra ne tient pas, fp16 (±0,01 dB, 25 % plus vite) ;
  « anime » sur le processeur ; la matière garde le general ×8 ;
  l'ensemble écarté (−0,7 dB sur DIB).

## 3. La vitesse, troisième passe

### La mesure de départ (12 octobre 2026, Chrome sans fenêtre, M5)

Un profil neuf (aucune police en cache), ouverture de bout en bout :

| Logo | Total | IA | Tracé | Lecture du texte |
|---|---|---|---|---|
| 6e3 (unnamed-2) | 129 s | Ultra 18,4 s | 12,7 s | 1 min 45 |
| LOGO DIB | 48 s | Ultra 6,2 s | 4,3 s | 39,7 s |
| Logo SSV | 27 s | — | 1,2 s | 27,3 s |
| AUTOMAX | 22 s | Ultra 0,7 s | 1,1 s | 21,5 s |
| CERCLE DES CRÉATEURS | 28 s | — | 1,0 s | 27,6 s |

LA LECTURE DU TEXTE (OCR, puis la recherche des polices) est le poste
dominant, de très loin — surtout la première fois (les polices de Google
à télécharger). À chaud (polices en cache) : mesure en cours, même
méthode.

À chaud (polices en cache) : 6e3 33 s (Ultra 18,2, tracé 6,9, texte 6,9
en parallèle), DIB 10,7 s, SSV 2,0 s, AUTOMAX 2,7 s, CERCLE 2,0 s. Le
profil du texte à chaud (CDP, rejeu dans la page) : rien ne domine — le
rendu des glyphes (`dilater`, `remplir`), l'OCR, opentype.js, chacun
moins de 8 % des 7,8 s. Le tracé en Node : l'image par couches fait 3 à
16 % du tracé (DIB 0,18 s sur 6,5 ; SSV 0,72 sur 3,7 ; 6e3 1,2 sur 19).

### Pistes, par ordre de rendement attendu

1. LA RECHERCHE DES POLICES : profil (CDP) du rejeu des messages `texte`
   et `polices` dans la page. Attendu : le parsing opentype.js et le
   rendu des glyphes dominent. Pistes : le tri de l'index plus serré (les
   familles à essayer en pleine taille), les glyphes rendus une fois par
   famille et partagés entre les lignes, deux fils de polices en
   parallèle (une ligne sur deux, la mémoire bornée) — `harmoniser`
   après ; le premier téléchargement de l'index et des polices les plus
   probables dès l'ouverture de la page (`prechauffer`, déjà) puis des
   fichiers de police les plus fréquents (les 120 familles du tri sont
   connues d'avance pour un texte latin usuel).
2. LE TRACÉ (12,7 s sur le 6e3) : l'image par couches (`imageParCouches`,
   la version Image jusqu'à 4 096 px) se calcule à chaque tracé final
   même en Vecteur — la calculer quand on la montre ou l'exporte (les
   mêmes octets, plus tard).
3. L'ULTRA : déjà limitée par la carte graphique ; rien à gagner sans
   perdre des orientations.

### Méthode

Celle du 1er octobre (CLAUDE.md) : chaque optimisation du calcul rend les
mêmes octets — SVG, image, détourage, lignes de texte — sur les logos de
~/Downloads, comparés par SHA-1 avant/après (banc de rejeu des messages
réels aux fils) ; la vitesse se mesure dans un Chrome Playwright sans
fenêtre, jamais dans le volet.

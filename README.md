# Logo maker · OLDA

Le Logo maker de l'Atelier OLDA, seul : un logo ou une photo se dépose, le
fond part (un fichier flou est d'abord rendu net ; un imprimé photographié
sur un tissu ombré part en entier, plis compris), et le logo ressort
détouré, vectoriel ou en image nette, prêt pour la presse (PDF en CMJN
avec blanc DTF, SVG, PNG 300 dpi, EPS en CMJN). Le texte d'un logo — même
écrit en rond, sur un ruban, ou cerclé d'une autre couleur — peut
reprendre sa police, et chaque ligne s'épaissir à la main (« Gras
autour »). Chaque geste se défait (Ctrl Z) ou se refait (Ctrl Maj Z),
et l'historique du fichier ramène à n'importe lequel.

En ligne : **<https://logomaker-olda.up.railway.app/>** (tuile « Logo
maker » du portail <https://dockbearolda.github.io/>) — et toujours sur
<https://dockbearolda.github.io/logo-maker/>, la même page.

Tout calcule dans le navigateur, sur le poste : rien ne part sur un
serveur (celui de Railway, `serveur.mjs`, ne fait que servir les pages). Seules les polices libres essayées sur le texte d'un logo viennent
de Fontsource (le CDN jsDelivr), une à une.

## En local

Aucun paquet à installer. Depuis ce dossier :

```bash
npm start
```

puis <http://localhost:8130/> — le serveur de Railway, tel quel. Dans
Claude Code, l'aperçu `logo-maker` (`.claude/launch.json`) fait la même
chose. Les tests :

```bash
node --test
```

## Mettre en ligne

Pousser sur `main` : Railway (projet `logo-maker`, service `logo-maker`)
redéploie tout seul, en une à deux minutes — GitHub Pages aussi.

## D'où il vient

Il est sorti le 29 septembre 2026 du comptoir OLDA Print Studio (dépôt
`OLDA-Print-Studio`, écran « Logo maker »), où le même studio continue de
vivre. `node outils/logo-maker-statique.mjs <ce dossier>`, lancé depuis ce
dépôt-là, ramène ici le studio du comptoir : il **remplace** `index.html`,
`favicon.svg`, `lib/` et `vendor/` — `git diff` montre ce qui change avant
de pousser. Le reste (ce fichier, `CLAUDE.md`, `package.json`…) n'est pas
touché.

## Les fichiers

| Où | Quoi |
|---|---|
| `index.html` | la page : jetons et style du comptoir, le studio en pleine page |
| `serveur.mjs` | le serveur de Railway, sans paquet : les pages telles quelles, compressées, rien de caché, isolées (COOP/COEP : l'IA et la lecture calculent sur quatre cœurs) |
| `lib/studio-detourage.js` | l'écran : le plan, le panneau, les exports, les raccourcis |
| `lib/historique.js` | l'historique des gestes : des photos des réglages (jamais des pixels) qu'Annuler, Rétablir et le menu « Historique » reposent ; leurs libellés (« Rouge retiré », « Seuil 24 → 32 ») |
| `lib/graphiste.js` | les décisions d'office (IA, fond, version) |
| `lib/detourage-travail.js` | le fil de calcul : détourage, IA, tracé, polices |
| `lib/detourage.js`, `lib/sujet.js` | le fond uni à la couleur près — un tissu ou un papier ombré éclairé à plat d'abord —, les creux (même ombrés, la boucle d'un ruban) ; le sujet d'une photo ou d'une illustration collée sur sa carte (BiRefNet sur une carte graphique, sinon ISNet — ISNet pour un logo) |
| `lib/elements.js` | les éléments du dessin : ses formes, ses lignes de texte — le jour d'une lettre se vide sans exception, le blanc peint d'une illustration (le plumage, un reflet) reste |
| `lib/nettete.js` | « Améliorer la netteté » : le flou d'un fichier mesuré sur ses bords, puis retiré (Richardson–Lucy, sans rien inventer) avant l'IA — d'office quand le fichier est flou |
| `lib/nettoyage.js` | « Améliorer l'image » (Real-ESRGAN ×4 : « anime » pour un logo à plat, « general » pour la matière — broderie, cuir, eau, photo), son Ultra (le « general » passé jusqu'à huit fois, retourné et pivoté, sur un logo à plat comme sur une matière) et ses garde-fous |
| `lib/vecteur-lisse.js`, `lib/geometrie.js`, `lib/vectoriser.js` | le tracé : couches, ronds au compas, droites à la règle |
| `lib/image-nette.js` | la version Image, découpée sur les couches du vecteur |
| `lib/controle.js` | la mesure du banc (`outils/banc-controle.mjs`) : le tracé contre l'image détourée (fidélité, îles perdues ou ajoutées), l'épaisseur de l'encre, la couleur du nuancier la plus proche |
| `lib/texte.js`, `lib/lecture.js`, `lib/polices.js`, `lib/ecriture.js` | le texte trouvé en pleine taille, lu (PP-OCRv5), sa police retrouvée et reposée dans les trois versions — une lettre cerclée avec son cerne |
| `lib/courbes.js` | le texte en rond, sur un ruban, penché : ses lettres enchaînées, la courbe qui passe par elles, chacune remise à plat (tournée ou cisaillée) puis reposée sur la courbe |
| `lib/pdf-vectoriel.js`, `lib/pdf-image.js`, `lib/export-logo.js`, `lib/png.js` | les exports |
| `lib/cmjn.js`, `lib/cmjn-fogra39.js` | le CMJN des PDF et de l'EPS : la conversion d'Illustrator en Europe (Coated FOGRA39, relatif colorimétrique, point noir compensé), en table calculée d'avance — `node outils/table-cmjn.mjs` la refait avec littleCMS |
| `lib/nuancier.js` | le nuancier OLDA : 17 couleurs, leurs encres officielles (sorties telles quelles en PDF et en EPS) et leur rendu à l'écran — `node outils/nuancier.mjs "Nuancier.ase"` le refait depuis le .ase d'Illustrator (d'office `outils/nuancier-olda-2026-v2.ase`) |
| `vendor/` | les lecteurs (PDF, HEIC, TIFF), ONNX Runtime et ses cinq modèles, l'index des polices ; versions et licences dans `vendor/LISEZMOI.md` et `vendor/licences/` |
| `outils/birefnet-webgpu.py` | BiRefNet préparé pour la carte graphique du navigateur, et coupé en deux |
| `outils/realesr-fp16.py` | les deux Real-ESRGAN en demi-précision, pour une carte graphique qui la calcule (l'Ultra 1,4 fois plus vite) |
| `outils/banc-ultra.mjs` | le banc de l'Ultra, dans le navigateur : float32 contre float16, tuiles de 192 contre 384, sur des logos réduits ×4 et passés en JPEG |
| `outils/banc-controle.mjs`, `outils/banc-elements.mjs`, `outils/banc-polices.mjs`, `outils/banc-lignes.mjs` | les bancs : le tracé mesuré contre le fichier, les creux « Partout » avant/après la règle des éléments, les polices reconnues sur des mots écrits dans des familles connues, les lignes de texte (droites et courbes) avant/après un changement |

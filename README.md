# Logo maker · OLDA

Le Logo maker de l'Atelier OLDA, seul : un logo ou une photo se dépose, le
fond part (un fichier flou est d'abord rendu net), et le logo ressort
détouré, vectoriel ou en image nette, prêt pour la presse (PDF en CMJN
avec blanc DTF, SVG, PNG 300 dpi, EPS en CMJN). Le texte d'un logo peut
reprendre sa police, et chaque ligne s'épaissir à la main (« Gras
autour »).

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
| `serveur.mjs` | le serveur de Railway, sans paquet : les pages telles quelles, compressées, rien de caché |
| `lib/studio-detourage.js` | l'écran : le plan, le panneau, les exports, les raccourcis |
| `lib/graphiste.js` | les décisions d'office (IA, fond, version) |
| `lib/detourage-travail.js` | le fil de calcul : détourage, IA, tracé, polices |
| `lib/detourage.js`, `lib/sujet.js` | le fond uni à la couleur près, les creux (même ombrés, la boucle d'un ruban) ; le sujet d'une photo ou d'une illustration collée sur sa carte (BiRefNet sur une carte graphique, sinon ISNet — ISNet pour un logo) |
| `lib/nettete.js` | « Rendre net » : le flou d'un fichier mesuré sur ses bords, puis retiré (Richardson–Lucy, sans rien inventer) avant l'IA — d'office quand le fichier est flou |
| `lib/nettoyage.js` | l'Amélioration IA (Real-ESRGAN ×4 : « anime » pour un logo à plat, « general » pour la matière — broderie, cuir, eau, photo), son Ultra (le « general » passé jusqu'à huit fois, retourné et pivoté, sur un logo à plat) et ses garde-fous |
| `lib/vecteur-lisse.js`, `lib/geometrie.js`, `lib/vectoriser.js` | le tracé : couches, ronds au compas, droites à la règle |
| `lib/image-nette.js` | la version Image, découpée sur les couches du vecteur |
| `lib/texte.js`, `lib/lecture.js`, `lib/polices.js`, `lib/ecriture.js` | le texte trouvé en pleine taille, lu (PP-OCRv5), sa police retrouvée et reposée dans les trois versions |
| `lib/pdf-vectoriel.js`, `lib/pdf-image.js`, `lib/export-logo.js`, `lib/png.js` | les exports |
| `lib/cmjn.js`, `lib/cmjn-fogra39.js` | le CMJN des PDF et de l'EPS : la conversion d'Illustrator en Europe (Coated FOGRA39, relatif colorimétrique, point noir compensé), en table calculée d'avance — `node outils/table-cmjn.mjs` la refait avec littleCMS |
| `lib/nuancier.js` | le nuancier OLDA : 17 couleurs, leurs encres officielles (sorties telles quelles en PDF et en EPS) et leur rendu à l'écran — `node outils/nuancier.mjs "Nuancier.ase"` le refait depuis le .ase d'Illustrator (d'office `outils/nuancier-olda-2026-v2.ase`) |
| `vendor/` | les lecteurs (PDF, HEIC, TIFF), ONNX Runtime et ses cinq modèles, l'index des polices ; versions et licences dans `vendor/LISEZMOI.md` et `vendor/licences/` |
| `outils/birefnet-webgpu.py` | BiRefNet préparé pour la carte graphique du navigateur, et coupé en deux |

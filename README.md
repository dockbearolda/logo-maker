# Logo maker · OLDA

Le Logo maker de l'Atelier OLDA, seul : un logo ou une photo se dépose, le
fond part, et le logo ressort détouré, vectoriel ou en image nette, prêt
pour la presse (PDF avec blanc DTF, SVG, PNG 300 dpi, EPS).

En ligne : **<https://dockbearolda.github.io/logo-maker/>** (tuile « Logo
maker » du portail <https://dockbearolda.github.io/>).

Tout calcule dans le navigateur, sur le poste : rien ne part sur un
serveur. Seules les polices libres essayées sur le texte d'un logo viennent
de Fontsource (le CDN jsDelivr), une à une.

## En local

Aucun paquet à installer. Depuis ce dossier :

```bash
python3 -m http.server 8130
```

puis <http://localhost:8130/>. Dans Claude Code, l'aperçu `logo-maker`
(`.claude/launch.json`) fait la même chose. Les tests :

```bash
node --test
```

## Mettre en ligne

Pousser sur `main` : GitHub Pages republie tout seul, en une minute environ.

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
| `lib/studio-detourage.js` | l'écran : le plan, le panneau, les exports, les raccourcis |
| `lib/graphiste.js` | les décisions d'office (IA, fond, version) |
| `lib/detourage-travail.js` | le fil de calcul : détourage, IA, tracé, polices |
| `lib/detourage.js`, `lib/sujet.js` | le fond uni à la couleur près ; le sujet d'une photo (ISNet) |
| `lib/nettoyage.js` | l'Amélioration IA (Real-ESRGAN ×4 : « anime » pour un logo à plat, « general » pour la matière — broderie, cuir, eau, photo), son Ultra (le « general » passé jusqu'à huit fois, retourné et pivoté, sur un logo à plat) et ses garde-fous |
| `lib/vecteur-lisse.js`, `lib/geometrie.js`, `lib/vectoriser.js` | le tracé : couches, ronds au compas, droites à la règle |
| `lib/image-nette.js` | la version Image, découpée sur les couches du vecteur |
| `lib/texte.js`, `lib/lecture.js`, `lib/polices.js`, `lib/ecriture.js` | le texte trouvé en pleine taille, lu (Tesseract), sa police retrouvée et reposée dans les trois versions |
| `lib/pdf-vectoriel.js`, `lib/pdf-image.js`, `lib/export-logo.js`, `lib/png.js` | les exports |
| `vendor/` | les lecteurs (PDF, HEIC, TIFF), ONNX Runtime et ses trois modèles, Tesseract, l'index des polices ; versions et licences dans `vendor/LISEZMOI.md` et `vendor/licences/` |

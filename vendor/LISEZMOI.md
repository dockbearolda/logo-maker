# vendor — React, les lecteurs de logos et l'IA du Détourage

Le Comptoir n'installe rien : ces fichiers sont copiés tels quels depuis les
paquets npm et servis par `server.mjs`. React se charge au démarrage de la
page (le moteur `support.js` le prenait sur unpkg.com : la page renvoie aux
copies d'ici par `window.__resources`). Les lecteurs de logos, eux, sont
chargés par `lib/logo.js` **seulement quand un logo en a besoin** : un PNG
déposé n'en tire aucun. L'IA du Détourage (le moteur ONNX et le modèle) ne
se charge qu'à la première photo dont le fond n'est pas uni
(`lib/detourage-travail.js`) : ni la page ni un logo sur fond blanc n'en
tirent un octet. Le modèle du nettoyage (2,5 Mo), qu'au premier clic sur
« Amélioration IA » (d'office pour un logo de moins de 900 px).

| Fichier | Paquet | Version | Licence | Sert à |
|---|---|---|---|---|
| `react.production.min.js`, `react-dom.production.min.js` | react, react-dom | 18.3.1 | MIT | le moteur de rendu de la page (`support.js`) |
| `pdf.min.mjs`, `pdf.worker.min.mjs` | pdfjs-dist | 6.2.108 | Apache-2.0 | logo PDF vectoriel et `.ai` |
| `libheif-bundle.mjs` | libheif-js | 1.19.8 | LGPL-3.0 | photo d'iPhone (HEIC/HEIF) |
| `UTIF.js` | utif2 | 4.1.0 | MIT | TIFF de scanner |
| `pako.mjs` | pako | 3.0.1 | MIT et Zlib | décompression dont UTIF a besoin |
| `ort.webgpu.min.mjs`, `ort-wasm-simd-threaded.asyncify.mjs`, `ort-wasm-simd-threaded.asyncify.wasm` | onnxruntime-web (`dist/`) | 1.30.0 | MIT | faire tourner le modèle du Détourage, sur la carte graphique (WebGPU) ou le processeur (WebAssembly) |
| `isnet-general-int8.onnx` | ISNet « general use » (DIS), poids int8 de `xrds/isnet-general-onnx-int8` sur Hugging Face | — | Apache-2.0 et MIT | trouver le sujet d'une photo (`lib/sujet.js`) |
| `imagetracer.js` | imagetracerjs (`imagetracer_v1.2.6.js`) | 1.2.6 | Unlicense (domaine public) | le PDF vectoriel du Détourage (`lib/vectoriser.js`) |
| `tesseract/tesseract.esm.min.js`, `tesseract/worker.min.js` | tesseract.js (`dist/`) | 7.0.0 | Apache-2.0 | lire le texte d'un logo, sur le poste (`lib/lecture.js`) |
| `tesseract/tesseract-core-*-lstm.wasm.js` | tesseract.js-core | 7.0.0 | Apache-2.0 | le moteur de Tesseract (trois variantes : sans SIMD, SIMD, SIMD détendu) |
| `tesseract/fra.traineddata.gz`, `tesseract/eng.traineddata.gz` | @tesseract.js-data/fra, /eng (`4.0.0_best_int`) | 1.0.0 | Apache-2.0 | le français et l'anglais de Tesseract |
| `opentype.min.mjs` | opentype.js (`dist/`) | 2.0.0 | MIT | lire les polices de la réserve (`lib/polices.js`) |
| `polices/index.json` | construit par `outils/index-polices.mjs` depuis le catalogue de Fontsource (Google Fonts, OFL et Apache) | — | celle de chaque police (OFL-1.1 ou Apache-2.0) | reconnaître la police d'un texte sans la télécharger ; les fichiers eux-mêmes viennent à la demande par `serveur/polices.mjs` |
| `lexique/mots.txt` | construit par `outils/lexique.mjs` depuis FrequencyWords (Hermit Dave, 2018 : fr, en) | — | CC BY-SA 4.0 | relire un texte manuscrit que l'OCR lit mal, mot par mot (`lib/ecriture.js`) |
| `realesr-animevideov3.onnx` | Real-ESRGAN « anime video v3 » (SRVGGNetCompact, ×4), export ONNX de `skillsafe-ai/realesr-animevideov3` sur Hugging Face — ses 53 tenseurs sont identiques, octet pour octet, à ceux de `realesr-animevideov3.pth` (release v0.2.5.0 de xinntao/Real-ESRGAN, sha256 `b8a83768…`) | v0.2.5.0 | BSD-3-Clause | « Amélioration IA » du Logo maker : un logo flou redessiné net, ×4 (`lib/nettoyage.js`) |

Tesseract et ses langues ne se chargent qu'au premier logo qui a du texte,
les polices qu'une à une, quand la recherche en veut une (`/polices/…`,
gardées ensuite sur le volume). Pour refaire l'index des polices (une
nouvelle famille chez Google Fonts) : `node outils/index-polices.mjs` —
il télécharge chaque police une fois dans un dossier temporaire.

Les textes des licences sont dans `licences/` (pour ONNX Runtime, ses
composants tiers aussi : `onnxruntime-ThirdPartyNotices.txt`). libheif-js
est sous LGPL : il est livré tel quel, non modifié, et chargé comme un
module séparé — on peut le remplacer par une autre version en changeant ce
seul fichier.

Pour changer de version : reprendre le fichier du paquet (`build/` pour
pdfjs-dist, `libheif-wasm/` pour libheif-js, la racine pour utif2,
`dist/` pour pako et onnxruntime-web, `umd/` pour react et react-dom),
mettre ce tableau à jour, puis déposer un PDF, un HEIC et un TIFF sur
`bat.html`, et une photo dans le Détourage, pour vérifier. Le modèle se
remplace par un autre ISNet au format ONNX (entrée `input` en 1 × 3 × 1024 ×
1024, sortie en probabilités) : sa licence doit permettre l'usage
commercial — ce n'est le cas ni de RMBG de Bria, ni de
`@imgly/background-removal` (AGPL).

React doit rester à la version que `support.js` épingle (`REACT_URL`,
`REACT_SRI`) : les deux fichiers d'ici sont vérifiés contre ces empreintes
SHA-384 (`openssl dgst -sha384 -binary … | base64`) — un octet d'écart, et
c'est un autre React que celui pour lequel le moteur a été bâti.

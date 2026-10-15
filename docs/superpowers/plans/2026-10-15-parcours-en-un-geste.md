# Le parcours en un geste — plan d'exécution

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Le panneau de droite devient une fiche de ce que l'app a fait (une ligne par décision, en mots de vendeuse, changeable d'un clic), l'accueil montre trois exemples, le calcul se lit dans la fiche, et plus un seul « OLDA » dans l'app.

**Architecture:** Un module pur `lib/fiche.js` (état plat → lignes et mots, testé à sec) ; le studio (`lib/studio-detourage.js`) construit cet état plat depuis `E` et `prep`, dessine les têtes de ligne par `requestAnimationFrame`, et réutilise tels quels les blocs de réglages d'aujourd'hui comme corps des lignes (mêmes `data-a`, `data-c`, `data-r` : les gestionnaires ne changent pas). Une constante `MARQUE` (`lib/marque.js`) remplace OLDA partout. Rien ne change dans les fils ni dans le calcul.

**Tech Stack:** Pages statiques (pas de build, pas de paquet), ES modules, `node --test`, Playwright (Chrome sans fenêtre, `~/.npm/_npx/9833c18b2d85bc59/node_modules/playwright`) pour les bancs et la fabrication des exemples.

**Spec:** `docs/superpowers/specs/2026-10-15-parcours-en-un-geste-design.md`

## Global Constraints

- PC + Chrome/Edge, souris et clavier ; pas de mise en page mobile.
- Le studio ne s'écrit qu'avec ses jetons : `--t-*`, `--arrondi`, `--arrondi-carte`, `--anneau`, `--encre-1/2/3`, `--accent`, `--zone`, `--filet-carte`, `--succes`, `--danger` ; aucune ombre aux boutons, aucun dégradé, `--ombre-flottant` pour ce qui flotte.
- Rien ne flotte sur le logo (12 octobre 2026) : la fiche vit dans le panneau ; le plan perd le sélecteur de version.
- « Comparer » s'appelle « Avant / après » ; mêmes raccourcis : D, V, I, G, C, R, 0, Ctrl S, Ctrl O, Ctrl Z.
- Mots de vendeuse dans les lignes fermées : jamais « nœuds », « seuil », « lissage », « nuances », « tolérance », « masque », « BiRefNet ». Tous les mots de la fiche dans `MOTS` (`lib/fiche.js`).
- `MARQUE = 'Logo maker'` ; zéro « olda » (sans casse) dans `index.html`, `lib/*.js` hors commentaires, `package.json`, `README.md`, `vendor/LISEZMOI.md`, les noms de fichiers de `vendor/`, `outils/` et `exemples/`.
- Un logiciel pour tout imprimeur, pas pour le DTF : plus de couche de blanc Spot_1 (code, exports, historique), plus de préréglages ; la taille d'impression en mm reste ; zéro « DTF » (mot entier) et zéro « Spot_1 » dans ce que l'app dit (spec 5 ter).
- Les mêmes octets : le banc de rejeu (ancien `lib/` contre nouveau, SHA-1 des réponses des fils) rend 0 écart sur 8 logos de `~/Downloads`.
- Chrome Playwright SANS fenêtre (`headless: true`, `channel: 'chrome'`, `--enable-unsafe-webgpu`), un profil par instance.
- Commits en français, à la première ligne le quoi ; fin de message `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Pas de `git stash` nu (worktree partagé) ; pas de push forcé.

## Review Focus

1. **Un fichier déposé pendant la préparation d'un autre** (`E.suivant`) : l'en-tête repart à « Lecture du fichier… », aucun « Prêt · 3,4 s » de l'ancien ne reste — test dans `lib/fiche.test.mjs` (en-tête, `prep.lecture`) et pas 6 du banc (Task 9).
2. **L'IA qui échoue** (sans carte graphique, mémoire) : la ligne Image passe en rouge avec le message, le reste de la fiche continue, et un relancement efface le rouge — test « échec » de `lib/fiche.test.mjs`, et `evenement` 'debut' qui efface `p.echec` (Task 7).
3. **Une ligne de texte retirée par l'œil** : sa ligne de la fiche reste, grisée, « retirée », et son œil la remet — test `lib/fiche.test.mjs` (« ligne retirée »).
4. **Une photo en Détouré** : Couleurs cachée, Version « Détouré », le lissage caché, le contour caché dans Retoucher, Télécharger reste — tests `lib/fiche.test.mjs` (« photo ») et pas 3 du banc.
5. **Le clavier seul** : Tab atteint chaque ligne, Entrée l'ouvre, Tab entre dans ses réglages, Échap depuis l'inspecteur ramène la fiche avec sa ligne ouverte — pas 7 du banc (Task 9).

---

### Task 1 : La marque — `lib/marque.js`, la page, les exports, les libellés

**Files:**
- Create: `lib/marque.js`
- Create: `lib/marque.test.mjs`
- Modify: `index.html` (le `<title>`, la liste `modulepreload`)
- Modify: `lib/studio-detourage.js` (`gabaritBarre`, `gabaritTaille`, la bulle d'une teinte ligne ~4179)
- Modify: `lib/export-logo.js:42-85`, `lib/pdf-vectoriel.js:156-175`, `lib/pdf-image.js:129-163`, `lib/vectoriser.js:493`, `lib/vecteur-lisse.js:2217`
- Modify: `lib/vectoriser.test.mjs:66`, `lib/tailles-dtf.test.mjs:45`, `lib/historique.test.mjs` (le texte d'exemple « OLDA » → « ATELIER »)
- Modify: `package.json`, `README.md`

**Interfaces:**
- Produces: `export const MARQUE = 'Logo maker'` (`lib/marque.js`), lu par le studio et les cinq modules d'export.

- [ ] **Step 1 : Écrire le test qui compte zéro « olda » dans ce que l'app dit**

`lib/marque.test.mjs` :

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { MARQUE } from './marque.js'

const RACINE = join(import.meta.dirname, '..')
/* Le code sans ses commentaires (/* … *​/ et // …) : ce que l'app dit, pas
   l'histoire qu'elle raconte. */
const sansCommentaires = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

test('la marque est un nom, sans OLDA', () => {
  assert.equal(typeof MARQUE, 'string')
  assert.ok(MARQUE.length > 0)
  assert.doesNotMatch(MARQUE, /olda/i)
})

test('plus un seul « OLDA » dans la page, le code, le paquet, le README', async () => {
  const fautes = []
  for (const f of ['index.html', 'package.json', 'README.md', 'vendor/LISEZMOI.md']) {
    const s = await readFile(join(RACINE, f), 'utf8')
    for (const [i, l] of s.split('\n').entries()) if (/olda/i.test(l)) fautes.push(f + ':' + (i + 1))
  }
  for (const f of await readdir(join(RACINE, 'lib'))) {
    if (!f.endsWith('.js')) continue
    const s = sansCommentaires(await readFile(join(RACINE, 'lib', f), 'utf8'))
    for (const [i, l] of s.split('\n').entries()) if (/olda/i.test(l)) fautes.push('lib/' + f + ':' + (i + 1))
  }
  for (const d of ['vendor', 'outils', 'exemples']) {
    for (const f of await readdir(join(RACINE, d)).catch(() => [])) if (/olda/i.test(f)) fautes.push(d + '/' + f)
  }
  assert.deepEqual(fautes, [])
})
```

- [ ] **Step 2 : Le lancer, le voir échouer**

Run: `node --test lib/marque.test.mjs`
Expected: FAIL — `Cannot find module './marque.js'`.

- [ ] **Step 3 : Créer `lib/marque.js`**

```js
/* LA MARQUE (15 octobre 2026, Charlie : « il faut qu'Atelier OLDA
   n'apparaisse absolument nulle part ») : le nom du produit, lu par la
   page, la barre et les exports. « Logo maker » en attendant le nom
   choisi pour la vente — une ligne à changer le jour venu. */
export const MARQUE = 'Logo maker'
```

- [ ] **Step 4 : La page et la barre**

`index.html` : `<title>Logo maker · OLDA</title>` → `<title>Logo maker</title>`. Dans la liste `modulepreload`, ajouter `<link rel="modulepreload" href="lib/marque.js">` (ordre alphabétique après `lib/logo.js`).

`lib/studio-detourage.js` : en tête, `import { MARQUE } from './marque.js'`. Dans `gabaritBarre` :

```js
    + '<div class="o-studio-marque"><b>' + MARQUE + '</b></div>'
```

(plus de `<span>Logo maker</span>` : le nom seul.) Dans `gabaritTaille`, `title="Les largeurs du tableau d\'OLDA"` → `title="Les tailles habituelles"`. Ligne ~4179 (la bulle d'une teinte) : `'Nuancier OLDA'` → `'Nuancier'`. Le commentaire de `E.teinte` (« une couleur du nuancier OLDA ») peut rester : c'est un commentaire.

- [ ] **Step 5 : Les exports**

Dans chacun, `import { MARQUE } from './marque.js'` en tête, puis :

`lib/export-logo.js` : `titre = 'Logo vectorisé — OLDA Print Studio'` → `titre = 'Logo vectorisé — ' + MARQUE` (ligne 42) ; `titre = 'Logo vectorise - OLDA Print Studio'` → `titre = 'Logo vectorise - ' + MARQUE` (ligne 61) ; `'%%Creator: OLDA Print Studio\n'` → `'%%Creator: ' + MARQUE + '\n'` (ligne 85).

`lib/pdf-vectoriel.js` : ligne 156 `titre = 'Logo vectorise - ' + MARQUE` ; ligne 175 `'/Producer (' + MARQUE + ')'`.

`lib/pdf-image.js` : ligne 129 `titre = 'Detourage - ' + MARQUE` ; ligne 163 `'/Producer (' + MARQUE + ')'`.

`lib/vectoriser.js:493` et `lib/vecteur-lisse.js:2217` : `'<title>Logo vectorisé — ' + MARQUE + '</title>'`.

- [ ] **Step 6 : Les tests qui citaient le nom**

`lib/vectoriser.test.mjs:66` : remplacer `OLDA Print Studio` dans la chaîne attendue par `' + MARQUE + '` (importer `MARQUE`). `lib/tailles-dtf.test.mjs:45` : `test('les préréglages : les largeurs habituelles, en mm', …)`. `lib/historique.test.mjs` : `texte: 'OLDA'` → `texte: 'ATELIER'` (lignes 12 et 184), `'OLDA PRINT'` → `'ATELIER PRINT'` et l'assertion `'Texte : ATELIER PRINT'` (ligne 141).

- [ ] **Step 7 : `package.json` et `README.md`**

`package.json` : `"name": "logo-maker"`, `"description": "Le Logo maker, seul — en ligne sur Railway (serveur.mjs), et sur https://dockbearolda.github.io/logo-maker/"` — l'adresse GitHub reste (hors de portée, spec 5 bis) mais le test la compterait : écrire `"description": "Le Logo maker, seul — pages statiques servies par serveur.mjs (Railway, GitHub Pages)"`.

`README.md` : titre `# Logo maker` ; « Le Logo maker de l'Atelier OLDA, seul » → « Le Logo maker, seul » ; « un préréglage d'OLDA » → « un préréglage d'atelier » ; les adresses en ligne (lignes 25-27) : garder `https://logomaker-olda.up.railway.app/` et `dockbearolda` serait compté — les remplacer par une phrase sans l'adresse : « En ligne sur Railway et sur GitHub Pages (voir `package.json` et le portail) — un nom de domaine du produit viendra avec la vente. » ; « sorti … du comptoir OLDA Print Studio (dépôt `OLDA-Print-Studio`) » → « sorti … du comptoir de l'atelier d'origine (dépôt du comptoir) » ; « le modèle OLDA » → « le modèle maison » (lignes 81, 98) ; « le tableau d'OLDA » → « le tableau de l'atelier » (92) ; « le nuancier OLDA » → « le nuancier de l'atelier » (94) ; `outils/entrainer-olda.py` → `outils/entrainer-logo.py` (renommé en Task 2 — l'écrire déjà ici).

- [ ] **Step 8 : Lancer le test : il échoue encore sur les identifiants (attendu)**

Run: `node --test lib/marque.test.mjs`
Expected: FAIL, `fautes` ne contient plus que des lignes de `lib/coffre.js`, `lib/detourage-travail.js`, `lib/studio-detourage.js` (clés `olda.detourage.*`, `olda-apercu-`), `vendor/LISEZMOI.md`, `vendor/olda-logo-x4*.onnx`, `outils/entrainer-olda.py`. Les autres tests : `node --test` passe (vectoriser, tailles-dtf, historique corrigés).

- [ ] **Step 9 : Commit**

```bash
git add lib/marque.js lib/marque.test.mjs index.html lib/studio-detourage.js lib/export-logo.js lib/pdf-vectoriel.js lib/pdf-image.js lib/vectoriser.js lib/vecteur-lisse.js lib/vectoriser.test.mjs lib/tailles-dtf.test.mjs lib/historique.test.mjs package.json README.md
git commit -m "La marque : « Logo maker » seul dans la page, la barre, les exports et le README (plus d'OLDA visible)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2 : Les identifiants, les modèles, les outils — zéro « olda »

**Files:**
- Modify: `lib/coffre.js:10`, `lib/detourage-travail.js:57-59,662`, `lib/studio-detourage.js` (clés `olda.detourage.*` lignes ~181, 187, 269, 275, 1778, 3315, 3547 ; `olda-apercu-` ligne ~4712)
- Rename: `vendor/olda-logo-x4.onnx` → `vendor/logo-x4.onnx`, `vendor/olda-logo-x4-fp16.onnx` → `vendor/logo-x4-fp16.onnx`, `outils/entrainer-olda.py` → `outils/entrainer-logo.py`
- Modify: `vendor/LISEZMOI.md:35`, `outils/convertir-onnx.py`, `outils/entrainer-logo.py` (ses commentaires de tête, le nom de sortie), `outils/banc-modeles.mjs`, `outils/logos-synthetiques.py` (docstring)
- Test: `lib/marque.test.mjs` (Task 1)

- [ ] **Step 1 : Les clés du poste**

`lib/coffre.js:10` : `const NOM = 'logo-maker'`.
`lib/detourage-travail.js:662` : `const RESERVE_GOOGLE = 'polices-google-1'`.
`lib/studio-detourage.js` : remplacer toutes les occurrences de `'olda.detourage.` par `'logomaker.` (sept lignes : `blanc`, `cotes`, `fond`) ; ligne ~4712 `'olda-apercu-'` → `'apercu-'` ; dans `monter` (ligne ~652), le crochet des bancs `hote.olda = { … }` devient `hote.studio = { … }` (le banc de Task 9 le lit sous ce nom). Pas de migration (spec 5 bis) : trois préférences reprennent leur valeur d'office une fois.

- [ ] **Step 2 : Les modèles**

```bash
git mv vendor/olda-logo-x4.onnx vendor/logo-x4.onnx
git mv vendor/olda-logo-x4-fp16.onnx vendor/logo-x4-fp16.onnx
git mv outils/entrainer-olda.py outils/entrainer-logo.py
```

`lib/detourage-travail.js:57-59` : `const MODELE_LOGO = 'logo-x4.onnx'`, `const DEMI_LOGO = ['logo-x4-fp16.onnx', 2444998]`. Vérifier que la taille du fp16 n'a pas changé : `ls -l vendor/logo-x4-fp16.onnx` → 2444998.

`vendor/LISEZMOI.md:35` : « `logo-x4.onnx`, `logo-x4-fp16.onnx` | LE MODÈLE MAISON (12 octobre 2026) : … ». Relire la ligne entière et remplacer chaque « OLDA » par « maison » ou « du produit ».

`outils/convertir-onnx.py`, `outils/entrainer-logo.py`, `outils/banc-modeles.mjs`, `outils/logos-synthetiques.py` : `grep -n -i olda` dans chacun ; remplacer les noms de fichiers (`olda-logo-x4` → `logo-x4`, `entrainer-olda` → `entrainer-logo`) et, dans les docstrings, « le modèle OLDA » → « le modèle maison ». Les scripts Python ne sont pas lancés ici : vérifier seulement qu'ils restent syntaxiquement valides : `python3 -m py_compile outils/convertir-onnx.py outils/entrainer-logo.py outils/logos-synthetiques.py`.

- [ ] **Step 3 : Le test passe**

Run: `node --test lib/marque.test.mjs`
Expected: PASS (2 tests). Puis `node --test` : tout passe.

- [ ] **Step 4 : Vérifier dans l'aperçu que l'IA charge le modèle renommé**

Ouvrir l'aperçu `logo-maker`, déposer `~/Downloads/CD447BBB-87EF-40CD-AF45-1B8C23149BB5.jpg` (un logo à plat, l'IA passe), lire `read_network_requests` : une requête `/vendor/logo-x4-fp16.onnx` (ou `logo-x4.onnx` sans `shader-f16`) en 200, aucune 404.

- [ ] **Step 5 : Commit**

```bash
git add -A lib/coffre.js lib/detourage-travail.js lib/studio-detourage.js vendor outils
git commit -m "Plus d'« olda » nulle part : clés du poste, modèles renommés logo-x4, outils, LISEZMOI

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3 : Plus rien de DTF — la couche de blanc Spot_1 et les préréglages partent

**Files:**
- Modify: `lib/pdf-vectoriel.js:133-176` (`SPOT_BLANC`, `RESSOURCES_BLANC`, `blancPdf`, l'option `blanc`), `lib/pdf-image.js:60-175` (`blanc`, `blancMasque`, `ressources`, `masqueBlanc`, l'objet `/ImageMask`), `lib/export-logo.js:55-95` (`blanc`, `couche`, `%%DocumentCustomColors`)
- Modify: `lib/historique.js` (le commentaire de la photo, `decrire` ligne ~143)
- Modify: `lib/studio-detourage.js` (imports lignes 58 et 69, `E.blanc` ~181, `gabarit` : le pied ~583-591 et la barre du plan ~518-521, `gabaritTaille` ~603-614, l'`input` ~686, `agir` ~3313, `GESTES`/`LIBELLES` ~3217, `photo` ~3450, `remettre` ~3547, `majPanneau` ~3757, `majTaille` ~1763-1765, `fichierDe` ~5207-5218, l'export Détouré ~5330, `--fond-textile` ~3783)
- Rename: `lib/tailles-dtf.js` → `lib/taille.js`, `lib/tailles-dtf.test.mjs` → `lib/taille.test.mjs`
- Modify: `index.html` (`.o-studio-spot` ~441, `.o-studio-choix` si plus utilisé, `--fond-textile` ~307, `modulepreload`)
- Modify tests: `lib/marque.test.mjs`, `lib/pdf-vectoriel.test.mjs`, `lib/pdf-image.test.mjs`, `lib/export-logo.test.mjs`, `lib/historique.test.mjs`, `lib/taille.test.mjs`
- Modify: `README.md`

**Interfaces:**
- Produces: `svgVersPdf(svg, { titre, largeurCm, cmjn })`, `imageVersPdf(rgba, l, h, { titre, largeurCm, decoupe, dessus })`, `svgVersEps(svg, { largeurCm, cmjn, titre })` — plus d'option `blanc`. `lib/taille.js` : `MM_MIN`, `MM_MAX`, `tailleImprimee`, `dpiA`, `mmDit`, `lireMm`. La photo de l'historique n'a plus de champ `blanc`. Le pied : `data-a="taille-fichier"` (revenir à 300 dpi du fichier).

- [ ] **Step 1 : Le test qui compte zéro « DTF » et zéro « Spot_1 »**

Dans `lib/marque.test.mjs`, étendre `sansCommentaires` aux commentaires HTML et ajouter un test :

```js
const sansCommentaires = s => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

test('plus rien de DTF ni de Spot_1 dans ce que l\'app dit', async () => {
  const fautes = []
  const motif = /spot_1|\bdtf\b/i
  for (const f of ['index.html', 'package.json', 'README.md']) {
    const s = sansCommentaires(await readFile(join(RACINE, f), 'utf8'))
    for (const [i, l] of s.split('\n').entries()) if (motif.test(l)) fautes.push(f + ':' + (i + 1))
  }
  for (const f of await readdir(join(RACINE, 'lib'))) {
    if (!f.endsWith('.js')) continue
    const s = sansCommentaires(await readFile(join(RACINE, 'lib', f), 'utf8'))
    for (const [i, l] of s.split('\n').entries()) if (motif.test(l)) fautes.push('lib/' + f + ':' + (i + 1))
  }
  assert.deepEqual(fautes, [])
})
```

Run: `node --test lib/marque.test.mjs`
Expected: FAIL — la liste des lignes à traiter (le pied, `tailles-dtf.js`, les exports, le README).

- [ ] **Step 2 : Les exports sans couche de blanc**

`lib/pdf-vectoriel.js` : supprimer le bloc de commentaire « LA COUCHE DE BLANC DTF » et les trois exports `SPOT_BLANC`, `RESSOURCES_BLANC`, `blancPdf` (lignes ~133-151). Dans `svgVersPdf` : la signature devient `{ titre = 'Logo vectorise - ' + MARQUE, largeurCm = 0, cmjn = null }` ; `dessin` perd `+ (blanc ? '\n' + blancPdf(blanc, W, H) : '')` ; l'objet page devient `'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + nombre(W) + ' ' + nombre(H) + '] /Resources << >> /Contents 4 0 R >>'`. Le commentaire au-dessus de `svgVersPdf` perd sa phrase sur `blanc`.

`lib/pdf-image.js` : supprimer `masqueBlanc` (`grep -n "function masqueBlanc" lib/pdf-image.js`, jusqu'à son `return`) et le commentaire « `blancMasque` (29 septembre 2026…) ». Dans `imageVersPdf` : la signature devient `{ titre = 'Detourage - ' + MARQUE, largeurCm = 0, decoupe = null, dessus = null }` ; le `Promise.all` ne garde que `zCmjn` et `zAlpha` (`const [zCmjn, zAlpha] = await Promise.all([…, …])`) ; `dessin` perd les deux lignes `+ (blanc ? …)` et `+ (zMasque ? …)` ; supprimer `const avecBlanc = …` ; dans l'objet page, `/Resources << /XObject << /Im0 5 0 R >> >>` (plus de `/Im1`, plus de `ressources`) ; supprimer le huitième objet (`zMasque ? [… /ImageMask true …] : null`) et la ligne `if (!objets[7]) objets.pop()`. Vérifier que la table des objets (`positions`, `xref`) compte bien `objets.length` entrées : lire la suite de la fonction.

`lib/export-logo.js` : `svgVersEps(svg, { largeurCm = 0, cmjn = null, titre = 'Logo vectorise - ' + MARQUE } = {})` ; supprimer `let couche = ''` et le bloc `if (blanc) { … }` ; `'gsave\n' + dessin + '\ngrestore\nshowpage\n%%EOF\n'` ; supprimer la ligne `+ (blanc ? '%%DocumentCustomColors: (Spot_1)\n' : '')` ; le commentaire perd sa phrase sur `blanc` ; en tête du fichier (ligne ~8), « la couche de blanc Spot_1 comprise » part.

- [ ] **Step 3 : L'historique**

`lib/historique.js` : dans le commentaire de la photo (ligne ~22), retirer `blanc,` ; dans `decrire`, supprimer `if (a.blanc !== b.blanc) return b.blanc ? 'Blanc DTF' : 'Blanc DTF coupé'` ; ligne ~7, « le blanc DTF, » part.

- [ ] **Step 4 : Le studio**

- Ligne 58 : `import { svgVersPdf, decoupePdf, dessinPdf, lireSvg, DPI } from './pdf-vectoriel.js'`.
- Ligne 69 : `import { tailleImprimee, dpiA, mmDit, lireMm } from './taille.js'`.
- `E` : supprimer `blanc: lire('logomaker.blanc', '1') !== '0',` et son commentaire « LA COUCHE DE BLANC DTF ».
- `gabarit`, le pied : supprimer `+ ligne('', 'Blanc DTF <small class="o-studio-spot">Spot_1</small>', 'blanc', 'Couche de blanc DTF')` ; le bouton Télécharger : `title="Le PDF vectoriel pour la presse (Ctrl S)"` ; l'article PNG : `article('enregistrer', 'png', 'PNG', 'à la taille d\'impression, fond transparent')`.
- `gabarit`, la barre du plan : `title="Couleur de fond" aria-label="Couleur de fond"` ; le bouton des cotes : `title="Les cotes du logo, à sa taille d\'impression (R)"`.
- `gabaritTaille` :

```js
/* LA TAILLE D'IMPRESSION : la largeur ou la hauteur tapée en mm, l'autre
   côté suit ; sans choix, 300 dpi des pixels (« Taille du fichier »). */
function gabaritTaille() {
  const champ = (cote, lettre, mot) => '<label class="o-studio-taille-champ" title="' + mot + ' imprimée"><span>' + lettre + '</span>'
    + '<input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" data-c="taille-' + cote + '" aria-label="' + mot + ' imprimée, en millimètres"><small>mm</small></label>'
  return '<div class="o-studio-taille">'
    + '<div class="o-studio-taille-tete"><b>Taille d\'impression</b>'
    + '<button type="button" class="o-studio-lien" data-a="taille-fichier" data-r="taille-fichier" title="Revenir à 300 dpi des pixels du fichier" hidden>Taille du fichier</button>'
    + '<span class="o-studio-taille-auto" data-r="taille-auto">300 dpi du fichier</span></div>'
    + '<div class="o-studio-taille-champs">' + champ('largeur', 'L', 'Largeur') + '<span class="o-studio-taille-fois" aria-hidden="true">×</span>' + champ('hauteur', 'H', 'Hauteur') + '</div>'
    + '<small class="o-studio-taille-note" data-r="taille-note" hidden></small>'
    + '</div>'
}
```

- L'`input` (ligne ~686) : supprimer `if (c === 'taille-pre') return choisirTaille(…)`.
- `agir` : supprimer le bloc `if (a === 'blanc') { … }` ; ajouter `if (a === 'taille-fichier') return choisirTaille(null)`.
- `GESTES` : retirer `'blanc'` ; `LIBELLES` : retirer son entrée s'il y en a une (`grep -n "LIBELLES" lib/studio-detourage.js`).
- `photo` : supprimer `blanc: E.blanc,`. `remettre` : supprimer `if (E.blanc !== p.blanc) { … }`.
- `majPanneau` : supprimer `basculer('blanc', E.blanc)` ; `scene.style.setProperty('--fond-couleur', E.fondVue.couleur)`.
- `majTaille` : remplacer les trois lignes `const choix = …`, `const val = …`, `if (choix && …)` par `r('taille-fichier').hidden = !E.taille` et `r('taille-auto').hidden = !!E.taille`.
- `fichierDe` : supprimer `const blanc = E.blanc ? a.svg : null` et son commentaire ; l'appel `imageVersPdf(v.rgba, v.imageL, v.imageH, { largeurCm, decoupe: …, dessus: … })` sans `blanc` ; `svgVersPdf(a.svg, { largeurCm })` ; `svgVersEps(a.svg, { largeurCm })`.
- L'export Détouré : `const pdf = () => imageVersPdf(img.data, img.largeur, img.hauteur, { largeurCm: t.l / 10 })` ; le commentaire « à la taille DTF choisie » → « à la taille d'impression choisie ».
- Les commentaires de tête (lignes ~32, 41) et celui de la taille (~1696, 4782) : « DTF » → « d'impression » (ce sont des commentaires, mais autant dire vrai).

- [ ] **Step 5 : `lib/taille.js`**

```bash
git mv lib/tailles-dtf.js lib/taille.js
git mv lib/tailles-dtf.test.mjs lib/taille.test.mjs
```

`lib/taille.js` : réécrire le commentaire de tête :

```js
/* ================================================= LA TAILLE D'IMPRESSION
   1er octobre 2026 (« toutes les tailles doivent être en mm ») ; 15
   octobre 2026 : plus de préréglages (ils étaient ceux du DTF d'un
   atelier — c'est un logiciel pour tout imprimeur). Le logo sort à la
   taille où il s'imprime — en largeur, ou en hauteur pour un logo tout en
   hauteur —, l'autre côté suit ses proportions. Sans choix, il sort à
   300 dpi de ses pixels (« Taille du fichier »). Tout se dit et se tape
   en millimètres. Pur : ni page, ni fil. */
```

Supprimer `TAILLES_DTF` et `prereglage` (et leur commentaire). `MM_MAX` : son commentaire « un film DTF se déroule » → « deux mètres : au-delà, ce n'est plus un logo ». `lib/taille.test.mjs` : l'import devient `{ tailleImprimee, dpiA, mmDit, lireMm, MM_MAX } from './taille.js'` ; supprimer le dernier test (« les préréglages »). `index.html` : `modulepreload` `lib/tailles-dtf.js` → `lib/taille.js` (ordre alphabétique : après `lib/sujet.js`).

- [ ] **Step 6 : Le style**

`index.html` : supprimer la règle `.o-studio-spot` ; `--fond-textile` → `--fond-couleur` (ligne ~307, et son commentaire « la couleur du textile » → « une couleur de fond ») ; `grep -n "o-studio-choix" index.html lib/studio-detourage.js` : si le studio ne l'utilise plus, supprimer ses règles ; ajouter `.o-studio-taille-auto { font-size:var(--t-petit); color:var(--encre-2); }` à côté des règles `.o-studio-taille-*`.

- [ ] **Step 7 : Les tests des exports et de l'historique**

`lib/pdf-vectoriel.test.mjs` : retirer `blancPdf` de l'import ; supprimer le test « la couche de blanc DTF : Spot_1… » (lignes ~73-88) sauf sa dernière assertion, à garder dans un test à part :

```js
test('aucune couche de blanc, aucun ton direct dans le PDF', () => {
  assert.doesNotMatch(svgVersPdf(SVG), /Spot_1|Surimp|Separation/)
})
```

`lib/pdf-image.test.mjs` : supprimer les deux tests « Détouré : le masque du blanc… » et « Détouré : le PDF porte le Spot_1… » (lignes ~70-89) ; retirer `masqueBlanc` de l'import s'il y est. `lib/export-logo.test.mjs` : supprimer le test « l'EPS garde la couche de blanc Spot_1 » (lignes ~47-49). `lib/historique.test.mjs` : retirer `blanc: true,` de `photo` ; le test qui fait `rafraichir(h, photo({ blanc: false }))` et lit `h.points[0].photo.blanc` (lignes ~45-46) : utiliser `lissage: 60` et lire `.photo.lissage` ; supprimer l'assertion `'Blanc DTF coupé'` (ligne ~142).

Run: `node --test`
Expected: PASS, `lib/marque.test.mjs` compris (zéro DTF, zéro Spot_1).

- [ ] **Step 8 : Le README**

`README.md` : « PDF en CMJN avec blanc DTF » → « PDF en CMJN » ; « à la taille DTF choisie (un préréglage d'atelier ou des millimètres tapés, ses cotes sur le plan) » → « à la taille d'impression choisie (des millimètres tapés, ses cotes sur le plan) » ; la ligne de la table `lib/tailles-dtf.js` → `| \`lib/taille.js\` | la taille d'impression : la taille imprimée d'un dessin, sa résolution |`.

- [ ] **Step 9 : Vérifier un export**

Aperçu : déposer `~/Downloads/CD447BBB-87EF-40CD-AF45-1B8C23149BB5.jpg`, attendre, « Télécharger le PDF » (dans le banc Playwright : `page.waitForEvent('download')`, puis `saveAs`), puis `grep -c "Spot_1\|Surimp" <pdf>` → 0 ; le pied montre « Taille d'impression · 300 dpi du fichier », taper `280` dans L : H suit, « Taille du fichier » apparaît, un clic le remet.

- [ ] **Step 10 : Commit**

```bash
git add -A lib index.html README.md
git commit -m "Plus rien de DTF : la couche de blanc Spot_1 part du code et des exports, les préréglages aussi ; la taille d'impression reste (lib/taille.js)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4 : `lib/fiche.js` — les mots et les lignes, à sec

**Files:**
- Create: `lib/fiche.js`
- Create: `lib/fiche.test.mjs`
- Modify: `index.html` (`modulepreload` : `lib/fiche.js`, après `lib/export-logo.js`)

**Interfaces:**
- Produces:
  - `MOTS` : l'objet de tous les mots de la fiche et de l'accueil.
  - `dureeMot(ms) → string` (« 0,8 s », « 1 min 05 ») et `environ(ms) → string` (« ~25 s ») — **déplacés** du studio (lignes ~3826 et ~3983 de `lib/studio-detourage.js`), le studio les importera en Task 7.
  - `lignesDe(etat) → Ligne[]` et `enTeteDe(etat) → { mot, valeur }`.
  - `Ligne = { id, titre, detail, etat, valeur, part, erreur, cachee }` avec `id` ∈ `'image' | 'fond' | 'version' | 'couleurs' | 'texte' | 'texte:<k>' | 'retoucher'`, `etat` ∈ `'attente' | 'cours' | 'fait' | 'echec' | 'omise'`, `part` : 0..1 ou `null`.
  - L'état plat attendu (construit par le studio en Task 7) :

```js
{
  image: true,                                   // un fichier est ouvert
  version: 'vecteur',                            // 'detoure' | 'vecteur' | 'image'
  fond: { methode: 'uni', interieur: true, teintes: [[255, 255, 255]] },   // methode 'uni' | 'ia' | 'entier'
  ia: { faite: true, ultra: true, decochee: false, voulue: true },         // faite : E.original ; voulue : l'interrupteur coché ; decochee : coupé à la main alors que le graphiste l'aurait lancée
  net: { faite: true, retire: true, flou: '1,8 px' },                     // retire : un flou a bien été retiré
  couleurs: { une: false, nom: '', n: 2, degrade: false },
  lignes: [{ texte: 'CERCLE DES CRÉATEURS', etat: 'proposee', police: 'Kameron', retiree: false }],  // etat 'recherche' | 'dessin' | 'reconnue' | 'proposee' | 'choisie'
  texte: { etat: 'pret' },                       // null | 'lecture' | 'recherche' | 'pret' | 'erreur'
  retouche: { formes: 3, contour: 0 },
  etapes: {                                      // seulement les étapes prévues pour ce fichier ; absentes = pas concernées
    net: { etat: 'fait', ms: 800 },
    ia: { etat: 'cours', part: 0.42, reste: 14000, mot: 'Ultra' },    // etat 'attente' | 'cours' | 'fait' | 'echec' ; ms (faite) ; part (null si inconnue), depuis (ms écoulées), reste (ms, 0 = inconnu), mot ('téléchargement', 'mise en route', 'Ultra', 'polices'), erreur (échec)
    sujet: {}, detourage: {}, trace: {}, texte: {}, combler: {},
  },
  prep: { lecture: false, fini: false, total: 0 },   // la préparation du FICHIER : lecture en cours, finie, sa durée totale
}
```

- [ ] **Step 1 : Écrire les tests des mots, ligne par ligne**

`lib/fiche.test.mjs` :

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lignesDe, enTeteDe, dureeMot, environ, MOTS } from './fiche.js'

/* L'état plat d'un logo à plat, tout fini : la base que chaque test déforme. */
const etat = (p = {}) => Object.assign({
  image: true,
  version: 'vecteur',
  fond: { methode: 'uni', interieur: true, teintes: [[255, 255, 255]] },
  ia: { faite: true, ultra: false, decochee: false, voulue: true },
  net: { faite: false, retire: false, flou: '' },
  couleurs: { une: false, nom: '', n: 2, degrade: false },
  lignes: [],
  texte: { etat: 'pret' },
  retouche: { formes: 3, contour: 0 },
  etapes: { ia: { etat: 'fait', ms: 6400 }, detourage: { etat: 'fait', ms: 200 }, trace: { etat: 'fait', ms: 800 }, texte: { etat: 'fait', ms: 9000 } },
  prep: { lecture: false, fini: true, total: 16400 },
}, p)
const ligne = (e, id) => lignesDe(e).find(l => l.id === id)
const ids = e => lignesDe(e).filter(l => !l.cachee).map(l => l.id)

test('un logo à plat fini : les lignes dans l\'ordre, en mots de vendeuse', () => {
  assert.deepEqual(ids(etat()), ['image', 'fond', 'version', 'couleurs', 'retoucher'])
  const im = ligne(etat(), 'image')
  assert.equal(im.titre, 'Image améliorée')
  assert.equal(im.detail, 'agrandie ×4')
  assert.equal(im.etat, 'fait')
  assert.equal(im.valeur, '6,4 s')
  const f = ligne(etat(), 'fond')
  assert.equal(f.titre, 'Fond retiré')
  assert.equal(f.detail, 'partout, même dans les lettres')
  const v = ligne(etat(), 'version')
  assert.equal(v.titre, 'Vectorisé')
  assert.equal(v.detail, 'net à toute taille')
  const c = ligne(etat(), 'couleurs')
  assert.equal(c.titre, '2 couleurs')
  assert.equal(c.detail, 'd\'origine')
  const r = ligne(etat(), 'retoucher')
  assert.equal(r.titre, 'Retoucher')
  assert.equal(r.detail, 'calques, contour, gomme, déplacer')
  assert.equal(r.etat, 'omise')
})

test('aucun jargon dans une ligne fermée', () => {
  for (const l of lignesDe(etat())) for (const mot of ['nœud', 'seuil', 'lissage', 'nuance', 'tolérance', 'masque', 'BiRefNet', 'ISNet']) {
    assert.doesNotMatch(l.titre + ' ' + l.detail, new RegExp(mot, 'i'), l.id + ' dit « ' + mot + ' »')
  }
})

test('l\'Ultra et le flou corrigé se disent ; une couleur, dégradé, autour, sujet, entier', () => {
  assert.equal(ligne(etat({ ia: { faite: true, ultra: true, decochee: false, voulue: true }, net: { faite: true, retire: true, flou: '1,8 px' } }), 'image').detail, 'agrandie ×4, Ultra, flou corrigé')
  assert.equal(ligne(etat({ net: { faite: true, retire: false, flou: '0,3 px' } }), 'image').detail, 'agrandie ×4')
  assert.equal(ligne(etat({ couleurs: { une: true, nom: 'Noir', n: 2, degrade: false } }), 'couleurs').titre, 'Une couleur')
  assert.equal(ligne(etat({ couleurs: { une: true, nom: 'Noir', n: 2, degrade: false } }), 'couleurs').detail, 'Noir')
  assert.equal(ligne(etat({ version: 'image', couleurs: { une: false, nom: '', n: 0, degrade: true } }), 'couleurs').titre, 'Dégradés')
  assert.equal(ligne(etat({ fond: { methode: 'uni', interieur: false, teintes: [] } }), 'fond').detail, 'autour du logo seulement')
  const s = ligne(etat({ fond: { methode: 'ia', interieur: true, teintes: [] } }), 'fond')
  assert.equal(s.titre, 'Sujet détouré')
  assert.equal(s.detail, 'trouvé par l\'IA')
  const en = ligne(etat({ fond: { methode: 'entier', interieur: true, teintes: [] } }), 'fond')
  assert.equal(en.titre, 'Fond gardé')
  assert.equal(en.detail, 'l\'image entière')
  assert.equal(ligne(etat({ couleurs: { une: false, nom: '', n: 1, degrade: false } }), 'couleurs').titre, '1 couleur')
})

test('l\'image gardée telle quelle, ou décochée', () => {
  const g = ligne(etat({ ia: { faite: false, ultra: false, decochee: false, voulue: false }, etapes: {} }), 'image')
  assert.equal(g.titre, 'Image gardée telle quelle')
  assert.equal(g.detail, 'déjà nette et grande')
  assert.equal(g.etat, 'omise')
  const d = ligne(etat({ ia: { faite: false, ultra: false, decochee: true, voulue: false }, etapes: {} }), 'image')
  assert.equal(d.titre, 'Sans amélioration')
  assert.equal(d.detail, 'décochée')
})

test('une photo en Détouré : Couleurs cachée, Version « Détouré »', () => {
  const e = etat({ version: 'detoure', fond: { methode: 'ia', interieur: true, teintes: [] }, etapes: { ia: { etat: 'fait', ms: 5000 }, sujet: { etat: 'fait', ms: 1200 }, detourage: { etat: 'fait', ms: 100 }, texte: { etat: 'fait', ms: 300 } } })
  assert.deepEqual(ids(e), ['image', 'fond', 'version', 'retoucher'])
  assert.equal(ligne(e, 'couleurs').cachee, true)
  assert.equal(ligne(e, 'version').titre, 'Détouré')
  assert.equal(ligne(e, 'version').detail, 'les pixels du fichier, sans le fond')
  assert.equal(ligne(e, 'fond').valeur, '1,3 s')
})

test('l\'IA en cours : la ligne Image dit sa part, l\'Ultra, le temps qui reste ; ce qui suit attend', () => {
  const e = etat({ ia: { faite: false, ultra: true, decochee: false, voulue: true }, etapes: { ia: { etat: 'cours', part: 0.42, reste: 14000, mot: 'Ultra' }, detourage: { etat: 'attente' }, trace: { etat: 'attente' }, texte: { etat: 'attente' } }, prep: { lecture: false, fini: false, total: 0 } })
  const im = ligne(e, 'image')
  assert.equal(im.titre, 'Image en cours')
  assert.equal(im.detail, 'Ultra · encore ~14 s')
  assert.equal(im.etat, 'cours')
  assert.equal(im.valeur, '42 %')
  assert.equal(im.part, 0.42)
  assert.equal(ligne(e, 'fond').etat, 'attente')
  assert.equal(ligne(e, 'version').etat, 'attente')
  assert.equal(ligne(e, 'version').titre, 'Vectorisé')
  assert.equal(enTeteDe(e).mot, 'Préparation…')
  assert.equal(enTeteDe(e).valeur, '')
})

test('une part inconnue : les secondes passées ; le téléchargement se dit ; sous 1,5 s rien ne reste', () => {
  const e = etat({ etapes: { ia: { etat: 'cours', part: null, depuis: 3400, reste: 0, mot: 'mise en route' } }, ia: { faite: false, ultra: false, decochee: false, voulue: true } })
  assert.equal(ligne(e, 'image').valeur, '3 s')
  assert.equal(ligne(e, 'image').detail, 'mise en route')
  const t = etat({ etapes: { ia: { etat: 'cours', part: 0.1, depuis: 500, reste: 1000, mot: 'téléchargement' } }, ia: { faite: false, ultra: false, decochee: false, voulue: true } })
  assert.equal(ligne(t, 'image').detail, 'téléchargement')
  assert.equal(ligne(t, 'image').valeur, '10 %')
})

test('le tracé en cours : Version et Couleurs le disent', () => {
  const e = etat({ etapes: { trace: { etat: 'cours', part: null, depuis: 600, reste: 0, mot: '' } } })
  assert.equal(ligne(e, 'version').titre, 'Tracé en cours')
  assert.equal(ligne(e, 'version').etat, 'cours')
  assert.equal(ligne(e, 'couleurs').titre, 'Couleurs')
  assert.equal(ligne(e, 'couleurs').detail, 'en cours')
})

test('un échec reste dans sa ligne, en rouge, avec le message', () => {
  const e = etat({ etapes: { ia: { etat: 'echec', erreur: 'L\'IA n\'a pas pu tourner : mémoire.' } }, ia: { faite: false, ultra: false, decochee: false, voulue: true } })
  const im = ligne(e, 'image')
  assert.equal(im.etat, 'echec')
  assert.equal(im.erreur, 'L\'IA n\'a pas pu tourner : mémoire.')
  assert.equal(im.titre, 'Image améliorée')
})

test('les textes : une ligne par texte lu, dans ses quatre états, puis retirée', () => {
  const e = etat({ lignes: [
    { texte: 'CERCLE DES CRÉATEURS', etat: 'proposee', police: 'Kameron', retiree: false },
    { texte: 'DIB', etat: 'reconnue', police: 'Montserrat', retiree: false },
    { texte: 'SEA VIEW', etat: 'dessin', police: '', retiree: false },
    { texte: 'VILLAS', etat: 'choisie', police: 'Bebas Neue', retiree: false },
    { texte: 'POOL', etat: 'recherche', police: '', retiree: false },
    { texte: 'BAR', etat: 'reconnue', police: 'Lato', retiree: true },
  ] })
  assert.deepEqual(ids(e), ['image', 'fond', 'version', 'couleurs', 'texte:0', 'texte:1', 'texte:2', 'texte:3', 'texte:4', 'texte:5', 'retoucher'])
  assert.equal(ligne(e, 'texte:0').titre, 'CERCLE DES CRÉATEURS')
  assert.equal(ligne(e, 'texte:0').detail, 'Kameron proposée')
  assert.equal(ligne(e, 'texte:1').detail, 'Montserrat reconnue et posée')
  assert.equal(ligne(e, 'texte:2').detail, 'dessin d\'origine')
  assert.equal(ligne(e, 'texte:3').detail, 'Bebas Neue, choisie')
  assert.equal(ligne(e, 'texte:4').detail, 'recherche de la police…')
  assert.equal(ligne(e, 'texte:5').detail, 'retirée')
  assert.equal(ligne(e, 'texte:5').etat, 'omise')
})

test('pendant la lecture du texte, une seule ligne « Texte » ; rien lu, rien', () => {
  const l = etat({ texte: { etat: 'lecture' }, etapes: { texte: { etat: 'cours', part: null, depuis: 2000, reste: 0, mot: '' } } })
  assert.deepEqual(ids(l).filter(i => i.startsWith('texte')), ['texte'])
  assert.equal(ligne(l, 'texte').titre, 'Texte')
  assert.equal(ligne(l, 'texte').detail, 'lecture en cours')
  assert.equal(ligne(l, 'texte').valeur, '2 s')
  const r = etat({ texte: { etat: 'recherche' }, etapes: { texte: { etat: 'cours', part: 0.5, depuis: 2000, reste: 0, mot: 'polices' } } })
  assert.equal(ligne(r, 'texte').detail, 'recherche des polices')
  assert.equal(ligne(r, 'texte').valeur, '50 %')
  assert.deepEqual(ids(etat({ texte: { etat: 'pret' }, lignes: [] })).filter(i => i.startsWith('texte')), [])
  assert.equal(ligne(etat({ texte: { etat: 'erreur' } }), 'texte').detail, 'lecture indisponible')
})

test('le rebouchage se dit dans Retoucher', () => {
  const e = etat({ etapes: { combler: { etat: 'cours', part: 0.4, depuis: 300, reste: 0, mot: '' } } })
  assert.equal(ligne(e, 'retoucher').detail, 'rebouchage 40 %')
  assert.equal(ligne(e, 'retoucher').etat, 'cours')
})

test('l\'en-tête : la lecture, la préparation, prêt et son temps ; sans fichier, rien', () => {
  assert.deepEqual(enTeteDe(etat({ image: false, prep: { lecture: false, fini: false, total: 0 } })), { mot: '', valeur: '' })
  assert.deepEqual(enTeteDe(etat({ image: false, prep: { lecture: true, fini: false, total: 0 } })), { mot: 'Lecture du fichier…', valeur: '' })
  assert.deepEqual(enTeteDe(etat({ prep: { lecture: false, fini: false, total: 0 } })), { mot: 'Préparation…', valeur: '' })
  assert.deepEqual(enTeteDe(etat()), { mot: 'Prêt', valeur: '16,4 s' })
})

test('sans fichier, aucune ligne', () => {
  assert.deepEqual(lignesDe(etat({ image: false })), [])
})

test('les durées et les temps à la louche', () => {
  assert.equal(dureeMot(80), '< 0,1 s')
  assert.equal(dureeMot(830), '0,8 s')
  assert.equal(dureeMot(65000), '1 min 05')
  assert.equal(environ(25000), '~25 s')
  assert.equal(environ(80000), '~1 min 20')
  assert.equal(environ(118000), '~2 min')
})

test('les mots de l\'accueil sont là, en trois lignes', () => {
  assert.equal(MOTS.accueil.lignes.length, 3)
  assert.equal(MOTS.accueil.exemples, 'Ou essaie avec un exemple')
})
```

- [ ] **Step 2 : Le lancer, le voir échouer**

Run: `node --test lib/fiche.test.mjs`
Expected: FAIL — `Cannot find module './fiche.js'`.

- [ ] **Step 3 : Écrire `lib/fiche.js`**

```js
/* LA FICHE (15 octobre 2026, « ultra simple d'utilisation » : la vendeuse
   voit le résultat et les décisions en mots, changeables d'un clic). Le
   panneau de droite n'est plus une liste de réglages : il dit CE QUE L'APP
   A FAIT, une ligne par décision du graphiste, dans l'ordre de la chaîne,
   en mots de vendeuse — et chaque ligne s'ouvre sur le réglage qui la
   change. Ce module est pur : l'état plat que lui donne le studio
   (`etatFiche`, lib/studio-detourage.js) → les lignes et leurs mots. Rien
   d'autre : c'est lui qu'on teste à sec, et c'est ici que le chantier
   français / anglais traduira (`MOTS`). Spec :
   docs/superpowers/specs/2026-10-12-parcours-en-un-geste-design.md */

/* TOUS LES MOTS de la fiche et de l'accueil. Des mots de vendeuse : jamais
   « nœuds », « seuil », « lissage » dans une ligne fermée. */
export const MOTS = {
  enTete: { lecture: 'Lecture du fichier…', cours: 'Préparation…', pret: 'Prêt' },
  image: {
    titre: 'Image améliorée', cours: 'Image en cours', agrandie: 'agrandie ×4', ultra: 'Ultra', flou: 'flou corrigé',
    gardee: 'Image gardée telle quelle', gardeeDetail: 'déjà nette et grande',
    sans: 'Sans amélioration', sansDetail: 'décochée',
    aideIA: 'Le logo redessiné net et agrandi ×4 par l\'IA, fidèle au fichier',
    aideNet: 'Le flou du fichier mesuré et retiré avant l\'IA, sans rien inventer',
  },
  fond: {
    retire: 'Fond retiré', partout: 'partout, même dans les lettres', autour: 'autour du logo seulement',
    sujet: 'Sujet détouré', sujetDetail: 'trouvé par l\'IA', entier: 'Fond gardé', entierDetail: 'l\'image entière',
    cours: 'Fond en cours', aideSeuil: 'Plus haut : plus de fond part',
  },
  version: {
    vecteur: 'Vectorisé', vecteurDetail: 'net à toute taille', image: 'Image', imageDetail: 'dégradés et textures gardés',
    detoure: 'Détouré', detoureDetail: 'les pixels du fichier, sans le fond', cours: 'Tracé en cours',
    aideLissage: 'Plus haut : des courbes plus douces',
  },
  couleurs: {
    n: n => n + ' couleur' + (n > 1 ? 's' : ''), origine: 'd\'origine', degrade: 'Dégradés', degradeDetail: 'les couleurs du fichier',
    une: 'Une couleur', cours: 'Couleurs', coursDetail: 'en cours', aideNuances: 'Auto : le graphiste compte les teintes',
  },
  texte: {
    titre: 'Texte', lecture: 'lecture en cours', recherche: 'recherche des polices', erreur: 'lecture indisponible',
    reconnue: p => p + ' reconnue et posée', proposee: p => p + ' proposée', choisie: p => p + ', choisie',
    dessin: 'dessin d\'origine', rechercheLigne: 'recherche de la police…', retiree: 'retirée',
  },
  retoucher: { titre: 'Retoucher', detail: 'calques, contour, gomme, déplacer', comble: p => 'rebouchage ' + p + ' %', gomme: 'La gomme est sur le plan (G)' },
  encore: 'encore',
  accueil: {
    lignes: ['Le fond part, le flou aussi, le texte retrouve sa police.', 'Le fichier ressort prêt pour la presse.', 'Rien ne quitte ce poste.'],
    exemples: 'Ou essaie avec un exemple',
  },
}

/* « 0,4 s », « 12,8 s », « 1 min 05 » : une durée mesurée. */
export function dureeMot(ms) {
  if (ms < 100) return '< 0,1 s'
  if (ms < 60000) return (ms / 1000).toFixed(1).replace('.', ',') + ' s'
  return Math.floor(ms / 60000) + ' min ' + String(Math.floor(ms % 60000 / 1000)).padStart(2, '0')
}

/* Un temps à attendre, à la louche : « ~25 s », « ~1 min 20 ». */
export function environ(ms) {
  const s = Math.max(1, Math.round(ms / 1000))
  if (s < 60) return '~' + s + ' s'
  const m = Math.floor(s / 60), r = Math.round(s % 60 / 10) * 10
  return r === 60 ? '~' + (m + 1) + ' min' : '~' + m + ' min' + (r ? ' ' + r : '')
}

/* L'état d'une ligne, lu sur ses étapes : un échec l'emporte, puis ce qui
   tourne, puis ce qui attend, puis ce qui est fait ; rien de prévu :
   « omise » (ni icône, ni durée). */
const etatDe = pas => {
  const p = pas.filter(Boolean)
  for (const e of ['echec', 'cours', 'attente', 'fait']) if (p.some(x => x.etat === e)) return e
  return 'omise'
}
const enCours = pas => pas.find(p => p && p.etat === 'cours') || null
/* Ce qui s'affiche à droite : la part de l'étape qui tourne (ou ses
   secondes passées, sans part connue), sinon la durée de ce qui est fait. */
const valeurDe = pas => {
  const c = enCours(pas)
  if (c) return c.part !== null && c.part !== undefined ? Math.round(c.part * 100) + ' %' : (c.depuis || 0) >= 1000 ? Math.floor(c.depuis / 1000) + ' s' : ''
  const ms = pas.reduce((s, p) => s + (p && p.etat === 'fait' && p.ms ? p.ms : 0), 0)
  return ms ? dureeMot(ms) : ''
}
const partDe = pas => { const c = enCours(pas); return c && c.part !== null && c.part !== undefined ? Math.max(0, Math.min(1, c.part)) : null }
const erreurDe = pas => { const p = pas.find(x => x && x.etat === 'echec'); return p ? p.erreur || 'Erreur inconnue.' : '' }
/* Le sous-titre d'une étape qui tourne : sa phase, et le temps qui reste
   quand on le sait (1,5 s au moins). */
const motCours = (c, ...avant) => [...avant, c.mot && c.mot !== 'Ultra' ? c.mot : '', c.reste >= 1500 ? MOTS.encore + ' ' + environ(c.reste) : ''].filter(Boolean).join(' · ')

const ligne = (id, titre, detail, pas, extra = {}) => Object.assign({
  id, titre, detail, etat: etatDe(pas), valeur: valeurDe(pas), part: partDe(pas), erreur: erreurDe(pas), cachee: false,
}, extra)

function ligneImage(e) {
  const pas = [e.etapes.net, e.etapes.ia]
  const c = enCours(pas)
  if (c) return ligne('image', MOTS.image.cours, motCours(c, c === e.etapes.ia && e.ia.ultra ? MOTS.image.ultra : ''), pas)
  if (etatDe(pas) === 'attente') return ligne('image', MOTS.image.titre, MOTS.image.agrandie, pas)
  if (etatDe(pas) === 'echec') return ligne('image', MOTS.image.titre, MOTS.image.agrandie, pas)
  if (!e.ia.faite) {
    if (e.ia.decochee) return ligne('image', MOTS.image.sans, MOTS.image.sansDetail, [])
    return ligne('image', MOTS.image.gardee, MOTS.image.gardeeDetail, [])
  }
  const detail = [MOTS.image.agrandie, e.ia.ultra ? MOTS.image.ultra : '', e.net.faite && e.net.retire ? MOTS.image.flou : ''].filter(Boolean).join(', ')
  return ligne('image', MOTS.image.titre, detail, pas)
}

function ligneFond(e) {
  const pas = [e.etapes.sujet, e.etapes.detourage]
  const c = enCours(pas)
  const m = e.fond.methode
  const titre = m === 'ia' ? MOTS.fond.sujet : m === 'entier' ? MOTS.fond.entier : MOTS.fond.retire
  const detail = m === 'ia' ? MOTS.fond.sujetDetail : m === 'entier' ? MOTS.fond.entierDetail : e.fond.interieur ? MOTS.fond.partout : MOTS.fond.autour
  if (c) return ligne('fond', MOTS.fond.cours, motCours(c, detail), pas)
  return ligne('fond', titre, detail, pas)
}

function ligneVersion(e) {
  const pas = [e.etapes.trace]
  const c = enCours(pas)
  const v = e.version
  const titre = v === 'detoure' ? MOTS.version.detoure : v === 'image' ? MOTS.version.image : MOTS.version.vecteur
  const detail = v === 'detoure' ? MOTS.version.detoureDetail : v === 'image' ? MOTS.version.imageDetail : MOTS.version.vecteurDetail
  if (c && v !== 'detoure') return ligne('version', MOTS.version.cours, motCours(c, detail), pas)
  return ligne('version', titre, detail, pas)
}

function ligneCouleurs(e) {
  const pas = [e.etapes.trace]
  const cachee = e.version === 'detoure'
  if (enCours(pas) && !cachee) return ligne('couleurs', MOTS.couleurs.cours, MOTS.couleurs.coursDetail, pas, { cachee, valeur: '' })
  const c = e.couleurs
  const [titre, detail] = c.une ? [MOTS.couleurs.une, c.nom] : c.degrade ? [MOTS.couleurs.degrade, MOTS.couleurs.degradeDetail] : [MOTS.couleurs.n(c.n), MOTS.couleurs.origine]
  /* La durée est celle du tracé, déjà dite sur Version : pas deux fois. */
  return ligne('couleurs', titre, detail, [], { cachee, etat: etatDe(pas) === 'echec' ? 'echec' : 'omise' })
}

function lignesTexte(e) {
  const pas = [e.etapes.texte]
  const t = e.texte && e.texte.etat
  if (t === 'lecture' || t === 'recherche') return [ligne('texte', MOTS.texte.titre, t === 'lecture' ? MOTS.texte.lecture : MOTS.texte.recherche, pas)]
  if (t === 'erreur') return [ligne('texte', MOTS.texte.titre, MOTS.texte.erreur, pas, { etat: 'echec' })]
  if (etatDe(pas) === 'attente' && !e.lignes.length) return [ligne('texte', MOTS.texte.titre, MOTS.texte.lecture, pas)]
  return e.lignes.map((l, k) => {
    if (l.retiree) return ligne('texte:' + k, l.texte, MOTS.texte.retiree, [], { etat: 'omise' })
    const detail = l.etat === 'recherche' ? MOTS.texte.rechercheLigne : l.etat === 'reconnue' ? MOTS.texte.reconnue(l.police) : l.etat === 'proposee' ? MOTS.texte.proposee(l.police) : l.etat === 'choisie' ? MOTS.texte.choisie(l.police) : MOTS.texte.dessin
    return ligne('texte:' + k, l.texte, detail, [], { etat: l.etat === 'recherche' ? 'cours' : 'fait' })
  })
}

function ligneRetoucher(e) {
  const pas = [e.etapes.combler]
  const c = enCours(pas)
  if (c) return ligne('retoucher', MOTS.retoucher.titre, c.part !== null && c.part !== undefined ? MOTS.retoucher.comble(Math.round(c.part * 100)) : MOTS.retoucher.detail, pas, { valeur: '' })
  return ligne('retoucher', MOTS.retoucher.titre, MOTS.retoucher.detail, [], { etat: etatDe(pas) === 'echec' ? 'echec' : 'omise', erreur: erreurDe(pas) })
}

/* LES LIGNES de la fiche, dans l'ordre de la chaîne. Sans fichier, rien. */
export function lignesDe(e) {
  if (!e.image) return []
  return [ligneImage(e), ligneFond(e), ligneVersion(e), ligneCouleurs(e), ...lignesTexte(e), ligneRetoucher(e)]
}

/* L'EN-TÊTE : la lecture du fichier, la préparation qui tourne, puis
   « Prêt » et le temps total du dépôt à la dernière étape. */
export function enTeteDe(e) {
  if (e.prep.lecture) return { mot: MOTS.enTete.lecture, valeur: '' }
  if (!e.image) return { mot: '', valeur: '' }
  if (!e.prep.fini) return { mot: MOTS.enTete.cours, valeur: '' }
  return { mot: MOTS.enTete.pret, valeur: e.prep.total ? dureeMot(e.prep.total) : '' }
}
```

- [ ] **Step 4 : Lancer les tests, les faire passer**

Run: `node --test lib/fiche.test.mjs`
Expected: PASS (15 tests). Si un mot diffère, c'est le code qui s'aligne sur le test (les tests sont le spec des mots), sauf faute de frappe dans le test.

- [ ] **Step 5 : `modulepreload` et le test du serveur**

`index.html` : ajouter `<link rel="modulepreload" href="lib/fiche.js">` après `lib/export-logo.js`. Le module n'est pas encore importé par le studio : le test `serveur.test.mjs` (« précharge exactement les modules que la page importe ») **échouera** tant que Task 7 n'importe pas `fiche.js`. Pour garder la branche verte à chaque commit : ajouter l'import dès maintenant dans `lib/studio-detourage.js` (`import { lignesDe as lignesFiche, enTeteDe as enTeteFiche, MOTS as MOTS_FICHE, dureeMot, environ } from './fiche.js'`) et **supprimer** les deux fonctions locales `dureeMot` (ligne ~3983) et `environ` (ligne ~3826) du studio, remplacées par les imports (mêmes noms, mêmes signatures). Ne pas importer un symbole nommé `fiche` : le studio a déjà une fonction `fiche(rvb)` (le nuancier).

Run: `node --test`
Expected: PASS, dont serveur.test.mjs.

- [ ] **Step 6 : Commit**

```bash
git add lib/fiche.js lib/fiche.test.mjs index.html lib/studio-detourage.js
git commit -m "La fiche : les mots et les lignes (lib/fiche.js, pur, testé à sec)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5 : Le gabarit de la fiche, le style, les lignes qui s'ouvrent (sans calcul)

**Files:**
- Modify: `lib/studio-detourage.js` (`gabarit` lignes ~492-600, `E` : `ficheOuverte`, `agir` : action `fiche`, `majPanneau` : `r('modes')`)
- Modify: `index.html` (CSS : `.o-studio-fiche*`, retrait de `.o-studio-modes*`, `.o-studio-prep*` sauf `-dit` renommé `.o-studio-fiche-dit`)
- Test: `lib/studio-detourage.test.mjs` (un test du gabarit si le fichier en a ; sinon le banc de Task 9)

**Interfaces:**
- Produces: le DOM de la fiche que `majFiche` (Task 7) remplit :
  - `[data-r="fiche"]` : le conteneur ; `[data-r="fiche-tete"]` (`<b data-r="fiche-mot">`, `<span data-r="fiche-val">`).
  - Une section par ligne fixe : `<section class="o-studio-fiche-ligne" data-ligne="image|fond|version|couleurs|retoucher" data-etat="omise">` avec `<button data-a="fiche" data-v="image" aria-expanded="false" aria-controls="o-studio-corps-image" id="o-studio-ligne-image">` contenant `<span class="o-studio-fiche-etat"><i></i>` + `ic('check')` + `ic('x')` + `</span><span class="o-studio-fiche-mots"><b data-r="fiche-titre-image"></b><small data-r="fiche-detail-image"></small></span><span class="o-studio-fiche-val" data-r="fiche-val-image"></span>` + `ic('chevron-down')` ; puis `<span class="o-studio-fiche-barre" data-r="fiche-barre-image" hidden><i></i></span><p class="o-studio-fiche-erreur" data-r="fiche-erreur-image" hidden></p><div class="o-studio-fiche-corps" id="o-studio-corps-image" role="region" aria-labelledby="o-studio-ligne-image" hidden>…</div>`.
  - `[data-r="fiche-textes"]` : le conteneur des lignes de texte (dessinées par `majFiche`), placé entre `couleurs` et `retoucher`.
  - `E.ficheOuverte` : l'`id` de la ligne ouverte ou `''`.

- [ ] **Step 1 : Réécrire la partie `<aside>` de `gabarit`**

Remplacer, dans `gabarit()`, tout ce qui va de `'<aside class="o-studio-panneau">'` à `'  <div class="o-studio-inspecteur" …'` (exclu) par :

```js
    + '<aside class="o-studio-panneau">'
    + '  <div class="o-studio-defile">'
    + '    <div class="o-studio-fiche" data-r="fiche" data-besoin="image">'
    + '      <div class="o-studio-fiche-tete" data-r="fiche-tete"><b data-r="fiche-mot"></b><span data-r="fiche-val"></span></div>'
    + '      <span class="o-studio-fiche-dit" data-r="fiche-dit" role="status"></span>'
    + ficheLigne('image', ''
      + ligne('sparkles', '<b>Améliorer l\'image</b>', 'nettoyer', 'Améliorer l\'image', 'ia-etat')
      + '<p class="o-studio-aide">' + MOTS_FICHE.image.aideIA + '</p>'
      + ligne('focus', '<b>Améliorer la netteté</b>', 'net', 'Améliorer la netteté', 'net-etat')
      + '<p class="o-studio-aide">' + MOTS_FICHE.image.aideNet + '</p>'
      + '<button type="button" class="o-studio-bouton o-studio-discret" data-a="ultra" data-r="ultra" hidden title="Le modèle haut de gamme, passé plusieurs fois : des bords plus fidèles — plus long sur ce poste">' + ic('wand-sparkles') + '<span data-r="ultra-mot"></span></button>')
    + ficheLigne('fond', ''
      + '<div class="o-studio-segment" role="radiogroup" aria-label="Le fond à retirer">'
      + '  <button type="button" role="radio" data-a="fond-retire" data-v="autour" title="Le fond autour du logo, et dans les lettres posées dehors">Autour</button>'
      + '  <button type="button" role="radio" data-a="fond-retire" data-v="partout" title="Le fond partout, même dans les lettres et les cercles">Partout</button>'
      + '  <button type="button" role="radio" data-a="fond-retire" data-v="sujet" title="Le sujet d\'une photo, trouvé par l\'IA">' + ic('sparkles') + 'Sujet</button>'
      + '  <button type="button" role="radio" data-a="fond-retire" data-v="entier" title="Le fond reste : une pochette d\'album, une affiche, une photo gardée entière — l\'image telle quelle, seulement améliorée">Entier</button>'
      + '</div>'
      + curseur('seuil', 'Seuil', null)
      + '<p class="o-studio-aide" data-r="aide-seuil">' + MOTS_FICHE.fond.aideSeuil + '</p>')
    + ficheLigne('version', ''
      + '<div class="o-studio-segment" role="radiogroup" aria-label="Version">'
      + '  <button type="button" role="radio" data-a="version" data-v="detoure" title="Le fond autour du logo retiré, les pixels du fichier tels quels, rien de vectorisé (D)">' + ic('scissors') + 'Détouré</button>'
      + '  <button type="button" role="radio" data-a="version" data-v="vecteur" title="De vraies formes, nettes à tous les zooms (V)">' + ic('shapes') + 'Vecteur</button>'
      + '  <button type="button" role="radio" data-a="version" data-v="image" title="Les pixels du fichier dans le contour : dégradés et textures intacts (I)">' + ic('image') + 'Image</button>'
      + '</div>'
      + '<div data-trace>' + curseur('lissage', 'Lissage', 0, 100, LISSAGE) + '<p class="o-studio-aide">' + MOTS_FICHE.version.aideLissage + '</p></div>')
    + ficheLigne('couleurs', ''
      + curseur('nuances', 'Nuances', 0, 100, 50)
      + '<p class="o-studio-aide">' + MOTS_FICHE.couleurs.aideNuances + '</p>'
      + '<div class="o-studio-palette" data-r="palette"></div>'
      + '<div class="o-studio-segment" role="radiogroup" aria-label="Couleurs">'
      + '  <button type="button" role="radio" data-a="teinte-mode" data-v="multi">D\'origine</button>'
      + '  <button type="button" role="radio" data-a="teinte-mode" data-v="une">Une couleur</button>'
      + '</div>'
      + '<div class="o-studio-pastilles" role="radiogroup" aria-label="Couleur du nuancier" data-r="une" hidden>'
      + NUANCIER.map(c => '<button type="button" role="radio" data-a="teinte" data-v="' + c.nom + '"' + pastille(c.rvb) + '><i style="background:' + rvbHex(c.rvb) + '"></i></button>').join('')
      + '</div>', ' data-trace')
    + '      <div class="o-studio-fiche-textes" data-r="fiche-textes"></div>'
    + ficheLigne('retoucher', ''
      + '<div class="o-studio-textes" data-r="formes"></div>'
      + '<div data-trace data-r="bloc-contour">'
      + '  <div class="o-studio-bloc-tete"><b>Contour</b><span data-r="res-contour"></span></div>'
      + curseur('contour', 'Épaisseur', 0, 50, 0)
      + '  <div class="o-studio-pastilles" role="radiogroup" aria-label="Couleur du contour" data-r="contour-couleurs" hidden>'
      + NUANCIER.map(c => '<button type="button" role="radio" data-a="contour-couleur" data-v="' + c.nom + '"' + pastille(c.rvb) + '><i style="background:' + rvbHex(c.rvb) + '"></i></button>').join('')
      + '  </div>'
      + '</div>'
      + '<p class="o-studio-aide">' + MOTS_FICHE.retoucher.gomme + '</p>'
      + '<div class="o-studio-reserve"><span class="o-studio-reserve-dit" data-r="reserve-dit"></span>'
      + '  <button type="button" class="o-studio-lien" data-a="poste" data-r="poste" hidden><span data-r="poste-mot">Polices du poste</span></button>'
      + '  <button type="button" class="o-studio-lien" data-a="ajouter-police" title="Une police à reconnaître (TTF, OTF, WOFF ou TTC), gardée sur ce poste — ou lâchez son fichier sur le plan">' + ic('plus') + '<span>Ajouter</span></button></div>'
      + '<input type="file" data-r="fichier-police" accept=".ttf,.otf,.woff,.woff2,.ttc" multiple hidden>')
    + '    </div>'
    + '  </div>'
```

et ajouter, au-dessus de `gabarit`, le gabarit d'une ligne :

```js
/* UNE LIGNE DE LA FICHE : sa tête (l'état, le titre et le sous-titre que
   `majFiche` remplit, la valeur à droite, le chevron), sa barre d'avance,
   son erreur, et son corps — les réglages d'aujourd'hui, mêmes `data-a`,
   `data-c`, `data-r` : les gestionnaires ne changent pas. */
const ficheLigne = (id, corps, attrs = '') => '<section class="o-studio-fiche-ligne" data-ligne="' + id + '" data-etat="omise"' + attrs + '>'
  + '<button type="button" class="o-studio-fiche-bouton" data-a="fiche" data-v="' + id + '" id="o-studio-ligne-' + id + '" aria-expanded="false" aria-controls="o-studio-corps-' + id + '">'
  + '<span class="o-studio-fiche-etat"><i></i>' + ic('check') + ic('x') + '</span>'
  + '<span class="o-studio-fiche-mots"><b data-r="fiche-titre-' + id + '"></b><small data-r="fiche-detail-' + id + '"></small></span>'
  + '<span class="o-studio-fiche-val" data-r="fiche-val-' + id + '"></span>' + ic('chevron-down')
  + '</button>'
  + '<span class="o-studio-fiche-barre" data-r="fiche-barre-' + id + '" hidden><i></i></span>'
  + '<p class="o-studio-fiche-erreur" data-r="fiche-erreur-' + id + '" hidden></p>'
  + '<div class="o-studio-fiche-corps" id="o-studio-corps-' + id + '" role="region" aria-labelledby="o-studio-ligne-' + id + '" hidden>' + corps + '</div>'
  + '</section>'
```

Retirer de `gabarit` le bloc `'  <div class="o-studio-modes" …'` à `'  </div>'` (les trois boutons de version sont maintenant dans le corps Version). Retirer aussi `'  <div class="o-studio-prep" …></div>'` (la préparation est dans la fiche). Dans `gabarit`, `data-r="prep-dit"` n'existe plus : c'est `fiche-dit`. Le `data-r="textes"` d'aujourd'hui (les lignes de texte du bloc Calques) disparaît : `majPolice` ne dessine plus de lignes (Task 7) ; `data-r="bloc-police"` et `res-police` disparaissent aussi.

- [ ] **Step 2 : L'état et le geste d'ouverture**

Dans `E` (vers la ligne 258, après `inspecteur: { defile: 0 }`) :

```js
  /* LA FICHE (15 octobre 2026) : la ligne ouverte ('' : aucune) — un état
     d'affichage, jamais un réglage, pas dans l'historique. */
  ficheOuverte: '',
```

Dans `agir`, à côté de `if (a === 'choisir') …` :

```js
  if (a === 'fiche') { E.ficheOuverte = E.ficheOuverte === v ? '' : v; return majFiche() }
```

Ajouter la fonction (provisoire, complétée en Task 7) après `majPanneau` :

```js
/* LA FICHE : la ligne ouverte (une seule), et ce que `majFiche` (Task 7)
   dit dans chaque tête. */
function majFiche() {
  const R = E.racine
  if (!R) return
  R.querySelectorAll('.o-studio-fiche-ligne').forEach(s => {
    const ouverte = s.dataset.ligne === E.ficheOuverte
    s.querySelector('[data-a="fiche"]').setAttribute('aria-expanded', String(ouverte))
    s.querySelector('.o-studio-fiche-corps').hidden = !ouverte
    s.classList.toggle('o-studio-ouverte', ouverte)
  })
}
```

Dans `majPanneau` : supprimer la ligne `r('modes').classList.toggle('o-studio-cache', !image)` ; le `R.querySelectorAll('[data-a="version"]')…aria-checked` reste (les boutons sont dans la fiche) ; ajouter `majFiche()` juste avant `majEtat()` en fin de `majPanneau`. Dans `charger`, après `E.ficheOuverte` : à l'ouverture d'un fichier, `E.ficheOuverte = ''` (rien ne s'ouvre d'office — à poser près de `E.nom = fichier.name …`).

Dans `majPolice` (ligne ~4562), la première ligne `const bloc = r('bloc-police')` : remplacer le corps par ce qui suit — le bloc n'existe plus, les lignes de texte se dessinent en Task 7 ; en attendant, la fonction ne fait que `majReserve(); majFormes(); majInspecteur(); majPrep()` :

```js
function majPolice() {
  if (!E.racine) return
  majReserve()
  majFormes()
  majInspecteur()
  majPrep()
}
```

(`r('res-police')`, `r('textes')` ne sont plus lus nulle part : vérifier par `grep -n "res-police\|r('textes')\|bloc-police" lib/studio-detourage.js` → rien.)

`majPrep`/`dessinerPrep` lisent `r('prep')` et `r('prep-corps')` qui n'existent plus : en attendant Task 7, faire retourner `dessinerPrep` tout de suite si `!r('prep')` — c'est déjà le cas (`if (!p || p.fini || !boite) return`). `r('prep-dit')` dans `dessinerPrep` → inatteignable, laisser.

- [ ] **Step 3 : Le style**

Dans `index.html`, retirer les règles `.o-studio-modes…` (lignes ~310-315) et `.o-studio-prep…` (lignes ~372-393) ; garder `.o-studio-prep-dit` renommée `.o-studio-fiche-dit`. Ajouter, après `.o-studio-bloc + .o-studio-bloc { … }` (ligne ~440) :

```css
  /* LA FICHE (15 octobre 2026) : ce que l'app a fait, une ligne par
     décision, une seule ouverte à la fois. Les jetons du studio seulement. */
  .o-studio-fiche { display:flex; flex-direction:column; padding:6px 8px 10px; }
  .o-studio-fiche-tete { display:flex; align-items:baseline; justify-content:space-between; gap:10px; min-height:36px; padding:4px 8px 2px; }
  .o-studio-fiche-tete b { font-size:var(--t-corps); font-weight:var(--g-forte); color:var(--encre-1); }
  .o-studio-fiche-tete span { font-size:var(--t-petit); color:var(--encre-2); font-variant-numeric:tabular-nums; white-space:nowrap; }
  .o-studio-fiche-ligne { position:relative; display:flex; flex-direction:column; border-radius:var(--arrondi); }
  .o-studio-fiche-ligne + .o-studio-fiche-ligne, .o-studio-fiche-textes .o-studio-fiche-ligne { margin-top:1px; }
  .o-studio-fiche-bouton { display:grid; grid-template-columns:18px minmax(0,1fr) auto 16px; align-items:center; column-gap:8px; width:100%; min-height:44px; padding:6px 8px; box-sizing:border-box; border:0; border-radius:var(--arrondi); background:transparent; font:inherit; color:var(--encre-1); text-align:left; cursor:pointer; }
  .o-studio-fiche-bouton:hover { background:var(--zone); }
  .o-studio-fiche-bouton:focus-visible { outline:none; box-shadow:var(--anneau); }
  .o-studio-fiche-ligne.o-studio-ouverte > .o-studio-fiche-bouton { background:var(--zone); }
  .o-studio-fiche-etat { position:relative; width:18px; height:18px; display:grid; place-items:center; }
  .o-studio-fiche-etat > i { width:8px; height:8px; border-radius:50%; background:var(--filet-fort); }
  .o-studio-fiche-etat > .o-studio-ic { position:absolute; width:16px; height:16px; stroke-width:2.25; display:none; }
  .o-studio-fiche-ligne[data-etat="omise"] .o-studio-fiche-etat > i { visibility:hidden; }
  .o-studio-fiche-ligne[data-etat="attente"] .o-studio-fiche-bouton { color:var(--encre-2); }
  .o-studio-fiche-ligne[data-etat="cours"] .o-studio-fiche-etat > i { background:var(--accent); animation:o-studio-bat 1s ease-in-out infinite; }
  .o-studio-fiche-ligne[data-etat="fait"] .o-studio-fiche-etat > i, .o-studio-fiche-ligne[data-etat="echec"] .o-studio-fiche-etat > i { display:none; }
  .o-studio-fiche-ligne[data-etat="fait"] .o-studio-fiche-etat > .o-studio-ic:first-of-type { display:block; color:var(--succes); }
  .o-studio-fiche-ligne[data-etat="echec"] .o-studio-fiche-etat > .o-studio-ic:last-of-type { display:block; color:var(--danger); }
  .o-studio-fiche-ligne[data-etat="echec"] .o-studio-fiche-mots b { color:var(--danger); }
  .o-studio-fiche-mots { display:flex; flex-direction:column; min-width:0; }
  .o-studio-fiche-mots b { font-size:var(--t-corps); font-weight:var(--g-forte); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .o-studio-fiche-mots small { display:flex; gap:4px; align-items:center; font-size:var(--t-petit); color:var(--encre-2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .o-studio-fiche-mots small:empty { display:none; }
  .o-studio-fiche-val { font-size:var(--t-petit); color:var(--encre-2); font-variant-numeric:tabular-nums; white-space:nowrap; }
  .o-studio-fiche-ligne[data-etat="cours"] .o-studio-fiche-val { color:var(--encre-1); font-weight:var(--g-forte); }
  .o-studio-fiche-bouton > .o-studio-ic:last-child { width:16px; height:16px; color:var(--encre-3); transition:transform .15s; }
  .o-studio-fiche-ligne.o-studio-ouverte > .o-studio-fiche-bouton > .o-studio-ic:last-child { transform:rotate(180deg); }
  .o-studio-fiche-barre { display:block; height:3px; margin:-2px 8px 0 34px; border-radius:var(--pilule); background:var(--filet-carte); overflow:hidden; }
  .o-studio-fiche-barre i { display:block; height:100%; background:var(--accent); }
  .o-studio-fiche-erreur { margin:0; padding:0 8px 8px 34px; font-size:var(--t-petit); line-height:var(--l-texte); color:var(--danger); }
  .o-studio-fiche-corps { display:flex; flex-direction:column; gap:12px; padding:4px 8px 14px 34px; }
  .o-studio-aide { margin:-6px 0 0; font-size:var(--t-petit); line-height:var(--l-texte); color:var(--encre-2); }
  .o-studio-fiche-dit { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; }
  @keyframes o-studio-bat { 0%, 100% { opacity:1; } 50% { opacity:.35; } }
  @media (prefers-reduced-motion: reduce) { .o-studio-fiche-ligne[data-etat="cours"] .o-studio-fiche-etat > i { animation:none; } }
```

Le chevron : `ic('chevron-down')` existe dans `lib/icones.js` (il sert au menu Plus) — vérifier par `grep -n "chevron-down" lib/icones.js`.

Dans la règle `.o-studio-pastille` du plan (ligne ~320) rien ne change. Le `.o-studio-ligne` (interrupteur) reste tel quel dans le corps Image.

- [ ] **Step 4 : Vérifier dans l'aperçu**

Ouvrir l'aperçu `logo-maker`, recharger (`navigate` sur `http://localhost:8130/?v=` + `Date.now()` pour casser le cache des modules), `read_console_messages` : aucune erreur. Déposer `~/Downloads/CD447BBB-87EF-40CD-AF45-1B8C23149BB5.jpg` (par le script de dépôt synthétique : `fetch` du fichier copié dans `_essais/tmp-apercu/`, `DataTransfer`, `DragEvent('drop')` sur `[data-r="scene"]`). Attendu : le plan n'a plus de sélecteur en haut à gauche ; le panneau montre cinq lignes (têtes vides pour l'instant), un clic sur « Fond » ouvre les quatre choix et le seuil, un clic sur « Version » ferme Fond et ouvre les trois versions ; choisir « Image » change le rendu ; `read_page` : les `aria-expanded` suivent. `computer screenshot` pour la PR.

- [ ] **Step 5 : `node --test` et commit**

Run: `node --test`
Expected: PASS.

```bash
git add lib/studio-detourage.js index.html
git commit -m "La fiche : le panneau en lignes qui s'ouvrent (gabarit, style), la version dans la fiche, plus de sélecteur sur le plan

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6 : L'accueil — trois lignes, trois exemples

**Files:**
- Create: `outils/exemples.mjs` (fabrique les trois fichiers, Playwright sans fenêtre)
- Create: `exemples/carte-de-visite.jpg`, `exemples/fond-couleur.png`, `exemples/illustration.png` (fabriqués par l'outil, commités)
- Modify: `lib/studio-detourage.js` (`gabarit` : l'accueil ; `agir` : action `exemple`)
- Modify: `index.html` (CSS `.o-studio-accueil-lignes`, `.o-studio-exemples`)
- Modify: `serveur.test.mjs` (le dossier `exemples/` servi)

**Interfaces:**
- Produces: `data-a="exemple" data-v="<nom de fichier>"` → `fetch('exemples/' + v)` → `charger(new File(...))`.

- [ ] **Step 1 : Le test du serveur**

Dans `serveur.test.mjs`, après le test de `/lib/png.js` (ligne ~58), ajouter :

```js
test('les exemples de l\'accueil sont servis, avec leur type', async () => {
  for (const [f, type] of [['carte-de-visite.jpg', 'image/jpeg'], ['fond-couleur.png', 'image/png'], ['illustration.png', 'image/png']]) {
    const r = await brut('/exemples/' + f)
    assert.equal(r.statut, 200, f)
    assert.equal(r.entetes['content-type'], type, f)
  }
})
```

(`brut` existe dans ce fichier ; lire comment il rend `statut` et `entetes`, et comment `serveur.mjs` déduit le type d'un `.jpg` — `grep -n "jpg\|jpeg" serveur.mjs` ; s'il ne connaît pas `.jpg`, l'ajouter à sa table des types.)

Run: `node --test serveur.test.mjs`
Expected: FAIL (404 sur `/exemples/…`).

- [ ] **Step 2 : L'outil qui fabrique les exemples**

`outils/exemples.mjs` :

```js
/* LES EXEMPLES DE L'ACCUEIL (15 octobre 2026) : trois fichiers de marques
   fictives, dessinés en SVG et rendus par un Chrome sans fenêtre, puis
   abîmés comme les fichiers des clients (réduits, en JPEG, un peu flous).
     node outils/exemples.mjs
   écrit exemples/carte-de-visite.jpg, fond-couleur.png, illustration.png.
   Playwright : celui de ~/.npm/_npx (pas de paquet dans ce dépôt). */
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
const { chromium } = await import(join(homedir(), '.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs'))

const POLICE = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@800&family=Lora:ital,wght@1,600&display=swap'
/* Un logo à plat de deux couleurs, son nom en Montserrat 800 : le cas du
   comptoir (une carte de visite photographiée, réduite, en JPEG). */
const CARTE = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <rect width="1200" height="800" fill="#ffffff"/>
  <circle cx="330" cy="400" r="190" fill="#0f3b5f"/>
  <path d="M330 250 L470 400 L330 550 L190 400 Z" fill="#f2a900"/>
  <text x="560" y="372" font-family="Montserrat" font-weight="800" font-size="150" fill="#0f3b5f">NORDIK</text>
  <text x="564" y="500" font-family="Montserrat" font-weight="800" font-size="78" letter-spacing="14" fill="#f2a900">PLOMBERIE</text>
</svg>`
/* Un logo sur un fond uni coloré, des lettres à creux : « Fond retiré · partout ». */
const FOND = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">
  <rect width="1000" height="1000" fill="#2d8a5e"/>
  <circle cx="500" cy="400" r="230" fill="none" stroke="#ffffff" stroke-width="34"/>
  <text x="500" y="455" text-anchor="middle" font-family="Montserrat" font-weight="800" font-size="150" fill="#ffffff">BOA</text>
  <text x="500" y="780" text-anchor="middle" font-family="Lora" font-style="italic" font-weight="600" font-size="96" fill="#ffffff">Boulangerie</text>
</svg>`
/* Une illustration à dégradés : la version Image. */
const ILLU = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">
  <defs>
    <linearGradient id="ciel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb347"/><stop offset="1" stop-color="#ff5e62"/></linearGradient>
    <radialGradient id="soleil"><stop offset="0" stop-color="#fff3b0"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1000" height="1000" fill="#ffffff"/>
  <circle cx="500" cy="460" r="330" fill="url(#ciel)"/>
  <circle cx="500" cy="380" r="170" fill="url(#soleil)"/>
  <path d="M170 560 Q330 420 500 560 T830 560 L830 790 L170 790 Z" fill="#1d3557"/>
  <path d="M170 650 Q330 540 500 650 T830 650 L830 790 L170 790 Z" fill="#457b9d"/>
  <text x="500" y="920" text-anchor="middle" font-family="Lora" font-style="italic" font-weight="600" font-size="84" fill="#1d3557">Rivage Studio</text>
</svg>`

const navigateur = await chromium.launch({ channel: 'chrome', headless: true })
const page = await navigateur.newPage()
/* Les polices de Google chargées dans la page, le SVG dessiné dans une
   toile réduite (JPEG ou PNG), un léger flou pour la carte de visite. */
const rendre = async (svg, largeur, type, qualite, flou) => {
  await page.setContent('<!doctype html><link rel="stylesheet" href="' + POLICE + '"><div id="s">' + svg + '</div>')
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(async () => { for (const f of ['800 20px Montserrat', 'italic 600 20px Lora']) await document.fonts.load(f) })
  const data = await page.evaluate(async ({ largeur, type, qualite, flou }) => {
    const svg = document.querySelector('#s svg')
    const w = Number(svg.getAttribute('width')), h = Number(svg.getAttribute('height'))
    const img = new Image()
    const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg))
    await new Promise((ok, ko) => { img.onload = ok; img.onerror = ko; img.src = src })
    const toile = document.createElement('canvas')
    toile.width = largeur; toile.height = Math.round(h * largeur / w)
    const ctx = toile.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    if (flou) ctx.filter = 'blur(' + flou + 'px)'
    ctx.drawImage(img, 0, 0, toile.width, toile.height)
    return toile.toDataURL(type, qualite)
  }, { largeur, type, qualite, flou })
  return Buffer.from(data.split(',')[1], 'base64')
}
await mkdir('exemples', { recursive: true })
await writeFile('exemples/carte-de-visite.jpg', await rendre(CARTE, 420, 'image/jpeg', 0.6, 0.7))
await writeFile('exemples/fond-couleur.png', await rendre(FOND, 600, 'image/png', 1, 0))
await writeFile('exemples/illustration.png', await rendre(ILLU, 700, 'image/png', 1, 0))
await navigateur.close()
console.log('exemples/ écrits')
```

Attention : les polices Google doivent être des familles de l'index (`vendor/polices`) pour que la reconnaissance les retrouve — Montserrat et Lora y sont (vérifier : `grep -c "Montserrat\|Lora" vendor/polices/*.json | head`). Le SVG embarqué dans une `Image` n'a pas accès aux polices de la page : si le rendu tombe en police de secours (lettres en Arial), remplacer l'approche par `page.setViewportSize` + `page.locator('#s svg').screenshot()` puis réduire la capture dans une toile. Juger à l'œil (ouvrir les trois fichiers avec `Read`).

Run: `node outils/exemples.mjs && ls -l exemples/`
Expected: trois fichiers, 20 à 80 Ko chacun ; `Read` chaque image : les lettres sont dans la bonne police, la carte de visite est légèrement floue.

- [ ] **Step 3 : L'accueil dans `gabarit`**

Remplacer la carte d'accueil :

```js
    + '  <div class="o-studio-accueil" data-r="accueil">'
    + '    <div class="o-studio-accueil-carte">'
    + '      <span class="o-studio-accueil-rond">' + ic('wand-sparkles') + '</span>'
    + '      <h3>Dépose le logo du client</h3>'
    + '      <p class="o-studio-accueil-lignes">' + MOTS_FICHE.accueil.lignes.map(html_).join('<br>') + '</p>'
    + '      <button type="button" class="o-studio-bouton o-studio-plein" data-a="choisir">' + ic('upload') + '<span>Choisir un fichier</span></button>'
    + '      <div class="o-studio-puces-formats">' + ['JPEG', 'PNG', 'HEIC', 'WebP', 'TIFF', 'PDF'].map(f => '<span>' + f + '</span>').join('') + '<em></em><span class="o-studio-touches"><kbd>Ctrl</kbd><kbd>V</kbd></span></div>'
    + '      <div class="o-studio-exemples"><span>' + MOTS_FICHE.accueil.exemples + '</span><div>'
    + [['carte-de-visite.jpg', 'Une carte de visite floue'], ['fond-couleur.png', 'Un logo sur fond coloré'], ['illustration.png', 'Une illustration']].map(([f, mot]) => '<button type="button" data-a="exemple" data-v="' + f + '" title="' + mot + '" aria-label="' + mot + '"><img src="exemples/' + f + '" width="72" height="72" alt="" loading="lazy"></button>').join('')
    + '      </div></div>'
    + '    </div>'
    + '  </div>'
```

`html_` est défini plus bas dans le fichier (ligne ~4953) comme `const` : il n'est pas hissé — déplacer sa définition au-dessus de `gabarit` (près de `ic`, ligne ~449).

Dans `agir` :

```js
  if (a === 'exemple') return ouvrirExemple(v)
```

et la fonction, près de `charger` :

```js
/* UN EXEMPLE DE L'ACCUEIL : le fichier servi avec la page, ouvert comme
   un dépôt (l'historique dit « Ouvert · décision du graphiste »). */
async function ouvrirExemple(nom) {
  try {
    const rep = await fetch('exemples/' + nom)
    if (!rep.ok) throw new Error(rep.status)
    const blob = await rep.blob()
    charger(new File([blob], nom, { type: blob.type }))
  } catch (e) { toast('L\'exemple ne se charge pas (' + e.message + ').', 'alerte') }
}
```

- [ ] **Step 4 : Le style de l'accueil**

Après `.o-studio-puces-formats em { … }` dans `index.html` :

```css
  .o-studio-accueil-lignes { margin:-6px 0 0; font-size:var(--t-corps); line-height:var(--l-texte); color:var(--encre-2); }
  .o-studio-exemples { display:flex; flex-direction:column; align-items:center; gap:8px; margin-top:6px; padding-top:16px; border-top:1px solid var(--filet-carte); width:100%; }
  .o-studio-exemples > span { font-size:var(--t-petit); color:var(--encre-2); }
  .o-studio-exemples > div { display:flex; gap:10px; }
  .o-studio-exemples button { width:72px; height:72px; padding:0; border:1px solid var(--filet-carte); border-radius:var(--arrondi); background:#fff; overflow:hidden; cursor:pointer; }
  .o-studio-exemples button:hover { border-color:var(--filet-fort); background:var(--zone); }
  .o-studio-exemples button:focus-visible { outline:none; box-shadow:var(--anneau); }
  .o-studio-exemples img { display:block; width:100%; height:100%; object-fit:contain; }
```

- [ ] **Step 5 : Vérifier**

Run: `node --test`
Expected: PASS (le test du serveur compris).

Aperçu : recharger, `read_page` : la carte montre trois lignes et trois vignettes ; un clic sur la première ouvre « carte-de-visite.jpg » (la barre le dit), la fiche se remplit après Task 7. Capture d'écran de l'accueil.

- [ ] **Step 6 : Commit**

```bash
git add outils/exemples.mjs exemples lib/studio-detourage.js index.html serveur.test.mjs serveur.mjs
git commit -m "L'accueil : trois lignes qui disent ce qui va se passer, trois exemples à cliquer (marques fictives, outils/exemples.mjs)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7 : La fiche vivante — `etatFiche`, `majFiche`, le calcul lisible, le panneau Préparation retiré

**Files:**
- Modify: `lib/studio-detourage.js` : `preparer` (~3878), `fermerPrep` (~3887), `majPrep` (~4023), `dessinerPrep` (~4030-4090), `evenement` (~3985), `echouer` (~4008), `majPolice` (~4562), `majFormes`, `majNettoyage` (~3802), `majPanneau`, `majInspecteur` (les lignes de texte de la fiche), `agir` (`prep-fermer` retiré), le survol des lignes de texte (`ligneSurvol`, `[data-a="ligne"]`)
- Modify: `index.html` (plus rien de `.o-studio-prep`)
- Test: `lib/fiche.test.mjs` (Task 4) ; le banc de Task 9

**Interfaces:**
- Consumes: `lignesFiche(etat)`, `enTeteFiche(etat)` (Task 4) ; le DOM de Task 5.
- Produces: `majFiche()` remplace `majPrep()` partout (même rôle : « à redessiner à la prochaine image ») ; `etatFiche()` ; `prep.debut`, `prep.total` ; `fermerPrep()` ne cache plus rien (il finit la préparation).

- [ ] **Step 1 : L'état plat**

Après `prevue` (ligne ~3900), ajouter :

```js
/* L'ÉTAT PLAT DE LA FICHE (lib/fiche.js, `lignesDe`) : ce que le studio
   sait, sans DOM — la version, le fond, l'IA, les couleurs, les textes, et
   chaque étape prévue avec son état, sa durée, son avancement. */
function etatFiche() {
  const p = prep, n = E.nettoyage, d = E.decision, t = texteAJour() ? E.textes : null, v = E.vecteur
  const maintenant = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const etapes = {}
  if (p && E.apercu) for (const [id] of ETAPES) {
    if (id === 'fichier' || !p.vues.has(id) || p.omises.has(id)) continue
    const etat = p.fini ? 'fait' : etatEtape(id)
    const pas = { etat }
    if (etat === 'cours') {
      p.omises.delete(id)
      if (p.t0[id] === undefined) p.t0[id] = maintenant
      const depuis = maintenant - p.t0[id]
      /* Un calcul de moins de 400 ms ne clignote pas : la ligne garde ses
         mots d'avant. */
      if (depuis < MONTRER) { pas.etat = 'fait'; p.attendre = Math.min(p.attendre, MONTRER - depuis) }
      else {
        const a = avancement(id)
        pas.part = a.part
        pas.mot = id === 'ia' && n.ultra ? 'Ultra' : a.mot
        pas.depuis = depuis
        pas.reste = a.part !== null ? resteEtape(id, a, maintenant) : 0
        if (a.part === null) p.attendre = Math.min(p.attendre, 1000 - depuis % 1000)
      }
    } else {
      delete p.t0[id]
      if (etat === 'fait' && p.ms[id] !== undefined) pas.ms = p.ms[id]
      if (etat === 'echec') pas.erreur = p.echec[id] || E.ia.erreur || 'Erreur inconnue.'
    }
    etapes[id] = pas
  }
  const une = E.teinte.type !== 'multi'
  const etatLigne = l => l.recherche ? 'recherche' : l.choix < 0 ? (l.props && l.props.length ? 'proposee' : 'dessin') : l.reconnue && !l.main ? 'reconnue' : 'choisie'
  const police = l => l.choix >= 0 ? nomPolice(l.props[l.choix]) : l.props && l.props.length ? nomPolice(l.props[0]) : ''
  return {
    image: !!E.apercu,
    version: E.version,
    fond: { methode: E.methode, interieur: !!E.reglages.interieur, teintes: E.methode === 'uni' ? E.fondsLus.slice(0, 2) : [] },
    ia: { faite: !!E.original, ultra: !!(n.enCours ? n.ultra : n.faite), decochee: !n.enCours && !E.original && !!(d && d.nettoyer), voulue: n.enCours || !!E.original },
    net: { faite: !!E.original && E.net && !n.enCours, retire: !!n.nette, flou: d ? flouMot(d.flou) : '' },
    couleurs: { une, nom: une ? E.teinte.nom : '', n: v && !v.apercu ? (v.couleurs || []).length : 0, degrade: degradeRendu() },
    lignes: t && t.etat === 'pret' ? t.lignes.map(l => ({ texte: l.texte, etat: etatLigne(l), police: police(l), retiree: ligneRetiree(l) })) : [],
    texte: t ? { etat: t.etat } : null,
    retouche: { formes: formesListees().length, contour: E.contour.mm },
    etapes,
    prep: { lecture: !!E.lecture, fini: !!(prepFichier && prepFichier.fini), total: prepFichier ? prepFichier.total || 0 : 0 },
  }
}
```

Ajouter, près de `let prep = null` : `let prepFichier = null` (la préparation du fichier ouvert, pour l'en-tête). Dans `preparer(fichier)` : après la création de `prep`, `prep.debut = performance.now(); prep.attendre = Infinity; if (fichier) prepFichier = prep`. Dans `charger`, quand la lecture échoue (`catch`), `fermerPrep()` reste.

Vérifier que `nomPolice`, `ligneRetiree`, `formesListees`, `degradeRendu`, `flouMot`, `texteAJour` sont définis avant usage à l'exécution (ce sont des `const` fléchées ou des `function` : les `const` doivent être déclarées plus haut dans le fichier que l'appel au chargement — ici l'appel est dans une fonction appelée après le montage, donc n'importe quel ordre convient).

- [ ] **Step 2 : `majFiche` remplace `dessinerPrep`**

Supprimer `dessinerPrep` et `majPrep`. Écrire :

```js
/* LA FICHE SE REDESSINE à la prochaine image (`requestAnimationFrame`),
   une fois au plus : elle suit le calcul, elle ne le fait jamais attendre. */
let imageFiche = 0
function majFiche() {
  if (prep && !prep.fini) for (const [id] of ETAPES) if (prevue(id)) prep.vues.add(id)
  if (!imageFiche && typeof requestAnimationFrame !== 'undefined') imageFiche = requestAnimationFrame(dessinerFiche)
}

function dessinerFiche() {
  imageFiche = 0
  const R = E.racine, boite = r('fiche')
  if (!R || !boite) return
  const p = prep
  if (p) { clearTimeout(p.minuteur); p.attendre = Infinity }
  const e = etatFiche()
  const lignes = lignesFiche(e)
  /* La préparation du fichier finit quand toutes ses étapes sont faites ;
     son temps total reste dans l'en-tête. */
  if (p && !p.fini) {
    const vues = Object.values(e.etapes)
    const finie = vues.length > 0 && vues.every(x => x.etat === 'fait' || x.etat === 'echec') && !E.lecture
    if (finie) { p.fini = true; p.total = performance.now() - p.debut }
  }
  if (prepFichier && prepFichier !== p && !prepFichier.fini && p && p.fini) { prepFichier.fini = true; prepFichier.total = performance.now() - prepFichier.debut }
  const tete = enTeteFiche(etatFiche())
  r('fiche-mot').textContent = tete.mot
  r('fiche-val').textContent = tete.valeur
  /* Les lignes fixes : leur tête, leur état, leur barre, leur erreur. */
  const fixes = new Map(lignes.filter(l => !l.id.startsWith('texte')).map(l => [l.id, l]))
  for (const s of boite.querySelectorAll('.o-studio-fiche-ligne[data-ligne]')) {
    const id = s.dataset.ligne
    const l = fixes.get(id)
    if (!l) continue
    const ouverte = E.ficheOuverte === id
    s.hidden = l.cachee
    s.dataset.etat = l.etat
    s.classList.toggle('o-studio-ouverte', ouverte)
    s.querySelector('[data-a="fiche"]').setAttribute('aria-expanded', String(ouverte))
    s.querySelector('.o-studio-fiche-corps').hidden = !ouverte
    poser(r('fiche-titre-' + id), l.titre)
    const detail = r('fiche-detail-' + id)
    const teintes = id === 'fond' && e.fond.teintes.length ? e.fond.teintes.map(c => '<i class="o-studio-fond-teinte" style="background:' + rvbHex(c) + '" title="' + rvbHex(c).toUpperCase() + '"></i>').join('') : ''
    const htmlDetail = html_(l.detail) + teintes
    if (detail.dataset.dessin !== htmlDetail) { detail.innerHTML = htmlDetail; detail.dataset.dessin = htmlDetail }
    poser(r('fiche-val-' + id), l.valeur)
    const barre = r('fiche-barre-' + id)
    barre.hidden = l.part === null
    if (l.part !== null) barre.firstElementChild.style.width = (l.part * 100).toFixed(1) + '%'
    const err = r('fiche-erreur-' + id)
    err.hidden = !l.erreur
    poser(err, l.erreur)
    /* Un échec se dit une fois au lecteur d'écran, comme le toast qu'il remplace. */
    if (l.erreur && p && !p.dits.has(id)) { p.dits.add(id); r('fiche-dit').textContent = l.titre + ' : ' + l.erreur }
  }
  dessinerLignesTexte(lignes.filter(l => l.id.startsWith('texte')))
  /* Les secondes qui passent, le seuil des 400 ms : la fiche se redessine
     d'elle-même tant qu'une étape tourne sans part connue. */
  if (p && !p.fini && p.attendre < Infinity) p.minuteur = setTimeout(majFiche, Math.ceil(p.attendre) + 5)
}
const poser = (el, mot) => { if (el && el.textContent !== mot) el.textContent = mot }

/* LES LIGNES DE TEXTE DE LA FICHE : une par texte lu — un clic la
   sélectionne et ouvre son inspecteur (`ouvrirLigne`), comme un clic sur
   le texte du plan ; son œil la retire ou la remet. Pendant la lecture,
   une seule ligne « Texte ». */
function dessinerLignesTexte(lignes) {
  const box = r('fiche-textes')
  const t = texteAJour() ? E.textes : null
  const html = lignes.map(l => {
    const k = l.id.includes(':') ? Number(l.id.split(':')[1]) : -1
    const tl = k >= 0 && t ? t.lignes[k] : null
    const retiree = !!(tl && ligneRetiree(tl))
    const bouton = k < 0
      ? '<div class="o-studio-fiche-bouton o-studio-fiche-texte-lecture">'
      : '<button type="button" class="o-studio-fiche-bouton" data-a="ligne" data-v="' + k + '" aria-pressed="' + String(choisi({ ligne: k })) + '"' + (retiree ? ' disabled' : '') + ' title="' + attr(l.titre + ' — ' + (retiree ? 'retirée : l\'œil la remet' : 'un clic ouvre son inspecteur : police, gras, couleur, géométrie')) + '">'
    const couleur = tl && tl.couleur && tl.choix >= 0 ? ' style="background:' + rvbHex(tl.couleur) + '"' : ''
    return '<section class="o-studio-fiche-ligne o-studio-fiche-texte" data-texte="' + k + '" data-etat="' + l.etat + '"' + (retiree ? ' data-cache' : '') + '>'
      + bouton
      + '<span class="o-studio-fiche-etat"><i' + couleur + '></i>' + ic('check') + ic('x') + '</span>'
      + '<span class="o-studio-fiche-mots"><b>' + html_(l.titre) + '</b><small>' + html_(l.detail) + (tl && entreeLigne(tl) ? '<em class="o-studio-deplace" title="Déplacée, redimensionnée ou tournée">' + ic('move') + '</em>' : '') + '</small></span>'
      + '<span class="o-studio-fiche-val">' + html_(l.valeur) + '</span>'
      + (k >= 0 ? ic('chevron-right') : '')
      + (k < 0 ? '</div>' : '</button>')
      + (k >= 0 ? '<button type="button" class="o-studio-oeil" data-a="oeil-ligne" data-v="' + k + '" aria-pressed="' + !retiree + '" aria-label="' + (retiree ? 'Remettre cette ligne' : 'Retirer cette ligne') + '" title="' + (retiree ? 'Remettre' : 'Retirer (Ctrl Z remet)') + '">' + ic(retiree ? 'eye-off' : 'eye') + '</button>' : '')
      + (l.part !== null ? '<span class="o-studio-fiche-barre"><i style="width:' + (l.part * 100).toFixed(1) + '%"></i></span>' : '')
      + '</section>'
  }).join('')
  if (box.dataset.dessin !== html) {
    const actif = box.contains(document.activeElement) ? document.activeElement : null
    const cible = actif && actif.dataset.a ? '[data-a="' + actif.dataset.a + '"][data-v="' + actif.dataset.v + '"]' : null
    box.innerHTML = html
    box.dataset.dessin = html
    if (cible) { const el = box.querySelector(cible); if (el) el.focus({ preventScroll: true }) }
  }
}
```

`ic('chevron-right')` : vérifier qu'il existe dans `lib/icones.js` ; sinon l'ajouter (le même tracé que `chevron-down` tourné : `<path d="m9 18 6-6-6-6"/>`). `attr` existe (il sert à `majPolice`) ; `choisi`, `entreeLigne` existent.

CSS à ajouter (index.html, après les règles de la fiche) pour l'œil à côté du bouton d'une ligne de texte :

```css
  .o-studio-fiche-texte { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; column-gap:2px; }
  .o-studio-fiche-texte > .o-studio-fiche-barre { grid-column:1 / 3; }
  .o-studio-fiche-texte[data-cache] .o-studio-fiche-bouton { opacity:.45; }
  .o-studio-fiche-texte .o-studio-fiche-bouton:disabled { cursor:default; }
  .o-studio-fiche-texte-lecture { cursor:default; }
  .o-studio-fiche-texte .o-studio-fiche-etat > i { background:var(--filet-fort); }
```

(`.o-studio-oeil` existe déjà, pour le bloc Calques.)

- [ ] **Step 3 : Brancher et retirer l'ancien panneau**

- Remplacer chaque `majPrep()` par `majFiche()` (`grep -n "majPrep()" lib/studio-detourage.js` : lignes ~2443, 3839, 3884, 4003, 4015, 4305, 4516, 4530, 4593 — et la définition supprimée).
- `fermerPrep()` : `if (prep) { clearTimeout(prep.minuteur); prep.fini = true }` puis `majFiche()` ; plus de `r('prep')`.
- `evenement` : retirer `if (p.fini && p.montre) p.fini = false` → `if (p.fini) p.fini = false` (un échec qui repart rouvre la préparation) ; retirer toute lecture de `p.montre`.
- `echouer` : retirer `p.montre = true`.
- `agir` : retirer `if (a === 'prep-fermer') return fermerPrep()`.
- `preparer` : retirer `montre` de l'objet.
- `majEtat` : `majFiche()` à la place de `majPrep()`.
- `majNettoyage` : `r('ia-etat')` et `r('net-etat')` existent encore (dans le corps Image) : inchangé ; la ligne `r('ultra-mot').textContent = 'Passer en Ultra · ' + environ(n.estime)` : `environ` vient de `fiche.js` (Task 4).
- `majPolice` (réduit en Task 5) : appeler `majFiche()` (déjà, via `majPrep` → `majFiche`).
- Le survol d'une ligne sur le plan (`E.ligneSurvol`, cherché par `[data-a="ligne"]` dans le panneau) : vérifier `grep -n '\[data-a="ligne"\]' lib/studio-detourage.js` — les sélecteurs qui ciblaient `r('textes')` ciblent maintenant `r('fiche-textes')`.
- `index.html` : vérifier `grep -n "o-studio-prep" index.html` → seules les règles de la fiche restent.

- [ ] **Step 4 : `node --test`, puis l'aperçu**

Run: `node --test`
Expected: PASS.

Aperçu (recharger avec `?v=`) : déposer `~/Downloads/CD447BBB-87EF-40CD-AF45-1B8C23149BB5.jpg`. Attendu, lu par `read_page` à 1 s puis à 20 s : en-tête « Préparation… » puis « Prêt · N s » ; la ligne Image « Image en cours · 42 % » avec sa barre puis « Image améliorée · agrandie ×4, Ultra » ; Fond « Fond retiré · partout, même dans les lettres » avec ses pastilles ; Version « Vectorisé · net à toute taille » et sa durée ; Couleurs « N couleurs · d'origine » ; une ligne par texte lu ; Retoucher. Plus de panneau en bas à gauche du plan. `read_console_messages` : rien. Un clic sur une ligne de texte ouvre l'inspecteur ; Échap revient à la fiche, la ligne ouverte intacte. Capture d'écran.

Puis une photo (`~/Downloads/IMG_1082.PNG` ou une photo de ~/Downloads) : Fond « Sujet détouré · trouvé par l'IA », Version « Détouré », Couleurs cachée.

- [ ] **Step 5 : Commit**

```bash
git add lib/studio-detourage.js index.html
git commit -m "La fiche vivante : les décisions en mots, le calcul lisible ligne par ligne, le panneau Préparation du plan retiré

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8 : « Avant / après », et le ménage

**Files:**
- Modify: `lib/studio-detourage.js` (`gabarit` : le bouton `split` ; le `title` de l'Ultra ; `LIBELLES`/`GESTES` si `prep-fermer` y était)
- Modify: `README.md`, `CLAUDE.md`

- [ ] **Step 1 : Le bouton**

Dans `gabarit`, le bouton `data-a="split"` : `<span>Comparer</span>` → `<span>Avant / après</span>` ; son `title` : `"Le fichier reçu sous le résultat (C) — Espace maintenu : l'avant seul"`.

- [ ] **Step 2 : Le code mort**

`grep -n "prep-fermer\|o-studio-modes\|res-police\|bloc-police\|r('textes')\|r('prep')\|prep-corps\|prep-dit\|dessinerPrep\|majPrep\b" lib/studio-detourage.js index.html` → rien. `grep -n "function dureeMot\|function environ" lib/studio-detourage.js` → rien (importés).

- [ ] **Step 3 : `CLAUDE.md` et `README.md`**

`CLAUDE.md`, dans « Ce qui est tranché », avant « Les calques » :

```
- **La fiche** (15 octobre 2026, « ultra simple d'utilisation, la
  meilleure au monde » ; vendue aux ateliers, B2B) : le panneau de droite
  n'est plus une liste de réglages mais CE QUE L'APP A FAIT — une ligne
  par décision du graphiste, en mots de vendeuse (`lib/fiche.js`, pur :
  `MOTS`, `lignesDe`, `enTeteDe` ; `etatFiche` et `majFiche` dans le
  studio), chaque ligne ouverte d'un clic sur son réglage (une seule à la
  fois, `E.ficheOuverte`, pas un geste de l'historique), les lignes de
  texte vers l'inspecteur, « Retoucher » pour ce qui est de graphiste. Le
  sélecteur de version a quitté le plan (rien ne flotte sur le logo) ; le
  panneau « Préparation » du 1er octobre est dans la fiche : chaque ligne
  dit son état, son avancement, sa durée, son échec (en rouge, à la place
  du toast) ; l'en-tête dit « Prêt · 3,4 s ». Les corps des lignes sont
  les blocs d'avant, mêmes `data-a`/`data-c`/`data-r`. « Comparer »
  s'appelle « Avant / après ». L'accueil dit en trois lignes ce qui va se
  passer et propose trois exemples (`exemples/`, marques fictives,
  `outils/exemples.mjs`). Les mots de la fiche sont dans un seul objet
  pour le chantier anglais. Plus un seul « OLDA » dans l'app : `MARQUE`
  (`lib/marque.js`, « Logo maker » jusqu'au nom choisi pour la vente),
  modèles renommés `logo-x4`, clés du poste `logomaker.*`
  (`lib/marque.test.mjs` compte zéro occurrence). PLUS RIEN DE DTF (« c'est
  un vrai logiciel et pas spécialement pour DTF ») : la couche de blanc
  Spot_1 est partie du code (PDF, EPS, historique, le pied), les
  préréglages aussi ; la taille d'impression en mm reste (`lib/taille.js`,
  « Taille du fichier » pour revenir à 300 dpi) ; le nuancier, le CMJN, le
  contour restent (de tout imprimeur). Zéro « DTF », zéro « Spot_1 » dans
  ce que l'app dit (le même test). Spec :
  docs/superpowers/specs/2026-10-15-parcours-en-un-geste-design.md.
```

Et remplacer la ligne de tête `# Logo maker · OLDA` du `CLAUDE.md` par `# Logo maker` (le reste du fichier garde son histoire).

`README.md` : dans le premier paragraphe, après « prêt pour la presse… » ajouter une phrase : « Le panneau de droite dit ce que l'app a fait — fond retiré, image améliorée, vectorisé, les couleurs, chaque texte et sa police — et chaque ligne s'ouvre sur son réglage ; l'accueil propose trois exemples. » Dans la table des fichiers, une ligne : `| \`lib/fiche.js\`, \`lib/marque.js\` | la fiche du panneau (les décisions en mots, le calcul lisible ligne par ligne) et le nom du produit |` ; `| \`outils/exemples.mjs\` | fabrique les trois exemples de l'accueil (\`exemples/\`) |`.

- [ ] **Step 4 : Commit**

```bash
git add lib/studio-detourage.js README.md CLAUDE.md
git commit -m "« Avant / après », le code mort, la fiche dans CLAUDE.md et le README

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9 : Les bancs — la fiche dans Chrome sans fenêtre, et les mêmes octets

**Files:**
- Create (scratchpad, pas dans le dépôt) : `<scratchpad>/banc-fiche.mjs`, `<scratchpad>/banc-rejeu.mjs`
- Create: `_essais/avant/` (le `lib/` et `index.html` d'avant le chantier, par `git archive`) — `_essais/` est ignoré par git

**Interfaces:**
- Consumes: `hote.olda` n'existe plus sous ce nom (Task 2 compte « olda » hors commentaires) : le crochet des bancs s'appelle `hote.studio` — **renommer** dans `monter` (`hote.studio = { E, … }`) en Task 2 si ce n'est pas fait (il contient « olda » : le test de Task 1 l'aura signalé) ; l'écrire ici pour mémoire.

- [ ] **Step 1 : Le banc de la fiche**

`<scratchpad>/banc-fiche.mjs` (lancer avec le serveur de l'aperçu sur 8130, ou `node serveur.mjs` à part) :

```js
import { join } from 'node:path'
import { homedir } from 'node:os'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
const { chromium } = await import(join(homedir(), '.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs'))
const URL = process.env.URL || 'http://localhost:8130/'
const DL = join(homedir(), 'Downloads')
const profil = await mkdtemp(join(tmpdir(), 'banc-fiche-'))
const ctx = await chromium.launchPersistentContext(profil, { channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu'], viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const erreurs = []
page.on('pageerror', e => erreurs.push(String(e)))
page.on('console', m => { if (m.type() === 'error') erreurs.push(m.text()) })
await page.goto(URL + '?v=' + Date.now())
let ok = 0, ko = 0
const verifier = (nom, cond) => { if (cond) { ok++; console.log('  ok  ' + nom) } else { ko++; console.log('  KO  ' + nom) } }
const deposer = async f => {
  const input = page.locator('[data-r="fichier"]')
  await input.setInputFiles(f)
}
const lignes = () => page.evaluate(() => [...document.querySelectorAll('.o-studio-fiche-ligne')].filter(s => !s.hidden).map(s => ({
  id: s.dataset.ligne || ('texte:' + s.dataset.texte), etat: s.dataset.etat,
  titre: s.querySelector('.o-studio-fiche-mots b').textContent, detail: s.querySelector('.o-studio-fiche-mots small').textContent,
  valeur: s.querySelector('.o-studio-fiche-val').textContent, ouverte: s.classList.contains('o-studio-ouverte'),
})))
const tete = () => page.evaluate(() => ({ mot: document.querySelector('[data-r="fiche-mot"]').textContent, val: document.querySelector('[data-r="fiche-val"]').textContent }))
const attendrePret = async (ms = 90000) => { await page.waitForFunction(() => document.querySelector('[data-r="fiche-mot"]').textContent === 'Prêt', null, { timeout: ms }) }
const E = () => page.evaluate(() => { const E = document.querySelector('[data-studio]').studio.E; return { version: E.version, methode: E.methode, interieur: E.reglages.interieur, ouverte: E.ficheOuverte, choix: E.choix.length } })

console.log('1. L\'accueil')
verifier('trois lignes', (await page.locator('.o-studio-accueil-lignes').innerText()).split('\n').length === 3)
verifier('trois exemples', await page.locator('[data-a="exemple"]').count() === 3)
verifier('pas de sélecteur sur le plan', await page.locator('.o-studio-modes').count() === 0)
verifier('pas d\'OLDA dans la page', !/olda/i.test(await page.content()))

console.log('2. LOGO DIB : la fiche pendant et après')
await deposer(join(DL, 'CD447BBB-87EF-40CD-AF45-1B8C23149BB5.jpg'))
await page.waitForTimeout(1500)
let l = await lignes()
verifier('en cours : une ligne en cours ou en attente', l.some(x => x.etat === 'cours' || x.etat === 'attente'))
verifier('en-tête Préparation…', (await tete()).mot === 'Préparation…')
await attendrePret()
l = await lignes()
console.log(l.map(x => '     ' + x.id + ' | ' + x.etat + ' | ' + x.titre + ' · ' + x.detail + ' | ' + x.valeur).join('\n'))
verifier('en-tête Prêt · N s', /^\d/.test((await tete()).val))
verifier('ordre image, fond, version, couleurs, textes, retoucher', l.map(x => x.id.split(':')[0]).join(',').replace(/(texte,)+/, 'texte,') === 'image,fond,version,couleurs,texte,retoucher')
verifier('Image améliorée', l[0].titre === 'Image améliorée' && /agrandie ×4/.test(l[0].detail))
verifier('Fond retiré · partout', l[1].titre === 'Fond retiré' && /partout/.test(l[1].detail))
verifier('Vectorisé', l[2].titre === 'Vectorisé')
verifier('N couleurs', /^\d+ couleurs?$/.test(l[3].titre))
verifier('une ligne de texte « DIB »', l.some(x => x.id.startsWith('texte:') && /DIB/.test(x.titre)))
verifier('aucune ligne en rouge', !l.some(x => x.etat === 'echec'))
verifier('pas de panneau Préparation sur le plan', await page.locator('.o-studio-prep').count() === 0)

console.log('3. Les lignes qui s\'ouvrent')
await page.click('[data-a="fiche"][data-v="version"]')
verifier('Version ouverte', (await E()).ouverte === 'version')
verifier('corps visible', await page.locator('#o-studio-corps-version').isVisible())
await page.click('#o-studio-corps-version [data-a="version"][data-v="image"]')
await page.waitForTimeout(300)
verifier('la version change depuis la fiche', (await E()).version === 'image')
verifier('la ligne reste ouverte après le geste', (await E()).ouverte === 'version')
await page.click('[data-a="fiche"][data-v="fond"]')
verifier('Fond ouvert, Version fermée', (await E()).ouverte === 'fond' && !(await page.locator('#o-studio-corps-version').isVisible()))
await page.click('#o-studio-corps-fond [data-a="fond-retire"][data-v="autour"]')
await page.waitForTimeout(300)
verifier('Autour depuis la fiche', (await E()).interieur === false)
await attendrePret(30000).catch(() => {})
l = await lignes()
verifier('Fond retiré · autour', /autour/.test(l[1].detail))
await page.keyboard.press('v')
await page.waitForTimeout(300)
verifier('V au clavier', (await E()).version === 'vecteur')

console.log('4. La ligne de texte ouvre l\'inspecteur, Échap rend la fiche')
await page.click('.o-studio-fiche-texte [data-a="ligne"]')
await page.waitForTimeout(300)
verifier('inspecteur ouvert', await page.locator('[data-r="inspecteur"]').isVisible() && (await E()).choix === 1)
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
verifier('fiche de retour, Fond encore ouvert', await page.locator('[data-r="fiche"]').isVisible() && (await E()).ouverte === 'fond')

console.log('5. Une photo en Détouré')
await deposer(join(DL, 'IMG_1082.PNG'))
await attendrePret()
l = await lignes()
console.log(l.map(x => '     ' + x.id + ' | ' + x.etat + ' | ' + x.titre + ' · ' + x.detail + ' | ' + x.valeur).join('\n'))
verifier('Détouré', l[2].titre === 'Détouré' || l[2].titre === 'Vectorisé' || l[2].titre === 'Image')
verifier('Couleurs cachée en Détouré', (await E()).version !== 'detoure' || !l.some(x => x.id === 'couleurs'))

console.log('6. Un fichier déposé pendant la préparation d\'un autre')
await deposer(join(DL, '1600w-A_O_h0NnARE.webp'))
await page.waitForTimeout(400)
await deposer(join(DL, 'CD447BBB-87EF-40CD-AF45-1B8C23149BB5.jpg'))
await page.waitForTimeout(800)
verifier('l\'en-tête repart (pas de Prêt de l\'ancien)', (await tete()).mot !== 'Prêt')
await attendrePret()
verifier('le dernier fichier est ouvert', /CD447BBB/.test(await page.locator('[data-r="nom"]').innerText()))

console.log('7. Le clavier seul')
await page.locator('[data-a="fiche"][data-v="image"]').focus()
await page.keyboard.press('Enter')
verifier('Entrée ouvre Image', (await E()).ouverte === 'image')
await page.keyboard.press('Tab')
verifier('Tab entre dans le corps', await page.evaluate(() => document.activeElement.closest('#o-studio-corps-image') !== null))

console.log('8. L\'exemple de l\'accueil')
await page.click('[data-a="choisir"]').catch(() => {})
await page.goto(URL + '?v=' + Date.now())
await page.click('[data-a="exemple"][data-v="carte-de-visite.jpg"]')
await attendrePret()
l = await lignes()
verifier('l\'exemple s\'ouvre', /carte-de-visite/.test(await page.locator('[data-r="nom"]').innerText()))
verifier('NORDIK lu', l.some(x => /NORDIK/.test(x.titre)))

console.log('9. L\'export PNG part')
const dl = page.waitForEvent('download')
await page.click('[data-a="menu"]')
await page.click('[data-a="enregistrer"][data-v="png"]')
const f = await dl
verifier('PNG téléchargé', /\.png$/.test(f.suggestedFilename()))

await page.screenshot({ path: process.env.CAPTURE || '/tmp/banc-fiche.png' })
console.log('\n' + ok + ' ok, ' + ko + ' KO ; erreurs console : ' + erreurs.length)
for (const e of erreurs) console.log('  ' + e)
await ctx.close()
process.exit(ko || erreurs.length ? 1 : 0)
```

Le crochet `document.querySelector('[data-studio]').studio` : c'est `hote.olda` renommé `hote.studio` (voir Interfaces). Les fichiers de `~/Downloads` : s'ils ont bougé, prendre un logo à plat, une photo, un webp quelconque.

Run: `node <scratchpad>/banc-fiche.mjs`
Expected: `N ok, 0 KO ; erreurs console : 0`. Les captures (`CAPTURE=<scratchpad>/fiche-dib.png`) vont dans la PR.

- [ ] **Step 2 : Le banc de rejeu, les mêmes octets**

Figer l'avant : `mkdir -p _essais/avant && git archive main lib index.html | tar -x -C _essais/avant && ln -sfn ../../vendor _essais/avant/vendor` (le `lib/` de `main`, avant ce chantier ; `vendor/` en lien — attention : `main` a encore `olda-logo-x4.onnx` dans `MODELE_LOGO` et le fichier a été renommé : copier aussi `cp vendor/logo-x4.onnx vendor/olda-logo-x4.onnx && cp vendor/logo-x4-fp16.onnx vendor/olda-logo-x4-fp16.onnx` le temps du banc, dans le dossier de travail, puis les retirer).

`<scratchpad>/banc-rejeu.mjs` :

```js
/* LE BANC DE REJEU : les messages réels du studio à ses fils, enregistrés
   à l'ouverture de chaque logo, rejoués avec l'ancien lib/ (main) et le
   nouveau, ALTERNÉS, chaque réponse en SHA-1. 0 écart attendu. */
import { join } from 'node:path'
import { homedir, tmpdir } from 'node:os'
import { mkdtemp } from 'node:fs/promises'
const { chromium } = await import(join(homedir(), '.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs'))
const URL = process.env.URL || 'http://localhost:8130/'
const DL = join(homedir(), 'Downloads')
const LOGOS = ['CD447BBB-87EF-40CD-AF45-1B8C23149BB5.jpg', '1600w-A_O_h0NnARE.webp', '843A5CCB-DA18-4823-A54A-B6A3D87D7DDA.JPG', '5b8441e1433cf6b3fa5dbcd46e7a657a.jpg', 'Hd5ff483add0947aba26dd2c1c5a8d9dd4.webp', 'IMG_1082.PNG', '23d6e88824bc2e848b98ffebf4ef9c2a.jpg', '8ec3432be2928c03af713e6c67f0efe4.jpg']
const profil = await mkdtemp(join(tmpdir(), 'banc-rejeu-'))
const ctx = await chromium.launchPersistentContext(profil, { channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu'], viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
/* Chaque message aux fils detourage-travail est gardé (structuredClone). */
await page.addInitScript(() => {
  window.__messages = []
  const W = window.Worker
  window.Worker = class extends W {
    constructor(url, opts) { super(url, opts); this.__url = String(url) }
    postMessage(m, t) {
      if (/detourage-travail/.test(this.__url) && m && m.type && m.type !== 'oublier' && m.type !== 'source') {
        try { window.__messages.push(structuredClone(m)) } catch {}
      }
      return super.postMessage(m, t)
    }
  }
})
let ecarts = 0
for (const nom of LOGOS) {
  await page.goto(URL + '?v=' + Date.now())
  await page.locator('[data-r="fichier"]').setInputFiles(join(DL, nom))
  await page.waitForFunction(() => document.querySelector('[data-r="fiche-mot"]').textContent === 'Prêt', null, { timeout: 120000 })
  const n = await page.evaluate(() => window.__messages.length)
  const res = await page.evaluate(async () => {
    const sha = async r => { const b = new TextEncoder().encode(JSON.stringify(r, (k, v) => v instanceof Uint8ClampedArray || v instanceof Uint8Array ? Array.from(v).slice(0, 200000).join(',') + '#' + v.length : v)); return [...new Uint8Array(await crypto.subtle.digest('SHA-1', b))].map(x => x.toString(16).padStart(2, '0')).join('') }
    const fil = url => new Worker(url, { type: 'module' })
    const demander = (w, m) => new Promise(ok => { const id = Math.random(); const h = e => { if (e.data && e.data.id === id) { w.removeEventListener('message', h); ok(e.data) } }; w.addEventListener('message', h); w.postMessage(Object.assign({}, m, { id, budget: 0 })) })
    const avant = fil('/_essais/avant/lib/detourage-travail.js'), apres = fil('/lib/detourage-travail.js')
    const diffs = []
    for (const m of window.__messages) {
      const a = await sha(await demander(avant, m)), b = await sha(await demander(apres, m))
      if (a !== b) diffs.push(m.type)
    }
    avant.terminate(); apres.terminate()
    return diffs
  })
  console.log(nom + ' : ' + n + ' messages, ' + res.length + ' écart(s)' + (res.length ? ' — ' + res.join(', ') : ''))
  ecarts += res.length
}
await ctx.close()
console.log(ecarts ? 'ÉCARTS : ' + ecarts : '0 écart')
process.exit(ecarts ? 1 : 0)
```

Lire d'abord comment les fils répondent (`lib/detourage-travail.js`, `onmessage`, le champ `id` d'une réponse et les messages sans réponse) et ajuster `demander` : le but est de rejouer chaque message sur les deux fils et de hacher la réponse. Si le studio tient ses fils par un autre protocole (`ia().demander`), adapter l'enregistrement à ce protocole.

Run: `node <scratchpad>/banc-rejeu.mjs`
Expected: `0 écart` sur les 8 logos. Un écart = un bug de ce chantier (la fiche n'est qu'une vue) : le trouver avant d'aller plus loin.

- [ ] **Step 3 : Les deux bancs dans la PR, ménage**

Retirer les copies `vendor/olda-logo-x4*.onnx` faites pour le banc ; `git status` propre hors `_essais/` (ignoré). Noter les sorties des deux bancs (nombre de contrôles, 0 écart) pour la description de la PR.

---

### Task 10 : La PR

- [ ] **Step 1 : Tout vert**

Run: `node --test`
Expected: PASS, tous les fichiers. Relancer `node <scratchpad>/banc-fiche.mjs` une dernière fois sur la branche finale.

- [ ] **Step 2 : Pousser et ouvrir la PR**

```bash
git push -u origin HEAD
gh pr create --title "Le parcours en un geste : la fiche du panneau, l'accueil et ses exemples, le calcul lisible dans la fiche, plus d'OLDA" --body "$(cat <<'EOF'
Chantier 1 de « la meilleure au monde » (B2B, spec docs/superpowers/specs/2026-10-15-parcours-en-un-geste-design.md).

- Le panneau de droite est une FICHE : une ligne par décision (Image améliorée, Fond retiré, Vectorisé, N couleurs, chaque texte et sa police, Retoucher), en mots de vendeuse, chaque ligne ouverte d'un clic sur son réglage (lib/fiche.js, pur, testé à sec ; les corps sont les blocs d'avant).
- Le calcul se lit dans la fiche (état, avancement, durée, échec en rouge, « Prêt · 3,4 s ») ; le panneau Préparation du plan et le sélecteur de version du plan sont partis.
- L'accueil dit en trois lignes ce qui va se passer et propose trois exemples (marques fictives, outils/exemples.mjs).
- « Comparer » devient « Avant / après ».
- Plus un seul « OLDA » dans l'app : MARQUE (« Logo maker » jusqu'au nom choisi), exports, clés du poste (les préférences reprennent leur valeur d'office une fois, les polices de Google se retéléchargent une fois), modèles renommés logo-x4, README. lib/marque.test.mjs compte zéro occurrence.
- Plus rien de DTF (un logiciel pour tout imprimeur) : la couche de blanc Spot_1 part du code, des exports PDF/EPS et de l'historique ; les préréglages partent ; la taille d'impression en mm reste (lib/taille.js). Zéro « DTF », zéro « Spot_1 » dans ce que l'app dit.

Bancs : banc-fiche (Chrome sans fenêtre) N ok / 0 KO, 0 erreur console ; banc de rejeu 8 logos, 0 écart.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3 : Auto-revue, lint, merge**

Relire le diff (`gh pr diff`), vérifier que chaque point du spec a sa ligne dans la PR ; `node --test` vert ; fusionner (`gh pr merge --squash --delete-branch`) ; Railway redéploie `main`. Vérifier en ligne (`https://logomaker-olda.up.railway.app/`) que la page charge, l'accueil montre les exemples, et `read_network_requests` : `logo-x4-fp16.onnx` en 200.

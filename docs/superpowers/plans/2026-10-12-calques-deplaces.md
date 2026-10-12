# Les calques déplacés — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Déplacer, redimensionner, tourner et retourner un calque (une forme ou une ligne de texte) sur le plan, au clavier et au millimètre dans sa bulle, avec sélection multiple, guides d'alignement, historique et exports qui suivent.

**Architecture:** Une transformation par élément dans `E.reglages.transformations` (pivot, translation, angle, échelle, en largeurs d'image) ; un module pur `lib/transformer.js` l'applique aux pixels du détourage (sélection → sprites → trous rebouchés → poses rééchantillonnées) après `effacer` et `recolorer` dans chaque fil, et aux courbes des lettres de police dans le fil du texte ; le studio ne lit que des éléments à leur place d'origine et passe par la matrice pour tout ce qui se voit ou se clique, avec un aperçu du geste dessiné par la toile à 60 fps.

**Tech Stack:** JavaScript ES modules sans build, `node --test`, Canvas 2D, Workers (lib/detourage-travail.js), Playwright headless pour la vérification.

**Spec:** `docs/superpowers/specs/2026-10-12-calques-deplaces-design.md`

## Global Constraints

- Les mêmes octets sur un logo qu'on ne touche pas (détourage, SVG, image, lignes — banc de rejeu `memes-octets.mjs` du scratchpad, 8 logos, 0 écart).
- Tout en millimètres dans la bulle (`mmParPx()`), une décimale.
- Le studio n'écrit qu'avec ses jetons (pas de couleur ni d'ombre écrites, sauf le magenta des guides — comme les points ambre).
- PC + Chrome, souris et clavier ; pas de mise en page mobile.
- Commits : `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` ; PR : `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- `index.html` précharge exactement les modules importés par la page (serveur.test.mjs).

## Review Focus

1. Une forme transformée puis retirée (œil) : `effacer` passe avant `transformer`, le sprite n'existe plus — rien ne se pose, pas d'erreur (test transformer : entrée sans encre sous le point → ignorée).
2. Une entrée d'une autre image (l'IA a refait l'image, le point tombe à côté ou l'aire a triplé) : ignorée comme `effaces` (test : aire ×4 → rien ne bouge).
3. Un élément déplacé hors de l'image (le cadre d'arrivée dépasse) : les pixels hors bord sont coupés, pas d'écriture hors tampon (test : d qui pousse la forme à moitié dehors).
4. Un élément retourné (sx < 0) et tourné : l'inverse de la matrice reste juste (test : aller-retour `appliquer(inverse(M), appliquer(M, p)) = p`).
5. Le geste pendant un calcul en vol (l'aperçu arrive après le pointerup) : l'aperçu du geste reste jusqu'à l'image qui contient la transformation (`E.apercuGeste.cle` comparée à la clé des réglages du résultat).

---

### Task 1: `lib/transformer.js` — la matrice

**Files:**
- Create: `lib/transformer.js`
- Test: `lib/transformer.test.mjs`

**Interfaces:**
- Produces: `matriceDe(entree, L)` → `[a, b, c, d, e, f]` en pixels (x' = a x + b y + e, y' = c x + d y + f) ; `inverse(M)` ; `appliquer(M, x, y)` → `[x', y']` ; `IDENTITE = { d: [0, 0], angle: 0, s: [1, 1] }` ; `estIdentite(entree)` ; `decomposer(entree)` → `{ echelle: [|sx|, |sy|], angle, retourne: sx * sy < 0 }`.

- [ ] Test : `matriceDe({ pivot: [0.5, 0.5], d: [0.1, 0], angle: 90, s: [2, 1] }, 100)` envoie (50, 50) → (60, 50) et (60, 50) → (60, 70) (échelle ×2 en x puis 90° : (10, 0) → (20, 0) → (0, 20)).
- [ ] Test : `inverse` ∘ `matriceDe` rend le point (retourné, tourné, échelle non uniforme).
- [ ] Implémenter, lancer `node --test lib/transformer.test.mjs`, commit.

### Task 2: `lib/effacer.js` — la sélection partagée

**Files:**
- Modify: `lib/effacer.js` (`effacer`, `recolorer`, nouvelle `selection`)
- Test: `lib/effacer.test.mjs` (existants, inchangés : mêmes octets)

**Interfaces:**
- Produces: `selection(data, largeur, hauteur, consigne, etat)` → `{ pixels: Int32Array, bord: Int32Array }` ou `null` — `etat = { pris: Uint8Array(n), pile }` réutilisé d'une consigne à l'autre (remis à zéro dedans). `pixels` : la forme (ou les formes d'un cadre pour moitié dedans) ; `bord` : le liseré presque transparent (0 < alpha < ENCRE) adjacent. La règle d'aire (×3) et le rayon `PRES` sont dedans.

- [ ] Extraire `parcourir`/`retirer` en `selection` ; `effacer` = pour chaque consigne (lasso à part), `selection` puis alpha 0 sur `pixels` et `bord` ; `recolorer` = `selection` puis RVB sur `pixels` et `bord`. Les tests existants passent, puis le banc de rejeu (Task 10) prouve les mêmes octets.
- [ ] Commit.

### Task 3: `lib/transformer.js` — `transformer` (pixels)

**Files:**
- Modify: `lib/transformer.js`
- Test: `lib/transformer.test.mjs`

**Interfaces:**
- Consumes: `selection` (Task 2), `combler`, `elargirMasque` (lib/combler.js).
- Produces: `transformer(data, largeur, hauteur, transformations)` → `data` (sur place) ; `creuser(data, largeur, hauteur, masque)` → `{ rebouche: bool }` (alpha 0 sur le masque ; si ≥ 50 % de l'anneau à 2 px est opaque (≥ 128), `combler` sur `elargirMasque(masque, 1)`) ; `poserSprite(data, largeur, hauteur, sprite, M)` (sprite : `{ data, largeur, hauteur, x, y }`).

- [ ] Tests (image synthétique 120 × 120) :
  - un carré rouge 20 × 20 à (10, 10), `d = [0.5, 0]` → les mêmes pixels à (70, 10), transparent à (10, 10) ;
  - `s = [2, 2]` autour du centre → un carré 40 × 40 centré au même point, bords nets à ±1 px ;
  - `angle = 90` → le rectangle 20 × 10 devient 10 × 20 ;
  - `s = [-1, 1]` → un carré bicolore (gauche rouge, droite bleue) se retourne ;
  - deux carrés qui échangent leurs places → chacun entier à la place de l'autre ;
  - un carré noir sur un badge bleu 60 × 60, déplacé → le trou est bleu (`creuser` rebouche), le carré à sa nouvelle place ;
  - sur le vide → le trou reste transparent ;
  - une ligne (`{ ligne, cadre }`) de trois lettres → les trois bougent ;
  - l'identité → les mêmes octets ; aire ×4 → rien ne bouge ; pas d'encre sous le point → rien ; une forme poussée à moitié dehors → pas d'erreur, la moitié visible est là.
- [ ] Implémenter en deux temps (sélections d'abord, puis trous, puis poses) ; rééchantillonnage bicubique (Catmull-Rom, alpha prémultiplié, borné) quand `max(|sx|, |sy|) ≥ 1` ou angle ≠ 0, bilinéaire sur-échantillonné k × k sinon.
- [ ] `node --test lib/transformer.test.mjs` vert ; commit.

### Task 4: `transformerPose` et le fil du texte

**Files:**
- Modify: `lib/transformer.js` (`transformerPose(pose, entree, L)`), `lib/detourage-travail.js:1110-1123` (`poses` : `c.m` → `transformerPose`).
- Test: `lib/transformer.test.mjs`.

- [ ] Test : une pose `{ lettres: [{ commandes: [M 10 10, L 20 10, L 20 20, Z], pixels: [] }], cadre: [10, 10, 20, 20], cerne: { epaisseur: 2 }, hauteur: 10 }`, entrée `d = [0.5, 0]`, L = 100 → commandes décalées de 50, `cadre = [10, 10, 70, 20]` (union : les pixels d'origine — ici le cadre d'origine — et les courbes), `cerne.epaisseur` = 2 × échelle moyenne.
- [ ] Implémenter ; dans `poses`, `if (c.m) p = transformerPose(p, c.m, t.source.largeur)` (vérifier `t.source.largeur` existe : l'image lue est `t.source`, `W = t.W` la largeur de lecture ; les commandes sont en pixels de l'image → L = largeur de l'image de travail).
- [ ] Commit.

### Task 5: Le fil du détourage

**Files:**
- Modify: `lib/detourage-travail.js:716-750` (`detourage` : `transformer(...)` après `recolorer`, dans les deux branches, avec `m.reglages.transformations`).

- [ ] Ajouter l'import et l'appel. `node --test` vert. Commit.

### Task 6: L'historique

**Files:**
- Modify: `lib/historique.js` (`decrire`), `lib/historique.test.mjs`.

- [ ] Tests : entrée ajoutée avec `d` seul → « Élément déplacé » ; `s` > 1 → « Élément agrandi » ; `s` < 1 → « Élément réduit » ; `angle` → « Élément tourné » ; `sx < 0` → « Élément retourné » ; retirée → « Élément replacé » ; une entrée `ligne` → « Ligne déplacée » ; deux entrées changées → « 2 éléments déplacés ». La comparaison lit la différence entre l'entrée d'avant et d'après le même élément (même `u, v` ou même `ligne`) : ce qui a changé en premier dans l'ordre d, s, angle, retourné.
- [ ] Implémenter après le bloc `teintesElements`. Commit.

### Task 7: Le studio — géométrie, sélection, gestes, aperçu

**Files:**
- Modify: `lib/studio-detourage.js` (état `choix`, `geste`, `apercuGeste` ; `reglagesCalcul`, `cleFin`, `messageCalcul`, `consignesCalques` ('x'), `choixPolices` (`m`), `clePoses` ; `coinsElement`, `elementSous`, `cadreLigneEcran`, `ligneSous`, `formeSous` ; pointerdown/move/up ; `dessinerSelection` (cadre, poignées, guides, étiquette) ; `dessinerApres` avec l'aperçu du geste ; clavier ; `retirerChoix`).
- Modify: `lib/icones.js` (`move`, `flip-horizontal`, `flip-vertical`, `rotate-cw`, `lock`, `unlock`).
- Modify: `index.html` (préchargement `lib/transformer.js`, `lib/combler.js` ; styles).

**Interfaces (studio, internes):**
- `E.choix = { formes: number[], lignes: number[] }` ; `E.geste = { mode, depart: {x, y}, elements: [{ ref, entree0 }], pivot, ... }` ; `E.apercuGeste = { fond: canvas, sprites: [{ toile, x, y, l, h, ref }], cle }`.
- `entreeDe(ref)` → l'entrée courante (ou `IDENTITE` + pivot) ; `ref = { forme: id } | { ligne: k }`.
- `ecrireEntrees(liste)` → `E.reglages = { ..., transformations }` (identités retirées) + `recalculer()`, `planifierFin()`, `poserPolices()` si ligne, `majPanneau()`.

- [ ] Géométrie et sélection (clic, Maj + clic, bloc) ; `dessinerSelection`.
- [ ] Le glissé `deplacer` avec aperçu, guides, étiquette ; `finirGesteCalque` via `geste()`.
- [ ] Poignées : `coin` (proportion / Maj libre / Alt centre), `cote`, `tourner` (Maj 15°), curseurs.
- [ ] Clavier : flèches, Suppr, Échap.
- [ ] L'aperçu du geste persiste jusqu'au résultat ; `recalculer().then` le lève quand `E.apercuGeste.cle === cleFin()`.
- [ ] Commit (un par sous-étape si possible).

### Task 8: La bulle GÉOMÉTRIE

**Files:**
- Modify: `lib/studio-detourage.js` (`majPopElement`, `majPopPolice`, `change`/`input` des champs `data-c="geo-x|geo-y|geo-l|geo-h|geo-angle"`, actions `geo-cadenas`, `geo-retourner-h`, `geo-retourner-v`, `geo-replacer` dans GESTES), `index.html` (`.o-studio-geo`).

- [ ] Grille X, Y, L, H, cadenas, angle, Retourner ↔ ↕, Replacer ; validation = geste. Commit.

### Task 9: Documentation

**Files:**
- Modify: `CLAUDE.md` (« Les calques déplacés » ; retirer « Pas de calque déplacé ni redimensionné »), `README.md`, la mémoire.

- [ ] Commit.

### Task 10: Vérification

- [ ] `node --test` tout vert.
- [ ] Banc de rejeu des mêmes octets (scratchpad `memes-octets.mjs`, HEAD de main contre l'arbre) : 0 écart.
- [ ] Playwright headless : LOGO DIB (forme glissée, coin, rotation, retourné, replacé, « DIB » avec police déplacé), t-shirt (ligne avec police déplacée), Ctrl Z, Suppr, flèches, champs ; exports PDF/SVG/PNG contiennent l'élément déplacé.
- [ ] Vitesse du geste (pointermove < 8 ms).
- [ ] PR, revue, merge, Railway.

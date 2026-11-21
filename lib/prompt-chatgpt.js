/* LE PROMPT CHATGPT SUR MESURE (20 novembre 2026) : le même que le bouton
   « ChatGPT » du BAT (bat-studio, src/js/logomaker.js, `promptLogo`), écrit
   d'après la fiche du logo (`analysePilote`, lib/studio-detourage.js) — le
   texte lu mot pour mot, la police de chaque ligne, les couleurs dites en
   mots. Une copie : une retouche faite là-bas se reporte ici. */

export function promptLogo({ largeurCm = 0, analyse = null, nomCouleur = (c) => c } = {}) {
  const a = analyse && typeof analyse === 'object' ? analyse : null;
  const traces = a?.genre === 'logo' && a.couleurs?.length ? a.couleurs : [];
  const couleurs = [...new Set(traces.map((c) => nomCouleur(c)).filter(Boolean))];
  const aplats = !!a?.genre && a.genre === 'logo' && !a.degrade && couleurs.length > 0 && couleurs.length <= 8;
  const fiche = a ? ficheDuLogo(a, { aplats }) : [];
  const cm = largeurCm > 0 ? Math.round(largeurCm) : 0;
  const taille = cm
    ? `It will be printed by DTF transfer on a t-shirt, about ${cm} cm wide: every line, gap and detail must stay at least 0.5 mm at that size.`
    : 'It will be printed by DTF transfer on a t-shirt: every line, gap and detail must be bold enough to survive printing (no hairlines).';
  const page = cm ? `PDF page = the artwork bounding box exactly, scaled so the artwork is ${cm} cm wide` : 'PDF page = the artwork bounding box exactly, at 300 dpi scale (1 px = 0.24 pt)';
  const fidelite = [
    'You are a senior prepress artist. Attached is a client\'s logo, low quality. Rebuild it as a flawless, print-ready master for DTF printing on a t-shirt. ' + taille + ' Zero tolerance for error: the client will wear this.',
    '',
    'ABSOLUTE FIDELITY — this is the client\'s existing logo, not a redesign:',
    '- Identical design: same text, same spelling, same letterforms and font style, same proportions, spacing, alignment and composition.',
    '- Do not add, remove, restyle, modernize, simplify or "improve" anything. No new elements, no slogan, no mockup, no t-shirt, no frame, no watermark.',
    '- Blurry or damaged parts: rebuild them from the visible shapes and the logic of the design. Never invent letters or words.',
    ...fiche,
  ];
  const verif = (quoi) => `- Verify before delivering: ${quoi} If any check fails, fix and re-run; never deliver a file that failed.`;
  if (aplats) {
    const nb = couleurs.length ? `exactly ${couleurs.length} color${couleurs.length > 1 ? 's' : ''} (${couleurs.join(', ')})` : 'exactly the colors of the original';
    return [...fidelite, '',
      'STEP 1 — IMAGE (image generation): recreate the logo at the highest resolution possible (at least 4000 px on the longest side), on a TRANSPARENT background:',
      `- Perfectly flat solid colors, ${nb}. No gradient, shading, texture, noise, glow, shadow or JPEG artifact.`,
      '- Smooth continuous curves, straight lines where straight, true circles and symmetry where intended, consistent stroke weights, sharp corners stay sharp. Letter counters (a, e, o, R, B, 8…) fully open.',
      '',
      'STEP 2 — VECTOR PDF (use Python / code interpreter on the Step 1 image; if Step 1 is unavailable, on the attached file):',
      '- Background removal, 100% complete: every background pixel becomes fully transparent — the outer background AND the background showing through enclosed areas (inside letters, between shapes). Nothing white or off-white is left that is not part of the design itself.',
      `- Color quantization in Lab space to ${nb}: every pixel snapped to its nearest flat color, anti-aliasing fringes and halos absorbed, specks smaller than 0.3 mm at print size removed, no stray pixels.`,
      '- Tracing, one layer per color: upscale the mask x2-x4, cv2.findContours with RETR_CCOMP (keep the holes), fit smooth cubic Bézier curves (corner detection, max deviation 0.5 px; no jagged polygons, no staircase). Write the PDF with reportlab: paths filled with even-odd rule, holes as sub-paths, no embedded raster image at all, no stroke, no clipping mask.',
      '- Stack the color layers bottom to top, each lower layer extended 0.2 mm under the layers above it, so no hairline gap between two colors can show the t-shirt.',
      `- ${page}, artwork centered, nothing outside it, no background rectangle.`,
      verif('render the PDF back with PyMuPDF at the image resolution and compare it to the cleaned image: color-layer IoU >= 99.5% each, every background pixel (outer and enclosed) fully transparent, the PDF contains only vector paths and the exact color count. Print these numbers.'),
      '',
      'DELIVER as downloadable files: logo_vector.pdf (vector, transparent), logo_transparent.png (same artwork, alpha, 300 dpi), and a preview of the PDF on a black and on a white background so I can check there is no halo.',
    ].join('\n');
  }
  return [...fidelite, '',
    'STEP 1 — IMAGE (image generation): recreate the artwork at the highest resolution possible (at least 4000 px on the longest side), on a TRANSPARENT background:',
    '- Keep its gradients, shading, textures and photographic detail, rendered clean: no banding, no noise, no blur, no JPEG artifact. Text and outlines razor-sharp, every small detail legible, colors vivid and accurate, no color shift.',
    '',
    'STEP 2 — CUT-OUT (use Python / code interpreter on the Step 1 image; if Step 1 is unavailable, on the attached file):',
    '- Remove ONLY the background around the subject (its outer contour). Keep everything inside the subject intact, including its whites, highlights and light areas.',
    '- Edge quality: a crisp edge with at most a 1 px soft transition; decontaminate edge colors (no white or background-colored fringe); then every pixel under 50% opacity becomes fully transparent and every semi-transparent pixel left is flattened to fully opaque, because DTF prints a white underbase under every non-transparent pixel and any translucent haze prints as a dirty halo.',
    '- No stray specks or islands outside the subject.',
    `- ${page.replace('PDF page', 'Canvas')}, subject centered with a small even margin.`,
    verif('check that the four corners and the whole outer area are 100% transparent, that no pixel has partial opacity except the 1 px edge, and that no light fringe remains on a black background. Print these numbers.'),
    '',
    'DELIVER as downloadable files: artwork_transparent.png (alpha, 300 dpi), artwork_300dpi.pdf (the same image placed at print size, transparent), and a preview on a black and on a white background so I can check there is no halo.',
  ].join('\n');
}

// CE QUE LA FICHE DIT DE CE LOGO-LÀ, en consignes. Une ligne de texte n'y
// est que si Logo maker l'a lue sûrement (ameliorer → `analysePilote`) ;
// sa police n'est dite « exacte » que reconnue, sinon « la plus proche ».
// L'alignement des lignes entre elles : leurs bords gauches, leurs milieux
// ou leurs bords droits à 3 % près de la largeur du logo.
function alignement(lignes) {
  if (lignes.length < 2) return '';
  const pareil = (f) => { const v = lignes.map(f); return Math.max(...v) - Math.min(...v) < 0.03; };
  return pareil((x) => (x.boite[0] + x.boite[2]) / 2) ? 'centered on each other'
    : pareil((x) => x.boite[0]) ? 'left-aligned'
    : pareil((x) => x.boite[2]) ? 'right-aligned' : '';
}
function ficheDuLogo(a, { aplats }) {
  const out = ['', 'WHAT THIS LOGO IS (measured on the file — trust it over your own reading of the image):'];
  const [w, h] = a.format || [];
  const lignes = (a.lignes || []).filter((x) => x && x.texte);
  if (lignes.length) {
    const ordre = [...lignes].sort((u, v) => u.boite[1] - v.boite[1] || u.boite[0] - v.boite[0]);
    const hMax = Math.max(...ordre.map((x) => x.boite[3] - x.boite[1]));
    out.push(`- Text, exactly as written — same spelling, case, accents and punctuation, letter for letter (${ordre.length} line${ordre.length > 1 ? 's' : ''}, top to bottom):`);
    ordre.forEach((x, i) => {
      const haut = x.boite[3] - x.boite[1];
      const taille = ordre.length > 1 ? (haut >= hMax * 0.85 ? ', largest text' : haut < hMax * 0.5 ? ', small text' : '') : '';
      const police = x.ecriture
        ? 'a handwritten script — keep every letter connection and swash exactly as drawn'
        : x.police ? `font ${x.sure ? '' : 'closest to '}${x.police}${x.equivalent ? ` (${x.equivalent.replace('≈', 'similar to')})` : ''}${x.sure ? ', identified on the file' : ' — match the letterforms of the original, not the font name'}` : 'its original letterforms';
      const extra = [x.courbe ? 'set on a curve: keep the same arc and letter spacing' : '', x.ombre ? 'has a drop shadow: keep it, same offset and color' : ''].filter(Boolean).join('; ');
      out.push(`  ${i + 1}. "${x.texte}" — ${police}${taille}${extra ? `; ${extra}` : ''}.`);
    });
    const aligne = alignement(ordre);
    if (aligne) out.push(`- The text lines are ${aligne}: keep that alignment.`);
    out.push('- If any other text is visible, copy it exactly as it appears; never add a word.');
    const boite = ordre.reduce((m, x) => [Math.min(m[0], x.boite[0]), Math.min(m[1], x.boite[1]), Math.max(m[2], x.boite[2]), Math.max(m[3], x.boite[3])], [1, 1, 0, 0]);
    const aireTexte = (boite[2] - boite[0]) * (boite[3] - boite[1]);
    if (aireTexte < 0.7) {
      const cote = boite[0] > 0.3 ? 'left of' : boite[2] < 0.7 ? 'right of' : boite[1] > 0.3 ? 'above' : boite[3] < 0.7 ? 'below' : 'around';
      out.push(`- The graphic part (emblem, icon, shapes) sits ${cote} the text: keep its exact position, size ratio and spacing relative to the text.`);
    }
  } else {
    out.push('- No readable text was found: treat it as a pure graphic; if a letter or word is visible, copy it exactly, never guess.');
  }
  if (w && h) {
    const r = w / h;
    out.push(`- Overall proportions: ${r > 1.15 ? `landscape, about ${r.toFixed(1)}:1` : r < 0.87 ? `portrait, about 1:${(1 / r).toFixed(1)}` : 'roughly square'} — keep them.`);
    if (Math.max(w, h) < 800) out.push(`- The attached file is only ${w} x ${h} px: fine details are lost in it. Rebuild them clean from the logic of the design, do not reproduce the blur or the JPEG blocks.`);
  }
  if (a.flou) out.push('- The original is blurry: rebuild crisp edges, do not copy the blur.');
  if (a.genre === 'photo') out.push('- This is a photograph: keep it photographic, do not turn it into a flat illustration.');
  else if (a.genre === 'image') out.push(a.matiere
    ? '- It has a real material texture (embroidery, leather, glitter, paint…): keep that texture and its grain, do not flatten it.'
    : '- It is an illustration with shading: keep its shading and painted details, do not flatten it into a few solid colors.');
  else if (aplats) out.push('- It is a flat logo: solid colors only, no gradient or texture added.');
  return out;
}

// LIEN CHATGPT, PROMPT PRÉ-REMPLI : `?prompt=` remplit le champ sans envoyer
// (le logo doit d'abord y être collé). Testé par le BAT (tests/run-tests.mjs).
export const CHATGPT = 'https://chatgpt.com/';
export function lienChatGpt(prompt) {
  const u = new URL(CHATGPT);
  u.searchParams.set('prompt', prompt);
  return u.href;
}

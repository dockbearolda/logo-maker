// L'EFFET BRODERIE : un logo rendu comme brodé, pour montrer au client ce
// qu'il recevra. Fonction PURE sur des pixels RGBA (testée sous Node) : les
// couleurs du logo restent les siennes (d'origine, du nuancier, or…), seul
// le relief change.
//
// Ce que fait une vraie broderie, et ce qu'on en reprend :
// - Le POINT LANCÉ (satin) : dans un trait, le fil traverse la colonne d'un
//   bord à l'autre. Le sens des fils suit donc la forme — à travers une
//   lettre, en rayons sur un anneau. On le tire de la distance au bord
//   (son gradient pointe à travers la colonne), lissé en angle double pour
//   que les deux bords d'un trait s'accordent.
// - Le REMPLISSAGE (tatami) : une surface large ne se brode pas d'un bord à
//   l'autre ; ses fils partent en biais (45°), bordés d'un satin.
// - Les FILS : des stries le long de ce sens (bruit intégré le long des
//   lignes de champ, LIC), chacune bombée comme un fil.
// - Le RELIEF : la broderie gonfle (coussin), creuse ses bords et ses
//   changements de couleur, et porte une ombre sur le tissu.
// - La BRILLANCE : un fil de rayonne brille selon son sens (reflet
//   anisotrope, Kajiya-Kay) — c'est ce qui fait « haut de gamme ».

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// Bruit déterministe : le même logo brodé deux fois donne les mêmes pixels
// (cache, PDF identique d'un export à l'autre).
function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Flou boîte séparable, en place (deux passes ≈ flou en tente).
function flou(src, w, h, r) {
  if (r < 1) return src;
  const tmp = new Float32Array(src.length);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) {
      const o = y * w;
      let s = 0;
      for (let x = -r; x <= r; x++) s += src[o + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[o + x] = s / (2 * r + 1);
        s += src[o + Math.min(w - 1, x + r + 1)] - src[o + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        src[y * w + x] = s / (2 * r + 1);
        s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
  }
  return src;
}

// `fil` : la largeur d'un fil en pixels (≈ 0,4 mm). Par défaut, déduite de
// la taille de l'image : un logo de 1600 px fait ~10 cm.
export function broderRaster(d, w, h, { fil } = {}) {
  const N = w * h;
  const p = fil || Math.max(2.5, Math.max(w, h) / 300);
  // La bordure : un satin fin le long du bord, séparé du coussin par un creux
  // (cf. BEA-16, la référence de l'atelier).
  const Bw = 2.2 * p;
  const A = new Float32Array(N);
  for (let i = 0; i < N; i++) A[i] = d[i * 4 + 3] / 255;
  const dedans = (i) => A[i] >= 0.5;
  const ecart = (i, j) => Math.abs(d[i * 4] - d[j * 4]) + Math.abs(d[i * 4 + 1] - d[j * 4 + 1]) + Math.abs(d[i * 4 + 2] - d[j * 4 + 2]);

  // 1. Distance au bord le plus proche — bord du logo OU changement de
  //    couleur : chaque élément se brode et gonfle pour lui-même.
  const INF = 1e9;
  const D = new Float32Array(N);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!dedans(i)) { D[i] = 0; continue; }
    let bord = x === 0 || y === 0 || x === w - 1 || y === h - 1;
    if (!bord) for (const j of [i - 1, i + 1, i - w, i + w]) if (!dedans(j) || ecart(i, j) > 90) { bord = true; break; }
    D[i] = bord ? 0.5 : INF;
  }
  // Chanfrein 3-4 (÷3) : deux passes, assez juste pour un relief.
  const a = 1, b = Math.SQRT2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; let v = D[i]; if (v === 0) continue;
    if (x > 0) v = Math.min(v, D[i - 1] + a);
    if (y > 0) {
      v = Math.min(v, D[i - w] + a);
      if (x > 0) v = Math.min(v, D[i - w - 1] + b);
      if (x < w - 1) v = Math.min(v, D[i - w + 1] + b);
    }
    D[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x; let v = D[i]; if (v === 0) continue;
    if (x < w - 1) v = Math.min(v, D[i + 1] + a);
    if (y < h - 1) {
      v = Math.min(v, D[i + w] + a);
      if (x < w - 1) v = Math.min(v, D[i + w + 1] + b);
      if (x > 0) v = Math.min(v, D[i + w - 1] + b);
    }
    D[i] = v;
  }

  // 2. Les éléments : chaque zone d'une même couleur, d'un seul tenant. Sa
  //    demi-largeur (la plus grande distance au bord) décide de son point :
  //    étroite (lettre, anneau) → satin ; large (fond d'écusson) → tatami.
  const LAB = new Int32Array(N).fill(-1);
  const larg = [];
  const pile = new Int32Array(N);
  for (let i0 = 0; i0 < N; i0++) {
    if (LAB[i0] >= 0 || !dedans(i0)) continue;
    const id = larg.length;
    let n = 0, top = 0, m = 0;
    pile[top++] = i0; LAB[i0] = id;
    while (top) {
      const i = pile[--top]; n++;
      if (D[i] > m) m = D[i];
      const x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (j < 0 || j >= N || LAB[j] >= 0 || !dedans(j) || ecart(i, j) > 90) continue;
        LAB[j] = id; pile[top++] = j;
      }
    }
    larg.push(m);
  }
  // Satin partout comme BEA-16 ; seul un grand aplat (fond d’écusson, > ~2 cm
  // de large) passe en tatami.
  const SATIN_MAX = 25 * p;
  const tatami = (i) => LAB[i] >= 0 && larg[LAB[i]] > SATIN_MAX;

  // 3. Le sens des fils. Satin : à travers la colonne, le long du gradient
  //    de distance, en angle double (cos 2θ, sin 2θ) — un gradient et son
  //    opposé (les deux bords d'un trait) donnent le même fil. Tatami : 45°.
  const C2 = new Float32Array(N), S2 = new Float32Array(N);
  const T45 = Math.PI / 4;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (!dedans(i)) continue;
    if (tatami(i) && D[i] > Bw + p) { C2[i] = Math.cos(2 * T45); S2[i] = Math.sin(2 * T45); continue; }
    const gx = D[i + 1] - D[i - 1], gy = D[i + w] - D[i - w];
    const m = gx * gx + gy * gy;
    if (m > 1e-6) { C2[i] = (gx * gx - gy * gy) / m; S2[i] = (2 * gx * gy) / m; }
  }
  const r = Math.max(1, Math.round(p * 1.2));
  flou(C2, w, h, r); flou(S2, w, h, r);
  const TX = new Float32Array(N), TY = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const th = tatami(i) && D[i] > Bw + p ? T45 : 0.5 * Math.atan2(S2[i], C2[i]);
    TX[i] = Math.cos(th); TY[i] = Math.sin(th);
  }

  // 4. Les fils, nets et réguliers : un bruit de phase (phasor noise) — des
  //    noyaux de Gabor semés sur l'élément, chacun rayé dans le sens des
  //    fils à l'endroit où il tombe. La phase de leur somme donne des rayures
  //    d'un fil de large, qui suivent la forme sans moiré.
  // Le fil du coussin, plus fin que celui de la bordure (cf. BEA-16).
  const g = 1.6 * p, Rk = 2.2 * p, kw = Math.PI / (Rk * Rk * 0.55), f = (2 * Math.PI) / (0.75 * p), fB = (2 * Math.PI) / p;
  const gw = Math.ceil(w / g) + 1, gh = Math.ceil(h / g) + 1;
  const KX = new Float32Array(gw * gh), KY = new Float32Array(gw * gh), KP = new Float32Array(gw * gh);
  const KL = new Int32Array(gw * gh).fill(-1);
  for (let cy = 0; cy < gh; cy++) for (let cx = 0; cx < gw; cx++) {
    const k = cy * gw + cx;
    const x = Math.min(w - 1, Math.floor((cx + hash(cx, cy)) * g)), y = Math.min(h - 1, Math.floor((cy + hash(cy + 91, cx + 7)) * g));
    const i = y * w + x;
    if (!dedans(i)) continue;
    KX[k] = x; KY[k] = y; KL[k] = LAB[i];
    KP[k] = hash(cx * 3 + 1, cy * 5 + 2) * 2 * Math.PI;
  }
  const portee = Math.ceil(Rk / g) + 1;
  const F = new Float32Array(N), B = new Float32Array(N);   // profil du fil, coupure de point
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (A[i] < 0.02) continue;
    const tx = TX[i], ty = TY[i], nx = -ty, ny = tx;
    const lab = LAB[i];
    // Tatami : angle fixe, donc des rangs exacts — un fil par rang, chaque
    // point coupé tous les ~2 mm, décalé d'un rang à l'autre (en briques).
    if (lab >= 0 && larg[lab] > SATIN_MAX && D[i] > Bw + p) {
      const pas = 0.75 * p, lp = 4.5 * p;
      const across = (-x * Math.sin(T45) + y * Math.cos(T45)) / pas;
      const rang = Math.floor(across), u = across - rang;
      const along = (x * Math.cos(T45) + y * Math.sin(T45)) / lp + ((rang * 0.37) % 1);
      const v = along - Math.floor(along);
      F[i] = Math.sqrt(Math.max(0, 1 - (2 * u - 1) * (2 * u - 1)));
      B[i] = 1 - smooth(0, 0.06, Math.min(v, 1 - v));
      continue;
    }
    let re = 0, im = 0;
    const cx0 = Math.floor(x / g), cy0 = Math.floor(y / g);
    for (let cy = cy0 - portee; cy <= cy0 + portee; cy++) {
      if (cy < 0 || cy >= gh) continue;
      for (let cx = cx0 - portee; cx <= cx0 + portee; cx++) {
        if (cx < 0 || cx >= gw) continue;
        const k = cy * gw + cx;
        if (KL[k] < 0 || (lab >= 0 && KL[k] !== lab)) continue;
        const dx = x - KX[k], dy = y - KY[k], d2 = dx * dx + dy * dy;
        if (d2 > Rk * Rk * 2.2) continue;
        const wt = Math.exp(-kw * d2);
        // Le fil du noyau, orienté comme celui du pixel (le champ n'a pas de signe).
        const j = KY[k] * w + KX[k];
        let kx = -TY[j], ky = TX[j], ph = KP[k];
        if (kx * nx + ky * ny < 0) { kx = -kx; ky = -ky; ph = -ph; }
        const a1 = (D[i] < Bw ? fB : f) * (kx * dx + ky * dy) + ph;
        re += wt * Math.cos(a1); im += wt * Math.sin(a1);
      }
    }
    // Phase → position dans le fil (0…1) → bombé du fil, creux entre deux.
    const u = Math.atan2(im, re) / (2 * Math.PI) + 0.5;
    F[i] = Math.sqrt(Math.max(0, 1 - (2 * u - 1) * (2 * u - 1)));
  }

  // 5. Le grain du fil (torsion, fibres) : un bruit fin intégré le long du
  //    fil (LIC), discret — il casse la régularité sans faire « fourrure ».
  const cs = Math.max(1, p * 0.28);
  const bruit = (x, y) => {
    const gx = x / cs, gy = y / cs, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const h00 = hash(x0, y0), h10 = hash(x0 + 1, y0), h01 = hash(x0, y0 + 1), h11 = hash(x0 + 1, y0 + 1);
    return h00 + (h10 - h00) * u + (h01 - h00) * v + (h00 - h10 - h01 + h11) * u * v;
  };
  const L = Math.max(3, Math.round(p * 1.5));
  const V = new Float32Array(N);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (A[i] < 0.02) continue;
    let s = bruit(x, y), n = 1;
    for (const sens of [1, -1]) {
      let px = x + 0.5, py = y + 0.5;
      const dx = TX[i] * sens, dy = TY[i] * sens;
      for (let k = 0; k < L; k++) {
        px += dx; py += dy;
        if (px < 0 || py < 0 || px >= w || py >= h) break;
        s += bruit(px, py); n++;
      }
    }
    // Le fil (F) domine ; le grain le module de ±15 %.
    V[i] = clamp01(F[i] * (0.7 + 0.5 * clamp01((s / n - 0.5) * 3 + 0.5)) * (B[i] ? 1 - 0.75 * B[i] : 1));
  }

  // 6. Relief, comme une broderie bourrée : la bordure (un bourrelet fin),
  //    un creux, puis le coussin qui monte sur toute la demi-largeur de
  //    l'élément — haut et rond. Plus le bombé de chaque fil.
  const H = new Float32Array(N);
  const CREUX = 0.7 * p;
  for (let i = 0; i < N; i++) {
    if (A[i] < 0.02) continue;
    const Dm = D[i], W = LAB[i] >= 0 ? Math.min(larg[LAB[i]], 9 * p) : Bw * 2;
    let base;
    if (W < Bw * 1.6) {
      // Trop fin pour une bordure (petit texte) : un seul satin bombé.
      const t = Math.min(Dm / Math.max(1, W), 1);
      base = Math.sqrt(1 - (1 - t) * (1 - t)) * W * 0.35;
    } else if (Dm < Bw) base = Math.sin((Math.PI * Dm) / Bw) * p * 0.9;
    else if (Dm < Bw + CREUX) base = 0;
    else {
      const t = Math.min((Dm - Bw - CREUX) / Math.max(1, W - Bw - CREUX), 1);
      base = Math.sqrt(1 - (1 - t) * (1 - t)) * W * 0.4;
    }
    H[i] = base + V[i] * p * 0.5;
  }
  flou(H, w, h, 1);

  // 7. Lumière en haut à gauche ; reflet anisotrope des fils.
  const Lx = -0.45, Ly = -0.55, Lz = 0.7, ln = Math.hypot(Lx, Ly, Lz);
  const lx = Lx / ln, ly = Ly / ln, lz = Lz / ln;
  const hn = Math.hypot(lx, ly, lz + 1), Hx = lx / hn, Hy = ly / hn, Hz = (lz + 1) / hn;
  const out = new Uint8ClampedArray(d.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, o = i * 4;
    if (A[i] < 0.02) continue;
    const hx = (H[Math.min(i + 1, N - 1)] - H[Math.max(i - 1, 0)]) / 2;
    const hy = (H[Math.min(i + w, N - 1)] - H[Math.max(i - w, 0)]) / 2;
    const nl = Math.hypot(hx, hy, 1), nx = -hx / nl, ny = -hy / nl, nz = 1 / nl;
    const diff = Math.max(0, nx * lx + ny * ly + nz * lz);
    // Le fil épouse le coussin : sa tangente monte avec la pente.
    const tz = hx * TX[i] + hy * TY[i], tl = Math.hypot(TX[i], TY[i], tz);
    const th = (TX[i] * Hx + TY[i] * Hy + tz * Hz) / tl;
    const spec = Math.pow(Math.sqrt(Math.max(0, 1 - th * th)), 24) * V[i] * V[i];
    // Creux au bord et entre les fils.
    const W = LAB[i] >= 0 ? larg[LAB[i]] : 0, Dm = D[i];
    const bordee = W >= Bw * 1.6;
    // Creux : au bord du logo, et entre la bordure et le coussin.
    const creux = bordee ? 1 - 0.55 * Math.exp(-(((Dm - Bw - CREUX / 2) / (CREUX * 0.7)) ** 2)) : 1;
    const ao = (0.45 + 0.55 * smooth(0, 1.2 * p, Dm)) * creux * (0.6 + 0.4 * V[i]);
    // La bordure se brode d'un fil un ton plus soutenu.
    const ton = bordee && Dm < Bw ? 0.86 : 1;
    const ombre = ao * ton * (0.6 + 0.62 * diff);
    const grain = 0.97 + 0.06 * hash(x * 7 + 3, y * 13 + 1);
    for (let c = 0; c < 3; c++) {
      const base = d[o + c];
      const reflet = base + (255 - base) * 0.55;
      out[o + c] = (base * ombre * grain + reflet * spec * 0.22);
    }
    out[o + 3] = d[o + 3];
  }

  // 8. L'ombre portée sur le tissu, sous la broderie.
  const S = flou(Float32Array.from(A), w, h, Math.max(1, Math.round(p * 0.9)));
  const ox = Math.round(p * 0.35), oy = Math.round(p * 0.6);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, o = i * 4;
    const sx = x - ox, sy = y - oy;
    const sa = sx >= 0 && sy >= 0 ? S[sy * w + sx] * 0.42 : 0;
    const a0 = A[i];
    if (a0 >= 0.999 || sa <= 0.001) continue;
    const at = a0 + sa * (1 - a0);
    for (let c = 0; c < 3; c++) out[o + c] = (out[o + c] * a0) / at;
    out[o + 3] = Math.round(at * 255);
  }
  d.set(out);
  return d;
}

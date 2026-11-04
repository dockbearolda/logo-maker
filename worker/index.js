// Logo maker sur Cloudflare : les pages sont des fichiers statiques (dist-cf/). Ce Worker ne répond qu'à ce que les
// fichiers statiques n'ont pas : les modèles d'IA trop gros pour eux (> 25 Mio), gardés dans R2.
const TYPES = { '.onnx': 'application/octet-stream', '.wasm': 'application/wasm', '.pth': 'application/octet-stream' };
const ISOLATION = {
  'X-Content-Type-Options': 'nosniff',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',   // les polices de Google/jsDelivr viennent toujours, sans cookies
  'Cache-Control': 'no-cache',
};

export default {
  async fetch(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
    let cle;
    try { cle = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, ''); } catch { return new Response('Introuvable.', { status: 404 }); }
    if (!cle || cle.includes('\0') || cle.split('/').some((p) => p === '' || p.startsWith('.'))) return new Response('Introuvable.', { status: 404, headers: ISOLATION });
    const obj = await env.MODELES.get(cle, { onlyIf: request.headers, range: request.headers });
    if (!obj) return new Response('Introuvable.', { status: 404, headers: { ...ISOLATION, 'Content-Type': 'text/plain; charset=utf-8' } });
    const ext = cle.slice(cle.lastIndexOf('.')).toLowerCase();
    const h = new Headers({ ...ISOLATION, 'Content-Type': TYPES[ext] || 'application/octet-stream', ETag: obj.httpEtag, 'Accept-Ranges': 'bytes' });
    if (!('body' in obj)) return new Response(null, { status: 304, headers: h });
    let status = 200;
    h.set('Content-Length', String(obj.size));
    if (obj.range && request.headers.has('range')) {
      const { offset = 0, length = obj.size - offset } = obj.range;
      h.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${obj.size}`);
      h.set('Content-Length', String(length));
      status = 206;
    }
    return new Response(request.method === 'HEAD' ? null : obj.body, { status, headers: h });
  },
};

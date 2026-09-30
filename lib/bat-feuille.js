/* ============================================================ LA FEUILLE BAT
   LE MÊME DESSIN À L'ATELIER ET CHEZ LE CLIENT. L'écran « Bon à tirer »
   (bat.html) y pose les logos ; la page du lien (espace/bat.html) la montre
   au client, qui la valide. Une seule fonction dessine les deux : ce que le
   client valide est ce que l'atelier a posé, au pixel près.
   LE PRODUIT D'ABORD. Un bandeau fin — qui, quoi, quel numéro —, le vêtement
   en grand, et une ligne de pied : article, quantités, marquages, validation.
   Pas d'adresse en pavé, pas de case de signature : le client valide en
   ligne, par le lien. */
import { ATELIER, LOGO_OLDA } from './espace-client.js'

/* LE VÊTEMENT, PAS LE VIDE AUTOUR : les photos TopTex laissent de larges
   marges. On recadre sur le sujet (en % de la photo) pour qu'il remplisse sa
   case. Les logos, eux, se placent en % du cadre recadré.
   CHAQUE PHOTO A SON CADRE depuis le 23 septembre 2026 : le serveur mesure
   où est le vêtement (serveur/recadrage.mjs) et la vue le porte dans
   `recadrage`. Ces fenêtres fixes ne servent plus qu'aux BAT posés avant,
   qui ne portent pas de cadre — leurs logos restent où le client les a vus. */
export const RECADRAGES = {
  textile: { x: 9, y: 16, w: 82, h: 70 },
  sac: { x: 20, y: 1, w: 58, h: 98 },
  casquette: { x: 0, y: 0, w: 100, h: 100 },
}
/* LA RÈGLE DU CM : quelle part de la photo fait la largeur réelle du sujet
   (corps du t-shirt à plat ≈ 48 % de l'image pour 53 cm). */
export const CALIBRES = {
  textile: { face: { cm: 53, pct: 48 }, dos: { cm: 53, pct: 48 }, cote: { cm: 30, pct: 40 } },
  sac: { face: { cm: 38, pct: 46 }, dos: { cm: 38, pct: 46 } },
  casquette: { face: { cm: 20, pct: 62 }, dos: { cm: 20, pct: 62 } },
}
export const RATIO_DEFAUT = { textile: 1666 / 2500, sac: 2678 / 2500, casquette: 1069 / 686 }
/* La largeur d'un logo au moment où on le pose ; il se redimensionne ensuite. */
export const LARGEUR_DEFAUT = { textile: 10, sac: 20, casquette: 7 }
export const VUES = { face: 'Face', dos: 'Dos', cote: 'Manche' }
export const ORDRE_VUES = ['face', 'dos', 'cote']

export const MENTIONS = "En validant ce bon à tirer en ligne, le client reconnaît avoir vérifié l'intégralité du document : orthographe, contenus, dimensions, emplacements, couleurs et quantités. La validation vaut acceptation définitive : aucune réclamation portant sur un élément visible sur ce document ne pourra être acceptée ensuite. Les couleurs affichées sont indicatives et peuvent varier entre l'écran, le papier et le textile ; les dimensions, en centimètres, peuvent varier de ±5 % à la production. La production n'est lancée qu'après validation en ligne de ce bon à tirer."

export function genre(nom) {
  const s = String(nom || '').toLowerCase()
  if (/\b(sac|tote|cabas|shopping)\b/.test(s)) return 'sac'
  if (/\b(casquette|bob|bonnet|visi[eè]re|trucker)\b/.test(s)) return 'casquette'
  return 'textile'
}

/* Le cadre d'une vue : le sien, ou la fenêtre fixe de son genre. */
export const cadreDeVue = (g, vue) => (vue && vue.recadrage) || RECADRAGES[g] || RECADRAGES.textile

/* Combien de % de la largeur du cadre fait un centimètre, pour une vue. */
export function parCmDe(g, vue, recadrage) {
  const calibres = CALIBRES[g] || CALIBRES.textile
  const cal = calibres[vue] || calibres.face
  return (cal.pct / cal.cm) * (100 / (recadrage || RECADRAGES[g] || RECADRAGES.textile).w)
}

/* UN LOGO GARDE SA PLACE SUR LE VÊTEMENT quand le cadre change : il passe
   du cadre `de` au cadre `vers` (en % de la photo). Sa largeur, en cm, ne
   bouge pas. */
export function logoRecadre(l, de, vers) {
  return Object.assign({}, l, {
    x: Math.round(((de.x + (l.x / 100) * de.w - vers.x) / vers.w) * 1e5) / 1e3,
    y: Math.round(((de.y + (l.y / 100) * de.h - vers.y) / vers.h) * 1e5) / 1e3,
  })
}

export const fmtCm = v => (Math.round(v * 10) / 10).toLocaleString('fr-FR')
const echap = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/* L'EMPREINTE D'UN BAT : ce qui change le document que le client juge — le
   vêtement, les tailles, chaque logo et sa place. Une validation ne tient
   que pour l'empreinte qu'elle a vue. Le contenu d'un logo se résume à sa
   longueur et à sa fin : deux images différentes n'y coïncident pas. */
export function empreinteDe(bat) {
  const texte = JSON.stringify([
    /* Les tailles et leurs quantités seules : la largeur DTF qu'on y lit
       en dessous ne change pas ce que le client valide. */
    bat.ref, bat.coloris, (bat.tailles || []).map(x => ({ t: x.t, q: x.q })),
    (bat.vues || []).map(v => [v.id, v.photo, (v.logos || []).map(l => [
      String(l.src).length, String(l.src).slice(-64), Math.round(l.x * 10), Math.round(l.y * 10), Math.round(l.cm * 10),
    ])]),
  ])
  let h = 5381
  for (let i = 0; i < texte.length; i++) h = ((h * 33) ^ texte.charCodeAt(i)) >>> 0
  return h.toString(36)
}

export const ratioCadre = (g, ratioPhoto, recadrage) => {
  const r = recadrage || RECADRAGES[g] || RECADRAGES.textile
  return (ratioPhoto || r.p || RATIO_DEFAUT[g] || RATIO_DEFAUT.textile) * r.w / r.h
}

function vueHTML(bat, vue, o) {
  const g = bat.genre
  const r = cadreDeVue(g, vue)
  const parCm = parCmDe(g, vue.id, r)
  const recadre = 'width:' + (10000 / r.w) + '%;height:' + (10000 / r.h) + '%;left:' + (-r.x / r.w * 100) + '%;top:' + (-r.y / r.h * 100) + '%'
  const logos = (vue.logos || []).map(l => '<div class="logo-pose' + (o.selection === l.id ? ' sel' : '') + '" data-logo="' + echap(l.id) + '" data-vue="' + vue.id + '" data-par-cm="' + parCm + '" style="left:' + Number(l.x) + '%;top:' + Number(l.y) + '%;width:' + (Number(l.cm) * parCm) + '%">'
    + '<img src="' + echap(l.src) + '" alt="" draggable="false">'
    + (o.edition
      ? '<span class="logo-mot">' + fmtCm(l.cm) + ' cm</span><button class="poignee" tabindex="-1" aria-label="Agrandir ou réduire"></button>'
        + '<button class="retirer-logo" data-action="retirer-logo" data-cle="' + echap(o.cle) + '" data-vue="' + vue.id + '" data-logo="' + echap(l.id) + '" aria-label="Retirer le logo">×</button>'
      : '')
    + '</div>').join('')
  const invite = o.edition && !(vue.logos || []).length ? '<span class="invite">Cliquer pour poser un logo</span>' : ''
  const photoStyle = o.autonome ? ' style="flex:none;width:100%;aspect-ratio:' + ratioCadre(g, 0, r) + '"' : ''
  /* Tant que le serveur mesure la photo, le vêtement ne se montre pas : il
     apparaîtrait coupé, puis sauterait. */
  return '<figure class="f-vue"><div class="photo"' + photoStyle + '><div class="cadre' + (vue.attente ? ' attente' : '') + '" data-cle="' + echap(o.cle) + '" data-vue="' + vue.id + '" data-genre="' + g + '" data-url="' + echap(vue.photo) + '" data-recadrage="' + [r.w, r.h, r.p || 0].join(' ') + '">'
    + '<div class="cadre-photo"><img class="vetement" style="' + recadre + '" src="' + echap(vue.photo) + '" alt="' + echap(VUES[vue.id]) + '" draggable="false"></div>'
    + logos + invite
    + '</div></div><figcaption class="f-cap">' + VUES[vue.id] + '</figcaption></figure>'
}

/* LES VUES SEULES — ce que la page du client met en tête de chaque article,
   en grand, avant la feuille. `autonome` donne à chaque photo sa propre
   hauteur, hors de la feuille A4. */
export function vuesHTML(bat, options = {}) {
  const o = Object.assign({ edition: false, selection: null, cle: '', autonome: false }, options)
  return '<div class="f-vues' + (o.autonome ? ' autonome' : '') + '">' + (bat.vues || []).map(v => vueHTML(bat, v, o)).join('') + '</div>'
}

/* LA FEUILLE A4 PAYSAGE. `validation` : la décision du client sur CE BAT,
   `{ decision: 'valide' | 'correction', quand }`, ou rien. */
export function feuilleHTML(bat, options = {}) {
  const o = Object.assign({ edition: false, selection: null, cle: '', validation: null }, options)
  const tailles = (bat.tailles || []).filter(x => x.q > 0)
  const total = tailles.reduce((n, x) => n + x.q, 0)
  const v = o.validation
  const validation = v && v.decision === 'valide'
    ? '<div class="f-valide ok"><div class="f-cap">Validé en ligne</div><b>' + echap(v.quand || '') + '</b></div>'
    : v && v.decision === 'correction'
      ? '<div class="f-valide reprise"><div class="f-cap">Correction demandée</div><b>' + echap(v.quand || '') + '</b></div>'
      : ''
  const coordonnees = [ATELIER.lignes[2], ATELIER.lignes[3]].filter(Boolean).map(echap).join(' · ')
  return '<div class="feuille' + (o.edition ? ' edition' : '') + '"><div class="f-page">'
    + '<header class="f-bande">'
    + '<div class="f-marque"><span class="f-logo">' + LOGO_OLDA + '</span><div class="f-marque-t"><b>' + echap(ATELIER.nom) + '</b><span>' + coordonnees + '</span></div></div>'
    + '<div class="f-titre"><b>BON À TIRER</b><span class="f-num">' + echap(bat.numero) + '</span></div>'
    + '<div class="f-client"><b>' + echap(bat.client || '—') + '</b>' + (bat.projet ? '<span>' + echap(bat.projet) + '</span>' : '') + '</div>'
    + '</header>'
    + vuesHTML(bat, o)
    + '<div class="f-bas">'
    + '<div><div class="f-cap">Article</div><div><b>' + echap(bat.ref) + '</b> ' + echap(bat.nom) + '</div><div class="f-coul"><span class="pastille" style="background:' + echap(bat.hex) + '"></span>' + echap(bat.coloris) + '</div></div>'
    + '<div><div class="f-cap">Quantités</div><div class="f-tailles">'
    + (tailles.length ? tailles.map(x => '<span><small>' + echap(x.t) + '</small><b>' + x.q + '</b>' + (x.dos ? '<i>dos ' + echap(x.dos) + ' mm</i>' : '') + '</span>').join('') + '<span class="f-total"><small>Total</small><b>' + total + '</b></span>' : '<span><b>—</b></span>')
    + '</div></div>'
    + validation
    + '</div>'
    + '<footer class="f-pied">' + echap(MENTIONS) + ' — ' + echap(ATELIER.pied) + '</footer>'
    + '</div></div>'
}

/* LE VÊTEMENT S'INSCRIT DANS SA CASE sans se déformer : le cadre prend la
   proportion de la photo recadrée, en % de sa case — les logos (en % du
   cadre) tombent donc au même endroit à l'écran, sur le téléphone du client
   et sur le papier. */
const ratios = new Map()
export function ajusterCadres(racine) {
  racine.querySelectorAll('.cadre').forEach(ajusterCadre)
}
function ajusterCadre(cadre) {
  const photo = cadre.parentElement
  const img = cadre.querySelector('.vetement')
  /* Une feuille redessinée pendant que la photo arrivait a repris cette
     image ailleurs (poserHTML) : l'ancien cadre n'a plus rien à ajuster. */
  if (!img) return
  if (img.naturalWidth) ratios.set(cadre.dataset.url, img.naturalWidth / img.naturalHeight)
  else img.addEventListener('load', () => { ratios.set(cadre.dataset.url, img.naturalWidth / img.naturalHeight); ajusterCadre(cadre) }, { once: true })
  const W = photo.clientWidth
  const H = photo.clientHeight
  if (!W || !H) return
  const [rw, rh, rp] = String(cadre.dataset.recadrage || '').split(' ').map(Number)
  const a = ratioCadre(cadre.dataset.genre, ratios.get(cadre.dataset.url), rw ? { w: rw, h: rh, p: rp } : null)
  const r = W / H
  const w = a > r ? 100 : (a / r) * 100
  const h = a > r ? (r / a) * 100 : 100
  Object.assign(cadre.style, { width: w + '%', height: h + '%', left: (100 - w) / 2 + '%', top: (100 - h) / 2 + '%' })
}

/* ============================================== L'INSTANTANÉ, POUR TOUJOURS
   UN RENDU NE RECHARGE JAMAIS UNE IMAGE. Le 15 septembre 2026, chaque
   modification recréait toutes les images des feuilles : trois chiffres
   tapés pendant que les photos TopTex (1 à 2,5 Mo chacune) arrivaient ont
   coûté 2,96 s, chaque frappe relançant les téléchargements de zéro. Charlie :
   « je veux de l'instantané », et c'est pour toujours.
   `poserHTML` remplace le contenu d'un conteneur en REPRENANT les images
   déjà là — même adresse, même nœud, déjà chargé ou en cours — au lieu d'en
   créer de nouvelles. Tout ce qui dessine des feuilles passe par ici. */
export function poserHTML(conteneur, html) {
  const gardees = new Map()
  conteneur.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src')
    if (!src) return
    if (!gardees.has(src)) gardees.set(src, [])
    gardees.get(src).push(img)
  })
  const fragment = document.createRange().createContextualFragment(html)
  fragment.querySelectorAll('img').forEach(neuve => {
    const pile = gardees.get(neuve.getAttribute('src'))
    const ancienne = pile && pile.shift()
    if (!ancienne) return
    for (const nom of ['class', 'style', 'alt', 'draggable']) {
      const v = neuve.getAttribute(nom)
      if (v === null) ancienne.removeAttribute(nom)
      else if (ancienne.getAttribute(nom) !== v) ancienne.setAttribute(nom, v)
    }
    neuve.replaceWith(ancienne)
  })
  conteneur.replaceChildren(fragment)
}

/* UN LOGO S'AFFICHE PAR UNE ADRESSE COURTE. Gardé en data URL (c'est ce qui
   se sauvegarde et s'envoie), il pèse des centaines de Ko de texte que chaque
   rendu devrait relire ; on le convertit une fois en `blob:` et c'est cette
   adresse que la feuille porte. */
const urlsAffichage = new Map()
export function urlAffichage(src) {
  if (!/^data:/.test(String(src))) return src
  let url = urlsAffichage.get(src)
  if (!url) {
    const virgule = src.indexOf(',')
    const type = src.slice(5, virgule).replace(';base64', '')
    const binaire = atob(src.slice(virgule + 1))
    const octets = new Uint8Array(binaire.length)
    for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i)
    const corps = type === 'image/svg+xml' ? svgSain(new TextDecoder().decode(octets)) : octets
    url = URL.createObjectURL(new Blob([corps], { type }))
    urlsAffichage.set(src, url)
  }
  return url
}

/* UN LOGO SVG EST UN DOCUMENT, PAS UNE IMAGE. Il arrive souvent du client
   (WhatsApp, mail) : un <script> ou un « onload » dedans ne fait rien dans
   une balise <img>, mais s'exécute dès que l'adresse `blob:` s'ouvre dans un
   onglet — avec l'origine du comptoir, et le mot de passe en cache. On n'en
   garde que le dessin : ni script, ni objet étranger, ni gestionnaire, ni
   lien `javascript:`. */
export function svgSain(texte) {
  if (typeof DOMParser === 'undefined') return texte
  const doc = new DOMParser().parseFromString(String(texte), 'image/svg+xml')
  if (doc.getElementsByTagName('parsererror').length) return texte
  doc.querySelectorAll('script, foreignObject, iframe, embed, object, handler, listener').forEach(n => n.remove())
  doc.querySelectorAll('*').forEach(n => {
    Array.from(n.attributes).forEach(a => {
      const nom = a.name.toLowerCase()
      const valeur = a.value.replace(/[\s\u0000-\u001f]/g, '').toLowerCase()
      if (nom.startsWith('on')) n.removeAttribute(a.name)
      else if (/(^|:)href$/.test(nom) && /^(javascript|vbscript|data:text\/html)/.test(valeur)) n.removeAttribute(a.name)
    })
  })
  return new XMLSerializer().serializeToString(doc)
}

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
/* A4 PAYSAGE EN UNITÉS DE CONTENEUR : tout se mesure en largeur de feuille
   (cqw), donc l'écran, le téléphone et le papier dessinent la même page. */
export const STYLE_FEUILLE = `
.feuille{position:relative;width:100%;aspect-ratio:297/210;background:#fff;container-type:inline-size;color:#202930;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-variant-numeric:tabular-nums;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.f-page{position:absolute;inset:0;display:flex;flex-direction:column;gap:.9cqw;padding:1.6cqw 2.2cqw 1.2cqw;font-size:1.05cqw;line-height:1.35}
.f-cap{font:500 .7em/1.2 ${MONO};letter-spacing:.14em;color:#4A6274;text-transform:uppercase}
.f-bande{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:2em;padding-bottom:.8em;border-bottom:.2cqw solid #202930}
.f-marque{display:flex;align-items:center;gap:.8em;min-width:0}
.f-logo svg{display:block;width:2.6em;height:2.75em}
.f-marque-t{display:flex;flex-direction:column;gap:.1em;min-width:0}
.f-marque b,.f-client b{font-size:1.15em;font-weight:800}
.f-marque-t span,.f-client span{color:#4A6274;font-size:.85em}
.f-titre{display:flex;flex-direction:column;align-items:center;gap:.2em;text-align:center}
.f-titre b{font-size:1.6em;font-weight:800;letter-spacing:.16em;line-height:1}
.f-num{font:700 1em/1.2 ${MONO}}
.f-client{display:flex;flex-direction:column;align-items:flex-end;text-align:right;gap:.1em;min-width:0}
.f-client b{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.f-vues{flex:1;min-height:0;display:flex;gap:1.5em;background:#f5f6f7;border-radius:.8em;padding:1.6em 2.4em .7em}
.f-vue{flex:1;min-width:0;display:flex;flex-direction:column;gap:.4em;margin:0}
.f-vue figcaption{text-align:center}
.photo{position:relative;flex:1;min-height:0}
.cadre{position:absolute}
.cadre.attente{visibility:hidden}
.cadre-photo{position:absolute;inset:0;overflow:hidden}
.vetement{position:absolute;display:block;max-width:none;user-select:none;pointer-events:none}
.f-bas{display:grid;grid-template-columns:1.3fr 3fr 1fr;gap:1.6em;padding-top:.9em;border-top:.2cqw solid #202930;align-items:start;font-size:1.3em}
.f-bas b{font-weight:800}
.f-coul{display:flex;align-items:center;gap:.4em;margin-top:.25em;font-weight:600}
.feuille .pastille,.f-vues .pastille{width:.9em;height:.9em;border-radius:999px;border:1px solid rgba(15,23,42,.25);display:inline-block;flex:none}
.f-tailles{display:flex;flex-wrap:wrap;gap:.5em;margin-top:.35em}
.f-tailles span{display:flex;flex-direction:column;align-items:center;gap:.1em;min-width:4.6em;padding:.35em .6em .45em;border:1px solid #ADB8B9;border-radius:.45em;font-variant-numeric:tabular-nums}
.f-tailles small{font-size:.95em;font-weight:700;line-height:1.1;color:#202930}
.f-tailles b{font-size:1.9em;line-height:1.05}
.f-tailles i{font-size:.85em;font-weight:600;font-style:normal;line-height:1.2;color:#202930;white-space:nowrap}
.f-total{background:#202930;border-color:#202930!important;color:#fff}
.f-total small{color:#fff!important}
.f-valide{border:1px solid #ADB8B9;border-radius:.4em;padding:.5em .7em;display:flex;flex-direction:column;gap:.2em}
.f-valide.ok{border-color:#0b7a50;color:#0b7a50;background:#e7f7ef}
.f-valide.ok .f-cap{color:#0b7a50}
.f-valide.reprise{border-color:#b91c1c;color:#b91c1c;background:#fdeaea}
.f-valide.reprise .f-cap{color:#b91c1c}
.f-pied{font-size:.58em;line-height:1.35;color:#4A6274}
.f-vues.autonome{flex-wrap:wrap;border-radius:0;padding:1em}
.f-vues.autonome .f-vue{flex:1 1 240px}
.logo-pose{position:absolute;transform:translate(-50%,-50%)}
.logo-pose>img{display:block;width:100%;height:auto;pointer-events:none;user-select:none}
.logo-mot,.poignee,.retirer-logo,.invite{display:none}
.edition .cadre{cursor:crosshair}
.edition .cadre.survol{outline:.15cqw dashed #111827;outline-offset:.3cqw}
.edition .logo-pose{cursor:move;touch-action:none}
.edition .logo-pose.sel,.edition .logo-pose:hover{outline:.1cqw solid #111827;box-shadow:0 0 0 .1cqw #fff}
.edition .logo-pose.sel .logo-mot,.edition .logo-pose:hover .logo-mot{display:block;position:absolute;top:calc(100% + .3cqw);left:50%;transform:translateX(-50%);white-space:nowrap;font:500 .75cqw/1.2 ${MONO};background:rgba(255,255,255,.95);color:#202930;padding:.15cqw .4cqw;border-radius:.2cqw;pointer-events:none}
.edition .logo-pose.sel .poignee,.edition .logo-pose:hover .poignee{display:block;position:absolute;right:-9px;bottom:-9px;width:18px;height:18px;padding:0;border-radius:999px;background:#111827;border:2px solid #fff;cursor:nwse-resize}
.edition .logo-pose.sel .retirer-logo,.edition .logo-pose:hover .retirer-logo{display:block;position:absolute;right:-12px;top:-12px;width:24px;height:24px;padding:0;border-radius:999px;border:1px solid #e6e8ec;background:#fff;color:#1d2433;font-size:15px;line-height:1;cursor:pointer}
.edition .invite{display:block;position:absolute;left:50%;bottom:4%;transform:translateX(-50%);white-space:nowrap;background:#111827;color:#fff;border-radius:999px;padding:.35cqw .8cqw;font:600 .85cqw/1.2 Inter,system-ui,sans-serif;pointer-events:none}
@media print{.edition .logo-pose{outline:0!important;box-shadow:none!important}.logo-mot,.poignee,.retirer-logo,.invite{display:none!important}}
`

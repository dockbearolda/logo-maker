"""LE CORPUS DU BANC DE BOUT EN BOUT (27 novembre 2026, « transformer un logo
de merde en un logo parfaitement exploitable ») : des logos À PLAT dont on
connaît la vérité — rendus nets à 2 048 px puis réduits à 1 024 (l'anti-
crénelage propre d'un vrai fichier) —, et chacun abîmé comme les fichiers
des clients :
  - `petit`     : réduit ×4 (256 px), JPEG 60 ;
  - `flou`      : réduit à 384 px, flou de 1,2 px, JPEG 70 ;
  - `whatsapp`  : réduit à 320 px, JPEG 75, puis 300 px, JPEG 55 (la double
                  compression d'une messagerie, les couleurs sous-échantillonnées).
Quatre sortes de logos, au même tirage : un emblème (symétrique, un texte
au centre), un mot (une ou deux lignes, un filet), un badge (un disque, un
anneau, le texte dedans), un symbole pur (symétrique, sans texte). Dans un
Python avec Pillow :
  python3 outils/corpus-bout.py <dossier> [nombre=24] [graine=1]
puis `npm run banc:bout -- <dossier> --ia`. Ajouter de vrais PNG propres :
`--vrais <png…>` (chacun réduit à 1 024 px au plus, abîmé de même)."""
import sys, os, io, random, glob, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

args = [a for a in sys.argv[1:] if not a.startswith('--')]
vrais = sys.argv[sys.argv.index('--vrais') + 1:] if '--vrais' in sys.argv else []
if vrais:
    args = args[:1] + [a for a in args[1:] if a not in vrais]
dossier = args[0]
n = int(args[1]) if len(args) > 1 else 24
random.seed(int(args[2]) if len(args) > 2 else 1)
os.makedirs(dossier, exist_ok=True)

# Des polices de logo du poste (latin seulement).
VOULUES = ['Futura', 'Avenir', 'Helvetica', 'Gill Sans', 'Georgia', 'Didot', 'Copperplate', 'Rockwell', 'Baskerville', 'Impact', 'Arial Black', 'Arial Bold', 'Verdana Bold', 'Trebuchet MS Bold', 'Optima', 'Palatino', 'Times New Roman Bold', 'Chalkboard', 'Marker Felt', 'Bodoni']
chemins = []
for d in ['/System/Library/Fonts', '/System/Library/Fonts/Supplemental', '/Library/Fonts', os.path.expanduser('~/Library/Fonts')]:
    chemins += glob.glob(os.path.join(d, '*.ttf')) + glob.glob(os.path.join(d, '*.ttc')) + glob.glob(os.path.join(d, '*.otf'))
faces = []
for c in sorted(chemins):
    for i in range(8):
        try:
            f = ImageFont.truetype(c, 40, index=i)
        except Exception:
            break
        nom = ' '.join(str(x) for x in f.getname())
        if any(v.lower() in nom.lower() for v in VOULUES):
            def rendu(ch):
                im = Image.new('L', (80, 60), 0)
                ImageDraw.Draw(im).text((4, 4), ch, font=f, fill=255)
                return im.tobytes()
            # une police qui dessine le latin : « A », « R » et « É » différents du glyphe manquant
            manquant = rendu('\ue000')
            if all(rendu(ch) != manquant for ch in 'ARÉg'):
                faces.append((c, i))
        if not c.lower().endswith('.ttc'):
            break
faces = sorted(set(faces))
print('polices', len(faces))

# Des couleurs de logo, franches et loin les unes des autres.
COULEURS = [(0, 0, 0), (255, 255, 255), (200, 16, 46), (0, 51, 160), (0, 132, 61), (255, 199, 44), (247, 127, 0), (102, 45, 145), (0, 159, 218), (35, 31, 32), (128, 128, 128), (155, 89, 56), (230, 0, 126), (0, 98, 114), (196, 214, 0), (176, 141, 87)]

def ecart(a, b):
    return sum((x - y) ** 2 for x, y in zip(a, b)) ** 0.5

def tirer(k, fond):
    pris = []
    for c in random.sample(COULEURS, len(COULEURS)):
        if ecart(c, fond) > 120 and all(ecart(c, p) > 110 for p in pris):
            pris.append(c)
        if len(pris) == k:
            break
    return pris

S = 2048
MOTS = ['OLDA', 'STUDIO', 'ATELIER', 'Boulangerie', 'CAFÉ', 'GARAGE', 'La Piscine', 'Sea View', 'SURF CLUB', 'Dive Center', 'Saint-Martin', 'EST. 2012', 'PREMIUM', 'Artisan', 'Marine', 'Tropical', 'BEACH BAR', 'Yacht Charter', 'Fitness', 'Épicerie', 'Rhum', 'Sunset', 'Coral Reef', 'Kite School']

def police(taille):
    c, i = random.choice(faces)
    return ImageFont.truetype(c, taille, index=i)

def ecrire(d, mot, cx, cy, largeur_max, taille, couleur):
    """Un mot centré en (cx, cy), réduit jusqu'à tenir dans `largeur_max`."""
    f = police(taille)
    while True:
        bb = d.textbbox((0, 0), mot, font=f)
        w = bb[2] - bb[0]
        if w <= largeur_max or f.size < 40:
            break
        f = f.font_variant(size=int(f.size * 0.9))
    h = bb[3] - bb[1]
    d.text((cx - w / 2 - bb[0], cy - h / 2 - bb[1]), mot, font=f, fill=couleur)
    return h

def miroir(pts, cx):
    return pts + [(2 * cx - x, y) for x, y in reversed(pts)]

def etoile(cx, cy, r, k=5, creux=0.45, rot=-math.pi / 2):
    return [(cx + (r if i % 2 == 0 else r * creux) * math.cos(rot + math.pi * i / k), cy + (r if i % 2 == 0 else r * creux) * math.sin(rot + math.pi * i / k)) for i in range(2 * k)]

def embleme(d, c, fond):
    cx = S / 2
    # un écu : une moitié tirée au sort, puis son miroir
    h0, h1 = S * 0.12, S * 0.88
    pts = [(cx, h0), (cx - S * random.uniform(0.25, 0.38), h0 + S * random.uniform(0.0, 0.08)), (cx - S * random.uniform(0.3, 0.4), S * random.uniform(0.45, 0.6)), (cx - S * random.uniform(0.1, 0.2), S * random.uniform(0.72, 0.8)), (cx, h1)]
    ecu = pts + [(2 * cx - x, y) for x, y in reversed(pts[1:-1])]
    d.polygon(ecu, fill=c[0])
    # l'intérieur : le même écu resserré vers son centre
    gx, gy = cx, sum(y for _, y in ecu) / len(ecu)
    k = random.uniform(0.86, 0.93)
    d.polygon([(gx + (x - gx) * k, gy + (y - gy) * k) for x, y in ecu], fill=c[1] if len(c) > 1 and random.random() < 0.5 else fond)
    d.polygon(etoile(cx, S * 0.34, S * 0.09), fill=c[0] if len(c) < 3 else c[2])
    ecrire(d, random.choice(MOTS).upper(), cx, S * 0.55, S * 0.5, int(S * 0.08), c[0])

def mot(d, c, fond):
    cx = S / 2
    h = ecrire(d, random.choice(MOTS), cx, S * 0.42, S * 0.85, int(S * random.uniform(0.12, 0.2)), c[0])
    if random.random() < 0.6:
        ep = random.randint(10, 30)
        d.rectangle([S * 0.2, S * 0.42 + h / 2 + 40, S * 0.8, S * 0.42 + h / 2 + 40 + ep], fill=c[1 % len(c)])
    if random.random() < 0.7:
        ecrire(d, random.choice(MOTS).upper(), cx, S * 0.68, S * 0.6, int(S * 0.06), c[-1])

def badge(d, c, fond):
    cx = cy = S / 2
    r = S * 0.42
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c[0])
    e = r * random.uniform(0.06, 0.12)
    d.ellipse([cx - r + e, cy - r + e, cx + r - e, cy + r - e], fill=fond)
    r2 = r - 2 * e
    d.ellipse([cx - r2, cy - r2, cx + r2, cy + r2], fill=c[0] if random.random() < 0.5 else c[1 % len(c)])
    encre = fond if len(c) < 3 else c[2]
    ecrire(d, random.choice(MOTS).upper(), cx, cy - r2 * 0.1, r2 * 1.5, int(S * 0.1), encre)
    for k in (-1, 1):
        d.polygon(etoile(cx + k * r2 * 0.45, cy + r2 * 0.45, r2 * 0.1), fill=encre)

def symbole(d, c, fond):
    cx = S / 2
    for j in range(random.randint(2, 4)):
        y = S * (0.2 + 0.16 * j)
        w, ep = S * random.uniform(0.15, 0.4), S * random.uniform(0.04, 0.08)
        pts = [(cx, y), (cx - w, y + w * 0.6), (cx - w, y + w * 0.6 + ep), (cx, y + ep)]
        d.polygon(miroir(pts, cx), fill=c[j % len(c)])
    if random.random() < 0.6:
        r = S * 0.07
        d.ellipse([cx - r, S * 0.1 - r * 0.2, cx + r, S * 0.1 + r * 1.8], fill=c[-1])

SORTES = [embleme, mot, badge, symbole]

def abimer(verite, nom, alpha=None, couleurs=None, ambigu=None):
    """`verite` (RVB) abîmée trois fois ; `alpha`, la vérité de l'encre (le
    vide partout où le fond paraît, creux compris), écrite dans verite.png."""
    base = os.path.join(dossier, nom)
    os.makedirs(base, exist_ok=True)
    if couleurs is not None:
        import json
        with open(os.path.join(base, 'couleurs.json'), 'w') as f:
            json.dump([list(c) for c in couleurs], f)
    if ambigu is not None:
        ambigu.save(os.path.join(base, 'ambigu.png'))
    if alpha is not None:
        v = verite.copy(); v.putalpha(alpha); v.save(os.path.join(base, 'verite.png'))
    else:
        verite.save(os.path.join(base, 'verite.png'))
    L, H = verite.size
    def taille(cote):
        f = cote / max(L, H)
        return (max(1, round(L * f)), max(1, round(H * f)))
    def jpeg(im, q):
        b = io.BytesIO(); im.save(b, 'JPEG', quality=q); b.seek(0)
        return Image.open(b).convert('RGB')
    jpeg(verite.resize(taille(256), Image.BICUBIC), 60).save(os.path.join(base, 'petit.png'))
    jpeg(verite.resize(taille(384), Image.BICUBIC).filter(ImageFilter.GaussianBlur(1.2)), 70).save(os.path.join(base, 'flou.png'))
    jpeg(jpeg(verite.resize(taille(320), Image.BICUBIC), 75).resize(taille(300), Image.BICUBIC), 55).save(os.path.join(base, 'whatsapp.png'))

for i in range(n):
    sorte = SORTES[i % len(SORTES)]
    fond = random.choice([(255, 255, 255)] * 4 + [(0, 0, 0), (245, 240, 230)])
    c = tirer(random.randint(1, 3), fond)
    im = Image.new('RGB', (S, S), fond)
    sorte(ImageDraw.Draw(im), c, fond)
    # recadré sur le logo, une marge de 6 %
    bb = ImageChops.difference(im, Image.new('RGB', im.size, fond)).getbbox()
    if bb:
        m = int(0.06 * max(bb[2] - bb[0], bb[3] - bb[1]))
        im = im.crop((max(0, bb[0] - m), max(0, bb[1] - m), min(S, bb[2] + m), min(S, bb[3] + m)))
    # l'encre vraie : tout pixel qui n'est pas exactement le fond (à 2 048 px,
    # l'anticrénelage du texte y compte pour de l'encre : un quart de pixel au plus)
    r, g, b = ImageChops.difference(im, Image.new('RGB', im.size, fond)).split()
    encre = ImageChops.lighter(ImageChops.lighter(r, g), b).point(lambda v: 255 if v else 0)
    w, h = im.size
    f = 1024 / max(w, h) if max(w, h) > 1024 else 0.5
    taille = (round(w * f), round(h * f))
    rgba = im.copy(); rgba.putalpha(encre)
    alpha = rgba.convert('RGBa').resize(taille, Image.LANCZOS).convert('RGBA')
    # L'AMBIGU : un grand intérieur couleur du fond, enfermé (l'intérieur d'un
    # écu cerné, l'anneau crème entre deux cercles). Vide pour « Partout »,
    # mais l'app garde exprès la marge blanche d'un autocollant : le banc ne
    # le compte ni d'un côté ni de l'autre. Un creux de lettre, petit, compte.
    vide = Image.eval(encre, lambda v: 255 - v)
    dehors = vide.copy()
    for coin in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        if dehors.getpixel(coin) == 255:
            ImageDraw.floodfill(dehors, coin, 128)
    enferme = dehors.point(lambda v: 255 if v == 255 else 0)
    # chaque morceau enfermé, gardé s'il fait 1 % de l'image au moins
    ambigu = Image.new('L', (w, h), 0)
    trous = enferme.copy()
    import numpy as np
    a = np.array(trous)
    ys, xs = np.nonzero(a == 255)
    for y, x in zip(ys, xs):
        if trous.getpixel((int(x), int(y))) != 255:
            continue
        ImageDraw.floodfill(trous, (int(x), int(y)), 77)
        piece = np.array(trous) == 77
        if piece.sum() >= 0.01 * w * h:
            ambigu.paste(255, mask=Image.fromarray((piece * 255).astype('uint8')))
        trous.paste(0, mask=Image.fromarray((piece * 255).astype('uint8')))
    ambigu = ambigu.resize(taille, Image.BILINEAR).point(lambda v: 255 if v > 0 else 0)
    # les encres vraiment posées (une couleur tirée peut ne servir nulle part)
    vues = {px for _, px in im.getcolors(1 << 24)} if im.getcolors(1 << 24) else set()
    abimer(im.resize(taille, Image.LANCZOS), f'{i:02d}-{sorte.__name__}', alpha.getchannel('A'), [x for x in c if x in vues], ambigu)

for v in vrais:
    im = Image.open(v).convert('RGBA')
    fondu = Image.new('RGBA', im.size, (255, 255, 255, 255))
    im = Image.alpha_composite(fondu, im).convert('RGB')
    w, h = im.size
    if max(w, h) > 1024:
        f = 1024 / max(w, h)
        im = im.resize((round(w * f), round(h * f)), Image.LANCZOS)
    nom = 'vrai-' + ''.join(ch if ch.isalnum() else '-' for ch in os.path.splitext(os.path.basename(v))[0])[:40]
    abimer(im, nom)
print('fini', n, '+', len(vrais))

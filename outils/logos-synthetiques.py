"""LES LOGOS SYNTHÉTIQUES du modèle maison (12 octobre 2026) : du texte dans
les polices du poste (celles qui dessinent le latin — une police sans
« A », sans « g » ou aux glyphes manquants est écartée ; les accents
seulement si elle les a), des formes, des filets, des cernes, des ombres,
des cartes, sur fond uni ou dégradé. Rendus à 1 024 puis réduits à 512
(l'anticrénelage propre d'un vrai logo). Dans un venv avec Pillow :
  python outils/logos-synthetiques.py <dossier> 3000 [graine]
puis outils/entrainer-logo.py."""
import sys, os, random, glob, math, unicodedata
from PIL import Image, ImageDraw, ImageFont, ImageFilter

dossier, n = sys.argv[1], int(sys.argv[2])
random.seed(int(sys.argv[3]) if len(sys.argv) > 3 else 1)
os.makedirs(dossier, exist_ok=True)

# Les polices du poste : chaque face qui dessine du latin.
chemins = []
for d in ['/System/Library/Fonts', '/System/Library/Fonts/Supplemental', '/Library/Fonts', os.path.expanduser('~/Library/Fonts'), os.path.join(dossier, '..', 'polices-google')]:
    chemins += glob.glob(os.path.join(d, '*.ttf')) + glob.glob(os.path.join(d, '*.otf')) + glob.glob(os.path.join(d, '*.ttc')) + glob.glob(os.path.join(d, '*.woff'))
faces = []
for c in chemins:
    base = os.path.basename(c).lower()
    if any(x in base for x in ['pingfang', 'hiragino', 'heiti', 'songti', 'kaiti', 'apple color', 'emoji', 'symbol', 'wingding', 'zapf', 'lastresort', 'notosanssymbol', 'braille', 'kefa', 'devanagari', 'gujarati', 'gurmukhi', 'kannada', 'khmer', 'lao', 'malayalam', 'myanmar', 'oriya', 'sinhala', 'tamil', 'telugu', 'thai', 'tibetan', 'bangla', 'arabic', 'hebrew', 'armenian', 'georgian', 'mongolian', 'kohinoor', 'noto sans', 'notosans', 'notoserif']):
        if 'notosans-' not in base and 'notoserif-' not in base and 'noto' in base:
            continue
    for i in range(6):
        try:
            f = ImageFont.truetype(c, 40, index=i)
            # Une police qui dessine le latin : « A » et « g » différents entre eux et du glyphe manquant.
            def rendu(ch):
                im = Image.new('L', (120, 60), 0)
                ImageDraw.Draw(im).text((4, 4), ch, font=f, fill=255)
                return im.tobytes()
            manquant = rendu('\ue000')
            a, g = rendu('A'), rendu('g')
            if a == manquant or g == manquant or a == g or Image.frombytes('L', (120, 60), a).getbbox() is None:
                if not c.lower().endswith('.ttc'):
                    break
                continue
            accents = rendu('é') != manquant and rendu('É') != manquant
            faces.append((c, i, accents))
        except Exception:
            break
        if not c.lower().endswith('.ttc'):
            break
print('faces', len(faces))

MOTS = ['ATELIER', 'STUDIO', 'Atelier', 'Boulangerie', 'Restaurant', 'CAFÉ', 'Garage', 'Plomberie', 'LA PISCINE', 'Villas', 'Marine', 'Fleuriste', 'Électricité', 'Beauté', 'Coiffure', 'Pizza', 'Burger', 'Tacos', 'Saint-Martin', 'Antilles', 'Guadeloupe', 'Martinique', 'Caraïbes', 'Island', 'Sea View', 'Club', 'Team', 'Sport', 'Fitness', 'Yoga', 'Surf', 'Dive Center', 'Réserve Naturelle', 'Depuis 1987', '2026', 'Tel. 0690 12 34 56', 'www.atelier.fr', 'EST. 2012', 'PREMIUM', 'QUALITY', 'ORIGINAL', 'Bio', 'Local', 'Artisan', 'Boutique', 'Création', 'Design', 'Print', 'Textile', 'Broderie', 'Sticker', 'Logo', 'Maker', 'The Friendly Island', 'Cercle des Créateurs', 'AUTOMAX', 'DIB', 'SSV', '6e3 AME', 'Brazier on Fire', 'Amazing Stay', 'Strong Together', 'I\'M HIS FAVORITE EX', 'Lorem', 'Ipsum', 'Dolor', 'Monogram', 'Wedding', 'Gourmet', 'Épicerie', 'Pharmacie', 'Optique', 'Dentiste', 'Avocat', 'Notaire', 'Immobilier', 'Location', 'Transport', 'Taxi', 'Hôtel', 'Resort', 'Spa', 'Bar', 'Lounge', 'Rhum', 'Punch', 'Mango', 'Coco', 'Tropical', 'Sunset', 'Beach', 'Ocean', 'Wave', 'Palm', 'Coral', 'Reef', 'Nautic', 'Yacht', 'Charter', 'Fishing', 'Kite', 'Jet', 'Moto', 'Auto', 'Bike', 'Run', 'Cross', 'Fit', 'Box', 'Dance', 'Music', 'Live', 'Festival', 'Carnaval', 'Fête', 'École', 'Collège', 'Lycée', 'Université', 'Formation', 'Conseil', 'Expert', 'Services', 'Solutions', 'Groupe', 'Compagnie', 'Société', 'SARL', 'SAS', '&', 'et fils', 'and Co', 'Bros', 'Family', 'Kids', 'Baby', 'Mom', 'Dad', 'Love', 'Peace', 'Vibes', 'Good', 'Happy', 'Smile', 'Joy', 'Fun', 'Cool', 'Hot', 'Fresh', 'Pure', 'Natural', 'Green', 'Blue', 'Red', 'Black', 'White', 'Gold', 'Silver', 'Diamond', 'Crystal', 'Star', 'Moon', 'Sun', 'Sky', 'Cloud', 'Rain', 'Storm', 'Thunder', 'Fire', 'Ice', 'Snow', 'Wind', 'Earth', 'Rock', 'Stone', 'Wood', 'Iron', 'Steel', 'Copper', 'Bronze']

def couleur(contraste=None, fond=None):
    while True:
        mode = random.random()
        if mode < 0.25:
            c = random.choice([(0, 0, 0), (255, 255, 255), (20, 20, 20), (240, 240, 240)])
        elif mode < 0.5:
            v = random.randint(0, 255); c = (v, v, v)
        else:
            c = (random.randint(0, 255), random.randint(0, 255), random.randint(0, 255))
        if fond is None or contraste is None:
            return c
        if sum(abs(a - b) for a, b in zip(c, fond)) >= contraste:
            return c

def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]

def fond_image(S):
    r = random.random()
    if r < 0.5:
        c = random.choice([(255, 255, 255), (255, 255, 255), (250, 250, 250), (0, 0, 0), couleur()])
        return Image.new('RGB', (S, S), c), c
    if r < 0.8:
        a, b = couleur(), couleur()
        im = Image.new('RGB', (S, S))
        px = im.load()
        ang = random.random() * math.pi
        cx, cy = math.cos(ang), math.sin(ang)
        for y in range(S):
            for x in range(0, S, 1):
                t = ((x - S / 2) * cx + (y - S / 2) * cy) / S + 0.5
                t = max(0.0, min(1.0, t))
                px[x, y] = tuple(int(a[k] + (b[k] - a[k]) * t) for k in range(3))
        return im, tuple((a[k] + b[k]) // 2 for k in range(3))
    # un fond uni avec une carte (sticker) blanche ou foncée au milieu
    c = couleur()
    im = Image.new('RGB', (S, S), c)
    d = ImageDraw.Draw(im)
    m = random.randint(S // 16, S // 5)
    carte = random.choice([(255, 255, 255), (245, 245, 245), (20, 20, 20)])
    d.rounded_rectangle([m, m, S - m, S - m], radius=random.randint(0, S // 8), fill=carte)
    return im, carte

def forme(d, S, fond):
    k = random.random()
    c = couleur(60, fond)
    x0, y0 = random.randint(0, S - 60), random.randint(0, S - 60)
    w, h = random.randint(40, S // 2), random.randint(40, S // 2)
    x1, y1 = min(S - 1, x0 + w), min(S - 1, y0 + h)
    ep = random.choice([0, 0, 0, 2, 4, 8, 14, 24])
    if k < 0.3:
        if ep and random.random() < 0.6:
            d.ellipse([x0, y0, x1, y1], outline=c, width=ep)
        else:
            d.ellipse([x0, y0, x1, y1], fill=c)
    elif k < 0.55:
        if random.random() < 0.5:
            d.rounded_rectangle([x0, y0, x1, y1], radius=random.randint(0, 60), fill=None if ep and random.random() < 0.5 else c, outline=c if ep else None, width=max(1, ep))
        else:
            d.rectangle([x0, y0, x1, y1], fill=c)
    elif k < 0.75:
        pts = [(random.randint(x0, x1), random.randint(y0, y1)) for _ in range(random.randint(3, 7))]
        d.polygon(pts, fill=c)
    elif k < 0.9:
        d.line([(x0, y0), (x1, y1)] if random.random() < 0.5 else [(x0, y0), (x1, y0)], fill=c, width=random.randint(2, 30))
    else:
        # un anneau avec un jour, une étoile
        n = random.randint(5, 9)
        cx, cy, r = (x0 + x1) / 2, (y0 + y1) / 2, min(x1 - x0, y1 - y0) / 2
        pts = []
        for i in range(2 * n):
            rr = r if i % 2 == 0 else r * random.uniform(0.35, 0.6)
            a = math.pi * i / n
            pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
        d.polygon(pts, fill=c)

def texte(im, S, fond):
    chemin, idx, accents = random.choice(faces)
    taille = int(random.choice([random.randint(30, 70), random.randint(50, 140), random.randint(90, 240)]))
    try:
        f = ImageFont.truetype(chemin, taille, index=idx)
    except Exception:
        return
    sans_accent = lambda m: ''.join(ch for ch in unicodedata.normalize('NFD', m) if unicodedata.category(ch) != 'Mn')
    mot = random.choice(MOTS)
    if random.random() < 0.4:
        mot = mot.upper()
    if random.random() < 0.3:
        mot = mot + ' ' + random.choice(MOTS)
    if not accents:
        mot = sans_accent(mot)
    c = couleur(90, fond)
    d = ImageDraw.Draw(im)
    bb = d.textbbox((0, 0), mot, font=f)
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    if w > S * 0.95:
        return
    x, y = random.randint(0, max(0, S - w)), random.randint(0, max(0, S - h))
    x -= bb[0]; y -= bb[1]
    cerne = random.random() < 0.25
    ombre = random.random() < 0.15
    if ombre:
        dx, dy = random.randint(2, 12), random.randint(2, 12)
        d.text((x + dx, y + dy), mot, font=f, fill=couleur(40, c))
    if cerne:
        ep = random.randint(2, max(3, taille // 10))
        d.text((x, y), mot, font=f, fill=c, stroke_width=ep, stroke_fill=couleur(80, c))
    else:
        d.text((x, y), mot, font=f, fill=c)

S2 = 1024
for i in range(n):
    im, fond = fond_image(S2)
    d = ImageDraw.Draw(im)
    for _ in range(random.randint(0, 4)):
        forme(d, S2, fond)
    for _ in range(random.randint(2, 5)):
        texte(im, S2, fond)
    if random.random() < 0.3:
        forme(ImageDraw.Draw(im), S2, fond)
    # parfois un léger dégradé/vignette sur tout (un doré, un reflet)
    im = im.resize((S2 // 2, S2 // 2), Image.LANCZOS)
    im.save(os.path.join(dossier, f'{i:05d}.png'))
    if i % 200 == 0:
        print(i, flush=True)
print('fini', n)

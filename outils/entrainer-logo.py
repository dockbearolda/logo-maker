"""LE MODÈLE MAISON (12 octobre 2026) : le Compact de Real-ESRGAN (general
x4v3, 1,2 M de paramètres — la même architecture, la même vitesse)
réentraîné sur des logos synthétiques (outils/logos-synthetiques.py)
dégradés comme les fichiers des clients : un flou parfois, une première
réduction-agrandissement (la capture de capture), la réduction ×4 par
divers filtres, un peu de bruit, le JPEG de 28 à 95 (parfois deux fois),
un léger flou après. Perte de Charbonnier pondérée ×4 sur les bords (ce
que le banc mesure). Validation pendant l'entraînement sur les vrais logos
du banc (VALID : les PNG de `_essais/ultra/`, réduits ×4 et passés en JPEG
75 en Python — proche du banc du navigateur, pas identique), le meilleur
sur les bords gardé. Sur un M5 (PyTorch MPS) : ~8 itérations/s.
  VALID=_essais/ultra python outils/entrainer-logo.py <logos> realesr-general-x4v3.pth logo-x4.pth 20000
Variables : BATCH (16), LR (2e-4), VALID. Puis outils/convertir-onnx.py."""
import sys, os, glob, random, io, math, time
import numpy as np
import torch, torch.nn as nn, torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from PIL import Image, ImageFilter
from spandrel import ModelLoader

dossier, depart, sortie = sys.argv[1], sys.argv[2], sys.argv[3]
ITERS = int(sys.argv[4]) if len(sys.argv) > 4 else 20000
BATCH = int(os.environ.get('BATCH', 16))
LR = float(os.environ.get('LR', 2e-4))
VALID = os.environ.get('VALID', '')
HR = 192
dev = torch.device('mps' if torch.backends.mps.is_available() else 'cpu')
torch.manual_seed(1); random.seed(1); np.random.seed(1)

FILTRES = [Image.BOX, Image.BILINEAR, Image.BICUBIC, Image.LANCZOS, Image.HAMMING]

def degrader(hr):
    """hr : PIL RGB (HR). Rend le LR PIL, ×4 plus petit."""
    im = hr
    # un flou, parfois, avant la réduction (le fichier a été agrandi puis réduit, une photo mise au point à côté)
    if random.random() < 0.45:
        im = im.filter(ImageFilter.GaussianBlur(random.uniform(0.3, 2.2)))
    w, h = im.size
    # parfois une première réduction/agrandissement (capture de capture)
    if random.random() < 0.3:
        f = random.uniform(0.6, 1.0)
        im = im.resize((max(8, int(w * f)), max(8, int(h * f))), random.choice(FILTRES)).resize((w, h), random.choice(FILTRES))
    im = im.resize((w // 4, h // 4), random.choice(FILTRES))
    # un peu de bruit, parfois
    if random.random() < 0.25:
        a = np.asarray(im).astype(np.float32)
        a += np.random.normal(0, random.uniform(1, 8), a.shape)
        im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    # le JPEG, presque toujours, parfois deux fois
    for _ in range(1 if random.random() < 0.65 else 2):
        if random.random() < 0.9:
            b = io.BytesIO()
            im.save(b, 'JPEG', quality=random.randint(28, 95), subsampling=random.choice([0, 2, 2]))
            im = Image.open(io.BytesIO(b.getvalue())).convert('RGB')
    # parfois un léger flou après (rééchantillonnage d'une capture)
    if random.random() < 0.2:
        im = im.filter(ImageFilter.GaussianBlur(random.uniform(0.2, 0.7)))
    return im

class Logos(Dataset):
    def __init__(self, fichiers, n):
        self.f = fichiers; self.n = n
    def __len__(self): return self.n
    def __getitem__(self, i):
        im = Image.open(random.choice(self.f)).convert('RGB')
        w, h = im.size
        x, y = random.randint(0, w - HR), random.randint(0, h - HR)
        hr = im.crop((x, y, x + HR, y + HR))
        if random.random() < 0.5: hr = hr.transpose(Image.FLIP_LEFT_RIGHT)
        if random.random() < 0.5: hr = hr.transpose(Image.FLIP_TOP_BOTTOM)
        if random.random() < 0.5: hr = hr.transpose(Image.TRANSPOSE)
        lr = degrader(hr)
        t = lambda p: torch.from_numpy(np.asarray(p).astype(np.float32) / 255).permute(2, 0, 1)
        return t(lr), t(hr)

def bords_de(hr):
    """Les bords de l'image (B×3×H×W, 0–1) : un changement de plus de 24/255 sur deux pixels, élargi de deux."""
    d = hr * 255
    dx = (d[:, :, :, 4:] - d[:, :, :, :-4]).abs().amax(1, keepdim=True)
    dy = (d[:, :, 4:, :] - d[:, :, :-4, :]).abs().amax(1, keepdim=True)
    e = torch.zeros_like(d[:, :1])
    e[:, :, :, 2:-2] = torch.maximum(e[:, :, :, 2:-2], dx)
    e[:, :, 2:-2, :] = torch.maximum(e[:, :, 2:-2, :], dy)
    b = (e > 24).float()
    return F.max_pool2d(b, 5, 1, 2)

def psnr(a, b, m=None):
    d = ((a - b) * 255) ** 2
    if m is not None:
        d = d * m
        n = m.sum() * 3
    else:
        n = d.numel()
    return 10 * math.log10(255 * 255 / (d.sum().item() / n.item() if torch.is_tensor(n) else d.sum().item() / n))

def valider(net, fichiers):
    net.eval()
    tot, bo = [], []
    with torch.no_grad():
        for f in fichiers:
            im = Image.open(f).convert('RGBA')
            fond = Image.new('RGBA', im.size, (255, 255, 255, 255))
            im = Image.alpha_composite(fond, im).convert('RGB')
            w, h = (im.size[0] // 4) * 4, (im.size[1] // 4) * 4
            im = im.crop((0, 0, w, h))
            if max(w, h) > 1600:
                f2 = 1600 / max(w, h)
                w, h = (int(w * f2) // 4) * 4, (int(h * f2) // 4) * 4
                im = im.resize((w, h), Image.LANCZOS)
            lr = im.resize((w // 4, h // 4), Image.LANCZOS)
            b = io.BytesIO(); lr.save(b, 'JPEG', quality=75); lr = Image.open(io.BytesIO(b.getvalue())).convert('RGB')
            x = torch.from_numpy(np.asarray(lr).astype(np.float32) / 255).permute(2, 0, 1)[None].to(dev)
            y = torch.from_numpy(np.asarray(im).astype(np.float32) / 255).permute(2, 0, 1)[None].to(dev)
            # par tuiles de 384 + marge 16, comme l'app
            out = torch.zeros_like(y)
            T, M = 384, 16
            H, W = x.shape[2], x.shape[3]
            for ty in range(0, H, T):
                for tx in range(0, W, T):
                    y0, y1 = max(0, ty - M), min(H, ty + T + M)
                    x0, x1 = max(0, tx - M), min(W, tx + T + M)
                    o = net(x[:, :, y0:y1, x0:x1]).clamp(0, 1)
                    oy, ox = (ty - y0) * 4, (tx - x0) * 4
                    hh, ww = min(T, H - ty) * 4, min(T, W - tx) * 4
                    out[:, :, ty * 4:ty * 4 + hh, tx * 4:tx * 4 + ww] = o[:, :, oy:oy + hh, ox:ox + ww]
            m = bords_de(y)
            tot.append(psnr(out, y)); bo.append(psnr(out, y, m))
    net.train()
    return sum(tot) / len(tot), sum(bo) / len(bo), tot, bo

def main():
    m = ModelLoader().load_from_file(depart)
    net = m.model.to(dev).train()
    print('arch', m.architecture.name, 'params', sum(p.numel() for p in net.parameters()), 'dev', dev)
    fichiers = sorted(glob.glob(os.path.join(dossier, '*.png')))
    print('logos synthétiques', len(fichiers))
    valid = sorted(glob.glob(os.path.join(VALID, '*.png'))) if VALID else []
    if valid:
        a, b, _, _ = valider(net, valid)
        print(f'départ : PSNR {a:.2f} dB, bords {b:.2f} dB', flush=True)
        meilleur = b
    else:
        meilleur = -1
    dl = DataLoader(Logos(fichiers, ITERS * BATCH), batch_size=BATCH, num_workers=6, persistent_workers=True, drop_last=True)
    opt = torch.optim.Adam(net.parameters(), lr=LR, betas=(0.9, 0.99))
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, ITERS, eta_min=1e-6)
    t0 = time.time()
    perte_moy = 0
    for it, (lr, hr) in enumerate(dl, 1):
        lr, hr = lr.to(dev), hr.to(dev)
        out = net(lr)
        w = 1 + 3 * bords_de(hr)
        perte = (torch.sqrt((out - hr) ** 2 + 1e-6) * w).mean()
        opt.zero_grad(set_to_none=True)
        perte.backward()
        opt.step(); sched.step()
        perte_moy = 0.98 * perte_moy + 0.02 * perte.item() if it > 1 else perte.item()
        if it % 100 == 0:
            print(f'{it} perte {perte_moy:.4f} lr {sched.get_last_lr()[0]:.2e} {time.time() - t0:.0f}s', flush=True)
        if it % 1000 == 0 or it == ITERS:
            if valid:
                a, b, tot, bo = valider(net, valid)
                print(f'  validation {it} : PSNR {a:.2f} dB, bords {b:.2f} dB | ' + ' '.join(f'{v:.1f}' for v in bo), flush=True)
                if b > meilleur:
                    meilleur = b
                    torch.save({'params': {k: v.cpu() for k, v in net.state_dict().items()}}, sortie)
                    print('  → gardé', sortie, flush=True)
            else:
                torch.save({'params': {k: v.cpu() for k, v in net.state_dict().items()}}, sortie)
        if it >= ITERS:
            break
    print('fini', time.time() - t0)


if __name__ == '__main__':
    main()

"""Real-ESRGAN en demi-précision pour la carte graphique (vendor/LISEZMOI.md).

1er octobre 2026, « encore plus puissante » : les deux Real-ESRGAN de vendor/
(« anime video v3 » et « general x4v3 ») calculent leurs poids et leurs
couches en float16 — la précision où Real-ESRGAN tourne d'office (`half`) —,
l'entrée et la sortie restent en float32 (mêmes `input` et `output`), le
`Resize` du raccourci aussi. Sur une carte graphique qui calcule en
demi-précision (`shader-f16`), l'Ultra va 1,4 fois plus vite (Apple M) ; mesuré
sur six logos réduits ×4 et passés en JPEG, l'Ultra en huit orientations reste
à ±0,02 dB de la vérité (bords et image), et son dessin à 57–66 dB de celui en
float32. Le processeur (WebAssembly) garde les modèles en float32.

    uv run --with onnx --with onnxconverter-common python outils/realesr-fp16.py
"""
from pathlib import Path

import onnx
from onnxconverter_common import float16

VENDOR = Path(__file__).resolve().parent.parent / 'vendor'
for nom in ['realesr-animevideov3', 'realesr-general-x4v3']:
    m = onnx.load(VENDOR / f'{nom}.onnx')
    m16 = float16.convert_float_to_float16(m, keep_io_types=True, op_block_list=['Resize'])
    onnx.save(m16, VENDOR / f'{nom}-fp16.onnx')
    print(nom, 'fp16')

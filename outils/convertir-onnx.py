"""UN MODÈLE .pth → ONNX (12 octobre 2026) : Real-ESRGAN, Compact, SPAN…
(lu par spandrel), entrée `input` (1 × 3 × H × W, 0–1), sortie `output`,
axes dynamiques, opset 17 — les mêmes noms que les modèles de vendor/ —,
puis une copie en demi-précision (`-fp16.onnx`, entrée et sortie en
float32 comme outils/realesr-fp16.py). Dans un venv : pip install torch
onnx onnxconverter-common spandrel.
  python outils/convertir-onnx.py logo-x4.pth vendor/logo-x4.onnx"""
import sys, torch, onnx
from spandrel import ModelLoader
from onnxconverter_common import float16

src, dst = sys.argv[1], sys.argv[2]
m = ModelLoader().load_from_file(src)
print('arch', m.architecture.name, 'scale', m.scale, 'in', m.input_channels, 'out', m.output_channels)
net = m.model.eval()
x = torch.rand(1, 3, 64, 64)
with torch.no_grad():
    y = net(x)
print('out shape', tuple(y.shape))
torch.onnx.export(net, x, dst, input_names=['input'], output_names=['output'],
                  dynamic_axes={'input': {0: 'n', 2: 'h', 3: 'w'}, 'output': {0: 'n', 2: 'H', 3: 'W'}},
                  opset_version=17, dynamo=False, do_constant_folding=True)
mo = onnx.load(dst)
onnx.checker.check_model(mo)
ops = {}
for n in mo.graph.node: ops[n.op_type] = ops.get(n.op_type, 0) + 1
print('ops', ops)
m16 = float16.convert_float_to_float16(mo, keep_io_types=True)
onnx.save(m16, dst.replace('.onnx', '-fp16.onnx'))
print('écrit', dst, 'et fp16')

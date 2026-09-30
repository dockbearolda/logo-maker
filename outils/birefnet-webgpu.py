"""BiRefNet « lite » pour la carte graphique du navigateur (vendor/LISEZMOI.md).

Le fichier de départ : onnx/model_fp16.onnx de onnx-community/BiRefNet_lite-ONNX
sur Hugging Face (MIT, sha256 d39b897c…). Tel quel, ONNX Runtime Web 1.30 ne le
fait pas tourner sur WebGPU :
- ses `Sum` n'y existent pas (ils partiraient au processeur, avec des tenseurs
  de 400 Mo) : chacun devient une chaîne d'`Add` — le même calcul ;
- ses `Split` en 16 ou 32 morceaux, ses `Concat` de 1 024 entrées dépassent les
  10 tampons qu'un calcul WebGPU a le droit de lire et d'écrire : chacun devient
  un arbre de `Split` ou de `Concat` d'au plus 7 branches — le même résultat.
Puis le fichier se coupe en deux (GitHub refuse un fichier de plus de 100 Mo) ;
lib/detourage-travail.js recolle les morceaux au téléchargement.

    uv run --with onnx --with numpy python outils/birefnet-webgpu.py model_fp16.onnx vendor/birefnet-lite-fp16
"""
import sys
import numpy as np
import onnx
from onnx import helper, numpy_helper

MAX = 8  # entrées + sorties d'un nœud, au plus (WebGPU : 10)

src, dst = sys.argv[1], sys.argv[2]
m = onnx.load(src)
g = m.graph
constantes = {t.name: numpy_helper.to_array(t) for t in g.initializer}
for n in g.node:
    if n.op_type == 'Constant':
        for a in n.attribute:
            if a.name == 'value':
                constantes[n.output[0]] = numpy_helper.to_array(a.t)
compte = [0]


def nom(base):
    compte[0] += 1
    return f'{base}__w{compte[0]}'


def tailles(valeurs, base):
    t = nom(base + '_tailles')
    g.initializer.append(numpy_helper.from_array(np.array(valeurs, dtype=np.int64), t))
    return t


def somme(n):
    entrees, sortie = list(n.input), []
    while len(entrees) > 2:
        suite = []
        for i in range(0, len(entrees) - 1, 2):
            t = nom(n.output[0])
            sortie.append(helper.make_node('Add', entrees[i:i + 2], [t], name=nom(n.name)))
            suite.append(t)
        if len(entrees) % 2:
            suite.append(entrees[-1])
        entrees = suite
    return sortie + [helper.make_node('Add', entrees, [n.output[0]], name=nom(n.name))]


def split(entree, parts, sorties, axe, base):
    if len(sorties) <= MAX - 1:
        return [helper.make_node('Split', [entree, tailles(parts, base)], sorties, name=nom(base), axis=axe)]
    pas = -(-len(sorties) // (MAX - 1))
    groupes = [list(range(i, min(i + pas, len(sorties)))) for i in range(0, len(sorties), pas)]
    inter = [nom(base) for _ in groupes]
    noeuds = [helper.make_node('Split', [entree, tailles([sum(parts[j] for j in gr) for gr in groupes], base)], inter, name=nom(base), axis=axe)]
    for gr, t in zip(groupes, inter):
        if len(gr) == 1:
            noeuds.append(helper.make_node('Identity', [t], [sorties[gr[0]]], name=nom(base)))
        else:
            noeuds += split(t, [parts[j] for j in gr], [sorties[j] for j in gr], axe, base)
    return noeuds


def concat(entrees, sortie, axe, base):
    if len(entrees) <= MAX - 1:
        return [helper.make_node('Concat', entrees, [sortie], name=nom(base), axis=axe)]
    noeuds, inter = [], []
    for i in range(0, len(entrees), MAX - 1):
        t = nom(base)
        inter.append(t)
        noeuds.append(helper.make_node('Concat', entrees[i:i + MAX - 1], [t], name=nom(base), axis=axe))
    return noeuds + concat(inter, sortie, axe, base)


noeuds = []
for n in g.node:
    axe = next((a.i for a in n.attribute if a.name == 'axis'), 0)
    if n.op_type == 'Sum' and len(n.input) >= 2:
        noeuds += somme(n)
    elif n.op_type == 'Split' and len(n.output) + 1 > MAX:
        parts = constantes.get(n.input[1]) if len(n.input) > 1 else None
        if parts is None:
            raise SystemExit('Split sans tailles connues : ' + n.name)
        noeuds += split(n.input[0], [int(x) for x in parts], list(n.output), axe, n.name)
    elif n.op_type == 'Concat' and len(n.input) + 1 > MAX:
        noeuds += concat(list(n.input), n.output[0], axe, n.name)
    else:
        noeuds.append(n)
del g.node[:]
g.node.extend(noeuds)
onnx.checker.check_model(m)
octets = m.SerializeToString()
moitie = len(octets) // 2
for i, morceau in enumerate([octets[:moitie], octets[moitie:]], 1):
    with open(f'{dst}.{i}.onnx', 'wb') as f:
        f.write(morceau)
print(len(octets), 'octets, en deux morceaux')

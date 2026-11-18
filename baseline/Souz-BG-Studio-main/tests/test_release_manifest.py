"""Release manifest guard: deterministic generation and detection of mixed releases."""
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

source = Path(__file__).resolve().parents[1]


def copy_tree(dest):
    for path in source.rglob('*'):
        rel = path.relative_to(source)
        if path.is_file() and not {'.git', 'build', 'ffgl-sdk', '__pycache__'} & set(rel.parts):
            (dest / rel).parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, dest / rel)


def run(tree, *args):
    r = subprocess.run([sys.executable, str(tree / 'tools/verify_release.py'), *args], capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr


with tempfile.TemporaryDirectory() as tmp:
    tree = Path(tmp)
    copy_tree(tree)
    manifest = tree / 'release-manifest.json'
    code, out = run(tree); assert code == 0, out

    # O checkout do Windows pode converter o manifesto commitado para CRLF (autocrlf); o gerador sempre
    # grava LF. Compara-se o conteúdo ignorando só essa conversão e exige-se que a saída seja LF puro.
    original = manifest.read_bytes()
    assert run(tree, '--write')[0] == 0, 'manifest write failed'
    first = manifest.read_bytes()
    assert b'\r' not in first, 'generated manifest must use LF line endings'
    assert first == original.replace(b'\r\n', b'\n'), 'manifest generation is not deterministic'
    assert run(tree, '--write')[0] == 0 and manifest.read_bytes() == first, 'manifest generation is not repeatable'
    assert run(tree)[0] == 0, 'regenerated manifest must verify'
    listed = json.loads(original)
    assert not [n for n in listed if n.startswith('ffgl-sdk/')], 'SDK must not be inventoried'
    assert 'src/PanelPage.h' not in listed and 'web/panel.html' not in listed, 'generated files must not be inventoried'
    assert 'src/BackgroundGen.cpp' in listed and 'shader/10_engines.glsl' in listed

    # No Windows o arquivo já pode estar em CRLF; normaliza para LF antes de converter (evita \r\r\n).
    crlf = tree / 'src/BackgroundGen.cpp'; text = crlf.read_bytes()
    crlf.write_bytes(text.replace(b'\r\n', b'\n').replace(b'\n', b'\r\n')); assert run(tree)[0] == 0, 'CRLF checkout must verify'

    crlf.write_bytes(text + b'// edited\n'); code, out = run(tree)
    assert code != 0 and 'src/BackgroundGen.cpp' in out, out
    crlf.write_bytes(text)

    stray = tree / 'tests/test_from_other_release.py'; stray.write_text('print(1)\n')
    code, out = run(tree); assert code != 0 and 'tests/test_from_other_release.py' in out, out
    stray.unlink()

    gone = tree / 'shader/90_main.glsl'; kept = gone.read_bytes(); gone.unlink()
    code, out = run(tree); assert code != 0 and 'shader/90_main.glsl' in out, out
    gone.write_bytes(kept)

    (tree / 'VERSION').unlink(); code, out = run(tree, '--write')
    assert code != 0 and 'VERSION' in out and manifest.read_bytes() == first, out
print('PASS release manifest: deterministic, CRLF-safe, detects modified, missing and foreign files')

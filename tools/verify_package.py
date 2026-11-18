"""Check all packaged files without changing the installation."""
from pathlib import Path
import hashlib
import json
root = Path(__file__).resolve().parents[1]
manifest = json.loads((root/'package-manifest.json').read_text())
bad = []
for name, expected in manifest.items():
    path = (root/name).resolve()
    if not path.is_relative_to(root) or not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
        bad.append(name)
if bad:
    raise SystemExit('Arquivos ausentes ou alterados: '+', '.join(bad))
print(f'Pacote verificado: {len(manifest)} arquivos integros')

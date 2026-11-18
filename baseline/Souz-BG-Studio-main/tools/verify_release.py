"""Release manifest: fail with exact filenames when a release mixes source versions.

  python tools/verify_release.py           verify (also run by tools/embed_panel.py)
  python tools/verify_release.py --write   regenerate release-manifest.json after intentional edits

The inventory is the canonical build input set. Generated files are excluded because the
build rewrites them; the FFGL SDK is excluded because the build downloads it at a pinned commit.
"""
import hashlib
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
manifest_path = root / 'release-manifest.json'

REQUIRED = [
    '.github/workflows/main.yml', 'CMakeLists.txt', 'VERSION', 'build_windows.bat', 'build_mingw.sh',
    'README.md', 'CHANGELOG.md',
]
PATTERNS = ['shader/*.glsl', 'src/*', 'tests/*', 'tools/*.py', 'tools/*.cpp', 'web/*', 'third_party/glew/*']
GENERATED = {'src/ShaderSource.h', 'src/ParamsGenerated.inc', 'src/PanelSchema.h', 'src/PanelPage.h', 'web/panel.html'}


def digest(path):
    return hashlib.sha256(path.read_bytes().replace(b'\r\n', b'\n')).hexdigest()


def inventory():
    missing = [name for name in REQUIRED if not (root / name).is_file()]
    if missing:
        raise SystemExit('Required release files are missing:\n' + '\n'.join(missing))
    names = set(REQUIRED)
    for pattern in PATTERNS:
        names.update(p.relative_to(root).as_posix() for p in root.glob(pattern)
                     if p.is_file() and '__pycache__' not in p.parts)
    return sorted(names - GENERATED)


def write():
    data = {name: digest(root / name) for name in inventory()}
    manifest_path.write_text(json.dumps(data, indent=2, sort_keys=True) + '\n', encoding='utf-8', newline='\n')
    print(f'Wrote release-manifest.json: {len(data)} files')


def verify():
    expected = json.loads(manifest_path.read_text(encoding='utf-8'))
    forbidden = sorted(n for n in expected if n in GENERATED or n.startswith('ffgl-sdk/'))
    bad = sorted(n for n in expected if not (root / n).is_file() or digest(root / n) != expected[n])
    unlisted = sorted(set(inventory()) - set(expected))
    problems = []
    if forbidden: problems.append('Manifest must not list generated or SDK files:\n' + '\n'.join(forbidden))
    if bad: problems.append('Incomplete or modified release. Upload these files from the same ZIP:\n' + '\n'.join(bad))
    if unlisted: problems.append('Files not part of this release (mixed upload?):\n' + '\n'.join(unlisted))
    if problems:
        raise SystemExit('\n'.join(problems) + '\nAfter intentional edits run: python tools/verify_release.py --write')
    print(f'Release source files verified ({len(expected)} files)')


def main(argv):
    write() if '--write' in argv[1:] else verify()


# Executed at import too: tools/embed_panel.py runs this file through runpy.
main(sys.argv if __name__ == '__main__' else [])

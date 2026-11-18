"""Build an allowlisted source distribution; exclude machine state and proprietary runtimes."""
from pathlib import Path
import hashlib
import json
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
DIRECTORIES = ('app', 'baseline', 'tools', 'docs')
FILES = ('VERSION', 'README.md', 'CHANGELOG.md', 'package.json', 'package-lock.json',
         'INICIAR-STUDIO.bat', 'ENCERRAR-STUDIO.bat', 'PREPARAR-NDI.bat', 'ABRIR-STUDIO.vbs', 'ENCERRAR-STUDIO.vbs', '.gitignore')
EXCLUDED = {'python-libs', '__pycache__', '.git', 'data', 'node_modules'}


def inventory():
    files = [ROOT / name for name in FILES if (ROOT / name).is_file()]
    for directory in DIRECTORIES:
        for path in (ROOT / directory).rglob('*'):
            relative = path.relative_to(ROOT)
            if path.is_file() and not (set(relative.parts) & EXCLUDED) and path.suffix not in ('.pyc', '.log'):
                files.append(path)
    return sorted(set(files))


def build():
    version = (ROOT / 'VERSION').read_text().strip()
    prefix = 'Souz-BG-Studio-vMix-'+version
    destination = ROOT / 'dist' / (prefix+'.zip')
    destination.parent.mkdir(exist_ok=True)
    manifest = {}
    with ZipFile(destination, 'w', ZIP_DEFLATED) as archive:
        for path in inventory():
            relative = path.relative_to(ROOT).as_posix()
            data = path.read_bytes()
            archive.writestr(prefix+'/'+relative, data)
            manifest[relative] = hashlib.sha256(data).hexdigest()
        archive.writestr(prefix+'/package-manifest.json', json.dumps(manifest, indent=2)+'\n')
    with ZipFile(destination) as archive:
        assert len(archive.namelist()) == len(manifest)+1
        for path, expected in manifest.items():
            assert hashlib.sha256(archive.read(prefix+'/'+path)).hexdigest() == expected
    checksum = hashlib.sha256(destination.read_bytes()).hexdigest()
    destination.with_suffix('.zip.sha256').write_text(checksum+'  '+destination.name+'\n')
    print(f'Built and verified: {destination.name} ({len(manifest)} files, {destination.stat().st_size} bytes)')


if __name__ == '__main__':
    build()

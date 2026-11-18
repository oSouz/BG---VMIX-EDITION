"""Build the offline Windows application bundle and installer from pinned inputs."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib
import json
import shutil
import subprocess

ROOT=Path(__file__).resolve().parents[1]
VERSION=(ROOT/'VERSION').read_text().strip()
BUILD=ROOT/'build'
STAGE=BUILD/('windows-'+VERSION)
DIST=ROOT/'dist'


def checksum(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    STAGE.mkdir(parents=True,exist_ok=True)
    DIST.mkdir(exist_ok=True)
    for name in ('app','tools'):
        shutil.copytree(ROOT/name,STAGE/name,dirs_exist_ok=True,ignore=shutil.ignore_patterns('__pycache__','tests','python-libs'))
    for name in ('VERSION','package.json','README.md','CHANGELOG.md','ABRIR-STUDIO.vbs','ENCERRAR-STUDIO.vbs','INICIAR-STUDIO.bat','ENCERRAR-STUDIO.bat'):
        shutil.copy2(ROOT/name,STAGE/name)
    panel=STAGE/'baseline/Souz-BG-Studio-main/web';panel.mkdir(parents=True,exist_ok=True)
    shutil.copy2(ROOT/'baseline/Souz-BG-Studio-main/web/panel.html',panel/'panel.html')
    downloads=BUILD/'downloads'
    node=downloads/'node-v22.23.5-win-x64.zip'
    if checksum(node)!='4a191082e9706866830379d577d2cc8a50c776fcd9436a8d061b063ed0d9a0e3':
        raise SystemExit('Node checksum mismatch')
    with ZipFile(node) as z:
        for name in ('node.exe','LICENSE'):
            dest=STAGE/'runtime/node'/name;dest.parent.mkdir(parents=True,exist_ok=True)
            dest.write_bytes(z.read('node-v22.23.5-win-x64/'+name))
    python=STAGE/'runtime/python';python.mkdir(parents=True,exist_ok=True)
    if hashlib.md5((downloads/'python-3.12.10-embed-amd64.zip').read_bytes()).hexdigest()!='fe8ef205f2e9c3ba44d0cf9954e1abd3':
        raise SystemExit('Python archive does not match the official release checksum')
    with ZipFile(downloads/'python-3.12.10-embed-amd64.zip') as z:
        z.extractall(python)
    (python/'python312._pth').write_text('python312.zip\n.\n../../app/ndi\nimport site\n')
    shutil.copytree(ROOT/'app/ndi/python-libs',STAGE/'app/ndi/python-libs',dirs_exist_ok=True,ignore=shutil.ignore_patterns('__pycache__'))
    redist=STAGE/'redist';redist.mkdir(exist_ok=True)
    shutil.copy2(downloads/'NDI-Runtime.exe',redist/'NDI-Runtime.exe')
    (STAGE/'THIRD-PARTY-NOTICES.txt').write_text('Node.js 22.23.5: runtime/node/LICENSE\nPython 3.12.10: runtime/python/LICENSE.txt\nModernGL 5.12.0 and glcontext 3.1.0: app/ndi/python-libs/*.dist-info/licenses\nNDI Runtime: official unmodified redistributable installer, its own license applies.\nInstaller built with Inno Setup 6.4.3, Copyright Jordan Russell and Martijn Laan, https://jrsoftware.org/\n')
    manifest={p.relative_to(STAGE).as_posix():checksum(p) for p in STAGE.rglob('*') if p.is_file() and p.name!='bundle-manifest.json'}
    (STAGE/'bundle-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    portable=DIST/('Souz-BG-Studio-vMix-Windows-'+VERSION+'.zip')
    with ZipFile(portable,'w',ZIP_DEFLATED) as z:
        for p in STAGE.rglob('*'):
            if p.is_file():z.write(p,'Souz-BG-Studio-vMix/'+p.relative_to(STAGE).as_posix())
    subprocess.run([str(BUILD/'inno/ISCC.exe'),'/Qp','/DAppVersion='+VERSION,'/DStageDir='+str(STAGE),'/DOutputDir='+str(DIST),str(ROOT/'tools/windows-installer.iss')],check=True)
    for file in (portable,DIST/f'Souz-BG-Studio-vMix-Setup-{VERSION}.exe'):
        file.with_suffix(file.suffix+'.sha256').write_text(checksum(file)+'  '+file.name+'\n')
        print(file.name,file.stat().st_size,checksum(file))


if __name__=='__main__':main()

$ErrorActionPreference = 'Stop'
$studioRoot = Split-Path -Parent $PSScriptRoot
try {
    $pythonExecutable = $env:SOUZ_PYTHON
    if (-not $pythonExecutable) {
        try { $pythonExecutable = & py -3.12 -c 'import sys; print(sys.executable)' 2>$null } catch {}
    }
    if (-not $pythonExecutable) { $pythonExecutable = (Get-Command python -ErrorAction Stop).Source }
    & $pythonExecutable -c 'import sys,struct; assert sys.version_info[:2]==(3,12) and struct.calcsize(chr(80))==8'
    if ($LASTEXITCODE -ne 0) { throw 'Instale Python 3.12 x64.' }
    & $pythonExecutable -m pip install -r (Join-Path $studioRoot 'app/ndi/requirements.txt') --target (Join-Path $studioRoot 'app/ndi/python-libs') --upgrade
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar os componentes NDI. Confira a conexao de internet.' }
    & $pythonExecutable (Join-Path $studioRoot 'app/ndi/sender.py') --probe
    if ($LASTEXITCODE -ne 0) { throw 'Instale o runtime oficial NDI: https://ndi.link/NDIRedistV6' }
    $dataDir = Join-Path $studioRoot 'data'
    New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
    @{python=$pythonExecutable} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $dataDir 'local-environment.json') -Encoding UTF8
    Write-Host 'NDI preparado. Encerre e abra novamente o Studio.'
    exit 0
} catch { Write-Host "Preparacao incompleta: $($_.Exception.Message)"; exit 1 }

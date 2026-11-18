$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$downloads=Join-Path $root 'build/downloads'
New-Item -ItemType Directory -Path $downloads -Force | Out-Null
$inputs=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'windows-inputs.json') -Raw | ConvertFrom-Json
foreach ($inputFile in $inputs) {
    $destination=Join-Path $downloads $inputFile.file
    if (-not (Test-Path -LiteralPath $destination)) { Invoke-WebRequest -Uri $inputFile.url -OutFile $destination -UseBasicParsing -TimeoutSec 120 }
    if ((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLower() -ne $inputFile.sha256) { throw "Checksum diferente: $($inputFile.file). Nao executar; revise a versao oficial e o manifesto." }
}
$compilerDir=Join-Path $root 'build/inno'
if (-not (Test-Path -LiteralPath (Join-Path $compilerDir 'ISCC.exe'))) {
    $compiler=Start-Process -FilePath (Join-Path $downloads 'inno-6.4.3.exe') -ArgumentList '/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/CURRENTUSER',('/DIR="'+$compilerDir+'"') -WindowStyle Hidden -PassThru -Wait
    if ($compiler.ExitCode -ne 0) { throw 'Falha ao preparar compilador' }
}
Write-Host 'Componentes verificados e compilador preparado.'

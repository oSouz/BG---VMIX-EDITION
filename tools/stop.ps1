$ErrorActionPreference = 'Stop'
$studioRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'instance.ps1')
$studioData = if (Test-Path -LiteralPath (Join-Path $studioRoot 'runtime/node/node.exe')) { Join-Path $env:LOCALAPPDATA 'Souz/BG-Studio-vMix/data' } else { Join-Path $studioRoot 'data' }
$portFile = Join-Path $studioData 'launcher-port.txt'
$studioPort = if ($env:PORT) { [int]$env:PORT } elseif (Test-Path -LiteralPath $portFile) { [int](Get-Content -LiteralPath $portFile -Raw) } else { 3947 }
try {
    $active = Find-StudioInstance $studioPort
    if ($active) { $studioPort=$active.port; if ($active.dataDir) { $studioData=$active.dataDir } elseif ($active.root) { $studioData=Join-Path $active.root 'data' } }
    $token = (Get-Content -LiteralPath (Join-Path $studioData 'session-token.txt') -Raw).Trim()
    Invoke-RestMethod "http://127.0.0.1:$studioPort/api/shutdown" -Method Post -Headers @{'X-Souz-Token'=$token} -ContentType 'application/json' -Body '{}' -TimeoutSec 5 | Out-Null
    Write-Host 'Studio encerrado. A saida NDI tambem foi parada.'
    exit 0
} catch { Write-Host "Nao foi possivel encerrar: $($_.Exception.Message)"; exit 1 }

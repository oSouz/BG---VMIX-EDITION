param([ValidateSet('check','stop')][string]$Action='check',[string]$Root)
$ErrorActionPreference='Stop'
try {
    $registryDir = if ($env:SOUZ_INSTANCE_DIR) { $env:SOUZ_INSTANCE_DIR } else { Join-Path $env:LOCALAPPDATA 'Souz/BG-Studio-vMix' }
    $file=Join-Path $registryDir 'instance.json'
    if (-not (Test-Path -LiteralPath $file)) { exit 0 }
    $session=Get-Content -LiteralPath $file -Raw | ConvertFrom-Json
    if (-not $session.root -or [System.IO.Path]::GetFullPath($session.root).TrimEnd('\') -ne [System.IO.Path]::GetFullPath($Root).TrimEnd('\')) { exit 0 }
    $port=[int]$session.port
    if ($port -lt 1024 -or $port -gt 65535) { exit 0 }
    $health=Invoke-RestMethod "http://127.0.0.1:$port/health" -TimeoutSec 2
    if ($health.application -ne 'souz-bg-studio-vmix' -or ($session.instanceId -and $health.instanceId -ne $session.instanceId)) { exit 0 }
    if ($Action -eq 'check') { exit 10 }
    $dataDir=if ($session.dataDir) { $session.dataDir } else { Join-Path $Root 'data' }
    $token=(Get-Content -LiteralPath (Join-Path $dataDir 'session-token.txt') -Raw).Trim()
    Invoke-RestMethod "http://127.0.0.1:$port/api/shutdown" -Method Post -Headers @{'X-Souz-Token'=$token} -Body '{}' -TimeoutSec 5 | Out-Null
    Start-Sleep -Seconds 2
    exit 0
} catch { exit 0 }

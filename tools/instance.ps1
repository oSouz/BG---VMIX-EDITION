function Get-StudioRegistryPath {
    $directory = if ($env:SOUZ_INSTANCE_DIR) { $env:SOUZ_INSTANCE_DIR } else { Join-Path $env:LOCALAPPDATA 'Souz\BG-Studio-vMix' }
    return Join-Path $directory 'instance.json'
}
function Get-StudioInstance([int]$Port) {
    if ($Port -lt 1024 -or $Port -gt 65535) { return $null }
    $probe = New-Object System.Net.Sockets.TcpClient
    try {
        $connected = $probe.ConnectAsync('127.0.0.1', $Port)
        if (-not ($connected.Wait(200) -and $probe.Connected)) { return $null }
        $health = Invoke-RestMethod "http://127.0.0.1:$Port/health" -TimeoutSec 1
        if ($health.application -eq 'souz-bg-studio-vmix') {
            return [pscustomobject]@{port=$Port;url="http://127.0.0.1:$Port";version=$health.version;instanceId=$health.instanceId;root=$null}
        }
    } catch {} finally { $probe.Dispose() }
    return $null
}
function Find-StudioInstance([int]$PreferredPort) {
    if (-not $env:PORT) {
        $registry = Get-StudioRegistryPath
        if (Test-Path -LiteralPath $registry) {
            try {
                $saved = Get-Content -LiteralPath $registry -Raw | ConvertFrom-Json
                $active = Get-StudioInstance ([int]$saved.port)
                if ($active -and ((-not $saved.instanceId) -or $saved.instanceId -eq $active.instanceId)) { $active.root=$saved.root; $active | Add-Member -NotePropertyName dataDir -NotePropertyValue $saved.dataDir -Force; return $active }
            } catch {}
        }
    }
    $ports = if ($env:PORT) { @($PreferredPort) } else { @($PreferredPort) + @(3947..3966) }
    foreach ($candidate in ($ports | Select-Object -Unique)) {
        $active = Get-StudioInstance $candidate
        if ($active) { return $active }
    }
    return $null
}
function Save-StudioInstance($Instance) {
    $file = Get-StudioRegistryPath
    New-Item -ItemType Directory -Path (Split-Path -Parent $file) -Force | Out-Null
    $temporary = $file+'.tmp'
    $Instance | ConvertTo-Json | Set-Content -LiteralPath $temporary -Encoding UTF8
    Move-Item -LiteralPath $temporary -Destination $file -Force
}

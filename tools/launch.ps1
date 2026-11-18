param([switch]$NoBrowser,[switch]$ShowErrors)
$ErrorActionPreference = 'Stop'
$studioRoot = Split-Path -Parent $PSScriptRoot
$bundledNode = Join-Path $studioRoot 'runtime/node/node.exe'
if (Test-Path -LiteralPath $bundledNode) {
    $env:SOUZ_DATA_DIR = Join-Path $env:LOCALAPPDATA 'Souz/BG-Studio-vMix/data'
    New-Item -ItemType Directory -Path $env:SOUZ_DATA_DIR -Force | Out-Null
    $env:SOUZ_PYTHON = Join-Path $studioRoot 'runtime/python/python.exe'
    # On the first installed launch, import user files from the previously
    # registered source edition only when the destination file does not exist.
    $previousRegistry = if ($env:SOUZ_INSTANCE_DIR) { Join-Path $env:SOUZ_INSTANCE_DIR 'instance.json' } else { Join-Path $env:LOCALAPPDATA 'Souz/BG-Studio-vMix/instance.json' }
    if (Test-Path -LiteralPath $previousRegistry) {
        try {
            $previous = Get-Content -LiteralPath $previousRegistry -Raw | ConvertFrom-Json
            $previousData = if ($previous.dataDir) { $previous.dataDir } elseif ($previous.root) { Join-Path $previous.root 'data' } else { $null }
            if ($previousData) {
                foreach ($name in @('presets.json','settings.json','session-token.txt')) {
                    $source=Join-Path $previousData $name; $target=Join-Path $env:SOUZ_DATA_DIR $name
                    if ((Test-Path -LiteralPath $source) -and -not (Test-Path -LiteralPath $target)) { Copy-Item -LiteralPath $source -Destination $target }
                }
            }
        } catch {}
    }
}
$studioData = if ($env:SOUZ_DATA_DIR) { $env:SOUZ_DATA_DIR } else { Join-Path $studioRoot 'data' }
. (Join-Path $PSScriptRoot 'instance.ps1')
$launchMutex = New-Object System.Threading.Mutex($false, 'Local\SouzBgStudioVmixLauncher')
$mutexHeld = $false
$portFile = Join-Path $studioData 'launcher-port.txt'
$studioPort = if ($env:PORT) { [int]$env:PORT } elseif (Test-Path -LiteralPath $portFile) { [int](Get-Content -LiteralPath $portFile -Raw) } else { 3947 }
$studioUrl = "http://127.0.0.1:$studioPort"
try {
    $mutexHeld = $launchMutex.WaitOne(15000)
    if (-not $mutexHeld) { throw 'Outra abertura do Studio esta em andamento. Tente novamente.' }
    $nodeExecutable = if (Test-Path -LiteralPath $bundledNode) { $bundledNode } else { (Get-Command node -ErrorAction Stop).Source }
    $nodeVersion = & $nodeExecutable -p 'parseInt(process.versions.node)'
    if ([int]$nodeVersion -lt 22) { throw 'Instale Node.js 22 ou superior.' }
    $active = Find-StudioInstance $studioPort
    $running = $null
    if ($active) { $studioPort=$active.port; $studioUrl=$active.url; $running=[pscustomobject]@{application='souz-bg-studio-vmix';version=$active.version} }
    if ($running.application -ne 'souz-bg-studio-vmix') {
        # Older Studio versions have no health endpoint. A TCP listener is enough
        # to reserve the port; never stop it or launch a competing process there.
        $selected = $false
        for ($offset = 0; $offset -lt 20; $offset++) {
            $candidate = $studioPort + $offset
            $probe = New-Object System.Net.Sockets.TcpClient
            try {
                $connection = $probe.ConnectAsync('127.0.0.1', $candidate)
                $occupied = $connection.Wait(300) -and $probe.Connected
            } catch { $occupied = $false } finally { $probe.Dispose() }
            if (-not $occupied) {
                $studioPort = $candidate
                $studioUrl = "http://127.0.0.1:$studioPort"
                $selected = $true
                break
            }
        }
        if (-not $selected) { throw 'Nenhuma porta local livre foi encontrada.' }
    }
    if ($running.application -ne 'souz-bg-studio-vmix') {
        $localConfig = Join-Path $studioData 'local-environment.json'
        $env:PORT = [string]$studioPort
        if ((-not (Test-Path -LiteralPath $bundledNode)) -and (Test-Path -LiteralPath $localConfig)) {
            $pythonConfig = Get-Content -LiteralPath $localConfig -Raw | ConvertFrom-Json
            if (Test-Path -LiteralPath $pythonConfig.python) { $env:SOUZ_PYTHON = $pythonConfig.python }
        }
        New-Item -ItemType Directory -Path $studioData -Force | Out-Null
        Start-Process -FilePath $nodeExecutable -ArgumentList 'app/server.mjs' -WorkingDirectory $studioRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $studioData "studio-output-$studioPort.log") -RedirectStandardError (Join-Path $studioData "studio-error-$studioPort.log")
        for ($attempt = 0; $attempt -lt 20; $attempt++) {
            Start-Sleep -Milliseconds 250
            try { $running = Invoke-RestMethod "$studioUrl/health" -TimeoutSec 1; break } catch {}
        }
        $active = Get-StudioInstance $studioPort
        if ($active) { $active.root=$studioRoot; $active | Add-Member -NotePropertyName dataDir -NotePropertyValue $studioData -Force }
    }
    if ($running.application -ne 'souz-bg-studio-vmix') { throw "O Studio nao iniciou. Confira studio-error-$studioPort.log; a porta pode estar ocupada ou uma versao anterior pode estar aberta." }
    New-Item -ItemType Directory -Path $studioData -Force | Out-Null
    [System.IO.File]::WriteAllText($portFile, [string]$studioPort)
    if ($active) { Save-StudioInstance $active }
    Write-Host "Studio $($running.version) aberto em $studioUrl"
    $expectedVersion=(Get-Content -LiteralPath (Join-Path $studioRoot 'VERSION') -Raw).Trim()
    if ($running.version -ne $expectedVersion) {
        $updateMessage="A versao $($running.version) ja esta aberta. O pacote $expectedVersion foi instalado, mas nao interrompera essa sessao. Encerre a versao anterior antes de abrir a nova."
        Write-Host $updateMessage
        if ($ShowErrors) { Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show($updateMessage,'Souz BG Studio') | Out-Null }
    }
    if (-not $NoBrowser) { Start-Process $studioUrl }
    exit 0
} catch {
    Write-Host "Nao foi possivel iniciar: $($_.Exception.Message)"
    if ($ShowErrors) { Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show($_.Exception.Message,'Souz BG Studio') | Out-Null }
    exit 1
} finally {
    if ($mutexHeld) { $launchMutex.ReleaseMutex() }
    $launchMutex.Dispose()
}

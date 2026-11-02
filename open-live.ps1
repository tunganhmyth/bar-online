param(
    [ValidateRange(1, 65535)]
    [int]$Port = 8080,
    [switch]$WaitForServer
)

$ErrorActionPreference = 'Stop'
$liveUrl = "http://localhost:$Port/"

if ($WaitForServer) {
    $deadline = [DateTime]::UtcNow.AddSeconds(90)
    $ready = $false
    while ([DateTime]::UtcNow -lt $deadline) {
        try {
            $state = Invoke-RestMethod -Uri "http://localhost:$Port/api/live/state" -TimeoutSec 2
            if ($null -ne $state.connected) { $ready = $true; break }
        }
        catch { }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw "Server did not start at $liveUrl within 90 seconds." }
}

$browserPaths = @(
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
    (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
)
$browserExe = $browserPaths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $browserExe) { throw 'Install Microsoft Edge or Google Chrome to open the live window with autoplay.' }

# A separate profile ensures an existing browser process cannot ignore the flag.
# The normal browser profile and its autoplay preferences are left intact.
$profileDir = Join-Path $PSScriptRoot '.run\live-browser'
New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
$browserArgs = @(
    ('--user-data-dir="' + $profileDir + '"'),
    '--autoplay-policy=no-user-gesture-required',
    '--no-first-run',
    '--no-default-browser-check',
    ('--app=' + $liveUrl)
)
# This is the interactive live window the user sees and controls.
Start-Process -FilePath $browserExe -ArgumentList $browserArgs
Write-Output "Opened live window with music autoplay: $liveUrl"

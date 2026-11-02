param(
    [ValidateSet('run', 'test', 'package')]
    [string]$Task = 'run',
    [ValidateRange(1, 65535)]
    [int]$Port = 8080,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'

# Load the user-level setting even in terminals opened before Java was installed.
if (-not $env:JAVA_HOME) {
    $env:JAVA_HOME = [Environment]::GetEnvironmentVariable('JAVA_HOME', 'User')
}
if (-not $env:JAVA_HOME -or -not (Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin\javac.exe'))) {
    throw 'Install JDK 8 and set JAVA_HOME to its installation directory.'
}

Push-Location $PSScriptRoot
try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw 'Install Node.js 20 or newer to run the TikTok connector.'
    }
    $nodeMajor = [int]((& node --version).TrimStart('v').Split('.')[0])
    if ($nodeMajor -lt 20) { throw 'The TikTok connector requires Node.js 20 or newer.' }
    if (-not (Test-Path -LiteralPath 'node_modules\tiktok-live-connector\package.json') -or
        -not (Test-Path -LiteralPath 'node_modules\three\package.json') -or
        -not (Test-Path -LiteralPath 'node_modules\esbuild\package.json')) {
        & npm.cmd ci --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw 'Could not install TikTok connector dependencies.' }
    }
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Could not build the 3D dance floor.' }
    if ($Task -eq 'test' -or $Task -eq 'package') {
        & npm.cmd test
        if ($LASTEXITCODE -ne 0) { throw 'TikTok connector tests failed.' }
    }
    if ($Task -eq 'run' -and -not $NoBrowser) {
        $browserHelper = Join-Path $PSScriptRoot 'open-live.ps1'
        $browserLog = Join-Path $PSScriptRoot '.run\browser-launch.log'
        New-Item -ItemType Directory -Path (Join-Path $PSScriptRoot '.run') -Force | Out-Null
        $browserLauncher = Start-Process -FilePath 'powershell.exe' -ArgumentList @(
            '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
            ('"' + $browserHelper + '"'), '-Port', $Port, '-WaitForServer'
        ) -WindowStyle Hidden -RedirectStandardOutput $browserLog -RedirectStandardError ($browserLog + '.error') -PassThru
    }
    switch ($Task) {
        'run' { & .\mvnw.cmd '-B' '-ntp' 'spring-boot:run' '-Dspring-boot.run.profiles=local' "-Dspring-boot.run.arguments=--server.port=$Port" }
        'test' { & .\mvnw.cmd '-B' '-ntp' 'test' '-Dspring.profiles.active=local' }
        'package' { & .\mvnw.cmd '-B' '-ntp' 'clean' 'package' '-Dspring.profiles.active=local' }
    }
    if ($LASTEXITCODE -ne 0) {
        throw "Maven failed with exit code $LASTEXITCODE."
    }
}
finally {
    if ($browserLauncher -and -not $browserLauncher.HasExited) {
        Stop-Process -Id $browserLauncher.Id -ErrorAction SilentlyContinue
    }
    Pop-Location
}

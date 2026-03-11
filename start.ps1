# ------------------------------------------------
#  CodeArena - One-click startup script
#  Usage: .\start.ps1
# ------------------------------------------------

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "  ====================================" -ForegroundColor Cyan
Write-Host "       CodeArena  -  Starting          " -ForegroundColor Cyan
Write-Host "  ====================================" -ForegroundColor Cyan
Write-Host ""

# --- Ensure PATH includes Go ---
$machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
$userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
$env:Path = $machinePath + ";" + $userPath

# --- Pre-flight checks ---
function Test-Cmd($cmd) {
    return [bool](Get-Command $cmd -ErrorAction SilentlyContinue)
}

$missing = @()
if (-not (Test-Cmd "go"))     { $missing += "Go (https://go.dev/dl)" }
if (-not (Test-Cmd "node"))   { $missing += "Node.js (https://nodejs.org)" }
if (-not (Test-Cmd "npm"))    { $missing += "npm (comes with Node.js)" }
if (-not (Test-Cmd "docker")) { $missing += "Docker (https://docker.com)" }

if ($missing.Count -gt 0) {
    Write-Host "  [ERROR] Missing required tools:" -ForegroundColor Red
    $missing | ForEach-Object { Write-Host "    - $_" -ForegroundColor Yellow }
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "  [OK] Go      $(go version)" -ForegroundColor Green
Write-Host "  [OK] Node    $(node --version)" -ForegroundColor Green
Write-Host "  [OK] Docker  $(docker --version)" -ForegroundColor Green
Write-Host ""

# --- Install frontend dependencies if needed ---
$nodeModules = Join-Path $root "frontend\node_modules"
if (-not (Test-Path $nodeModules)) {
    Write-Host "  [npm] Installing frontend dependencies..." -ForegroundColor Yellow
    Push-Location (Join-Path $root "frontend")
    npm install 2>&1 | Out-Null
    Pop-Location
    Write-Host "  [OK] Dependencies installed." -ForegroundColor Green
}

# --- Build backend ---
Write-Host "  [go] Building backend..." -ForegroundColor Yellow
$env:CGO_ENABLED = "0"
Push-Location (Join-Path $root "backend")
go build -o codearena.exe . 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERROR] Backend build failed." -ForegroundColor Red
    Pop-Location
    Read-Host "Press Enter to exit"
    exit 1
}
Pop-Location
Write-Host "  [OK] Backend built." -ForegroundColor Green

# --- Start backend (background job) ---
Write-Host "  [>>] Starting backend on http://localhost:8080 ..." -ForegroundColor Yellow
$backendDir = Join-Path $root "backend"
$backendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    & ".\codearena.exe" 2>&1
} -ArgumentList $backendDir

# Wait for backend to be ready (up to 30 seconds)
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try {
        $resp = Invoke-RestMethod -Uri "http://localhost:8080/api/health" -TimeoutSec 2
        if ($resp.status -eq "ok") { $ready = $true; break }
    } catch { }
}

if (-not $ready) {
    Write-Host "  [ERROR] Backend did not start in time." -ForegroundColor Red
    Receive-Job $backendJob 2>&1 | Write-Host -ForegroundColor Red
    Stop-Job $backendJob; Remove-Job $backendJob
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "  [OK] Backend is running." -ForegroundColor Green

# --- Start frontend (background job) ---
Write-Host "  [>>] Starting frontend on http://localhost:5173 ..." -ForegroundColor Yellow
$frontendDir = Join-Path $root "frontend"
$frontendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    npm run dev 2>&1
} -ArgumentList $frontendDir

# Wait for Vite to be ready (up to 20 seconds)
$viteReady = $false
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 1
    try {
        Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 2 -UseBasicParsing | Out-Null
        $viteReady = $true; break
    } catch { }
}

if (-not $viteReady) {
    Write-Host "  [WARN] Frontend may still be starting..." -ForegroundColor Yellow
} else {
    Write-Host "  [OK] Frontend is running." -ForegroundColor Green
}

# --- Open browser ---
Write-Host ""
Write-Host "  ====================================" -ForegroundColor Green
Write-Host "     CodeArena is ready!               " -ForegroundColor Green
Write-Host "     http://localhost:5173              " -ForegroundColor Green
Write-Host "  ====================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Opening browser..." -ForegroundColor Cyan
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "  Press Ctrl+C or close this window to stop all services." -ForegroundColor DarkGray
Write-Host ""

# --- Keep alive and cleanup on exit ---
try {
    while ($true) {
        Start-Sleep -Seconds 5

        if ($backendJob.State -eq "Failed") {
            Write-Host "  [!] Backend crashed:" -ForegroundColor Red
            Receive-Job $backendJob 2>&1 | Write-Host -ForegroundColor Red
            break
        }
        if ($frontendJob.State -eq "Failed") {
            Write-Host "  [!] Frontend crashed:" -ForegroundColor Red
            Receive-Job $frontendJob 2>&1 | Write-Host -ForegroundColor Red
            break
        }
    }
} finally {
    Write-Host ""
    Write-Host "  Shutting down..." -ForegroundColor Yellow
    Stop-Job $backendJob  -ErrorAction SilentlyContinue
    Stop-Job $frontendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob  -ErrorAction SilentlyContinue
    Remove-Job $frontendJob -ErrorAction SilentlyContinue
    Write-Host "  Done. Goodbye!" -ForegroundColor Green
}

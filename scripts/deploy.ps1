# Filya Health Tracker - Deployment Script for Windows
# Usage: .\scripts\deploy.ps1 -RpiHost "pi@raspberrypi.local"

param(
    [Parameter(Mandatory=$true)]
    [string]$RpiHost,

    [string]$RemotePath = "~/filya_schedule"
)

$ErrorActionPreference = "Stop"

Write-Host "Deploying Filya Health Tracker to $RpiHost..." -ForegroundColor Cyan

# Get the project root directory
$ProjectRoot = Split-Path -Parent $PSScriptRoot

# Files to copy (excluding node_modules, .git, etc.)
$FilesToCopy = @(
    "Dockerfile",
    "docker-compose.yml",
    ".dockerignore",
    "package.json",
    "server",
    "client"
)

Write-Host "Step 1: Creating remote directory..." -ForegroundColor Yellow
ssh $RpiHost "mkdir -p $RemotePath"

Write-Host "Step 2: Copying files to Raspberry Pi..." -ForegroundColor Yellow
foreach ($file in $FilesToCopy) {
    $sourcePath = Join-Path $ProjectRoot $file
    if (Test-Path $sourcePath) {
        Write-Host "  Copying $file..."
        scp -r $sourcePath "${RpiHost}:${RemotePath}/"
    }
}

Write-Host "Step 3: Copying database if exists..." -ForegroundColor Yellow
$dbPath = Join-Path $ProjectRoot "server\data\filya.db"
if (Test-Path $dbPath) {
    ssh $RpiHost "mkdir -p $RemotePath/server/data"
    scp $dbPath "${RpiHost}:${RemotePath}/server/data/"
    Write-Host "  Database copied."
} else {
    Write-Host "  No database found, will start fresh."
}

Write-Host "Step 4: Building and starting Docker container..." -ForegroundColor Yellow
ssh $RpiHost "cd $RemotePath && docker-compose up -d --build"

Write-Host "Step 5: Checking status..." -ForegroundColor Yellow
ssh $RpiHost "docker ps | grep filya"

Write-Host ""
Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "Access the app at: http://${RpiHost}:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Yellow
Write-Host "  View logs:    ssh $RpiHost 'cd $RemotePath && docker-compose logs -f'"
Write-Host "  Stop:         ssh $RpiHost 'cd $RemotePath && docker-compose down'"
Write-Host "  Restart:      ssh $RpiHost 'cd $RemotePath && docker-compose restart'"

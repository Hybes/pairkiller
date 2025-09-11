# Pairkiller Installer Build Script
param(
    [switch]$Clean = $false,
    [switch]$Test = $false,
    [switch]$Verbose = $false
)

Write-Host "=== Pairkiller Installer Build ===" -ForegroundColor Green

# Check prerequisites
Write-Host "`nChecking prerequisites..." -ForegroundColor Yellow

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found. Please install Node.js 16+" -ForegroundColor Red
    exit 1
}

# Check npm
try {
    $npmVersion = npm --version
    Write-Host "✓ npm: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ npm not found" -ForegroundColor Red
    exit 1
}

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "✗ package.json not found. Please run from project root." -ForegroundColor Red
    exit 1
}

# Clean if requested
if ($Clean) {
    Write-Host "`nCleaning previous builds..." -ForegroundColor Yellow
    if (Test-Path "dist") {
        Remove-Item -Path "dist" -Recurse -Force
        Write-Host "✓ Removed dist directory" -ForegroundColor Green
    }
    if (Test-Path "build/icons") {
        Remove-Item -Path "build/icons" -Recurse -Force
        Write-Host "✓ Removed build/icons directory" -ForegroundColor Green
    }
}

# Install dependencies
Write-Host "`nInstalling dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ npm install failed" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Dependencies installed" -ForegroundColor Green

# Build icons
Write-Host "`nBuilding icons..." -ForegroundColor Yellow
npm run build:icons
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Icon build failed" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Icons built" -ForegroundColor Green

# Build CSS
Write-Host "`nBuilding CSS..." -ForegroundColor Yellow
npm run build:css
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ CSS build failed" -ForegroundColor Red
    exit 1
}
Write-Host "✓ CSS built" -ForegroundColor Green

# Build Windows installer
Write-Host "`nBuilding Windows installer..." -ForegroundColor Yellow
npm run build:win
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Windows build failed" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Windows installer built" -ForegroundColor Green

# Find the built installer
$installer = Get-ChildItem -Path "dist" -Filter "*Setup*.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if ($installer) {
    Write-Host "`n✓ Installer created: $($installer.Name)" -ForegroundColor Green
    Write-Host "  Location: $($installer.FullName)" -ForegroundColor Cyan
    Write-Host "  Size: $([math]::Round($installer.Length / 1MB, 2)) MB" -ForegroundColor Cyan
    
    # Test installer if requested
    if ($Test) {
        Write-Host "`nTesting installer..." -ForegroundColor Yellow
        & ".\validate-installer.ps1" -InstallerPath $installer.FullName -CleanFirst
    }
} else {
    Write-Host "`n✗ No installer found in dist directory" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Build Complete ===" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "  1. Test the installer: .\validate-installer.ps1" -ForegroundColor White
Write-Host "  2. Run the installer: .\dist\$($installer.Name)" -ForegroundColor White
Write-Host "  3. Check installation: .\check-installation.ps1" -ForegroundColor White
# Pairkiller Release Script
param(
    [string]$Type = "patch",  # patch, minor, major
    [switch]$DryRun = $false,
    [switch]$Local = $false,
    [switch]$SkipTests = $false
)

Write-Host "=== Pairkiller Release Script ===" -ForegroundColor Green

# Validate git status
Write-Host "`nChecking git status..." -ForegroundColor Yellow
$gitStatus = git status --porcelain
if ($gitStatus -and -not $DryRun) {
    Write-Host "✗ Working directory is not clean. Please commit or stash changes." -ForegroundColor Red
    Write-Host "Uncommitted changes:" -ForegroundColor Yellow
    git status --short
    exit 1
}
Write-Host "✓ Working directory is clean" -ForegroundColor Green

# Check current version
$currentVersion = node -p "require('./package.json').version"
Write-Host "Current version: $currentVersion" -ForegroundColor Cyan

# Calculate new version
$versionParts = $currentVersion.Split('.')
$major = [int]$versionParts[0]
$minor = [int]$versionParts[1] 
$patch = [int]$versionParts[2]

switch ($Type) {
    "major" { 
        $major++; $minor = 0; $patch = 0 
    }
    "minor" { 
        $minor++; $patch = 0 
    }
    "patch" { 
        $patch++ 
    }
    default {
        Write-Host "✗ Invalid version type. Use: patch, minor, or major" -ForegroundColor Red
        exit 1
    }
}

$newVersion = "$major.$minor.$patch"
Write-Host "New version will be: $newVersion" -ForegroundColor Green

if ($DryRun) {
    Write-Host "`n🔍 DRY RUN MODE - No changes will be made" -ForegroundColor Yellow
    Write-Host "Would update version from $currentVersion to $newVersion" -ForegroundColor Cyan
    exit 0
}

# Confirm release
if (-not $Local) {
    Write-Host "`n⚠️  This will create a GitHub release with version $newVersion" -ForegroundColor Yellow
    $confirm = Read-Host "Continue? (y/N)"
    if ($confirm -ne 'y' -and $confirm -ne 'Y') {
        Write-Host "Release cancelled" -ForegroundColor Gray
        exit 0
    }
}

# Run tests if not skipped
if (-not $SkipTests) {
    Write-Host "`nRunning tests..." -ForegroundColor Yellow
    
    # Build and test installer
    Write-Host "Building and testing installer..." -ForegroundColor Gray
    & ".\build-installer.ps1" -Clean
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Build failed" -ForegroundColor Red
        exit 1
    }
    
    # Quick validation
    if (Test-Path "dist\Pairkiller-Setup-$currentVersion.exe") {
        Write-Host "✓ Installer built successfully" -ForegroundColor Green
    } else {
        Write-Host "✗ Installer not found" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "⚠️  Skipping tests" -ForegroundColor Yellow
}

if ($Local) {
    Write-Host "`nBuilding local release..." -ForegroundColor Yellow
    
    # Update version in package.json
    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    $packageJson.version = $newVersion
    $packageJson | ConvertTo-Json -Depth 10 | Set-Content "package.json"
    
    # Build release
    npm run release
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Release build failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✓ Local release built successfully!" -ForegroundColor Green
    Write-Host "Version updated to: $newVersion" -ForegroundColor Cyan
    Write-Host "Built files are in the dist/ directory" -ForegroundColor Cyan
    
} else {
    Write-Host "`nCreating GitHub release..." -ForegroundColor Yellow
    
    # Use standard-version for proper changelog and tagging
    Write-Host "Running standard-version..." -ForegroundColor Gray
    npx standard-version --release-as $Type
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ standard-version failed" -ForegroundColor Red
        exit 1
    }
    
    # Push changes and tags
    Write-Host "Pushing to GitHub..." -ForegroundColor Gray
    git push --follow-tags origin main
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Git push failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✓ GitHub release initiated!" -ForegroundColor Green
    Write-Host "Version: $newVersion" -ForegroundColor Cyan
    Write-Host "GitHub Actions will build and create the release automatically." -ForegroundColor Cyan
    Write-Host "Check: https://github.com/hybes/pairkiller/actions" -ForegroundColor Blue
}

Write-Host "`n=== Release Complete ===" -ForegroundColor Green

# Show next steps
if ($Local) {
    Write-Host "`nNext steps:" -ForegroundColor Yellow
    Write-Host "  • Test the installer: .\validate-installer.ps1" -ForegroundColor White
    Write-Host "  • Commit version changes: git add . && git commit -m 'chore: release v$newVersion'" -ForegroundColor White
    Write-Host "  • Push to GitHub: git push" -ForegroundColor White
} else {
    Write-Host "`nNext steps:" -ForegroundColor Yellow
    Write-Host "  • Monitor GitHub Actions: https://github.com/hybes/pairkiller/actions" -ForegroundColor White
    Write-Host "  • Check release page: https://github.com/hybes/pairkiller/releases" -ForegroundColor White
    Write-Host "  • Test downloaded installer when ready" -ForegroundColor White
}
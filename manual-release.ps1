# PowerShell script to manually create GitHub release
param(
    [Parameter(Mandatory=$true)]
    [string]$Version,
    [string]$Message = "Release version $Version"
)

Write-Host "=== Manual GitHub Release Creator ===" -ForegroundColor Green
Write-Host "Creating release for version: $Version" -ForegroundColor Cyan

# Check if GitHub CLI is available
$ghExists = Get-Command "gh" -ErrorAction SilentlyContinue
if (-not $ghExists) {
    Write-Host "✗ GitHub CLI (gh) not found. Please install it from https://cli.github.com/" -ForegroundColor Red
    Write-Host "Alternative: Create release manually at https://github.com/hybes/pairkiller/releases/new" -ForegroundColor Yellow
    exit 1
}

# Check if we're authenticated
try {
    $authStatus = & gh auth status 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Not authenticated with GitHub. Run: gh auth login" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ GitHub CLI authenticated" -ForegroundColor Green
} catch {
    Write-Host "✗ GitHub CLI authentication check failed" -ForegroundColor Red
    exit 1
}

# Build the application locally first
Write-Host "`nBuilding application..." -ForegroundColor Yellow
try {
    & npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed"
    }
    Write-Host "✓ Build completed successfully" -ForegroundColor Green
} catch {
    Write-Host "✗ Build failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Check for required files
$requiredFiles = @(
    "dist/Pairkiller-Setup-$Version.exe",
    "dist/latest.yml"
)

$missingFiles = @()
foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host "✗ Missing required files:" -ForegroundColor Red
    $missingFiles | ForEach-Object { Write-Host "  - $_" -ForegroundColor Gray }
    exit 1
}

# Find all release files
$releaseFiles = @()
$releaseFiles += Get-ChildItem "dist/Pairkiller-Setup-*.exe" | ForEach-Object { $_.FullName }
$releaseFiles += Get-ChildItem "dist/Pairkiller-*-x64.exe" | ForEach-Object { $_.FullName }
$releaseFiles += Get-ChildItem "dist/*.blockmap" | ForEach-Object { $_.FullName }
$releaseFiles += "dist/latest.yml"

Write-Host "`n📦 Files to upload:" -ForegroundColor Yellow
$releaseFiles | ForEach-Object { 
    if (Test-Path $_) {
        $size = (Get-Item $_).Length / 1MB
        Write-Host "  ✓ $_ ($([math]::Round($size, 2)) MB)" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $_ (missing)" -ForegroundColor Red
    }
}

# Create the release
Write-Host "`nCreating GitHub release..." -ForegroundColor Yellow
try {
    $tagName = "v$Version"
    $releaseName = "Release v$Version"
    
    # Check if tag already exists
    $existingTag = & git tag -l $tagName
    if (-not $existingTag) {
        Write-Host "Creating tag $tagName..." -ForegroundColor Yellow
        & git tag -a $tagName -m $Message
        & git push origin $tagName
    }
    
    # Create the release
    $releaseArgs = @(
        "release", "create", $tagName,
        "--title", $releaseName,
        "--notes", $Message,
        "--repo", "hybes/pairkiller"
    )
    
    # Add files to upload
    foreach ($file in $releaseFiles) {
        if (Test-Path $file) {
            $releaseArgs += $file
        }
    }
    
    & gh @releaseArgs
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Release created successfully!" -ForegroundColor Green
        Write-Host "View at: https://github.com/hybes/pairkiller/releases/tag/$tagName" -ForegroundColor Cyan
    } else {
        throw "GitHub CLI command failed"
    }
    
} catch {
    Write-Host "✗ Failed to create release: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "`nManual alternative:" -ForegroundColor Yellow
    Write-Host "1. Go to https://github.com/hybes/pairkiller/releases/new" -ForegroundColor Gray
    Write-Host "2. Tag: v$Version" -ForegroundColor Gray
    Write-Host "3. Title: Release v$Version" -ForegroundColor Gray
    Write-Host "4. Upload the files from the dist/ directory" -ForegroundColor Gray
    exit 1
}

Write-Host "`n=== Release Complete ===" -ForegroundColor Green
Write-Host "✓ Release v$Version created with all files" -ForegroundColor Green
Write-Host "✓ Auto-updater will now detect this version" -ForegroundColor Green
Write-Host "✓ Existing installations will be notified of the update" -ForegroundColor Green

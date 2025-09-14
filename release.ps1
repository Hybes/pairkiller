# PowerShell script to create a new release
param(
    [Parameter(Mandatory=$true)]
    [string]$Version,
    [string]$Message = "Release version $Version"
)

Write-Host "=== Pairkiller Release Script ===" -ForegroundColor Green
Write-Host "Creating release for version: $Version" -ForegroundColor Cyan

# Validate version format
if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    Write-Host "✗ Invalid version format. Use semantic versioning (e.g., 4.6.3)" -ForegroundColor Red
    exit 1
}

# Check if we're in a git repository
if (-not (Test-Path ".git")) {
    Write-Host "✗ Not in a git repository" -ForegroundColor Red
    exit 1
}

# Check for uncommitted changes
$status = git status --porcelain
if ($status) {
    Write-Host "✗ You have uncommitted changes. Please commit or stash them first." -ForegroundColor Red
    Write-Host "Uncommitted files:" -ForegroundColor Yellow
    $status | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    exit 1
}

# Update package.json version
Write-Host "`nUpdating package.json version..." -ForegroundColor Yellow
$packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
$oldVersion = $packageJson.version
$packageJson.version = $Version
$packageJson | ConvertTo-Json -Depth 10 | Set-Content "package.json"

Write-Host "✓ Version updated: $oldVersion → $Version" -ForegroundColor Green

# Commit the version change
Write-Host "`nCommitting version change..." -ForegroundColor Yellow
git add package.json
git commit -m "Bump version to $Version"

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to commit version change" -ForegroundColor Red
    exit 1
}

# Create and push tag
Write-Host "`nCreating git tag..." -ForegroundColor Yellow
git tag -a "v$Version" -m "$Message"

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to create tag" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Tag v$Version created" -ForegroundColor Green

# Push changes and tag
Write-Host "`nPushing to GitHub..." -ForegroundColor Yellow
git push origin main
git push origin "v$Version"

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to push to GitHub" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Release Process Started ===" -ForegroundColor Green
Write-Host "✓ Version bumped to $Version" -ForegroundColor Green
Write-Host "✓ Changes committed and pushed" -ForegroundColor Green
Write-Host "✓ Tag v$Version created and pushed" -ForegroundColor Green
Write-Host "`nGitHub Actions will now:" -ForegroundColor Cyan
Write-Host "  1. Build the application" -ForegroundColor Gray
Write-Host "  2. Create installers for Windows" -ForegroundColor Gray
Write-Host "  3. Create a GitHub release" -ForegroundColor Gray
Write-Host "  4. Upload installers to the release" -ForegroundColor Gray
Write-Host "  5. Update latest.yml for auto-updater" -ForegroundColor Gray
Write-Host "`nCheck the Actions tab on GitHub for progress: https://github.com/hybes/pairkiller/actions" -ForegroundColor Cyan
Write-Host "`n🎉 Release process complete!" -ForegroundColor Green
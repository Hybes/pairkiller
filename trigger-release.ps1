# PowerShell script to manually trigger a GitHub release
param(
    [Parameter(Mandatory=$true)]
    [string]$Version = "4.6.3"
)

Write-Host "=== Manual Release Trigger ===" -ForegroundColor Green
Write-Host "This will trigger a GitHub Action to build and release version: $Version" -ForegroundColor Cyan

# Check if GitHub CLI is available
$ghExists = Get-Command "gh" -ErrorAction SilentlyContinue
if (-not $ghExists) {
    Write-Host "GitHub CLI (gh) not found. Please install it from https://cli.github.com/" -ForegroundColor Yellow
    Write-Host "Alternative: Go to https://github.com/hybes/pairkiller/actions/workflows/release.yml" -ForegroundColor Yellow
    Write-Host "Click 'Run workflow' and enter version: $Version" -ForegroundColor Yellow
    exit 0
}

# Trigger the workflow
Write-Host "`nTriggering GitHub Action..." -ForegroundColor Yellow
try {
    & gh workflow run release.yml --field version=$Version
    Write-Host "✓ Release workflow triggered successfully!" -ForegroundColor Green
    Write-Host "Check progress at: https://github.com/hybes/pairkiller/actions" -ForegroundColor Cyan
} catch {
    Write-Host "✗ Failed to trigger workflow: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Manual alternative: Go to https://github.com/hybes/pairkiller/actions/workflows/release.yml" -ForegroundColor Yellow
    Write-Host "Click 'Run workflow' and enter version: $Version" -ForegroundColor Yellow
}

Write-Host "`n=== Next Steps ===" -ForegroundColor Green
Write-Host "1. Watch the GitHub Action build the release" -ForegroundColor Gray
Write-Host "2. Once complete, existing Pairkiller installations will auto-update" -ForegroundColor Gray
Write-Host "3. New users can download the latest installer from the releases page" -ForegroundColor Gray


# PowerShell script to test the auto-updater functionality
Write-Host "=== Pairkiller Auto-Update Test ===" -ForegroundColor Green

# Check if we have a release on GitHub
Write-Host "`nChecking GitHub releases..." -ForegroundColor Yellow

try {
    $releases = Invoke-RestMethod -Uri "https://api.github.com/repos/hybes/pairkiller/releases"
    $latest = $releases[0]
    
    Write-Host "✓ Latest release found:" -ForegroundColor Green
    Write-Host "  Version: $($latest.tag_name)" -ForegroundColor Cyan
    Write-Host "  Published: $($latest.published_at)" -ForegroundColor Cyan
    Write-Host "  Draft: $($latest.draft)" -ForegroundColor Cyan
    Write-Host "  Prerelease: $($latest.prerelease)" -ForegroundColor Cyan
    
    # Check for required assets
    $requiredAssets = @("latest.yml", ".exe")
    $foundAssets = @()
    
    Write-Host "`n📦 Release assets:" -ForegroundColor Yellow
    foreach ($asset in $latest.assets) {
        Write-Host "  - $($asset.name) ($($asset.size) bytes)" -ForegroundColor Gray
        $foundAssets += $asset.name
    }
    
    # Verify auto-updater requirements
    $hasLatestYml = $foundAssets | Where-Object { $_ -eq "latest.yml" }
    $hasInstaller = $foundAssets | Where-Object { $_ -like "*.exe" -and $_ -like "*Setup*" }
    
    Write-Host "`n🔍 Auto-updater compatibility:" -ForegroundColor Yellow
    if ($hasLatestYml) {
        Write-Host "  ✓ latest.yml found - auto-updater can detect new version" -ForegroundColor Green
    } else {
        Write-Host "  ✗ latest.yml missing - auto-updater won't work" -ForegroundColor Red
    }
    
    if ($hasInstaller) {
        Write-Host "  ✓ Setup installer found - auto-updater can download update" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Setup installer missing - auto-updater can't download" -ForegroundColor Red
    }
    
    if ($latest.draft) {
        Write-Host "  ⚠️  Release is a draft - won't be detected by auto-updater" -ForegroundColor Yellow
    } else {
        Write-Host "  ✓ Release is published - auto-updater will detect it" -ForegroundColor Green
    }
    
    # Check latest.yml content
    if ($hasLatestYml) {
        Write-Host "`n📄 Downloading latest.yml for inspection..." -ForegroundColor Yellow
        $latestYmlUrl = ($latest.assets | Where-Object { $_.name -eq "latest.yml" }).browser_download_url
        $latestYmlContent = Invoke-RestMethod -Uri $latestYmlUrl
        
        Write-Host "latest.yml content:" -ForegroundColor Cyan
        Write-Host $latestYmlContent -ForegroundColor Gray
    }
    
} catch {
    Write-Host "✗ Error checking GitHub releases: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🧪 Testing auto-updater:" -ForegroundColor Yellow
Write-Host "1. Install an older version of Pairkiller" -ForegroundColor Gray
Write-Host "2. Open Settings and look for update notification" -ForegroundColor Gray
Write-Host "3. Or wait for automatic check (happens periodically)" -ForegroundColor Gray
Write-Host "4. Click 'Update' when prompted" -ForegroundColor Gray

Write-Host "`n=== Test Complete ===" -ForegroundColor Green


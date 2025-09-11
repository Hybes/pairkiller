# Pairkiller Complete Cleanup Script
param(
    [switch]$Force = $false,
    [switch]$KeepSettings = $false
)

Write-Host "=== Pairkiller Complete Cleanup ===" -ForegroundColor Red
Write-Host "This will remove ALL Pairkiller installations and data" -ForegroundColor Yellow

if (-not $Force) {
    $confirm = Read-Host "`nAre you sure you want to proceed? (type 'YES' to confirm)"
    if ($confirm -ne 'YES') {
        Write-Host "Cleanup cancelled" -ForegroundColor Gray
        exit 0
    }
}

# Function to safely remove directory
function Remove-SafeDirectory {
    param([string]$Path, [string]$Description)
    
    if (Test-Path $Path) {
        try {
            Write-Host "Removing $Description`: $Path" -ForegroundColor Yellow
            Remove-Item -Path $Path -Recurse -Force -ErrorAction Stop
            Write-Host "✓ Removed $Description" -ForegroundColor Green
        } catch {
            Write-Host "⚠ Could not remove $Description`: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "○ $Description not found: $Path" -ForegroundColor Gray
    }
}

# Stop all Pairkiller processes
Write-Host "`nStopping Pairkiller processes..." -ForegroundColor Yellow
$processes = Get-Process -Name "Pairkiller" -ErrorAction SilentlyContinue
if ($processes) {
    foreach ($proc in $processes) {
        Write-Host "Stopping process PID $($proc.Id)" -ForegroundColor Gray
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 3
    Write-Host "✓ Processes stopped" -ForegroundColor Green
} else {
    Write-Host "○ No running processes found" -ForegroundColor Gray
}

# Remove installation directories
Write-Host "`nRemoving installation directories..." -ForegroundColor Yellow
$installLocations = @(
    @{Path="$env:LOCALAPPDATA\Programs\Pairkiller"; Desc="Main installation"},
    @{Path="$env:APPDATA\Pairkiller"; Desc="AppData installation"},
    @{Path="$env:PROGRAMFILES\Pairkiller"; Desc="Program Files installation"},
    @{Path="$env:PROGRAMFILES(X86)\Pairkiller"; Desc="Program Files (x86) installation"},
    @{Path="$env:TEMP\Pairkiller"; Desc="Temp directory"}
)

foreach ($location in $installLocations) {
    Remove-SafeDirectory -Path $location.Path -Description $location.Desc
}

# Remove shortcuts
Write-Host "`nRemoving shortcuts..." -ForegroundColor Yellow
$shortcuts = @(
    @{Path="$env:USERPROFILE\Desktop\Pairkiller.lnk"; Desc="Desktop shortcut"},
    @{Path="$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Pairkiller"; Desc="Start Menu folder"}
)

foreach ($shortcut in $shortcuts) {
    Remove-SafeDirectory -Path $shortcut.Path -Description $shortcut.Desc
}

# Clean registry entries
Write-Host "`nCleaning registry entries..." -ForegroundColor Yellow

# Remove auto-start
try {
    $runPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
    $autoStart = Get-ItemProperty -Path $runPath -Name "Pairkiller" -ErrorAction SilentlyContinue
    if ($autoStart) {
        Remove-ItemProperty -Path $runPath -Name "Pairkiller" -ErrorAction Stop
        Write-Host "✓ Removed auto-start entry" -ForegroundColor Green
    } else {
        Write-Host "○ Auto-start entry not found" -ForegroundColor Gray
    }
} catch {
    Write-Host "⚠ Could not remove auto-start entry: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Remove main registry key
try {
    $regPath = "HKCU:\Software\Pairkiller"
    if (Test-Path $regPath) {
        if ($KeepSettings) {
            Write-Host "○ Keeping registry settings (KeepSettings flag set)" -ForegroundColor Gray
        } else {
            Remove-Item -Path $regPath -Recurse -Force -ErrorAction Stop
            Write-Host "✓ Removed main registry key" -ForegroundColor Green
        }
    } else {
        Write-Host "○ Main registry key not found" -ForegroundColor Gray
    }
} catch {
    Write-Host "⚠ Could not remove main registry key: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Remove uninstall entries
Write-Host "`nRemoving uninstall entries..." -ForegroundColor Yellow
$uninstallPaths = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Pairkiller",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Pairkiller",
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\{a1b2c3d4-e5f6-7890-abcd-ef1234567890}",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\{a1b2c3d4-e5f6-7890-abcd-ef1234567890}"
)

foreach ($path in $uninstallPaths) {
    try {
        if (Test-Path $path) {
            Remove-Item -Path $path -Recurse -Force -ErrorAction Stop
            Write-Host "✓ Removed uninstall entry: $path" -ForegroundColor Green
        }
    } catch {
        Write-Host "⚠ Could not remove uninstall entry $path`: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# Clean temporary files
Write-Host "`nCleaning temporary files..." -ForegroundColor Yellow
$tempPaths = @(
    "$env:TEMP\Pairkiller*",
    "$env:TEMP\nsis*",
    "$env:TEMP\electron*"
)

foreach ($pattern in $tempPaths) {
    try {
        $items = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue
        if ($items) {
            foreach ($item in $items) {
                Remove-Item -Path $item.FullName -Recurse -Force -ErrorAction SilentlyContinue
            }
            Write-Host "✓ Cleaned temporary files matching: $pattern" -ForegroundColor Green
        }
    } catch {
        # Silently continue for temp file cleanup
    }
}

# Final verification
Write-Host "`nVerifying cleanup..." -ForegroundColor Yellow
$remainingIssues = @()

# Check for remaining processes
$remainingProcesses = Get-Process -Name "Pairkiller" -ErrorAction SilentlyContinue
if ($remainingProcesses) {
    $remainingIssues += "Pairkiller processes still running"
}

# Check for remaining files
foreach ($location in $installLocations) {
    if (Test-Path $location.Path) {
        $remainingIssues += "Directory still exists: $($location.Path)"
    }
}

# Check registry
if (Test-Path "HKCU:\Software\Pairkiller" -and -not $KeepSettings) {
    $remainingIssues += "Registry entries still exist"
}

# Summary
Write-Host "`n=== Cleanup Summary ===" -ForegroundColor Green
if ($remainingIssues.Count -eq 0) {
    Write-Host "✓ Cleanup completed successfully!" -ForegroundColor Green
    Write-Host "Pairkiller has been completely removed from your system." -ForegroundColor Cyan
    Write-Host "`nYou can now:" -ForegroundColor Yellow
    Write-Host "  • Install a fresh copy using the installer" -ForegroundColor White
    Write-Host "  • Build and test a new installer" -ForegroundColor White
} else {
    Write-Host "⚠ Cleanup completed with some remaining items:" -ForegroundColor Yellow
    foreach ($issue in $remainingIssues) {
        Write-Host "  • $issue" -ForegroundColor Yellow
    }
    Write-Host "`nYou may need to:" -ForegroundColor Yellow
    Write-Host "  • Restart your computer to complete cleanup" -ForegroundColor White
    Write-Host "  • Manually remove remaining items" -ForegroundColor White
}

Write-Host "`n=== Cleanup Complete ===" -ForegroundColor Green
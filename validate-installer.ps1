# Comprehensive Pairkiller Installer Validation Script
param(
    [string]$InstallerPath = "",
    [switch]$CleanFirst = $false,
    [switch]$Verbose = $false
)

Write-Host "=== Pairkiller Installer Validation ===" -ForegroundColor Green
Write-Host "Version: 4.6.1" -ForegroundColor Cyan
Write-Host "Date: $(Get-Date)" -ForegroundColor Cyan

# Configuration
$ExpectedInstallPath = "$env:LOCALAPPDATA\Programs\Pairkiller"
$ProductName = "Pairkiller"

# Find installer if not specified
if (-not $InstallerPath -or -not (Test-Path $InstallerPath)) {
    Write-Host "`nSearching for installer..." -ForegroundColor Yellow
    $possibleInstallers = Get-ChildItem -Path "dist" -Filter "*Setup*.exe" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
    if ($possibleInstallers) {
        $InstallerPath = $possibleInstallers[0].FullName
        Write-Host "Found installer: $InstallerPath" -ForegroundColor Green
    } else {
        Write-Host "No installer found in dist/ directory" -ForegroundColor Red
        Write-Host "Please build the installer first: npm run build:win" -ForegroundColor Yellow
        exit 1
    }
}

# Function to check if Pairkiller is running
function Test-PairkillerRunning {
    $processes = Get-Process -Name "Pairkiller" -ErrorAction SilentlyContinue
    return $processes.Count -gt 0
}

# Function to kill Pairkiller processes
function Stop-PairkillerProcesses {
    Write-Host "Stopping Pairkiller processes..." -ForegroundColor Yellow
    Get-Process -Name "Pairkiller" -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2
}

# Function to clean previous installations
function Remove-PreviousInstallations {
    Write-Host "`nCleaning previous installations..." -ForegroundColor Yellow
    
    # Stop processes first
    Stop-PairkillerProcesses
    
    # Remove from possible locations
    $locations = @(
        "$env:LOCALAPPDATA\Programs\Pairkiller",
        "$env:APPDATA\Pairkiller",
        "$env:PROGRAMFILES\Pairkiller",
        "$env:PROGRAMFILES(X86)\Pairkiller"
    )
    
    foreach ($location in $locations) {
        if (Test-Path $location) {
            Write-Host "  Removing: $location" -ForegroundColor Gray
            Remove-Item -Path $location -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
    
    # Clean registry
    Write-Host "  Cleaning registry..." -ForegroundColor Gray
    Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "Pairkiller" -ErrorAction SilentlyContinue
    Remove-Item -Path "HKCU:\Software\Pairkiller" -Recurse -Force -ErrorAction SilentlyContinue
    
    # Clean shortcuts
    Write-Host "  Cleaning shortcuts..." -ForegroundColor Gray
    Remove-Item -Path "$env:USERPROFILE\Desktop\Pairkiller.lnk" -Force -ErrorAction SilentlyContinue
    Remove-Item -Path "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Pairkiller" -Recurse -Force -ErrorAction SilentlyContinue
    
    Write-Host "  ✓ Cleanup completed" -ForegroundColor Green
}

# Function to validate installation
function Test-Installation {
    Write-Host "`nValidating installation..." -ForegroundColor Yellow
    $issues = @()
    
    # Check main executable
    $exePath = Join-Path $ExpectedInstallPath "Pairkiller.exe"
    if (Test-Path $exePath) {
        Write-Host "  ✓ Main executable found: $exePath" -ForegroundColor Green
        
        # Check file version
        try {
            $version = (Get-ItemProperty $exePath).VersionInfo.FileVersion
            Write-Host "    Version: $version" -ForegroundColor Cyan
        } catch {
            Write-Host "    Warning: Could not read version info" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ✗ Main executable missing: $exePath" -ForegroundColor Red
        $issues += "Main executable not found"
    }
    
    # Check uninstaller
    $uninstallerPath = Join-Path $ExpectedInstallPath "Uninstall Pairkiller.exe"
    if (Test-Path $uninstallerPath) {
        Write-Host "  ✓ Uninstaller found" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Uninstaller missing" -ForegroundColor Red
        $issues += "Uninstaller not found"
    }
    
    # Check registry entries
    try {
        $regPath = "HKCU:\Software\Pairkiller"
        if (Test-Path $regPath) {
            Write-Host "  ✓ Registry entries found" -ForegroundColor Green
            $installPath = Get-ItemProperty -Path $regPath -Name "InstallPath" -ErrorAction SilentlyContinue
            if ($installPath) {
                Write-Host "    Install Path: $($installPath.InstallPath)" -ForegroundColor Cyan
            }
        } else {
            Write-Host "  ✗ Registry entries missing" -ForegroundColor Red
            $issues += "Registry entries not found"
        }
    } catch {
        Write-Host "  ✗ Error checking registry: $($_.Exception.Message)" -ForegroundColor Red
        $issues += "Registry check failed"
    }
    
    # Check auto-start
    try {
        $runPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
        $autoStart = Get-ItemProperty -Path $runPath -Name "Pairkiller" -ErrorAction SilentlyContinue
        if ($autoStart) {
            Write-Host "  ✓ Auto-start configured: $($autoStart.Pairkiller)" -ForegroundColor Green
        } else {
            Write-Host "  ✗ Auto-start not configured" -ForegroundColor Red
            $issues += "Auto-start not configured"
        }
    } catch {
        Write-Host "  ✗ Error checking auto-start: $($_.Exception.Message)" -ForegroundColor Red
        $issues += "Auto-start check failed"
    }
    
    # Check shortcuts
    $shortcuts = @(
        "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Pairkiller\Pairkiller.lnk",
        "$env:USERPROFILE\Desktop\Pairkiller.lnk"
    )
    
    $shortcutCount = 0
    foreach ($shortcut in $shortcuts) {
        if (Test-Path $shortcut) {
            Write-Host "  ✓ Shortcut found: $(Split-Path $shortcut -Leaf)" -ForegroundColor Green
            $shortcutCount++
        }
    }
    
    if ($shortcutCount -eq 0) {
        Write-Host "  ✗ No shortcuts found" -ForegroundColor Red
        $issues += "No shortcuts created"
    }
    
    return $issues
}

# Main execution
Write-Host "`nInstaller: $InstallerPath" -ForegroundColor Cyan

# Clean first if requested
if ($CleanFirst) {
    Remove-PreviousInstallations
}

# Check if already running
if (Test-PairkillerRunning) {
    Write-Host "`nWarning: Pairkiller is currently running" -ForegroundColor Yellow
    $response = Read-Host "Stop Pairkiller before installation? (y/n)"
    if ($response -eq 'y' -or $response -eq 'Y') {
        Stop-PairkillerProcesses
    }
}

# Run installer
Write-Host "`nRunning installer..." -ForegroundColor Yellow
Write-Host "Command: Start-Process -FilePath '$InstallerPath' -Wait" -ForegroundColor Gray

try {
    Start-Process -FilePath $InstallerPath -Wait
    Write-Host "✓ Installer completed" -ForegroundColor Green
} catch {
    Write-Host "✗ Installer failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Wait a moment for files to settle
Start-Sleep -Seconds 3

# Validate installation
$issues = Test-Installation

# Summary
Write-Host "`n=== Installation Summary ===" -ForegroundColor Green
if ($issues.Count -eq 0) {
    Write-Host "✓ Installation successful! No issues found." -ForegroundColor Green
    Write-Host "`nYou can now:" -ForegroundColor Cyan
    Write-Host "  • Find Pairkiller in your Start Menu" -ForegroundColor White
    Write-Host "  • Use the Desktop shortcut (if created)" -ForegroundColor White
    Write-Host "  • Pairkiller will auto-start with Windows" -ForegroundColor White
} else {
    Write-Host "✗ Installation completed with issues:" -ForegroundColor Red
    foreach ($issue in $issues) {
        Write-Host "  • $issue" -ForegroundColor Yellow
    }
    Write-Host "`nPlease check the installer configuration and try again." -ForegroundColor Yellow
}

Write-Host "`n=== Validation Complete ===" -ForegroundColor Green
# Enhanced Pairkiller Installation Checker
param(
    [switch]$Detailed = $false,
    [switch]$Fix = $false
)

Write-Host "=== Pairkiller Installation Checker ===" -ForegroundColor Green
Write-Host "Enhanced version with diagnostics and repair options" -ForegroundColor Cyan

# Expected installation path
$expectedPath = "$env:LOCALAPPDATA\Programs\Pairkiller"
$possiblePaths = @(
    $expectedPath,
    "$env:PROGRAMFILES\Pairkiller", 
    "$env:PROGRAMFILES(X86)\Pairkiller",
    "$env:APPDATA\Pairkiller",
    "$env:TEMP\Pairkiller"
)

Write-Host "`nExpected installation path: $expectedPath" -ForegroundColor Cyan

# Check for running processes
Write-Host "`nChecking running processes:" -ForegroundColor Yellow
$runningProcesses = Get-Process -Name "Pairkiller" -ErrorAction SilentlyContinue
if ($runningProcesses) {
    Write-Host "✓ Pairkiller is currently running ($($runningProcesses.Count) process(es))" -ForegroundColor Green
    foreach ($proc in $runningProcesses) {
        Write-Host "  PID: $($proc.Id), Path: $($proc.Path)" -ForegroundColor Cyan
    }
} else {
    Write-Host "○ Pairkiller is not currently running" -ForegroundColor Gray
}

# Check installation directories
Write-Host "`nChecking installation directories:" -ForegroundColor Yellow
$foundInstallations = @()
foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $exe = Join-Path $path "Pairkiller.exe"
        if (Test-Path $exe) {
            Write-Host "✓ Found complete installation: $path" -ForegroundColor Green
            $foundInstallations += $path
            
            if ($Detailed) {
                try {
                    $version = (Get-ItemProperty $exe).VersionInfo.FileVersion
                    $size = [math]::Round((Get-Item $exe).Length / 1MB, 2)
                    Write-Host "  Version: $version, Size: $size MB" -ForegroundColor Cyan
                } catch {
                    Write-Host "  Could not read file details" -ForegroundColor Yellow
                }
            }
        } else {
            Write-Host "⚠ Found directory but missing executable: $path" -ForegroundColor Yellow
        }
    } else {
        Write-Host "○ Not found: $path" -ForegroundColor Gray
    }
}

# Check for multiple installations
if ($foundInstallations.Count -gt 1) {
    Write-Host "`n⚠ WARNING: Multiple installations found!" -ForegroundColor Yellow
    Write-Host "This may cause conflicts. Consider cleaning up old installations." -ForegroundColor Yellow
}

# Check shortcuts
Write-Host "`nChecking shortcuts:" -ForegroundColor Yellow
$shortcuts = @(
    @{Path="$env:USERPROFILE\Desktop\Pairkiller.lnk"; Name="Desktop"},
    @{Path="$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Pairkiller\Pairkiller.lnk"; Name="Start Menu"}
)

$workingShortcuts = 0
foreach ($shortcut in $shortcuts) {
    if (Test-Path $shortcut.Path) {
        # Check if shortcut target exists
        try {
            $shell = New-Object -ComObject WScript.Shell
            $link = $shell.CreateShortcut($shortcut.Path)
            $target = $link.TargetPath
            
            if (Test-Path $target) {
                Write-Host "✓ $($shortcut.Name) shortcut working: $target" -ForegroundColor Green
                $workingShortcuts++
            } else {
                Write-Host "⚠ $($shortcut.Name) shortcut broken (target missing): $target" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "⚠ $($shortcut.Name) shortcut found but could not verify target" -ForegroundColor Yellow
        }
    } else {
        Write-Host "○ $($shortcut.Name) shortcut not found" -ForegroundColor Gray
    }
}

# Check registry entries
Write-Host "`nChecking registry entries:" -ForegroundColor Yellow
$registryIssues = @()

try {
    $regPath = "HKCU:\Software\Pairkiller"
    if (Test-Path $regPath) {
        Write-Host "✓ Found registry key: $regPath" -ForegroundColor Green
        
        $installPath = Get-ItemProperty -Path $regPath -Name "InstallPath" -ErrorAction SilentlyContinue
        if ($installPath) {
            $regInstallPath = $installPath.InstallPath
            Write-Host "  Install Path: $regInstallPath" -ForegroundColor Cyan
            
            # Verify registry path matches actual installation
            if (Test-Path (Join-Path $regInstallPath "Pairkiller.exe")) {
                Write-Host "  ✓ Registry path is valid" -ForegroundColor Green
            } else {
                Write-Host "  ⚠ Registry path is invalid (executable not found)" -ForegroundColor Yellow
                $registryIssues += "Invalid install path in registry"
            }
        } else {
            Write-Host "  ⚠ InstallPath value missing" -ForegroundColor Yellow
            $registryIssues += "Missing InstallPath value"
        }
        
        $version = Get-ItemProperty -Path $regPath -Name "Version" -ErrorAction SilentlyContinue
        if ($version) {
            Write-Host "  Version: $($version.Version)" -ForegroundColor Cyan
        }
    } else {
        Write-Host "○ Registry key not found: $regPath" -ForegroundColor Gray
        $registryIssues += "Missing registry key"
    }
    
    # Check auto-start
    $runPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
    $autoStart = Get-ItemProperty -Path $runPath -Name "Pairkiller" -ErrorAction SilentlyContinue
    if ($autoStart) {
        $autoStartPath = $autoStart.Pairkiller
        Write-Host "✓ Auto-start configured: $autoStartPath" -ForegroundColor Green
        
        # Extract executable path from auto-start command
        $exePath = $autoStartPath -replace '"([^"]+)".*', '$1'
        if (Test-Path $exePath) {
            Write-Host "  ✓ Auto-start path is valid" -ForegroundColor Green
        } else {
            Write-Host "  ⚠ Auto-start path is invalid" -ForegroundColor Yellow
            $registryIssues += "Invalid auto-start path"
        }
    } else {
        Write-Host "○ Auto-start not configured" -ForegroundColor Gray
        $registryIssues += "Auto-start not configured"
    }
} catch {
    Write-Host "✗ Error checking registry: $($_.Exception.Message)" -ForegroundColor Red
    $registryIssues += "Registry access error"
}

# Summary and recommendations
Write-Host "`n=== Installation Summary ===" -ForegroundColor Green

$totalIssues = $registryIssues.Count
if ($foundInstallations.Count -gt 1) { $totalIssues++ }

if ($foundInstallations.Count -eq 0) {
    Write-Host "✗ No valid Pairkiller installation found" -ForegroundColor Red
    Write-Host "`nRecommendations:" -ForegroundColor Yellow
    Write-Host "  • Run the installer: .\dist\Pairkiller-Setup-*.exe" -ForegroundColor White
    Write-Host "  • Or build a new installer: .\build-installer.ps1" -ForegroundColor White
} elseif ($totalIssues -eq 0) {
    Write-Host "✓ Installation appears healthy!" -ForegroundColor Green
    Write-Host "  • Installation found: $($foundInstallations[0])" -ForegroundColor Cyan
    Write-Host "  • Shortcuts working: $workingShortcuts" -ForegroundColor Cyan
    Write-Host "  • Registry entries valid" -ForegroundColor Cyan
} else {
    Write-Host "⚠ Installation found but has $totalIssues issue(s):" -ForegroundColor Yellow
    
    if ($foundInstallations.Count -gt 1) {
        Write-Host "  • Multiple installations detected" -ForegroundColor Yellow
    }
    
    foreach ($issue in $registryIssues) {
        Write-Host "  • $issue" -ForegroundColor Yellow
    }
    
    if ($Fix) {
        Write-Host "`nAttempting to fix issues..." -ForegroundColor Yellow
        # Add fix logic here if needed
        Write-Host "Fix functionality not yet implemented. Please reinstall." -ForegroundColor Gray
    } else {
        Write-Host "`nRecommendations:" -ForegroundColor Yellow
        Write-Host "  • Reinstall using: .\validate-installer.ps1 -CleanFirst" -ForegroundColor White
        Write-Host "  • Or run with -Fix to attempt automatic repair" -ForegroundColor White
    }
}

Write-Host "`n=== Check Complete ===" -ForegroundColor Green

# PowerShell script to set up auto-start for Pairkiller after installation
Write-Host "=== Pairkiller Auto-Start Setup ===" -ForegroundColor Green

# Find Pairkiller installation
$possiblePaths = @(
    "$env:LOCALAPPDATA\Programs\Pairkiller\Pairkiller.exe",
    "$env:APPDATA\Pairkiller\Pairkiller.exe",
    "$env:PROGRAMFILES\Pairkiller\Pairkiller.exe",
    "$env:PROGRAMFILES(X86)\Pairkiller\Pairkiller.exe"
)

$pairkillerPath = $null
foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $pairkillerPath = $path
        Write-Host "✓ Found Pairkiller at: $path" -ForegroundColor Green
        break
    }
}

if (-not $pairkillerPath) {
    Write-Host "✗ Pairkiller not found in any expected location" -ForegroundColor Red
    Write-Host "Expected locations:" -ForegroundColor Yellow
    foreach ($path in $possiblePaths) {
        Write-Host "  - $path" -ForegroundColor Gray
    }
    exit 1
}

# Set up auto-start registry entry
try {
    $registryPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
    $autoStartCommand = "`"$pairkillerPath`" --startup"
    
    Write-Host "`nSetting up auto-start..." -ForegroundColor Yellow
    Write-Host "Registry: $registryPath" -ForegroundColor Cyan
    Write-Host "Command: $autoStartCommand" -ForegroundColor Cyan
    
    Set-ItemProperty -Path $registryPath -Name "Pairkiller" -Value $autoStartCommand
    
    Write-Host "✓ Auto-start configured successfully!" -ForegroundColor Green
    Write-Host "Pairkiller will now start automatically when Windows boots." -ForegroundColor Green
    
} catch {
    Write-Host "✗ Failed to set up auto-start: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Setup Complete ===" -ForegroundColor Green

# Pairkiller Windows Installer System

This document explains the improved Windows installer system for Pairkiller, designed to handle clean installations, proper upgrades, and cleanup of broken/stale versions.

## 🎯 What's Fixed

The new installer system addresses these common issues:

- ✅ **Proper cleanup** of old/broken installations
- ✅ **Consistent install location** (`%LOCALAPPDATA%\Programs\Pairkiller`)
- ✅ **Registry cleanup** before installing new version
- ✅ **Process termination** before installation
- ✅ **Shortcut management** (removes old, creates new)
- ✅ **Auto-start configuration** that actually works
- ✅ **Comprehensive validation** and testing tools

## 🛠️ Scripts Overview

### Core Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `build-installer.ps1` | Build clean installer | `.\build-installer.ps1 -Clean -Test` |
| `validate-installer.ps1` | Test installer thoroughly | `.\validate-installer.ps1 -CleanFirst` |
| `check-installation.ps1` | Verify installation health | `.\check-installation.ps1 -Detailed` |
| `cleanup-pairkiller.ps1` | Complete removal | `.\cleanup-pairkiller.ps1 -Force` |

### Legacy Scripts (Enhanced)

| Script | Purpose | 
|--------|---------|
| `setup-autostart.ps1` | Manual auto-start setup |
| `check-installation.ps1` | Basic installation check |

## 🚀 Quick Start

### 1. Build a Clean Installer

```powershell
# Clean build with testing
.\build-installer.ps1 -Clean -Test

# Just build
.\build-installer.ps1
```

### 2. Test the Installer

```powershell
# Full test with cleanup
.\validate-installer.ps1 -CleanFirst

# Test specific installer
.\validate-installer.ps1 -InstallerPath "dist\Pairkiller-Setup-4.6.1.exe"
```

### 3. Check Installation Health

```powershell
# Basic check
.\check-installation.ps1

# Detailed diagnostics
.\check-installation.ps1 -Detailed
```

### 4. Clean Slate (if needed)

```powershell
# Complete removal
.\cleanup-pairkiller.ps1 -Force

# Keep user settings
.\cleanup-pairkiller.ps1 -Force -KeepSettings
```

## 📋 Installation Process

### What the Installer Does

1. **Pre-Installation Cleanup**
   - Terminates running Pairkiller processes
   - Removes old installation directories
   - Cleans registry entries
   - Removes old shortcuts

2. **Fresh Installation**
   - Installs to `%LOCALAPPDATA%\Programs\Pairkiller`
   - Creates registry entries with version info
   - Sets up auto-start in Windows registry
   - Creates Start Menu and Desktop shortcuts

3. **Post-Installation Verification**
   - Verifies executable exists and is functional
   - Confirms registry entries are correct
   - Validates shortcut targets

### Installation Locations

| Component | Location |
|-----------|----------|
| **Main Installation** | `%LOCALAPPDATA%\Programs\Pairkiller\` |
| **Registry Settings** | `HKCU\Software\Pairkiller` |
| **Auto-start Entry** | `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` |
| **Start Menu** | `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Pairkiller\` |
| **Desktop Shortcut** | `%USERPROFILE%\Desktop\Pairkiller.lnk` |

## 🔧 Configuration Files

### Enhanced NSIS Script (`build/installer.nsh`)

The installer script includes:

- **Process termination** before installation
- **Comprehensive cleanup** of old versions
- **Registry management** with proper error handling
- **Shortcut validation** and recreation
- **Installation verification** with detailed logging

### Package.json Build Configuration

Key improvements in the `nsis` section:

```json
{
  "nsis": {
    "oneClick": false,
    "perMachine": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": "always",
    "uninstallDisplayName": "Pairkiller ${version}",
    "guid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "unicode": true,
    "warningsAsErrors": false
  }
}
```

## 🧪 Testing Workflow

### Recommended Testing Process

1. **Clean Environment**
   ```powershell
   .\cleanup-pairkiller.ps1 -Force
   ```

2. **Build Fresh Installer**
   ```powershell
   .\build-installer.ps1 -Clean
   ```

3. **Test Installation**
   ```powershell
   .\validate-installer.ps1 -CleanFirst
   ```

4. **Verify Health**
   ```powershell
   .\check-installation.ps1 -Detailed
   ```

### Test Scenarios

- ✅ **Fresh installation** on clean system
- ✅ **Upgrade installation** over existing version
- ✅ **Repair installation** over broken version
- ✅ **Multiple version cleanup** 
- ✅ **Process conflict handling**
- ✅ **Registry corruption recovery**

## 🐛 Troubleshooting

### Common Issues and Solutions

#### "Installation disappears after install"
**Cause**: Old installer was deleting files after installation
**Solution**: Use new installer with proper cleanup logic

#### "Multiple versions installed"
**Cause**: Previous installers didn't clean up properly
**Solution**: 
```powershell
.\cleanup-pairkiller.ps1 -Force
.\validate-installer.ps1 -CleanFirst
```

#### "Auto-start doesn't work"
**Cause**: Registry entries pointing to wrong location
**Solution**:
```powershell
.\check-installation.ps1 -Detailed
# If issues found, reinstall:
.\validate-installer.ps1 -CleanFirst
```

#### "Shortcuts are broken"
**Cause**: Shortcuts pointing to old installation location
**Solution**: New installer automatically fixes this

### Diagnostic Commands

```powershell
# Check what's running
Get-Process -Name "Pairkiller" -ErrorAction SilentlyContinue

# Check registry entries
Get-ItemProperty -Path "HKCU:\Software\Pairkiller" -ErrorAction SilentlyContinue

# Check auto-start
Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "Pairkiller" -ErrorAction SilentlyContinue

# Find all installations
Get-ChildItem -Path "$env:LOCALAPPDATA\Programs", "$env:APPDATA", "$env:PROGRAMFILES", "$env:PROGRAMFILES(X86)" -Filter "*Pairkiller*" -Directory -ErrorAction SilentlyContinue
```

## 📊 Validation Reports

The `validate-installer.ps1` script provides comprehensive reports:

### Success Report
```
✓ Installation successful! No issues found.

You can now:
  • Find Pairkiller in your Start Menu
  • Use the Desktop shortcut (if created)
  • Pairkiller will auto-start with Windows
```

### Issue Report
```
✗ Installation completed with issues:
  • Auto-start not configured
  • Desktop shortcut missing

Please check the installer configuration and try again.
```

## 🔄 Upgrade Process

### From Broken Installation

1. **Diagnose current state**
   ```powershell
   .\check-installation.ps1 -Detailed
   ```

2. **Complete cleanup**
   ```powershell
   .\cleanup-pairkiller.ps1 -Force
   ```

3. **Fresh installation**
   ```powershell
   .\validate-installer.ps1
   ```

### From Working Installation

1. **Test new installer**
   ```powershell
   .\validate-installer.ps1 -CleanFirst
   ```

The installer will automatically handle the upgrade process.

## 📝 Development Notes

### Building Installers

Always use the build script for consistent results:

```powershell
# Development build
.\build-installer.ps1

# Release build
.\build-installer.ps1 -Clean -Test
```

### Testing Changes

After modifying installer configuration:

1. Clean build: `.\build-installer.ps1 -Clean`
2. Test in VM or clean environment
3. Validate with all test scripts
4. Document any changes

### Version Management

The installer automatically:
- Reads version from `package.json`
- Updates registry with current version
- Handles version-specific cleanup
- Creates version-tagged installers

## 🎉 Success Criteria

A successful installation should:

- ✅ Install to correct location (`%LOCALAPPDATA%\Programs\Pairkiller`)
- ✅ Create working shortcuts (Start Menu + Desktop)
- ✅ Configure auto-start properly
- ✅ Register in Windows properly
- ✅ Be removable via Windows "Add/Remove Programs"
- ✅ Not leave orphaned files or registry entries
- ✅ Handle upgrades cleanly
- ✅ Work consistently across Windows versions

## 📞 Support

If you encounter issues:

1. Run diagnostics: `.\check-installation.ps1 -Detailed`
2. Try clean installation: `.\cleanup-pairkiller.ps1 -Force` then `.\validate-installer.ps1`
3. Check the build logs and installer output
4. Review this documentation for troubleshooting steps

The new installer system is designed to be robust and self-healing, but these tools provide comprehensive diagnostics and repair capabilities when needed.
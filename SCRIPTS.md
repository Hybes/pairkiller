# Pairkiller Scripts

## PowerShell Scripts

### `release.ps1` ⭐
**Purpose**: Complete release automation
**Usage**: `.\release.ps1 -Version "5.0.2"`
**What it does**:
- Updates package.json version
- Commits changes
- Creates git tag
- Pushes to GitHub
- Triggers GitHub Actions for release

### `validate-installer.ps1` 🔧
**Purpose**: Test installer functionality
**Usage**: `.\validate-installer.ps1`
**What it does**:
- Finds latest installer
- Tests installation process
- Validates auto-start setup
- Checks file placement
- Verifies shortcuts

## Removed Scripts ✅

Cleaned up these unnecessary scripts:
- ❌ `manual-release.ps1` (redundant with release.ps1)
- ❌ `test-autoupdate.ps1` (not needed)
- ❌ `trigger-release.ps1` (redundant)
- ❌ `cleanup-pairkiller.ps1` (installer handles this)
- ❌ `check-installation.ps1` (validate-installer.ps1 covers this)
- ❌ `build-installer.ps1` (npm run build handles this)
- ❌ `setup-autostart.ps1` (installer handles this)

## Quick Release Process

```powershell
# Release new version
.\release.ps1 -Version "5.0.2"

# Test installer (optional)
.\validate-installer.ps1
```

That's it! Clean and simple. 🚀

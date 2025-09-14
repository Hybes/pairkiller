# Pairkiller Release Process

## Automatic GitHub Releases & Auto-Updates

This repository is configured for automatic releases that trigger auto-updates in existing Pairkiller installations.

## 🚀 How to Create a Release

### Option 1: Automated Release (Recommended)
```powershell
# Run the release script with the new version
.\release.ps1 -Version "4.6.3"
```

This script will:
1. ✅ Update `package.json` with the new version
2. ✅ Commit the version change
3. ✅ Create a git tag (e.g., `v4.6.3`)
4. ✅ Push changes and tag to GitHub
5. ✅ Trigger GitHub Actions to build and release

### Option 2: Manual Release
```powershell
# If you just want to trigger a build without changing the version
.\trigger-release.ps1 -Version "4.6.3"
```

### Option 3: GitHub Web Interface
1. Go to [Actions → release.yml](https://github.com/hybes/pairkiller/actions/workflows/release.yml)
2. Click "Run workflow"
3. Enter the version number
4. Click "Run workflow"

## 📦 What Happens During Release

When you create a release, GitHub Actions will:

1. **Build the application** on Windows runner
2. **Create installers** (Setup and Portable versions)
3. **Create a GitHub release** with the tag
4. **Upload installers** to the release
5. **Generate `latest.yml`** for auto-updater
6. **Publish the release** (not draft)

## 🔄 Auto-Update Process

Once a release is published:

1. **Existing installations** check for updates automatically
2. **Users get notified** of available updates
3. **One-click update** downloads and installs the new version
4. **Seamless upgrade** preserves user settings and data

## 📁 Release Assets

Each release includes:
- `Pairkiller-Setup-4.6.3.exe` - Full installer
- `Pairkiller-4.6.3-x64.exe` - Portable version
- `latest.yml` - Auto-updater configuration
- `.blockmap` files - For efficient delta updates

## 🏷️ Version Numbering

Use semantic versioning: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes or major feature updates
- **MINOR**: New features, backward compatible
- **PATCH**: Bug fixes, small improvements

Examples:
- `4.6.3` → `4.6.4` (bug fix)
- `4.6.4` → `4.7.0` (new features)
- `4.7.0` → `5.0.0` (major changes)

## 🔧 Requirements

- Push access to the `hybes/pairkiller` repository
- GitHub Actions enabled
- Windows runner available for building

## 📋 Checklist Before Release

- [ ] Test the application locally
- [ ] Update CHANGELOG.md if needed
- [ ] Ensure all changes are committed
- [ ] No uncommitted changes in working directory
- [ ] Version number follows semantic versioning

## 🎯 Quick Release Commands

```powershell
# For bug fixes (patch version)
.\release.ps1 -Version "4.6.4"

# For new features (minor version)
.\release.ps1 -Version "4.7.0"

# For major updates (major version)
.\release.ps1 -Version "5.0.0"
```

## 🔍 Monitoring Releases

- **GitHub Actions**: https://github.com/hybes/pairkiller/actions
- **Releases Page**: https://github.com/hybes/pairkiller/releases
- **Auto-updater logs**: Check Pairkiller's built-in update system

## 🎉 Success!

Once the release is complete:
1. Existing users will be notified of the update
2. New users can download from the releases page
3. The auto-updater ensures everyone stays current
4. Your improvements reach users automatically!


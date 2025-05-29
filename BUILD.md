# Pairkiller Build Guide

This guide explains how to build Pairkiller for all supported platforms (Windows, macOS, and Linux).

## 🏗️ Build Requirements

### Prerequisites
- **Node.js** 16+ and **npm** 8+
- **ImageMagick** (for icon generation)
  - macOS: `brew install imagemagick`
  - Windows: Download from [ImageMagick website](https://imagemagick.org/script/download.php#windows)
  - Linux: `sudo apt install imagemagick` (Ubuntu/Debian)

### Platform-Specific Requirements

**For Windows builds:**
- Windows 10+ or Windows Server 2016+ (when building on Windows)
- No additional requirements when building on other platforms via CI

**For macOS builds:**
- macOS 10.14+ with Xcode Command Line Tools
- Apple Developer account (for code signing, optional)

**For Linux builds:**
- Build tools: `sudo apt-get install build-essential`
- For Snap packages: `sudo snap install snapcraft --classic`

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Create Icons
```bash
npm run build:icons
```

### 3. Build for Current Platform
```bash
npm run build
```

### 4. Build for All Platforms
```bash
npm run release
```

## 📦 Build Commands

### Icon Generation
```bash
npm run build:icons          # Create all icon formats (.ico, .icns, .png)
npm run build:icons:setup    # Copy base icon to build directory
npm run build:icons:create   # Generate platform-specific icon formats
```

### Platform-Specific Builds
```bash
npm run build:mac            # Build for macOS (DMG + ZIP)
npm run build:win            # Build for Windows (NSIS + Portable)
npm run build:linux          # Build for Linux (AppImage + DEB + Snap)
npm run build:all            # Build for all platforms
```

### Development
```bash
npm run dev                  # Start development mode with hot reload
npm run build:css           # Build Tailwind CSS
npm run watch:css           # Watch CSS changes
```

### Release
```bash
npm run release             # Create icons + build all platforms
npm run bump                # Bump version using standard-version
```

## 📋 Build Outputs

### Windows
- **Installer**: `Pairkiller-{version}-x64.exe` (64-bit NSIS installer)
- **Installer**: `Pairkiller-{version}-ia32.exe` (32-bit NSIS installer)
- **Portable**: `Pairkiller-{version}-x64.exe` (Portable executable)
- **Auto-updater**: `latest.yml` (Update manifest)

### macOS
- **DMG**: `Pairkiller-{version}-x64.dmg` (Intel Macs)
- **DMG**: `Pairkiller-{version}-arm64.dmg` (Apple Silicon)
- **ZIP**: `Pairkiller-{version}-x64.zip` (Intel Macs - ZIP archive)
- **ZIP**: `Pairkiller-{version}-arm64.zip` (Apple Silicon - ZIP archive)
- **Auto-updater**: `latest-mac.yml` (Update manifest)

### Linux
- **AppImage**: `Pairkiller-{version}-x64.AppImage` (Universal Linux)
- **DEB**: `Pairkiller-{version}-x64.deb` (Debian/Ubuntu)
- **Snap**: `Pairkiller-{version}-x64.snap` (Snap package)
- **Auto-updater**: `latest-linux.yml` (Update manifest)

## 🔧 Build Configuration

The build configuration is defined in `package.json` under the `build` section:

### Icon Configuration
- **Windows**: `build/icons/icon.ico` (256x256)
- **macOS**: `build/icons/icon.icns` (multiple resolutions)
- **Linux**: `build/icons/icon.png` (1024x1024)

### Code Signing (Optional)

**macOS:**
```bash
export CSC_IDENTITY_AUTO_DISCOVERY=false  # Disable auto code signing
# OR
export CSC_IDENTITY_AUTO_DISCOVERY=true   # Enable auto code signing
export CSC_NAME="Developer ID Application: Your Name"
```

**Windows:**
```bash
export CSC_LINK="path/to/certificate.p12"
export CSC_KEY_PASSWORD="certificate_password"
```

## 🤖 Automated Builds (GitHub Actions)

The repository includes a comprehensive GitHub Actions workflow that:

1. **Detects version changes** in `package.json`
2. **Builds for all platforms** using a matrix strategy:
   - Windows (x64, ia32)
   - macOS (Intel, Apple Silicon)
   - Linux (x64)
3. **Creates GitHub releases** with all artifacts
4. **Uploads build artifacts** for download

### Triggering Builds

**Automatic:** Push to `main` branch with version change in `package.json`
```bash
npm run bump        # Bump version and create changelog
git push --follow-tags
```

**Manual:** Use workflow dispatch in GitHub Actions tab

### Build Matrix
The CI builds these combinations:
- `windows-latest` → Windows x64 + ia32
- `macos-latest` → macOS x64 + arm64
- `ubuntu-latest` → Linux x64

## 🐛 Troubleshooting

### Common Issues

**Icon generation fails:**
```bash
# Install ImageMagick
brew install imagemagick       # macOS
sudo apt install imagemagick   # Linux
```

**Build fails on macOS:**
```bash
# Install Xcode Command Line Tools
xcode-select --install
```

**Linux build fails:**
```bash
# Install build essentials
sudo apt-get install build-essential
```

**Code signing issues:**
- Disable code signing: `export CSC_IDENTITY_AUTO_DISCOVERY=false`
- Check certificate validity and password

### Build Logs
- Local builds: Check console output
- CI builds: Check GitHub Actions logs
- Artifacts: Available in GitHub Actions for 30 days

## 📊 File Structure

```
build/
├── icons/
│   ├── icon.png      # Base icon (1024x1024)
│   ├── icon.icns     # macOS icon bundle
│   └── icon.ico      # Windows icon (256x256)
├── entitlements.mac.inherit.plist  # macOS entitlements
└── installer.nsh     # NSIS installer customization

dist/                 # Build output directory
├── win-unpacked/     # Windows unpacked app
├── mac/              # macOS app bundle
├── linux-unpacked/   # Linux unpacked app
└── *.{exe,dmg,deb,AppImage,snap,zip}  # Distribution packages
```

## 🎯 Next Steps

1. **Test builds locally** before pushing to CI
2. **Update version** in `package.json` to trigger releases
3. **Create changelog entries** using `npm run bump`
4. **Monitor CI builds** in GitHub Actions
5. **Download artifacts** from GitHub releases

For questions or issues, check the [main README](README.md) or open an issue on GitHub. 
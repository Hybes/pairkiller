# Pairkiller v4.0.0

A modern, intelligent app monitoring and control system that automatically manages your companion applications based on what games you're playing. **Now supports Windows, macOS, and Linux with seamless updates!**

![Pairkiller Logo](icon.png)

## ✨ Features

### 🎯 Smart Monitoring
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Real-time Process Detection**: Monitors running applications with optimized performance
- **Flexible Conditions**: Set rules based on "any" or "all" monitored apps running
- **Process Caching**: Efficient monitoring with intelligent caching to reduce system load

### 🎮 Gaming Focus
- **Pre-built Presets**: Ready-to-use configurations for popular gaming setups
  - League of Legends + Blitz (Windows & macOS)
  - Rocket League + BakkesMod (Windows) / Rocket League Monitor (macOS)
  - Steam Games monitoring (All platforms)
  - Discord Gaming monitor (All platforms)
- **Custom Groups**: Create your own monitoring groups for any applications

### 🚀 Enhanced Performance
- **Parallel Processing**: Concurrent app monitoring and control for better performance
- **Resource Optimization**: Minimal system impact with smart resource management
- **Error Recovery**: Robust error handling and automatic recovery mechanisms
- **Platform-Optimized**: Uses native commands for each operating system

### 🎨 Modern UI/UX
- **Beautiful Interface**: Clean, modern design with smooth animations
- **Dark Theme**: Eye-friendly dark theme throughout the application
- **Responsive Design**: Adapts to different screen sizes and resolutions
- **Interactive Elements**: Tooltips, confirmations, and visual feedback

### 🔧 Advanced Configuration
- **Flexible Actions**: Start, stop, sync, or run opposite to monitored apps
- **Path Detection**: Automatic executable path detection with file browser
- **Cross-Platform Apps**: Supports .exe files on Windows, .app bundles on macOS
- **Validation**: Real-time configuration validation with helpful error messages
- **Backup & Recovery**: Safe configuration management with atomic saves

### 🔄 Seamless Updates
- **Automatic Configuration Migration**: Your settings are automatically migrated when updating from any previous version
- **Safe Update Process**: Configuration backups are created before updates
- **Backward Compatibility**: Supports configuration formats from v1.0.0+ 
- **Update Verification**: Built-in tests ensure migrations work correctly
- **Recovery System**: Automatic backup restoration if configuration becomes corrupted

## 📥 Installation

### Download
Get the latest release from the [GitHub Releases](https://github.com/hybes/pairkiller/releases) page:

- **Windows**: `Pairkiller.Setup.4.0.0.exe`
- **macOS**: `Pairkiller-4.0.0.dmg` (Intel & Apple Silicon)
- **Linux**: `Pairkiller-4.0.0.AppImage`

### Platform-Specific Installation

#### Windows
1. Download `Pairkiller.Setup.4.0.0.exe`
2. Run the installer and follow the setup wizard
3. The app will start automatically and appear in your system tray

#### macOS
1. Download `Pairkiller-4.0.0.dmg`
2. Open the DMG file and drag Pairkiller to your Applications folder
3. Launch Pairkiller from Applications or Spotlight
4. You may need to allow the app in System Preferences > Security & Privacy

#### Linux
1. Download `Pairkiller-4.0.0.AppImage`
2. Make it executable: `chmod +x Pairkiller-4.0.0.AppImage`
3. Run the AppImage: `./Pairkiller-4.0.0.AppImage`

### Quick Start
1. Launch the application (it will start in the system tray)
2. Right-click the tray icon and select "Settings"
3. Choose a preset or create your own app group
4. Save and let Pairkiller manage your apps automatically!

## 🎮 Usage Examples

### League of Legends + Blitz

**Windows:**
Monitor when League of Legends is running and automatically start/stop Blitz accordingly.
- **Monitored Apps:** `LeagueClient.exe`, `League of Legends.exe`
- **Controlled Apps:** `Blitz.exe` (Start/Stop with League)

**macOS:**
- **Monitored Apps:** `League of Legends`, `LeagueClient`
- **Controlled Apps:** `Blitz` (Start/Stop with League)

### Rocket League + BakkesMod

**Windows:**
Automatically manage BakkesMod when playing Rocket League.
- **Monitored Apps:** `RocketLeague.exe`
- **Controlled Apps:** `BakkesMod.exe` (Sync with Rocket League)

**macOS:**
Monitor Rocket League for companion app management.
- **Monitored Apps:** `RocketLeague`
- **Controlled Apps:** Add your preferred companion apps

### Cross-Platform Steam Monitor
Works on all platforms to monitor Steam and manage gaming apps.
- **Windows:** Monitors `steam.exe`
- **macOS:** Monitors `Steam`
- **Linux:** Monitors `steam`

## ⚙️ Platform Differences

### Process Detection
- **Windows**: Uses `tasklist` for process detection
- **macOS**: Uses `pgrep` and `ps` with fallback to AppleScript for .app bundles
- **Linux**: Uses `pgrep` and `ps` for process detection

### App Launching
- **Windows**: Direct executable launching
- **macOS**: Uses `open` command for .app bundles, direct execution for binaries
- **Linux**: Background process launching with `&`

### File Types
- **Windows**: Supports `.exe`, `.bat`, `.cmd` files
- **macOS**: Supports `.app` bundles and executables
- **Linux**: Supports all executable files

## 🔧 Development

### Prerequisites
- Node.js 16+
- npm 8+
- ImageMagick (for icon generation)

### Setup
```bash
# Clone the repository
git clone https://github.com/hybes/pairkiller.git
cd pairkiller

# Install dependencies
npm install

# Build CSS
npm run build:css

# Run in development mode
npm run dev
```

### Building for Distribution

For detailed build instructions and cross-platform compilation, see **[BUILD.md](BUILD.md)**.

**Quick commands:**
```bash
npm run build:icons     # Generate all icon formats
npm run build:mac       # Build for macOS
npm run build:win       # Build for Windows  
npm run build:linux     # Build for Linux
npm run build:all       # Build for all platforms
npm run release         # Icons + all platforms
```

### Platform-Specific Development

#### Windows Development
Requires Windows 10+ for full functionality testing.

#### macOS Development
Requires macOS 10.14+ and Xcode Command Line Tools:
```bash
xcode-select --install
```

#### Linux Development
Requires development packages:
```bash
# Ubuntu/Debian
sudo apt-get install build-essential

# RHEL/CentOS/Fedora
sudo yum groupinstall "Development Tools"
```

## 🐛 Troubleshooting

### Platform-Specific Issues

#### Windows
**Q: Pairkiller isn't detecting my app**
A: Make sure you're using the correct process name (e.g., `notepad.exe`). Check Task Manager for the exact process name.

#### macOS
**Q: Can't detect Mac applications**
A: Try using just the app name without ".app" (e.g., "Steam" instead of "Steam.app"). For some apps, you may need to use the actual process name.

**Q: Permission denied when starting apps**
A: Check System Preferences > Security & Privacy > Privacy > Automation and ensure Pairkiller has the necessary permissions.

#### Linux
**Q: AppImage won't run**
A: Ensure the file is executable (`chmod +x Pairkiller.AppImage`) and that you have FUSE installed.

### Common Issues

**Q: Controlled app isn't starting**
A: Verify the path to the executable is correct. Use the "Browse" button to select the file.

**Q: High CPU usage**
A: Increase the monitoring interval in settings to reduce frequency of checks.

### Debug Mode
Run with debug mode for detailed logging:
```bash
npm run dev
```

### Logs
- **Windows**: `%APPDATA%/Pairkiller/logs/`
- **macOS**: `~/Library/Logs/Pairkiller/`
- **Linux**: `~/.config/Pairkiller/logs/`

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Ben Hybert**
- GitHub: [@hybes](https://github.com/hybes)
- Twitter: [@hybes](https://twitter.com/hybes)
- Email: ben@cnnct.uk

## 🙏 Acknowledgments

- Originally created because Fraser wanted Blitz to only run with League of Legends
- Built with [Electron](https://electronjs.org/) for cross-platform compatibility
- UI styled with [Tailwind CSS](https://tailwindcss.com/)
- Icons by [Font Awesome](https://fontawesome.com/)

## 📊 Stats

![GitHub release](https://img.shields.io/github/v/release/hybes/pairkiller)
![GitHub downloads](https://img.shields.io/github/downloads/hybes/pairkiller/total)
![GitHub stars](https://img.shields.io/github/stars/hybes/pairkiller)
![GitHub issues](https://img.shields.io/github/issues/hybes/pairkiller)
![GitHub license](https://img.shields.io/github/license/hybes/pairkiller)

---

<div align="center">
Made with ❤️ for the gaming community across all platforms
</div>

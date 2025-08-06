# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [4.6.1](https://github.com/hybes/pairkiller/compare/v4.5.1...v4.6.1) (2025-08-06)

## [4.0.0](https://github.com/hybes/pairkiller/compare/v3.2.0...v4.0.0) (2024-11-26)

### ✨ Features

**Seamless Update System**
- **Configuration Migration**: Automatic migration of settings from any previous version (v1.0.0+)
- **Backup System**: Automatic configuration backups before updates with recovery functionality
- **Enhanced Auto-Updater**: Improved error handling with network retry and graceful fallbacks
- **Update Safety**: Pre-installation checks and validation to ensure successful updates
- **Migration Testing**: Built-in test suite to verify configuration migrations work correctly

**Compatibility Improvements**
- Full backward compatibility with all previous configuration formats
- Automatic detection and migration of legacy `apps` array to new `appGroups` structure
- Preserved user settings during updates (monitoring intervals, UI preferences, etc.)
- Intelligent recovery from corrupted configurations using backup system

**Developer Experience**
- Added comprehensive migration test suite (`npm run test:migration`)
- Enhanced build validation in CI/CD pipeline
- Improved error logging and debugging capabilities
- Better Sentry integration for update-related issues

### 🔧 Technical Changes

- Added `configVersion` tracking for precise migration control
- Implemented atomic configuration saving to prevent corruption
- Enhanced error handling for network issues during updates
- Added automatic cleanup of old configuration backups (keeps last 5)
- Improved GitHub Actions workflow with compatibility testing

### [3.2.0](https://github.com/hybes/pairkiller/compare/v3.1.1...v3.2.0) (2024-11-26)

### [3.1.1](https://github.com/hybes/pairkiller/compare/v3.1.0...v3.1.1) (2024-11-26)

## [3.1.0](https://github.com/hybes/pairkiller/compare/v3.0.0...v3.1.0) (2024-11-26)

## [3.0.0](https://github.com/hybes/pairkiller/compare/v2.2.0...v3.0.0) (2024-11-26)

## [2.2.0](https://github.com/hybes/pairkiller/compare/v2.1.1...v2.2.0) (2024-11-25)

### [2.1.1](https://github.com/hybes/pairkiller/compare/v2.1.0...v2.1.1) (2024-11-25)

## [2.1.0](https://github.com/hybes/pairkiller/compare/v2.0.6...v2.1.0) (2024-11-25)

### [2.0.6](https://github.com/hybes/pairkiller/compare/v2.0.5...v2.0.6) (2024-11-25)

### [2.0.5](https://github.com/hybes/pairkiller/compare/v2.0.4...v2.0.5) (2024-11-25)

### [2.0.4](https://github.com/hybes/pairkiller/compare/v2.0.3...v2.0.4) (2024-11-25)

### [2.0.3](https://github.com/hybes/pairkiller/compare/v2.0.2...v2.0.3) (2024-11-25)

### [2.0.2](https://github.com/hybes/pairkiller/compare/v2.0.1...v2.0.2) (2024-11-25)

### [2.0.1](https://github.com/hybes/pairkiller/compare/v1.8.0...v2.0.1) (2024-11-25)

### [1.7.3](https://github.com/Hybes/pairkiller/compare/v1.7.2...v1.7.3) (2023-11-08)

### [1.7.2](https://github.com/Hybes/pairkiller/compare/v1.7.1...v1.7.2) (2023-11-08)

### [1.7.1](https://github.com/Hybes/pairkiller/compare/v1.7.0...v1.7.1) (2023-11-08)

### [1.6.10](https://github.com/Hybes/pairkiller/compare/v1.6.9...v1.6.10) (2023-10-23)

### [1.6.9](https://github.com/Hybes/pairkiller/compare/v1.6.8...v1.6.9) (2023-08-29)

### [1.6.8](https://github.com/Hybes/pairkiller/compare/v1.6.7...v1.6.8) (2023-08-23)

### [1.6.7](https://github.com/Hybes/pairkiller/compare/v1.6.6...v1.6.7) (2023-08-22)

### [1.6.6](https://github.com/Hybes/pairkiller/compare/v1.6.5...v1.6.6) (2023-08-22)

### [1.6.5](https://github.com/Hybes/pairkiller/compare/v1.0.0...v1.6.5) (2023-08-22)

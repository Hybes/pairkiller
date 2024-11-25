# Pairkiller

<p align="center">
  <img src="icon.png" width="128" height="128" alt="Pairkiller Logo">
</p>

<h3 align="center">A Powerful App Monitoring and Control System</h3>

<p align="center">
  <a href="#key-features">Key Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#how-to-use">How To Use</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#download">Download</a>
</p>

## Key Features

* **Dynamic App Monitoring** - Monitor multiple applications and respond to their states
* **Flexible Group Configuration** - Create groups with different monitoring conditions
* **Smart Actions** - Multiple action types for controlled apps:
  - Start when triggered
  - Stop when triggered
  - Sync with trigger (run alongside)
  - Opposite of trigger (run inversely)
* **Reverse Logic** - Invert any group's behavior with a single click
* **System Tray Integration** - Runs quietly in your system tray
* **Auto-Updates** - Always stay up to date with the latest features
* **Cross Platform** - Windows support, with macOS and Linux coming soon

## Installation

Download the latest version from the [releases page](https://github.com/hybes/pairkiller/releases) and run the installer.

## How to Use

1. **Create a Group**
   - Click "Add New Group"
   - Give your group a name
   - Choose monitoring condition (All or Any)
   - Optionally enable reverse logic

2. **Add Monitored Apps**
   - Click "Add App" in the Monitored Apps section
   - Browse to select your application
   - Repeat for all apps you want to monitor

3. **Add Controlled Apps**
   - Click "Add App" in the Controlled Apps section
   - Browse to select your application
   - Choose the desired action:
     * Start when triggered
     * Stop when triggered
     * Sync with trigger
     * Opposite of trigger

4. **Save and Run**
   - Click "Save & Close"
   - The app will run in your system tray
   - Right-click the tray icon for options

## Configuration

### Group Settings
- **Name**: Identify your group
- **Condition**: Choose between:
  * All apps must be running
  * Any app must be running
- **Reverse Logic**: Invert the condition

### App Actions
- **Start when triggered**: Launches the app when condition is met
- **Stop when triggered**: Closes the app when condition is met
- **Sync with trigger**: Runs alongside monitored apps
- **Opposite of trigger**: Runs inverse to monitored apps

## Development

```bash
# Clone this repository
git clone https://github.com/hybes/pairkiller

# Install dependencies
npm install

# Run the app
npm start

# Build the app
npm run build
```

## License

MIT

## Credits

Created by [Ben Hybert](https://github.com/hybes)

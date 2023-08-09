---

# Blitz for League Monitor

An Electron-based application that automatically starts the Blitz app when the League of Legends client or game is running and closes Blitz when they are not. 

## Features

- Monitors the presence of both the `LeagueClient.exe` (the launcher) and `League of Legends.exe` (the game client).
- Automatically launches the Blitz app when either of the League processes is detected.
- Closes the Blitz app when neither of the League processes is active.
- System tray interface for easy toggling of monitoring and setting the Blitz executable path.
- Option to start the application on system boot.

## Installation

### Downloading from Releases

1. Go to the [Releases](https://github.com/Hybes/blitz-for-league-only/releases) section of the GitHub repository.
2. Download the latest release for your platform (Windows).
3. Install the application by following the on-screen instructions.

### Handling Windows SmartScreen

When installing applications downloaded from the internet, Windows SmartScreen might show a warning. This is a security feature to help protect against unrecognized or malicious applications. To continue the installation:

1. Click on "More Info".
2. Select "Run Anyway".
3. Follow the installation prompts.

### Building from Source

1. Clone the repository:
   ```
   git clone https://github.com/Hybes/blitz-for-league-only.git
   ```

2. Navigate to the project directory:
   ```
   cd blitz-for-league-only
   ```

3. Install the necessary dependencies:
   ```
   npm install
   ```

4. Build the application:
   ```
   npm run build
   ```

5. The built application will be available in the `dist` folder.

## Usage

1. Start the application. An icon will appear in the system tray.
2. Right-click on the system tray icon to access the options:
   - **Toggle Monitoring**: Start or stop the automatic monitoring of the League processes.
   - **Set Blitz Path**: If you have a custom installation path for Blitz, use this option to select the Blitz executable.
   - **Start on Boot**: Enable or disable starting the application automatically when your system boots.

## Safety and Anti-virus

The application performs simple monitoring tasks and doesn't engage in any behaviors that would typically trigger anti-virus software. However, always ensure that you download the application from the official GitHub repository or trusted sources.

## Contributing

Contributions are welcome! Please fork the repository and create a pull request with your changes, or open an issue to discuss potential improvements or bug fixes.

---

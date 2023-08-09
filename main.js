const fs = require('fs');
const { app, BrowserWindow, Menu, Tray, dialog } = require('electron');
const path = require('path');
const { exec } = require('child_process');

let tray = null;
let win = null;
let monitoring = true;
const defaultBlitzPath = path.join(app.getPath('home'), 'AppData', 'Local', 'Programs', 'Blitz', 'Blitz.exe');
let blitzPath = defaultBlitzPath;

const configPath = path.join(app.getPath('userData'), 'config.json');

// Load configuration if it exists
if (fs.existsSync(configPath)) {
    const configData = JSON.parse(fs.readFileSync(configPath));
    blitzPath = configData.blitzPath || blitzPath;
}

function updateTrayMenu() {
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Toggle Monitoring',
            type: 'checkbox',
            checked: monitoring,
            click: () => {
                monitoring = !monitoring;
                if (monitoring) {
                    startMonitoring();
                }
                updateTrayMenu();
            }
        },
        {
            label: 'Set Blitz Path',
            click: () => {
                let paths = dialog.showOpenDialogSync(win, {
                    properties: ['openFile'],
                    title: 'Select Blitz Executable',
                    filters: [{ name: 'Executables', extensions: ['exe'] }]
                });

                if (paths && paths.length > 0) {
                    blitzPath = paths[0];

                    // Save to configuration
                    fs.writeFileSync(configPath, JSON.stringify({ blitzPath }));
                }
            },
      },
      {
        label: 'Start on Boot',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: () => {
            const startOnBoot = !app.getLoginItemSettings().openAtLogin;
            app.setLoginItemSettings({
                openAtLogin: startOnBoot
            });
            updateTrayMenu();  // Update the tray menu to reflect the change
        }
    },
        {
            label: 'Quit',
            click: () => {
                app.quit();
            }
        }
    ]);
    tray.setContextMenu(contextMenu);
}

function createWindow() {
    win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
        },
        show: false,
    });
    win.loadFile('index.html');
}

app.whenReady().then(() => {
    tray = new Tray(path.join(__dirname, 'icon.png'));
  updateTrayMenu(); // Use the function to set up the tray menu
  if (monitoring) {
    startMonitoring();
}
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

function startMonitoring() {
  setInterval(() => {
    if (monitoring) {
          console.log('Checking for LeagueClient.exe and League of Legends.exe...');

          exec('tasklist /nh /fi "imagename eq LeagueClient.exe" | find /i "LeagueClient.exe"', (error, stdout) => {
              if (stdout.includes('LeagueClient.exe')) {
                  console.log('LeagueClient.exe found.');
                  ensureBlitzIsRunning();
              } else {
                  console.log('LeagueClient.exe not found.');

                  // If LeagueClient isn't found, check for the game client
                  exec('tasklist /nh /fi "imagename eq League of Legends.exe" | find /i "League of Legends.exe"', (errorGame, stdoutGame) => {
                      if (stdoutGame.includes('League of Legends.exe')) {
                          console.log('League of Legends.exe found.');
                          ensureBlitzIsRunning();
                      } else {
                          console.log('League of Legends.exe not found.');

                          // If neither the game client nor the launcher is running, close Blitz if it is running
                          exec('tasklist /nh /fi "imagename eq Blitz.exe" | find /i "Blitz.exe"', (errorBlitz, stdoutBlitz) => {
                              if (stdoutBlitz.includes('Blitz.exe')) {
                                  console.log('Killing Blitz.exe...');
                                  exec('taskkill /im Blitz.exe /f');
                              } else {
                                  console.log('Blitz.exe is not running.');
                              }
                          });
                      }
                  });
              }
          });
      }
  }, 3000); // Adjust the interval as needed
}

function ensureBlitzIsRunning() {
  exec('tasklist /nh /fi "imagename eq Blitz.exe" | find /i "Blitz.exe"', (errorBlitz, stdoutBlitz) => {
      if (!stdoutBlitz.includes('Blitz.exe')) {
          console.log('Blitz.exe not found. Opening Blitz...');
          exec('start "" "' + blitzPath + '"');
      } else {
          console.log('Blitz.exe is already running.');
      }
  });
}
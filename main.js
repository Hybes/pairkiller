const fs = require('fs');
const { app, BrowserWindow, Menu, Tray, dialog, shell, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const configPath = path.join(app.getPath('userData'), 'config.json');
const defaultBlitzPath = path.join(app.getPath('home'), 'AppData', 'Local', 'Programs', 'Blitz', 'Blitz.exe');

let tray = null;
let win = null;
let monitoring = true;
let blitzPath = defaultBlitzPath;

if (fs.existsSync(configPath)) {
    const configData = JSON.parse(fs.readFileSync(configPath));
    blitzPath = configData.blitzPath || blitzPath;
}

function updateTrayMenu() {
    const appVersion = app.getVersion();
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
        label: 'Start on Boot',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: () => {
            const startOnBoot = !app.getLoginItemSettings().openAtLogin;
            app.setLoginItemSettings({
                openAtLogin: startOnBoot
            });
            updateTrayMenu();
        }
        },
        {
            label: 'About',
            click: () => {
                openAboutWindow();
            }
        },
        {
            label: 'Check for updates',
            click: () => {
                shell.openExternal('https://github.com/Hybes/blitz-for-league-only/releases');
            }
        },
        {
            label: `Version: ${appVersion}`,
            enabled: false
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

ipcMain.on('open-link', (event, url) => {
    shell.openExternal(url);
});

function openAboutWindow() {
    let aboutWindow = new BrowserWindow({
        icon: path.join(__dirname, 'icon.png'),
        autoHideMenuBar: true,
        width: 700,
        height: 360,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            preload: path.join(__dirname, 'preload.js'),
        },
        resizable: false,
        title: "About"
    });
    aboutWindow.loadFile('about.html');
}

app.whenReady().then(() => {
    tray = new Tray(path.join(__dirname, 'icon.png'));
    updateTrayMenu(); // Use the function to set up the tray menu
    tray.on('click', () => {
        openAboutWindow();
    });
    if (monitoring) {
    startMonitoring();
}
});

app.on('window-all-closed', (e) => {
    e.preventDefault();
    if (process.platform !== 'darwin') {
        return;
    }
});

function startMonitoring() {
    setInterval(() => {
    if (monitoring) {
        exec('tasklist /nh /fi "imagename eq LeagueClient.exe" | find /i "LeagueClient.exe"', (error, stdout) => {
            if (stdout.includes('LeagueClient.exe')) {
                ensureBlitzIsRunning();
            } else {
                  // If LeagueClient isn't found, check for the game client
                exec('tasklist /nh /fi "imagename eq League of Legends.exe" | find /i "League of Legends.exe"', (errorGame, stdoutGame) => {
                    if (stdoutGame.includes('League of Legends.exe')) {
                        ensureBlitzIsRunning();
                    } else {

                          // If neither the game client nor the launcher is running, close Blitz if it is running
                        exec('tasklist /nh /fi "imagename eq Blitz.exe" | find /i "Blitz.exe"', (errorBlitz, stdoutBlitz) => {
                            if (stdoutBlitz.includes('Blitz.exe')) {
                                exec('taskkill /im Blitz.exe /f');
                            } else {
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
            exec('start "" "' + blitzPath + '"');
        } else {
        }
    });
}
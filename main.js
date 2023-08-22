const fs = require('fs');
const { app, BrowserWindow, Menu, Tray, shell, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const util = require('util');
const fetch = require('node-fetch')
const exec = util.promisify(require('child_process').exec);
const Sentry = require('@sentry/electron');

const configPath = path.join(app.getPath('userData'), 'config.json');
const defaultBlitzPath = path.join(app.getPath('home'), 'AppData', 'Local', 'Programs', 'Blitz', 'Blitz.exe');
require('dotenv').config();

const LEAGUE_CLIENT = 'LeagueClient.exe';
const LEAGUE_GAME = 'League of Legends.exe';
const BLITZ_APP = 'Blitz.exe';

let mainWindow;
let tray = null;
let monitoring = true;
let updateWindow;
let config = {
    blitzPath: defaultBlitzPath,
    anonymousUsage: true
};

if (process.env.NODE_ENV !== 'development') {
    Sentry.init({
        dsn: 'https://83d267b1eff14ce29e39bd6c58b05bc8@error.brth.uk/1',
    });
};

process.on('unhandledRejection', (reason, promise) => {
    Sentry.captureException(reason);
});

process.on('uncaughtException', (error) => {
    Sentry.captureException(error);
});

if (fs.existsSync(configPath)) {
    try {
        const fileData = fs.readFileSync(configPath, 'utf8');
        const loadedConfig = JSON.parse(fileData);
        config = { ...config, ...loadedConfig };
    } catch (error) {
        console.error('Error reading configuration:', error);
    }
}
else {
    // It's the first time the app is being started. Set it to start on boot by default.
    app.setLoginItemSettings({
        openAtLogin: true
    });
}

ipcMain.on('open-link', (event, url) => {
    shell.openExternal(url);
});
ipcMain.on('toggle-usage-collection', (event, value) => {
    config.anonymousUsage = value;
    fs.writeFileSync(configPath, JSON.stringify(config));
});
ipcMain.handle('get-usage-collection', (event) => {
    return config.anonymousUsage;
});
ipcMain.on('install-update', () => {
    // This will quit and install the update, ensuring the app is updated
    autoUpdater.quitAndInstall();
});
ipcMain.on('check-for-updates', () => {
    if (process.env.NODE_ENV === 'development') {
        // Mock response for development
        setTimeout(() => {
            mainWindow.webContents.send('update-status', 'not-available');
        }, 1000); // Simulate a delay for checking updates
    } else {
        autoUpdater.checkForUpdates();
    }
});
ipcMain.on('close-update-window', () => {
    if (updateWindow) {
        updateWindow.close();
    }
});

autoUpdater.setFeedURL({
    provider: 'github',
    repo: 'blitz-for-league-only',
    owner: 'Hybes'
});
autoUpdater.on('checking-for-update', () => {
    openUpdateWindow();
    console.log('Checking for update...');
});
autoUpdater.on('update-available', (info) => {
    if (updateWindow) {
        updateWindow.webContents.send('update-status', 'Update available. Downloading...');
    }
});
autoUpdater.on('update-downloaded', (info) => {
    if (updateWindow) {
        updateWindow.webContents.send('update-status', 'Update downloaded. Installing...');
    }
    setTimeout(() => {
        autoUpdater.quitAndInstall();
    }, 500);
});
autoUpdater.on('update-not-available', () => {
    if (updateWindow) {
        updateWindow.webContents.send('update-status', 'You have the latest version.');
        setTimeout(() => {
            updateWindow.close();
        }, 500);
    }
});
autoUpdater.on('error', (err) => {
    if (updateWindow) {
        Sentry.captureException(error);
        updateWindow.webContents.send('update-status', 'Error: ' + err.message);
    }
});
autoUpdater.on('download-progress', (progressObj) => {
    if (updateWindow) {
        updateWindow.webContents.send('update-progress', progressObj.percent);
    }
    console.log(`Downloaded ${progressObj.percent}%`);
});

async function isTaskRunning(taskName) {
    if (!taskName) {
        Sentry.captureException(error);
        console.error('Error: taskName is not provided or is undefined');
        return false;
    }

    try {
        const { stdout } = await exec(`tasklist /nh /fi "imagename eq ${taskName}" | find /i "${taskName}"`);
        return stdout.includes(taskName);
    } catch (error) {
        if (!error.stdout || !error.stderr) {
            return false;
        }
        Sentry.captureException(error);
        console.error(`Error checking task ${taskName}:`, error);
        return false;
    }
}
async function ensureBlitzIsRunning() {
    const isBlitzRunning = await isTaskRunning(BLITZ_APP);
    if (!isBlitzRunning) {
        exec(`"${config.blitzPath}"`, (error) => {
            if (error) {
                Sentry.captureException(error);
                console.error("Error starting Blitz:", error);
            }
        });
    }
}
async function startMonitoring() {
    setInterval(async () => {
        if (monitoring) {
            try {
                const isLeagueClientRunning = await isTaskRunning(LEAGUE_CLIENT);
                const isLeagueOfLegendsRunning = await isTaskRunning(LEAGUE_GAME);
                const isBlitzRunning = await isTaskRunning(BLITZ_APP);

                if (isLeagueClientRunning || isLeagueOfLegendsRunning) {
                    await ensureBlitzIsRunning();
                } else if (!isLeagueClientRunning && !isLeagueOfLegendsRunning && isBlitzRunning) {
                    exec('taskkill /im Blitz.exe /f', (errorKill) => {
                        if (errorKill) {
                            console.error("Error killing Blitz:", errorKill);
                        }
                    });
                }
            } catch (error) {
                Sentry.captureException(error);
                console.error("Error during monitoring:", error);
            }
        }
    }, 3000);
}
async function sendWebhook() {
    if (config.anonymousUsage) {
        try {
            const response = await fetch('https://automate.connectdorset.com/webhook/bflo-collector', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: 'app-started' })
            });
            Sentry.captureMessage('Webhook Sent for Stats', {
                level: 'info',
                extra: {
                    endpoint: 'https://automate.connectdorset.com/webhook/bflo-collector',
                    method: 'POST',
                },
            });

            if (!response.ok) {
                console.error('Webhook error:', response.statusText);
            }
        } catch (error) {
            Sentry.captureException(error);
            console.error('Webhook error:', error);
        }
    }
}
async function killLeagueProcesses() {
    try {
        await exec('taskkill /im "League of Legends.exe" /f');
        await exec('taskkill /im "LeagueClient.exe" /f');
        Sentry.captureMessage('User killed League manually', {
            level: 'info',
            extra: {
                feature: 'killLeagueProcess',
            },
        });

        console.log("Successfully killed League processes.");
    } catch (error) {
        Sentry.captureException(error);
        console.error("Error killing League processes:", error);
    }
}
function setupTray() {
    tray = new Tray(path.join(__dirname, 'icon.png'));
    updateTrayMenu();
    tray.on('click', openMainWindow);
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
                Sentry.captureMessage('User accessed feature X', {
                    level: 'info',
                    extra: {
                        feature: 'toggleStartOnBoot',
                    },
                });
            }
        },
        {
            label: 'Force Kill League',
            click: killLeagueProcesses
        },
        {
            label: 'About',
            click: () => {
                openMainWindow();
            }
        },
        {
            label: `Version: ${appVersion}`,
            enabled: false
        },
        {
            label: 'Check for Updates',
            click: () => {
                if (process.env.NODE_ENV === 'development') {
                    // Mock response for development
                    setTimeout(() => {
                        mainWindow.webContents.send('update-status', 'not-available');
                    }, 1000); // Simulate a delay for checking updates
                } else {
                    autoUpdater.checkForUpdates();
                }
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
function openUpdateWindow() {
    updateWindow = new BrowserWindow({
        width: 400,
        height: 200,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            preload: path.join(__dirname, 'preload.js'),
        },
        resizable: false,
        frame: false,
        title: "Update"
    });
    updateWindow.loadFile('update.html');
}
function openMainWindow() {
    mainWindow = new BrowserWindow({
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
    mainWindow.loadFile('about.html');
}

app.whenReady().then(() => {
    setupTray();
    if (monitoring) {
        startMonitoring();
    }
    sendWebhook();
});
app.on('browser-window-created', function (e, window) {
    window.webContents.on('devtools-opened', function (e) {
      if (process.env.NODE_ENV !== 'development') {
        window.webContents.closeDevTools();
      }
    });
  });
app.on('window-all-closed', (e) => {
    e.preventDefault();
});
app.on('ready', () => {
    autoUpdater.checkForUpdatesAndNotify();
});
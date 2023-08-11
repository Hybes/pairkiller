const fs = require('fs');
const { app, BrowserWindow, Menu, Tray, shell, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const util = require('util');
const fetch = require('node-fetch')
const exec = util.promisify(require('child_process').exec);


const configPath = path.join(app.getPath('userData'), 'config.json');
const defaultBlitzPath = path.join(app.getPath('home'), 'AppData', 'Local', 'Programs', 'Blitz', 'Blitz.exe');

const LEAGUE_CLIENT = 'LeagueClient.exe';
const LEAGUE_GAME = 'League of Legends.exe';
const BLITZ_APP = 'Blitz.exe';

let mainWindow;
let tray = null;
let monitoring = true;
let config = {
    blitzPath: defaultBlitzPath,
    anonymousUsage: true
};

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
ipcMain.on('check-for-updates', () => {
    autoUpdater.checkForUpdatesAndNotify();
});
ipcMain.on('install-update', () => {
    // This will quit and install the update, ensuring the app is updated
    autoUpdater.quitAndInstall();
});

app.whenReady().then(() => {
    setupTray();
    if (monitoring) {
        startMonitoring();
    }
    sendWebhook();
});

app.on('window-all-closed', (e) => {
    e.preventDefault();
});

app.on('ready', () => {
    autoUpdater.checkForUpdatesAndNotify();
});

autoUpdater.setFeedURL({
    provider: 'github',
    repo: 'blitz-for-league-only',
    owner: 'Hybes'
});

autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info);
});

autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available:', info);
    if (mainWindow) {
        mainWindow.webContents.send('no-update-available');
    }
});

autoUpdater.on('error', (err) => {
    console.error('Error in auto-updater:', err);
});

autoUpdater.on('download-progress', (progressObj) => {
    console.log(`Downloaded ${progressObj.percent}%`);
});

autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info);
});

async function isTaskRunning(taskName) {
    if (!taskName) {
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
        console.error(`Error checking task ${taskName}:`, error);
        return false;
    }
}

async function ensureBlitzIsRunning() {
    const isBlitzRunning = await isTaskRunning(BLITZ_APP);
    if (!isBlitzRunning) {
        exec(`"${config.blitzPath}"`, (error) => {
            if (error) {
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
            if (!response.ok) {
                console.error('Webhook error:', response.statusText);
            }
        } catch (error) {
            console.error('Webhook error:', error);
        }
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
            }
        },
        {
            label: 'About',
            click: () => {
                openMainWindow();
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

function openMainWindow() {
    let mainWindow = new BrowserWindow({
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
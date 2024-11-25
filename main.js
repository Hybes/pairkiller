const { app, BrowserWindow, Tray, Menu, dialog, ipcMain, Notification } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const Sentry = require('@sentry/electron');
require('dotenv').config();

// Initialize Sentry
Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production'
});

// Auto-updater configuration
autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'hybes',
    repo: 'pairkiller'
});

autoUpdater.on('checking-for-update', () => {
    console.log('[Pairkiller] Checking for updates...');
});

autoUpdater.on('update-available', (info) => {
    console.log('[Pairkiller] Update available:', info);
    new Notification({
        title: 'Pairkiller Update Available',
        body: 'A new version is available and will be installed automatically.'
    }).show();
});

autoUpdater.on('update-not-available', () => {
    console.log('[Pairkiller] No updates available');
});

autoUpdater.on('error', (err) => {
    console.error('[Pairkiller] Auto-updater error:', err);
    Sentry.captureException(err);
});

autoUpdater.on('download-progress', (progress) => {
    console.log(`[Pairkiller] Download progress: ${progress.percent}%`);
});

autoUpdater.on('update-downloaded', (info) => {
    console.log('[Pairkiller] Update downloaded:', info);
    new Notification({
        title: 'Pairkiller Update Ready',
        body: 'Restart the application to apply the update.'
    }).show();
});

// Check for updates every hour
setInterval(() => {
    autoUpdater.checkForUpdates().catch(err => {
        console.error('[Pairkiller] Error checking for updates:', err);
        Sentry.captureException(err);
    });
}, 60 * 60 * 1000);

// Initial update check after 1 minute
setTimeout(() => {
    autoUpdater.checkForUpdates().catch(err => {
        console.error('[Pairkiller] Error checking for updates:', err);
        Sentry.captureException(err);
    });
}, 60 * 1000);

const configPath = path.join(app.getPath('userData'), 'config.json');
require('dotenv').config();

let mainWindow;
let tray = null;
let monitoring = false;
let monitoringTimeout = null;
let updateWindow;
let settingsWindow;
let config = {
    appGroups: [],
    anonymousUsage: true,
    version: app.getVersion()
};

if (process.env.NODE_ENV !== 'development') {
    Sentry.init({
        dsn: 'https://83d267b1eff14ce29e39bd6c58b05bc8@error.brth.uk/1',
        release: app.getVersion(),
        beforeSend(event) {
            event.tags = {
                ...event.tags,
                app: 'Pairkiller'
            };
            return event;
        }
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
        Sentry.captureException(error);
    }
} else {
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
    autoUpdater.quitAndInstall();
});
ipcMain.on('check-for-updates', () => {
    if (process.env.NODE_ENV === 'development') {
        setTimeout(() => {
            mainWindow.webContents.send('update-status', 'not-available');
        }, 1000);
    } else {
        autoUpdater.checkForUpdates();
    }
});
ipcMain.on('close-update-window', () => {
    if (updateWindow) {
        updateWindow.close();
    }
});
ipcMain.on('add-app-group', (event, group) => {
    config.appGroups.push(group);
    fs.writeFileSync(configPath, JSON.stringify(config));
});
ipcMain.on('remove-app-group', (event, groupId) => {
    config.appGroups = config.appGroups.filter(group => group.id !== groupId);
    fs.writeFileSync(configPath, JSON.stringify(config));
});
ipcMain.on('update-app-group', (event, updatedGroup) => {
    const index = config.appGroups.findIndex(group => group.id === updatedGroup.id);
    if (index !== -1) {
        config.appGroups[index] = updatedGroup;
        fs.writeFileSync(configPath, JSON.stringify(config));
    }
});

// Add file dialog handler
ipcMain.handle('open-file-dialog', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
            { name: 'Executables', extensions: ['exe', 'bat', 'cmd'] }
        ]
    });
    
    return {
        filePath: result.filePaths[0],
        canceled: result.canceled
    };
});

// Add config handlers
ipcMain.handle('get-config', () => {
    return config;
});

ipcMain.on('save-config', (event, newConfig) => {
    config = newConfig;
    fs.writeFileSync(configPath, JSON.stringify(config));
    settingsWindow.close();
});

autoUpdater.setFeedURL({
    provider: 'github',
    repo: 'blitz-for-league-only',
    owner: 'Hybes'
});
autoUpdater.on('checking-for-update', () => {
    sendTracking('/auto-update', 'Auto Update');
});
autoUpdater.on('update-available', (info) => {
    sendTracking('/update-available', 'Update Available');
    openUpdateWindow();
    if (updateWindow) {
        updateWindow.webContents.send('update-status', 'Update available. Downloading...');
    }
});
autoUpdater.on('update-downloaded', (info) => {
    sendTracking('/update-downloaded', 'Update Downloaded');
    if (updateWindow) {
        updateWindow.webContents.send('update-status', 'Update downloaded. Installing...');
    }
    setTimeout(() => {
        autoUpdater.quitAndInstall();
    }, 500);
});
autoUpdater.on('update-not-available', () => {
    sendTracking('/update-not-available', 'Update Not Available');
    if (updateWindow) {
        updateWindow.webContents.send('update-status', 'You have the latest version.');
        setTimeout(() => {
            updateWindow.close();
        }, 500);
    }
});
autoUpdater.on('error', (err) => {
    sendTracking('/update-error', 'Update Error');
    if (updateWindow) {
        Sentry.captureException(err);
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
        Sentry.captureException('Config is malformed, taskName is missing');
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
        return false;
    }
}

async function ensureAppIsRunning(appPath) {
    const appName = path.basename(appPath);
    const isAppRunning = await isTaskRunning(appName);
    if (!isAppRunning) {
        exec(`"${appPath}"`, (error) => {
            if (error) {
                Sentry.captureException(error);
            }
        });
    }
}

async function startMonitoring() {
    if (!monitoring) return;

    try {
        for (const group of config.appGroups) {
            const monitoredAppsRunning = await Promise.all(
                group.monitoredApps.map(async app => {
                    const running = await isTaskRunning(app.name);
                    if (app.lastState !== running) {
                        app.lastState = running;
                        console.log(`[Pairkiller] ${app.name} is now ${running ? 'running' : 'stopped'}`);
                    }
                    return { app, running };
                })
            );

            let conditionMet = group.condition === 'all' 
                ? monitoredAppsRunning.every(app => app.running)
                : monitoredAppsRunning.some(app => app.running);

            if (group.reverse) {
                conditionMet = !conditionMet;
            }

            if (group.lastCondition !== conditionMet) {
                group.lastCondition = conditionMet;
                console.log(`[Pairkiller] Group "${group.name}" condition: ${conditionMet ? 'met' : 'not met'}`);
            }

            for (const controlledApp of group.controlledApps) {
                const isRunning = await isTaskRunning(controlledApp.name);
                let shouldBeRunning;

                switch (controlledApp.action) {
                    case 'start':
                        shouldBeRunning = conditionMet;
                        break;
                    case 'stop':
                        shouldBeRunning = !conditionMet;
                        break;
                    case 'sync':
                        // For 'sync', we match the state of the monitored apps
                        shouldBeRunning = monitoredAppsRunning.some(app => app.running);
                        break;
                    case 'opposite':
                        // For 'opposite', we do the inverse of the monitored apps
                        shouldBeRunning = !monitoredAppsRunning.some(app => app.running);
                        break;
                    default:
                        continue;
                }

                if (!isRunning && shouldBeRunning) {
                    console.log(`[Pairkiller] Starting ${controlledApp.name}`);
                    await ensureAppIsRunning(controlledApp.path);
                } else if (isRunning && !shouldBeRunning) {
                    console.log(`[Pairkiller] Stopping ${controlledApp.name}`);
                    try {
                        await exec(`taskkill /IM "${controlledApp.name}" /F`);
                    } catch (error) {
                        // Ignore errors if process is already gone
                    }
                }
            }
        }
    } catch (error) {
        console.error('[Pairkiller] Error:', error);
        Sentry.captureException(error);
    }

    monitoringTimeout = setTimeout(startMonitoring, 5000);
}

function stopMonitoring() {
    monitoring = false;
    if (monitoringTimeout) {
        clearTimeout(monitoringTimeout);
        monitoringTimeout = null;
    }
}

async function sendTracking(data, name) {
    if (config.anonymousUsage) {
        try {
            const body = {
                name: 'Pairkiller',
                data,
                version: app.getVersion()
            };
            const response = await fetch('https://view.cnnct.uk/api/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.111 Safari/537.36'
                },
                body: JSON.stringify({
                    "payload": {
                        "hostname": os.hostname(),
                        "language": "en-GB",
                        "referrer": os.userInfo().username,
                        "screen": `${screen.getPrimaryDisplay().workAreaSize.width}x${screen.getPrimaryDisplay().workAreaSize.height}`,
                        "title": name,
                        "url": data,
                        "website": "69393462-fdb6-46e8-a1e9-9c6fc241fff6",
                        "name": name
                    },
                    "type": "event"
                })
            });

            if (response.error) {
                Sentry.captureException(response.statusText);
            }
        } catch (error) {
            Sentry.captureException(error);
        }
    }
}

function setupTray() {
    tray = new Tray(path.join(__dirname, 'icon.png'));
    const contextMenu = Menu.buildFromTemplate([
        { 
            label: 'Settings', 
            click: () => openSettingsWindow() 
        },
        { 
            label: 'About', 
            click: () => openMainWindow() 
        },
        { type: 'separator' },
        { 
            label: 'Quit', 
            click: () => {
                stopMonitoring();
                app.quit();
            } 
        }
    ]);
    tray.setToolTip('Pairkiller');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => openSettingsWindow());

    // Start monitoring when tray is setup
    monitoring = true;
    startMonitoring();
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
        height: 420,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            preload: path.join(__dirname, 'preload.js'),
        },
    });
    mainWindow.loadFile('about.html');
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }
}

function openSettingsWindow() {
    if (settingsWindow) {
        settingsWindow.focus();
        return;
    }

    settingsWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        backgroundColor: '#1c1917' // stone-900 color
    });

    settingsWindow.loadFile('settings.html');
    if (process.env.NODE_ENV === 'development') {
        settingsWindow.webContents.openDevTools();
    }
    settingsWindow.setMenuBarVisibility(false);

    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
}

app.whenReady().then(() => {
    setupTray();
    sendTracking('/app-open', 'App Open');
});

app.on('browser-window-created', (e, window) => {
    if (process.env.NODE_ENV !== 'development') {
        window.webContents.on('devtools-opened', () => {
            window.webContents.closeDevTools();
        });
    }
});

app.on('window-all-closed', (e) => {
    e.preventDefault(); // Prevent app from quitting when all windows are closed
});

app.on('before-quit', () => {
    stopMonitoring();
});

process.on('SIGINT', () => {
    stopMonitoring();
    app.quit();
});

process.on('SIGTERM', () => {
    stopMonitoring();
    app.quit();
});

app.on('ready', () => {
    autoUpdater.checkForUpdatesAndNotify();
});
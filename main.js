const { app, BrowserWindow, Tray, Menu, dialog, ipcMain, Notification, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const Sentry = require('@sentry/electron');
require('dotenv').config();

// Initialize Sentry
Sentry.init({
    dsn: 'https://83d267b1eff14ce29e39bd6c58b05bc8@error.brth.uk/1',
    release: app.getVersion(),
    environment: process.env.NODE_ENV || 'production',
    debug: process.env.NODE_ENV === 'development',
    beforeSend(event) {
        // Add app info
        event.tags = {
            ...event.tags,
            app: 'Pairkiller',
            version: app.getVersion(),
            electron: process.versions.electron,
            platform: process.platform
        };
        
        // Add user config (excluding sensitive data)
        if (config) {
            event.extra = {
                ...event.extra,
                anonymousUsage: config.anonymousUsage,
                appGroupCount: config.appGroups?.length || 0
            };
        }
        
        return event;
    },
    integrations: [
        Sentry.browserTracingIntegration(),
    ],
    tracesSampleRate: 0.2,
});

// Add global error handlers
process.on('uncaughtException', (error) => {
    Sentry.captureException(error, {
        level: 'fatal',
        tags: { handler: 'uncaughtException' }
    });
});

process.on('unhandledRejection', (reason) => {
    Sentry.captureException(reason, {
        level: 'error',
        tags: { handler: 'unhandledRejection' }
    });
});

// Version IPC handler
ipcMain.handle('get-version', () => {
    return app.getVersion();
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
        title: 'Pairkiller',
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
        title: 'Pairkiller',
        body: 'Update ready to install. The app will restart to apply the update.'
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
let aboutWindow;
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

// Add default presets
const defaultPresets = {
    leagueOfLegends: {
        name: "Blitz / League of Legends",
        monitoredApps: [
            { name: "LeagueClient.exe" }
        ],
        controlledApps: [
            {
                name: "Blitz.exe",
                path: path.join(app.getPath('home'), 'AppData/Local/Programs/Blitz/Blitz.exe'),
                action: "sync"
            }
        ]
    },
    rocketLeague: {
        name: "BakkesMod / Rocket League",
        monitoredApps: [
            { name: "RocketLeague.exe" }
        ],
        controlledApps: [
            {
                name: "BakkesMod.exe",
                path: path.join(app.getPath('home'), 'AppData/Roaming/bakkesmod/bakkesmod.exe'),
                action: "sync"
            }
        ]
    }
};

// Load or initialize config
function loadConfig() {
    debug('Loading config');
    const configPath = path.join(app.getPath('userData'), 'config.json');
    debug('Config path:', configPath);

    if (fs.existsSync(configPath)) {
        try {
            const fileData = fs.readFileSync(configPath, 'utf8');
            const loadedConfig = JSON.parse(fileData);
            debug('Loaded config:', loadedConfig);

            // Ensure all required fields exist
            config = {
                appGroups: loadedConfig.appGroups || [],
                presets: defaultPresets  // We don't save presets anymore, they're just templates
            };
            
            debug('Initialized config:', config);
        } catch (error) {
            debug('Error loading config:', error);
            Sentry.captureException(error);
            config = { appGroups: [], presets: defaultPresets };
        }
    } else {
        debug('No config file found, creating default');
        config = { appGroups: [], presets: defaultPresets };
        
        // Set to open at login for first-time users
        app.setLoginItemSettings({
            openAtLogin: true
        });
    }
}

// Handle config-related IPC events
ipcMain.handle('get-config', () => {
    debug('Sending config to renderer:', config);
    return config;
});

ipcMain.handle('get-presets', () => {
    debug('Sending presets to renderer:', defaultPresets);
    return defaultPresets;
});

ipcMain.handle('save-settings', async (event, newConfig) => {
    debug('Saving new settings:', newConfig);
    const configPath = path.join(app.getPath('userData'), 'config.json');
    
    try {
        // Update the config object
        config.appGroups = newConfig.appGroups;
        
        // Write to file
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        debug('Settings saved successfully');
        
        // Restart monitoring with new config
        if (monitoring) {
            stopMonitoring();
            startMonitoring();
        }
        
        return true;
    } catch (error) {
        debug('Error saving settings:', error);
        Sentry.captureException(error);
        throw error;
    }
});

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

autoUpdater.setFeedURL({
    provider: 'github',
    repo: 'pairkiller',
    owner: 'hybes'
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

// Debug logging utility
function debug(...args) {
    if (process.env.NODE_ENV === 'development') {
        console.log('[DEBUG]', ...args);
    }
}

async function startMonitoring() {
    try {
        const transaction = Sentry.startSpan({
            name: "Start App Monitoring",
            op: "monitoring"
        }, () => {
            Sentry.addBreadcrumb({
                category: 'monitoring',
                message: 'Starting app monitoring',
                level: 'info'
            });

            if (monitoring) {
                debug('Already monitoring');
                return;
            }
            monitoring = true;
            debug('Starting monitoring service');
            debug('Current config:', JSON.stringify(config, null, 2));

            async function checkApps() {
                try {
                    debug('\n=== Starting App Check Cycle ===');
                    // Check app groups
                    for (const appGroup of config.appGroups) {
                        debug(`\nChecking app group: ${appGroup.name}`);
                        let anyMonitoredAppRunning = false;
                        let runningMonitoredApps = [];

                        // Check monitored apps
                        debug('Checking monitored apps:');
                        for (const app of appGroup.monitoredApps) {
                            const isRunning = await isTaskRunning(app.name);
                            debug(`  - ${app.name}: ${isRunning ? 'RUNNING' : 'NOT RUNNING'}`);
                            if (isRunning) {
                                anyMonitoredAppRunning = true;
                                runningMonitoredApps.push(app.name);
                            }
                        }

                        debug(`Monitored apps status: ${anyMonitoredAppRunning ? 'ACTIVE' : 'INACTIVE'}`);
                        if (runningMonitoredApps.length > 0) {
                            debug(`Running apps: ${runningMonitoredApps.join(', ')}`);
                        }

                        // Determine if we should take action based on condition
                        let shouldTakeAction = false;
                        if (appGroup.condition === 'all') {
                            shouldTakeAction = appGroup.monitoredApps.length > 0 && 
                                runningMonitoredApps.length === appGroup.monitoredApps.length;
                        } else { // 'any'
                            shouldTakeAction = anyMonitoredAppRunning;
                        }

                        // Handle controlled apps
                        debug('\nChecking controlled apps:');
                        for (const app of appGroup.controlledApps) {
                            const isRunning = await isTaskRunning(app.name);
                            let shouldBeRunning = false;

                            switch (app.action) {
                                case 'start':
                                    shouldBeRunning = shouldTakeAction;
                                    break;
                                case 'stop':
                                    shouldBeRunning = !shouldTakeAction;
                                    break;
                                case 'sync':
                                    shouldBeRunning = shouldTakeAction;
                                    break;
                                case 'opposite':
                                    shouldBeRunning = !shouldTakeAction;
                                    break;
                                default:
                                    debug(`  ⚠️ Unknown action type for ${app.name}:`, app.action);
                                    continue;
                            }

                            debug(`  - ${app.name}:`);
                            debug(`    Current state: ${isRunning ? 'RUNNING' : 'NOT RUNNING'}`);
                            debug(`    Should be: ${shouldBeRunning ? 'RUNNING' : 'NOT RUNNING'}`);
                            debug(`    Action: ${app.action.toUpperCase()}`);

                            if (shouldBeRunning && !isRunning) {
                                debug(`    Starting ${app.name}`);
                                await ensureAppIsRunning(app.path || app.name);
                            } else if (!shouldBeRunning && isRunning) {
                                debug(`    Stopping ${app.name}`);
                                exec(`taskkill /IM "${app.name}" /F`, (error) => {
                                    if (error) {
                                        debug(`    Error stopping ${app.name}:`, error);
                                    }
                                });
                            }
                        }
                    }
                } catch (error) {
                    debug('Error in checkApps:', error);
                    Sentry.captureException(error);
                }
            }

            // Initial check
            await checkApps();
            
            // Set up interval for periodic checks
            monitoringTimeout = setInterval(checkApps, 5000);
            debug('Monitoring service started');
        });
    } catch (error) {
        Sentry.captureException(error, {
            tags: { function: 'startMonitoring' }
        });
        throw error;
    }
}

async function stopMonitoring() {
    try {
        Sentry.addBreadcrumb({
            category: 'monitoring',
            message: 'Stopping app monitoring',
            level: 'info'
        });
        monitoring = false;
        if (monitoringTimeout) {
            clearInterval(monitoringTimeout);
            monitoringTimeout = null;
        }
    } catch (error) {
        Sentry.captureException(error, {
            tags: { function: 'stopMonitoring' }
        });
        throw error;
    }
}

async function ensureAppIsRunning(appPath) {
    const transaction = Sentry.startSpan({
        op: "app.ensure",
        name: "Ensure App Running"
    });

    try {
        const appName = path.basename(appPath);
        debug(`Ensuring app is running: ${appName} from path:`, appPath);
        const isAppRunning = await isTaskRunning(appName);
        if (!isAppRunning) {
            debug(`Starting app: ${appName}`);
            exec(`"${appPath}"`, (error) => {
                if (error) {
                    debug(`Error starting ${appName}:`, error);
                    Sentry.captureException(error);
                } else {
                    debug(`Successfully launched ${appName}`);
                }
            });
        } else {
            debug(`App ${appName} is already running`);
        }
        transaction.finish();
    } catch (error) {
        Sentry.captureException(error, {
            tags: { function: 'ensureAppIsRunning' },
            extra: { appPath }
        });
        throw error;
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
            click: () => openAboutWindow() 
        },
        { type: 'separator' },
        {
            label: 'Start Monitoring',
            click: () => {
                if (!monitoring) {
                    startMonitoring();
                }
            }
        },
        {
            label: 'Stop Monitoring',
            click: () => {
                if (monitoring) {
                    stopMonitoring();
                }
            }
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

function openAboutWindow() {
    if (aboutWindow) {
        aboutWindow.focus();
        return;
    }

    aboutWindow = new BrowserWindow({
        icon: path.join(__dirname, 'icon.png'),
        autoHideMenuBar: true,
        width: 600,
        height: 380,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        resizable: false,
        maximizable: false,
        title: "About"
    });

    aboutWindow.loadFile('about.html');
    aboutWindow.setMenu(null);

    aboutWindow.on('closed', () => {
        aboutWindow = null;
    });
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
        backgroundColor: '#1c1917'
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

loadConfig();

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
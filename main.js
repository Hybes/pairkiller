const { app, BrowserWindow, Tray, Menu, dialog, ipcMain, Notification, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { exec } = require('child_process');
const util = require('util');
const Sentry = require('@sentry/electron');
require('dotenv').config();

// Initialize Sentry with improved configuration
Sentry.init({
    dsn: 'https://8cf399a69648dc38f3031071446b40e7@o4507687244136448.ingest.de.sentry.io/4508365136855120',
    release: app.getVersion(),
    environment: process.env.NODE_ENV || 'production',
    debug: process.env.NODE_ENV === 'development',
    beforeSend(event) {
        event.tags = {
            ...event.tags,
            app: 'Pairkiller',
            version: app.getVersion(),
            electron: process.versions.electron,
            platform: process.platform
        };
        
        if (config) {
            event.extra = {
                ...event.extra,
                anonymousUsage: config.anonymousUsage,
                appGroupCount: config.appGroups?.length || 0
            };
        }
        
        return event;
    },
    tracesSampleRate: 0.2,
});

// Enhanced error handling
process.on('uncaughtException', (error) => {
    console.error('[FATAL] Uncaught Exception:', error);
    Sentry.captureException(error, {
        level: 'fatal',
        tags: { handler: 'uncaughtException' }
    });
});

process.on('unhandledRejection', (reason) => {
    console.error('[ERROR] Unhandled Rejection:', reason);
    Sentry.captureException(reason, {
        level: 'error',
        tags: { handler: 'unhandledRejection' }
    });
});

// Promisify exec for better async handling
const execPromise = util.promisify(exec);

// Platform-specific configuration
const platform = process.platform;
const isWindows = platform === 'win32';
const isMacOS = platform === 'darwin';

// Global state management
let mainWindow;
let tray = null;
let monitoring = false;
let monitoringTimeout = null;
let updateWindow;
let settingsWindow;
let aboutWindow;
let configPath;
let config = {
    appGroups: [],
    anonymousUsage: true,
    version: app.getVersion(),
    monitoring: {
        interval: 2500,
        enabled: true
    },
    ui: {
        theme: 'dark',
        animations: true
    }
};

// Performance monitoring cache
const processCache = new Map();
const CACHE_DURATION = 1000; // 1 second cache

// Initialize config path
configPath = path.join(app.getPath('userData'), 'config.json');

// Enhanced default presets with better descriptions - now cross-platform
const defaultPresets = {
    leagueOfLegends: {
        name: "Blitz / League of Legends",
        description: "Automatically manage Blitz app when League of Legends is running",
        monitoredApps: isWindows ? [
            { name: "LeagueClient.exe" },
            { name: "League of Legends.exe" }
        ] : [
            { name: "League of Legends" },
            { name: "LeagueClient" }
        ],
        controlledApps: isWindows ? [
            {
                name: "Blitz.exe",
                path: path.join(app.getPath('home'), 'AppData/Local/Programs/Blitz/Blitz.exe'),
                action: "sync"
            }
        ] : [
            {
                name: "Blitz",
                path: "/Applications/Blitz.app",
                action: "sync"
            }
        ],
        condition: "any"
    },
    rocketLeague: {
        name: isWindows ? "BakkesMod / Rocket League" : "Rocket League Monitor",
        description: isWindows ? "Automatically manage BakkesMod when Rocket League is running" : "Monitor Rocket League and manage companion apps",
        monitoredApps: isWindows ? [
            { name: "RocketLeague.exe" }
        ] : [
            { name: "RocketLeague" }
        ],
        controlledApps: isWindows ? [
            {
                name: "BakkesMod.exe",
                path: "C:\\Program Files\\BakkesMod\\BakkesMod.exe",
                action: "sync"
            }
        ] : [
            // No direct BakkesMod equivalent on macOS, but users can add their own
        ],
        condition: "any"
    },
    steamGames: {
        name: "Steam Games Monitor",
        description: "Monitor Steam games and manage companion apps",
        monitoredApps: isWindows ? [
            { name: "steam.exe" }
        ] : [
            { name: "Steam" }
        ],
        controlledApps: [],
        condition: "any"
    },
    discordGaming: {
        name: "Discord Gaming",
        description: "Monitor Discord and manage gaming-related apps",
        monitoredApps: isWindows ? [
            { name: "Discord.exe" }
        ] : [
            { name: "Discord" }
        ],
        controlledApps: [],
        condition: "any"
    }
};

// Enhanced config loading with validation and migration
async function loadConfig() {
    try {
        debug('Loading configuration from:', configPath);
        
        if (fsSync.existsSync(configPath)) {
            try {
                const fileData = await fs.readFile(configPath, 'utf8');
                let loadedConfig = JSON.parse(fileData);
                
                // Migration system for config schema changes
                loadedConfig = await migrateConfig(loadedConfig);
                
                // Validate and merge with defaults
                config = {
                    appGroups: Array.isArray(loadedConfig.appGroups) ? loadedConfig.appGroups : [],
                    anonymousUsage: loadedConfig.anonymousUsage !== undefined ? loadedConfig.anonymousUsage : true,
                    version: app.getVersion(),
                    configVersion: loadedConfig.configVersion || '4.0.0',
                    monitoring: {
                        interval: loadedConfig.monitoring?.interval || 2500,
                        enabled: loadedConfig.monitoring?.enabled !== false
                    },
                    ui: {
                        theme: loadedConfig.ui?.theme || 'dark',
                        animations: loadedConfig.ui?.animations !== false
                    }
                };
                
                debug('Configuration loaded and migrated successfully');
            } catch (parseError) {
                console.error('Error parsing config file:', parseError);
                
                // Try to restore from backup
                const restored = await restoreConfigFromBackup();
                if (restored) {
                    debug('Config restored from backup, retrying load');
                    return loadConfig(); // Recursive call with restored config
                } else {
                    throw new Error('Config file corrupted and no backup available');
                }
            }
        } else {
            debug('No config file found, using defaults');
            config = {
                appGroups: [],
                anonymousUsage: true,
                version: app.getVersion(),
                configVersion: '4.0.0',
                monitoring: { interval: 2500, enabled: true },
                ui: { theme: 'dark', animations: true }
            };
            
            // Set login item for new users
            app.setLoginItemSettings({
                openAtLogin: true,
                openAsHidden: true
            });
        }
        
        // Ensure config directory exists
        await fs.mkdir(path.dirname(configPath), { recursive: true });
        
        // Save migrated config to ensure it's up to date
        await saveConfig();
        
    } catch (error) {
        console.error('Error loading config:', error);
        Sentry.captureException(error);
        
        // Final fallback to defaults
        config = {
            appGroups: [],
            anonymousUsage: true,
            version: app.getVersion(),
            configVersion: '4.0.0',
            monitoring: { interval: 2500, enabled: true },
            ui: { theme: 'dark', animations: true }
        };
        
        // Try to save the default config
        try {
            await saveConfig();
        } catch (saveError) {
            console.error('Failed to save fallback config:', saveError);
        }
    }
}

// Config migration system to handle schema changes between versions
async function migrateConfig(loadedConfig) {
    const configVersion = loadedConfig.configVersion || '1.0.0';
    const currentVersion = '4.0.0';
    
    let migratedConfig = { ...loadedConfig };
    
    debug(`Migrating config from version ${configVersion} to ${currentVersion}`);
    
    // Migration from versions before 2.0.0
    if (compareVersions(configVersion, '2.0.0') < 0) {
        debug('Applying migration for v2.0.0');
        
        // Migrate old app structure if it exists
        if (migratedConfig.apps && Array.isArray(migratedConfig.apps)) {
            migratedConfig.appGroups = migratedConfig.apps.map(app => ({
                name: app.name || 'Migrated Group',
                enabled: app.enabled !== false,
                condition: 'any',
                monitoredApps: app.monitoredApps || [],
                controlledApps: app.controlledApps || []
            }));
            delete migratedConfig.apps;
        }
        
        // Add default monitoring settings if missing
        if (!migratedConfig.monitoring) {
            migratedConfig.monitoring = { interval: 2500, enabled: true };
        }
    }
    
    // Migration from versions before 3.0.0
    if (compareVersions(configVersion, '3.0.0') < 0) {
        debug('Applying migration for v3.0.0');
        
        // Add UI settings if missing
        if (!migratedConfig.ui) {
            migratedConfig.ui = { theme: 'dark', animations: true };
        }
        
        // Ensure each app group has required fields
        if (migratedConfig.appGroups && Array.isArray(migratedConfig.appGroups)) {
            migratedConfig.appGroups = migratedConfig.appGroups.map(group => ({
                ...group,
                enabled: group.enabled !== false,
                condition: group.condition || 'any',
                monitoredApps: Array.isArray(group.monitoredApps) ? group.monitoredApps : [],
                controlledApps: Array.isArray(group.controlledApps) ? group.controlledApps : []
            }));
        }
    }
    
    // Migration from versions before 4.0.0
    if (compareVersions(configVersion, '4.0.0') < 0) {
        debug('Applying migration for v4.0.0');
        
        // Add any new v4.0.0 specific settings here
        // For now, just ensure all required fields exist
        
        // Validate controlled apps have all required fields
        if (migratedConfig.appGroups && Array.isArray(migratedConfig.appGroups)) {
            migratedConfig.appGroups = migratedConfig.appGroups.map(group => ({
                ...group,
                controlledApps: group.controlledApps.map(app => ({
                    name: app.name,
                    path: app.path || '',
                    action: app.action || 'sync'
                }))
            }));
        }
    }
    
    // Update config version
    migratedConfig.configVersion = currentVersion;
    
    debug('Config migration completed');
    return migratedConfig;
}

// Simple version comparison function
function compareVersions(a, b) {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aPart = aParts[i] || 0;
        const bPart = bParts[i] || 0;
        
        if (aPart < bPart) return -1;
        if (aPart > bPart) return 1;
    }
    
    return 0;
}

// Enhanced config saving with atomic writes
async function saveConfig() {
    try {
        const tempPath = `${configPath}.tmp`;
        await fs.writeFile(tempPath, JSON.stringify(config, null, 2));
        await fs.rename(tempPath, configPath);
        debug('Configuration saved successfully');
        return true;
    } catch (error) {
        console.error('Error saving config:', error);
        Sentry.captureException(error);
        throw error;
    }
}

// Optimized process checking with caching - now cross-platform
async function isTaskRunning(processName) {
    const now = Date.now();
    const cached = processCache.get(processName);
    
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
        return cached.running;
    }
    
    try {
        let isRunning = false;
        
        if (isWindows) {
            const { stdout } = await execPromise(`tasklist /FI "IMAGENAME eq ${processName}" /NH`);
            isRunning = stdout.toLowerCase().includes(processName.toLowerCase());
        } else if (isMacOS) {
            // On macOS, we need to handle both .app bundles and executable names
            const appName = processName.replace('.exe', '');
            
            try {
                // First try to find the process by name
                const { stdout } = await execPromise(`pgrep -f "${appName}"`);
                isRunning = stdout.trim().length > 0;
            } catch (error) {
                // If pgrep fails, try ps command as fallback
                try {
                    const { stdout } = await execPromise(`ps aux | grep -i "${appName}" | grep -v grep`);
                    isRunning = stdout.trim().length > 0;
                } catch (psError) {
                    isRunning = false;
                }
            }
        } else {
            // Linux/other Unix systems
            const appName = processName.replace('.exe', '');
            const { stdout } = await execPromise(`pgrep -f "${appName}"`);
            isRunning = stdout.trim().length > 0;
        }
        
        processCache.set(processName, {
            running: isRunning,
            timestamp: now
        });
        
        return isRunning;
    } catch (error) {
        debug(`Error checking if ${processName} is running:`, error);
        processCache.set(processName, {
            running: false,
            timestamp: now
        });
        return false;
    }
}

function updateAllMenus() {
    updateTrayMenu();
    if (isMacOS) {
        setupDock();
        setupMenuBar();
    }
}

// Enhanced monitoring with better performance and error handling
async function startMonitoring() {
    try {
        if (monitoring) {
            debug('Monitoring already active');
            return;
        }
        
        if (!config.monitoring.enabled) {
            debug('Monitoring disabled in config');
            return;
        }
        
        monitoring = true;
        debug('Starting enhanced monitoring service');
        
        Sentry.addBreadcrumb({
            category: 'monitoring',
            message: 'Starting app monitoring',
            level: 'info'
        });

        async function checkApps() {
            if (!monitoring) return;
            
            try {
                debug('\n=== Enhanced App Check Cycle ===');
                const checkPromises = [];
                
                for (const appGroup of config.appGroups) {
                    checkPromises.push(processAppGroup(appGroup));
                }
                
                await Promise.allSettled(checkPromises);
                
            } catch (error) {
                console.error('Error in enhanced checkApps:', error);
                Sentry.captureException(error);
            }
        }

        async function processAppGroup(appGroup) {
            try {
                debug(`\nProcessing app group: ${appGroup.name}`);
                
                // Check monitored apps in parallel
                const monitoringPromises = appGroup.monitoredApps.map(async app => {
                    const isRunning = await isTaskRunning(app.name);
                    return { name: app.name, running: isRunning };
                });
                
                const monitoringResults = await Promise.all(monitoringPromises);
                const runningMonitoredApps = monitoringResults.filter(result => result.running);
                
                debug('Monitored apps status:', monitoringResults);
                
                // Determine action based on condition
                let shouldTakeAction = false;
                if (appGroup.condition === 'all') {
                    shouldTakeAction = appGroup.monitoredApps.length > 0 && 
                        runningMonitoredApps.length === appGroup.monitoredApps.length;
                } else {
                    shouldTakeAction = runningMonitoredApps.length > 0;
                }
                
                // Process controlled apps in parallel
                const controlPromises = appGroup.controlledApps.map(app => 
                    processControlledApp(app, shouldTakeAction)
                );
                
                await Promise.allSettled(controlPromises);
                
            } catch (error) {
                console.error(`Error processing app group ${appGroup.name}:`, error);
                Sentry.captureException(error);
            }
        }

        async function processControlledApp(app, shouldTakeAction) {
            try {
                const isRunning = await isTaskRunning(app.name);
                let shouldBeRunning = false;

                switch (app.action) {
                    case 'start':
                    case 'sync':
                        shouldBeRunning = shouldTakeAction;
                        break;
                    case 'stop':
                    case 'opposite':
                        shouldBeRunning = !shouldTakeAction;
                        break;
                    default:
                        debug(`Unknown action type for ${app.name}:`, app.action);
                        return;
                }

                debug(`${app.name}: Currently ${isRunning ? 'RUNNING' : 'STOPPED'}, Should be ${shouldBeRunning ? 'RUNNING' : 'STOPPED'}`);

                if (shouldBeRunning && !isRunning) {
                    debug(`Starting ${app.name}`);
                    await ensureAppIsRunning(app.path || app.name);
                } else if (!shouldBeRunning && isRunning) {
                    debug(`Stopping ${app.name}`);
                    await stopApp(app.name);
                }
            } catch (error) {
                console.error(`Error processing controlled app ${app.name}:`, error);
                Sentry.captureException(error);
            }
        }

        // Initial check
        await checkApps();
        
        // Set up interval with configurable timing
        monitoringTimeout = setInterval(checkApps, config.monitoring.interval);
        debug('Enhanced monitoring service started');
        
        // Update all menus
        updateAllMenus();
        
    } catch (error) {
        console.error('Failed to start monitoring:', error);
        Sentry.captureException(error, {
            tags: { function: 'startMonitoring' }
        });
        monitoring = false;
        throw error;
    }
}

async function stopMonitoring() {
    try {
        monitoring = false;
        if (monitoringTimeout) {
            clearInterval(monitoringTimeout);
            monitoringTimeout = null;
        }
        
        // Clear process cache
        processCache.clear();
        
        debug('Monitoring service stopped');
        
        Sentry.addBreadcrumb({
            category: 'monitoring',
            message: 'Stopping app monitoring',
            level: 'info'
        });
        
        // Update all menus
        updateAllMenus();
        
    } catch (error) {
        console.error('Error stopping monitoring:', error);
        Sentry.captureException(error);
    }
}

// Enhanced app launching with better error handling - now cross-platform
async function ensureAppIsRunning(appPath) {
    try {
        const appName = path.basename(appPath);
        debug(`Ensuring app is running: ${appName} from path:`, appPath);
        
        const isAppRunning = await isTaskRunning(appName);
        if (!isAppRunning) {
            debug(`Starting app: ${appName}`);
            
            return new Promise((resolve, reject) => {
                let command;
                
                if (isWindows) {
                    command = `"${appPath}"`;
                } else if (isMacOS) {
                    if (appPath.endsWith('.app')) {
                        command = `open "${appPath}"`;
                    } else {
                        command = `"${appPath}"`;
                    }
                } else {
                    // Linux/other Unix systems
                    command = `"${appPath}" &`;
                }
                
                exec(command, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`Error starting ${appName}:`, error);
                        Sentry.captureException(error, {
                            tags: { function: 'ensureAppIsRunning', platform },
                            extra: { appPath, appName, command }
                        });
                        reject(error);
                    } else {
                        debug(`Successfully launched ${appName}`);
                        resolve();
                    }
                });
            });
        } else {
            debug(`App ${appName} is already running`);
        }
    } catch (error) {
        console.error(`Failed to ensure app is running: ${appPath}`, error);
        Sentry.captureException(error);
        throw error;
    }
}

// Enhanced app stopping - now cross-platform
async function stopApp(appName) {
    try {
        return new Promise((resolve, reject) => {
            let command;
            
            if (isWindows) {
                command = `taskkill /IM "${appName}" /F`;
            } else if (isMacOS) {
                const processNameWithoutExt = appName.replace('.exe', '');
                command = `pkill -f "${processNameWithoutExt}"`;
            } else {
                // Linux/other Unix systems
                const processNameWithoutExt = appName.replace('.exe', '');
                command = `pkill -f "${processNameWithoutExt}"`;
            }
            
            exec(command, (error, stdout, stderr) => {
                if (error && !error.message.includes('not found') && !error.message.includes('No such process')) {
                    console.error(`Error stopping ${appName}:`, error);
                    Sentry.captureException(error, {
                        tags: { platform },
                        extra: { appName, command }
                    });
                    reject(error);
                } else {
                    debug(`Successfully stopped ${appName}`);
                    resolve();
                }
            });
        });
    } catch (error) {
        console.error(`Failed to stop app: ${appName}`, error);
        Sentry.captureException(error);
        throw error;
    }
}

// Enhanced tray setup with platform-specific behavior
function setupTray() {
    try {
        if (isMacOS) {
            // On macOS, we'll use both dock and system tray
            // Dock is primary, tray is secondary
            setupDock();
            // Still create tray for consistency, but make it less prominent
            tray = new Tray(path.join(__dirname, 'icon.png'));
            tray.setToolTip('Pairkiller - Right-click for options');
        } else {
            // On Windows/Linux, use system tray as primary
            tray = new Tray(path.join(__dirname, 'icon.png'));
            tray.setToolTip('Pairkiller - App Monitor & Controller');
            tray.on('double-click', () => openSettingsWindow());
        }
        
        updateTrayMenu();
        
        tray.on('right-click', () => {
            tray.popUpContextMenu();
        });
        
        // On non-Mac, also handle left click
        if (!isMacOS) {
            tray.on('click', () => openSettingsWindow());
        }
        
    } catch (error) {
        console.error('Error setting up tray:', error);
        Sentry.captureException(error);
    }
}

function setupDock() {
    if (!isMacOS) return;
    
    try {
        // Set up dock menu
        const dockMenu = Menu.buildFromTemplate([
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
                label: monitoring ? 'Stop Monitoring' : 'Start Monitoring',
                click: () => {
                    if (monitoring) {
                        stopMonitoring();
                    } else {
                        startMonitoring();
                    }
                }
            }
        ]);
        
        app.dock.setMenu(dockMenu);
        
        // Show dock icon
        if (app.dock) {
            app.dock.show();
        }
        
    } catch (error) {
        console.error('Error setting up dock:', error);
        Sentry.captureException(error);
    }
}

function updateTrayMenu() {
    if (!tray) return;
    
    const menuTemplate = [
        { 
            label: `Pairkiller v${app.getVersion()}`,
            enabled: false
        },
        { type: 'separator' },
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
            label: monitoring ? '⏸️ Stop Monitoring' : '▶️ Start Monitoring',
            click: () => {
                if (monitoring) {
                    stopMonitoring();
                } else {
                    startMonitoring();
                }
            }
        },
        {
            label: `📊 Groups: ${config.appGroups.length}`,
            enabled: false
        },
        { type: 'separator' },
        { 
            label: '🔄 Check for Updates',
            click: () => {
                autoUpdater.checkForUpdatesAndNotify();
            }
        },
        { type: 'separator' }
    ];
    
    // Add quit option - different behavior on macOS
    if (isMacOS) {
        menuTemplate.push({
            label: '❌ Quit Pairkiller',
            click: () => {
                app.isQuiting = true;
                stopMonitoring();
                app.quit();
            }
        });
    } else {
        menuTemplate.push({
            label: '❌ Quit',
            click: () => {
                stopMonitoring();
                app.quit();
            }
        });
    }
    
    const contextMenu = Menu.buildFromTemplate(menuTemplate);
    tray.setContextMenu(contextMenu);
    
    // Update dock menu on macOS
    if (isMacOS) {
        setupDock();
    }
}

// Enhanced window management
function openSettingsWindow() {
    if (settingsWindow) {
        if (isMacOS) {
            // On macOS, bring window to front and focus
            settingsWindow.show();
            settingsWindow.focus();
            app.focus();
        } else {
            settingsWindow.focus();
        }
        return;
    }

    settingsWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: false
        },
        backgroundColor: '#1c1917',
        show: false,
        titleBarStyle: isMacOS ? 'hiddenInset' : 'hidden',
        titleBarOverlay: {
            color: '#1c1917',
            symbolColor: '#f5f5f4'
        }
    });

    settingsWindow.loadFile('settings.html');
    
    settingsWindow.once('ready-to-show', () => {
        settingsWindow.show();
        if (isMacOS) {
            // On macOS, ensure the app comes to front
            app.focus();
            settingsWindow.focus();
        }
        if (process.env.NODE_ENV === 'development') {
            settingsWindow.webContents.openDevTools();
        }
    });

    settingsWindow.on('closed', () => {
        settingsWindow = null;
        // On macOS, update dock menu when window closes
        if (isMacOS) {
            setupDock();
        }
    });
}

function openAboutWindow() {
    if (aboutWindow) {
        if (isMacOS) {
            aboutWindow.show();
            aboutWindow.focus();
            app.focus();
        } else {
            aboutWindow.focus();
        }
        return;
    }

    aboutWindow = new BrowserWindow({
        icon: path.join(__dirname, 'icon.png'),
        width: 600,
        height: 450,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        resizable: false,
        maximizable: false,
        minimizable: false,
        backgroundColor: '#1c1917',
        show: false,
        titleBarStyle: isMacOS ? 'hiddenInset' : 'hidden'
    });

    aboutWindow.loadFile('about.html');
    aboutWindow.once('ready-to-show', () => {
        aboutWindow.show();
        if (isMacOS) {
            app.focus();
            aboutWindow.focus();
        }
    });

    aboutWindow.on('closed', () => {
        aboutWindow = null;
    });
}

function openUpdateWindow() {
    if (updateWindow) {
        updateWindow.focus();
        return;
    }

    updateWindow = new BrowserWindow({
        width: 500,
        height: 300,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            preload: path.join(__dirname, 'preload.js'),
        },
        resizable: false,
        frame: false,
        backgroundColor: '#1c1917',
        show: false
    });
    
    updateWindow.loadFile('update.html');
    updateWindow.once('ready-to-show', () => {
        updateWindow.show();
    });
}

// Enhanced IPC handlers
ipcMain.handle('get-version', () => app.getVersion());

ipcMain.handle('get-config', () => {
    debug('Sending config to renderer');
    return config;
});

ipcMain.handle('get-presets', () => {
    debug('Sending presets to renderer');
    return defaultPresets;
});

ipcMain.handle('save-settings', async (event, newConfig) => {
    try {
        debug('Saving new settings');
        
        // Validate configuration
        if (!Array.isArray(newConfig.appGroups)) {
            throw new Error('Invalid app groups configuration');
        }
        
        // Update config
        config.appGroups = newConfig.appGroups;
        config.monitoring = { ...config.monitoring, ...newConfig.monitoring };
        config.ui = { ...config.ui, ...newConfig.ui };
        
        await saveConfig();
        debug('Settings saved successfully');
        
        // Restart monitoring with new config
        if (monitoring) {
            await stopMonitoring();
            await startMonitoring();
        }
        
        return { success: true };
    } catch (error) {
        console.error('Error saving settings:', error);
        Sentry.captureException(error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('open-file-dialog', async () => {
    try {
        const dialogOptions = {
            properties: ['openFile']
        };
        
        if (isWindows) {
            dialogOptions.filters = [
                { name: 'Executables', extensions: ['exe', 'bat', 'cmd'] },
                { name: 'All Files', extensions: ['*'] }
            ];
        } else if (isMacOS) {
            dialogOptions.filters = [
                { name: 'Applications', extensions: ['app'] },
                { name: 'Executables', extensions: ['*'] }
            ];
        } else {
            dialogOptions.filters = [
                { name: 'Executables', extensions: ['*'] }
            ];
        }
        
        const result = await dialog.showOpenDialog(dialogOptions);
        
        return {
            filePath: result.filePaths[0],
            canceled: result.canceled
        };
    } catch (error) {
        console.error('Error opening file dialog:', error);
        Sentry.captureException(error);
        return { canceled: true, error: error.message };
    }
});

ipcMain.handle('get-running-processes', async () => {
    try {
        let processes = [];
        
        if (isWindows) {
            const { stdout } = await execPromise('tasklist /FO CSV /NH');
            processes = stdout.split('\n')
                .filter(line => line.trim())
                .map(line => {
                    const parts = line.split(',');
                    return {
                        name: parts[0]?.replace(/"/g, ''),
                        pid: parts[1]?.replace(/"/g, ''),
                    };
                })
                .filter(proc => proc.name && proc.name.endsWith('.exe'))
                .sort((a, b) => a.name.localeCompare(b.name));
        } else if (isMacOS) {
            // Get running applications
            const { stdout } = await execPromise('ps -eo pid,comm | grep -v "grep"');
            const psProcesses = stdout.split('\n')
                .filter(line => line.trim())
                .map(line => {
                    const parts = line.trim().split(/\s+/);
                    const pid = parts[0];
                    const name = parts.slice(1).join(' ');
                    return {
                        name: path.basename(name),
                        pid: pid,
                    };
                })
                .filter(proc => proc.name && proc.name.length > 0);
            
            // Also get .app bundles
            try {
                const { stdout: appsStdout } = await execPromise('osascript -e "tell application \\"System Events\\" to get name of every application process"');
                const appProcesses = appsStdout.split(', ')
                    .filter(name => name.trim())
                    .map(name => ({
                        name: name.trim(),
                        pid: 'unknown',
                    }));
                
                processes = [...psProcesses, ...appProcesses]
                    .filter((proc, index, self) => 
                        index === self.findIndex(p => p.name === proc.name)
                    )
                    .sort((a, b) => a.name.localeCompare(b.name));
            } catch (error) {
                processes = psProcesses.sort((a, b) => a.name.localeCompare(b.name));
            }
        } else {
            // Linux/other Unix systems
            const { stdout } = await execPromise('ps -eo pid,comm --no-headers');
            processes = stdout.split('\n')
                .filter(line => line.trim())
                .map(line => {
                    const parts = line.trim().split(/\s+/);
                    return {
                        name: parts[1],
                        pid: parts[0],
                    };
                })
                .filter(proc => proc.name && proc.name.length > 0)
                .sort((a, b) => a.name.localeCompare(b.name));
        }
        
        return processes;
    } catch (error) {
        console.error('Error getting running processes:', error);
        return [];
    }
});

ipcMain.on('open-link', (event, url) => {
    shell.openExternal(url);
});

ipcMain.on('toggle-usage-collection', async (event, value) => {
    config.anonymousUsage = value;
    await saveConfig();
});

ipcMain.handle('get-usage-collection', () => config.anonymousUsage);

// Auto-updater configuration
autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'hybes',
    repo: 'pairkiller'
});

// Enhanced auto-updater events
autoUpdater.on('checking-for-update', () => {
    console.log('[Pairkiller] Checking for updates...');
    debug('Checking for updates');
});

autoUpdater.on('update-available', (info) => {
    console.log('[Pairkiller] Update available:', info);
    new Notification({
        title: 'Pairkiller Update',
        body: `Version ${info.version} is available and will be downloaded automatically.`,
        silent: false
    }).show();
    openUpdateWindow();
});

autoUpdater.on('update-not-available', () => {
    console.log('[Pairkiller] No updates available');
    if (updateWindow) {
        updateWindow.webContents.send('update-status', 'You have the latest version.');
        setTimeout(() => updateWindow.close(), 2000);
    }
});

autoUpdater.on('error', (err) => {
    console.error('[Pairkiller] Auto-updater error:', err);
    
    // Handle different types of errors gracefully
    if (err.message && err.message.includes('404')) {
        console.log('[Pairkiller] Auto-updater: Release files not found (404). This is normal for new releases or development builds.');
        
        if (updateWindow) {
            updateWindow.webContents.send('update-status', 'No updates available at this time');
            setTimeout(() => updateWindow.close(), 2000);
        }
    } else if (err.message && err.message.includes('ENOTFOUND')) {
        console.log('[Pairkiller] Auto-updater: Network error - unable to reach update server.');
        
        if (updateWindow) {
            updateWindow.webContents.send('update-status', 'Unable to check for updates - please check your internet connection');
            setTimeout(() => updateWindow.close(), 3000);
        }
    } else if (err.message && err.message.includes('ECONNRESET')) {
        console.log('[Pairkiller] Auto-updater: Connection reset - retrying in 30 seconds.');
        
        if (updateWindow) {
            updateWindow.webContents.send('update-status', 'Connection interrupted - will retry automatically');
            setTimeout(() => updateWindow.close(), 3000);
        }
        
        // Retry after 30 seconds
        setTimeout(() => {
            if (process.env.NODE_ENV !== 'development') {
                autoUpdater.checkForUpdates().catch(console.error);
            }
        }, 30000);
    } else {
        // For other errors, capture in Sentry and show to user
        Sentry.captureException(err, {
            tags: { 
                component: 'auto-updater',
                platform: process.platform,
                version: app.getVersion()
            },
            extra: {
                environment: process.env.NODE_ENV || 'production',
                updateFeedUrl: autoUpdater.getFeedURL()
            }
        });
        
        if (updateWindow) {
            updateWindow.webContents.send('update-status', 'Error checking for updates - please try again later');
            setTimeout(() => updateWindow.close(), 3000);
        }
    }
});

autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress.percent);
    console.log(`[Pairkiller] Download progress: ${percent}%`);
    
    if (updateWindow) {
        updateWindow.webContents.send('update-progress', percent);
        updateWindow.webContents.send('update-status', `Downloading update: ${percent}%`);
    }
});

autoUpdater.on('update-downloaded', (info) => {
    console.log('[Pairkiller] Update downloaded successfully:', info);
    new Notification({
        title: 'Pairkiller Update Ready',
        body: `Version ${info.version} has been downloaded and is ready to install. Click to restart and update.`,
        silent: false
    }).show();
    
    if (updateWindow) {
        updateWindow.webContents.send('update-status', `Update v${info.version} ready to install`);
        updateWindow.webContents.send('update-downloaded', info);
    }
    
    // Auto-install after 10 seconds if user doesn't manually trigger it
    setTimeout(() => {
        if (updateWindow) {
            updateWindow.close();
        }
        autoUpdater.quitAndInstall(false, true);
    }, 10000);
});

// Update checking
setInterval(() => {
    if (process.env.NODE_ENV !== 'development') {
        autoUpdater.checkForUpdates().catch(console.error);
    }
}, 60 * 60 * 1000); // Check every hour

// Debug utility
function debug(...args) {
    if (process.env.NODE_ENV === 'development') {
        console.log('[DEBUG]', new Date().toISOString(), ...args);
    }
}

// Initialize and start
async function initialize() {
    try {
        debug('Starting application initialization');
        
        // Load configuration first
        await loadConfig();
        
        // Set up platform-specific UI
        if (isMacOS) {
            // On macOS, ensure dock icon is visible
            if (app.dock) {
                app.dock.show();
            }
            // Set up dock behavior
            setupDock();
            // Set up menu bar
            setupMenuBar();
        }
        
        // Set up tray/dock menu
        setupTray();
        
        // Start monitoring
        await startMonitoring();
        
        debug('Application initialized successfully');
        
        // On first run or if no windows are open, show settings on macOS
        if (isMacOS && (!settingsWindow && !aboutWindow && !updateWindow)) {
            debug('No windows open on macOS - opening settings window');
            setTimeout(() => openSettingsWindow(), 1000);
        }
        
    } catch (error) {
        console.error('Failed to initialize application:', error);
        Sentry.captureException(error);
    }
}

// App event handlers
app.whenReady().then(initialize);

app.on('browser-window-created', (e, window) => {
    if (process.env.NODE_ENV !== 'development') {
        window.webContents.on('devtools-opened', () => {
            window.webContents.closeDevTools();
        });
    }
});

// Handle window closing behavior - different for each platform
app.on('window-all-closed', (e) => {
    if (isMacOS) {
        // On macOS, keep the app running when all windows are closed
        // This is standard macOS behavior
        debug('All windows closed on macOS - keeping app running');
    } else {
        // On Windows/Linux, prevent closing to keep running in system tray
        e.preventDefault();
        debug('All windows closed - keeping app running in system tray');
    }
});

// Handle macOS dock icon clicks
app.on('activate', () => {
    if (isMacOS) {
        // This is called when the dock icon is clicked on macOS
        debug('App activated (dock icon clicked) - opening settings window');
        openSettingsWindow();
    }
});

// Handle before-quit - clean shutdown
app.on('before-quit', async (event) => {
    if (!app.isQuiting) {
        event.preventDefault();
        debug('Before quit prevented - stopping monitoring first');
        app.isQuiting = true;
        await stopMonitoring();
        app.quit();
    }
});

// Handle will-quit - final cleanup
app.on('will-quit', (event) => {
    if (!app.isQuiting) {
        event.preventDefault();
        debug('Will quit prevented - performing cleanup');
        stopMonitoring().then(() => {
            app.isQuiting = true;
            app.quit();
        });
    }
});

// Graceful shutdown handlers
process.on('SIGINT', async () => {
    await stopMonitoring();
    app.quit();
});

process.on('SIGTERM', async () => {
    await stopMonitoring();
    app.quit();
});

// Initial update check
setTimeout(() => {
    if (process.env.NODE_ENV !== 'development') {
        autoUpdater.checkForUpdatesAndNotify().catch(console.error);
    }
}, 10000); // Check after 10 seconds

function setupMenuBar() {
    if (!isMacOS) return;
    
    const template = [
        {
            label: 'Pairkiller',
            submenu: [
                {
                    label: 'About Pairkiller',
                    click: () => openAboutWindow()
                },
                { type: 'separator' },
                {
                    label: 'Preferences...',
                    accelerator: 'Cmd+,',
                    click: () => openSettingsWindow()
                },
                { type: 'separator' },
                {
                    label: monitoring ? 'Stop Monitoring' : 'Start Monitoring',
                    click: () => {
                        if (monitoring) {
                            stopMonitoring();
                        } else {
                            startMonitoring();
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Check for Updates...',
                    click: () => {
                        autoUpdater.checkForUpdatesAndNotify();
                    }
                },
                { type: 'separator' },
                {
                    label: 'Hide Pairkiller',
                    accelerator: 'Cmd+H',
                    role: 'hide'
                },
                {
                    label: 'Hide Others',
                    accelerator: 'Cmd+Alt+H',
                    role: 'hideothers'
                },
                {
                    label: 'Show All',
                    role: 'unhide'
                },
                { type: 'separator' },
                {
                    label: 'Quit Pairkiller',
                    accelerator: 'Cmd+Q',
                    click: () => {
                        app.isQuiting = true;
                        stopMonitoring();
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectall' }
            ]
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Settings',
                    accelerator: 'Cmd+,',
                    click: () => openSettingsWindow()
                },
                { type: 'separator' },
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'close' },
                { type: 'separator' },
                { role: 'front' }
            ]
        }
    ];
    
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// Update checking with enhanced safety
ipcMain.on('check-for-updates', () => {
    debug('Manual update check requested');
    autoUpdater.checkForUpdatesAndNotify().catch(err => {
        console.error('Manual update check failed:', err);
        if (updateWindow) {
            updateWindow.webContents.send('update-status', 'Failed to check for updates');
        }
    });
});

ipcMain.on('install-update', async () => {
    debug('Update installation requested');
    
    try {
        // Create config backup before update
        await createConfigBackup();
        
        // Notify user of installation
        if (updateWindow) {
            updateWindow.webContents.send('update-status', 'Installing update...');
        }
        
        // Stop monitoring to prevent issues during update
        if (monitoring) {
            await stopMonitoring();
        }
        
        // Install the update
        autoUpdater.quitAndInstall(false, true);
        
    } catch (error) {
        console.error('Error preparing for update installation:', error);
        Sentry.captureException(error, {
            tags: { component: 'update-installation' }
        });
        
        if (updateWindow) {
            updateWindow.webContents.send('update-status', 'Error preparing update - please try again');
        }
    }
});

// Create config backup before major updates
async function createConfigBackup() {
    try {
        const backupPath = `${configPath}.backup.${Date.now()}`;
        await fs.copyFile(configPath, backupPath);
        debug(`Config backup created at: ${backupPath}`);
        
        // Keep only the last 5 backups
        const configDir = path.dirname(configPath);
        const files = await fs.readdir(configDir);
        const backupFiles = files
            .filter(file => file.startsWith('config.json.backup.'))
            .map(file => ({
                name: file,
                path: path.join(configDir, file),
                time: parseInt(file.split('.').pop())
            }))
            .sort((a, b) => b.time - a.time);
        
        // Remove old backups
        for (let i = 5; i < backupFiles.length; i++) {
            await fs.unlink(backupFiles[i].path);
            debug(`Removed old backup: ${backupFiles[i].name}`);
        }
        
    } catch (error) {
        console.error('Error creating config backup:', error);
        // Don't throw here as backup failure shouldn't prevent updates
    }
}

// Restore config from backup if needed (called on app startup if config is corrupted)
async function restoreConfigFromBackup() {
    try {
        const configDir = path.dirname(configPath);
        const files = await fs.readdir(configDir);
        const backupFiles = files
            .filter(file => file.startsWith('config.json.backup.'))
            .map(file => ({
                name: file,
                path: path.join(configDir, file),
                time: parseInt(file.split('.').pop())
            }))
            .sort((a, b) => b.time - a.time);
        
        if (backupFiles.length > 0) {
            const latestBackup = backupFiles[0];
            await fs.copyFile(latestBackup.path, configPath);
            debug(`Config restored from backup: ${latestBackup.name}`);
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Error restoring config from backup:', error);
        return false;
    }
}
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
let backgroundMode = true; // Default to background mode on macOS
let isUpdating = false; // Flag to prevent operations during updates
let config = {
    appGroups: [],
    anonymousUsage: true,
    version: app.getVersion(),
    monitoring: {
        interval: 5000,
        enabled: true
    },
    ui: {
        theme: 'dark',
        animations: true,
        backgroundMode: isMacOS // Default background mode on macOS
    }
};

// Performance monitoring cache
const processCache = new Map();
const CACHE_DURATION = 5000; // 5 second cache - reduced frequency

// Batch processing optimization
let isProcessingBatch = false;
const batchQueue = new Set();

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
                    configVersion: loadedConfig.configVersion || app.getVersion(),
                    monitoring: {
                        interval: loadedConfig.monitoring?.interval || 5000,
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
                configVersion: app.getVersion(),
                monitoring: { interval: 5000, enabled: true },
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
            configVersion: app.getVersion(),
            monitoring: { interval: 5000, enabled: true },
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
    const currentVersion = app.getVersion(); // Get version from package.json
    
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
            migratedConfig.monitoring = { interval: 5000, enabled: true };
        }
    }
    
    // Migration from versions before 3.0.0
    if (compareVersions(configVersion, '3.0.0') < 0) {
        debug('Applying migration for v3.0.0');
        
        // Add UI settings if missing
        if (!migratedConfig.ui) {
            migratedConfig.ui = { 
                theme: 'dark', 
                animations: true,
                backgroundMode: isMacOS // Default to background mode on macOS
            };
        } else {
            // Ensure backgroundMode is set for macOS
            if (isMacOS && migratedConfig.ui.backgroundMode === undefined) {
                migratedConfig.ui.backgroundMode = true;
            }
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
    
    // Migration from versions before 4.1.0
    if (compareVersions(configVersion, '4.1.0') < 0) {
        debug('Applying migration for v4.1.0');
        
        // Add any new v4.1.0 specific settings here if needed
        // For now, no specific changes required
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

// Optimized process checking with caching and batching - now cross-platform
async function isTaskRunning(processName) {
    const now = Date.now();
    const cached = processCache.get(processName);
    
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
        return cached.running;
    }
    
    // Add to batch queue if system is under load
    if (isProcessingBatch) {
        batchQueue.add(processName);
        return cached ? cached.running : false;
    }
    
    try {
        isProcessingBatch = true;
        let isRunning = false;
        
        if (isWindows) {
            try {
                // Use faster wmic query with specific process name
                const { stdout } = await execPromise(`wmic process where "name='${processName}'" get ProcessId /format:value`, { timeout: 3000 });
                isRunning = stdout.includes('ProcessId=') && !stdout.includes('ProcessId=\r\r\n');
            } catch (error) {
                // Fallback to tasklist if wmic fails
                try {
                    const { stdout } = await execPromise(`tasklist /FI "IMAGENAME eq ${processName}" /NH /FO CSV`, { timeout: 3000 });
                    isRunning = stdout.toLowerCase().includes(processName.toLowerCase());
                } catch (fallbackError) {
                    // Handle common Windows errors that shouldn't be reported
                    if (fallbackError.message.includes('Access is denied') || 
                        fallbackError.message.includes('timeout') ||
                        fallbackError.code === 'ETIMEDOUT') {
                        debug(`Process check failed for ${processName} (access/timeout issue):`, fallbackError.message);
                        isRunning = false;
                    } else {
                        throw fallbackError;
                    }
                }
            }
        } else if (isMacOS) {
            // On macOS, we need to handle both .app bundles and executable names
            const appName = processName.replace('.exe', '');
            
            try {
                // First try to find the process by name
                const { stdout } = await execPromise(`pgrep -f "${appName}"`, { timeout: 5000 });
                isRunning = stdout.trim().length > 0;
            } catch (error) {
                // If pgrep fails, try ps command as fallback
                try {
                    const { stdout } = await execPromise(`ps aux | grep -i "${appName}" | grep -v grep`, { timeout: 5000 });
                    isRunning = stdout.trim().length > 0;
                } catch (psError) {
                    // Both methods failed - likely no process found or permission issue
                    debug(`Process check failed for ${processName}:`, psError.message);
                    isRunning = false;
                }
            }
        } else {
            // Linux/other Unix systems
            try {
                const appName = processName.replace('.exe', '');
                const { stdout } = await execPromise(`pgrep -f "${appName}"`, { timeout: 5000 });
                isRunning = stdout.trim().length > 0;
            } catch (error) {
                // Handle permission or timeout errors
                if (error.message.includes('Permission denied') || 
                    error.message.includes('timeout') ||
                    error.code === 'ETIMEDOUT') {
                    debug(`Process check failed for ${processName} (permission/timeout issue):`, error.message);
                    isRunning = false;
                } else {
                    throw error; // Re-throw unexpected errors
                }
            }
        }
        
        processCache.set(processName, {
            running: isRunning,
            timestamp: now
        });
        
        isProcessingBatch = false;
        return isRunning;
    } catch (error) {
        debug(`Error checking if ${processName} is running:`, error);
        
        // Only report truly unexpected errors to Sentry
        const shouldReport = !error.message.includes('timeout') &&
                           !error.message.includes('Access is denied') &&
                           !error.message.includes('Permission denied') &&
                           !error.message.includes('No such process') &&
                           !error.code === 'ETIMEDOUT' &&
                           !error.code === 'EACCES';
        
        if (shouldReport) {
            Sentry.captureException(error, {
                tags: { 
                    function: 'isTaskRunning', 
                    platform,
                    processName,
                    errorType: 'process_check_error'
                },
                extra: { 
                    processName,
                    errorCode: error.code,
                    signal: error.signal
                },
                level: 'warning'
            });
        }
        
        processCache.set(processName, {
            running: false,
            timestamp: now
        });
        isProcessingBatch = false;
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
            if (!monitoring || isUpdating) return;
            
            try {
                debug('\n=== Optimized App Check Cycle ===');
                
                // Skip if no app groups configured
                if (!config.appGroups || config.appGroups.length === 0) {
                    return;
                }
                
                // Process groups with a small delay to prevent system overload
                for (let i = 0; i < config.appGroups.length; i++) {
                    if (!monitoring) break; // Check if monitoring was stopped
                    
                    await processAppGroup(config.appGroups[i]);
                    
                    // Add small delay between groups to reduce CPU impact
                    if (i < config.appGroups.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                }
                
            } catch (error) {
                console.error('Error in optimized checkApps:', error);
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
                    
                    // Validate app path before attempting to launch
                    const validation = await validateAppPath(app.path || app.name);
                    if (!validation.valid) {
                        debug(`Skipping launch of ${app.name}: ${validation.reason}`);
                        return; // Don't attempt to launch invalid apps
                    }
                    
                    await ensureAppIsRunning(app.path || app.name);
                } else if (!shouldBeRunning && isRunning) {
                    debug(`Stopping ${app.name}`);
                    await stopApp(app.name);
                }
            } catch (error) {
                console.error(`Error processing controlled app ${app.name}:`, error);
                
                // Only report unexpected errors to Sentry
                if (!error.message.includes('ENOENT') && 
                    !error.message.includes('access') &&
                    !error.message.includes('permission') &&
                    !error.message.includes('timeout')) {
                    Sentry.captureException(error, {
                        tags: { 
                            function: 'processControlledApp',
                            appName: app.name,
                            platform
                        },
                        extra: {
                            appPath: app.path,
                            appAction: app.action,
                            shouldTakeAction
                        },
                        level: 'warning'
                    });
                }
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
        
        // First check if the app file exists
        try {
            await fs.access(appPath);
        } catch (accessError) {
            debug(`App path does not exist: ${appPath}`);
            // Don't throw error to Sentry for missing app paths - this is user configuration issue
            return;
        }
        
        const isAppRunning = await isTaskRunning(appName);
        if (!isAppRunning) {
            debug(`Starting app: ${appName}`);
            
            return new Promise((resolve, reject) => {
                let command;
                
                if (isWindows) {
                    // Escape the path properly for Windows
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
                
                exec(command, { timeout: 5000, windowsHide: true }, (error, stdout, stderr) => {
                    if (error) {
                        // Check for common error types that shouldn't be reported to Sentry
                        const errorMessage = error.message.toLowerCase();
                        
                        if (errorMessage.includes('access is denied') || 
                            errorMessage.includes('permission denied') ||
                            errorMessage.includes('file not found') ||
                            errorMessage.includes('no such file') ||
                            errorMessage.includes('cannot find the file') ||
                            errorMessage.includes('the system cannot find the file')) {
                            
                            debug(`App launch failed (user config issue): ${appName} - ${error.message}`);
                            // These are configuration issues, not app bugs - don't send to Sentry
                            resolve(); // Resolve instead of reject to prevent monitoring from stopping
                            return;
                        }
                        
                        // Only report unexpected errors to Sentry
                        console.error(`Unexpected error starting ${appName}:`, error);
                        Sentry.captureException(error, {
                            tags: { 
                                function: 'ensureAppIsRunning', 
                                platform,
                                errorType: 'unexpected_launch_error'
                            },
                            extra: { 
                                appPath, 
                                appName, 
                                command,
                                errorCode: error.code,
                                signal: error.signal
                            },
                            level: 'warning' // Reduce severity since app might still work
                        });
                        resolve(); // Don't reject to keep monitoring running
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
        // Only log unexpected errors
        debug(`Unexpected error in ensureAppIsRunning for ${appPath}:`, error);
        
        // Don't throw or report to Sentry unless it's truly unexpected
        if (!error.message.includes('ENOENT') && !error.message.includes('access')) {
            Sentry.captureException(error, {
                tags: { function: 'ensureAppIsRunning', platform },
                extra: { appPath },
                level: 'warning'
            });
        }
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
            
            exec(command, { timeout: 3000, windowsHide: true }, (error, stdout, stderr) => {
                if (error) {
                    // Handle common errors that shouldn't be reported to Sentry
                    const errorMessage = error.message.toLowerCase();
                    
                    if (errorMessage.includes('not found') || 
                        errorMessage.includes('no such process') ||
                        errorMessage.includes('access is denied') ||
                        errorMessage.includes('permission denied') ||
                        errorMessage.includes('no matching processes') ||
                        errorMessage.includes('timeout') ||
                        error.code === 'ETIMEDOUT' ||
                        error.code === 1) { // Exit code 1 often means "no process found"
                        
                        debug(`App stop completed for ${appName} (process not found or permission issue):`, error.message);
                        resolve(); // Resolve since the goal (app not running) is achieved
                        return;
                    }
                    
                    // Only report unexpected errors
                    console.error(`Unexpected error stopping ${appName}:`, error);
                    Sentry.captureException(error, {
                        tags: { 
                            function: 'stopApp',
                            platform,
                            errorType: 'unexpected_stop_error'
                        },
                        extra: { 
                            appName, 
                            command,
                            errorCode: error.code,
                            signal: error.signal,
                            stderr: stderr
                        },
                        level: 'warning'
                    });
                    resolve(); // Still resolve to keep monitoring running
                } else {
                    debug(`Successfully stopped ${appName}`);
                    resolve();
                }
            });
        });
    } catch (error) {
        debug(`Unexpected error in stopApp for ${appName}:`, error);
        
        // Only report truly unexpected errors
        if (!error.message.includes('timeout') && 
            !error.message.includes('permission') &&
            !error.message.includes('access')) {
            Sentry.captureException(error, {
                tags: { function: 'stopApp', platform },
                extra: { appName },
                level: 'warning'
            });
        }
        
        // Don't throw - resolve to keep monitoring running
    }
}

// Enhanced tray setup with platform-specific behavior
function setupTray() {
    try {
        if (isMacOS) {
            // On macOS, tray is primary interface in background mode
            tray = new Tray(path.join(__dirname, 'icon.png'));
            tray.setToolTip('Pairkiller - Right-click for options');
            
            // Handle tray clicks on macOS
            tray.on('click', () => {
                // Single click opens settings
                openSettingsWindow();
            });
            
            // Only set up dock if not in background mode
            if (!backgroundMode) {
                setupDock();
            }
        } else {
            // On Windows/Linux, use system tray as primary
            tray = new Tray(path.join(__dirname, 'icon.png'));
            tray.setToolTip('Pairkiller - App Monitor & Controller');
            tray.on('double-click', () => openSettingsWindow());
            tray.on('click', () => openSettingsWindow());
        }
        
        updateTrayMenu();
        
        tray.on('right-click', () => {
            tray.popUpContextMenu();
        });
        
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
        { type: 'separator' }
    ];
    
    // Add macOS-specific options
    if (isMacOS) {
        menuTemplate.push({
            label: backgroundMode ? '🖥️ Show in Dock' : '🫥 Hide from Dock',
            click: () => toggleBackgroundMode()
        });
        menuTemplate.push({ type: 'separator' });
    }
    
    menuTemplate.push({ 
        label: '🔄 Check for Updates',
        click: () => {
            autoUpdater.checkForUpdatesAndNotify();
        }
    });
    
    menuTemplate.push({ type: 'separator' });
    
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
    
    // Update dock menu on macOS if visible
    if (isMacOS && !backgroundMode) {
        setupDock();
    }
}

// Toggle background mode on macOS
function toggleBackgroundMode() {
    if (!isMacOS) return;
    
    backgroundMode = !backgroundMode;
    config.ui.backgroundMode = backgroundMode;
    
    if (backgroundMode) {
        // Hide from dock and cmd+tab
        if (app.dock) {
            app.dock.hide();
        }
        debug('Switched to background mode - hidden from dock');
    } else {
        // Show in dock and cmd+tab
        if (app.dock) {
            app.dock.show();
        }
        setupDock();
        debug('Switched to foreground mode - visible in dock');
    }
    
    // Save the preference
    saveConfig().catch(console.error);
    
    // Update tray menu to reflect new state
    updateTrayMenu();
}

// Enhanced window management
function openSettingsWindow() {
    if (settingsWindow) {
        if (isMacOS) {
            // On macOS, bring window to front and focus
            settingsWindow.show();
            settingsWindow.focus();
            if (!backgroundMode) {
                app.focus();
            }
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
        },
        // On macOS in background mode, don't show in dock when window opens
        skipTaskbar: isMacOS && backgroundMode
    });

    settingsWindow.loadFile('settings.html');
    
    settingsWindow.once('ready-to-show', () => {
        settingsWindow.show();
        if (isMacOS) {
            // On macOS, ensure the window comes to front
            settingsWindow.focus();
            if (!backgroundMode) {
                app.focus();
            }
        }
        if (process.env.NODE_ENV === 'development') {
            settingsWindow.webContents.openDevTools();
        }
    });

    settingsWindow.on('closed', () => {
        settingsWindow = null;
        // On macOS, update dock menu when window closes (if visible)
        if (isMacOS && !backgroundMode) {
            setupDock();
        }
    });
}

function openAboutWindow() {
    if (aboutWindow) {
        if (isMacOS) {
            aboutWindow.show();
            aboutWindow.focus();
            if (!backgroundMode) {
                app.focus();
            }
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
        titleBarStyle: isMacOS ? 'hiddenInset' : 'hidden',
        skipTaskbar: isMacOS && backgroundMode
    });

    aboutWindow.loadFile('about.html');
    aboutWindow.once('ready-to-show', () => {
        aboutWindow.show();
        if (isMacOS) {
            aboutWindow.focus();
            if (!backgroundMode) {
                app.focus();
            }
        }
    });

    aboutWindow.on('closed', () => {
        aboutWindow = null;
    });
}

function openUpdateWindow() {
    if (updateWindow && !updateWindow.isDestroyed()) {
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
        show: false,
        skipTaskbar: isMacOS && backgroundMode
    });
    
    updateWindow.loadFile('update.html');
    updateWindow.once('ready-to-show', () => {
        updateWindow.show();
    });
    
    updateWindow.on('closed', () => {
        updateWindow = null;
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

// Validate configuration before saving
async function validateConfig(newConfig) {
    const issues = [];
    
    if (!Array.isArray(newConfig.appGroups)) {
        issues.push('Invalid app groups configuration');
        return { valid: false, issues };
    }
    
    for (let i = 0; i < newConfig.appGroups.length; i++) {
        const group = newConfig.appGroups[i];
        
        if (!group.name || typeof group.name !== 'string') {
            issues.push(`App group ${i + 1}: Missing or invalid name`);
        }
        
        if (!Array.isArray(group.controlledApps)) {
            issues.push(`App group "${group.name}": Invalid controlled apps configuration`);
            continue;
        }
        
        // Validate controlled app paths
        for (let j = 0; j < group.controlledApps.length; j++) {
            const app = group.controlledApps[j];
            
            if (!app.name) {
                issues.push(`App group "${group.name}", app ${j + 1}: Missing app name`);
                continue;
            }
            
            if (app.path && app.path.trim() !== '') {
                const validation = await validateAppPath(app.path);
                if (!validation.valid) {
                    issues.push(`App group "${group.name}", app "${app.name}": ${validation.reason}`);
                }
            }
        }
    }
    
    return { valid: issues.length === 0, issues };
}

ipcMain.handle('save-settings', async (event, newConfig) => {
    try {
        debug('Saving new settings');
        
        // Validate configuration
        const validation = await validateConfig(newConfig);
        if (!validation.valid) {
            return { 
                success: false, 
                error: 'Configuration validation failed', 
                issues: validation.issues 
            };
        }
        
        // Update config
        config.appGroups = newConfig.appGroups;
        config.monitoring = { ...config.monitoring, ...newConfig.monitoring };
        config.ui = { ...config.ui, ...newConfig.ui };
        
        // Handle background mode changes on macOS
        if (isMacOS && config.ui.backgroundMode !== backgroundMode) {
            backgroundMode = config.ui.backgroundMode;
            if (backgroundMode) {
                if (app.dock) app.dock.hide();
            } else {
                if (app.dock) app.dock.show();
                setupDock();
            }
            updateTrayMenu();
        }
        
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
        Sentry.captureException(error, {
            tags: { function: 'save-settings' },
            level: 'error'
        });
        return { success: false, error: error.message };
    }
});

ipcMain.handle('validate-app-path', async (event, appPath) => {
    try {
        const validation = await validateAppPath(appPath);
        return validation;
    } catch (error) {
        return { valid: false, reason: `Validation error: ${error.message}` };
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
            // Use wmic for faster process listing
            try {
                const { stdout } = await execPromise('wmic process get Name,ProcessId /format:csv | findstr /v "^$"', { timeout: 5000 });
                processes = stdout.split('\n')
                    .filter(line => line.trim() && !line.startsWith('Node'))
                    .map(line => {
                        const parts = line.split(',');
                        if (parts.length >= 3) {
                            return {
                                name: parts[1]?.trim(),
                                pid: parts[2]?.trim(),
                            };
                        }
                        return null;
                    })
                    .filter(proc => proc && proc.name && proc.name.endsWith('.exe'))
                    .sort((a, b) => a.name.localeCompare(b.name));
            } catch (error) {
                // Fallback to tasklist if wmic fails
                const { stdout } = await execPromise('tasklist /FO CSV /NH', { timeout: 5000 });
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
            }
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

ipcMain.handle('toggle-background-mode', async () => {
    if (!isMacOS) return { success: false, error: 'Background mode only available on macOS' };
    
    try {
        toggleBackgroundMode();
        return { success: true, backgroundMode };
    } catch (error) {
        console.error('Error toggling background mode:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-background-mode', () => {
    return { backgroundMode: isMacOS ? backgroundMode : false };
});

// Auto-start management handlers
ipcMain.handle('get-auto-start', () => {
    const settings = app.getLoginItemSettings();
    return settings.openAtLogin;
});

ipcMain.handle('set-auto-start', async (event, enabled) => {
    try {
        if (isWindows) {
            // On Windows, use registry for more reliable auto-start
            const Registry = require('winreg');
            const regKey = new Registry({
                hive: Registry.HKCU,
                key: '\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
            });
            
            if (enabled) {
                await new Promise((resolve, reject) => {
                    regKey.set('Pairkiller', Registry.REG_SZ, `"${process.execPath}" --startup`, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            } else {
                await new Promise((resolve, reject) => {
                    regKey.remove('Pairkiller', (err) => {
                        if (err && err.code !== 'ENOENT') reject(err);
                        else resolve();
                    });
                });
            }
        } else {
            // For macOS and Linux, use Electron's built-in method
            app.setLoginItemSettings({
                openAtLogin: enabled,
                openAsHidden: true,
                args: ['--startup']
            });
        }
        
        // Save the preference to config
        if (!config.ui) config.ui = {};
        config.ui.autoStart = enabled;
        await saveConfig();
        
        return { success: true, enabled };
    } catch (error) {
        console.error('Error setting auto-start:', error);
        Sentry.captureException(error);
        return { success: false, error: error.message };
    }
});

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
    isUpdating = true; // Stop intensive operations during update
    
    new Notification({
        title: 'Pairkiller Update',
        body: `Version ${info.version} is available and will be downloaded automatically.`,
        silent: false
    }).show();
    openUpdateWindow();
});

autoUpdater.on('update-not-available', () => {
    console.log('[Pairkiller] No updates available');
    if (updateWindow && !updateWindow.isDestroyed()) {
        updateWindow.webContents.send('update-status', 'You have the latest version.');
        setTimeout(() => {
            if (updateWindow && !updateWindow.isDestroyed()) {
                updateWindow.close();
            }
        }, 2000);
    }
});

autoUpdater.on('error', (err) => {
    console.error('[Pairkiller] Auto-updater error:', err);
    
    // Handle different types of errors gracefully
    if (err.message && err.message.includes('404')) {
        console.log('[Pairkiller] Auto-updater: Release files not found (404). This is normal for new releases or development builds.');
        
        if (updateWindow && !updateWindow.isDestroyed()) {
            updateWindow.webContents.send('update-status', 'No updates available at this time');
            setTimeout(() => {
                if (updateWindow && !updateWindow.isDestroyed()) {
                    updateWindow.close();
                }
            }, 2000);
        }
    } else if (err.message && err.message.includes('ENOTFOUND')) {
        console.log('[Pairkiller] Auto-updater: Network error - unable to reach update server.');
        
        if (updateWindow && !updateWindow.isDestroyed()) {
            updateWindow.webContents.send('update-status', 'Unable to check for updates - please check your internet connection');
            setTimeout(() => {
                if (updateWindow && !updateWindow.isDestroyed()) {
                    updateWindow.close();
                }
            }, 3000);
        }
    } else if (err.message && err.message.includes('ECONNRESET')) {
        console.log('[Pairkiller] Auto-updater: Connection reset - retrying in 30 seconds.');
        
        if (updateWindow && !updateWindow.isDestroyed()) {
            updateWindow.webContents.send('update-status', 'Connection interrupted - will retry automatically');
            setTimeout(() => {
                if (updateWindow && !updateWindow.isDestroyed()) {
                    updateWindow.close();
                }
            }, 3000);
        }
        
        // Retry after 30 seconds
        setTimeout(() => {
            if (process.env.NODE_ENV !== 'development') {
                autoUpdater.checkForUpdates().catch(console.error);
            }
        }, 30000);
    } else if (err.message && (err.message.includes('code signature') || 
                               err.message.includes('code failed to satisfy') ||
                               err.message.includes('validation') ||
                               err.message.includes('not signed by the application owner'))) {
        console.log('[Pairkiller] Auto-updater: Code signature validation failed. This can happen with beta builds or during development.');
        
        if (updateWindow && !updateWindow.isDestroyed()) {
            updateWindow.webContents.send('update-status', 'Update validation failed - please download manually from GitHub');
            setTimeout(() => {
                if (updateWindow && !updateWindow.isDestroyed()) {
                    updateWindow.close();
                }
            }, 5000);
        }
        
        // Don't report code signature errors to Sentry - these are often environmental
        debug('Code signature validation error (not reporting to Sentry):', err.message);
    } else if (err.message && (err.message.includes('EACCES') || 
                               err.message.includes('permission denied') ||
                               err.message.includes('access denied'))) {
        console.log('[Pairkiller] Auto-updater: Permission denied - app may need to be run as administrator for updates.');
        
        if (updateWindow && !updateWindow.isDestroyed()) {
            updateWindow.webContents.send('update-status', 'Permission denied - try running as administrator');
            setTimeout(() => {
                if (updateWindow && !updateWindow.isDestroyed()) {
                    updateWindow.close();
                }
            }, 5000);
        }
        
        // Don't report permission errors to Sentry - these are user environment issues
        debug('Permission error during update (not reporting to Sentry):', err.message);
    } else if (err.message && err.message.includes('ENOSPC')) {
        console.log('[Pairkiller] Auto-updater: Insufficient disk space for update.');
        
        if (updateWindow && !updateWindow.isDestroyed()) {
            updateWindow.webContents.send('update-status', 'Insufficient disk space for update');
            setTimeout(() => {
                if (updateWindow && !updateWindow.isDestroyed()) {
                    updateWindow.close();
                }
            }, 5000);
        }
        
        // Don't report disk space errors to Sentry
        debug('Disk space error during update (not reporting to Sentry):', err.message);
    } else {
        // For other errors, capture in Sentry but with reduced severity and better filtering
        const shouldReport = !err.message.includes('net::') && 
                           !err.message.includes('fetch') &&
                           !err.message.includes('timeout') &&
                           !err.message.includes('certificate') &&
                           !err.message.includes('SSL') &&
                           !err.message.includes('TLS');
        
        if (shouldReport) {
            Sentry.captureException(err, {
                tags: { 
                    component: 'auto-updater',
                    platform: process.platform,
                    version: app.getVersion(),
                    errorType: 'updater_error'
                },
                extra: {
                    environment: process.env.NODE_ENV || 'production',
                    updateFeedUrl: autoUpdater.getFeedURL(),
                    errorCode: err.code,
                    errorName: err.name
                },
                level: 'warning' // Reduce severity for updater errors
            });
        } else {
            debug('Network/certificate error during update (not reporting to Sentry):', err.message);
        }
        
        if (updateWindow && !updateWindow.isDestroyed()) {
            updateWindow.webContents.send('update-status', 'Error checking for updates - please try again later');
            setTimeout(() => {
                if (updateWindow && !updateWindow.isDestroyed()) {
                    updateWindow.close();
                }
            }, 3000);
        }
    }
});

autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress.percent);
    console.log(`[Pairkiller] Download progress: ${percent}%`);
    
    // Temporarily pause monitoring to reduce system load during download
    if (monitoring && percent > 10) {
        debug('Temporarily pausing monitoring during update download');
        if (monitoringTimeout) {
            clearInterval(monitoringTimeout);
            monitoringTimeout = null;
        }
    }
    
    if (updateWindow && !updateWindow.isDestroyed()) {
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
    
    if (updateWindow && !updateWindow.isDestroyed()) {
        updateWindow.webContents.send('update-status', `Update v${info.version} ready to install`);
        updateWindow.webContents.send('update-downloaded', info);
    }
    
    // Auto-install after 10 seconds if user doesn't manually trigger it
    setTimeout(() => {
        if (updateWindow && !updateWindow.isDestroyed()) {
            updateWindow.close();
        }
        autoUpdater.quitAndInstall(false, true);
    }, 10000);
});

// Update checking - reduced frequency to prevent system slowdown
let updateCheckTimer = null;

function scheduleUpdateCheck() {
    if (updateCheckTimer) {
        clearTimeout(updateCheckTimer);
    }
    
    // Check every 4 hours instead of every hour to reduce system load
    updateCheckTimer = setTimeout(() => {
        if (process.env.NODE_ENV !== 'development') {
            autoUpdater.checkForUpdates().catch(error => {
                debug('Scheduled update check failed:', error.message);
                // Retry in 30 minutes if failed
                setTimeout(() => scheduleUpdateCheck(), 30 * 60 * 1000);
            });
        }
        scheduleUpdateCheck(); // Schedule next check
    }, 4 * 60 * 60 * 1000);
}

// Start the update checking cycle
scheduleUpdateCheck();

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
        
        // Check if app was started with --startup flag (auto-start on boot)
        const isStartupLaunch = process.argv.includes('--startup');
        if (isStartupLaunch) {
            debug('App started via auto-start on boot');
            // Start minimized to tray when auto-started
            if (!isMacOS) {
                // On Windows/Linux, prevent window from showing
                global.startMinimized = true;
            }
        }
        
        // Load configuration first
        await loadConfig();
        
        // Set background mode from config
        if (isMacOS && config.ui && config.ui.backgroundMode !== undefined) {
            backgroundMode = config.ui.backgroundMode;
        }
        
        // Set up platform-specific UI
        if (isMacOS) {
            if (backgroundMode) {
                // Start in background mode - hide dock icon
                if (app.dock) {
                    app.dock.hide();
                }
                debug('Starting in background mode - hidden from dock');
            } else {
                // Show in dock and set up dock menu
                if (app.dock) {
                    app.dock.show();
                }
                setupDock();
                debug('Starting in foreground mode - visible in dock');
            }
            // Always set up menu bar
            setupMenuBar();
        }
        
        // Set up tray (primary interface on macOS in background mode)
        setupTray();
        
        // Start monitoring
        await startMonitoring();
        
        debug('Application initialized successfully');
        
        // On macOS, only auto-open settings if not in background mode
        if (isMacOS && !backgroundMode && (!settingsWindow && !aboutWindow && !updateWindow)) {
            debug('No windows open on macOS (foreground mode) - opening settings window');
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

// Handle macOS dock icon clicks (only when visible)
app.on('activate', () => {
    if (isMacOS && !backgroundMode) {
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

// Initial update check - delayed to prevent startup slowdown
setTimeout(() => {
    if (process.env.NODE_ENV !== 'development') {
        autoUpdater.checkForUpdatesAndNotify().catch(error => {
            debug('Initial update check failed:', error.message);
        });
    }
}, 30000); // Check after 30 seconds to allow app to fully initialize

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
                    label: backgroundMode ? 'Show in Dock' : 'Hide from Dock',
                    click: () => toggleBackgroundMode()
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
        if (updateWindow && !updateWindow.isDestroyed()) {
            updateWindow.webContents.send('update-status', 'Failed to check for updates');
        }
    });
});

ipcMain.on('install-update', async () => {
    debug('Update installation requested');
    isUpdating = true;
    
    try {
        // Create config backup before update
        await createConfigBackup();
        
        // Notify user of installation
        if (updateWindow && !updateWindow.isDestroyed()) {
            updateWindow.webContents.send('update-status', 'Preparing for installation...');
        }
        
        // Stop all monitoring and cleanup to prevent system conflicts
        if (monitoring) {
            debug('Stopping monitoring for update installation');
            await stopMonitoring();
        }
        
        // Clear all caches and timers
        processCache.clear();
        if (updateCheckTimer) {
            clearTimeout(updateCheckTimer);
        }
        
        // Small delay to ensure cleanup is complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (updateWindow && !updateWindow.isDestroyed()) {
            updateWindow.webContents.send('update-status', 'Installing update...');
        }
        
        // Install the update with silent restart
        autoUpdater.quitAndInstall(true, true);
        
    } catch (error) {
        console.error('Error preparing for update installation:', error);
        isUpdating = false;
        
        Sentry.captureException(error, {
            tags: { component: 'update-installation' }
        });
        
        if (updateWindow && !updateWindow.isDestroyed()) {
            updateWindow.webContents.send('update-status', 'Error preparing update - please try again');
        }
        
        // Restart monitoring if update failed
        if (config.monitoring.enabled) {
            setTimeout(() => startMonitoring(), 2000);
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

// Validate app path before attempting to launch
async function validateAppPath(appPath) {
    if (!appPath || typeof appPath !== 'string' || appPath.trim() === '') {
        return { valid: false, reason: 'Empty or invalid path' };
    }
    
    try {
        // Check if file exists
        await fs.access(appPath);
        
        // Additional platform-specific validation
        if (isWindows) {
            if (!appPath.toLowerCase().endsWith('.exe') && 
                !appPath.toLowerCase().endsWith('.bat') && 
                !appPath.toLowerCase().endsWith('.cmd')) {
                return { valid: false, reason: 'Not a valid Windows executable' };
            }
        } else if (isMacOS) {
            // On macOS, check if it's an .app bundle or executable
            const stats = await fs.stat(appPath);
            if (!stats.isFile() && !appPath.endsWith('.app')) {
                return { valid: false, reason: 'Not a valid macOS application' };
            }
        }
        
        return { valid: true };
    } catch (error) {
        return { valid: false, reason: `File not accessible: ${error.message}` };
    }
}
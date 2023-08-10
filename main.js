const fs = require('fs');
const { app, BrowserWindow, Menu, Tray, shell, ipcMain } = require('electron');
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const fetch = require('node-fetch');

const configPath = path.join(app.getPath('userData'), 'config.json');
const defaultBlitzPath = path.join(app.getPath('home'), 'AppData', 'Local', 'Programs', 'Blitz', 'Blitz.exe');

const LEAGUE_CLIENT = 'LeagueClient.exe';
const LEAGUE_GAME = 'League of Legends.exe';
const BLITZ_APP = 'Blitz.exe';

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

ipcMain.on('open-link', (event, url) => {
    shell.openExternal(url);
});

ipcMain.on('toggle-usage-collection', (event, value) => {
  config.anonymousUsage = value;
  fs.writeFileSync(configPath, JSON.stringify(config));
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

async function isTaskRunning(taskName) {
    try {
        const { stdout } = await exec(`tasklist /nh /fi "imagename eq ${taskName}" | find /i "${taskName}"`);
        return stdout.includes(taskName);
    } catch (error) {
        console.error(`Error checking task ${taskName}:`, error);
        return false;
    }
}

async function startMonitoring() {
    setInterval(async () => {
        try {
            if (monitoring) {
                const isLeagueClientRunning = await isTaskRunning(LEAGUE_CLIENT);
                const isLeagueGameRunning = await isTaskRunning(LEAGUE_GAME);
                const isBlitzAppRunning = await isTaskRunning(BLITZ_APP);

                if (isLeagueClientRunning || isLeagueGameRunning) {
                    if (!isBlitzAppRunning) {
                        exec(`start "" "${blitzPath}"`);
                    }
                } else {
                    if (isBlitzAppRunning) {
                        exec('taskkill /im Blitz.exe /f');
                    }
                }
            }
        } catch (error) {
            console.error('Error in startMonitoring:', error);
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
    tray.on('click', openAboutWindow);
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
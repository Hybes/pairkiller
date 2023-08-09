const { app, BrowserWindow, Menu, Tray, dialog, fs } = require('electron');
const path = require('path');
const { exec } = require('child_process');

let tray = null;
let win = null;
let monitoring = false;const defaultBlitzPath = path.join(app.getPath('home'), 'AppData', 'Local', 'Programs', 'Blitz', 'Blitz.exe');
let blitzPath = defaultBlitzPath;


const configPath = path.join(app.getPath('userData'), 'config.json');

const contextMenu = Menu.buildFromTemplate([
  {
    label: 'Toggle Monitoring',
    click: () => {
      monitoring = !monitoring;
      if (monitoring) {
        startMonitoring();
      }
    },
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
    label: 'Quit',
    click: () => {
      app.quit();
    },
  },
]);


// Load configuration if it exists
if (fs.existsSync(configPath)) {
  const configData = JSON.parse(fs.readFileSync(configPath));
  blitzPath = configData.blitzPath || blitzPath;
}

function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
    },
    show: false, // Hidden window
  });

  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  tray = new Tray(path.join(__dirname, 'icon.png'));
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Toggle Monitoring',
      click: () => {
        monitoring = !monitoring;
        if (monitoring) {
          startMonitoring();
        }
      },
    },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip('League-Blitz Monitor');
  tray.setContextMenu(contextMenu);
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
      // Check if League of Legends client is running
      exec('tasklist /nh /fi "imagename eq LeagueClient.exe" | find /i "LeagueClient.exe"', (error, stdout) => {
        if (stdout.includes('LeagueClient.exe')) {
          // Check if Blitz is running, if not, open it
          exec('tasklist /nh /fi "imagename eq Blitz.exe" | find /i "Blitz.exe"', (errorBlitz, stdoutBlitz) => {
            if (!stdoutBlitz.includes('Blitz.exe')) {
              exec('start "" "' + blitzPath + '"');
            }
          });
        } else {
          // If League of Legends client is not running, close Blitz if it is running
          exec('tasklist /nh /fi "imagename eq Blitz.exe" | find /i "Blitz.exe"', (errorBlitz, stdoutBlitz) => {
            if (stdoutBlitz.includes('Blitz.exe')) {
              exec('taskkill /im Blitz.exe /f');
            }
          });
        }
      });
    }
  }, 3000); // Adjust the interval as needed
}

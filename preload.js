const Sentry = require('@sentry/electron');

if (process.env.NODE_ENV !== 'development') {
  Sentry.init({
    dsn: 'https://83d267b1eff14ce29e39bd6c58b05bc8@error.brth.uk/1',
    // other options
  });
}

nonExistingFunctionInPreload();

window.ipcRenderer = require('electron').ipcRenderer;

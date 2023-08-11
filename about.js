document.addEventListener('DOMContentLoaded', (event) => {
  const usageCollectionToggle = document.getElementById('usageCollectionToggle');
  const { ipcRenderer } = require('electron');

  document.addEventListener('click', (event) => {
      let targetElement = event.target;
      while (targetElement != null) {
          if (targetElement.classList && targetElement.classList.contains('external-link') && targetElement.href) {
              event.preventDefault();
              ipcRenderer.send('open-link', targetElement.href);
              return;
          }
          targetElement = targetElement.parentElement;
      }
  });

  document.getElementById('checkForUpdatesButton').addEventListener('click', () => {
      ipcRenderer.send('check-for-updates');
  });

  ipcRenderer.invoke('get-usage-collection').then((value) => {
      usageCollectionToggle.checked = value;
  });

  ipcRenderer.on('update-status', (event, status, info) => {
      let message = '';
      switch (status) {
          case 'available':
              message = `Update to version ${info} is available and being downloaded.`;
              break;
          case 'downloaded':
              const response = confirm(`Update to version ${info} has been downloaded. Would you like to install and restart now?`);
              if (response) {
                  ipcRenderer.send('install-update');
              }
              return; // We don't want to show an alert after this since we already showed a confirmation dialog.
          case 'not-available':
              message = 'You have the latest version installed.';
              break;
          case 'error':
              message = `Error checking for updates: ${info}`;
              break;
      }
      if (message) {
          alert(message); // Display the feedback message to the user
      }
  });

  usageCollectionToggle.addEventListener('change', () => {
      ipcRenderer.send('toggle-usage-collection', usageCollectionToggle.checked);
  });
});

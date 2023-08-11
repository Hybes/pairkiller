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

  ipcRenderer.on('update-available', (event, version) => {
    // Inform the user that an update is available and is being downloaded
    console.log(`Update to version ${version} is available and being downloaded.`);
});

ipcRenderer.on('update-downloaded', (event, version) => {
    // Prompt the user to restart and install the update
    const response = confirm(`Update to version ${version} has been downloaded. Would you like to install and restart now?`);
    if (response) {
        ipcRenderer.send('install-update');
    }
});

  ipcRenderer.invoke('get-usage-collection').then((value) => {
      usageCollectionToggle.checked = value;
  });

  ipcRenderer.on('no-update-available', () => {
    alert("You are using the latest version of the application!");
});

  usageCollectionToggle.addEventListener('change', () => {
    ipcRenderer.send('toggle-usage-collection', usageCollectionToggle.checked);
  });

});

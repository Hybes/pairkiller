document.addEventListener('DOMContentLoaded', (event) => {
    const usageCollectionToggle = document.getElementById('usageCollectionToggle');
    const { ipcRenderer } = require('electron');

    // Get and display version
    async function displayVersion() {
        const version = await ipcRenderer.invoke('get-version');
        const versionLink = document.querySelector('#version-number a');
        versionLink.textContent = `Version ${version}`;
        versionLink.href = 'https://github.com/hybes/pairkiller';
    }
    displayVersion();

    // Load initial config
    ipcRenderer.invoke('get-config').then(config => {
        usageCollectionToggle.checked = config.anonymousUsage;
    });

    // Event Listeners
    usageCollectionToggle.addEventListener('change', () => {
        ipcRenderer.send('toggle-usage-collection', usageCollectionToggle.checked);
    });

    document.getElementById('checkForUpdatesButton').addEventListener('click', () => {
        ipcRenderer.send('check-for-updates');
    });

    // Handle external links
    document.querySelectorAll('.external-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            ipcRenderer.send('open-link', e.target.closest('a').href);
        });
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
});

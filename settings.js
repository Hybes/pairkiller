const { ipcRenderer } = require('electron');
const path = require('path');

let config;

document.addEventListener('DOMContentLoaded', async () => {
    const addGroupButton = document.getElementById('addGroupButton');
    const saveButton = document.getElementById('saveSettingsButton');
    const appGroups = document.getElementById('appGroups');

    // Load initial config
    config = await ipcRenderer.invoke('get-config');
    
    // Load existing groups
    if (config.appGroups) {
        config.appGroups.forEach(group => {
            createGroupElement(group);
        });
    }

    // Event Listeners
    addGroupButton.addEventListener('click', () => {
        createGroupElement();
    });

    saveButton.addEventListener('click', saveSettings);
});

function createGroupElement(groupData = null) {
    const template = document.getElementById('groupTemplate');
    const groupElement = template.content.cloneNode(true);
    const appGroups = document.getElementById('appGroups');
    const group = groupElement.querySelector('.app-group');

    if (groupData) {
        group.querySelector('.group-name').value = groupData.name || '';
        group.querySelector('.condition-select').value = groupData.condition || 'all';
        group.querySelector('.reverse-toggle').checked = groupData.reverse || false;
        
        // Load monitored apps
        if (groupData.monitoredApps) {
            groupData.monitoredApps.forEach(app => {
                addAppEntry(group.querySelector('.monitored-apps-list'), app);
            });
        }

        // Load controlled apps
        if (groupData.controlledApps) {
            groupData.controlledApps.forEach(app => {
                addAppEntry(group.querySelector('.controlled-apps-list'), app, true);
            });
        }
    }

    // Set up event listeners
    setupGroupEventListeners(group);
    appGroups.appendChild(group);
}

function setupGroupEventListeners(groupElement) {
    const deleteGroupBtn = groupElement.querySelector('.delete-group');
    const duplicateGroupBtn = groupElement.querySelector('.duplicate-group');
    const addMonitoredAppBtn = groupElement.querySelector('.add-monitored-app');
    const addControlledAppBtn = groupElement.querySelector('.add-controlled-app');

    deleteGroupBtn.addEventListener('click', () => {
        groupElement.remove();
    });

    duplicateGroupBtn.addEventListener('click', () => {
        const groupData = {
            name: groupElement.querySelector('.group-name').value + ' (Copy)',
            condition: groupElement.querySelector('.condition-select').value,
            reverse: groupElement.querySelector('.reverse-toggle').checked,
            monitoredApps: [],
            controlledApps: []
        };

        // Copy monitored apps
        groupElement.querySelector('.monitored-apps-list').querySelectorAll('.app-entry').forEach(appEntry => {
            const name = appEntry.querySelector('.app-name').value;
            const path = appEntry.querySelector('.app-path').value;
            if (name && path) {
                groupData.monitoredApps.push({ name, path });
            }
        });

        // Copy controlled apps
        groupElement.querySelector('.controlled-apps-list').querySelectorAll('.app-entry').forEach(appEntry => {
            const name = appEntry.querySelector('.app-name').value;
            const path = appEntry.querySelector('.app-path').value;
            const action = appEntry.querySelector('.app-action').value;
            if (name && path) {
                groupData.controlledApps.push({ name, path, action });
            }
        });

        createGroupElement(groupData);
    });

    addMonitoredAppBtn.addEventListener('click', () => {
        addAppEntry(groupElement.querySelector('.monitored-apps-list'));
    });

    addControlledAppBtn.addEventListener('click', () => {
        addAppEntry(groupElement.querySelector('.controlled-apps-list'), null, true);
    });
}

function addAppEntry(container, appData = null, isControlled = false) {
    const template = document.getElementById('appEntryTemplate');
    const appEntry = template.content.cloneNode(true).querySelector('.app-entry');

    if (appData) {
        appEntry.querySelector('.app-name').value = appData.name || '';
        appEntry.querySelector('.app-path').value = appData.path || '';
        if (isControlled) {
            const actionSelect = appEntry.querySelector('.app-action');
            actionSelect.style.display = 'block';
            actionSelect.value = appData.action || 'start';
        }
    }

    const deleteBtn = appEntry.querySelector('.delete-app');
    const browseBtn = appEntry.querySelector('.browse-app');
    const appNameInput = appEntry.querySelector('.app-name');
    const appPathInput = appEntry.querySelector('.app-path');

    deleteBtn.addEventListener('click', () => {
        appEntry.remove();
    });

    browseBtn.addEventListener('click', async () => {
        const result = await ipcRenderer.invoke('open-file-dialog');
        if (result.filePath) {
            appPathInput.value = result.filePath;
            appNameInput.value = path.basename(result.filePath);
        }
    });

    if (isControlled) {
        appEntry.querySelector('.app-action').style.display = 'block';
    }

    container.appendChild(appEntry);
}

function saveSettings() {
    const groups = [];
    document.querySelectorAll('.app-group').forEach(groupElement => {
        const group = {
            name: groupElement.querySelector('.group-name').value,
            condition: groupElement.querySelector('.condition-select').value,
            reverse: groupElement.querySelector('.reverse-toggle').checked,
            monitoredApps: [],
            controlledApps: []
        };

        // Get monitored apps
        groupElement.querySelector('.monitored-apps-list').querySelectorAll('.app-entry').forEach(appEntry => {
            const name = appEntry.querySelector('.app-name').value;
            const path = appEntry.querySelector('.app-path').value;
            if (name) {
                group.monitoredApps.push({ name, path });
            }
        });

        // Get controlled apps
        groupElement.querySelector('.controlled-apps-list').querySelectorAll('.app-entry').forEach(appEntry => {
            const name = appEntry.querySelector('.app-name').value;
            const path = appEntry.querySelector('.app-path').value;
            const action = appEntry.querySelector('.app-action').value;
            if (name) {
                group.controlledApps.push({ name, path, action });
            }
        });

        if (group.name) {
            groups.push(group);
        }
    });

    config.appGroups = groups;
    ipcRenderer.send('save-config', config);
}

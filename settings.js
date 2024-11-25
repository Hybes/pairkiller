const { ipcRenderer } = require('electron');
const path = require('path');

let config;

document.addEventListener('DOMContentLoaded', async () => {
    const addGroupButton = document.getElementById('addGroupButton');
    const saveButton = document.getElementById('saveSettingsButton');
    const appGroups = document.getElementById('appGroups');

    // Load initial config
    config = await ipcRenderer.invoke('get-config');
    
    // Load presets dynamically
    await loadPresets();

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

async function loadPresets() {
    const presets = await ipcRenderer.invoke('get-presets');
    const presetsContainer = document.querySelector('.grid.grid-cols-2');
    presetsContainer.innerHTML = ''; // Clear existing presets

    Object.entries(presets).forEach(([key, preset]) => {
        const button = document.createElement('button');
        button.className = 'add-preset bg-stone-800 hover:bg-stone-700 p-4 rounded-lg text-left';
        button.dataset.preset = key;
        
        button.innerHTML = `
            <div class="font-semibold text-lg mb-1">${preset.name}</div>
            <div class="text-sm text-stone-400">${preset.description || ''}</div>
        `;

        button.addEventListener('click', () => {
            createGroupElement({
                name: preset.name,
                condition: preset.condition || 'all',
                monitoredApps: [...preset.monitoredApps],
                controlledApps: [...preset.controlledApps]
            });
        });

        presetsContainer.appendChild(button);
    });
}

function createPresetElement(key, preset) {
    const template = document.getElementById('presetTemplate');
    const presetElement = template.content.cloneNode(true);
    const presetsContainer = document.getElementById('presets');
    const entry = presetElement.querySelector('.preset-entry');

    // Set up the preset
    entry.querySelector('.preset-name').textContent = preset.name;
    entry.querySelector('.preset-toggle').checked = preset.enabled;
    entry.querySelector('.monitored-apps').textContent = `Monitors: ${preset.monitoredApps.join(', ')}`;
    
    // Store the preset key
    entry.dataset.presetKey = key;

    // Add toggle event listener
    entry.querySelector('.preset-toggle').addEventListener('change', (e) => {
        config.presets[key].enabled = e.target.checked;
    });

    presetsContainer.appendChild(entry);
}

function createGroupElement(groupData = null) {
    const template = document.getElementById('groupTemplate');
    const groupElement = template.content.cloneNode(true);
    const group = groupElement.querySelector('.app-group');

    if (groupData) {
        // Set group name and condition
        group.querySelector('.group-name').value = groupData.name || '';
        group.querySelector('.condition-select').value = groupData.condition || 'all';
        
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

    // Set up event listeners for this group
    setupGroupEventListeners(group);
    
    // Add the group to the DOM
    document.getElementById('appGroups').appendChild(group);
    return group;
}

function setupGroupEventListeners(group) {
    // Add monitored app
    group.querySelector('.add-monitored-app').addEventListener('click', () => {
        addAppEntry(group.querySelector('.monitored-apps-list'));
    });

    // Add controlled app
    group.querySelector('.add-controlled-app').addEventListener('click', () => {
        addAppEntry(group.querySelector('.controlled-apps-list'), null, true);
    });

    // Delete group
    group.querySelector('.delete-group').addEventListener('click', () => {
        group.remove();
    });

    // Duplicate group
    group.querySelector('.duplicate-group').addEventListener('click', () => {
        const groupData = getGroupData(group);
        createGroupElement(groupData);
    });
}

function addAppEntry(container, appData = null, isControlled = false) {
    const template = document.getElementById('appEntryTemplate');
    const appEntry = template.content.cloneNode(true);
    const entry = appEntry.querySelector('.app-entry');
    const actionContainer = entry.querySelector('.app-action-container');

    if (appData) {
        entry.querySelector('.app-name').value = appData.name || '';
        if (appData.path) {
            entry.querySelector('.app-path').value = appData.path;
        }
        if (isControlled && appData.action) {
            entry.querySelector('.app-action').value = appData.action;
        }
    }

    // Show/hide action select based on whether it's a controlled app
    actionContainer.style.display = isControlled ? 'block' : 'none';

    // Browse button
    entry.querySelector('.browse-button').addEventListener('click', async () => {
        const result = await ipcRenderer.invoke('open-file-dialog');
        if (result) {
            const appPath = result[0];
            entry.querySelector('.app-path').value = appPath;
            entry.querySelector('.app-name').value = path.basename(appPath);
        }
    });

    // Delete button
    entry.querySelector('.delete-app').addEventListener('click', () => {
        entry.remove();
    });

    container.appendChild(entry);
}

function getGroupData(groupElement) {
    const group = {
        name: groupElement.querySelector('.group-name').value,
        condition: groupElement.querySelector('.condition-select').value,
        monitoredApps: [],
        controlledApps: []
    };

    // Get monitored apps
    groupElement.querySelectorAll('.monitored-apps-list .app-entry').forEach(appEntry => {
        const appData = {
            name: appEntry.querySelector('.app-name').value
        };
        const path = appEntry.querySelector('.app-path').value;
        if (path) {
            appData.path = path;
        }
        group.monitoredApps.push(appData);
    });

    // Get controlled apps
    groupElement.querySelectorAll('.controlled-apps-list .app-entry').forEach(appEntry => {
        const appData = {
            name: appEntry.querySelector('.app-name').value,
            action: appEntry.querySelector('.app-action').value
        };
        const path = appEntry.querySelector('.app-path').value;
        if (path) {
            appData.path = path;
        }
        group.controlledApps.push(appData);
    });

    return group;
}

async function saveSettings() {
    // Save app groups
    const groups = [];
    document.querySelectorAll('.app-group').forEach(groupElement => {
        const groupData = getGroupData(groupElement);
        if (groupData.name && (groupData.monitoredApps.length > 0 || groupData.controlledApps.length > 0)) {
            groups.push(groupData);
        }
    });

    // Save configuration
    config.appGroups = groups;
    await ipcRenderer.invoke('save-settings', config);
    window.close();
}

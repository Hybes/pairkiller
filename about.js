const { ipcRenderer } = require('electron');

let isCheckingUpdates = false;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initializeAboutPage();
    } catch (error) {
        console.error('Failed to initialize about page:', error);
        showStatus('Failed to load page information', 'error');
    }
});

async function initializeAboutPage() {
    try {
        await Promise.all([
            setupVersion(),
            setupUsageToggle(),
            setupEventListeners()
        ]);
        
        showStatus('Ready', 'success');
    } catch (error) {
        throw error;
    }
}

async function setupVersion() {
    try {
        const version = await ipcRenderer.invoke('get-version');
        const versionLink = document.getElementById('versionLink');
        
        versionLink.textContent = `v${version}`;
        versionLink.href = 'https://github.com/hybes/pairkiller/releases/tag/v' + version;
        versionLink.title = `View release notes for version ${version}`;
    } catch (error) {
        console.error('Error loading version:', error);
        const versionLink = document.getElementById('versionLink');
        versionLink.textContent = 'Unknown';
        versionLink.href = 'https://github.com/hybes/pairkiller';
    }
}

async function setupUsageToggle() {
    try {
        const usageToggle = document.getElementById('usageToggle');
        const usageEnabled = await ipcRenderer.invoke('get-usage-collection');
        
        if (usageEnabled) {
            usageToggle.classList.add('active');
        }
        
        usageToggle.addEventListener('click', () => {
            const isActive = usageToggle.classList.toggle('active');
            ipcRenderer.send('toggle-usage-collection', isActive);
            
            showStatus(
                isActive ? 'Anonymous usage data enabled' : 'Anonymous usage data disabled',
                'success'
            );
        });
    } catch (error) {
        console.error('Error setting up usage toggle:', error);
        showStatus('Failed to load privacy settings', 'error');
    }
}

function setupEventListeners() {
    const checkUpdatesBtn = document.getElementById('checkUpdatesBtn');
    
    checkUpdatesBtn.addEventListener('click', handleUpdateCheck);
    
    document.querySelectorAll('.external-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const url = e.target.closest('a').href;
            ipcRenderer.send('open-link', url);
        });
    });
    
    setupKeyboardShortcuts();
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'u') {
            e.preventDefault();
            handleUpdateCheck();
        }
        
        if (e.key === 'Escape') {
            window.close();
        }
    });
}

async function handleUpdateCheck() {
    if (isCheckingUpdates) return;
    
    try {
        isCheckingUpdates = true;
        updateCheckButton(true);
        showStatus('Checking for updates...', 'info');
        
        ipcRenderer.send('check-for-updates');
        
        setTimeout(() => {
            if (isCheckingUpdates) {
                isCheckingUpdates = false;
                updateCheckButton(false);
                showStatus('Update check completed', 'success');
            }
        }, 10000);
        
    } catch (error) {
        console.error('Error checking for updates:', error);
        isCheckingUpdates = false;
        updateCheckButton(false);
        showStatus('Failed to check for updates', 'error');
    }
}

function updateCheckButton(checking) {
    const button = document.getElementById('checkUpdatesBtn');
    
    if (checking) {
        button.disabled = true;
        button.innerHTML = `
            <div class="loading-spinner"></div>
            Checking...
        `;
    } else {
        button.disabled = false;
        button.innerHTML = `
            <i class="fas fa-sync-alt"></i>
            Check for Updates
        `;
    }
}

function showStatus(message, type = 'info') {
    const statusElement = document.getElementById('updateStatus');
    statusElement.textContent = message;
    statusElement.className = `status-message ${type === 'success' ? 'status-success' : ''}`;
    
    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            statusElement.textContent = '';
        }, 5000);
    }
}

function showUpdateDialog(title, message, onConfirm, confirmText = 'Confirm', cancelText = 'Cancel') {
    const dialog = document.createElement('div');
    dialog.className = 'dialog-overlay';
    dialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        animation: fadeIn 0.2s ease-out;
    `;
    
    dialog.innerHTML = `
        <div class="dialog" style="
            background: var(--surface-elevated);
            border: 1px solid var(--border-color);
            border-radius: 1rem;
            padding: 2rem;
            max-width: 400px;
            width: 90%;
            box-shadow: var(--shadow);
            animation: scaleIn 0.2s ease-out;
        ">
            <h3 style="margin: 0 0 1rem 0; color: var(--text-primary); font-size: 1.25rem; font-weight: 600;">${escapeHtml(title)}</h3>
            <p style="margin: 0 0 2rem 0; color: var(--text-secondary); line-height: 1.5;">${escapeHtml(message)}</p>
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                ${onConfirm ? `<button class="btn btn-secondary cancel-btn">${escapeHtml(cancelText)}</button>` : ''}
                <button class="btn btn-primary confirm-btn">${escapeHtml(confirmText)}</button>
            </div>
        </div>
    `;
    
    const confirmBtn = dialog.querySelector('.confirm-btn');
    const cancelBtn = dialog.querySelector('.cancel-btn');
    
    confirmBtn.addEventListener('click', () => {
        document.body.removeChild(dialog);
        if (onConfirm) onConfirm();
    });
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(dialog);
        });
    }
    
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
            document.body.removeChild(dialog);
        }
    });
    
    document.body.appendChild(dialog);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

ipcRenderer.on('update-status', (event, status, info) => {
    isCheckingUpdates = false;
    updateCheckButton(false);
    
    switch (status) {
        case 'checking-for-update':
            showStatus('Checking for updates...', 'info');
            break;
            
        case 'update-available':
            showStatus(`Update v${info?.version || 'latest'} is available and downloading...`, 'success');
            break;
            
        case 'update-not-available':
            showStatus('You have the latest version!', 'success');
            break;
            
        case 'update-downloaded':
            showUpdateDialog(
                'Update Ready',
                `Version ${info?.version || 'latest'} has been downloaded and is ready to install. Would you like to restart the application now?`,
                () => {
                    ipcRenderer.send('install-update');
                },
                'Restart Now',
                'Later'
            );
            break;
            
        case 'error':
            const errorMessage = info?.message || info || 'Unknown error occurred';
            console.error('Update error:', errorMessage);
            showStatus(`Update check failed: ${errorMessage}`, 'error');
            break;
            
        case 'download-progress':
            const percent = Math.round(info?.percent || 0);
            showStatus(`Downloading update: ${percent}%`, 'info');
            break;
            
        default:
            console.log('Unknown update status:', status, info);
    }
});

const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    
    @keyframes scaleIn {
        from {
            transform: scale(0.9);
            opacity: 0;
        }
        to {
            transform: scale(1);
            opacity: 1;
        }
    }
    
    .btn-primary {
        background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
        color: white;
        border: none;
    }
    
    .btn-primary:hover {
        background: linear-gradient(135deg, var(--primary-hover), #1d4ed8);
    }
`;
document.head.appendChild(style);

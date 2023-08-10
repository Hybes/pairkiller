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

  ipcRenderer.invoke('get-usage-collection').then((value) => {
      usageCollectionToggle.checked = value;
  });

  usageCollectionToggle.addEventListener('change', () => {
    ipcRenderer.send('toggle-usage-collection', usageCollectionToggle.checked);
  });

});

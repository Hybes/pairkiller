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

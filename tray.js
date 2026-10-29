function setupTrayBehavior(window, tray, app, warned, saveWarning) {
  let quitting = false;
  const show = () => { if (window.isMinimized()) window.restore(); window.show(); window.focus(); };
  tray.on('click', show);
  tray.on('double-click', show);
  window.on('close', event => {
    if (quitting) return;
    event.preventDefault();
    if (warned) window.hide();
    else { show(); window.webContents.send('window:tray-notice'); }
  });
  app.on('before-quit', () => { quitting = true; });
  return {
    show,
    acknowledge() { warned = true; saveWarning(); window.hide(); },
    quit() { quitting = true; app.quit(); }
  };
}
module.exports = { setupTrayBehavior };

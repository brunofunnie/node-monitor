const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { translate } = require('./i18n');
const { setupTrayBehavior } = require('./tray');
const { getAutostart, setAutostart, migrateAutostart } = require('./autostart');
let tray;
const { listProcesses, stopProcess, stopProcesses } = require('./processes');

app.setName('Node Monitor');
const configDir = app.getPath('appData');
const userData = path.join(configDir, 'node-monitor');
const oldUserData = path.join(configDir, 'node-manager');
try {
  if (!fs.existsSync(userData) && fs.existsSync(oldUserData)) {
    fs.mkdirSync(userData, { recursive: true });
    for (const name of ['Local Storage', 'tray-notice-seen']) {
      const source = path.join(oldUserData, name);
      if (fs.existsSync(source)) fs.cpSync(source, path.join(userData, name), { recursive: true });
    }
  }
} catch (error) { console.error('Não foi possível migrar as preferências:', error.message); }
app.setPath('userData', userData);
app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 520, height: 720, frame: false, resizable: false, maximizable: false, backgroundColor: '#191e25', icon: path.join(__dirname, 'assets/icon.png'), title: 'Node Monitor', webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  window.setMenuBarVisibility(false);
  try {
    const noticeFile = path.join(app.getPath('userData'), 'tray-notice-seen');
    tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'assets/icon.png')).resize({ width: 22, height: 22 }));
    tray.setToolTip('Node Monitor');
    const behavior = setupTrayBehavior(window, tray, app, fs.existsSync(noticeFile), () => {
      try { fs.mkdirSync(path.dirname(noticeFile), { recursive: true }); fs.writeFileSync(noticeFile, '1'); } catch (error) { console.error('Não foi possível salvar o aviso da bandeja:', error.message); }
    });
    const setTrayLanguage = language => tray.setContextMenu(Menu.buildFromTemplate([{ label: translate(language, 'open'), click: behavior.show }, { type: 'separator' }, { label: translate(language, 'quit'), click: behavior.quit }]));
    setTrayLanguage('en');
    ipcMain.on('app:language', (event, language) => { if (event.sender === window.webContents) setTrayLanguage(language); });
    ipcMain.on('window:tray-acknowledge', event => { if (event.sender === window.webContents) behavior.acknowledge(); });
  } catch (error) {
    console.error('Bandeja indisponível:', error.message);
    dialog.showErrorBox(translate('en', 'trayUnavailable'), translate('en', 'trayUnavailableHelp'));
  }
  window.loadFile('index.html');
  ipcMain.on('window:minimize', () => window.minimize());
  ipcMain.on('window:close', () => window.close());
  ipcMain.handle('system:home', () => app.getPath('home'));
  const autostartFile = path.join(configDir, 'autostart', 'node-monitor.desktop');
  try { if (process.platform === 'linux') await migrateAutostart(path.join(configDir, 'autostart', 'node-manager.desktop'), autostartFile); } catch (error) { console.error('Não foi possível migrar a inicialização:', error.message); }
  ipcMain.handle('autostart:get', () => process.platform === 'win32' ? app.getLoginItemSettings().openAtLogin : getAutostart(autostartFile));
  ipcMain.handle('autostart:set', (_event, enabled) => {
    if (typeof enabled !== 'boolean') throw new Error('Opção de inicialização inválida.');
    if (process.platform === 'win32') { app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath, args: app.isPackaged ? [] : [app.getAppPath()] }); return; }
    return setAutostart(autostartFile, enabled, process.execPath, app.isPackaged ? undefined : app.getAppPath());
  });
  ipcMain.handle('processes:list', (_event, mode) => listProcesses(mode === 'ports' ? 'ports' : 'node'));
  ipcMain.handle('processes:stop-group', async (_event, targets) => {
    if (!Array.isArray(targets) || !targets.length || targets.some(p => !p || !Number.isSafeInteger(p.pid) || typeof p.startTime !== 'string')) throw new Error('Grupo inválido.');
    return stopProcesses(targets);
  });
  ipcMain.handle('processes:stop', async (_event, pid, startTime) => {
    await stopProcess(pid, startTime);
    return true;
  });
});
app.on('window-all-closed', () => app.quit());

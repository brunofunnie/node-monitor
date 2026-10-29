const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
app.commandLine.appendSwitch('disable-gpu');
app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 520, height: 720, show: false, frame: false, webPreferences: { preload: path.join(__dirname, 'screenshot-preload.js'), contextIsolation: true, sandbox: true, partition: 'screenshot' } });
  await window.loadFile(path.join(__dirname, '../index.html'));
  await window.webContents.executeJavaScript(`new Promise((resolve, reject) => { let attempts = 0; const ready = () => { if (++attempts > 100) return reject(new Error('Demo processes did not render')); if (document.querySelector('.group')) { document.querySelector('#expand-all').click(); resolve(); } else setTimeout(ready, 50); }; ready(); })`);
  await window.webContents.executeJavaScript(`(() => { const select = document.querySelector('#language'); for (const [id, label] of [['pt', 'Configurações'], ['es', 'Configuración'], ['en', 'Settings']]) { select.value = id; select.dispatchEvent(new Event('change')); if (document.querySelector('#settings-title').textContent !== label || document.documentElement.lang !== id) throw new Error('Language check failed: ' + id); } })()`);
  await window.webContents.executeJavaScript(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
  await fs.writeFile(process.argv[2], (await window.webContents.capturePage()).toPNG());
  app.quit();
}).catch(error => { console.error(error); app.exit(1); });

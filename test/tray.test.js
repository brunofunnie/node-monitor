const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { setupTrayBehavior } = require('../tray');

test('fechar mostra aviso uma vez, oculta e reabre pela bandeja', () => {
  const window = new EventEmitter();
  const tray = new EventEmitter();
  let hidden = 0, shown = 0, notices = 0, saved = 0, quit = 0;
  Object.assign(window, { hide: () => hidden++, show: () => shown++, focus: () => {}, isMinimized: () => false, webContents: { send: () => notices++ } });
  const app = new EventEmitter(); app.quit = () => quit++;
  const behavior = setupTrayBehavior(window, tray, app, false, () => saved++);
  const close = () => { let prevented = false; window.emit('close', { preventDefault: () => { prevented = true; } }); return prevented; };
  assert.equal(close(), true); assert.equal(notices, 1); assert.equal(hidden, 0);
  behavior.acknowledge(); assert.equal(hidden, 1); assert.equal(saved, 1);
  assert.equal(close(), true); assert.equal(notices, 1); assert.equal(hidden, 2);
  tray.emit('double-click'); assert.equal(shown, 2);
  behavior.quit(); assert.equal(quit, 1); assert.equal(close(), false);
});

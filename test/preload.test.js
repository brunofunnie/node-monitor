const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('preload expõe a ponte usando apenas módulos permitidos pelo sandbox', async () => {
  let api;
  const electron = { contextBridge: { exposeInMainWorld: (_name, value) => { api = value; } }, ipcRenderer: { invoke: async channel => channel === 'system:home' ? '/home/test' : [] } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../preload.js'), 'utf8'), { require: name => { if (name === 'electron') return electron; throw new Error(`Módulo indisponível: ${name}`); } });
  assert.equal(await api.getHome(), '/home/test');
  assert.ok(Array.isArray(await api.list()));
});

test('controles da janela enviam comandos específicos', () => {
  let api;
  const sent = [];
  const electron = { contextBridge: { exposeInMainWorld: (_name, value) => { api = value; } }, ipcRenderer: { send: channel => sent.push(channel) } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../preload.js'), 'utf8'), { require: () => electron });
  api.minimize(); api.close();
  assert.deepEqual(sent, ['window:minimize', 'window:close']);
});

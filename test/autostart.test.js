const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { getAutostart, setAutostart } = require('../autostart');

test('ativa e desativa inicialização no login preservando caminhos com espaços', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'node-monitor-autostart-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const desktop = path.join(dir, 'autostart', 'node-monitor.desktop');
  assert.equal(await getAutostart(desktop), false);
  await setAutostart(desktop, true, '/opt/node monitor/electron', '/home/user/meu app');
  assert.equal(await getAutostart(desktop), true);
  const entry = await fs.readFile(desktop, 'utf8');
  assert.match(entry, /Exec="\/opt\/node monitor\/electron" "\/home\/user\/meu app"/);
  await setAutostart(desktop, false);
  assert.equal(await getAutostart(desktop), false);
  await assert.rejects(setAutostart(desktop, 'true'));
});

test('migra a entrada antiga sem sobrescrever uma entrada nova', async t => {
  const { migrateAutostart } = require('../autostart');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'node-monitor-migration-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const oldFile = path.join(dir, 'node-manager.desktop');
  const newFile = path.join(dir, 'node-monitor.desktop');
  await fs.writeFile(oldFile, '[Desktop Entry]\nName=Node Manager\nExec="/tmp/electron"\n');
  await migrateAutostart(oldFile, newFile);
  assert.match(await fs.readFile(newFile, 'utf8'), /Name=Node Monitor/);
  assert.equal(await getAutostart(oldFile), false);
  await fs.writeFile(oldFile, 'old');
  await migrateAutostart(oldFile, newFile);
  assert.equal(await fs.readFile(oldFile, 'utf8'), 'old');
});

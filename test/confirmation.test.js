const { test } = require('node:test');
const assert = require('node:assert/strict');
const { confirmAction } = require('../confirmation');

test('confirma somente quando o diálogo fecha com a ação confirmada', async () => {
  const dialog = new EventTarget();
  dialog.showModal = () => {};
  dialog.returnValue = '';
  const cancelled = confirmAction(dialog);
  dialog.dispatchEvent(new Event('close'));
  assert.equal(await cancelled, false);
  const confirmed = confirmAction(dialog);
  dialog.returnValue = 'confirm';
  dialog.dispatchEvent(new Event('close'));
  assert.equal(await confirmed, true);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseProcesses, parseFiles, parsePorts } = require('../macos-processes');
test('interpreta processos, executáveis, diretórios e portas do macOS', () => {
  const rows = parseProcesses('  42  1  1234 Thu Oct 29 12:34:56 2026 /opt/node server.js --mcp\n');
  assert.equal(rows[0].pid, 42);
  assert.equal(rows[0].startTime, 'Thu Oct 29 12:34:56 2026');
  assert.equal(rows[0].memoryBytes, 1234 * 1024);
  assert.deepEqual(parseFiles('p42\nfcwd\nn/Users/test/my project\nftxt\nn/opt/node\n').get(42), { cwd: '/Users/test/my project', executable: '/opt/node' });
  assert.deepEqual(parsePorts('p42\nn*:3000\nn[::1]:8080\np43\nn127.0.0.1:80\n').get(42), [3000, 8080]);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { listProcesses, stopProcess } = require('../processes');

test('encontra processo Node e encerra apenas a identidade correta', async (t) => {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill(); });
  await new Promise(resolve => setTimeout(resolve, 300));
  const found = (await listProcesses()).find(p => p.pid === child.pid);
  assert.ok(found);
  if (process.platform !== 'win32') assert.ok(found.cwd);
  assert.ok(Array.isArray(found.ports));
  await assert.rejects(stopProcess(child.pid, 'wrong-start-time'));
  assert.equal(child.exitCode, null);
  await stopProcess(child.pid, found.startTime);
  const signal = await new Promise(resolve => child.once('exit', (_code, signal) => resolve(signal)));
  if (process.platform !== 'win32') assert.equal(signal, 'SIGTERM');
});

test('informa memória residente e tenta todos os processos do grupo mesmo com erro', async (t) => {
  const { stopProcesses } = require('../processes');
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill(); });
  await new Promise(resolve => setTimeout(resolve, 300));
  const found = (await listProcesses()).find(p => p.pid === child.pid);
  assert.ok(found.memoryBytes > 0);
  const exited = new Promise(resolve => child.once('exit', resolve));
  const failures = await stopProcesses([{ pid: child.pid, startTime: 'wrong' }, { pid: child.pid, startTime: found.startTime }]);
  assert.equal(failures.length, 1);
  await exited;
});

test('identifica o executável do harness sem confundir aplicações iniciadas por ele', () => {
  const { identifyHarness } = require('../processes');
  assert.equal(identifyHarness(['/usr/bin/node', '/opt/node_modules/@anthropic-ai/claude-code/cli.js']), 'Claude Code');
  assert.equal(identifyHarness(['/usr/bin/node', '/opt/node_modules/@google/gemini-cli/dist/index.js']), 'Gemini CLI');
  assert.equal(identifyHarness(['/usr/bin/node', '/opt/node_modules/@openai/codex/bin/codex.js']), 'Codex');
  assert.equal(identifyHarness(['/usr/bin/node', '/project/server.js', '--parent=claude']), null);
  assert.equal(identifyHarness(['/usr/bin/node', '/project/claude-code/cli.js']), null);
});

test('reconhece o harness ancestral mais próximo sem confundir argumentos', () => {
  const { findHarnessOrigin } = require('../processes');
  const processes = new Map([
    [10, { pid: 10, ppid: 11, command: ['node', 'server.js', 'claude'] }],
    [11, { pid: 11, ppid: 12, command: ['/usr/bin/bash'] }],
    [12, { pid: 12, ppid: 13, command: ['/usr/local/bin/opencode'] }],
    [13, { pid: 13, ppid: 1, command: ['/usr/local/bin/codex'] }]
  ]);
  assert.equal(findHarnessOrigin(processes.get(10), processes), 'OpenCode');
  assert.equal(findHarnessOrigin({ pid: 20, ppid: 21, command: ['node', 'server.js'] }, new Map()), null);
  assert.equal(findHarnessOrigin({ pid: 1, ppid: 1, command: ['node', 'app.js'] }, new Map([[1, { pid: 1, ppid: 1, command: ['node', 'app.js'] }]])), null);
});

test('inclui apenas portas TCP em escuta, excluindo conexões de saída', () => {
  const { parseSockets } = require('../processes');
  const header = 'sl local_address rem_address st tx_queue rx_queue tr tm->when retrnsmt uid timeout inode';
  const line = (port, state, inode) => `0: 0100007F:${port} 00000000:0000 ${state} 00000000:00000000 00:00000000 00000000 1000 0 ${inode}`;
  assert.deepEqual([...parseSockets(`${header}\n${line('0BB8', '0A', '100')}\n${line('0BB9', '01', '101')}\n${line('14E9', '07', '102')}`)], [['100', 3000]]);
});

test('reconhece comandos de servidores MCP sem confundir argumentos comuns', () => {
  const { isMcpProcess } = require('../processes');
  assert.equal(isMcpProcess(['node', '/usr/bin/codegraph', 'serve', '--mcp']), true);
  assert.equal(isMcpProcess(['node', '/usr/bin/npm', 'exec', '@hostinger/mcp@3.8.1']), true);
  assert.equal(isMcpProcess(['node', '/usr/bin/npm', 'exec', 'rea-agents@6.4.0', 'mcp']), true);
  assert.equal(isMcpProcess(['node', '/opt/node_modules/@modelcontextprotocol/server-filesystem/dist/index.js']), true);
  assert.equal(isMcpProcess(['node', '/app/server.js', '--example=mcp']), false);
  assert.equal(isMcpProcess(['node', '/app/my-mcp-app.js']), false);
});

test('detecta MCP quando npm reescreve o comando exibido no sistema', { skip: process.platform === 'win32' }, async t => {
  const child = spawn(process.execPath, ['-e', 'process.title = "npm exec @hostinger/mcp@3.8.1"; setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill(); });
  await new Promise(resolve => setTimeout(resolve, 300));
  const found = (await listProcesses()).find(p => p.pid === child.pid);
  assert.ok(found);
  assert.equal(found.isMcp, true);
});

test('interpreta processos e portas do Windows sem permitir encerrar outros executáveis', () => {
  const { windowsProcesses } = require('../windows-processes');
  const result = windowsProcesses([
    { ProcessId: 12, ParentProcessId: 10, Name: 'node.exe', ExecutablePath: 'C:\\Program Files\\nodejs\\node.exe', CommandLine: '"C:\\Program Files\\nodejs\\node.exe" "C:\\app\\server.js" --mcp', CreationDate: '2026-01-01', WorkingSetSize: 1024 },
    { ProcessId: 20, ParentProcessId: 10, Name: 'other.exe', CreationDate: '2026-01-02', WorkingSetSize: 2048 }
  ], [{ OwningProcess: 12, LocalPort: 3000 }, { OwningProcess: 20, LocalPort: 80 }], 'node', 99);
  assert.equal(result.length, 1);
  assert.equal(result[0].isNode, true);
  assert.equal(result[0].isMcp, true);
  assert.deepEqual(result[0].ports, [3000]);
  assert.equal(result[0].command[1], 'C:/app/server.js');
  assert.equal(result[0].startTime, '2026-01-01');
  assert.equal(result[0].memoryBytes, 1024);
});

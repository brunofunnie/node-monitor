const fs = require('node:fs/promises');
const path = require('node:path');

async function read(file, fallback = '') { try { return await fs.readFile(file, 'utf8'); } catch { return fallback; } }
async function link(file) { try { return await fs.readlink(file); } catch { return ''; } }
async function info(pid) {
  const base = `/proc/${pid}`;
  const stat = await read(`${base}/stat`);
  if (!stat) return null;
  const end = stat.lastIndexOf(')');
  const fields = stat.slice(end + 2).split(' ');
  const command = (await read(`${base}/cmdline`)).split('\0').filter(Boolean);
  const executable = await link(`${base}/exe`);
  return { name: stat.slice(stat.indexOf('(') + 1, end), pid: Number(pid), ppid: Number(fields[1]), startTime: fields[19], command, executable, cwd: await link(`${base}/cwd`) };
}
function identifyHarness(command) {
  const entry = command[1] || '';
  const signatures = [
    [/\/node_modules\/@anthropic-ai\/claude-code\/(?:cli\.js|cli\.mjs)$/, 'Claude Code'],
    [/\/node_modules\/@google\/gemini-cli\/(?:dist\/)?(?:index|gemini)\.js$/, 'Gemini CLI'],
    [/\/node_modules\/@openai\/codex\/bin\/codex\.js$/, 'Codex'],
    [/\/node_modules\/@qwen-code\/qwen-code\/(?:dist\/)?(?:index|qwen)\.js$/, 'Qwen Code'],
    [/\/node_modules\/(?:@commandcodeai\/)?command-code\/(?:dist\/)?(?:index|cli)\.js$/, 'Command Code']
  ];
  return signatures.find(([pattern]) => pattern.test(entry))?.[1] || null;
}
function isMcpProcess(command) {
  const args = command.slice(1);
  if (/^(?:npm|npx) (?:exec|run|x)\b/.test(command[0] || '')) args.push(...command[0].split(/\s+/).slice(2));
  return args.some(arg =>
    arg === 'mcp' || arg === '--mcp' ||
    /(?:^|\/)@modelcontextprotocol\//i.test(arg) ||
    /(?:^|\/)(?:mcp|mcp-server|server-mcp)(?:@[^/]+)?(?:\/|$)/i.test(arg)
  );
}
function findHarnessOrigin(process, byPid) {
  const names = { claude: 'Claude Code', codex: 'Codex', 'codex-linux-sandbox': 'Codex', opencode: 'OpenCode', qwen: 'Qwen Code', 'command-code': 'Command Code', commandcode: 'Command Code', gemini: 'Gemini CLI' };
  const seen = new Set([process.pid]);
  let parent = byPid.get(process.ppid);
  while (parent && !seen.has(parent.pid)) {
    seen.add(parent.pid);
    const name = identifyHarness(parent.command) || names[path.basename(parent.command[0] || parent.executable || '')];
    if (name) return name;
    parent = byPid.get(parent.ppid);
  }
  return null;
}
function parseSockets(table) {
  const sockets = new Map();
  for (const line of table.split('\n').slice(1)) {
    const fields = line.trim().split(/\s+/);
    if (fields.length < 10 || fields[3] !== '0A') continue;
    const port = parseInt(fields[1].split(':')[1], 16);
    if (port > 0) sockets.set(fields[9], port);
  }
  return sockets;
}
async function listProcesses(mode = 'node') {
  if (process.platform === 'win32') return require('./windows-processes').listWindowsProcesses(mode);
  if (process.platform !== 'linux') throw new Error('Sistema operacional não suportado.');
  const entries = await fs.readdir('/proc');
  const all = (await Promise.all(entries.filter(x => /^\d+$/.test(x)).map(info))).filter(Boolean);
  const byPid = new Map(all.map(p => [p.pid, p]));
  const candidates = all.filter(p => p.pid !== process.pid && (mode === 'ports' || /^(node|nodejs)$/.test(path.basename(p.executable))));
  const tables = await Promise.all(['/proc/net/tcp', '/proc/net/tcp6'].map(file => read(file)));
  const sockets = new Map(tables.flatMap(table => [...parseSockets(table)]));
  const result = await Promise.all(candidates.map(async p => {
    let fds = []; try { fds = await fs.readdir(`/proc/${p.pid}/fd`); } catch {}
    const links = await Promise.all(fds.map(fd => link(`/proc/${p.pid}/fd/${fd}`)));
    const ports = [...new Set(links.map(x => sockets.get(x.match(/^socket:\[(\d+)\]$/)?.[1])).filter(Number.isFinite))].sort((a,b) => a-b);
    const parent = byPid.get(p.ppid);
    const status = await read(`/proc/${p.pid}/status`);
    const memory = status.match(/^VmRSS:\s+(\d+)\s+kB/m);
    return { ...p, isNode: /^(node|nodejs)$/.test(path.basename(p.executable)), isMcp: /^(node|nodejs)$/.test(path.basename(p.executable)) && isMcpProcess(p.command), harness: identifyHarness(p.command), originHarness: findHarnessOrigin(p, byPid), ports, memoryBytes: memory ? Number(memory[1]) * 1024 : null, parent: parent ? (parent.command.join(' ') || path.basename(parent.executable)) : '' };
  }));
  return mode === 'ports' ? result.filter(p => p.ports.length) : result;
}
async function stopProcess(pid, startTime) {
  if (!Number.isSafeInteger(pid) || pid <= 1 || pid === process.pid || typeof startTime !== 'string') throw new Error('Processo inválido.');
  const current = process.platform === 'win32' ? await require('./windows-processes').windowsProcess(pid) : await info(pid);
  if (!current || current.startTime !== startTime || !(process.platform === 'win32' ? /^node\.exe$/i.test(current.executable.split('/').pop()) : /^(node|nodejs)$/.test(path.basename(current.executable)))) throw new Error('O processo mudou ou já foi encerrado.');
  process.kill(pid, 'SIGTERM');
}
async function stopProcesses(processes) {
  const failures = [];
  for (const { pid, startTime } of processes) {
    try { await stopProcess(pid, startTime); } catch (error) { failures.push({ pid, message: error.message }); }
  }
  return failures;
}
module.exports = { listProcesses, stopProcess, stopProcesses, identifyHarness, findHarnessOrigin, parseSockets, isMcpProcess };

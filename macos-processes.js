const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const path = require('node:path');
const run = promisify(execFile);
const options = { maxBuffer: 32 * 1024 * 1024, env: { ...process.env, LC_ALL: 'C' } };
async function lsof(args) {
  try { return (await run('/usr/sbin/lsof', args, options)).stdout; }
  catch (error) { if (error.code === 1) return error.stdout || ''; throw error; }
}
function parseProcesses(output) {
  return output.split('\n').flatMap(line => {
    const m = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\w{3}\s+\w{3}\s+\d+\s+\d\d:\d\d:\d\d\s+\d{4})\s+(.*)$/);
    if (!m) return [];
    const command = m[5].match(/(?:[^\s"]+|"[^"]*")+/g)?.map(arg => arg.replace(/^"|"$/g, '')) || [];
    return [{ pid: Number(m[1]), ppid: Number(m[2]), memoryBytes: Number(m[3]) * 1024, startTime: m[4].replace(/\s+/g, ' '), command }];
  });
}
function parseFiles(output) {
  const result = new Map(); let entry, fd;
  for (const line of output.split('\n')) {
    if (line[0] === 'p') { entry = { cwd: '', executable: '' }; result.set(Number(line.slice(1)), entry); }
    else if (line[0] === 'f') fd = line.slice(1);
    else if (line[0] === 'n' && entry) { if (fd === 'cwd') entry.cwd = line.slice(1); else if (fd === 'txt' && !entry.executable) entry.executable = line.slice(1); }
  }
  return result;
}
function parsePorts(output) {
  const result = new Map(); let ports;
  for (const line of output.split('\n')) {
    if (line[0] === 'p') { ports = result.get(Number(line.slice(1))) || []; result.set(Number(line.slice(1)), ports); }
    else if (line[0] === 'n' && ports) { const match = line.match(/:(\d+)$/); if (match && !ports.includes(Number(match[1]))) ports.push(Number(match[1])); }
  }
  return result;
}
async function macProcesses(mode = 'node', pid) {
  const args = pid ? ['-p', String(pid), '-o', 'pid=,ppid=,rss=,lstart=,command='] : ['-axo', 'pid=,ppid=,rss=,lstart=,command='];
  let rows;
  try { rows = parseProcesses((await run('/bin/ps', args, options)).stdout); } catch (error) { if (pid && error.code === 1) return []; throw error; }
  const ports = pid ? new Map() : parsePorts(await lsof(['-nP', '-iTCP', '-sTCP:LISTEN', '-Fpn']));
  const candidates = rows.filter(p => p.pid !== process.pid && (pid || mode !== 'ports' || ports.has(p.pid)));
  if (!candidates.length) return [];
  const files = parseFiles(await lsof(['-nP', '-a', '-p', candidates.map(p => p.pid).join(','), '-d', 'cwd,txt', '-Fpfn']));
  const byPid = new Map(rows.map(p => [p.pid, p]));
  const { identifyHarness, findHarnessOrigin, isMcpProcess } = require('./processes');
  return candidates.map(p => {
    const file = files.get(p.pid) || { cwd: '', executable: '' };
    const isNode = /^(node|nodejs)$/.test(path.basename(file.executable));
    const parent = byPid.get(p.ppid);
    return { ...p, ...file, name: path.basename(file.executable || p.command[0] || ''), isNode, isMcp: isNode && isMcpProcess(p.command), harness: identifyHarness(p.command), originHarness: findHarnessOrigin(p, byPid), ports: (ports.get(p.pid) || []).sort((a, b) => a - b), parent: parent?.command.join(' ') || '' };
  }).filter(p => pid || mode === 'ports' || p.isNode);
}
module.exports = { parseProcesses, parseFiles, parsePorts, macProcesses };

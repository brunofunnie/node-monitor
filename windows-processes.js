const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);

async function query(script) {
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${script}`], { maxBuffer: 32 * 1024 * 1024, windowsHide: true });
  return JSON.parse(stdout);
}
const fields = 'ProcessId,ParentProcessId,Name,ExecutablePath,CommandLine,WorkingSetSize,@{Name="StartTime";Expression={$_.CreationDate.ToString("o")}}';

function windowsProcesses(raw, sockets, mode, ownPid) {
  const { identifyHarness, findHarnessOrigin, isMcpProcess } = require('./processes');
  const all = raw.map(p => {
    const command = (p.CommandLine?.match(/(?:[^\s"]+|"[^"]*")+/g) || []).map(s => s.replace(/^"|"$/g, '').replace(/\\/g, '/'));
    const executable = (p.ExecutablePath || '').replace(/\\/g, '/');
    return { pid: p.ProcessId, ppid: p.ParentProcessId, name: p.Name, executable, command, cwd: '', startTime: p.StartTime || p.CreationDate || '', memoryBytes: p.WorkingSetSize == null ? null : Number(p.WorkingSetSize), isNode: /^node(?:\.exe)?$/i.test(p.Name || '') };
  });
  const byPid = new Map(all.map(p => [p.pid, p]));
  return all.filter(p => p.pid !== ownPid && (mode === 'ports' || p.isNode)).map(p => {
    const parent = byPid.get(p.ppid);
    return { ...p, ports: [...new Set(sockets.filter(s => s.OwningProcess === p.pid).map(s => s.LocalPort))].sort((a, b) => a - b), harness: identifyHarness(p.command), originHarness: findHarnessOrigin(p, byPid), isMcp: p.isNode && isMcpProcess(p.command), parent: parent ? parent.command.join(' ') || parent.name : '' };
  }).filter(p => mode !== 'ports' || p.ports.length);
}
async function listWindowsProcesses(mode) {
  const data = await query(`$p = @(Get-CimInstance Win32_Process | Select-Object ${fields}); $s = @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Select-Object OwningProcess,LocalPort); @{ processes = $p; sockets = $s } | ConvertTo-Json -Depth 4 -Compress`);
  return windowsProcesses(data.processes, data.sockets, mode, process.pid);
}
async function windowsProcess(pid) {
  const data = await query(`$p = Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}' | Select-Object ${fields}; ConvertTo-Json -InputObject $p -Compress`);
  return data ? windowsProcesses([data], [], 'node', process.pid)[0] : null;
}
module.exports = { windowsProcesses, listWindowsProcesses, windowsProcess };

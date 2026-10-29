function processName(p) {
  if (p.harness) return p.harness;
  if (p.isNode === false) return p.name || p.executable?.split('/').pop() || 'Process';
  return p.cwd?.split('/').filter(Boolean).pop() || p.command?.[1]?.split('/').pop() || 'Node.js';
}
function sortByPort(processes) {
  return processes.filter(p => Array.isArray(p.ports) && p.ports.length > 0).sort((a, b) => Math.max(...b.ports) - Math.max(...a.ports) || processName(a).localeCompare(processName(b), 'pt-BR', { sensitivity: 'base' }));
}
function groupProcesses(processes) {
  const groups = new Map();
  for (const process of processes) {
    const key = process.cwd ? JSON.stringify([process.cwd, process.harness || null]) : `pid:${process.pid}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(process);
  }
  return [...groups.values()].sort((a, b) => (b.length > 1) - (a.length > 1) || processName(a[0]).localeCompare(processName(b[0]), 'pt-BR', { sensitivity: 'base', numeric: true }));
}
function groupStats(group) {
  return { processes: group.length, ports: new Set(group.flatMap(p => p.ports || [])).size };
}
function memorySummary(processes) {
  const values = processes.map(p => p.memoryBytes).filter(value => Number.isFinite(value) && value >= 0);
  return { bytes: values.length || !processes.length ? values.reduce((sum, value) => sum + value, 0) : null, missing: processes.length - values.length };
}
function groupHarnesses(group) {
  return [...new Set(group.flatMap(p => [p.originHarness, p.harness]).filter(Boolean))];
}
if (typeof module !== 'undefined') module.exports = { groupProcesses, groupStats, groupHarnesses, processName, sortByPort, memorySummary };

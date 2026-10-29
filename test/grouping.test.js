const { test } = require('node:test');
const assert = require('node:assert/strict');
const { groupProcesses } = require('../grouping');

test('agrupa pelo caminho completo e mantém processos sem diretório separados', () => {
  const processes = [{ pid: 1, cwd: '/a/app' }, { pid: 2, cwd: '/b/app' }, { pid: 3, cwd: '/a/app' }, { pid: 4, cwd: '' }, { pid: 5, cwd: '' }];
  const groups = groupProcesses(processes);
  assert.deepEqual(groups.map(group => group.map(p => p.pid)), [[1, 3], [2], [4], [5]]);
});

test('mostra grupos com vários processos antes dos processos individuais', () => {
  const processes = [{ pid: 1, cwd: '/single' }, { pid: 2, cwd: '/group' }, { pid: 3, cwd: '' }, { pid: 4, cwd: '/group' }];
  assert.deepEqual(groupProcesses(processes).map(group => group.map(p => p.pid)), [[2, 4], [3], [1]]);
});

test('separa processos de harness e aplicação no mesmo diretório', () => {
  const processes = [{ pid: 1, cwd: '/app', harness: 'Claude Code' }, { pid: 2, cwd: '/app', harness: null }];
  assert.equal(groupProcesses(processes).length, 2);
});

test('conta processos e portas distintas', () => {
  const { groupStats } = require('../grouping');
  assert.deepEqual(groupStats([{ ports: [3000, 3001] }, { ports: [3000] }, { ports: [] }]), { processes: 3, ports: 2 });
  assert.deepEqual(groupStats([{ ports: [] }]), { processes: 1, ports: 0 });
});

test('lista cada harness identificado no grupo uma única vez', () => {
  const { groupHarnesses } = require('../grouping');
  assert.deepEqual(groupHarnesses([{ originHarness: 'Codex' }, { originHarness: 'Codex' }, { harness: 'Claude Code', originHarness: null }, {}]), ['Codex', 'Claude Code']);
});

test('ordena grupos e itens individuais por nome, mantendo grupos primeiro', () => {
  const processes = [{ pid: 1, cwd: '/z' }, { pid: 2, cwd: '/b' }, { pid: 3, cwd: '/a' }, { pid: 4, cwd: '/b' }, { pid: 5, cwd: '/a' }, { pid: 6, cwd: '/c' }];
  assert.deepEqual(groupProcesses(processes).map(g => g[0].cwd), ['/a', '/b', '/c', '/z']);
});

test('ordena processos com portas pela maior porta em ordem decrescente', () => {
  const { sortByPort } = require('../grouping');
  const entries = [{ pid: 1, ports: [80, 5000] }, { pid: 2, ports: [9000] }, { pid: 3, ports: [3000] }];
  assert.deepEqual(sortByPort(entries).map(p => p.pid), [2, 1, 3]);
});

test('aba de portas exclui processos sem porta identificada', () => {
  const { sortByPort } = require('../grouping');
  const entries = [{ pid: 1, ports: [] }, { pid: 2, ports: [443] }, { pid: 3 }];
  assert.deepEqual(sortByPort(entries).map(p => p.pid), [2]);
});

test('soma memória disponível e sinaliza valores ausentes', () => {
  const { memorySummary } = require('../grouping');
  assert.deepEqual(memorySummary([{ memoryBytes: 1048576 }, { memoryBytes: 2097152 }]), { bytes: 3145728, missing: 0 });
  assert.deepEqual(memorySummary([{ memoryBytes: 1048576 }, { memoryBytes: null }]), { bytes: 1048576, missing: 1 });
  assert.deepEqual(memorySummary([{ memoryBytes: null }]), { bytes: null, missing: 1 });
  assert.deepEqual(memorySummary([]), { bytes: 0, missing: 0 });
});

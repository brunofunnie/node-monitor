const list = document.querySelector('#list');
const search = document.querySelector('#search');
const total = document.querySelector('#total');
const totalMemory = document.querySelector('#total-memory');
const dialog = document.querySelector('#process-dialog');
const detailList = document.querySelector('#process-details');
const confirmDialog = document.querySelector('#confirm-dialog');
const settingsDialog = document.querySelector('#settings-dialog');
const moreDetails = document.querySelector('#more-details');
const autostart = document.querySelector('#autostart');
const settingsError = document.querySelector('#settings-error');
try { moreDetails.checked = localStorage.getItem('more-details') === 'true'; } catch {}
const languageSelect = document.querySelector('#language');
let language = 'en';
try { language = localStorage.getItem('language') || 'en'; } catch {}
if (!languages.some(item => item.id === language)) language = 'en';
const t = (key, values) => translate(language, key, values);
function errorText(error) {
  const message = error?.message || '';
  const errors = { 'Processo inválido.':'invalidProcess', 'O processo mudou ou já foi encerrado.':'changedProcess', 'Sistema operacional não suportado.':'unsupportedSystem', 'Grupo inválido.':'invalidGroup', 'Opção de inicialização inválida.':'invalidStartup' };
  for (const [source, key] of Object.entries(errors)) if (message.includes(source)) return t(key);
  return message;
}
function applyLanguage() {
  document.documentElement.lang = language;
  languageSelect.value = language;
  const text = { '.update-label':'auto', '[data-mode="ports"]':'ports', '.list-header>span':'processes', '#process-dialog .dialog-label':'process', '#settings-dialog .dialog-label':'preferences', '#settings-title':'settings', '#settings-dialog .setting-row:nth-of-type(1) strong':'moreDetails', '#settings-dialog .setting-row:nth-of-type(1) small':'moreDetailsHelp', '#settings-dialog .setting-row:nth-of-type(2) strong':'autostart', '#settings-dialog .setting-row:nth-of-type(2) small':'autostartHelp', '#language-label':'language', '#tray-dialog .dialog-label':'tray', '#tray-title':'trayTitle', '#tray-description':'trayHelp', '#tray-ok':'gotIt', '#confirm-dialog .dialog-label':'confirmation', '#confirm-description':'confirmationHelp', '.confirm-cancel[value="cancel"]':'cancel' };
  for (const [selector, key] of Object.entries(text)) document.querySelector(selector).textContent = t(key);
  const labels = { '#refresh':'refresh', '#open-settings':'settings', '#minimize-window':'minimize', '#close-window':'close', 'nav.tabs':'view', '#search':'searchLabel', '#expand-all':'expand', '#collapse-all':'collapse', '#close-dialog':'closeDetails', '#close-settings':'closeSettings' };
  for (const [selector, key] of Object.entries(labels)) { const el = document.querySelector(selector); el.setAttribute('aria-label', t(key)); if (el.hasAttribute('title')) el.title = t(key); }
  search.placeholder = t('search');
  window.nodeManager.setLanguage(language);
}
languageSelect.addEventListener('change', () => { language = languageSelect.value; try { localStorage.setItem('language', language); } catch {} applyLanguage(); render(); });
applyLanguage();

let processes = [];
let loading = false;
let home = '';
let mode = 'node';
let pendingRefresh = false;
const expandedGroups = new Set();
const searchCollapsedGroups = new Set();
const harnessIcons = {
  'Claude Code': 'claude', 'Codex': 'codex', 'OpenCode': 'opencode', 'Qwen Code': 'qwen', 'Gemini CLI': 'gemini'
};
function harnessBadge(name, compact = false) {
  const badge = element('span', compact ? 'group-harness' : 'origin-harness');
  const slug = harnessIcons[name];
  if (slug || name === 'Command Code') {
    const image = document.createElement('img');
    image.src = name === 'Command Code' ? 'https://github.com/CommandCodeAI.png?size=64' : `https://raw.githubusercontent.com/lobehub/lobe-icons/master/packages/static-svg/icons/${slug}.svg`;
    image.alt = '';
    image.addEventListener('error', () => { image.remove(); if (compact) badge.textContent = name.slice(0, 1); });
    badge.append(image);
  }
  if (!compact) badge.append(document.createTextNode(name));
  else if (!slug && name !== 'Command Code') badge.textContent = name.slice(0, 1);
  badge.title = compact ? name : t('ancestor', { name });
  if (compact) badge.setAttribute('aria-label', name);
  return badge;
}
function element(tag, className, value) { const el = document.createElement(tag); el.className = className; if (value !== undefined) el.textContent = value; return el; }
function displayPathIcons(target) {
  const parts = target.textContent.split('⌂');
  if (parts.length === 1) return;
  target.replaceChildren(document.createTextNode(parts[0]));
  for (const part of parts.slice(1)) {
    const icon = element('span', 'home-icon');
    icon.setAttribute('aria-label', t('home'));
    target.append(icon, document.createTextNode(part));
  }
}
function groupMetric(icon, number, label) {
  const metric = element('span', 'group-metric');
  metric.title = `${number} ${label}`;
  metric.setAttribute('aria-label', metric.title);
  const symbol = element('span', `metric-icon ${icon}`);
  symbol.setAttribute('aria-hidden', 'true');
  metric.append(symbol, document.createTextNode(number));
  return metric;
}
function memoryLabel(processes) {
  const { bytes, missing } = memorySummary(processes);
  const value = bytes === null ? '—' : `${missing ? '≥' : ''}${(bytes / 1048576).toFixed(1)} MB`;
  const detail = missing ? t('partialMemory', { count: missing }) : t('totalMemory');
  return { value, detail };
}
function render() {
  const query = search.value.trim().toLocaleLowerCase();
  const visible = mode === 'ports' ? sortByPort(processes) : processes;
  const filtered = visible.filter(p => [p.pid, p.cwd, p.parent, p.harness, p.originHarness, p.isMcp ? 'mcp' : '', p.command.join(' '), ...p.ports].join(' ').toLocaleLowerCase().includes(query));
  total.textContent = t('active', { count: visible.length });
  const memory = memoryLabel(visible);
  totalMemory.textContent = memory.value; totalMemory.title = memory.detail; totalMemory.setAttribute('aria-label', `RAM ${memory.value}. ${memory.detail}`);
  list.replaceChildren();
  if (!filtered.length) { list.append(element('div', 'empty', query ? t('emptySearch') : mode === 'ports' ? t('emptyPorts') : t('emptyNode'))); return; }
  for (const group of mode === 'ports' ? filtered.map(p => [p]) : groupProcesses(filtered)) {
    let container = list;
    if (group.length > 1) {
      const directory = group[0].cwd;
      const harness = group[0].harness;
      const groupKey = JSON.stringify([directory, harness || null]);
      const wrapper = element('div', 'group-wrapper');
      const section = element('details', 'group');
      section.dataset.key = groupKey;
      section.open = query ? !searchCollapsedGroups.has(groupKey) : expandedGroups.has(groupKey);
      const summary = element('summary', 'group-header');
      summary.title = directory;
      const stats = groupStats(group);
      const metrics = element('span', 'group-count');
      const memory = memoryLabel(group);
      const ram = element('span', 'group-memory', memory.value); ram.title = memory.detail; ram.setAttribute('aria-label', `RAM ${memory.value}. ${memory.detail}`);
      metrics.append(ram, groupMetric('metric-process', stats.processes, t('processes').toLocaleLowerCase()));
      if (stats.ports) metrics.append(groupMetric('metric-port', stats.ports, t('distinctPorts')));
      const harnesses = element('span', 'group-harnesses');
      for (const name of groupHarnesses(group)) harnesses.append(harnessBadge(name, true));
      summary.append(element('span', 'group-name', harness || directory.split('/').filter(Boolean).pop() || '/'), harnesses, metrics);
      summary.addEventListener('click', () => { if (section.open) { expandedGroups.delete(groupKey); if (query) searchCollapsedGroups.add(groupKey); } else { expandedGroups.add(groupKey); searchCollapsedGroups.delete(groupKey); } });
      const stopGroup = element('button', 'stop group-stop', t('stopAll'));
      stopGroup.setAttribute('aria-label', t('stopAllAria', { directory }));
      stopGroup.onclick = async () => {
        const targets = processes.filter(p => p.cwd === directory && p.harness === harness).map(({ pid, startTime }) => ({ pid, startTime }));
        document.querySelector('#confirm-title').textContent = t('confirmGroup', { count: targets.length });
        document.querySelector('#confirm-submit').textContent = t('stopAll');
        if (!await confirmAction(confirmDialog)) return;
        stopGroup.disabled = true;
        try {
          const failures = await window.nodeManager.stopGroup(targets);
          if (failures !== null) {
            await refresh();
            if (failures.length) showError(new Error(t('failedStop', { details: failures.map(f => `${f.pid} (${errorText(f)})`).join(', ') })));
          }
        } catch (error) { showError(error); } finally { stopGroup.disabled = false; }
      };
      const groupActions = element('div', 'group-actions');
      groupActions.append(stopGroup);
      section.append(summary); wrapper.append(section, groupActions); list.append(wrapper); container = section;
    }
    for (const p of group) {
    const row = element('article', 'row');
    const identity = element('button', 'identity');
    identity.type = 'button';
    const iconColumn = element('span', 'process-icon-column');
    const icon = element('span', 'process-icon', '⬡');
    iconColumn.append(icon);
    if (p.isMcp) iconColumn.append(element('span', 'mcp-label', 'MCP'));
    const details = element('div', 'details');
    const name = processName(p);
    identity.setAttribute('aria-label', t('detailsAria', { name, pid: p.pid }));
    identity.onclick = () => showDetails(p, name);
    const title = element('div', 'process-title'); title.append(element('strong', '', p.harness || name), element('span', 'pid', `PID ${p.pid}`));
    if (p.harness) title.append(element('span', 'harness-badge', 'HARNESS'));
    if (p.originHarness) details.append(harnessBadge(p.originHarness));
    const command = element('div', 'command', shortCommand(p.command, home) || p.executable.split('/').pop()); command.title = p.command.join(' ') || p.executable;
    const origin = element('div', 'origin', `${shortPath(p.cwd, home) || t('directoryUnavailable')}  ·  ${t('parent')}: ${shortPath(p.parent, home) || `PID ${p.ppid}`}`); origin.title = `${p.cwd || t('directoryUnavailable')}  ·  ${t('parent')}: ${p.parent || `PID ${p.ppid}`}`;
    displayPathIcons(command); displayPathIcons(origin);
    details.prepend(title); details.append(command); if (moreDetails.checked) details.append(origin); identity.append(iconColumn, details);
    const ports = element('div', 'ports'); if (p.ports.length) for (const port of [...p.ports].sort((a, b) => mode === 'ports' ? b - a : a - b)) ports.append(element('span', 'port', `:${port}`)); else ports.append(element('span', 'no-port', '—'));
    const action = element('div', 'action'); const stop = element('button', 'stop', t('stop')); stop.setAttribute('aria-label', `${t('stop')} ${name}, PID ${p.pid}`); stop.onclick = async () => { document.querySelector('#confirm-title').textContent = t('confirmProcess', { pid: p.pid }); document.querySelector('#confirm-submit').textContent = t('stop'); if (!await confirmAction(confirmDialog)) return; stop.disabled = true; try { if (await window.nodeManager.stop(p.pid, p.startTime)) await refresh(); } catch (error) { showError(error); } finally { stop.disabled = false; } }; if (p.isNode !== false) action.append(stop);
    details.append(ports); row.append(identity, action); container.append(row);
    }
  }
}
function showDetails(p, name) {
  document.querySelector('#dialog-title').textContent = name;
  detailList.replaceChildren();
  const fields = [
    ['MCP', p.isMcp ? t('identified') : t('unidentified')], ['Harness ancestral', p.originHarness || t('unidentified')], [t('type'), p.harness ? `Harness · ${p.harness}` : t('unidentified')], ['PID', String(p.pid)], [t('parentProcess'), p.parent || `PID ${p.ppid}`], [t('parentPid'), String(p.ppid)],
    [t('memory'), p.memoryBytes == null ? t('unavailable') : `${(p.memoryBytes / 1024 / 1024).toFixed(1)} MB`],
    [t('listeningPorts'), p.ports.length ? p.ports.join(', ') : t('none')],
    [t('directory'), p.cwd || t('unavailable')], [t('executable'), p.executable || t('unavailable')], [t('command'), p.command.join(' ') || t('unavailable')]
  ];
  for (const [label, value] of fields) {
    const item = element('div', 'detail-item');
    item.append(element('dt', '', label), element('dd', '', value));
    detailList.append(item);
  }
  dialog.showModal();
}
document.querySelector('#open-settings').addEventListener('click', async () => {
  settingsDialog.showModal();
  autostart.disabled = true; settingsError.hidden = true;
  try { autostart.checked = await window.nodeManager.getAutostart(); autostart.disabled = false; }
  catch (error) { settingsError.textContent = t('settingsReadError', { error: errorText(error) }); settingsError.hidden = false; }
});
autostart.addEventListener('change', async () => {
  const enabled = autostart.checked;
  autostart.disabled = true; settingsError.hidden = true;
  try { await window.nodeManager.setAutostart(enabled); }
  catch (error) { autostart.checked = !enabled; settingsError.textContent = t('settingsWriteError', { error: errorText(error) }); settingsError.hidden = false; }
  finally { autostart.disabled = false; }
});
document.querySelector('#close-settings').addEventListener('click', () => settingsDialog.close());
moreDetails.addEventListener('change', () => { try { localStorage.setItem('more-details', String(moreDetails.checked)); } catch {} render(); });
window.nodeManager.onTrayNotice(() => { const notice = document.querySelector('#tray-dialog'); if (!notice.open) notice.showModal(); });
document.querySelector('#tray-ok').addEventListener('click', () => { document.querySelector('#tray-dialog').close(); window.nodeManager.acknowledgeTray(); });
document.querySelector('#tray-dialog').addEventListener('cancel', event => { event.preventDefault(); document.querySelector('#tray-dialog').close(); window.nodeManager.acknowledgeTray(); });
document.querySelector('#minimize-window').addEventListener('click', () => window.nodeManager.minimize());
document.querySelector('#close-window').addEventListener('click', () => window.nodeManager.close());
document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
function showError(error) { const message = element('div', 'error', errorText(error) || t('processError')); list.prepend(message); }
async function refresh() {
  if (loading) { pendingRefresh = true; return; }
  loading = true;
  const requestedMode = mode;
  try {
    const [result, userHome] = await Promise.all([window.nodeManager.list(requestedMode), window.nodeManager.getHome()]);
    if (requestedMode === mode) { processes = result; home = userHome; processes.sort((a,b) => a.pid-b.pid); render(); }
  } catch (error) { if (requestedMode === mode) showError(error); }
  finally { loading = false; if (pendingRefresh) { pendingRefresh = false; refresh(); } }
}
for (const tab of document.querySelectorAll('.tab')) tab.addEventListener('click', () => {
  if (mode === tab.dataset.mode) return;
  mode = tab.dataset.mode;
  for (const item of document.querySelectorAll('.tab')) { const active = item === tab; item.classList.toggle('active', active); item.setAttribute('aria-pressed', String(active)); }
  processes = []; render(); refresh();
});
for (const [id, open] of [['expand-all', true], ['collapse-all', false]]) {
  document.querySelector(`#${id}`).addEventListener('click', () => {
    for (const section of list.querySelectorAll('.group')) {
      section.open = open;
      if (open) { expandedGroups.add(section.dataset.key); searchCollapsedGroups.delete(section.dataset.key); }
      else { expandedGroups.delete(section.dataset.key); searchCollapsedGroups.add(section.dataset.key); }
    }
  });
}
search.addEventListener('input', () => { searchCollapsedGroups.clear(); render(); }); document.querySelector('#refresh').addEventListener('click', refresh); document.addEventListener('keydown', event => { if (event.key === '/' && document.activeElement !== search) { event.preventDefault(); search.focus(); } });
refresh(); setInterval(refresh, 5000);

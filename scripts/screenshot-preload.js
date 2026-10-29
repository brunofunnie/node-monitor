const { contextBridge } = require('electron');
const demoProcess = (pid, directory, command, ports, memoryBytes, extra = {}) => ({ pid, ppid: 1200, startTime: 'demo', cwd: `/home/alex/projects/${directory}`, executable: '/usr/bin/node', command: ['node', command], parent: 'terminal', ports, memoryBytes, isNode: true, ...extra });
const processes = [
  demoProcess(2314, 'storefront', 'server.js', [3000], 142606336),
  demoProcess(2315, 'storefront', 'worker.js', [], 75497472),
  demoProcess(2548, 'api-service', 'index.js', [8080], 100663296),
  demoProcess(2761, 'design-system', 'vite.js', [5173], 94371840),
  demoProcess(2980, 'analytics', 'server.js', [4000], 65011712, { isMcp: true })
];
contextBridge.exposeInMainWorld('nodeManager', { setLanguage() {}, onTrayNotice() {}, acknowledgeTray() {}, minimize() {}, close() {}, getAutostart: async () => false, setAutostart: async () => {}, getHome: async () => '/home/alex', list: async () => processes, stopGroup: async () => [], stop: async () => false });

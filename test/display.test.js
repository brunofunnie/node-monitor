const { test } = require('node:test');
const assert = require('node:assert/strict');
const { shortPath, shortCommand } = require('../display');

test('abrevia home sem alterar caminhos de outros usuários', () => {
  assert.equal(shortPath('/home/ana/projetos/app', '/home/ana'), '⌂/projetos/app');
  assert.equal(shortPath('/home/ana2/app', '/home/ana'), '/home/ana2/app');
});
test('simplifica executável Node e npm sem perder os argumentos', () => {
  assert.equal(shortCommand(['/home/ana/.asdf/installs/nodejs/22/bin/node', '/home/ana/.asdf/installs/nodejs/22/lib/node_modules/npm/bin/npm-cli.js', 'run', 'dev'], '/home/ana'), 'npm run dev');
  assert.equal(shortCommand(['/usr/bin/node', '/home/ana/app/server.js', '--port', '3000'], '/home/ana'), 'node server.js --port 3000');
});

test('remove caminhos absolutos dos argumentos sem perder as opções', () => {
  assert.equal(shortCommand(['/usr/bin/node', '/home/ana/projeto/server.js', '--config=/home/ana/projeto/config.json', '/tmp/data'], '/home/ana'), 'node server.js --config=config.json data');
  assert.equal(shortCommand(['npm exec @hostinger/mcp@3.8.1'], '/home/ana'), 'npm exec @hostinger/mcp@3.8.1');
});

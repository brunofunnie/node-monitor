const { test } = require('node:test');
const assert = require('node:assert/strict');
const { translate, languages } = require('../i18n');
test('traduz em inglês, português e espanhol e usa inglês para idioma desconhecido', () => {
  assert.equal(translate('en', 'settings'), 'Settings');
  assert.equal(translate('pt', 'settings'), 'Configurações');
  assert.equal(translate('es', 'settings'), 'Configuración');
  assert.equal(translate('fr', 'settings'), 'Settings');
  for (const language of languages) assert.deepEqual(Object.keys(language.messages).sort(), Object.keys(languages[0].messages).sort());
  assert.equal(translate('en', 'active', { count: 3 }), '3 active');
});

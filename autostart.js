const fs = require('node:fs/promises');
const path = require('node:path');

async function getAutostart(file) {
  try { await fs.access(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
async function setAutostart(file, enabled, executable, appPath) {
  if (typeof enabled !== 'boolean') throw new Error('Opção de inicialização inválida.');
  if (!enabled) {
    try { await fs.unlink(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    return;
  }
  const quote = value => `"${value.replace(/[%]/g, '%%').replace(/[\\"$`]/g, '\\$&')}"`;
  const command = [executable, appPath].filter(Boolean).map(quote).join(' ');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `[Desktop Entry]\nType=Application\nName=Node Monitor\nExec=${command}\nTerminal=false\nX-GNOME-Autostart-enabled=true\n`, 'utf8');
}
async function migrateAutostart(oldFile, newFile) {
  let contents;
  try { contents = await fs.readFile(oldFile, 'utf8'); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  try { await fs.writeFile(newFile, contents.replace(/^Name=Node Manager$/m, 'Name=Node Monitor'), { encoding: 'utf8', flag: 'wx' }); }
  catch (error) { if (error.code === 'EEXIST') return; throw error; }
  await fs.unlink(oldFile);
}
module.exports = { getAutostart, setAutostart, migrateAutostart };

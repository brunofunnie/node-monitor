function shortPath(value, home) {
  if (home && home !== '/' && (value === home || value.startsWith(`${home}/`))) return `⌂${value.slice(home.length)}`;
  return value;
}
function shortCommand(command, home) {
  if (!command.length) return '';
  const args = [...command];
  if (/\/(?:node|nodejs)$/.test(args[0])) args[0] = args[0].split('/').pop();
  if ((args[0] === 'node' || args[0] === 'nodejs') && /\/node_modules\/npm\/bin\/npm-cli\.js$/.test(args[1] || '')) args.splice(0, 2, 'npm');
  return args.map(arg => arg.replace(/^((?:--[^=]+=)?)(?:\.{1,2}\/|\/)(.+)$/, (_match, prefix, path) => prefix + (path.split('/').filter(Boolean).pop() || '/'))).join(' ');
}
if (typeof module !== 'undefined') module.exports = { shortPath, shortCommand };

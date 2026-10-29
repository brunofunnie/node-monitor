function confirmAction(dialog) {
  dialog.returnValue = '';
  return new Promise(resolve => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
    dialog.showModal();
  });
}
if (typeof module !== 'undefined') module.exports = { confirmAction };

window.dialogApi.onTheme((isDark) => {
  document.body.classList.toggle('dark', isDark);
});

document.getElementById('btn-save').addEventListener('click', () => window.dialogApi.respond('save'));
document.getElementById('btn-delete').addEventListener('click', () => window.dialogApi.respond('delete'));
document.getElementById('btn-cancel').addEventListener('click', () => window.dialogApi.respond('cancel'));

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.dialogApi.respond('cancel');
  if (e.key === 'Enter')  window.dialogApi.respond('save');
});

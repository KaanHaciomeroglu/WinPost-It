let currentNote = null;
let saveTimeout = null;

const noteEl   = document.getElementById('note');
const textarea = document.getElementById('content');
const panel    = document.getElementById('settings-panel');
const btnSettings = document.getElementById('btn-settings');

const THEMES = {
  yellow:   { class: 'theme-yellow',   color: '#FFFACD' },
  blue:     { class: 'theme-blue',     color: '#B3E5FC' },
  green:    { class: 'theme-green',    color: '#C8E6C9' },
  pink:     { class: 'theme-pink',     color: '#F8BBD9' },
  white:    { class: 'theme-white',    color: '#F5F5F5' },
  dark:     { class: 'theme-dark',     color: '#2b2b2b' },
  midnight: { class: 'theme-midnight', color: '#1a1a2e' },
  charcoal: { class: 'theme-charcoal', color: '#3a3a3a' },
};

function applyTheme(themeKey) {
  Object.values(THEMES).forEach(t => noteEl.classList.remove(t.class));
  const theme = THEMES[themeKey] || THEMES.yellow;
  noteEl.classList.add(theme.class);

  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === themeKey);
  });
}

function scheduleSave() {
  if (!currentNote) return;
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    currentNote.text = textarea.value;
    window.postit.save(currentNote);
  }, 500);
}

window.postit.init((note) => {
  currentNote = note;
  textarea.value = note.text || '';
  applyTheme(note.theme || 'yellow');
});

// Ayar paneli aç/kapat
btnSettings.addEventListener('click', (e) => {
  e.stopPropagation();
  panel.classList.toggle('open');
});

// Panel dışına tıklayınca kapat
document.addEventListener('click', (e) => {
  if (!panel.contains(e.target) && e.target !== btnSettings) {
    panel.classList.remove('open');
  }
});

// Tema seçimi
document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!currentNote) return;
    const themeKey = btn.dataset.theme;
    currentNote.theme = themeKey;
    currentNote.color = THEMES[themeKey]?.color || '#FFFACD';
    applyTheme(themeKey);
    window.postit.save(currentNote);
    panel.classList.remove('open');
  });
});

textarea.addEventListener('input', scheduleSave);

document.querySelector('.btn-new').addEventListener('click', () => {
  window.postit.new();
});

document.querySelector('.btn-delete').addEventListener('click', () => {
  if (!currentNote) return;
  currentNote.text = textarea.value;
  window.postit.close(currentNote);
});

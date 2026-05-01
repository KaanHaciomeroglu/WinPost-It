let currentNote = null;
let saveTimeout = null;
let selectedImg = null;
let savedRange  = null;

const noteEl      = document.getElementById('note');
const editor      = document.getElementById('content');
const panel       = document.getElementById('settings-panel');
const btnSettings = document.getElementById('btn-settings');
const overlay     = document.getElementById('img-overlay');

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
    currentNote.text = editor.innerHTML;
    window.postit.save(currentNote);
  }, 500);
}

// ── Görsel overlay ─────────────────────────────────────────────────────────

function positionOverlay(img) {
  const r = img.getBoundingClientRect();
  overlay.style.left   = r.left + 'px';
  overlay.style.top    = r.top  + 'px';
  overlay.style.width  = r.width  + 'px';
  overlay.style.height = r.height + 'px';
  overlay.classList.add('visible');
}

function hideOverlay() {
  overlay.classList.remove('visible');
  selectedImg = null;
}

// Köşe handle sürükleme
overlay.querySelectorAll('.img-handle').forEach(handle => {
  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedImg) return;

    const dir     = handle.dataset.dir;
    const startX  = e.clientX;
    const startY  = e.clientY;
    const startW  = selectedImg.offsetWidth;
    const startH  = selectedImg.offsetHeight;
    const startR  = selectedImg.getBoundingClientRect();

    const onMove = (ev) => {
      let newW = startW;
      let newH = startH;

      if (dir.includes('e')) newW = Math.max(40, startW + (ev.clientX - startX));
      if (dir.includes('w')) newW = Math.max(40, startW - (ev.clientX - startX));
      if (dir.includes('s')) newH = Math.max(40, startH + (ev.clientY - startY));
      if (dir.includes('n')) newH = Math.max(40, startH - (ev.clientY - startY));

      selectedImg.style.width  = newW + 'px';
      selectedImg.style.height = newH + 'px';
      positionOverlay(selectedImg);
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      scheduleSave();
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
});

// Editör içindeki görsellere tıklama
editor.addEventListener('click', (e) => {
  if (e.target.tagName === 'IMG') {
    selectedImg = e.target;
    positionOverlay(selectedImg);
  } else {
    hideOverlay();
  }
});

// Overlay dışına tıklayınca kapat
document.addEventListener('mousedown', (e) => {
  if (selectedImg && !overlay.contains(e.target) && e.target !== selectedImg) {
    hideOverlay();
  }
});

// Seçili görseli Delete/Backspace ile sil
document.addEventListener('keydown', (e) => {
  if (selectedImg && (e.key === 'Delete' || e.key === 'Backspace')) {
    e.preventDefault();
    selectedImg.remove();
    hideOverlay();
    scheduleSave();
  }
});

// Pencere boyutlandırılınca overlay konumunu güncelle
window.addEventListener('resize', () => {
  if (selectedImg) positionOverlay(selectedImg);
});

// ── Görsel ekleme ──────────────────────────────────────────────────────────

function saveSelection() {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) savedRange = sel.getRangeAt(0).cloneRange();
}

function restoreSelection() {
  if (!savedRange) return;
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(savedRange);
}

function insertImageAtCursor(dataUrl) {
  const img = document.createElement('img');
  img.src = dataUrl;
  img.className = 'note-img';
  img.style.width = '180px';

  editor.focus();
  restoreSelection();

  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(img);
    range.setStartAfter(img);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  } else {
    editor.appendChild(img);
  }
  scheduleSave();
}

// Dosyadan görsel ekleme
document.querySelector('.btn-image').addEventListener('mousedown', () => saveSelection());
document.querySelector('.btn-image').addEventListener('click', async () => {
  const dataUrl = await window.postit.pickImage();
  if (!dataUrl) return;
  insertImageAtCursor(dataUrl);
});

// Panodan yapıştırma (Ctrl+V)
editor.addEventListener('paste', (e) => {
  const items = Array.from(e.clipboardData.items);
  const imgItem = items.find(i => i.type.startsWith('image/'));
  if (!imgItem) return; // metin yapıştırmasına izin ver

  e.preventDefault();
  const blob = imgItem.getAsFile();
  const reader = new FileReader();
  reader.onload = (ev) => insertImageAtCursor(ev.target.result);
  reader.readAsDataURL(blob);
});

// ── Init ───────────────────────────────────────────────────────────────────

window.postit.init((note) => {
  currentNote = note;
  editor.innerHTML = note.text || '';
  applyTheme(note.theme || 'yellow');
});

// ── Ayar paneli ────────────────────────────────────────────────────────────

btnSettings.addEventListener('click', (e) => {
  e.stopPropagation();
  panel.classList.toggle('open');
});

document.addEventListener('click', (e) => {
  if (!panel.contains(e.target) && e.target !== btnSettings) {
    panel.classList.remove('open');
  }
});

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

// ── Kaydet / yeni / sil ────────────────────────────────────────────────────

editor.addEventListener('input', scheduleSave);

document.querySelector('.btn-new').addEventListener('click', () => {
  window.postit.new();
});

document.querySelector('.btn-delete').addEventListener('click', () => {
  if (!currentNote) return;
  currentNote.text = editor.innerHTML;
  window.postit.close(currentNote);
});

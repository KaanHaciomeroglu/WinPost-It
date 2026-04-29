const { app, BrowserWindow, ipcMain, nativeImage, Tray, Menu, screen, nativeTheme } = require('electron');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { randomUUID } = require('crypto');

const NOTES_DIR     = path.join(os.homedir(), 'Documents', 'post-it');
const NOTES_FILE    = path.join(NOTES_DIR, 'notes.json');
const SETTINGS_FILE = path.join(NOTES_DIR, 'settings.json');

const noteWindows = new Map();

// ── Ayarlar ────────────────────────────────────────────────────────────────
function loadSettings() {
  if (!fs.existsSync(SETTINGS_FILE)) return { theme: 'yellow', color: '#FFFACD' };
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')); }
  catch { return { theme: 'yellow', color: '#FFFACD' }; }
}

function saveSettings(data) {
  ensureNotesDir();
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// ── Dosya yardımcıları ─────────────────────────────────────────────────────
function ensureNotesDir() {
  if (!fs.existsSync(NOTES_DIR)) fs.mkdirSync(NOTES_DIR, { recursive: true });
}

function loadNotes() {
  ensureNotesDir();
  if (!fs.existsSync(NOTES_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(NOTES_FILE, 'utf-8')); }
  catch { return []; }
}

function saveNotes(notes) {
  ensureNotesDir();
  fs.writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2), 'utf-8');
}

function upsertNote(note) {
  const notes = loadNotes();
  const idx = notes.findIndex(n => n.id === note.id);
  if (idx >= 0) notes[idx] = note;
  else notes.push(note);
  saveNotes(notes);
}

function deleteNoteFromJson(id) {
  saveNotes(loadNotes().filter(n => n.id !== id));
}

// ── .postit dosyası dışa aktar ─────────────────────────────────────────────
function exportNoteToPostit(note) {
  ensureNotesDir();
  const firstLine = (note.text || '').split('\n')[0].trim().slice(0, 40) || 'not';
  const safeName  = firstLine.replace(/[\\/:*?"<>|]/g, '_');
  const timestamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  const filename  = `${safeName}_${timestamp}.postit`;
  const filepath  = path.join(NOTES_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify({
    text:  note.text  || '',
    theme: note.theme || 'yellow',
    color: note.color || '#FFFACD',
  }, null, 2), 'utf-8');
  return filepath;
}

// ── .postit dosyasını post-it penceresi olarak aç ─────────────────────────
function openPostitFile(filepath) {
  if (!fs.existsSync(filepath)) return;
  let data;
  try { data = JSON.parse(fs.readFileSync(filepath, 'utf-8')); }
  catch { return; }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const note = {
    id:    randomUUID(),
    text:  data.text  || '',
    theme: data.theme || 'yellow',
    color: data.color || '#FFFACD',
    x: Math.floor(width / 2 - 110),
    y: Math.floor(height / 2 - 120),
    width: 220,
    height: 240,
    sourceFile: filepath,
  };
  upsertNote(note);
  createNoteWindow(note);
}

// ── Windows dosya ilişkilendirmesi ─────────────────────────────────────────
function registerFileAssociation() {
  const exePath = process.execPath;
  const appPath = app.getAppPath();
  const openCmd = `"${exePath}" "${appPath}" "%1"`;
  const iconPath = path.join(__dirname, 'assets', 'icon.ico');
  try {
    execSync(`reg add "HKCU\\Software\\Classes\\.postit" /ve /d "PostItNote" /f`);
    execSync(`reg add "HKCU\\Software\\Classes\\PostItNote" /ve /d "Post-it Notu" /f`);
    execSync(`reg add "HKCU\\Software\\Classes\\PostItNote\\DefaultIcon" /ve /d "${iconPath}" /f`);
    execSync(`reg add "HKCU\\Software\\Classes\\PostItNote\\shell\\open\\command" /ve /d "${openCmd.replace(/"/g, '\\"')}" /f`);
  } catch { /* sessizce geç */ }
}

// ── Özel dialog (sistem temasına uyumlu) ──────────────────────────────────
function showCloseDialog(parentWin) {
  return new Promise((resolve) => {
    const [px, py] = parentWin.getPosition();
    const [pw, ph] = parentWin.getSize();

    const dlg = new BrowserWindow({
      width: 320,
      height: 148,
      x: Math.round(px + pw / 2 - 160),
      y: Math.round(py + ph / 2 - 74),
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload-dialog.js'),
        contextIsolation: true,
      },
    });

    dlg.loadFile(path.join(__dirname, 'src', 'dialog.html'));
    dlg.webContents.on('did-finish-load', () => {
      dlg.webContents.send('dialog:theme', nativeTheme.shouldUseDarkColors);
    });

    const cleanup = (action) => {
      ipcMain.removeAllListeners('dialog:response');
      if (!dlg.isDestroyed()) dlg.close();
      resolve(action);
    };

    ipcMain.once('dialog:response', (_e, action) => cleanup(action));
    dlg.on('closed', () => { ipcMain.removeAllListeners('dialog:response'); resolve('cancel'); });
  });
}

// ── Tray ──────────────────────────────────────────────────────────────────
let tray = null;

function buildTrayMenu() {
  const notes = loadNotes();
  const noteItems = notes.map(note => ({
    label: (note.text || '').trim().split('\n')[0].slice(0, 40) || '(boş not)',
    click: () => {
      const win = noteWindows.get(note.id);
      if (win && !win.isDestroyed()) { win.show(); win.focus(); }
    },
  }));

  return Menu.buildFromTemplate([
    ...(noteItems.length
      ? [...noteItems, { type: 'separator' }]
      : [{ label: 'Açık not yok', enabled: false }, { type: 'separator' }]
    ),
    { label: 'Yeni Not', click: () => createNewNote() },
    { type: 'separator' },
    {
      label: 'Tüm Notları Kapat',
      enabled: noteWindows.size > 0,
      click: () => {
        for (const id of [...noteWindows.keys()]) closeNoteWindow(id);
        updateTray();
      },
    },
    { type: 'separator' },
    { label: 'Çıkış', click: () => app.exit(0) },
  ]);
}

function updateTray() {
  if (tray && !tray.isDestroyed()) tray.setContextMenu(buildTrayMenu());
}

function createTray() {
  tray = new Tray(path.join(__dirname, 'assets', 'icon.ico'));
  tray.setToolTip('Post-it');
  tray.setContextMenu(buildTrayMenu());
  tray.on('right-click', updateTray);
  tray.on('click', updateTray);
}

// ── Pencere yönetimi ───────────────────────────────────────────────────────
function closeNoteWindow(id) {
  const win = noteWindows.get(id);
  if (win && !win.isDestroyed()) win.close();
  noteWindows.delete(id);
  deleteNoteFromJson(id);
  updateTray();
}

function createNoteWindow(note) {
  const win = new BrowserWindow({
    x: note.x,
    y: note.y,
    width:  note.width  || 220,
    height: note.height || 240,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    skipTaskbar: true,
    minimizable: false,
    resizable: true,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });

  win.loadFile(path.join(__dirname, 'src', 'note.html'));
  win.webContents.on('did-finish-load', () => win.webContents.send('note:init', note));

  const updatePosition = () => {
    const [x, y]         = win.getPosition();
    const [width, height] = win.getSize();
    const notes = loadNotes();
    const idx = notes.findIndex(n => n.id === note.id);
    if (idx >= 0) { notes[idx].x = x; notes[idx].y = y; notes[idx].width = width; notes[idx].height = height; saveNotes(notes); }
  };

  win.on('moved', updatePosition);
  win.on('resized', updatePosition);
  noteWindows.set(note.id, win);
  updateTray();
}

function createNewNote() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const settings = loadSettings();
  const note = {
    id: randomUUID(),
    text: '',
    color: settings.color || '#FFFACD',
    theme: settings.theme || 'yellow',
    x: Math.floor(width / 2 - 110),
    y: Math.floor(height / 2 - 120),
    width: 220,
    height: 240,
  };
  upsertNote(note);
  createNoteWindow(note);
}

// ── Uygulama başlangıcı ────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }

app.whenReady().then(() => {
  app.setLoginItemSettings({ openAtLogin: true });
  registerFileAssociation();
  createTray();

  const postitArg = process.argv.find(a => a.endsWith('.postit'));
  if (postitArg) {
    openPostitFile(postitArg);
    return;
  }

  const notes = loadNotes();
  if (notes.length === 0) createNewNote();
  else notes.forEach(createNoteWindow);
});

app.on('second-instance', (_e, argv) => {
  const postitArg = argv.find(a => a.endsWith('.postit'));
  if (postitArg) openPostitFile(postitArg);
});

app.on('window-all-closed', (e) => e.preventDefault());

// ── IPC ────────────────────────────────────────────────────────────────────
ipcMain.on('note:save', (event, note) => {
  upsertNote(note);
  if (note.theme) saveSettings({ theme: note.theme, color: note.color });
  updateTray();
});

ipcMain.handle('note:close', async (event, note) => {
  const win = noteWindows.get(note.id);
  const isEmpty = !note.text || note.text.trim() === '';

  if (isEmpty) { closeNoteWindow(note.id); return; }

  const action = await showCloseDialog(win);

  if (action === 'save') {
    exportNoteToPostit(note);
    closeNoteWindow(note.id);
  } else if (action === 'delete') {
    closeNoteWindow(note.id);
  }
});

ipcMain.on('note:new', () => createNewNote());

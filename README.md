# Post-it

Windows masaüstü için hafif, çok pencereli yapışkan not uygulaması.

> ![alt text](image.png)

## Özellikler

- Masaüstünde istediğin yere yerleştirilebilen notlar
- 8 farklı tema: Sarı, Mavi, Yeşil, Pembe, Beyaz, Koyu, Gece, Antrasit
- Notlar otomatik kaydedilir (`Documents/post-it/notes.json`)
- Sistem başlangıcında otomatik açılır
- Sistem tepsisi ikonu — açık notları görüntüle, yeni not oluştur, tümünü kapat
- `.postit` dosya formatıyla not dışa aktarma ve açma desteği

## Kurulum

```bash
npm install
npm start
```

## Build (Windows .exe)

```bash
npm run build
```

Çıktı: `dist-pkg\Post-it-win32-x64\Post-it.exe`

## Proje Yapısı

```
main.js              # Ana süreç: pencere yönetimi, IPC, dosya I/O, tray
preload.js           # contextBridge — renderer'a güvenli IPC API'si sunar
preload-dialog.js    # Dialog penceresi için contextBridge
src/
  note.html          # Her post-it penceresi
  note.css           # Post-it stilleri
  note.js            # Renderer: yazma, tema seçimi, butonlar
  dialog.html        # Kapatma onay dialog'u
assets/
  icon.ico           # Uygulama ve dosya ilişkilendirme ikonu
  note.png           # Kaynak ikon görseli
```

## Veri Depolama

Notlar `%USERPROFILE%\Documents\post-it\notes.json` dosyasında saklanır.

```json
{
  "id": "uuid",
  "text": "Not içeriği",
  "theme": "yellow",
  "color": "#FFFACD",
  "x": 120,
  "y": 300,
  "width": 220,
  "height": 240
}
```

## Kullanım

| İşlem | Nasıl |
|---|---|
| Yeni not | Toolbar'daki `+` butonu veya tray menüsü |
| Notu sil | Toolbar'daki `×` butonu |
| Tema değiştir | Toolbar'daki `⚙` butonu → tema seç |
| Notu taşı | Toolbar'dan sürükle |
| Tüm notları kapat | Tray → Tüm Notları Kapat |
| Uygulamadan çık | Tray → Çıkış |

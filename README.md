# CloudSync — Kişisel Dosya Senkronizasyon ve Web Erişim Uygulaması

Birden fazla bilgisayar arasında belgeleri otomatik olarak senkronize eden, internet/ağ üzerinden her yerden erişim ve dosya düzenleme imkanı sağlayan web uygulaması.

---

## 🚀 Hızlı Başlangıç

### 1. Gereksinimler
- Python 3.10 veya üzeri
- `pip install -r requirements.txt`

### 2. Sunucuyu Başlatma
Proje kök dizininde:
```bash
python run.py --port 8765
```

### 3. Web Arayüzüne Giriş
Tarayıcınızdan şu adrese gidin:
👉 **[http://localhost:8765](http://localhost:8765)**

- **Kullanıcı Adı:** `admin`
- **Şifre:** `admin123`

---

## 💻 Farklı Bilgisayarlara Sync Agent Kurulumu

Diğer bilgisayarlarınızdaki dosyaların bu depoya otomatik senkronize olması için:

1. `sync-agent/` klasörünü senkronize etmek istediğiniz bilgisayara kopyalayın.
2. `config_agent.json` dosyasını açın ve `server_url` kısmına sunucu bilgisayarınızın yerel IP adresini veya alan adını yazın:
   ```json
   {
     "server_url": "http://192.168.1.100:8765",
     "username": "admin",
     "password": "admin123",
     "device_name": "Ofis-Laptop",
     "sync_folders": [
       {
         "local_path": "./belgelerim",
         "remote_path": ""
       }
     ],
     "sync_interval_seconds": 15
   }
   ```
3. Ajanı başlatın:
   ```bash
   python agent.py
   ```

Ajan arka planda belirttiğiniz klasörleri (`watchdog` ile) anlık olarak izler. Yeni dosya eklendiğinde veya var olan bir dosya düzenlendiğinde otomatik olarak sunucuya yükler ve sunucudaki güncellemeleri yerel klasörünüze indirir.

---

## ✨ Özellikler

- 🔒 **Güvenli Giriş:** JWT token ve bcrypt ile şifrelenmiş kimlik doğrulama.
- ⚡ **Akıllı Delta Sync:** SHA-256 hash karşılaştırması ile yalnızca değişen dosyaları iletir.
- 🛡️ **Çakışma Güvenliği:** İki cihazda aynı dosya eşzamanlı değişirse veriler kaybolmaz, çakışma kopyası oluşturulur.
- 📁 **Web Dosya Gezgini:** Sürükle-bırak yükleme, klasör oluşturma, yeniden adlandırma, taşıma ve toplu zip indirme.
- 📝 **Tarayıcı İçi Editör:** Metin ve kod dosyalarını anında tarayıcıdan düzenleyip `Ctrl+S` ile kaydedebilme.
- 📊 **Senkronizasyon Geçmişi:** Yapılan tüm işlemleri gösteren audit log paneli.

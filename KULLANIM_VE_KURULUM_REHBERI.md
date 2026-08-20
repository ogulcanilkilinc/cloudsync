# 🚀 CloudSync — 3 Farklı Yöntemle 7/24 Kesintisiz Kullanım Rehberi

Bu rehber, CloudSync uygulamasını **her seferinde manuel terminal açmadan** ve **farklı bilgisayarlardan/konumlardan kesintisiz** kullanabilmeniz için hazırlanan 3 yöntemi açıklar.

---

## 📌 Yöntem 1: Windows'ta Arka Planda Sessizce ve Otomatik Başlatma

Sunucuyu bu bilgisayarınızda çalıştırıp, terminal penceresi görmeden Windows her açıldığında arka planda çalışmasını istiyorsanız:

### Kurulum:
1. [`scripts/install_server_autostart.bat`](file:///C:/Users/user/.gemini/antigravity/scratch/cloudsync/scripts/install_server_autostart.bat) dosyasına çift tıklayın.
2. Artık bilgisayarınız her açıldığında sunucu **hiçbir pencere açılmadan arka planda sessizce** başlayacaktır.

### Manuel Kontrol:
- **Arka Planda Başlat:** [`scripts/start_server_silent.vbs`](file:///C:/Users/user/.gemini/antigravity/scratch/cloudsync/scripts/start_server_silent.vbs) (çift tıklayın)
- **Sunucuyu Durdur:** [`scripts/stop_server.bat`](file:///C:/Users/user/.gemini/antigravity/scratch/cloudsync/scripts/stop_server.bat) (çift tıklayın)
- **Erişim:** `http://localhost:8765` veya yerel ağdaki diğer bilgisayarlardan `http://BILGISAYAR_IP:8765`

---

## 📌 Yöntem 2: Cloudflare Tunnels ile İnternet Üzerinden Güvenli Erişim (Ücretsiz & Portsuz)

Evinizdeki/ofisinizdeki ana bilgisayara dışarıdan (mobil internet, kafe, başka şehir vb.) modemde port açmadan güvenli HTTPS linkiyle bağlanmak için:

### Nasıl Çalıştırılır?
1. [`scripts/start_cloudflare_tunnel.bat`](file:///C:/Users/user/.gemini/antigravity/scratch/cloudsync/scripts/start_cloudflare_tunnel.bat) dosyasına çift tıklayın.
2. İlk çalıştırmada `cloudflared.exe` aracını otomatik olarak indirecek ve size özel güvenli bir bağlantı üretecektir:
   ```
   https://xyz-ornek-kelimeler.trycloudflare.com
   ```
3. Bu linki herhangi bir cihazınızın (telefon, tablet, iş bilgisayarı) tarayıcısına yapıştırarak dosyalarınıza anında erişebilirsiniz.

---

## 📌 Yöntem 3: 7/24 Bulut Sunucuya (VPS / Docker) Kurulum

Kendi bilgisayarınızı açık tutmak istemiyorsanız, herhangi bir bulut sunucuya (DigitalOcean, Hetzner, AWS, Oracle Cloud Free Tier vb.) tek adımda kurabilirsiniz:

### A. Docker ile (Önerilen)
Sunucunuzda Docker ve Docker Compose yüklüyse:
```bash
docker-compose up -d
```
Sunucunuz `http://SUNUCU_IP:8765` adresinde anında 7/24 çalışmaya başlar.

### B. Tek Komutla Linux (Ubuntu/Debian) Kurulumu:
Proje dosyalarını sunucuya kopyaladıktan sonra:
```bash
sudo bash scripts/deploy_vps.sh
```
Bu script Python ortamını kurar, güvenlik duvarını ayarlar ve `cloudsync.service` adıyla arka plan Linux servisi olarak 7/24 başlatır.

---

## 💻 İstemci (Sync Agent) Bilgisayarlarında Otomatik Eşitleme

Diğer bilgisayarlarınızın da arka planda sessizce senkronize olması için:

1. `sync-agent/` klasörünü o bilgisayara kopyalayın.
2. `config_agent.json` dosyasındaki `server_url` adresine sunucunuzun IP adresini veya Cloudflare linkini yazın.
3. [`sync-agent/install_agent_autostart.bat`](file:///C:/Users/user/.gemini/antigravity/scratch/cloudsync/sync-agent/install_agent_autostart.bat) dosyasına çift tıklayın.
4. Artık o bilgisayar açıldığında dosyalarınız arka planda otomatik olarak buluta ve diğer bilgisayarlarınıza eşitlenir.

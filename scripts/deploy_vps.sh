#!/usr/bin/env bash
# ==============================================================================
# CloudSync - Tek Komutla Linux VPS / Sunucu Kurulum Scripti (Ubuntu / Debian)
# ==============================================================================
set -e

echo "========================================================"
echo "  CloudSync Sunucu Otomatik Kurulumu Başlatılıyor..."
echo "========================================================"

# 1. Güncellemeler ve Gerekli Paketler
apt update && apt install -y python3 python3-pip python3-venv git curl ufw

# 2. Kurulum Dizinini Hazırla
INSTALL_DIR="/opt/cloudsync"
mkdir -p "$INSTALL_DIR"
cp -r ./* "$INSTALL_DIR/" || true
cd "$INSTALL_DIR"

# 3. Python Bağımlılıkları
pip3 install -r requirements.txt

# 4. Systemd Servisi Olarak Kaydet ve Başlat
cp "$INSTALL_DIR/scripts/cloudsync.service" /etc/systemd/system/cloudsync.service
systemctl daemon-reload
systemctl enable cloudsync
systemctl restart cloudsync

# 5. Güvenlik Duvarında 8765 Portuna İzin Ver
ufw allow 8765/tcp || true

echo "========================================================"
echo "  Kurulum Başarıyla Tamamlandı!"
echo "  Sunucu Durumu: $(systemctl is-active cloudsync)"
echo "  Erişim: http://SUNUCU_IP_ADRESINIZ:8765"
echo "  Varsayılan Giriş: admin / admin123"
echo "========================================================"

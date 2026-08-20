@echo off
chcp 65001 >nul
echo [CloudSync] 8765 portundaki sunucu durduruluyor...

powershell -Command "Get-NetTCPConnection -LocalPort 8765 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"

echo [CloudSync] Sunucu başarıyla durduruldu.
timeout /t 2 >nul

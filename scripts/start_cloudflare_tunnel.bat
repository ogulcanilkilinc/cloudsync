@echo off
chcp 65001 >nul
setlocal

echo ========================================================
echo   CloudSync - Cloudflare Guvenli Internet Tuneli
echo ========================================================
echo.
echo Bu arac, evinizdeki/ofisinizdeki modeme dokunmadan veya port
echo acmadan guvenli bir HTTPS web adresi uretir.
echo.

set "SCRIPT_DIR=%~dp0"
set "CLOUDFLARED=%SCRIPT_DIR%cloudflared.exe"

if not exist "%CLOUDFLARED%" (
    echo [1/2] Cloudflared araci indiriliyor (yaklasik 20 MB)...
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile '%CLOUDFLARED%'"
    if not exist "%CLOUDFLARED%" (
        echo [HATA] Cloudflared indirilemedi. Lutfen internet baglantinizi kontrol edin.
        pause
        exit /b 1
    )
    echo [OK] Indirme tamamlandi.
)

echo [2/2] Tunel baslatiliyor...
echo.
echo ========================================================
echo   ASAGIDAKI 'trycloudflare.com' LINKINI KOPYALAYIN
echo   Bu link ile dunyanin her yerinden erisebilirsiniz!
echo ========================================================
echo.

"%CLOUDFLARED%" tunnel --url http://localhost:8765

pause

@echo off
chcp 65001 >nul
setlocal

echo ========================================================
echo   CloudSync Ajanini Windows Baslangicina Ekleme
echo ========================================================

set "SCRIPT_DIR=%~dp0"
set "TARGET_VBS=%SCRIPT_DIR%start_agent_silent.vbs"
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT=%STARTUP_FOLDER%\CloudSync_Agent.vbs"

copy /y "%TARGET_VBS%" "%SHORTCUT%" >nul

if exist "%SHORTCUT%" (
    echo [OK] CloudSync senkronizasyon ajani baslangic klasorune eklendi!
    echo Bilgisayariniz her acildiginda dosyalarinizi arka planda otomatik esitleyecektir.
) else (
    echo [HATA] Baslangic klasorune kopyalama basarisiz oldu.
)

echo.
pause

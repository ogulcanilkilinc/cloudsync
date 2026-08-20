@echo off
chcp 65001 >nul
echo ========================================================
echo   CloudSync - Masaustu Klasorunu Canli Buluta Senkronize Et
echo ========================================================
echo.
echo Izlenen Klasor: C:\Users\user\OneDrive - hacettepe.edu.tr\Masaüstü\cloudsync test
echo Hedef Sunucu: https://ogulcan-cloudsync.onrender.com
echo.

cd /d "%~dp0sync-agent"
python agent.py

pause

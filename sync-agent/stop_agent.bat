@echo off
chcp 65001 >nul
echo [CloudSync] Arka plandaki Python ajani durduruluyor...

powershell -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*agent.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

echo [CloudSync] Ajan durduruldu.
timeout /t 2 >nul

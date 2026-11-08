@echo off
rem Stops the local helper on port 8099. The page stops updating; nothing else changes.
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8099 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }"
echo Stopped.
exit /b 0

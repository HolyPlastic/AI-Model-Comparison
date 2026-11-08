@echo off
rem Starts the local helper (if it is not already running) and opens the page.
rem The helper is the only thing that talks to Artificial Analysis, so the API
rem key never enters the browser.
cd /d "%~dp0"

curl -s -o nul -m 2 http://127.0.0.1:8099/api/health
if %errorlevel%==0 goto open

start "" /min cmd /c "node server.mjs >> _server.log 2>&1"
timeout /t 2 /nobreak >nul

:open
start "" http://127.0.0.1:8099/
exit /b 0

@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 20 or newer first: https://nodejs.org/
  pause
  exit /b 1
)
echo Open http://localhost:3000 in your browser.
echo Keep this window open while playing.
node server.js
pause

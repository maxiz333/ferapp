@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist "node_modules\firebase-admin" (
  echo Installazione dipendenze...
  call npm install
  if errorlevel 1 (
    echo ERRORE npm install
    pause
    exit /b 1
  )
)

echo.
echo === ANTEPRIMA MERGE magazzino_ext ===
node merge-magazzino.js
echo.
pause

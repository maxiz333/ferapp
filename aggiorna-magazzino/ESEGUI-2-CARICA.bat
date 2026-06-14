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

if not exist "changes.json" (
  echo Manca changes.json — esegui prima ESEGUI-1-ANTEPRIMA.bat
  pause
  exit /b 1
)

echo.
echo === CARICA SU FIREBASE ===
node upload-magazzino.js
echo.
pause

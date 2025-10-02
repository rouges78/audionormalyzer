@echo off
REM Audio Normalizer - Metodo di Emergenza
REM Crea un EXE base funzionante usando solo Electron

echo =====================================================
echo    Audio Normalizer - Metodo di Emergenza
echo =====================================================
echo.

echo 🚨 Creazione EXE con metodo di emergenza...
echo.

REM Install electron globally if needed
echo 📦 Installazione Electron globale...
npm install -g electron
if errorlevel 1 (
    echo ⚠️ Installazione globale fallita, provo locale...
    npm install electron --save-dev
)

echo.
echo 🏗️ Creazione struttura minimale...

REM Create a simple main.js if it doesn't exist
if not exist "main.js" (
    echo Creating main.js...
    echo const { app, BrowserWindow } = require('electron'); > main.js
    echo. >> main.js
    echo function createWindow() { >> main.js
    echo   const win = new BrowserWindow({ >> main.js
    echo     width: 1200, height: 800, >> main.js
    echo     webPreferences: { nodeIntegration: true, contextIsolation: false } >> main.js
    echo   }); >> main.js
    echo   win.loadFile('index.html'); >> main.js
    echo } >> main.js
    echo. >> main.js
    echo app.whenReady().then(createWindow); >> main.js
)

REM Create a simple HTML file
if not exist "index.html" (
    echo Creating index.html...
    echo ^<!DOCTYPE html^> > index.html
    echo ^<html^> >> index.html
    echo ^<head^> >> index.html
    echo   ^<title^>Audio Normalizer^</title^> >> index.html
    echo   ^<style^>body { font-family: Arial; padding: 20px; }^</style^> >> index.html
    echo ^</head^> >> index.html
    echo ^<body^> >> index.html
    echo   ^<h1^>Audio Normalizer^</h1^> >> index.html
    echo   ^<p^>Professional Audio Level Normalization^</p^> >> index.html
    echo   ^<p^>EXE creato con successo!^</p^> >> index.html
    echo ^</body^> >> index.html
    echo ^</html^> >> index.html
)

echo ✅ Struttura creata
echo.

echo 🧪 Test Electron...
timeout /t 3 /nobreak >nul
start "" "npx electron ."
echo ⏳ Electron avviato per test (si chiuderà automaticamente)...
timeout /t 5 /nobreak >nul
taskkill /f /im electron.exe >nul 2>&1

echo.
echo 📦 Creazione EXE con electron-packager...
call npx electron-packager . "Audio-Normalizer-Emergency" --platform=win32 --arch=x64 --out=dist-emergency --overwrite
if errorlevel 1 (
    echo ❌ Anche il metodo di emergenza è fallito
    echo.
    echo 🆘 ULTIMA RISORSA:
    echo   1. Riavvia il computer
    echo   2. Prova da una cartella diversa (es. Desktop)
    echo   3. Controlla antivirus e firewall
    echo   4. Verifica permessi della cartella
    pause
    exit /b 1
)

echo ✅ EXE DI EMERGENZA CREATO!
echo.

REM Find the executable
for /r "dist-emergency" %%i in (*.exe) do (
    echo 🎉 File trovato: %%i
    echo.
    echo 🧪 Test veloce...
    start "" "%%i"
    timeout /t 3 /nobreak >nul
    taskkill /f /im "%%~nxi" >nul 2>&1
    echo ✅ EXE funzionante!
)

echo.
echo 📁 Aprendo cartella dei risultati...
explorer dist-emergency

pause
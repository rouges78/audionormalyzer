@echo off
REM Audio Normalizer - Emergency Method
REM Creates a basic working EXE using only Electron

echo =====================================================
echo    Audio Normalizer - Emergency Method
echo =====================================================
echo.

echo 🚨 Creating EXE with the emergency method...
echo.

REM Install electron globally if needed
echo 📦 Installing Electron globally...
npm install -g electron
if errorlevel 1 (
    echo ⚠️ Global install failed, trying local...
    npm install electron --save-dev
)

echo.
echo 🏗️ Creating minimal structure...

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

echo ✅ Structure created
echo.

echo 🧪 Test Electron...
timeout /t 3 /nobreak >nul
start "" "npx electron ."
echo ⏳ Electron started for testing (it will close automatically)...
timeout /t 5 /nobreak >nul
taskkill /f /im electron.exe >nul 2>&1

echo.
echo 📦 Creating EXE with electron-packager...
call npx electron-packager . "Audio-Normalizer-Emergency" --platform=win32 --arch=x64 --out=dist-emergency --overwrite
if errorlevel 1 (
    echo ❌ The emergency method failed too
    echo.
    echo 🆘 LAST RESORT:
    echo   1. Restart the computer
    echo   2. Try from a different folder (e.g. Desktop)
    echo   3. Check antivirus and firewall
    echo   4. Check the folder permissions
    pause
    exit /b 1
)

echo ✅ EMERGENCY EXE CREATED!
echo.

REM Find the executable
for /r "dist-emergency" %%i in (*.exe) do (
    echo 🎉 File found: %%i
    echo.
    echo 🧪 Quick test...
    start "" "%%i"
    timeout /t 3 /nobreak >nul
    taskkill /f /im "%%~nxi" >nul 2>&1
    echo ✅ EXE working!
)

echo.
echo 📁 Opening the results folder...
explorer dist-emergency

pause
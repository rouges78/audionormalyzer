@echo off
REM Audio Normalizer - Fix EXE Build Issues
REM Risolve automaticamente i problemi di build su Windows

echo =====================================================
echo    Audio Normalizer - Fix Build Issues
echo =====================================================
echo.

echo 🔧 Fixing build issues...
echo.

REM Stop all related processes
echo 🛑 Fermando processi Electron/Node...
taskkill /f /im electron.exe >nul 2>&1
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im "Audio-Normalizer*.exe" >nul 2>&1
taskkill /f /im "app-builder.exe" >nul 2>&1

REM Wait a bit
timeout /t 3 /nobreak >nul

REM Clean dist directory
echo 🧹 Pulizia cartella dist...
if exist "dist" (
    rmdir /s /q "dist" >nul 2>&1
    if exist "dist" (
        echo ⚠️ Impossibile rimuovere dist, provo con forza...
        rd /s /q "dist" >nul 2>&1
    )
)

REM Clean node_modules cache
echo 🧹 Pulizia cache node_modules...
if exist "node_modules\.cache" (
    rmdir /s /q "node_modules\.cache" >nul 2>&1
)

REM Clean .next directory
echo 🧹 Pulizia .next...
if exist ".next" (
    rmdir /s /q ".next" >nul 2>&1
)

REM Clean temp directories
echo 🧹 Pulizia cartelle temporanee...
if exist "temp" (
    rmdir /s /q "temp" >nul 2>&1
)

REM Wait again
timeout /t 2 /nobreak >nul

echo.
echo ✅ Pulizia completata!
echo.
echo 🚀 Avvio nuovo build...
echo.

REM Build with fresh start
call npm run build
if errorlevel 1 (
    echo ❌ Errore durante build web
    pause
    exit /b 1
)

REM Small delay before electron build
timeout /t 3 /nobreak >nul

REM Build electron with specific flags
echo 🔨 Creazione EXE con parametri ottimizzati...
echo 📋 Usando configurazione corretta...
call npx electron-builder --win --x64 portable --config electron-builder.config.js
if errorlevel 1 (
    echo ❌ Errore durante creazione EXE
    echo.
    echo 💡 Prova queste soluzioni:
    echo    1. Controlla la configurazione electron-builder
    echo    2. Verifica che tutte le dipendenze siano installate
    echo    3. Riavvia il computer se necessario
    echo    4. Disabilita temporaneamente l'antivirus
    echo    5. Esegui come amministratore
    pause
    exit /b 1
)

echo.
echo ✅ EXE creato con successo!
echo.
echo 📁 File disponibile in: dist\
dir dist\*.exe
echo.

REM Open dist folder
if exist "dist" (
    explorer dist
)

pause
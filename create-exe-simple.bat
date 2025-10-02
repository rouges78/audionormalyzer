@echo off
REM Audio Normalizer - Creazione EXE Semplificata
REM Approccio step-by-step per garantire la creazione dell'EXE

echo =====================================================
echo    Audio Normalizer - Creazione EXE Semplificata
echo =====================================================
echo.

echo 🧹 Pulizia veloce...
taskkill /f /im electron.exe >nul 2>&1
taskkill /f /im node.exe >nul 2>&1
if exist "dist" rmdir /s /q "dist" >nul 2>&1

echo ✅ Pulizia completata
echo.

echo 🎯 Metodo 1: Electron Builder con configurazione minimale
call npx electron-builder --config electron-builder-minimal.config.js --win portable
if not errorlevel 1 (
    echo ✅ METODO 1 RIUSCITO!
    goto :success
)

echo ⚠️ Metodo 1 fallito, provo Metodo 2...
echo.

echo 🎯 Metodo 2: Comando diretto senza configurazione
call npx electron-builder --win --dir
if not errorlevel 1 (
    echo ✅ METODO 2 RIUSCITO!
    goto :success
)

echo ⚠️ Metodo 2 fallito, provo Metodo 3...
echo.

echo 🎯 Metodo 3: Solo package senza build
call npx electron-packager . "Audio Normalizer" --platform=win32 --arch=x64 --out=dist
if not errorlevel 1 (
    echo ✅ METODO 3 RIUSCITO!
    goto :success
)

echo ⚠️ Metodo 3 fallito, provo Metodo 4...
echo.

echo 🎯 Metodo 4: Build manuale con Electron Forge
npm install @electron-forge/cli --save-dev
call npx electron-forge import
call npx electron-forge make
if not errorlevel 1 (
    echo ✅ METODO 4 RIUSCITO!
    goto :success
)

echo ❌ TUTTI I METODI FALLITI
echo.
echo 💡 POSSIBILI CAUSE:
echo   - Antivirus blocca la creazione
echo   - Permessi insufficienti  
echo   - Spazio disco insufficiente
echo   - Dipendenze mancanti
echo.
echo 🔧 SOLUZIONI:
echo   1. Esegui come amministratore
echo   2. Disabilita temporaneamente antivirus
echo   3. Controlla spazio disco disponibile
echo   4. Riavvia il computer
echo.
pause
exit /b 1

:success
echo.
echo 🎉 EXE CREATO CON SUCCESSO!
echo.

REM Find and show the created file
echo 📁 File creati:
for /r %%i in (*.exe) do echo %%i

echo.
echo 🚀 Aprendo cartella con i file...

if exist "dist" explorer dist
if exist "out" explorer out

pause
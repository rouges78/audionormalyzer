@echo off
echo 🛡️ Audio Normalizer - Antivirus Build Fix
echo.

echo 🛑 Chiusura processi che potrebbero bloccare file...
taskkill /f /im "electron.exe" >nul 2>&1
taskkill /f /im "Audio Normalizer.exe" >nul 2>&1
taskkill /f /im "node.exe" >nul 2>&1

echo ⏳ Attesa 3 secondi...
timeout /t 3 /nobreak >nul

echo 🗑️ Eliminazione directory dist...
if exist "dist" (
    rmdir /s /q "dist" >nul 2>&1
    if exist "dist" (
        echo ⚠️ Directory dist ancora presente, tentativo con attrib...
        attrib -r -h -s "dist\*.*" /s /d >nul 2>&1
        rmdir /s /q "dist" >nul 2>&1
    )
)

echo ⏳ Attesa 2 secondi...
timeout /t 2 /nobreak >nul

echo 🔨 Avvio build Electron...
echo.

npx electron-builder --win --x64 --publish=never

echo.
echo 🔍 Verifica file di output...

if exist "dist\Audio Normalizer 0.1.0.exe" (
    echo ✅ Eseguibile creato: dist\Audio Normalizer 0.1.0.exe
    for %%A in ("dist\Audio Normalizer 0.1.0.exe") do echo    Dimensione: %%~zA bytes
    echo.
    echo 🎉 BUILD COMPLETATO CON SUCCESSO!
    echo.
    echo 🚀 Per testare: "dist\Audio Normalizer 0.1.0.exe"
) else if exist "dist\win-unpacked\Audio Normalizer.exe" (
    echo ✅ Versione unpacked creata: dist\win-unpacked\Audio Normalizer.exe
    echo.
    echo 🎉 BUILD COMPLETATO CON SUCCESSO!
    echo.
    echo 🚀 Per testare: "dist\win-unpacked\Audio Normalizer.exe"
) else (
    echo ❌ BUILD FALLITO - Nessun eseguibile creato
    echo.
    echo 🛠️ Soluzioni manuali:
    echo   1. Disabilita Windows Defender temporaneamente
    echo   2. Aggiungi questa cartella alle esclusioni antivirus
    echo   3. Esegui come Amministratore
    echo   4. Prova: npm run build:simple
)

echo.
echo 📋 Suggerimenti per evitare problemi futuri:
echo   • Aggiungi il progetto alle esclusioni antivirus
echo   • Esegui sempre come Amministratore
echo   • Chiudi applicazioni non necessarie durante build

echo.
pause
@echo off
echo 🎵 Audio Normalizer - Build con Fix Antivirus
echo.

echo 🔄 Step 1: Terminazione processi esistenti...
taskkill /f /im "Audio Normalizer Professional.exe" 2>nul
taskkill /f /im "AudioNormalizerProfessional.exe" 2>nul  
taskkill /f /im "electron.exe" 2>nul
echo    ✅ Processi terminati

echo.
echo ⏳ Step 2: Attesa stabilizzazione file system...
ping 127.0.0.1 -n 4 > nul

echo.
echo 🧹 Step 3: Pulizia directory build...
if exist "dist" (
    attrib -R "dist\*.exe" 2>nul
    del /f /q "dist\*.exe" 2>nul
    rmdir /s /q "dist" 2>nul
    echo    ✅ Directory pulita
) else (
    echo    ℹ️ Nessuna directory da pulire
)

echo.
echo ⏳ Step 4: Attesa aggiuntiva...
ping 127.0.0.1 -n 4 > nul

echo.
echo 🔨 Step 5: Avvio build...
npm run build:professional

echo.
echo 🎉 Build completato!
pause
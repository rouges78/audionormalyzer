@echo off
REM Audio Normalizer - Quick Windows EXE Builder
REM Creazione rapida solo EXE portable per Windows

echo =====================================================
echo    Audio Normalizer - Windows EXE Builder
echo =====================================================
echo.

echo 📦 Creazione EXE per Windows...
echo.

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js non trovato. Installa Node.js 18+ e riprova.
    pause
    exit /b 1
)

REM Build Next.js app first
echo 🔨 Build applicazione web...
call npm run build
if errorlevel 1 (
    echo ❌ Errore durante build web
    pause
    exit /b 1
)

REM Build Electron app
echo 🚀 Creazione EXE...
call npm run electron:dist
if errorlevel 1 (
    echo ❌ Errore durante creazione EXE
    pause
    exit /b 1
)

echo.
echo ✅ EXE creato con successo!
echo.
echo 📁 File disponibile in: dist\Audio-Normalizer-Professional-*-Portable.exe
echo.
echo 💡 Per testare: Vai nella cartella dist\ e esegui il file .exe
echo.

REM Open dist folder
if exist "dist" (
    explorer dist
)

pause
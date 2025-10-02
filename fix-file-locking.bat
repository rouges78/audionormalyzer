@echo off
REM Audio Normalizer - Fix File Locking Issues
REM Risolve i problemi di file locking durante la creazione dell'EXE

title Audio Normalizer - Fix File Locking

echo =====================================================
echo    Audio Normalizer - Fix File Locking Issues
echo =====================================================
echo.

echo ⚠️  Questo script risolverà i problemi di file locking
echo    che impediscono la creazione dell'EXE
echo.

REM Step 1: Kill all related processes with more force
echo 🧨 Terminazione processi in corso...
echo.

REM Kill Electron processes
echo Killing Electron processes...
taskkill /f /im electron.exe 2>nul
taskkill /f /fi "imagename eq electron*" 2>nul

REM Kill Node.js processes
echo Killing Node.js processes...
taskkill /f /im node.exe 2>nul
taskkill /f /fi "imagename eq node*" 2>nul

REM Kill any running Audio Normalizer instances
echo Killing Audio Normalizer processes...
taskkill /f /im "Audio-Normalizer*.exe" 2>nul
taskkill /f /im "audio-normalizer*.exe" 2>nul

REM Kill app-builder processes specifically
echo Killing app-builder processes...
taskkill /f /im "app-builder.exe" 2>nul
taskkill /f /im "app-builder-bin.exe" 2>nul

REM Wait for processes to terminate
echo ⏳ Attendere la chiusura dei processi...
timeout /t 5 /nobreak >nul

echo.
echo ✅ Processi terminati
echo.

REM Step 2: Clean all build directories with force
echo 🧹 Pulizia cartelle build...
echo.

REM Remove dist directory with multiple attempts
if exist "dist" (
    echo Removing dist directory...
    rmdir /s /q "dist" 2>nul
    if exist "dist" (
        echo ⚠️  First attempt failed, trying alternative methods...
        del /f /q "dist\*" 2>nul
        rmdir /s /q "dist" 2>nul
    )
)

REM Remove .next directory
if exist ".next" (
    echo Removing .next directory...
    rmdir /s /q ".next" 2>nul
)

REM Remove temp directories
if exist "temp" (
    echo Removing temp directory...
    rmdir /s /q "temp" 2>nul
)

REM Clean node_modules cache
if exist "node_modules\.cache" (
    echo Cleaning node_modules cache...
    rmdir /s /q "node_modules\.cache" 2>nul
)

echo.
echo ✅ Pulizia completata
echo.

REM Step 3: Wait and stabilize system
echo ⏸️  Stabilizzazione sistema...
echo.

REM Use ping instead of timeout for better compatibility
ping 127.0.0.1 -n 6 >nul

REM Step 4: Check if files are still locked
echo 🔍 Controllo file ancora in uso...
echo.

set locked=0
if exist "dist\win-unpacked\resources\app.asar" (
    echo ⚠️  File app.asar ancora presente
    set locked=1
)

if "%locked%"=="1" (
    echo ⚠️  Alcuni file sono ancora bloccati
    echo 💡 Provo con metodi alternativi...
    
    REM Try to unlock files with handle utility (if available)
    if exist "handle.exe" (
        echo Using handle utility to unlock files...
        handle.exe -c "dist" -y 2>nul
    )
    
    REM Wait longer
    ping 127.0.0.1 -n 11 >nul
)

echo.
echo ✅ Sistema stabilizzato
echo.

REM Step 5: Rebuild with optimized settings
echo 🔨 Ricostruzione con impostazioni ottimizzate...
echo.

REM Build Next.js app first
echo Building Next.js application...
call npm run build
if errorlevel 1 (
    echo ❌ Build Next.js fallito
    echo.
    echo 💡 Controlla errori nel codice prima di continuare
    pause
    exit /b 1
)

echo.
echo ✅ Build Next.js completato
echo.

REM Wait before electron build
ping 127.0.0.1 -n 6 >nul

REM Step 6: Create EXE with specific optimizations
echo Creating EXE with optimized settings...
echo.

REM Use the minimal config that we know works
call npx electron-builder --config electron-builder-minimal.config.js --win portable --publish never
if errorlevel 1 (
    echo ❌ Creazione EXE fallita
    echo.
    echo 💡 Tentativi alternativi:
    echo    1. Riavvia il computer
    echo    2. Disabilita antivirus temporaneamente  
    echo    3. Esegui come amministratore
    echo    4. Sposta il progetto in una cartella più corta
    pause
    exit /b 1
)

echo.
echo 🎉 SUCCESSO! EXE creato con successo!
echo.

REM Show created files
echo 📁 File creati:
if exist "dist" (
    dir "dist\*.exe" /b
    echo.
    echo 🚀 Aprendo cartella dist...
    explorer dist
) else (
    echo ⚠️  Nessuna cartella dist trovata
    echo Cercando file EXE in altre cartelle...
    dir "*.exe" /s /b | findstr /i "audio\|normalizer"
)

echo.
echo ✅ Processo completato!
echo.
pause
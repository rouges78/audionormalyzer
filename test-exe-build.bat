@echo off
REM Audio Normalizer - Test EXE Build
REM Verifica che l'EXE funzioni correttamente

echo =====================================================
echo    Audio Normalizer - Test EXE Build
echo =====================================================
echo.

REM Check if EXE exists
set "exe_file="
for %%f in (dist\Audio-Normalizer-Professional-*.exe) do set "exe_file=%%f"

if not defined exe_file (
    echo ❌ File EXE non trovato in dist\
    echo.
    echo 💡 Prova prima a creare l'EXE con:
    echo    .\fix-exe-build.bat
    pause
    exit /b 1
)

echo ✅ File EXE trovato: %exe_file%
echo.

REM Check file size
for %%f in ("%exe_file%") do set size=%%~zf
set /a sizeMB=%size%/1024/1024

echo 📏 Dimensione file: %sizeMB% MB

if %sizeMB% LSS 50 (
    echo ⚠️ Warning: File molto piccolo, potrebbe essere incompleto
) else (
    echo ✅ Dimensione OK
)

echo.
echo 🧪 Test di avvio rapido...

REM Quick test - start and close after 5 seconds
timeout /t 2 /nobreak >nul
start "" "%exe_file%"
echo ⏳ Avviato EXE, attendere 10 secondi per il test...
timeout /t 10 /nobreak >nul

REM Check if process is running
tasklist /fi "imagename eq Audio-Normalizer-Professional*" 2>nul | find /i "Audio-Normalizer-Professional" >nul
if %errorlevel%==0 (
    echo ✅ EXE avviato correttamente!
    echo.
    echo 🛑 Fermando il processo di test...
    taskkill /f /im "Audio-Normalizer-Professional*" >nul 2>&1
) else (
    echo ❌ EXE non si è avviato correttamente
    echo.
    echo 💡 Controlla:
    echo    - Antivirus non blocca il file
    echo    - File completo e non corrotto
    echo    - Dipendenze installate
)

echo.
echo 📁 Aprendo cartella dist...
explorer dist

pause
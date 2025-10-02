@echo off
REM Audio Normalizer - Quick Distribution Builder for Windows
REM Creazione rapida di tutte le distribuzioni

echo =====================================================
echo    Audio Normalizer - Distribution Builder
echo =====================================================
echo.

set BUILD_START_TIME=%time%

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js non trovato. Installa Node.js 18+ e riprova.
    pause
    exit /b 1
)

REM Check NPM
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ NPM non trovato. Installa Node.js con NPM e riprova.
    pause
    exit /b 1
)

echo 📦 Avvio build distribuzione...
echo.

REM Install dependencies
echo 📥 Installazione dipendenze...
call npm ci
if errorlevel 1 (
    echo ❌ Errore durante installazione dipendenze
    pause
    exit /b 1
)

REM Setup audio environment
echo 🎵 Setup ambiente audio...
call npm run setup:audio
if errorlevel 1 (
    echo ⚠️ Warning: Setup audio fallito, continuando...
)

REM Run tests
echo 🧪 Esecuzione test...
call npm run test:comprehensive
if errorlevel 1 (
    echo ⚠️ Warning: Alcuni test falliti, continuando build...
)

REM Build all distributions
echo 🚀 Build di tutte le distribuzioni...
call npm run build:all
if errorlevel 1 (
    echo ❌ Errore durante build distribuzione
    pause
    exit /b 1
)

echo.
echo ✅ Build completato con successo!
echo.
echo 📁 File di distribuzione disponibili in:
echo    - dist\ (applicazioni desktop)
echo    - .next\ (applicazione web)
echo.
echo 💡 Per deployment:
echo    Desktop: Esegui i file in dist\
echo    Web: usa 'npm start' o deploy .next\
echo    Docker: usa 'docker-compose up'
echo.

set BUILD_END_TIME=%time%
echo ⏱️ Build completato alle %BUILD_END_TIME%
echo.

pause
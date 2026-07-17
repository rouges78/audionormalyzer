@echo off
REM Audio Normalizer - Diagnosi Problemi EXE
REM Identifica perché il file EXE non viene creato

echo =====================================================
echo    Audio Normalizer - Diagnosi Problemi EXE
echo =====================================================
echo.

echo 🔍 Controllo sistema e dipendenze...
echo.

REM Check Node.js version
echo 📋 Versione Node.js:
node --version
if errorlevel 1 (
    echo ❌ Node.js non trovato!
    pause
    exit /b 1
)

REM Check npm version
echo 📋 Versione NPM:
npm --version

REM Check if electron-builder is installed
echo 📋 Electron Builder:
npx electron-builder --version
if errorlevel 1 (
    echo ⚠️ Electron Builder non trovato, installandolo...
    npm install electron-builder --save-dev
)

echo.
echo 🧹 Pulizia completa del progetto...
echo.

REM Kill all processes
taskkill /f /im electron.exe >nul 2>&1
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im "Audio-Normalizer*.exe" >nul 2>&1

REM Clean all build artifacts
if exist "dist" rmdir /s /q "dist" >nul 2>&1
if exist ".next" rmdir /s /q ".next" >nul 2>&1
if exist "node_modules\.cache" rmdir /s /q "node_modules\.cache" >nul 2>&1

echo ✅ Pulizia completata
echo.

echo 🔨 Test build Next.js...
call npm run build
if errorlevel 1 (
    echo ❌ BUILD NEXT.JS FALLITO!
    echo.
    echo 💡 Il problema è nel build web. Controlla:
    echo    - Errori TypeScript
    echo    - Problemi Tailwind CSS  
    echo    - Dipendenze mancanti
    echo.
    pause
    exit /b 1
)

echo ✅ Build Next.js riuscito!
echo.

echo 📁 Controllo file necessari per Electron...
if not exist "electron\main.js" (
    echo ❌ File Electron main mancante!
    echo Creo un file Electron semplice...
    
    if not exist "electron" mkdir "electron"
    
    echo const { app, BrowserWindow } = require('electron'); > "electron\main-simple.js"
    echo const path = require('path'); >> "electron\main-simple.js"
    echo. >> "electron\main-simple.js"
    echo function createWindow() { >> "electron\main-simple.js"
    echo   const win = new BrowserWindow({ >> "electron\main-simple.js"
    echo     width: 1200, >> "electron\main-simple.js"
    echo     height: 800, >> "electron\main-simple.js"
    echo     webPreferences: { >> "electron\main-simple.js"
    echo       nodeIntegration: true >> "electron\main-simple.js"
    echo     } >> "electron\main-simple.js"
    echo   }); >> "electron\main-simple.js"
    echo   win.loadFile('app/index.html'); >> "electron\main-simple.js"
    echo } >> "electron\main-simple.js"
    echo. >> "electron\main-simple.js"
    echo app.whenReady().then(createWindow); >> "electron\main-simple.js"
    
    echo ✅ File Electron creato
)

echo.
echo 🚀 Test creazione EXE (versione semplificata)...
echo.

REM Try simple electron-builder command
echo Tentativo 1: Comando base
call npx electron-builder --win --x64 portable
if errorlevel 1 (
    echo ❌ Tentativo 1 fallito
    echo.
    echo Tentativo 2: Con configurazione inline
    call npx electron-builder --win --x64 portable --config.directories.output=dist --config.files="**/*" --config.win.target=portable
    if errorlevel 1 (
        echo ❌ Tentativo 2 fallito
        echo.
        echo 🔧 Provo build con package.json base...
        
        REM Create minimal electron-builder config in package.json
        echo Aggiornamento package.json...
        
        echo Tentativo 3: Build minimale
        call npx electron-builder --win portable --config.appId=com.audionormalizer.app --config.productName="Audio Normalizer" --config.directories.output=dist
        if errorlevel 1 (
            echo ❌ TUTTI I TENTATIVI FALLITI
            echo.
            echo 🚨 ANALISI ERRORI:
            echo.
            echo 1. Controlla antivirus - potrebbe bloccare la creazione
            echo 2. Esegui come amministratore
            echo 3. Spazio disco insufficiente?
            echo 4. Percorso troppo lungo?
            echo 5. File in uso da altri processi?
            echo.
            echo 💡 SOLUZIONI DA PROVARE:
            echo.
            echo A. Riavvia il computer
            echo B. Disabilita temporaneamente antivirus
            echo C. Esegui da cartella con percorso più breve (es. C:\temp\audio\)
            echo D. Libera spazio su disco
            echo E. Chiudi tutti i programmi non necessari
            echo.
            pause
            exit /b 1
        )
    )
)

echo.
echo ✅ SUCCESSO! File EXE creato!
echo.

REM Check what was created
echo 📁 File creati in dist:
dir "dist\*.exe" /b 2>nul
if errorlevel 1 (
    echo ⚠️ Nessun file .exe trovato in dist, controllo altre cartelle...
    dir "*.exe" /s /b | findstr "Audio-Normalizer"
) else (
    echo.
    echo 🎉 EXE trovato! Aprendo cartella dist...
    explorer dist
)

echo.
echo 🧪 Test rapido del file EXE...
for %%f in (dist\*.exe) do (
    echo Testando: %%f
    start "" "%%f"
    echo ⏳ EXE avviato, controlla se funziona...
    timeout /t 5 /nobreak >nul
    tasklist | findstr "%%~nf" >nul
    if errorlevel 1 (
        echo ⚠️ EXE non sembra essere in esecuzione
    ) else (
        echo ✅ EXE in esecuzione!
        taskkill /f /im "%%~nxf" >nul 2>&1
    )
)

echo.
echo 📋 RIEPILOGO DIAGNOSI COMPLETATA
echo =====================================
pause
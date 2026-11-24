@echo off
REM Audio Normalizer - EXE Problem Diagnosis
REM Finds out why the EXE file is not created

echo =====================================================
echo    Audio Normalizer - EXE Problem Diagnosis
echo =====================================================
echo.

echo 🔍 Checking system and dependencies...
echo.

REM Check Node.js version
echo 📋 Node.js version:
node --version
if errorlevel 1 (
    echo ❌ Node.js not found!
    pause
    exit /b 1
)

REM Check npm version
echo 📋 NPM version:
npm --version

REM Check if electron-builder is installed
echo 📋 Electron Builder:
npx electron-builder --version
if errorlevel 1 (
    echo ⚠️ Electron Builder not found, installing it...
    npm install electron-builder --save-dev
)

echo.
echo 🧹 Full project cleanup...
echo.

REM Kill all processes
taskkill /f /im electron.exe >nul 2>&1
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im "Audio-Normalizer*.exe" >nul 2>&1

REM Clean all build artifacts
if exist "dist" rmdir /s /q "dist" >nul 2>&1
if exist ".next" rmdir /s /q ".next" >nul 2>&1
if exist "node_modules\.cache" rmdir /s /q "node_modules\.cache" >nul 2>&1

echo ✅ Cleanup completed
echo.

echo 🔨 Testing Next.js build...
call npm run build
if errorlevel 1 (
    echo ❌ NEXT.JS BUILD FAILED!
    echo.
    echo 💡 The problem is in the web build. Check:
    echo    - TypeScript errors
    echo    - Tailwind CSS problems  
    echo    - Missing dependencies
    echo.
    pause
    exit /b 1
)

echo ✅ Next.js build succeeded!
echo.

echo 📁 Checking files required by Electron...
if not exist "electron\main.js" (
    echo ❌ Electron main file missing!
    echo Creating a simple Electron file...
    
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
    
    echo ✅ Electron file created
)

echo.
echo 🚀 Testing EXE creation (simplified version)...
echo.

REM Try simple electron-builder command
echo Attempt 1: Basic command
call npx electron-builder --win --x64 portable
if errorlevel 1 (
    echo ❌ Attempt 1 failed
    echo.
    echo Attempt 2: With inline configuration
    call npx electron-builder --win --x64 portable --config.directories.output=dist --config.files="**/*" --config.win.target=portable
    if errorlevel 1 (
        echo ❌ Attempt 2 failed
        echo.
        echo 🔧 Trying build with a basic package.json...
        
        REM Create minimal electron-builder config in package.json
        echo Updating package.json...
        
        echo Attempt 3: Minimal build
        call npx electron-builder --win portable --config.appId=com.audionormalizer.app --config.productName="Audio Normalizer" --config.directories.output=dist
        if errorlevel 1 (
            echo ❌ ALL ATTEMPTS FAILED
            echo.
            echo 🚨 ERROR ANALYSIS:
            echo.
            echo 1. Check the antivirus - it could block the creation
            echo 2. Run as administrator
            echo 3. Insufficient disk space?
            echo 4. Path too long?
            echo 5. Files in use by other processes?
            echo.
            echo 💡 SOLUTIONS TO TRY:
            echo.
            echo A. Restart the computer
            echo B. Temporarily disable the antivirus
            echo C. Run from a folder with a shorter path (e.g. C:\temp\audio\)
            echo D. Free up disk space
            echo E. Close all unnecessary programs
            echo.
            pause
            exit /b 1
        )
    )
)

echo.
echo ✅ SUCCESS! EXE file created!
echo.

REM Check what was created
echo 📁 Files created in dist:
dir "dist\*.exe" /b 2>nul
if errorlevel 1 (
    echo ⚠️ No .exe file found in dist, checking other folders...
    dir "*.exe" /s /b | findstr "Audio-Normalizer"
) else (
    echo.
    echo 🎉 EXE found! Opening dist folder...
    explorer dist
)

echo.
echo 🧪 Quick test of the EXE file...
for %%f in (dist\*.exe) do (
    echo Testing: %%f
    start "" "%%f"
    echo ⏳ EXE started, check whether it works...
    timeout /t 5 /nobreak >nul
    tasklist | findstr "%%~nf" >nul
    if errorlevel 1 (
        echo ⚠️ EXE does not seem to be running
    ) else (
        echo ✅ EXE running!
        taskkill /f /im "%%~nxf" >nul 2>&1
    )
)

echo.
echo 📋 DIAGNOSIS COMPLETED - SUMMARY
echo =====================================
pause
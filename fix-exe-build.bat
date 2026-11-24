@echo off
REM Audio Normalizer - Fix EXE Build Issues
REM Automatically fixes build problems on Windows

echo =====================================================
echo    Audio Normalizer - Fix Build Issues
echo =====================================================
echo.

echo 🔧 Fixing build issues...
echo.

REM Stop all related processes
echo 🛑 Stopping Electron/Node processes...
taskkill /f /im electron.exe >nul 2>&1
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im "Audio-Normalizer*.exe" >nul 2>&1
taskkill /f /im "app-builder.exe" >nul 2>&1

REM Wait a bit
timeout /t 3 /nobreak >nul

REM Clean dist directory
echo 🧹 Cleaning dist folder...
if exist "dist" (
    rmdir /s /q "dist" >nul 2>&1
    if exist "dist" (
        echo ⚠️ Unable to remove dist, trying with force...
        rd /s /q "dist" >nul 2>&1
    )
)

REM Clean node_modules cache
echo 🧹 Cleaning node_modules cache...
if exist "node_modules\.cache" (
    rmdir /s /q "node_modules\.cache" >nul 2>&1
)

REM Clean .next directory
echo 🧹 Cleaning .next...
if exist ".next" (
    rmdir /s /q ".next" >nul 2>&1
)

REM Clean temp directories
echo 🧹 Cleaning temporary folders...
if exist "temp" (
    rmdir /s /q "temp" >nul 2>&1
)

REM Wait again
timeout /t 2 /nobreak >nul

echo.
echo ✅ Cleanup completed!
echo.
echo 🚀 Starting a new build...
echo.

REM Build with fresh start
call npm run build
if errorlevel 1 (
    echo ❌ Error during the web build
    pause
    exit /b 1
)

REM Small delay before electron build
timeout /t 3 /nobreak >nul

REM Build electron with specific flags
echo 🔨 Creating EXE with optimized parameters...
echo 📋 Using the correct configuration...
call npx electron-builder --win --x64 portable --config electron-builder.config.js
if errorlevel 1 (
    echo ❌ Error while creating the EXE
    echo.
    echo 💡 Try these solutions:
    echo    1. Check the electron-builder configuration
    echo    2. Check that all dependencies are installed
    echo    3. Restart the computer if needed
    echo    4. Temporarily disable the antivirus
    echo    5. Run as administrator
    pause
    exit /b 1
)

echo.
echo ✅ EXE created successfully!
echo.
echo 📁 File available in: dist\
dir dist\*.exe
echo.

REM Open dist folder
if exist "dist" (
    explorer dist
)

pause
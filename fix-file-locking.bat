@echo off
REM Audio Normalizer - Fix File Locking Issues
REM Fixes file locking problems during EXE creation

title Audio Normalizer - Fix File Locking

echo =====================================================
echo    Audio Normalizer - Fix File Locking Issues
echo =====================================================
echo.

echo ⚠️  This script will fix the file locking problems
echo    that prevent the EXE from being created
echo.

REM Step 1: Kill all related processes with more force
echo 🧨 Terminating running processes...
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
echo ⏳ Waiting for the processes to close...
timeout /t 5 /nobreak >nul

echo.
echo ✅ Processes terminated
echo.

REM Step 2: Clean all build directories with force
echo 🧹 Cleaning build folders...
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
echo ✅ Cleanup completed
echo.

REM Step 3: Wait and stabilize system
echo ⏸️  Stabilizing the system...
echo.

REM Use ping instead of timeout for better compatibility
ping 127.0.0.1 -n 6 >nul

REM Step 4: Check if files are still locked
echo 🔍 Checking files still in use...
echo.

set locked=0
if exist "dist\win-unpacked\resources\app.asar" (
    echo ⚠️  app.asar file still present
    set locked=1
)

if "%locked%"=="1" (
    echo ⚠️  Some files are still locked
    echo 💡 Trying alternative methods...
    
    REM Try to unlock files with handle utility (if available)
    if exist "handle.exe" (
        echo Using handle utility to unlock files...
        handle.exe -c "dist" -y 2>nul
    )
    
    REM Wait longer
    ping 127.0.0.1 -n 11 >nul
)

echo.
echo ✅ System stabilized
echo.

REM Step 5: Rebuild with optimized settings
echo 🔨 Rebuilding with optimized settings...
echo.

REM Build Next.js app first
echo Building Next.js application...
call npm run build
if errorlevel 1 (
    echo ❌ Next.js build failed
    echo.
    echo 💡 Check for errors in the code before continuing
    pause
    exit /b 1
)

echo.
echo ✅ Next.js build completed
echo.

REM Wait before electron build
ping 127.0.0.1 -n 6 >nul

REM Step 6: Create EXE with specific optimizations
echo Creating EXE with optimized settings...
echo.

REM Use the minimal config that we know works
call npx electron-builder --config electron-builder-minimal.config.js --win portable --publish never
if errorlevel 1 (
    echo ❌ EXE creation failed
    echo.
    echo 💡 Alternative attempts:
    echo    1. Restart the computer
    echo    2. Temporarily disable the antivirus  
    echo    3. Run as administrator
    echo    4. Move the project to a shorter folder
    pause
    exit /b 1
)

echo.
echo 🎉 SUCCESS! EXE created successfully!
echo.

REM Show created files
echo 📁 Files created:
if exist "dist" (
    dir "dist\*.exe" /b
    echo.
    echo 🚀 Opening dist folder...
    explorer dist
) else (
    echo ⚠️  No dist folder found
    echo Looking for EXE files in other folders...
    dir "*.exe" /s /b | findstr /i "audio\|normalizer"
)

echo.
echo ✅ Process completed!
echo.
pause
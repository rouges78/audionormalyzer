@echo off
REM Audio Normalizer - Simplified EXE Creation
REM Step-by-step approach to guarantee the EXE gets created

echo =====================================================
echo    Audio Normalizer - Simplified EXE Creation
echo =====================================================
echo.

echo 🧹 Quick cleanup...
taskkill /f /im electron.exe >nul 2>&1
taskkill /f /im node.exe >nul 2>&1
if exist "dist" rmdir /s /q "dist" >nul 2>&1

echo ✅ Cleanup completed
echo.

echo 🎯 Method 1: Electron Builder with minimal configuration
call npx electron-builder --config electron-builder-minimal.config.js --win portable
if not errorlevel 1 (
    echo ✅ METHOD 1 SUCCEEDED!
    goto :success
)

echo ⚠️ Method 1 failed, trying Method 2...
echo.

echo 🎯 Method 2: Direct command without configuration
call npx electron-builder --win --dir
if not errorlevel 1 (
    echo ✅ METHOD 2 SUCCEEDED!
    goto :success
)

echo ⚠️ Method 2 failed, trying Method 3...
echo.

echo 🎯 Method 3: Package only, without build
call npx electron-packager . "Audio Normalizer" --platform=win32 --arch=x64 --out=dist
if not errorlevel 1 (
    echo ✅ METHOD 3 SUCCEEDED!
    goto :success
)

echo ⚠️ Method 3 failed, trying Method 4...
echo.

echo 🎯 Method 4: Manual build with Electron Forge
npm install @electron-forge/cli --save-dev
call npx electron-forge import
call npx electron-forge make
if not errorlevel 1 (
    echo ✅ METHOD 4 SUCCEEDED!
    goto :success
)

echo ❌ ALL METHODS FAILED
echo.
echo 💡 POSSIBLE CAUSES:
echo   - Antivirus blocks the creation
echo   - Insufficient permissions  
echo   - Insufficient disk space
echo   - Missing dependencies
echo.
echo 🔧 SOLUTIONS:
echo   1. Run as administrator
echo   2. Temporarily disable the antivirus
echo   3. Check available disk space
echo   4. Restart the computer
echo.
pause
exit /b 1

:success
echo.
echo 🎉 EXE CREATED SUCCESSFULLY!
echo.

REM Find and show the created file
echo 📁 Files created:
for /r %%i in (*.exe) do echo %%i

echo.
echo 🚀 Opening the folder with the files...

if exist "dist" explorer dist
if exist "out" explorer out

pause
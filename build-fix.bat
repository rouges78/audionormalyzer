@echo off
echo 🛡️ Audio Normalizer - Antivirus Build Fix
echo.

echo 🛑 Closing processes that could lock files...
taskkill /f /im "electron.exe" >nul 2>&1
taskkill /f /im "Audio Normalizer.exe" >nul 2>&1
taskkill /f /im "node.exe" >nul 2>&1

echo ⏳ Waiting 3 seconds...
timeout /t 3 /nobreak >nul

echo 🗑️ Deleting dist directory...
if exist "dist" (
    rmdir /s /q "dist" >nul 2>&1
    if exist "dist" (
        echo ⚠️ dist directory still present, trying with attrib...
        attrib -r -h -s "dist\*.*" /s /d >nul 2>&1
        rmdir /s /q "dist" >nul 2>&1
    )
)

echo ⏳ Waiting 2 seconds...
timeout /t 2 /nobreak >nul

echo 🔨 Starting Electron build...
echo.

npx electron-builder --win --x64 --publish=never

echo.
echo 🔍 Checking output files...

if exist "dist\Audio Normalizer 0.1.0.exe" (
    echo ✅ Executable created: dist\Audio Normalizer 0.1.0.exe
    for %%A in ("dist\Audio Normalizer 0.1.0.exe") do echo    Dimensione: %%~zA bytes
    echo.
    echo 🎉 BUILD COMPLETED SUCCESSFULLY!
    echo.
    echo 🚀 To test: "dist\Audio Normalizer 0.1.0.exe"
) else if exist "dist\win-unpacked\Audio Normalizer.exe" (
    echo ✅ Unpacked version created: dist\win-unpacked\Audio Normalizer.exe
    echo.
    echo 🎉 BUILD COMPLETED SUCCESSFULLY!
    echo.
    echo 🚀 To test: "dist\win-unpacked\Audio Normalizer.exe"
) else (
    echo ❌ BUILD FAILED - No executable created
    echo.
    echo 🛠️ Manual solutions:
    echo   1. Temporarily disable Windows Defender
    echo   2. Add this folder to the antivirus exclusions
    echo   3. Run as Administrator
    echo   4. Try: npm run build:simple
)

echo.
echo 📋 Tips to avoid future problems:
echo   • Add the project to the antivirus exclusions
echo   • Always run as Administrator
echo   • Close unnecessary applications during the build

echo.
pause
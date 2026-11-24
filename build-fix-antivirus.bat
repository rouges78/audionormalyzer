@echo off
echo 🎵 Audio Normalizer - Build with Antivirus Fix
echo.

echo 🔄 Step 1: Terminating existing processes...
taskkill /f /im "Audio Normalizer Professional.exe" 2>nul
taskkill /f /im "AudioNormalizerProfessional.exe" 2>nul  
taskkill /f /im "electron.exe" 2>nul
echo    ✅ Processes terminated

echo.
echo ⏳ Step 2: Waiting for the file system to settle...
ping 127.0.0.1 -n 4 > nul

echo.
echo 🧹 Step 3: Cleaning build directory...
if exist "dist" (
    attrib -R "dist\*.exe" 2>nul
    del /f /q "dist\*.exe" 2>nul
    rmdir /s /q "dist" 2>nul
    echo    ✅ Directory cleaned
) else (
    echo    ℹ️ No directory to clean
)

echo.
echo ⏳ Step 4: Additional wait...
ping 127.0.0.1 -n 4 > nul

echo.
echo 🔨 Step 5: Starting build...
npm run build:professional

echo.
echo 🎉 Build completed!
pause
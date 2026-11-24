@echo off
REM Audio Normalizer - Quick Windows EXE Builder
REM Quick creation of the portable Windows EXE only

echo =====================================================
echo    Audio Normalizer - Windows EXE Builder
echo =====================================================
echo.

echo 📦 Creating EXE for Windows...
echo.

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js not found. Install Node.js 18+ and try again.
    pause
    exit /b 1
)

REM Build Next.js app first
echo 🔨 Building the web application...
call npm run build
if errorlevel 1 (
    echo ❌ Error during the web build
    pause
    exit /b 1
)

REM Build Electron app
echo 🚀 Creating EXE...
call npm run electron:dist
if errorlevel 1 (
    echo ❌ Error while creating the EXE
    pause
    exit /b 1
)

echo.
echo ✅ EXE created successfully!
echo.
echo 📁 File available in: dist\Audio-Normalizer-Professional-*-Portable.exe
echo.
echo 💡 To test: go to the dist\ folder and run the .exe file
echo.

REM Open dist folder
if exist "dist" (
    explorer dist
)

pause
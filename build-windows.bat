@echo off
echo.
echo ========================================
echo   Audio Normalizer - Windows Builder
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found. Please install Node.js 18+ first.
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js version:
node --version
echo.

REM Check if npm is available
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: npm not found. Please reinstall Node.js.
    pause
    exit /b 1
)

echo npm version:
npm --version
echo.

echo Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies.
    pause
    exit /b 1
)

echo.
echo Building Audio Normalizer executable...
call npm run build:exe
if %errorlevel% neq 0 (
    echo ERROR: Build failed.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   BUILD COMPLETED SUCCESSFULLY!
echo ========================================
echo.
echo The installer has been created in the 'dist' folder.
echo Look for: Audio Normalizer Setup 0.1.0.exe
echo.
echo You can now:
echo 1. Run the installer to install Audio Normalizer
echo 2. Share the installer with others
echo 3. Find the portable version in dist/win-unpacked/
echo.

REM Open dist folder if it exists
if exist "dist" (
    echo Opening dist folder...
    start "" "dist"
)

echo.
echo Press any key to exit...
pause >nul
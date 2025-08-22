@echo off
echo.
echo ========================================
echo   Audio Normalizer - Simple Builder
echo ========================================
echo.

REM Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found!
    echo Please install Node.js from: https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js found: 
node --version
echo.

echo Running simple build process...
echo This may take several minutes...
echo.

node scripts/simple-build.js

if %errorlevel% neq 0 (
    echo.
    echo ========================================
    echo   BUILD FAILED - TROUBLESHOOTING
    echo ========================================
    echo.
    echo Try these solutions:
    echo 1. Run as Administrator
    echo 2. Disable antivirus temporarily
    echo 3. Clear npm cache: npm cache clean --force
    echo 4. Delete node_modules folder and run: npm install
    echo 5. Check internet connection
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   BUILD COMPLETED SUCCESSFULLY!
echo ========================================
echo.
echo Your executable is ready in the 'dist' folder!
echo.

if exist "dist" (
    echo Opening dist folder...
    start "" "dist"
)

pause
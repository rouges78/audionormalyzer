@echo off
REM Audio Normalizer - Quick Distribution Builder for Windows
REM Quick creation of all distributions

echo =====================================================
echo    Audio Normalizer - Distribution Builder
echo =====================================================
echo.

set BUILD_START_TIME=%time%

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js not found. Install Node.js 18+ and try again.
    pause
    exit /b 1
)

REM Check NPM
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ NPM not found. Install Node.js with NPM and try again.
    pause
    exit /b 1
)

echo 📦 Starting distribution build...
echo.

REM Install dependencies
echo 📥 Installing dependencies...
call npm ci
if errorlevel 1 (
    echo ❌ Error while installing dependencies
    pause
    exit /b 1
)

REM Setup audio environment
echo 🎵 Setting up the audio environment...
call npm run setup:audio
if errorlevel 1 (
    echo ⚠️ Warning: Audio setup failed, continuing...
)

REM Run tests
echo 🧪 Running tests...
call npm run test:comprehensive
if errorlevel 1 (
    echo ⚠️ Warning: Some tests failed, continuing the build...
)

REM Build all distributions
echo 🚀 Building all distributions...
call npm run build:all
if errorlevel 1 (
    echo ❌ Error during the distribution build
    pause
    exit /b 1
)

echo.
echo ✅ Build completed successfully!
echo.
echo 📁 Distribution files available in:
echo    - dist\ (desktop applications)
echo    - .next\ (web application)
echo.
echo 💡 For deployment:
echo    Desktop: Run the files in dist\
echo    Web: use 'npm start' or deploy .next\
echo    Docker: use 'docker-compose up'
echo.

set BUILD_END_TIME=%time%
echo ⏱️ Build completed at %BUILD_END_TIME%
echo.

pause
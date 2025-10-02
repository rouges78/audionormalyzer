@echo off
REM Audio Normalizer - Quick Tailwind CSS Test
REM Verifica che Tailwind CSS funzioni correttamente

echo =====================================================
echo    Audio Normalizer - Tailwind CSS Test
echo =====================================================
echo.

echo 🧪 Testing Tailwind CSS configuration...
echo.

REM Clean .next directory
if exist ".next" (
    echo 🧹 Cleaning .next directory...
    rmdir /s /q ".next" >nul 2>&1
)

REM Test build
echo 🔨 Testing Next.js build...
call npm run build
if errorlevel 1 (
    echo ❌ Build failed - Tailwind CSS issue persists
    echo.
    echo 💡 Try these solutions:
    echo    1. Check globals.css for syntax errors
    echo    2. Verify tailwind.config.js is correct
    echo    3. Install missing dependencies: npm install tailwindcss-animate
    pause
    exit /b 1
) else (
    echo ✅ Build successful - Tailwind CSS is working!
    echo.
    echo 🚀 Ready to create EXE!
    echo.
    echo 💡 Next steps:
    echo    1. Run .\fix-exe-build.bat to create EXE
    echo    2. Or run npm run build:exe:safe
)

pause
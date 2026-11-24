@echo off
REM Audio Normalizer - Test EXE Build
REM Checks that the EXE works correctly

echo =====================================================
echo    Audio Normalizer - Test EXE Build
echo =====================================================
echo.

REM Check if EXE exists
set "exe_file="
for %%f in (dist\Audio-Normalizer-Professional-*.exe) do set "exe_file=%%f"

if not defined exe_file (
    echo ❌ EXE file not found in dist\
    echo.
    echo 💡 First try to create the EXE with:
    echo    .\fix-exe-build.bat
    pause
    exit /b 1
)

echo ✅ EXE file found: %exe_file%
echo.

REM Check file size
for %%f in ("%exe_file%") do set size=%%~zf
set /a sizeMB=%size%/1024/1024

echo 📏 File size: %sizeMB% MB

if %sizeMB% LSS 50 (
    echo ⚠️ Warning: File very small, it could be incomplete
) else (
    echo ✅ Size OK
)

echo.
echo 🧪 Quick startup test...

REM Quick test - start and close after 5 seconds
timeout /t 2 /nobreak >nul
start "" "%exe_file%"
echo ⏳ EXE started, wait 10 seconds for the test...
timeout /t 10 /nobreak >nul

REM Check if process is running
tasklist /fi "imagename eq Audio-Normalizer-Professional*" 2>nul | find /i "Audio-Normalizer-Professional" >nul
if %errorlevel%==0 (
    echo ✅ EXE started correctly!
    echo.
    echo 🛑 Stopping the test process...
    taskkill /f /im "Audio-Normalizer-Professional*" >nul 2>&1
) else (
    echo ❌ EXE did not start correctly
    echo.
    echo 💡 Check:
    echo    - The antivirus is not blocking the file
    echo    - The file is complete and not corrupted
    echo    - Dependencies are installed
)

echo.
echo 📁 Opening dist folder...
explorer dist

pause
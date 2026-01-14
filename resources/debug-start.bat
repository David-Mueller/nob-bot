@echo off
echo Starting NoB-Con Aktivitaeten in Debug Mode...
echo.
echo Debug log will be written to: %USERPROFILE%\.aktivitaeten\debug.log
echo.

:: Find the installed app
set "APP_PATH=%LOCALAPPDATA%\Programs\nob-con-aktivitaten\NoB-Con Aktivitäten.exe"

if not exist "%APP_PATH%" (
    echo ERROR: App not found at %APP_PATH%
    echo Please install the app first.
    pause
    exit /b 1
)

:: Start with debug flag
start "" "%APP_PATH%" --debug

echo.
echo App started. Check DevTools (Ctrl+Shift+I) and the log file for debug info.
echo.
pause

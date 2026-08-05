@echo off
REM One-click web build + launch for Hunter Protocol.
REM Double-click this file in Windows Explorer, or run it from a terminal.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required but wasn't found. Install it from https://nodejs.org/ and try again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies ^(first run only^)...
  call npm install
  if errorlevel 1 goto :error
)

echo Building the web version...
call npm run build
if errorlevel 1 goto :error

echo Starting local server and opening the game in your browser...
call npm run play
goto :eof

:error
echo.
echo Something went wrong - see the messages above.
pause
exit /b 1

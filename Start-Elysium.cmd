@echo off
cd /d "%~dp0"
if exist "release\win-unpacked\elysium-browser.exe" (
  start "" "release\win-unpacked\elysium-browser.exe"
  exit /b
)
if not exist "node_modules\electron\dist\electron.exe" (
  echo Installing elysium-browser dependencies...
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
call npm start



@echo off
cd /d "%~dp0"
if exist "release\win-unpacked\elysium-browser.exe" (
  start "" "release\win-unpacked\elysium-browser.exe" %*
  exit /b
)
rem Launch the portable build matching package.json (e.g. 1.4.2), so the
rem shortcut always follows the current version without editing this file.
for /f "delims=" %%v in ('node -p "require('./package.json').version" 2^>nul') do set ELYSIUM_VERSION=%%v
if defined ELYSIUM_VERSION (
  if exist "release\elysium-browser-%ELYSIUM_VERSION%-portable.exe" (
    start "" "release\elysium-browser-%ELYSIUM_VERSION%-portable.exe" %*
    exit /b
  )
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



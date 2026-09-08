@echo off
cd /d "%~dp0"
if exist "release-browser-identity\win-unpacked\Cherrywebbrowser.exe" (
  start "" "release-browser-identity\win-unpacked\Cherrywebbrowser.exe"
  exit /b
)
if exist "release-calendar-full-cell\win-unpacked\Cherrywebbrowser.exe" (
  start "" "release-calendar-full-cell\win-unpacked\Cherrywebbrowser.exe"
  exit /b
)
if exist "release-anime-icon-version\win-unpacked\Cherrywebbrowser.exe" (
  start "" "release-anime-icon-version\win-unpacked\Cherrywebbrowser.exe"
  exit /b
)
if exist "release-calendar-responsive\win-unpacked\Cherrywebbrowser.exe" (
  start "" "release-calendar-responsive\win-unpacked\Cherrywebbrowser.exe"
  exit /b
)
if exist "release-youtube-fullscreen-stable\win-unpacked\Cherrywebbrowser.exe" (
  start "" "release-youtube-fullscreen-stable\win-unpacked\Cherrywebbrowser.exe"
  exit /b
)
if exist "release-youtube-fullscreen-final\win-unpacked\Cherrywebbrowser.exe" (
  start "" "release-youtube-fullscreen-final\win-unpacked\Cherrywebbrowser.exe"
  exit /b
)
if exist "release-youtube-fullscreen\win-unpacked\Cherrywebbrowser.exe" (
  start "" "release-youtube-fullscreen\win-unpacked\Cherrywebbrowser.exe"
  exit /b
)
if exist "release-fullscreen\win-unpacked\Cherrywebbrowser.exe" (
  start "" "release-fullscreen\win-unpacked\Cherrywebbrowser.exe"
  exit /b
)
if exist "release-tab-audio\win-unpacked\Cherrywebbrowser.exe" (
  start "" "release-tab-audio\win-unpacked\Cherrywebbrowser.exe"
  exit /b
)
if exist "release-drag-fix\win-unpacked\Cherrywebbrowser.exe" (
  start "" "release-drag-fix\win-unpacked\Cherrywebbrowser.exe"
  exit /b
)
if exist "release-brand\win-unpacked\Cherrywebbrowser.exe" (
  start "" "release-brand\win-unpacked\Cherrywebbrowser.exe"
  exit /b
)
if exist "release-novel-themes\win-unpacked\Cherrywebbrowser.exe" (
  start "" "release-novel-themes\win-unpacked\Cherrywebbrowser.exe"
  exit /b
)
if exist "release-calendar\win-unpacked\Cherrywebbrowser.exe" (
  start "" "release-calendar\win-unpacked\Cherrywebbrowser.exe"
  exit /b
)
if exist "release-classic-notes\win-unpacked\Cherrywebbrowser.exe" (
  start "" "release-classic-notes\win-unpacked\Cherrywebbrowser.exe"
  exit /b
)
if exist "release\win-unpacked\Cherrywebbrowser.exe" (
  start "" "release\win-unpacked\Cherrywebbrowser.exe"
  exit /b
)
if not exist "node_modules\electron\dist\electron.exe" (
  echo Installing Cherry dependencies...
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
call npm start

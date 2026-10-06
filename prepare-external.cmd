@echo off
setlocal

set "SITE_DIR=%~dp0"
cd /d "%SITE_DIR%"

call npm run prepare:external -- %*
exit /b %errorlevel%

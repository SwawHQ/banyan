@echo off
setlocal

set "SITE_DIR=%~dp0"

cd /d "%SITE_DIR%"

npm run dev

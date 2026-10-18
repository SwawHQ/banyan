@echo off
setlocal DisableDelayedExpansion
if /i "%~1"=="doctor" goto bootstrap
if /i "%~1"=="base/bun/ensure" goto bootstrap
if /i "%~1"=="base/node/ensure" goto bootstrap
if not exist "%~dp0.tools\cli.cmd" goto bootstrap
"%~dp0.tools\cli.cmd" "%~dp0tasks\_cli\main.mjs" %*
:bootstrap
set "PSModulePath=%SystemRoot%\System32\WindowsPowerShell\v1.0\Modules"
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0scripts\bootstrap.ps1" %*
exit /b %ERRORLEVEL%

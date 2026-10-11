@echo off
setlocal DisableDelayedExpansion
if /i "%~1"=="ensure" goto bootstrap
if /i "%~1"=="bun.ensure" goto bootstrap
if /i "%~1"=="node.ensure" goto bootstrap
if not exist "%~dp0.tools\cli.cmd" goto bootstrap
"%~dp0.tools\cli.cmd" "%~dp0scripts.js\swban.mjs" %*
:bootstrap
set "PSModulePath=%SystemRoot%\System32\WindowsPowerShell\v1.0\Modules"
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0scripts\bootstrap.ps1" %*
exit /b %ERRORLEVEL%

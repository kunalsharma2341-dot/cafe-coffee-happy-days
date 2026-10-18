@echo off
setlocal
cd /d "%~dp0"
title Happy Days - Netlify
where node >nul 2>nul
if errorlevel 1 goto node_missing
node -e "process.exit(Number(process.versions.node.split('.')[0]) < 22 ? 1 : 0)"
if errorlevel 1 goto node_missing
if not exist package.json goto wrong_folder

echo Happy Days - publish website updates
echo This does not recreate your site or import/rotate secrets.
if not exist .netlify\state.json goto not_linked
call npx --yes netlify-cli status
if errorlevel 1 goto failed
choice /c YN /n /m "Publish your edited files to the project shown above [Y/N]? "
if errorlevel 2 goto cancelled
call npm ci
if errorlevel 1 goto failed
call npm test
if errorlevel 1 goto failed
call npm run deploy
if errorlevel 1 goto failed
echo.
echo UPDATE COMPLETE. Open the live URL printed above.
pause
exit /b 0
:not_linked
echo This folder is not linked to a Netlify project yet.
echo Use SETUP.bat first, or link it to your EXISTING site.
pause
exit /b 1
:cancelled
echo Cancelled. No deployment was started.
pause
exit /b 0

:failed
echo.
echo STOPPED: A command failed. Read the error above.
echo You can retry this file after fixing it. Do not share passwords or .env.
pause
exit /b 1
:node_missing
echo Install Node.js LTS version 22 or newer from https://nodejs.org/
echo Then close this window and open this file again.
pause
exit /b 1
:wrong_folder
echo Extract the COMPLETE ZIP first. Keep this file beside package.json.
pause
exit /b 1

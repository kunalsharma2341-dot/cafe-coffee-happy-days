@echo off
setlocal
cd /d "%~dp0"
title Happy Days - Netlify
where node >nul 2>nul
if errorlevel 1 goto node_missing
node -e "process.exit(Number(process.versions.node.split('.')[0]) < 22 ? 1 : 0)"
if errorlevel 1 goto node_missing
if not exist package.json goto wrong_folder

echo Happy Days - first-time setup and deployment
echo Keep this window open. No administrator access is needed.
echo.
call npm ci
if errorlevel 1 goto failed
if exist .env goto secrets_ready
call npm run setup
if errorlevel 1 goto failed
:secrets_ready
echo Existing .env will be preserved.
call npx --yes netlify-cli login
if errorlevel 1 goto failed
if exist .netlify\state.json goto linked
choice /c NE /n /m "Create a NEW Netlify site [N], or use an EXISTING site [E]? "
if errorlevel 2 goto link_existing
call npx --yes netlify-cli sites:create
if errorlevel 1 goto failed
if exist .netlify\state.json goto linked
:link_existing
call npx --yes netlify-cli link
if errorlevel 1 goto failed
:linked
call npx --yes netlify-cli status
if errorlevel 1 goto failed
echo.
echo Check the project shown above. This will import this folder's secrets
echo and publish the website there. On an existing site, imported secrets
 echo replace matching values and may invalidate existing sessions.
choice /c YN /n /m "Is this the correct Happy Days project? Deploy now [Y/N]? "
if errorlevel 2 goto cancelled
call npx --yes netlify-cli env:import .env
if errorlevel 1 goto failed
call npm test
if errorlevel 1 goto failed
call npm run deploy
if errorlevel 1 goto failed
echo.
echo DEPLOYMENT COMPLETE. Open the live URL printed above.
echo Check /order.html and /staff with one test order.
echo Next time use UPDATE.bat. Keep this project folder and .env private.
pause
exit /b 0
:cancelled
echo Cancelled. No deployment was started.
echo To change the linked project, run npx netlify-cli link in this folder.
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

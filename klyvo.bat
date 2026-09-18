@echo off
cd /d "E:\klyvo-admin-dashboard-fixed\klyvo-admin-dashboard-fixed"
start /B node --env-file=.env server/index.mjs
timeout /t 3 /nobreak > NUL
start http://localhost:3000
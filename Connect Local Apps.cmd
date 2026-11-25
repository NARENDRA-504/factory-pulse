@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -File ".\scripts\Connect-LocalApps.ps1" -OpenBrowser
pause

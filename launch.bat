@echo off
REM This script opens two PowerShell windows for backend and frontend development.

REM Define the base workspace directory for easier modification
set "WORKSPACE_BASE=D:\Projects\101Projects\101Workspace"

echo Starting Backend Server...
REM PowerShell for Backend
REM 1. Navigate to the 'backend' directory.
REM 2. Activate the virtual environment.
REM 3. Navigate to the 'Workspace101' directory (where manage.py is expected).
REM 4. Run the Django development server.
start "Backend Server" powershell.exe -NoExit -Command "& { Set-Location -LiteralPath \"%WORKSPACE_BASE%\backend\"; . \".venv\Scripts\activate.ps1\"; Set-Location -LiteralPath \".\Workspace101\"; python manage.py runserver }"

timeout /t 2 >nul
echo Starting Frontend Dev Server...
REM PowerShell for Frontend
REM 1. Navigate to the 'frontend' directory.
REM 2. Run the npm development script.
start "Frontend Dev" powershell.exe -NoExit -Command "& { Set-Location -LiteralPath \"%WORKSPACE_BASE%\frontend\"; npm run dev }"

echo All development servers should be starting in new PowerShell windows.
echo Please check the console output of each window for status.
pause
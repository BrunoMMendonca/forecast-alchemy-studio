@echo off
ECHO Starting all servers...

:: Start the Frontend Development Server (Vite)
ECHO Starting Frontend Server...
start "Frontend (Vite)" cmd /k "npm run dev"

:: Start the Backend API Server
ECHO Starting Backend API Server...
start "Backend API" cmd /k "npm run start:api"

:: Start the Backend Worker Process
ECHO Starting Backend Worker...
start "Backend Worker" cmd /k "npm run start:worker"

ECHO All servers are launching in separate windows.
exit 
@echo off
echo Clearing pending jobs...
curl -X POST http://localhost:3001/api/jobs/clear-pending
echo.
echo Done!
pause 
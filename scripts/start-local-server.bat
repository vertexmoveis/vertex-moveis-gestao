@echo off
setlocal

set "PROJECT_DIR=C:\Users\Marcenaria Vammery\Downloads\vertex-moveis-gestao-main"
set "LOG_DIR=%PROJECT_DIR%\logs"
set "OUT_LOG=%LOG_DIR%\server.log"
set "ERR_LOG=%LOG_DIR%\server-error.log"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo [%date% %time%] Starting Vertex Moveis local server.>> "%OUT_LOG%"

where node >nul 2>> "%ERR_LOG%"
if errorlevel 1 (
  echo [%date% %time%] ERROR: node was not found in PATH.>> "%ERR_LOG%"
  exit /b 1
)

where npm >nul 2>> "%ERR_LOG%"
if errorlevel 1 (
  echo [%date% %time%] ERROR: npm was not found in PATH.>> "%ERR_LOG%"
  exit /b 1
)

cd /d "%PROJECT_DIR%"
if errorlevel 1 (
  echo [%date% %time%] ERROR: failed to enter project directory: %PROJECT_DIR%>> "%ERR_LOG%"
  exit /b 1
)

echo [%date% %time%] Running npm run start.>> "%OUT_LOG%"
npm run start >> "%OUT_LOG%" 2>> "%ERR_LOG%"

set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo [%date% %time%] ERROR: server exited with code %EXIT_CODE%.>> "%ERR_LOG%"
) else (
  echo [%date% %time%] Server stopped normally.>> "%OUT_LOG%"
)

exit /b %EXIT_CODE%

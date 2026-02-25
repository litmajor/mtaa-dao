@echo off
REM Quick setup script for Swagger documentation (Windows)
REM Run this after installing packages

echo.
echo ============================================
echo MTAA DAO API - Swagger Documentation Setup
echo ============================================
echo.

REM Step 1: Check if packages are installed
echo Checking required packages...
echo.

setlocal enabledelayedexpansion
set packages_ok=true

npm list swagger-ui-express >nul 2>&1
if errorlevel 1 (
    echo X swagger-ui-express not found
    set packages_ok=false
) else (
    echo [OK] swagger-ui-express installed
)

npm list swagger-jsdoc >nul 2>&1
if errorlevel 1 (
    echo X swagger-jsdoc not found
    set packages_ok=false
) else (
    echo [OK] swagger-jsdoc installed
)

if "!packages_ok!"=="false" (
    echo.
    echo Installing missing packages...
    call npm install swagger-ui-express swagger-jsdoc @types/swagger-jsdoc
    echo.
)

REM Step 2: Check configuration files
echo.
echo Checking configuration files...

if exist "server\config\swagger.ts" (
    echo [OK] Swagger config found
) else (
    echo X Swagger config missing
)

if exist "server\middleware\swaggerMiddleware.ts" (
    echo [OK] Swagger middleware found
) else (
    echo X Swagger middleware missing
)

REM Step 3: Summary
echo.
echo ============================================
echo Setup Complete!
echo ============================================
echo.
echo Documentation will be available at:
echo   * http://localhost:3000/api-docs
echo.
echo OpenAPI spec at:
echo   * http://localhost:3000/api/openapi.json
echo.
echo Next steps:
echo   1. Run: npm run dev
echo   2. Open: http://localhost:3000/api-docs
echo   3. See examples in: SWAGGER_DOCUMENTATION_EXAMPLES.md
echo.
echo To add documentation to an endpoint:
echo   Add JSDoc comments with @swagger to your route file
echo.
pause

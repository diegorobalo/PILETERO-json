@echo off
chcp 65001 >nul
title PILETERO v1.0 - Servidor

:: Verificar que Node.js este instalado
node --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo  ERROR: Node.js no esta instalado.
    echo  Ejecuta primero el archivo INSTALAR.bat
    echo.
    pause
    exit /b 1
)

:: Verificar que las dependencias esten instaladas
:: (PILETERO usa npm workspaces: las dependencias se instalan en la carpeta raiz, no en backend\node_modules)
if not exist "%~dp0node_modules" (
    echo.
    echo  Dependencias no instaladas. Ejecutando instalacion...
    echo.
    cd /d "%~dp0"
    call npm install --omit=dev
)

cd /d "%~dp0backend"

:: Abrir el navegador despues de 3 segundos
start /b cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"

echo.
echo  =========================================
echo    PILETERO v1.0 - Servidor iniciando...
echo  =========================================
echo.
echo  Cuando veas la linea "PILETERO corriendo" de abajo,
echo  el programa ya esta listo para usar.
echo.
echo  IMPORTANTE: No cierres esta ventana mientras usas PILETERO
echo  =========================================
echo.

node server.js

echo.
echo  El servidor se detuvo.
pause

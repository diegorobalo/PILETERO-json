@echo off
chcp 65001 >nul
echo.
echo  =========================================
echo    PILETERO v1.0 - Instalacion inicial
echo  =========================================
echo.

:: Verificar que Node.js este instalado
node --version >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Node.js no esta instalado.
    echo.
    echo  Seguí estos pasos:
    echo  1. Abri el navegador y andá a: https://nodejs.org
    echo  2. Descargá el botón verde que dice "LTS"
    echo  3. Instalá con todo predeterminado (solo clic "Siguiente")
    echo  4. Cerrá esta ventana y hacé doble clic en INSTALAR.bat de nuevo
    echo.
    pause
    exit /b 1
)

echo  Node.js encontrado. Instalando dependencias de PILETERO...
echo  (Esto puede tardar unos minutos. Necesitas internet.)
echo.

cd /d "%~dp0backend"
call npm install --omit=dev

if errorlevel 1 (
    echo.
    echo  Hubo un error durante la instalacion.
    echo  Asegurate de tener conexion a internet e intentá de nuevo.
    echo.
    pause
    exit /b 1
)

echo.
echo  =========================================
echo    Instalacion completada con exito!
echo  =========================================
echo.
echo  Ahora hacé doble clic en "INICIAR PILETERO.bat"
echo  para arrancar el programa.
echo.
pause

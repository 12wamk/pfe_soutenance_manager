@echo off
chcp 65001 >nul
setlocal EnableExtensions
title PFE Soutenance Manager - Demarrage Docker
cd /d "%~dp0"

echo ============================================
echo  PFE Soutenance Manager - ENET'COM
echo ============================================
echo.

:: ---------- 1. Verifier que Docker est installe ----------
where docker >nul 2>nul
if errorlevel 1 (
    echo [!] Docker n'est pas installe sur ce poste.
    echo     Telecharge et installe Docker Desktop :
    echo     https://www.docker.com/products/docker-desktop/
    echo     Puis relance ce fichier.
    echo.
    pause
    exit /b 1
)

:: ---------- 2. Verifier que le moteur Docker tourne ----------
docker info >nul 2>nul
if errorlevel 1 (
    echo [!] Docker Desktop est installe mais ne tourne pas.
    echo     Lance Docker Desktop, attends qu'il soit pret, puis relance.
    echo.
    pause
    exit /b 1
)

:: ---------- 3. Creer .env s'il n'existe pas ----------
if not exist ".env" (
    echo [*] Creation du fichier .env a partir de .env.example
    copy /y ".env.example" ".env" >nul
)

:: ---------- 4. Lire le port web ----------
set "WEB_PORT=8080"
for /f "usebackq tokens=2 delims==" %%a in (`findstr /b "WEB_PORT=" ".env"`) do set "WEB_PORT=%%a"
if "%WEB_PORT%"=="" set "WEB_PORT=8080"

:: ---------- 5. Construction + demarrage ----------
echo [*] Construction des conteneurs (premiere fois : 5-10 min)...
docker compose up -d --build
if errorlevel 1 (
    echo [!] Erreur lors du demarrage. Verifie que Docker Desktop est lance.
    echo.
    pause
    exit /b 1
)

:: ---------- 6. Attendre que le site reponde ----------
echo [*] Attente du service web sur le port %WEB_PORT%...
set /a tries=0
:waitloop
set /a tries+=1
if %tries% gtr 60 (
    echo [!] Le site ne repond pas apres 2 minutes.
    echo     Regarde les logs :  docker compose logs backend
    echo.
    pause
    exit /b 1
)
curl -s -o nul -m 3 "http://localhost:%WEB_PORT%/" >nul 2>nul
if errorlevel 1 (
    timeout /t 2 /nobreak >nul
    goto waitloop
)

:: ---------- 7. Ouvrir le navigateur ----------
echo.
echo ============================================
echo  Application demarree :
echo.
echo     URL      : http://localhost:%WEB_PORT%/
echo.
echo     Admin    : admin@enetcom.tn  / password123
echo     Chef dept: chef@enetcom.tn   / password123
echo     Encadr.  : chokri.abdelmoula@enetcom.usf.tn / password123
echo.
echo  Pour arreter : double-clic sur "Arreter.bat"
echo ============================================
echo.
start "" "http://localhost:%WEB_PORT%/"
endlocal

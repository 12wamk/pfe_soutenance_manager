@echo off
chcp 65001 >nul
title PFE Soutenance Manager - Arret Docker
cd /d "%~dp0"

echo [*] Arret des conteneurs...
docker compose down

echo.
echo  Termine. Les donnees (base MySQL) sont conservees dans le volume Docker.
echo  Pour relancer : double-clic sur "Lancer.bat"
echo.
pause

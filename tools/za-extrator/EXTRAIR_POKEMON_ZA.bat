@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Extrator de Pokemon do Legends Z-A (modelo + esqueleto + animacoes + texturas)
echo Digite o numero da Pokedex Nacional. Ex.: 768 = Golisopod, 25 = Pikachu, 448 = Lucario
set /p NUM=Numero:
python -I pokemon_za.py %NUM%
echo.
start "" "%~dp0..\..\dumper test\blender"
pause

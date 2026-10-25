@echo off
cd /d "%~dp0"
echo ============================================================
echo  Servidor local do laboratorio (permite GRAVAR pelo Editor de Moves)
echo  Endereco: http://127.0.0.1:5173/   (so este computador)
echo  Deixe esta janela aberta. Para parar: Ctrl+C.
echo ============================================================
start "" cmd /c "timeout /t 3 >nul & start http://127.0.0.1:5173/"
node prototypes/combat-lab/dev-server.mjs
pause

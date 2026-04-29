@echo off
setlocal

:: Script para iniciar o sistema no Windows
:: Requisitos: Python 3, Node.js e MongoDB instalado e rodando.

echo ==========================================================
echo       🚀 INICIADOR POKER HOME - WINDOWS
echo ==========================================================
echo.

:: 1. Verificar Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Erro: Python nao encontrado.
    echo Por favor, instale o Python 3 e adicione ao PATH.
    pause
    exit /b
)

:: 2. Verificar Node
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Erro: Node.js nao encontrado.
    echo Por favor, instale o Node.js.
    pause
    exit /b
)

:: 3. Configurar Backend
echo [*] Configurando Backend...
cd backend
if not exist "venv" (
    echo [>] Criando ambiente virtual Python...
    python -m venv venv
)
call venv\Scripts\activate
echo [>] Instalando dependencias do Python...
pip install -r requirements.txt --quiet
pip install uvicorn --quiet

if not exist ".env" (
    echo [>] Criando arquivo .env do Backend...
    echo MONGO_URL=mongodb://localhost:27017 > .env
    echo DB_NAME=pokerhome >> .env
    echo JWT_SECRET=poker_secret_%RANDOM% >> .env
    echo FRONTEND_URL=http://localhost:8052 >> .env
    echo HOUSE_NAME=Casa Royale >> .env
)
cd ..

:: 4. Configurar Frontend
echo [*] Configurando Frontend...
cd frontend
if not exist "node_modules" (
    echo [>] Instalando dependencias do Node...
    npm install --quiet
    echo [>] Aplicando correcoes...
    npm install ajv@^8.0.0 ajv-keywords@^5.0.0 --save-dev --quiet
)

if not exist ".env" (
    echo [>] Criando arquivo .env do Frontend...
    echo REACT_APP_BACKEND_URL=http://localhost:8000 > .env
)
cd ..

:: 5. Iniciar Servicos
echo ----------------------------------------------------------
echo ✅ TUDO PRONTO!
echo.
echo [!] IMPORTANTE: Certifique-se que o MongoDB esta rodando!
echo.
echo 🚀 Iniciando servidores...
echo 📍 Frontend: http://localhost:8052
echo 📍 Backend API: http://localhost:8000
echo ----------------------------------------------------------
echo.

:: Iniciar Backend em uma nova janela
start "Poker Backend" cmd /k "cd backend && call venv\Scripts\activate && uvicorn server:app --host 0.0.0.0 --port 8000 --reload"

:: Iniciar Frontend
cd frontend
set PORT=8052
npm start

pause

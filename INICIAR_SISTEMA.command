#!/bin/bash

# Navega para a pasta onde o script está
cd "$(dirname "$0")"

clear
echo "=========================================================="
echo "      🚀 INSTALADOR COMPLETO - POKER HOME"
echo "=========================================================="
echo ""

# 1. Verificar/Instalar Homebrew
echo "🔍 Verificando Homebrew..."
if ! command -v brew &> /dev/null; then
    echo "   > Homebrew não encontrado. Instalando..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
else
    echo "   > Homebrew OK!"
fi

# 2. Verificar/Instalar MongoDB
echo "🍃 Verificando MongoDB..."
if ! brew list mongodb-community &> /dev/null; then
    echo "   > MongoDB não encontrado. Instalando via Brew..."
    brew tap mongodb/brew
    brew install mongodb-community@7.0
    echo "   > Iniciando serviço do MongoDB..."
    brew services start mongodb-community@7.0
else
    echo "   > MongoDB já está instalado."
    brew services start mongodb-community@7.0 > /dev/null 2>&1
fi

# 3. Verificar Node e Python
echo "🔍 Verificando linguagens..."
if ! command -v node &> /dev/null; then
    echo "   > Instalando Node.js via Brew..."
    brew install node
fi
if ! command -v python3 &> /dev/null; then
    echo "   > Instalando Python 3 via Brew..."
    brew install python
fi

# 4. Configurar Backend
echo "📦 Configurando Backend..."
cd backend
if [ ! -d "venv" ]; then
    echo "   > Criando ambiente virtual Python..."
    python3 -m venv venv
fi
source venv/bin/activate
echo "   > Instalando dependências do Python..."
pip install -r requirements.txt --quiet
pip install uvicorn --quiet

if [ ! -f ".env" ]; then
    echo "   > Criando arquivo .env do Backend..."
    echo "MONGO_URL=mongodb://localhost:27017" > .env
    echo "DB_NAME=pokerhome" >> .env
    echo "JWT_SECRET=poker_secret_$(date +%s)" >> .env
    echo "FRONTEND_URL=http://localhost:8052" >> .env
fi
cd ..

# 5. Configurar Frontend (com correção de AJV)
echo "📦 Configurando Frontend..."
cd frontend
if [ ! -d "node_modules" ] || [ "$1" == "--fix" ]; then
    echo "   > Instalando/Corrigindo dependências do Node..."
    # Limpa instalações problemáticas se necessário
    if [ "$1" == "--fix" ]; then rm -rf node_modules package-lock.json; fi
    
    npm install --quiet
    
    # CORREÇÃO ESPECÍFICA PARA O ERRO 'ajv/dist/compile/codegen'
    echo "   > Aplicando correção de módulos (AJV)..."
    npm install ajv@^8.0.0 ajv-keywords@^5.0.0 --save-dev --quiet
fi

if [ ! -f ".env" ]; then
    echo "   > Criando arquivo .env do Frontend..."
    echo "REACT_APP_BACKEND_URL=http://localhost:8000" > .env
fi
cd ..

# 6. Iniciar os Serviços
echo "----------------------------------------------------------"
echo "✅ TUDO PRONTO! SISTEMA CONFIGURADO."
echo "🚀 Iniciando servidores..."
echo "📍 Frontend: http://localhost:8052"
echo "📍 Backend API: http://localhost:8000"
echo "----------------------------------------------------------"
echo "Pressione CTRL+C para encerrar o sistema."
echo ""

cleanup() {
    echo ""
    echo "Encerrando servidores..."
    kill $BACKEND_PID
    exit
}
trap cleanup SIGINT

# Iniciar Backend
cd backend
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8000 --reload > /dev/null 2>&1 &
BACKEND_PID=$!
cd ..

# Iniciar Frontend
cd frontend
PORT=8052 npm start

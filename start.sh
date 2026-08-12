#!/usr/bin/env bash
# Inicia o BN Suplementos (front-end + rotas de API) em modo desenvolvimento.
#
# Este projeto é um app Next.js único: o "front" (páginas React) e o "back"
# (rotas em app/api/*) rodam no mesmo processo. O banco/autenticação/storage
# ficam no Supabase (serviço externo), então não há um servidor de backend
# separado para iniciar aqui.

set -e

cd "$(dirname "$0")"

if [ ! -f ".env.local" ]; then
  echo "Arquivo .env.local não encontrado. Copiando .env.example..."
  cp .env.example .env.local
  echo "Edite .env.local com as chaves do seu projeto Supabase antes de continuar."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Instalando dependências (node_modules ausente)..."
  npm install
fi

echo "Iniciando BN Suplementos em http://localhost:3000 ..."
npm run dev

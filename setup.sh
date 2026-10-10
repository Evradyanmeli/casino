#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "Configure .env from .env.example before running setup.sh (see README.md)."
  exit 1
fi

docker compose config --quiet
docker compose up --build -d
echo "Containers started. Check docker compose logs backend and /api/health."

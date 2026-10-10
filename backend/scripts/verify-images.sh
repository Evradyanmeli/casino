#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
OUT="$ROOT/reports/build-check"
mkdir -p "$OUT"
printf '{"state":"running"}\n' > "$OUT/status.json"
if docker compose --project-directory "$ROOT" -f "$ROOT/docker-compose.yml" build --pull backend frontend > "$OUT/build.log" 2>&1; then
  printf '{"state":"completed","exitCode":0}\n' > "$OUT/status.json"
else
  code=$?
  printf '{"state":"failed","exitCode":%s}\n' "$code" > "$OUT/status.json"
  exit "$code"
fi

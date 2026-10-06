#!/bin/bash
# Локальный запуск Vexel на Mac: сайт http://localhost:3002, админка http://localhost:3002/admin (admin / admin)
# Нужны Node.js 20+ и Postgres.app (postgresapp.com → Initialize). Запуск: bash start-local.sh
set -e
cd "$(dirname "$0")"

PGBIN=/Applications/Postgres.app/Contents/Versions/latest/bin
[ -d "$PGBIN" ] && export PATH="$PGBIN:$PATH"
if ! command -v psql >/dev/null; then echo "✗ Не найден PostgreSQL. Поставьте Postgres.app и нажмите Initialize."; exit 1; fi
if ! pg_isready -q -h localhost; then echo "✗ PostgreSQL не запущен. Откройте Postgres.app и нажмите Start."; exit 1; fi

export NUXT_DATABASE_URL="${NUXT_DATABASE_URL:-postgres://localhost/vexel}"
export DATABASE_URL="$NUXT_DATABASE_URL"
export NUXT_SECRET="${NUXT_SECRET:-local-dev-secret-change-me}"
export NUXT_DEV_CODES=true
export PORT="${PORT:-3002}"
export NUXT_PUBLIC_SITE_URL="http://localhost:$PORT"

psql -h localhost -lqt | cut -d'|' -f1 | grep -qw vexel || { createdb -h localhost vexel && echo "✓ создана база vexel"; }
[ -d node_modules ] || npm ci
REV=$(git rev-parse HEAD 2>/dev/null || echo none)
if [ ! -f .output/server/index.mjs ] || [ "$(cat .output/.rev 2>/dev/null)" != "$REV" ]; then
  echo "… собираю проект (код обновился)"; npm run build && echo "$REV" > .output/.rev
fi
npm run migrate
echo "✓ Сайт: http://localhost:$PORT   Админка: http://localhost:$PORT/admin (admin / admin)"
exec node .output/server/index.mjs

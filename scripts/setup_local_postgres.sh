#!/usr/bin/env bash
# Switch logistics app from Docker PostgreSQL (5433) to LOCAL PostgreSQL (5432).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_URL="postgresql+psycopg://logistics:logistics@localhost:5432/logistics"
DUMP="$ROOT/scripts/local_postgres_migration.sql"

echo "==> 1) Local PostgreSQL admin must exist (run ONCE as postgres superuser):"
echo "     sudo -u postgres psql <<'SQL'"
echo "     CREATE ROLE logistics LOGIN PASSWORD 'logistics';"
echo "     CREATE DATABASE logistics OWNER logistics;"
echo "     SQL"
echo
echo "==> 2) App .env DATABASE_URL should be:"
echo "     $LOCAL_URL"
echo
echo "==> 3) Create schema on local DB and load data if you have a dump:"
if PGPASSWORD=logistics psql -h 127.0.0.1 -p 5432 -U logistics -d logistics -c "SELECT 1" >/dev/null 2>&1; then
  echo "    Local DB is reachable. Creating schema..."
  cd "$ROOT"
  .venv/bin/python - <<'PY'
from app.core.database import Base, engine
from app import models  # noqa: F401 — register all tables
Base.metadata.create_all(bind=engine)
print("    Tables created on local PostgreSQL.")
PY
  if [[ -f "$DUMP" ]]; then
    echo "    Loading dump: $DUMP"
    PGPASSWORD=logistics psql -h 127.0.0.1 -p 5432 -U logistics -d logistics -v ON_ERROR_STOP=1 -f "$DUMP"
  else
    echo "    No dump found — run seed: .venv/bin/python scripts/seed_admin.py"
  fi
  echo "==> Done. Restart uvicorn to pick up .env"
else
  echo "    Local DB not reachable yet — create logistics role/db first, then re-run."
  exit 1
fi

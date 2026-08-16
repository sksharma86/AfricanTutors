#!/usr/bin/env bash
# Applies the real African Tutors migrations (supabase/migrations/*.sql) to a
# throwaway local PostgreSQL database that has been bootstrapped to look
# enough like a Supabase project (auth.users, auth.uid(), anon/authenticated
# roles) to exercise our real Row Level Security policies end to end —
# without needing a live Supabase project or Docker.
#
# This is a local approximation for fast, offline regression testing. It is
# not a substitute for smoke-testing against a real connected Supabase
# project once one exists (see SETUP.md).
#
# Usage: ./supabase/tests/run-local-rls-tests.sh
# Requires: a local PostgreSQL server the current user can reach as the
# `postgres` superuser (e.g. via `sudo -u postgres psql`).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
DB_NAME="african_tutors_rls_test"

PSQL="sudo -u postgres psql -v ON_ERROR_STOP=1"

echo "==> Dropping and recreating throwaway database '$DB_NAME'"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $DB_NAME;"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE $DB_NAME;"

run_sql_file() {
  local file="$1"
  echo "==> Applying $file"
  $PSQL -d "$DB_NAME" -f "$file"
}

run_sql_file "$SCRIPT_DIR/00_bootstrap.sql"

for migration in "$MIGRATIONS_DIR"/*.sql; do
  run_sql_file "$migration"
done

run_sql_file "$SCRIPT_DIR/10_fixtures.sql"
run_sql_file "$SCRIPT_DIR/20_rls_assertions.sql"

echo "==> Cleaning up throwaway database '$DB_NAME'"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $DB_NAME;"

echo "==> Done. All migrations applied cleanly and all RLS assertions passed."

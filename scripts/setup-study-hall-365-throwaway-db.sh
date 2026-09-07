#!/usr/bin/env bash
# Create a local throwaway Postgres database and apply 0036 + 0037 + 0039.
# Never uses the shared demo / production Supabase project.
set -euo pipefail
DB_NAME="${STUDY_HALL_365_TEST_DB:-studyhall_365_throwaway}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

sudo -u postgres psql -v ON_ERROR_STOP=1 -c "SELECT 1" >/dev/null
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${DB_NAME};"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${DB_NAME};"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$ROOT/scripts/study-hall-365-throwaway-bootstrap.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$ROOT/supabase/migrations/0036_study_hall_365.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$ROOT/supabase/migrations/0037_study_hall_365_parent_privacy.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$ROOT/supabase/migrations/0039_study_hall_365_security_hardening.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -c "GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;"
echo "THROWAWAY_DB_READY ${DB_NAME}"

#!/usr/bin/env bash
# Local throwaway DB for PR3 booking-engine live writes. Not demo / production.
set -euo pipefail
DB_NAME="${STUDY_HALL_BOOKING_TEST_DB:-studyhall_booking_throwaway}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

sudo -u postgres psql -v ON_ERROR_STOP=1 -c "SELECT 1" >/dev/null
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${DB_NAME};"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${DB_NAME};"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$ROOT/scripts/study-hall-365-throwaway-bootstrap.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$ROOT/scripts/study-hall-booking-throwaway-extra.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$ROOT/supabase/migrations/0036_study_hall_365.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$ROOT/supabase/migrations/0037_study_hall_365_parent_privacy.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$ROOT/supabase/migrations/0038_one_hour_booking_engine.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$ROOT/supabase/migrations/0039_study_hall_365_security_hardening.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -c "GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;"
echo "THROWAWAY_BOOKING_DB_READY ${DB_NAME}"

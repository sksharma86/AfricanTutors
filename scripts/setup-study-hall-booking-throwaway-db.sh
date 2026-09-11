#!/usr/bin/env bash
# Local throwaway DB for PR3 booking-engine live writes. Not demo / production.
set -euo pipefail
DB_NAME="${STUDY_HALL_BOOKING_TEST_DB:-studyhall_booking_throwaway}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

apply_sql() {
  # stdin so the postgres OS user does not need to read the workspace (GitHub Actions).
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" < "$1"
}

sudo -u postgres psql -v ON_ERROR_STOP=1 -c "SELECT 1" >/dev/null
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${DB_NAME};"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${DB_NAME};"
apply_sql "$ROOT/scripts/study-hall-365-throwaway-bootstrap.sql"
apply_sql "$ROOT/scripts/study-hall-booking-throwaway-extra.sql"
apply_sql "$ROOT/supabase/migrations/0036_study_hall_365.sql"
apply_sql "$ROOT/supabase/migrations/0037_study_hall_365_parent_privacy.sql"
apply_sql "$ROOT/supabase/migrations/0038_one_hour_booking_engine.sql"
apply_sql "$ROOT/supabase/migrations/0039_study_hall_365_security_hardening.sql"
apply_sql "$ROOT/supabase/migrations/0040_same_day_365_funding_fallback.sql"
apply_sql "$ROOT/supabase/migrations/0041_booking_replacement_finalization.sql"
apply_sql "$ROOT/supabase/migrations/0042_same_day_365_replacement_transfer.sql"
apply_sql "$ROOT/supabase/migrations/0047_deactivate_legacy_prepaid_packages.sql"
apply_sql "$ROOT/supabase/migrations/0048_pkg_10sh_price_99.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -c "GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -c "
  create extension if not exists btree_gist;
  alter table public.bookings drop constraint if exists bookings_no_tutor_overlap;
  alter table public.bookings add constraint bookings_no_tutor_overlap
    exclude using gist (
      tutor_id with =,
      tstzrange(scheduled_start, scheduled_end) with &&
    ) where (tutor_id is not null and scheduled_start is not null
             and status in ('pending','confirmed','completed'));
  insert into public.profiles (id, role, display_name, timezone)
  select ('b8b8ffff-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, 'tutor', 'Throwaway Guide ' || g, 'Africa/Lagos'
  from generate_series(1, 16) as g
  on conflict (id) do update set role = 'tutor';
  insert into public.tutor_profiles (profile_id, status, timezone)
  select ('b8b8ffff-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, 'approved', 'Africa/Lagos'
  from generate_series(1, 16) as g
  on conflict (profile_id) do update set status = 'approved';
"
echo "THROWAWAY_BOOKING_DB_READY ${DB_NAME}"

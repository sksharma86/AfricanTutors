#!/usr/bin/env bash
# PR8B launch-critical booking/entitlement suite.
# Fails if Postgres is not available. Never skip-passes.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pg_ready() {
  pg_isready -q 2>/dev/null || sudo -u postgres pg_isready -q 2>/dev/null
}
if ! command -v pg_isready >/dev/null 2>&1 || ! pg_ready; then
  echo "PR8B launch-critical suite requires Postgres; pg_isready failed." >&2
  echo "Critical concurrency tests did not execute." >&2
  exit 1
fi

export STUDY_HALL_PR8B_REQUIRE_PG=1
export STUDY_HALL_BOOKING_TEST_DB="${STUDY_HALL_BOOKING_TEST_DB:-studyhall_pr8b_throwaway}"

echo "PR8B_PG_REQUIRED=1 DB=${STUDY_HALL_BOOKING_TEST_DB}"
exec node --test --test-concurrency=1 --test-reporter=spec \
  tests/studyhall-pr8b-hardening.test.mjs \
  tests/studyhall-pr8b-adversarial-pg-live.test.mjs

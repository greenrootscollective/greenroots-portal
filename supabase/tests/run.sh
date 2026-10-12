#!/usr/bin/env bash
# Runs the privacy & security tests against a throwaway local Postgres database.
# Needs a local PostgreSQL 14+ (psql). Usage:  supabase/tests/run.sh
# Connection: the usual PG* environment variables (PGHOST, PGUSER, ...).
set -euo pipefail
cd "$(dirname "$0")"
DB="grc_rls_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
export PGOPTIONS="-c client_min_messages=warning"
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase_shim.sql >/dev/null
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f ../schema.sql >/dev/null
psql -v ON_ERROR_STOP=1 -d "$DB" -f rls_test.sql

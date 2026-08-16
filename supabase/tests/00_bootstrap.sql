-- Bootstraps a plain PostgreSQL database to behave enough like a real
-- Supabase project that we can apply our actual migrations
-- (supabase/migrations/*.sql) unmodified and exercise real Row Level
-- Security policies through the same auth.uid()/role contract Supabase
-- uses. This is a local approximation for offline testing, not a
-- replacement for smoke-testing against a real Supabase project.

create extension if not exists pgcrypto;

-- Roles Supabase/PostgREST normally provide.
do $$ begin
  create role anon nologin;
exception when duplicate_object then null;
end $$;

do $$ begin
  create role authenticated nologin;
exception when duplicate_object then null;
end $$;

do $$ begin
  create role service_role nologin bypassrls;
exception when duplicate_object then null;
end $$;

-- Minimal stand-in for Supabase's auth schema: just enough of auth.users
-- and the auth.uid()/auth.role()/auth.jwt() contract for our RLS policies
-- (which only depend on auth.uid()) to behave identically to production.
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to service_role;

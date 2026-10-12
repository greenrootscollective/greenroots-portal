-- =====================================================================
--  Minimal stand-in for Supabase on a plain local Postgres, so the
--  security rules in ../schema.sql can be tested without a cloud project.
--  It recreates: the anon / authenticated roles, auth.users, auth.uid()
--  and Supabase's default table grants. Not used in production.
-- =====================================================================
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

create schema if not exists auth;
create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text not null,
  raw_user_meta_data jsonb not null default '{}'
);
-- Supabase reads the signed-in user from the request's JWT; here we read it from a setting.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
-- Supabase grants every table to anon/authenticated and relies on RLS.
alter default privileges in schema public grant all on tables    to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;

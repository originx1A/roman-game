-- Roman's Game rewrite.
-- Password checks are NOT in this file. Captcha stays on. After this file,
-- run supabase/migration-014-password-check.sql (rg_password_matches).
-- Do not turn captcha off.
--
-- The objects below are already on oelsglmfkpzbueqysvdm. Do not re-run this
-- file unless a listed object is missing. The statements are idempotent.
-- Project: romans-game (ref oelsglmfkpzbueqysvdm), the same database as romansgame.com.
-- Do not run this from CI. Do not apply it to any other project.
-- The preview does not use Netlify Blobs for accounts. After this file is applied,
-- accounts, sessions, teams, friends, and orders on the preview read and write this project.
--
-- Run it once, after review:
-- 1. Open the SQL editor for oelsglmfkpzbueqysvdm.
-- 2. Paste this whole file and run it.
-- 3. On the Netlify site, set these for Deploy Previews (the preview will not see
--    variables that are scoped to Production only):
--      SUPABASE_URL = https://oelsglmfkpzbueqysvdm.supabase.co
--      SUPABASE_SERVICE_ROLE_KEY = the service role key (server only, never in the client)
-- 4. Redeploy the preview. /api/health then reports "schema": true.
--
-- Existing migrations through 012 stay as they are. This file only adds what those
-- tables cannot store:
--   * auth email lookup for the service role (auth.users is not exposed to PostgREST)
--   * invite code, open join, mascot, and the current week's scores on game_groups
--   * buying_stopped on account_flags
--   * family-invite email and reminder fields on parent_links
--   * challenge links (no challenges table exists)
--   * cash orders before Stripe, including USD (purchases.currency is cad-only,
--     purchases.status has no review state, and purchases.session_id must already
--     be a Stripe cs_ id)
--   * short-lived rate-limit counters
-- Identity stays on auth.users. Profile stays on players. Progress stays on
-- game_saves slot "rewrite" so the live slot "main" is left alone.
-- A previous draft of this file created rg_accounts and other parallel tables.
-- That draft was not applied. This version does not create those tables.

create or replace function public.rg_auth_id_by_email(target text)
returns uuid
language sql
stable
security definer
set search_path = auth, public
as $$
  select id from auth.users where lower(email) = lower(target) limit 1;
$$;

revoke all on function public.rg_auth_id_by_email(text) from public;
revoke all on function public.rg_auth_id_by_email(text) from anon, authenticated;
grant execute on function public.rg_auth_id_by_email(text) to service_role;

alter table public.game_groups add column if not exists invite_code text;
alter table public.game_groups add column if not exists open_join boolean not null default false;
alter table public.game_groups add column if not exists mascot text;
alter table public.game_groups add column if not exists week_key text;
alter table public.game_groups add column if not exists week_scores jsonb not null default '{}'::jsonb;

create unique index if not exists game_groups_invite_code_key
  on public.game_groups (invite_code) where invite_code is not null;

alter table public.account_flags add column if not exists buying_stopped boolean not null default false;

alter table public.parent_links add column if not exists invite_email text;
alter table public.parent_links add column if not exists invite_token text;
alter table public.parent_links add column if not exists reminder_sent boolean not null default false;
alter table public.parent_links add column if not exists last_mail_at timestamptz;

create unique index if not exists parent_links_invite_token_key
  on public.parent_links (invite_token) where invite_token is not null;

create index if not exists account_recovery_code_hash_idx
  on public.account_recovery (code_hash);

create table if not exists public.rg_challenges (
  code text primary key,
  puzzle jsonb not null,
  sender_name text not null,
  sender_seconds integer not null default 0,
  sender_id uuid,
  results jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.rg_orders (
  id uuid primary key,
  player_id uuid not null references public.players (id) on delete cascade,
  sku text not null,
  cents integer not null check (cents >= 0),
  currency text not null check (currency in ('cad', 'usd')),
  price text not null,
  status text not null check (status in ('review', 'paid')),
  accepted_at timestamptz not null default now(),
  paid_at timestamptz,
  stripe_session text,
  wasnt_token text,
  wasnt_used boolean not null default false,
  terms_version text not null
);

create unique index if not exists rg_orders_stripe_session_key
  on public.rg_orders (stripe_session) where stripe_session is not null;
create unique index if not exists rg_orders_wasnt_token_key
  on public.rg_orders (wasnt_token) where wasnt_token is not null;

create table if not exists public.rg_rate (
  key text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.rg_challenges enable row level security;
alter table public.rg_orders enable row level security;
alter table public.rg_rate enable row level security;

revoke all on public.rg_challenges, public.rg_orders, public.rg_rate from anon, authenticated;

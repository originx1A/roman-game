-- Roman's Game · migration 008 · accounts, payments, gifts, saves (TEST MODE)
--
-- Write this file only. Do not run it against a live Supabase project from the app.
-- Tony or Cooper pastes it into the SQL editor after the checks in docs/ACCOUNTS-BACKEND.md.
-- Safe to run more than once on a database that already has this migration.
--
-- Prerequisites from PR #59 (must already be applied, in order):
--   supabase/migration-005-leaderboard.sql
--   supabase/migration-006-social.sql
--   supabase/migration-007-cad-shop.sql
-- This file does not replace public.public_scores, public.submit_score,
-- public.apply_stripe_credit, public.claim_unseen_card, or any 005–007 function.
--
-- public.players is not altered, updated, or deleted. No existing game table
-- is updated or deleted by this script. New tables and new functions only,
-- plus one new nullable column on site_progress if a draft of that table
-- already exists without profile_id.
--
-- public.save_progress: if any function with that name already exists, it is
-- left exactly as it is. This script does not CREATE OR REPLACE it.
-- If none exists, it creates save_progress(text, jsonb, jsonb, jsonb, jsonb)
-- which writes only public.player_saves and public.site_progress for auth.uid().
--
-- Gift codes have no end date. A printed code stays valid until it is used,
-- cancelled by the buyer, or voided because the payment was reversed.
--
-- The unapplied draft supabase/migration-005-coin-ledger.sql on branch
-- cursor/stage1-economy-gates-99cc defined player_saves(user_id). Do not apply
-- that draft. If that shape is already present, this script stops and changes nothing.
--
-- From 30 October 2026, a new table in public has no default privileges for
-- anon, authenticated, or service_role. Each new table below is granted
-- explicitly. service_role gets full table access (it bypasses RLS and is
-- what the Netlify functions use). authenticated gets select only on tables
-- that have a select policy. anon gets nothing. Existing tables are not
-- granted or revoked here. Primary keys are gen_random_uuid(), so these
-- tables own no sequences and this script grants none.

do $guard$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'player_saves' and column_name = 'user_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'player_saves' and column_name = 'player_id'
  ) then
    raise exception 'player_saves already exists with user_id. This migration will not alter or drop it.';
  end if;
end
$guard$;

-- 1. Payments state. One row per account. Off until enable-payments. ---------
create table if not exists public.account_payments (
  player_id uuid primary key references public.players(id) on delete cascade,
  payments_enabled boolean not null default false,
  parent_locked boolean not null default false,
  parent_locked_by uuid references public.players(id) on delete set null,
  parent_locked_at timestamptz,
  receipt_email text check (receipt_email is null or char_length(receipt_email) between 6 and 120),
  terms_accepted_at timestamptz,
  terms_version text,
  adult_confirmed_at timestamptz,
  enabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_locked = false or parent_locked_at is not null)
);
alter table public.account_payments enable row level security;
drop policy if exists "payments: read own" on public.account_payments;
create policy "payments: read own" on public.account_payments
  for select to authenticated using (player_id = auth.uid());
revoke all on public.account_payments from anon, authenticated;
grant select on public.account_payments to authenticated;
grant all on public.account_payments to service_role;

-- 2. Parent links. At most two pending or active parents per child. ----------
create table if not exists public.parent_links (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.players(id) on delete cascade,
  parent_id uuid references public.players(id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  invite_until timestamptz not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (parent_id is null or parent_id <> child_id)
);
create index if not exists parent_links_child_idx on public.parent_links (child_id, status);
alter table public.parent_links enable row level security;
drop policy if exists "parent_links: read own" on public.parent_links;
create policy "parent_links: read own" on public.parent_links
  for select to authenticated using (auth.uid() = child_id or auth.uid() = parent_id);
revoke all on public.parent_links from anon, authenticated;
grant select on public.parent_links to authenticated;
grant all on public.parent_links to service_role;

create or replace function public.parent_links_cap() returns trigger
language plpgsql
set search_path = public
as $$
declare
  n int;
begin
  select count(*) into n from public.parent_links
  where child_id = new.child_id and status in ('pending', 'active');
  if n >= 2 then
    raise exception 'parent_cap' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists parent_links_cap on public.parent_links;
create trigger parent_links_cap before insert on public.parent_links
  for each row execute function public.parent_links_cap();
revoke all on function public.parent_links_cap() from public, anon, authenticated;
grant execute on function public.parent_links_cap() to service_role;

-- 3. Per-purchase re-auth. Short lived on purpose. Not a gift code. ----------
create table if not exists public.purchase_reauths (
  token_hash text primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  method text not null check (method in ('pin', 'picture', 'password', 'passkey')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.purchase_reauths enable row level security;
revoke all on public.purchase_reauths from anon, authenticated;
grant all on public.purchase_reauths to service_role;

-- 4. Purchases ledger. Test charges included. Live rows are refused in code. -
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique check (session_id ~ '^cs_(test|live)_'),
  payment_intent_id text,
  player_id uuid not null references public.players(id) on delete cascade,
  item_type text not null check (item_type = 'pack'),
  item_id text not null check (char_length(item_id) between 1 and 40),
  purpose text not null check (purpose in ('self', 'gift')),
  status text not null check (status in ('paid', 'revoked', 'blocked')),
  coins integer not null default 0 check (coins between 0 and 250000),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null check (currency = 'cad'),
  livemode boolean not null default false,
  gift_code_id uuid,
  device_claimed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists purchases_player_idx on public.purchases (player_id, created_at desc);
create index if not exists purchases_intent_idx on public.purchases (payment_intent_id);
alter table public.purchases enable row level security;
drop policy if exists "purchases: read own" on public.purchases;
create policy "purchases: read own" on public.purchases
  for select to authenticated using (player_id = auth.uid());
revoke all on public.purchases from anon, authenticated;
grant select on public.purchases to authenticated;
grant all on public.purchases to service_role;

-- 5. Entitlements. Repeatable packs get one row per purchase. ----------------
create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  item_type text not null check (item_type = 'pack'),
  item_id text not null,
  purchase_id uuid references public.purchases(id) on delete set null,
  gift_code_id uuid,
  source text not null check (source in ('purchase', 'gift')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists entitlements_player_idx on public.entitlements (player_id, item_id);
alter table public.entitlements enable row level security;
drop policy if exists "entitlements: read own" on public.entitlements;
create policy "entitlements: read own" on public.entitlements
  for select to authenticated using (player_id = auth.uid());
revoke all on public.entitlements from anon, authenticated;
grant select on public.entitlements to authenticated;
grant all on public.entitlements to service_role;

-- 6. Gift codes. Single use. No end date. First redeemer keeps it. -----------
create table if not exists public.gift_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  code_hint text not null check (char_length(code_hint) = 4),
  reveal text,
  buyer_id uuid not null references public.players(id) on delete cascade,
  item_type text not null check (item_type = 'pack'),
  item_id text not null check (char_length(item_id) between 1 and 40),
  status text not null default 'open' check (status in ('open', 'redeemed', 'void', 'cancelled')),
  redeemed_by uuid references public.players(id) on delete set null,
  redeemed_at timestamptz,
  purchase_id uuid references public.purchases(id) on delete cascade,
  session_id text,
  created_at timestamptz not null default now(),
  check (status <> 'redeemed' or (redeemed_by is not null and redeemed_at is not null)),
  check (reveal is null or char_length(reveal) <= 32)
);
create unique index if not exists gift_codes_session_uniq
  on public.gift_codes (session_id) where session_id is not null;
create index if not exists gift_codes_buyer_idx on public.gift_codes (buyer_id, created_at desc);
alter table public.gift_codes enable row level security;
drop policy if exists "gift_codes: read party" on public.gift_codes;
create policy "gift_codes: read party" on public.gift_codes
  for select to authenticated using (auth.uid() = buyer_id or auth.uid() = redeemed_by);
revoke all on public.gift_codes from anon, authenticated;
grant select on public.gift_codes to authenticated;
grant all on public.gift_codes to service_role;

-- 7. Recovery save cards. Stored as hashes. One use. No end date. ------------
create table if not exists public.recovery_codes (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  code_hash text not null unique,
  created_at timestamptz not null default now(),
  used_at timestamptz
);
create index if not exists recovery_codes_player_idx on public.recovery_codes (player_id, created_at desc);
alter table public.recovery_codes enable row level security;
revoke all on public.recovery_codes from anon, authenticated;
grant all on public.recovery_codes to service_role;

-- 8. Per-profile saves. New table. Keyed on (player_id, profile_id). ---------
create table if not exists public.player_saves (
  player_id uuid not null references public.players(id) on delete cascade,
  profile_id text not null check (profile_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  blob jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (player_id, profile_id),
  check (octet_length(blob::text) <= 262144)
);
alter table public.player_saves enable row level security;
drop policy if exists "saves: read own" on public.player_saves;
create policy "saves: read own" on public.player_saves
  for select to authenticated using (player_id = auth.uid());
revoke all on public.player_saves from anon, authenticated;
grant select on public.player_saves to authenticated;
grant all on public.player_saves to service_role;

-- 9. Site progress (chapters, videos, card unlocks) per profile. -------------
create table if not exists public.site_progress (
  player_id uuid not null references public.players(id) on delete cascade,
  profile_id text not null default 'main' check (profile_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  chapters jsonb not null default '[]'::jsonb,
  videos jsonb not null default '[]'::jsonb,
  cards jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (player_id, profile_id)
);
alter table public.site_progress add column if not exists profile_id text;
alter table public.site_progress enable row level security;
drop policy if exists "site_progress: read own" on public.site_progress;
create policy "site_progress: read own" on public.site_progress
  for select to authenticated using (player_id = auth.uid());
revoke all on public.site_progress from anon, authenticated;
grant select on public.site_progress to authenticated;
grant all on public.site_progress to service_role;

-- 10. Coin reversals. Does not change the coin_ops check constraint. ---------
create table if not exists public.coin_reversals (
  op_id uuid primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  amount integer not null check (amount > 0 and amount <= 250000),
  removed integer not null check (removed >= 0),
  created_at timestamptz not null default now()
);
alter table public.coin_reversals enable row level security;
drop policy if exists "reversals: read own" on public.coin_reversals;
create policy "reversals: read own" on public.coin_reversals
  for select to authenticated using (player_id = auth.uid());
revoke all on public.coin_reversals from anon, authenticated;
grant select on public.coin_reversals to authenticated;
grant all on public.coin_reversals to service_role;

-- 11. Webhook idempotency. Service role only. --------------------------------
create table if not exists public.stripe_events (
  event_id text primary key,
  event_type text not null,
  created_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from anon, authenticated;
grant all on public.stripe_events to service_role;

-- 12. save_progress, only when the database does not already have one. -------
do $migrate$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'save_progress'
  ) then
    raise notice 'public.save_progress left unchanged';
  else
    execute $fn$
      create function public.save_progress(profile_id text, blob jsonb, chapters jsonb, videos jsonb, cards jsonb)
      returns jsonb
      language plpgsql
      security definer
      set search_path = public
      as $body$
      declare
        uid uuid := auth.uid();
      begin
        if uid is null then
          return jsonb_build_object('ok', false, 'error', 'signed_out');
        end if;
        if profile_id is null or profile_id !~ '^[A-Za-z0-9_-]{1,64}$' then
          return jsonb_build_object('ok', false, 'error', 'bad_profile');
        end if;
        if octet_length(coalesce(blob, '{}'::jsonb)::text) > 262144 then
          return jsonb_build_object('ok', false, 'error', 'too_big');
        end if;
        insert into public.player_saves (player_id, profile_id, blob, updated_at)
        values (uid, profile_id, coalesce(blob, '{}'::jsonb), now())
        on conflict (player_id, profile_id) do update
          set blob = excluded.blob, updated_at = now();
        insert into public.site_progress (player_id, profile_id, chapters, videos, cards, updated_at)
        values (
          uid,
          profile_id,
          coalesce(chapters, '[]'::jsonb),
          coalesce(videos, '[]'::jsonb),
          coalesce(cards, '[]'::jsonb),
          now()
        )
        on conflict (player_id, profile_id) do update
          set chapters = excluded.chapters,
              videos = excluded.videos,
              cards = excluded.cards,
              updated_at = now();
        return jsonb_build_object('ok', true);
      exception
        when foreign_key_violation then
          return jsonb_build_object('ok', false, 'error', 'no_player');
      end
      $body$
    $fn$;
    execute 'revoke all on function public.save_progress(text, jsonb, jsonb, jsonb, jsonb) from public, anon';
    execute 'grant execute on function public.save_progress(text, jsonb, jsonb, jsonb, jsonb) to authenticated';
    execute 'grant execute on function public.save_progress(text, jsonb, jsonb, jsonb, jsonb) to service_role';
  end if;
end
$migrate$;

-- 13. Subtract coins after a refund. Runs only when the webhook calls it. ----
create or replace function public.revoke_stripe_coins(player uuid, op text, amount integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  bal integer;
  removed integer;
  prior uuid;
  opu uuid;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    raise exception 'forbidden';
  end if;
  if amount is null or amount <= 0 or amount > 250000 then
    return jsonb_build_object('ok', false, 'error', 'bad_amount');
  end if;
  opu := md5(op)::uuid;
  select op_id into prior from public.coin_reversals where op_id = opu;
  if found then return jsonb_build_object('ok', true, 'duplicate', true); end if;
  bal := public._lock_balance(player);
  removed := least(bal, amount);
  update public.player_balances
    set balance = bal - removed, updated_at = now()
    where player_id = player;
  insert into public.coin_reversals (op_id, player_id, amount, removed)
  values (opu, player, amount, removed);
  return jsonb_build_object('ok', true, 'removed', removed, 'balance', bal - removed);
exception when unique_violation then
  return jsonb_build_object('ok', true, 'duplicate', true);
end $$;
revoke all on function public.revoke_stripe_coins(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.revoke_stripe_coins(uuid, text, integer) to service_role;

-- No sequence grants. account_payments uses the player id as its key. Every
-- other new id is uuid default gen_random_uuid(), which does not create a
-- sequence. Do not grant usage on sequences that belong to older tables.

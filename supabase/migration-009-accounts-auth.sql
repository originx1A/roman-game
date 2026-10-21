-- Roman's Game · migration 009 · name accounts (additive)
--
-- Write this file only. Do not run it against a live Supabase project from the app.
-- Tony or Cooper pastes it into the SQL editor after migration 008 is already applied.
-- Safe to run more than once. It creates new tables only.
--
-- It does not drop, rename, or retype any existing table. It does not add columns
-- to public.players or to any table created by migrations 001–008.
-- public.stripe_events and public.entitlements already exist (migration 008).
-- Their primary key and the starter entitlement index stay as 008 left them.
-- This file does not create those two tables and does not add indexes to them.
--
-- public.parent_links is not changed. It has no can_recover column. An active
-- link is the recovery grant (gifts and recovery only; it never approves a payment).
--
-- account_type is not a column. public.derived_account_type() returns 'adult'
-- only when payment_eligibility has the opt-in attestation, the terms version,
-- and a receipt email. Otherwise it returns 'player'. Signup does not write it.
-- Age is not collected. There is no age column and no signup-path column.
--
-- Display names: profiles.display_name keeps the chosen name. Public display
-- (the API field, and the players.display_name written at signup) is the first
-- word only, and a profane first word is not shown.
--
-- parent_restrictions is the host off-switch: gift receiving, each request
-- type, and play hours. There is no chat column. There is no chat in this system.
--
-- Cart tables are created empty of writers. This migration does not set a
-- currency and does not contain a price. Checkout is a later step.
--
-- audit_events and wallet_ledger are append-only. Update and delete raise.
--
-- From 30 October 2026 a new public table has no default privileges. Each new
-- table is granted here. service_role gets full access (the Netlify functions).
-- authenticated gets select only where a select policy exists. anon gets nothing.
-- New ids are gen_random_uuid(). This file grants nothing on sequences.
--
-- A later down script may remove only the tables and functions created below.

-- 1. Login name. Unique on the normalized name. Not public.players. ----------
create table if not exists public.profiles (
  player_id uuid primary key references public.players(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 24),
  name_normalized text not null check (name_normalized ~ '^[a-z][a-z0-9-]{2,19}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists profiles_name_normalized_uniq
  on public.profiles (name_normalized);
alter table public.profiles enable row level security;
drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated using (player_id = auth.uid());
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;

-- 2. Recovery email. Never the synthetic auth email. Codes stored as hashes. -
create table if not exists public.account_recovery (
  player_id uuid primary key references public.players(id) on delete cascade,
  recovery_email text check (recovery_email is null or char_length(recovery_email) between 6 and 120),
  email_verified_at timestamptz,
  pending_email text check (pending_email is null or char_length(pending_email) between 6 and 120),
  code_hash text,
  code_purpose text check (code_purpose is null or code_purpose in ('verify', 'reset')),
  code_expires_at timestamptz,
  code_attempts integer not null default 0 check (code_attempts >= 0 and code_attempts <= 20),
  code_burned_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.account_recovery enable row level security;
revoke all on public.account_recovery from anon, authenticated;
grant all on public.account_recovery to service_role;

-- 3. Recovery cards. The raw token is shown once. Only the SHA-256 is kept. --
create table if not exists public.recovery_cards (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  code_hash text not null unique,
  created_at timestamptz not null default now(),
  used_at timestamptz
);
create index if not exists recovery_cards_player_idx
  on public.recovery_cards (player_id, created_at desc);
alter table public.recovery_cards enable row level security;
revoke all on public.recovery_cards from anon, authenticated;
grant all on public.recovery_cards to service_role;

-- 4. Sliding-window counters and name locks. Subject is a name, a user id, ---
--    or a hash. Never a raw IP address.
create table if not exists public.auth_rate_limits (
  action text not null check (char_length(action) between 1 and 40),
  subject text not null check (char_length(subject) between 1 and 200),
  hits timestamptz[] not null default '{}',
  failures timestamptz[] not null default '{}',
  locked_until timestamptz,
  lock_step integer not null default 0 check (lock_step >= 0 and lock_step <= 20),
  primary key (action, subject)
);
alter table public.auth_rate_limits enable row level security;
revoke all on public.auth_rate_limits from anon, authenticated;
grant all on public.auth_rate_limits to service_role;

-- 5. Sessions. Supabase Free leaves time-box and inactivity at 0 (never).
--    This row is the clock: created_at is sign-in, last_seen_at is the last
--    refresh or /api/auth use. Stay signed in: 30 days idle, 90 days absolute.
--    Otherwise 12 hours absolute. The auth functions revoke via admin signOut.
create table if not exists public.auth_devices (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  session_id text not null check (char_length(session_id) between 8 and 128),
  ua_hash text not null check (char_length(ua_hash) between 16 and 128),
  stay_signed_in boolean not null default true,
  absolute_until timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (session_id)
);
alter table public.auth_devices enable row level security;
drop policy if exists "devices: read own" on public.auth_devices;
create policy "devices: read own" on public.auth_devices
  for select to authenticated using (player_id = auth.uid());
revoke all on public.auth_devices from anon, authenticated;
grant select on public.auth_devices to authenticated;
grant all on public.auth_devices to service_role;

-- 6. Payments opt-in. The only source of account_type = 'adult'. -------------
create table if not exists public.payment_eligibility (
  player_id uuid primary key references public.players(id) on delete cascade,
  adult_attested_at timestamptz,
  terms_accepted_at timestamptz,
  terms_version text check (terms_version is null or char_length(terms_version) between 1 and 40),
  receipt_email text check (receipt_email is null or char_length(receipt_email) between 6 and 120),
  receipt_email_verified_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.payment_eligibility enable row level security;
drop policy if exists "eligibility: read own" on public.payment_eligibility;
create policy "eligibility: read own" on public.payment_eligibility
  for select to authenticated using (player_id = auth.uid());
revoke all on public.payment_eligibility from anon, authenticated;
grant select on public.payment_eligibility to authenticated;
grant all on public.payment_eligibility to service_role;

create or replace function public.derived_account_type(player uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1
      from public.payment_eligibility
      where player_id = player
        and adult_attested_at is not null
        and terms_accepted_at is not null
        and terms_version is not null
        and receipt_email is not null
    ) then 'adult'
    else 'player'
  end
$$;
revoke all on function public.derived_account_type(uuid) from public, anon, authenticated;
grant execute on function public.derived_account_type(uuid) to service_role;

-- 7. Cart shell. No prices and no currency. No writer in this migration. -----
create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'completed', 'expired', 'cancelled')),
  holds_starter boolean not null default false,
  gift_mode text check (gift_mode is null or gift_mode in ('linked_child', 'code')),
  gift_child_id uuid references public.players(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists carts_starter_once
  on public.carts (player_id)
  where holds_starter and status in ('pending', 'completed');
create index if not exists carts_player_idx on public.carts (player_id, created_at desc);
alter table public.carts enable row level security;
drop policy if exists "carts: read own" on public.carts;
create policy "carts: read own" on public.carts
  for select to authenticated using (player_id = auth.uid());
revoke all on public.carts from anon, authenticated;
grant select on public.carts to authenticated;
grant all on public.carts to service_role;

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  sku text not null check (char_length(sku) between 1 and 40),
  qty integer not null check (qty between 1 and 5),
  unique (cart_id, sku)
);
alter table public.cart_items enable row level security;
drop policy if exists "cart_items: read own" on public.cart_items;
create policy "cart_items: read own" on public.cart_items
  for select to authenticated using (
    exists (
      select 1 from public.carts
      where carts.id = cart_id and carts.player_id = auth.uid()
    )
  );
revoke all on public.cart_items from anon, authenticated;
grant select on public.cart_items to authenticated;
grant all on public.cart_items to service_role;

-- 8. Append-only coin ledger. Balance is the sum of the rows. ----------------
create table if not exists public.wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  amount integer not null check (amount <> 0 and amount between -250000 and 250000),
  reason text not null check (char_length(reason) between 1 and 80),
  ref text check (ref is null or char_length(ref) <= 120),
  created_at timestamptz not null default now()
);
create index if not exists wallet_ledger_player_idx
  on public.wallet_ledger (player_id, created_at desc);
alter table public.wallet_ledger enable row level security;
drop policy if exists "wallet: read own" on public.wallet_ledger;
create policy "wallet: read own" on public.wallet_ledger
  for select to authenticated using (player_id = auth.uid());
revoke all on public.wallet_ledger from anon, authenticated;
grant select on public.wallet_ledger to authenticated;
grant all on public.wallet_ledger to service_role;

-- 9. Server game saves. Optimistic version. No client coin balance. ----------
create table if not exists public.game_saves (
  player_id uuid not null references public.players(id) on delete cascade,
  slot text not null default 'main' check (slot ~ '^[A-Za-z0-9_-]{1,64}$'),
  state jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version >= 1),
  updated_at timestamptz not null default now(),
  primary key (player_id, slot),
  check (octet_length(state::text) <= 262144)
);
alter table public.game_saves enable row level security;
drop policy if exists "game_saves: read own" on public.game_saves;
create policy "game_saves: read own" on public.game_saves
  for select to authenticated using (player_id = auth.uid());
revoke all on public.game_saves from anon, authenticated;
grant select on public.game_saves to authenticated;
grant all on public.game_saves to service_role;

-- 10. Watch, freeze, ban. Signup does not set these. -------------------------
create table if not exists public.account_status (
  player_id uuid primary key references public.players(id) on delete cascade,
  watched boolean not null default false,
  frozen boolean not null default false,
  banned boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.account_status enable row level security;
drop policy if exists "status: read own" on public.account_status;
create policy "status: read own" on public.account_status
  for select to authenticated using (player_id = auth.uid());
revoke all on public.account_status from anon, authenticated;
grant select on public.account_status to authenticated;
grant all on public.account_status to service_role;

create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  subject_id uuid references public.players(id) on delete set null,
  action text not null check (action in ('watch', 'freeze', 'ban', 'unfreeze', 'unban')),
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  created_at timestamptz not null default now()
);
alter table public.admin_actions enable row level security;
revoke all on public.admin_actions from anon, authenticated;
grant all on public.admin_actions to service_role;

-- 11. Append-only audit. No passwords, tokens, or raw IP addresses. ----------
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (
    event_type ~ '^(signup|signin_ok|signin_fail|lockout|password_change|recovery_[a-z0-9_]+|purchase_[a-z0-9_]+|webhook_[a-z0-9_]+|gift_create|gift_redeem|refund|dispute|admin_[a-z0-9_]+)$'
  ),
  actor uuid,
  subject uuid,
  ip_hash text check (ip_hash is null or char_length(ip_hash) between 16 and 128),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (octet_length(metadata::text) <= 4096)
);
create index if not exists audit_events_subject_idx
  on public.audit_events (subject, created_at desc);
create index if not exists audit_events_type_idx
  on public.audit_events (event_type, created_at desc);
alter table public.audit_events enable row level security;
revoke all on public.audit_events from anon, authenticated;
grant all on public.audit_events to service_role;

-- 12. Host off-switch. Gift receiving, request types, play hours. No chat. ---
create table if not exists public.parent_restrictions (
  player_id uuid primary key references public.players(id) on delete cascade,
  receive_gifts boolean not null default true,
  request_purchase boolean not null default true,
  request_challenge boolean not null default true,
  request_story boolean not null default true,
  play_hours jsonb,
  updated_by uuid references public.players(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (play_hours is null or jsonb_typeof(play_hours) = 'object')
);
alter table public.parent_restrictions enable row level security;
drop policy if exists "restrictions: read own" on public.parent_restrictions;
create policy "restrictions: read own" on public.parent_restrictions
  for select to authenticated using (player_id = auth.uid());
revoke all on public.parent_restrictions from anon, authenticated;
grant select on public.parent_restrictions to authenticated;
grant all on public.parent_restrictions to service_role;

-- 13. Refuse update and delete on the append-only tables. --------------------
create or replace function public.deny_row_change()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '55000';
end
$$;
revoke all on function public.deny_row_change() from public, anon, authenticated;
grant execute on function public.deny_row_change() to service_role;

drop trigger if exists wallet_ledger_append_only on public.wallet_ledger;
create trigger wallet_ledger_append_only
  before update or delete on public.wallet_ledger
  for each row execute function public.deny_row_change();

drop trigger if exists audit_events_append_only on public.audit_events;
create trigger audit_events_append_only
  before update or delete on public.audit_events
  for each row execute function public.deny_row_change();

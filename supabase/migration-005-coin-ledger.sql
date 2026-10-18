-- NOT APPLIED. Draft for owner review. Do not run against a live project.
-- Especially do not run this on oelsglmfkpzbueqysvdm or wnczzbjxohharwnjrdia
-- until the owner has reviewed it.
--
-- What it adds:
--   coin_ledger     one row per purchased-coin credit (and, later, spends)
--   player_saves    cross-device copy of earned progress (json)
--   scores.assisted true when a run used a hint, rescue, extra heart, or perk badge
--   purchase_pins   scrypt hash of the 4-digit purchase PIN (never the digits)
--
-- Clients can read their own coin and save rows. They cannot insert.
-- They cannot read purchase_pins at all. The server writes with the
-- service role, and only when ACCOUNT_LEDGER_ENABLED=1.
-- Until that flag is on, the PIN hash lives in the Netlify blob store only.

create table if not exists public.coin_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  delta integer not null,
  reason text not null,
  stripe_session_id text unique,
  amount_cents integer,
  currency text,
  created_at timestamptz not null default now()
);

alter table public.coin_ledger enable row level security;
drop policy if exists "read own coin ledger" on public.coin_ledger;
create policy "read own coin ledger" on public.coin_ledger
  for select using (auth.uid() = user_id);
revoke insert, update, delete on public.coin_ledger from anon, authenticated;

create table if not exists public.player_saves (
  user_id uuid primary key,
  blob jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.player_saves enable row level security;
drop policy if exists "read own player save" on public.player_saves;
create policy "read own player save" on public.player_saves
  for select using (auth.uid() = user_id);
revoke insert, update, delete on public.player_saves from anon, authenticated;

alter table public.scores add column if not exists assisted boolean;

-- Hash only. No client access. NOT APPLIED.
create table if not exists public.purchase_pins (
  user_id uuid primary key,
  pin_hash text not null,
  fails integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.purchase_pins enable row level security;
revoke all on public.purchase_pins from anon, authenticated;

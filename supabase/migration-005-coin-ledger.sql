-- NOT APPLIED. Draft for owner review. Do not run against a live project.
-- Especially do not run this on oelsglmfkpzbueqysvdm or wnczzbjxohharwnjrdia
-- until the owner has reviewed it.
--
-- What it adds:
--   coin_ledger     one row per purchased-coin credit (and, later, spends)
--   player_saves    cross-device copy of earned progress (json)
--   scores.assisted true when a run used a hint, rescue, extra heart, or perk badge
--
-- Clients can read their own rows. They cannot insert. The server writes with the
-- service role, and only when ACCOUNT_LEDGER_ENABLED=1.

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

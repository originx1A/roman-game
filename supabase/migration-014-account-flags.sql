-- Roman's Game · migration 014 · one-time account confirmations.
-- New objects only. Does not alter players, scores, groups, or group_points.
-- Migration 013 is the group-size cap. This file is the next new file.
-- Tony runs this in the SQL editor. The app does not run it.
-- Safe to run more than once.
--
-- The "I'm 13 or older" box and the Terms confirmation are asked once, when the
-- account is created, and stored here. A later sign-in on any device reads this
-- row and does not ask again. Display names only. No address column.

create table if not exists public.account_flags (
  user_id uuid primary key references public.players(id) on delete cascade,
  age_confirmed_at timestamptz not null,
  terms_confirmed_at timestamptz not null,
  news_opt_in boolean not null default false
);

alter table public.account_flags enable row level security;

revoke all on public.account_flags from public, anon, authenticated;

drop policy if exists "account_flags: select own" on public.account_flags;
create policy "account_flags: select own" on public.account_flags
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "account_flags: insert own" on public.account_flags;
create policy "account_flags: insert own" on public.account_flags
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and age_confirmed_at is not null
    and terms_confirmed_at is not null
  );

drop policy if exists "account_flags: update own" on public.account_flags;
create policy "account_flags: update own" on public.account_flags
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and age_confirmed_at is not null
    and terms_confirmed_at is not null
  );

grant select, insert, update on public.account_flags to authenticated;

comment on table public.account_flags is
  'One-time confirmations for the signed-in player. age_confirmed_at is set when they check I am 13 or older. No address is stored.';

-- Roman's Game · migration 010 · one-time account confirmations (additive)
--
-- Write this file only. Do not run it against a live Supabase project from the app.
-- Tony or Cooper pastes it into the SQL editor after migration 009 is already applied.
-- Safe to run more than once. It creates new objects only.
--
-- It does not drop, rename, or retype any existing table. It does not add columns
-- to public.players, to account_recovery, or to any table from migrations 001–009.
-- It does not write players.age_13_plus. The 13+ answer is age_confirmed_at here.
-- A set confirmation stays set. The trigger puts the old timestamp back on update.
--
-- From 30 October 2026 a new public table has no default privileges. This table
-- is granted here. service_role gets full access (the Netlify functions).
-- authenticated gets select only. anon gets nothing.

create table if not exists public.account_flags (
  user_id uuid primary key references auth.users(id) on delete cascade,
  age_confirmed_at timestamptz,
  terms_accepted_at timestamptz,
  terms_version text check (terms_version is null or char_length(terms_version) between 1 and 40),
  marketing_opt_in boolean not null default false,
  marketing_answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.account_flags enable row level security;
drop policy if exists "flags: read own" on public.account_flags;
create policy "flags: read own" on public.account_flags
  for select to authenticated using (user_id = auth.uid());
revoke all on public.account_flags from anon, authenticated;
grant select on public.account_flags to authenticated;
grant all on public.account_flags to service_role;

create or replace function public.account_flags_keep_confirmations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.age_confirmed_at is not null then
    new.age_confirmed_at := old.age_confirmed_at;
  end if;
  if old.terms_accepted_at is not null then
    new.terms_accepted_at := old.terms_accepted_at;
    new.terms_version := old.terms_version;
  end if;
  if old.marketing_answered_at is not null then
    new.marketing_answered_at := old.marketing_answered_at;
    new.marketing_opt_in := old.marketing_opt_in;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.account_flags_keep_confirmations() from public, anon, authenticated;
grant execute on function public.account_flags_keep_confirmations() to service_role;

drop trigger if exists account_flags_keep_confirmations on public.account_flags;
create trigger account_flags_keep_confirmations
  before update on public.account_flags
  for each row execute function public.account_flags_keep_confirmations();

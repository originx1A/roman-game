-- Migration 003 (2026-10-16, Tony/Cooper): age gate + Roman's World News opt-in on player accounts.
-- Idempotent: safe to run twice. Run after migration 002.

alter table public.players add column if not exists age_13_plus boolean not null default false;
alter table public.players add column if not exists marketing_opt_in boolean not null default false;
alter table public.players add column if not exists opt_in_at timestamptz;

-- opt_in_at is server-set: stamped when the player opts in, cleared when they opt out
create or replace function public.players_consent_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.marketing_opt_in and (tg_op = 'INSERT' or not coalesce(old.marketing_opt_in, false)) then
    new.opt_in_at := now();
  elsif not new.marketing_opt_in then
    new.opt_in_at := null;
  else
    new.opt_in_at := old.opt_in_at;
  end if;
  -- once confirmed 13+, it stays confirmed
  if tg_op = 'UPDATE' and old.age_13_plus then new.age_13_plus := true; end if;
  return new;
end $$;
drop trigger if exists players_consent_stamp on public.players;
create trigger players_consent_stamp before insert or update on public.players
  for each row execute function public.players_consent_stamp();

-- An account can only be created by someone who confirmed they are 13 or older
drop policy if exists "players: insert own" on public.players;
create policy "players: insert own" on public.players for insert to authenticated
  with check (id = auth.uid() and age_13_plus is true);

-- Players may change their name and their email preference (and confirm age); nothing else
revoke update on public.players from authenticated;
grant update (display_name, marketing_opt_in, age_13_plus) on public.players to authenticated;
grant select, insert on public.players to authenticated;

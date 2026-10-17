-- Migration 002 (2026-10-16, Tony): the player's whole chosen name is shown publicly, made unique
-- server-side: "Mike", then "Mike02", "Mike03", ... (lowest free number; the player never retries).
-- Idempotent: safe on the v1 schema, on a database that already has it, or run twice.

-- Views depend on players.first_name; drop and recreate them at the end
drop view if exists public.leaderboard;
drop view if exists public.public_scores;

alter table public.players drop column if exists first_name;
alter table public.players drop column if exists given_name;   -- never shipped, harmless
alter table public.players drop column if exists family_name;  -- never shipped, harmless
alter table public.players add column if not exists public_name text;

alter table public.players drop constraint if exists players_display_name_check;
alter table public.players drop constraint if exists players_display_name_len;
alter table public.players add constraint players_display_name_len check (char_length(btrim(display_name)) between 1 and 24);

create or replace function public.players_set_flag() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base text;
  candidate text;
  n int := 1;
begin
  new.display_name := left(btrim(regexp_replace(new.display_name, '\s+', ' ', 'g')), 24);
  new.is_flagged := public.is_profane(new.display_name);
  new.updated_at := now();
  if tg_op = 'UPDATE' then new.created_at := old.created_at; new.id := old.id; end if;

  base := new.display_name;
  -- name unchanged: keep the public name (and its number)
  if tg_op = 'UPDATE' and old.public_name is not null and lower(old.display_name) = lower(base) then
    new.public_name := old.public_name;
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext(lower(base)));  -- serialize same-name sign-ups
  candidate := base;
  while exists (select 1 from players p where lower(p.public_name) = lower(candidate) and p.id <> new.id) loop
    n := n + 1;
    candidate := base || lpad(n::text, 2, '0');           -- Mike02, Mike03 ... Mike10, Mike100
  end loop;
  new.public_name := candidate;
  return new;
end $$;
drop trigger if exists players_set_flag on public.players;
create trigger players_set_flag before insert or update on public.players
  for each row execute function public.players_set_flag();

-- Give existing rows a public name, then lock it in
update public.players set display_name = display_name where public_name is null;
alter table public.players alter column public_name set not null;
create unique index if not exists players_public_name_uniq on public.players (lower(public_name));

-- Players may only write display_name; flag + public_name are server-set
revoke update on public.players from authenticated;
grant update (display_name) on public.players to authenticated;
grant select, insert on public.players to authenticated;

-- Public views show the unique public name; flagged players stay hidden (scores still save)
create or replace view public.public_scores as
  select p.public_name as name, s.score, s.level, s.moves, s.time_seconds, s.mode, s.created_at
  from public.scores s join public.players p on p.id = s.player_id
  where not p.is_flagged;

create or replace view public.leaderboard as
  select name, level, best_score, best_time_seconds, games, last_played,
         rank() over (partition by level order by best_score desc, best_time_seconds asc) as rank
  from (
    select p.public_name as name, s.level, max(s.score) as best_score, min(s.time_seconds) as best_time_seconds,
           count(*) as games, max(s.created_at) as last_played
    from public.scores s join public.players p on p.id = s.player_id
    where not p.is_flagged
    group by p.id, p.public_name, s.level
  ) t;
revoke all on public.public_scores, public.leaderboard from public;
grant select on public.public_scores, public.leaderboard to anon, authenticated;

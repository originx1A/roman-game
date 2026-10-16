-- Roman's Game: player scores + leaderboard (Supabase project romans-game, ref oelsglmfkpzbueqysvdm)
-- Paste the whole file into Dashboard > SQL Editor > New query > Run. Safe to re-run.
-- Public names: only the FIRST WORD of display_name is ever exposed, and flagged (bad-word) players
-- are invisible in every public view. Their scores still save.

create extension if not exists unaccent;

-- 1. Banned words (private: RLS on, no policies, so the API can't read or change it)
create table if not exists public.banned_words (word text primary key);
alter table public.banned_words enable row level security;
revoke all on public.banned_words from anon, authenticated;

insert into public.banned_words (word) values
 ('fuck'),('fuk'),('fck'),('shit'),('sht'),('bitch'),('btch'),('cunt'),('dick'),('cock'),('pussy'),('asshole'),('ass'),
 ('bastard'),('slut'),('whore'),('fag'),('faggot'),('nigger'),('nigga'),('retard'),('rape'),('rapist'),('penis'),('vagina'),
 ('boob'),('tits'),('titty'),('porn'),('sex'),('nazi'),('hitler'),('kkk'),('wank'),('twat'),('prick'),('piss'),('damn'),
 ('crap'),('douche'),('jizz'),('cum'),('dildo'),('anal'),('anus'),('chink'),('spic'),('kike'),('dyke'),('tranny'),
 ('pedo'),('molest'),('killyourself'),('kys'),('suicide'),('bollocks'),('bugger'),('shag'),('wtf'),('stfu'),('milf'),('horny')
on conflict do nothing;

-- Short words that only count as a whole word (so "Cassidy", "Scunthorpe", "Dickson" etc. stay clean)
create table if not exists public.banned_words_exact (word text primary key);
alter table public.banned_words_exact enable row level security;
revoke all on public.banned_words_exact from anon, authenticated;
insert into public.banned_words_exact (word) values ('ass'),('cum'),('sex'),('anal'),('anus'),('dick'),('cock'),('damn'),('crap'),('piss'),('kys'),('wtf'),('fag'),('spic'),('tits')
on conflict do nothing;

-- 2. Profanity check: lower-case, strip accents, undo leetspeak (0->o 1->i 3->e 4->a 5->s 7->t @->a $->s),
--    then (a) any whole word in banned_words_exact, or (b) any banned_words entry NOT in the exact list
--    found anywhere in the letters-only string (catches "f.u.c.k", "xXfuckXx").
create or replace function public.is_profane(name text) returns boolean
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  norm text := translate(lower(unaccent(coalesce(name, ''))), '013457@$!|', 'oieastasii');
  squashed text := regexp_replace(norm, '[^a-z]', '', 'g');
  w text;
begin
  for w in select unnest(regexp_split_to_array(regexp_replace(norm, '[^a-z ]', ' ', 'g'), '\s+')) loop
    if exists (select 1 from banned_words_exact e where e.word = w) then return true; end if;
  end loop;
  return exists (
    select 1 from banned_words b
    where b.word not in (select word from banned_words_exact)
      and position(b.word in squashed) > 0
  );
end $$;
revoke all on function public.is_profane(text) from public;
grant execute on function public.is_profane(text) to anon, authenticated; -- lets the game double-check a name

-- 3. Players: one row per signed-in user (id = auth user id, so it survives cache clears)
create table if not exists public.players (
  id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  is_flagged boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The flag is always computed by the server; a player can never set or clear it.
create or replace function public.players_set_flag() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.is_flagged := public.is_profane(new.display_name);
  new.updated_at := now();
  if tg_op = 'UPDATE' then new.created_at := old.created_at; new.id := old.id; end if;
  return new;
end $$;
drop trigger if exists players_set_flag on public.players;
create trigger players_set_flag before insert or update on public.players
  for each row execute function public.players_set_flag();

alter table public.players enable row level security;
drop policy if exists "players: read own" on public.players;
drop policy if exists "players: insert own" on public.players;
drop policy if exists "players: update own" on public.players;
create policy "players: read own" on public.players for select to authenticated using (id = auth.uid());
create policy "players: insert own" on public.players for insert to authenticated with check (id = auth.uid());
create policy "players: update own" on public.players for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke all on public.players from anon;
grant select, insert on public.players to authenticated;

-- 4. Scores: insert-only, own rows only
create table if not exists public.scores (
  id bigint generated always as identity primary key,
  player_id uuid not null default auth.uid() references public.players(id) on delete cascade,
  score integer not null check (score between 0 and 1000000),
  level integer not null check (level between 1 and 100),          -- board size (5 = 5x5 ...)
  moves integer not null default 0 check (moves between 0 and 100000),
  time_seconds integer not null check (time_seconds between 0 and 86400),
  mode text not null default 'normal' check (mode in ('normal','trial','daily','endless','remix','other')),
  puzzle_id text check (char_length(puzzle_id) <= 80),
  created_at timestamptz not null default now()
);
create index if not exists scores_player_idx on public.scores (player_id, created_at desc);
create index if not exists scores_rank_idx on public.scores (level, score desc);

alter table public.scores enable row level security;
drop policy if exists "scores: read own" on public.scores;
drop policy if exists "scores: insert own" on public.scores;
create policy "scores: read own" on public.scores for select to authenticated using (player_id = auth.uid());
create policy "scores: insert own" on public.scores for insert to authenticated with check (player_id = auth.uid());
revoke all on public.scores from anon;
grant select, insert on public.scores to authenticated;


-- 5. Names + public views (migration 002)
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

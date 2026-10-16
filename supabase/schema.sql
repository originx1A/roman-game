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
  first_name text generated always as (left(split_part(btrim(regexp_replace(display_name, '\s+', ' ', 'g')), ' ', 1), 20)) stored,
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
grant update (display_name) on public.players to authenticated;

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

-- 5. Public read views (no ids, no emails, no full names, no flagged players).
--    Owned by postgres (security definer by default) so anon can read them while the tables stay locked.
create or replace view public.public_scores as
  select p.first_name as name, s.score, s.level, s.moves, s.time_seconds, s.mode, s.created_at
  from public.scores s join public.players p on p.id = s.player_id
  where not p.is_flagged;

create or replace view public.leaderboard as
  select name, level, best_score, best_time_seconds, games, last_played,
         rank() over (partition by level order by best_score desc, best_time_seconds asc) as rank
  from (
    select p.first_name as name, s.level, max(s.score) as best_score, min(s.time_seconds) as best_time_seconds,
           count(*) as games, max(s.created_at) as last_played
    from public.scores s join public.players p on p.id = s.player_id
    where not p.is_flagged
    group by p.id, p.first_name, s.level
  ) t;

revoke all on public.public_scores, public.leaderboard from public;
grant select on public.public_scores, public.leaderboard to anon, authenticated;

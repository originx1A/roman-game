-- Roman's Game · migration 004 · exclusive Unseen card (shadow reveal)
-- Safe to run more than once. Run after schema.sql (v1 + 002 + 003).
--
-- 50 pieces = 1 per hand-made board on its FIRST clear (20 boards) + 1 per daily puzzle won (1 per day, 30 needed).
-- Progress is worked out on the server from saved wins in public.scores, never trusted from the client.
-- Tables:    public.cards, public.card_unlocks
-- Functions: public.unseen_card_progress()  -> boards, days, pieces, needed, earned
--            public.claim_unseen_card()     -> same, and writes card_unlocks once pieces reach 50

-- 1. scores: daily date + server-stamped time --------------------------------
alter table public.scores add column if not exists daily_date date;

create or replace function public.scores_stamp() returns trigger
language plpgsql as $$
declare today date := (now() at time zone 'America/Toronto')::date;
begin
  new.created_at := now();                       -- client can't backdate wins
  if new.daily_date is not null then
    if new.mode is distinct from 'daily' then
      raise exception 'daily_date only allowed on daily scores';
    end if;
    if new.daily_date < today - 7 or new.daily_date > today + 1 then   -- 7 days: offline queue
      raise exception 'daily_date must be within the last week (Toronto time)';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists scores_stamp on public.scores;
create trigger scores_stamp before insert on public.scores
  for each row execute function public.scores_stamp();

create index if not exists scores_player_puzzle on public.scores (player_id, puzzle_id);
create index if not exists scores_player_daily on public.scores (player_id, daily_date) where daily_date is not null;

-- 2. cards ------------------------------------------------------------------
create table if not exists public.cards (
  id            text primary key,
  name          text not null,
  description   text,
  total_pieces  int  not null default 1,
  exclusive     boolean not null default false,
  how_to_earn   text,
  created_at    timestamptz not null default now()
);

insert into public.cards (id, name, description, total_pieces, exclusive, how_to_earn)
values ('unseen', 'The Unseen', 'Exclusive card. Only earned in the game.', 50, true,
        'Exclusive — earn it in the game.')
on conflict (id) do update set name = excluded.name, description = excluded.description,
  total_pieces = excluded.total_pieces, exclusive = excluded.exclusive, how_to_earn = excluded.how_to_earn;

alter table public.cards enable row level security;
drop policy if exists "cards: read all" on public.cards;
create policy "cards: read all" on public.cards for select to anon, authenticated using (true);
revoke all on public.cards from anon, authenticated;
grant select on public.cards to anon, authenticated;

-- 3. card_unlocks (written only by claim_unseen_card) -----------------------
create table if not exists public.card_unlocks (
  player_id    uuid not null references public.players(id) on delete cascade,
  card_id      text not null references public.cards(id) on delete cascade,
  unlocked_at  timestamptz not null default now(),
  primary key (player_id, card_id)
);

alter table public.card_unlocks enable row level security;
drop policy if exists "card_unlocks: read own" on public.card_unlocks;
create policy "card_unlocks: read own" on public.card_unlocks for select to authenticated using (player_id = auth.uid());
revoke all on public.card_unlocks from anon, authenticated;
grant select on public.card_unlocks to authenticated;

-- 4. progress + award -------------------------------------------------------
create or replace function public.unseen_card_progress()
returns table (boards int, days int, pieces int, needed int, earned boolean)
language sql stable security definer set search_path = public as $$
  with b as (
    select least(20, count(distinct s.puzzle_id))::int n from public.scores s
    where s.player_id = auth.uid()
      and s.puzzle_id = any (array['dawn','harbor','moss','quiet','cedar','drift','lantern','copper','valley','mirror',
                                   'summit','current','ember','hollow','signal','orbit','threshold','vault','nadir','prism'])
  ), d as (
    select least(30, count(distinct s.daily_date))::int n from public.scores s
    where s.player_id = auth.uid() and s.mode = 'daily' and s.daily_date is not null
  )
  select b.n, d.n, b.n + d.n, 50,
         (b.n + d.n >= 50) or exists (select 1 from public.card_unlocks u where u.player_id = auth.uid() and u.card_id = 'unseen')
  from b, d;
$$;

create or replace function public.claim_unseen_card()
returns table (boards int, days int, pieces int, needed int, earned boolean)
language plpgsql volatile security definer set search_path = public as $$
declare p record;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  select * into p from public.unseen_card_progress();
  if p.pieces >= 50 and exists (select 1 from public.players where id = auth.uid()) then
    insert into public.card_unlocks (player_id, card_id) values (auth.uid(), 'unseen')
    on conflict do nothing;
  end if;
  return query select * from public.unseen_card_progress();
end $$;

revoke all on function public.unseen_card_progress() from public, anon;
revoke all on function public.claim_unseen_card() from public, anon;
grant execute on function public.unseen_card_progress() to authenticated;
grant execute on function public.claim_unseen_card() to authenticated;

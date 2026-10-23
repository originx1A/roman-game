-- Roman's Game · migration 010 · one score per player on the phone leaderboard
-- Safe to run more than once, including after migrations 005 through 009.
-- Those already created public.leaderboard, a per-level view. This file does not replace it.
-- New objects only: player_board_row, player_board, and save_my_board_score.
-- Does not alter players, scores, profiles, parent_links, or any other existing table.
-- Tony runs this in the Supabase SQL editor. The app does not run it.

-- One row per player. The number is that player's own best.
-- A later lower game does not replace it. No address column exists.
create table if not exists public.player_board_row (
  player_id uuid primary key references public.players(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  score integer not null check (score between 0 and 1000000),
  updated_at timestamptz not null default now()
);

alter table public.player_board_row enable row level security;

drop policy if exists "board: anyone reads" on public.player_board_row;
create policy "board: anyone reads" on public.player_board_row
  for select to anon, authenticated
  using (true);

-- Guests and signed-in players may read the display name and the score.
-- They may not read the player id, and they cannot write this table.
-- Writes go through save_my_board_score, which only touches the signed-in player.
revoke all on public.player_board_row from anon, authenticated;
grant select (name, score) on public.player_board_row to anon, authenticated;

-- Public window. security_invoker so the read uses the policy above.
create or replace view public.player_board
with (security_barrier = true, security_invoker = true) as
select
  name,
  score,
  rank() over (order by score desc, name asc)::integer as place
from public.player_board_row;

revoke all on public.player_board from public, anon, authenticated;
grant select on public.player_board to anon, authenticated;

comment on view public.player_board is
  'One best score per player. Public columns are the display name, the score, and the place. Row-level security on player_board_row allows that read.';

-- Copy each player's own best from scores they already saved. Does not write back to scores.
insert into public.player_board_row (player_id, name, score)
select p.id, p.public_name, max(s.score)
from public.scores s
join public.players p on p.id = s.player_id
where not p.is_flagged
group by p.id, p.public_name
on conflict (player_id) do update
set score = greatest(public.player_board_row.score, excluded.score),
    name = excluded.name,
    updated_at = now();

create or replace function public.save_my_board_score(new_score integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  pname text;
  current integer;
  current_name text;
begin
  if uid is null then
    raise exception 'sign in';
  end if;
  if new_score is null or new_score < 0 or new_score > 1000000 then
    raise exception 'score out of range';
  end if;
  select public_name into pname
  from public.players
  where id = uid and not is_flagged;
  if pname is null then
    return;
  end if;
  select score, player_board_row.name into current, current_name
  from public.player_board_row
  where player_id = uid;
  if current is null then
    insert into public.player_board_row (player_id, name, score)
    values (uid, pname, new_score);
  elsif new_score > current then
    update public.player_board_row
    set score = new_score, name = pname, updated_at = now()
    where player_id = uid;
  elsif current_name is distinct from pname then
    update public.player_board_row
    set name = pname
    where player_id = uid;
  end if;
end $$;

revoke all on function public.save_my_board_score(integer) from public, anon;
grant execute on function public.save_my_board_score(integer) to authenticated;

notify pgrst, 'reload schema';

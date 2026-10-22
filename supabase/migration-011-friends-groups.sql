-- Roman's Game · migration 011 · friends and groups
-- Supabase project romans-game (ref oelsglmfkpzbueqysvdm).
-- NEW tables, views, and functions only. Does not alter players, scores, profiles,
-- parent_links, player_board_row, or any other existing table.
-- Tony runs this in the SQL editor after review. The app does not run it.
-- Safe to run more than once.
--
-- Two boards:
--   Individual: public.player_board_row stays the player's own best. It follows them
--   across group changes. This file does not write that table.
--   Group: each signed-in game also adds its score to the group they are in at that
--   moment (record_my_group_points). Those rows stay with the group. Leaving, removal,
--   and rejoining never delete them. A new group starts with none of that player's points.
--
-- Everyone keeps one ranking. everyone_board adds the current group name as a tag.
-- A group is on the week or month board only when 3 or more current members each have
-- 3 or more saved games in that period (America/Toronto). The average uses only members
-- who actually scored for the group in that period.
-- A member is inactive after 30 days without a saved game. The founder can remove only
-- those members. Removed players may request to join again.
-- Season total is the sum of group points in the Toronto calendar year.
-- group_roster_lock stores the Dec 1 roster (display names only) for the in-game Throne
-- card. There is no prize screen in the app yet.
-- Public reads return display names only.

-- 1. Tables ------------------------------------------------------------------

create table if not exists public.game_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 24),
  founder_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists game_groups_name_uniq on public.game_groups (lower(name));

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.game_groups(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  removed_at timestamptz,
  constraint group_members_left_after_join check (left_at is null or left_at >= joined_at)
);

create unique index if not exists group_members_one_current
  on public.group_members (player_id) where left_at is null;

create index if not exists group_members_current_group
  on public.group_members (group_id) where left_at is null;

create table if not exists public.group_join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.game_groups(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists group_join_one_pending
  on public.group_join_requests (player_id) where status = 'pending';

create index if not exists group_join_group_pending
  on public.group_join_requests (group_id) where status = 'pending';

create table if not exists public.friend_links (
  id uuid primary key default gen_random_uuid(),
  from_player uuid not null references public.players(id) on delete cascade,
  to_player uuid not null references public.players(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friend_links_two_people check (from_player <> to_player)
);

create unique index if not exists friend_links_one_live_pair
  on public.friend_links (least(from_player, to_player), greatest(from_player, to_player))
  where status in ('pending', 'accepted');

create index if not exists friend_links_from_idx on public.friend_links (from_player, status);
create index if not exists friend_links_to_idx on public.friend_links (to_player, status);

-- One row per game scored while the player was in the group. Never deleted on leave.
create table if not exists public.group_points (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.game_groups(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  points integer not null check (points between 0 and 1000000),
  played_at timestamptz not null default now()
);

create index if not exists group_points_group_time on public.group_points (group_id, played_at desc);
create index if not exists group_points_player_time on public.group_points (player_id, played_at desc);

-- Dec 1 roster snapshot. Display names only. No prize UI reads this yet.
create table if not exists public.group_roster_lock (
  group_id uuid not null references public.game_groups(id) on delete cascade,
  season_year integer not null check (season_year between 2024 and 2100),
  lock_on date not null,
  member_names text[] not null,
  locked_at timestamptz not null default now(),
  primary key (group_id, season_year)
);

alter table public.game_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_join_requests enable row level security;
alter table public.friend_links enable row level security;
alter table public.group_points enable row level security;
alter table public.group_roster_lock enable row level security;

revoke all on public.game_groups from public, anon, authenticated;
revoke all on public.group_members from public, anon, authenticated;
revoke all on public.group_join_requests from public, anon, authenticated;
revoke all on public.friend_links from public, anon, authenticated;
revoke all on public.group_points from public, anon, authenticated;
revoke all on public.group_roster_lock from public, anon, authenticated;

-- 2. Helpers (not granted to the API) ----------------------------------------

create or replace function public.rg_me()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sign in first';
  end if;
  if not exists (select 1 from public.players p where p.id = uid and not p.is_flagged) then
    raise exception 'Sign in first';
  end if;
  return uid;
end $$;

create or replace function public.rg_player_id(target text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.players p
  where lower(p.public_name) = lower(btrim(coalesce(target, '')))
    and not p.is_flagged
  limit 1
$$;

create or replace function public.rg_current_group(uid uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.group_id
  from public.group_members m
  where m.player_id = uid and m.left_at is null
  limit 1
$$;

create or replace function public.rg_label(raw text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  t text := left(btrim(regexp_replace(coalesce(raw, ''), '\s+', ' ', 'g')), 24);
begin
  if char_length(t) < 1 then
    raise exception 'Enter a name';
  end if;
  if public.is_profane(t) then
    raise exception 'Pick another name';
  end if;
  return t;
end $$;

-- Saved games in [start_on, end_on) by Toronto calendar date. Signed-in rows only.
create or replace function public.rg_games_between(uid uuid, start_on date, end_on date)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.scores s
  where s.player_id = uid
    and (s.created_at at time zone 'America/Toronto')::date >= start_on
    and (s.created_at at time zone 'America/Toronto')::date < end_on
$$;

-- Inactive once the last saved game (or the join, if they never played) is over 30 days ago.
create or replace function public.rg_member_inactive(uid uuid, joined_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select max(s.created_at) from public.scores s where s.player_id = uid),
    joined_at
  ) < now() - interval '30 days'
$$;

-- Week (Monday) or month board. Groups with fewer than 3 active members are left out.
-- Active = current member with 3 or more saved games in the period.
-- Average = mean of per-player point sums, and only players who scored for the group then.
create or replace function public.group_period_rows(which text)
returns table (
  group_name text,
  average integer,
  place integer,
  active_members integer,
  season_points integer
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select
      case
        when which = 'month' then date_trunc('month', now() at time zone 'America/Toronto')::date
        else date_trunc('week', now() at time zone 'America/Toronto')::date
      end as start_on,
      case
        when which = 'month' then (date_trunc('month', now() at time zone 'America/Toronto') + interval '1 month')::date
        else (date_trunc('week', now() at time zone 'America/Toronto') + interval '1 week')::date
      end as end_on
    where which in ('week', 'month')
  ),
  played as (
    select gp.group_id, gp.player_id, sum(gp.points)::integer as pts
    from public.group_points gp
    cross join bounds b
    where (gp.played_at at time zone 'America/Toronto')::date >= b.start_on
      and (gp.played_at at time zone 'America/Toronto')::date < b.end_on
    group by gp.group_id, gp.player_id
  ),
  averages as (
    select played.group_id, round(avg(played.pts))::integer as avg_points
    from played
    group by played.group_id
  ),
  active as (
    select m.group_id, count(*)::integer as active_count
    from public.group_members m
    cross join bounds b
    where m.left_at is null
      and public.rg_games_between(m.player_id, b.start_on, b.end_on) >= 3
    group by m.group_id
  )
  select
    g.name,
    a.avg_points,
    rank() over (order by a.avg_points desc, g.name asc)::integer,
    ac.active_count,
    coalesce((
      select sum(gp.points)::integer
      from public.group_points gp
      where gp.group_id = g.id
        and extract(year from (gp.played_at at time zone 'America/Toronto'))::integer
          = extract(year from (now() at time zone 'America/Toronto'))::integer
    ), 0)
  from averages a
  join public.game_groups g on g.id = a.group_id
  join active ac on ac.group_id = g.id and ac.active_count >= 3
$$;

-- 3. Public boards -----------------------------------------------------------
-- security_invoker off: the owner reads the rows and returns names only.
-- player_board_row hides player ids from the API, so an invoker view cannot join them.

create or replace view public.everyone_board
with (security_barrier = true, security_invoker = false) as
select
  r.name,
  r.score,
  rank() over (order by r.score desc, r.name asc)::integer as place,
  g.name as group_name
from public.player_board_row r
join public.players p on p.id = r.player_id and not p.is_flagged
left join public.group_members m on m.player_id = r.player_id and m.left_at is null
left join public.game_groups g on g.id = m.group_id;

create or replace view public.group_week_board
with (security_barrier = true, security_invoker = false) as
select group_name, average, place, active_members, season_points
from public.group_period_rows('week');

create or replace view public.group_month_board
with (security_barrier = true, security_invoker = false) as
select group_name, average, place, active_members, season_points
from public.group_period_rows('month');

revoke all on public.everyone_board from public, anon, authenticated;
revoke all on public.group_week_board from public, anon, authenticated;
revoke all on public.group_month_board from public, anon, authenticated;
grant select on public.everyone_board to anon, authenticated;
grant select on public.group_week_board to anon, authenticated;
grant select on public.group_month_board to anon, authenticated;

comment on view public.everyone_board is
  'Personal best per player, plus the current group name. Names and scores only.';

comment on view public.group_week_board is
  'Groups with 3 or more members who each saved 3 or more games this Toronto week. Score is the average of members who scored for the group this week.';

comment on view public.group_month_board is
  'Same rule as the week board, for the Toronto month.';

-- 4. Reads -------------------------------------------------------------------

create or replace function public.friends_board()
returns table (
  name text,
  score integer,
  place integer,
  group_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return;
  end if;
  return query
  with circle as (
    select uid as id
    union
    select case when f.from_player = uid then f.to_player else f.from_player end
    from public.friend_links f
    where f.status = 'accepted'
      and uid in (f.from_player, f.to_player)
  )
  select
    p.public_name,
    coalesce(r.score, 0)::integer,
    rank() over (order by coalesce(r.score, 0) desc, p.public_name asc)::integer,
    g.name
  from circle c
  join public.players p on p.id = c.id and not p.is_flagged
  left join public.player_board_row r on r.player_id = p.id
  left join public.group_members m on m.player_id = p.id and m.left_at is null
  left join public.game_groups g on g.id = m.group_id
  order by 3, 1;
end $$;

create or replace function public.my_card()
returns table (
  name text,
  score integer,
  place integer,
  group_name text,
  friends_count integer,
  pending_count integer,
  founder boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.rg_me();
begin
  return query
  select
    p.public_name,
    coalesce(r.score, 0)::integer,
    eb.place,
    g.name,
    (
      select count(*)::integer
      from public.friend_links f
      where f.status = 'accepted'
        and uid in (f.from_player, f.to_player)
    ),
    (
      select count(*)::integer
      from public.friend_links f
      where f.to_player = uid and f.status = 'pending'
    ) + (
      select count(*)::integer
      from public.group_join_requests j
      join public.game_groups fg on fg.id = j.group_id and fg.founder_id = uid
      join public.group_members fm on fm.group_id = fg.id and fm.player_id = uid and fm.left_at is null
      where j.status = 'pending'
    ),
    exists (
      select 1
      from public.group_members m
      join public.game_groups gg on gg.id = m.group_id
      where m.player_id = uid and m.left_at is null and gg.founder_id = uid
    )
  from public.players p
  left join public.player_board_row r on r.player_id = p.id
  left join public.everyone_board eb on eb.name = p.public_name
  left join public.group_members m on m.player_id = p.id and m.left_at is null
  left join public.game_groups g on g.id = m.group_id
  where p.id = uid;
end $$;

create or replace function public.player_card(target text)
returns table (
  name text,
  score integer,
  place integer,
  group_name text,
  friend_status text,
  join_status text,
  is_you boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  them uuid := public.rg_player_id(target);
  link text := 'none';
  joined text := 'no_group';
  their_group uuid;
begin
  if them is null then
    return;
  end if;
  if uid is not null then
    if exists (
      select 1 from public.friend_links f
      where f.status = 'accepted'
        and ((f.from_player = uid and f.to_player = them) or (f.from_player = them and f.to_player = uid))
    ) then
      link := 'friends';
    elsif exists (
      select 1 from public.friend_links f
      where f.status = 'pending' and f.from_player = uid and f.to_player = them
    ) then
      link := 'pending';
    elsif exists (
      select 1 from public.friend_links f
      where f.status = 'pending' and f.from_player = them and f.to_player = uid
    ) then
      link := 'incoming';
    end if;
  end if;

  select m.group_id into their_group
  from public.group_members m
  where m.player_id = them and m.left_at is null;

  if their_group is null then
    joined := 'no_group';
  elsif uid is not null and exists (
    select 1 from public.group_members m
    join public.game_groups g on g.id = m.group_id
    where m.group_id = their_group and m.player_id = uid and m.left_at is null and g.founder_id = uid
  ) then
    joined := 'founder';
  elsif uid is not null and exists (
    select 1 from public.group_members m
    where m.group_id = their_group and m.player_id = uid and m.left_at is null
  ) then
    joined := 'member';
  elsif uid is not null and exists (
    select 1 from public.group_join_requests j
    where j.group_id = their_group and j.player_id = uid and j.status = 'pending'
  ) then
    joined := 'pending';
  else
    joined := 'none';
  end if;

  return query
  select
    p.public_name,
    coalesce(r.score, 0)::integer,
    eb.place,
    g.name,
    link,
    joined,
    uid is not null and uid = p.id
  from public.players p
  left join public.player_board_row r on r.player_id = p.id
  left join public.everyone_board eb on eb.name = p.public_name
  left join public.group_members m on m.player_id = p.id and m.left_at is null
  left join public.game_groups g on g.id = m.group_id
  where p.id = them;
end $$;

create or replace function public.group_card(target text)
returns table (
  group_name text,
  week_average integer,
  month_average integer,
  season_points integer,
  active_week integer,
  active_month integer,
  join_status text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  gid uuid;
  uid uuid := auth.uid();
  link text := 'none';
  week_start date := date_trunc('week', now() at time zone 'America/Toronto')::date;
  month_start date := date_trunc('month', now() at time zone 'America/Toronto')::date;
begin
  select g.id into gid
  from public.game_groups g
  where lower(g.name) = lower(btrim(coalesce(target, '')));
  if gid is null then
    return;
  end if;

  if uid is not null and exists (
    select 1
    from public.group_members m
    join public.game_groups g on g.id = m.group_id
    where m.group_id = gid and m.player_id = uid and m.left_at is null and g.founder_id = uid
  ) then
    link := 'founder';
  elsif uid is not null and exists (
    select 1 from public.group_members m
    where m.group_id = gid and m.player_id = uid and m.left_at is null
  ) then
    link := 'member';
  elsif uid is not null and exists (
    select 1 from public.group_join_requests j
    where j.group_id = gid and j.player_id = uid and j.status = 'pending'
  ) then
    link := 'pending';
  end if;

  return query
  select
    g.name,
    (select board.average from public.group_period_rows('week') board where board.group_name = g.name),
    (select board.average from public.group_period_rows('month') board where board.group_name = g.name),
    coalesce((
      select sum(gp.points)::integer
      from public.group_points gp
      where gp.group_id = g.id
        and extract(year from (gp.played_at at time zone 'America/Toronto'))::integer
          = extract(year from (now() at time zone 'America/Toronto'))::integer
    ), 0),
    (
      select count(*)::integer
      from public.group_members m
      where m.group_id = g.id
        and m.left_at is null
        and public.rg_games_between(m.player_id, week_start, (week_start + 7)) >= 3
    ),
    (
      select count(*)::integer
      from public.group_members m
      where m.group_id = g.id
        and m.left_at is null
        and public.rg_games_between(m.player_id, month_start, (month_start + interval '1 month')::date) >= 3
    ),
    link
  from public.game_groups g
  where g.id = gid;
end $$;

-- Names, active or inactive, and whether the founder may remove them.
-- Empty unless the caller is a current member. No roster for outsiders.
create or replace function public.group_member_rows(target text)
returns table (
  name text,
  member_status text,
  can_remove boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  gid uuid;
begin
  if uid is null then
    return;
  end if;
  select g.id into gid
  from public.game_groups g
  where lower(g.name) = lower(btrim(coalesce(target, '')));
  if gid is null then
    return;
  end if;
  if not exists (
    select 1 from public.group_members m
    where m.group_id = gid and m.player_id = uid and m.left_at is null
  ) then
    return;
  end if;
  return query
  select
    p.public_name,
    case when public.rg_member_inactive(p.id, m.joined_at) then 'inactive' else 'active' end,
    exists (
      select 1 from public.game_groups g
      where g.id = gid and g.founder_id = uid
    )
      and p.id <> uid
      and public.rg_member_inactive(p.id, m.joined_at)
  from public.group_members m
  join public.players p on p.id = m.player_id and not p.is_flagged
  where m.group_id = gid and m.left_at is null
  order by p.public_name;
end $$;

create or replace function public.request_inbox()
returns table (
  kind text,
  name text,
  group_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.rg_me();
begin
  return query
  select q.kind, q.player_name, q.gname
  from (
    select
      'friend'::text as kind,
      p.public_name as player_name,
      null::text as gname,
      f.created_at as asked_at
    from public.friend_links f
    join public.players p on p.id = f.from_player and not p.is_flagged
    where f.to_player = uid and f.status = 'pending'
    union all
    select
      'join'::text,
      p.public_name,
      g.name,
      j.created_at
    from public.group_join_requests j
    join public.game_groups g on g.id = j.group_id and g.founder_id = uid
    join public.group_members m on m.group_id = g.id and m.player_id = uid and m.left_at is null
    join public.players p on p.id = j.player_id and not p.is_flagged
    where j.status = 'pending'
  ) q
  order by q.asked_at desc, q.player_name;
end $$;

-- 5. Writes ------------------------------------------------------------------
-- Points stay in group_points. None of these functions delete those rows.

create or replace function public.record_my_group_points(new_score integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  gid uuid;
begin
  if uid is null or new_score is null or new_score < 0 or new_score > 1000000 then
    return;
  end if;
  if not exists (select 1 from public.players p where p.id = uid and not p.is_flagged) then
    return;
  end if;
  gid := public.rg_current_group(uid);
  if gid is null then
    return;
  end if;
  insert into public.group_points (group_id, player_id, points)
  values (gid, uid, new_score);
end $$;

create or replace function public.create_group(group_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.rg_me();
  label text := public.rg_label(group_name);
  gid uuid;
begin
  if public.rg_current_group(uid) is not null then
    raise exception 'Leave your group first';
  end if;
  if exists (select 1 from public.group_join_requests j where j.player_id = uid and j.status = 'pending') then
    raise exception 'Cancel your request first';
  end if;
  perform pg_advisory_xact_lock(hashtext('group:' || lower(label)));
  insert into public.game_groups (name, founder_id)
  values (label, uid)
  returning id into gid;
  insert into public.group_members (group_id, player_id)
  values (gid, uid);
exception
  when unique_violation then
    raise exception 'That name is taken';
end $$;

create or replace function public.request_join(group_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.rg_me();
  gid uuid;
begin
  if public.rg_current_group(uid) is not null then
    raise exception 'Leave your group first';
  end if;
  select g.id into gid
  from public.game_groups g
  where lower(g.name) = lower(btrim(coalesce(group_name, '')));
  if gid is null then
    raise exception 'No group by that name';
  end if;
  if exists (select 1 from public.group_join_requests j where j.player_id = uid and j.status = 'pending') then
    raise exception 'Cancel your request first';
  end if;
  insert into public.group_join_requests (group_id, player_id)
  values (gid, uid);
exception
  when unique_violation then
    raise exception 'Cancel your request first';
end $$;

create or replace function public.cancel_join(group_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.rg_me();
  n integer;
begin
  update public.group_join_requests j
  set status = 'cancelled', updated_at = now()
  from public.game_groups g
  where j.group_id = g.id
    and j.player_id = uid
    and j.status = 'pending'
    and lower(g.name) = lower(btrim(coalesce(group_name, '')));
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'No request to cancel';
  end if;
end $$;

create or replace function public.accept_join(player_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.rg_me();
  them uuid := public.rg_player_id(player_name);
  gid uuid;
  n integer;
begin
  if them is null then
    raise exception 'No player by that name';
  end if;
  select g.id into gid
  from public.game_groups g
  join public.group_members m on m.group_id = g.id and m.player_id = uid and m.left_at is null
  where g.founder_id = uid;
  if gid is null then
    raise exception 'Only the founder can do that';
  end if;
  if public.rg_current_group(them) is not null then
    raise exception 'They are already in a group';
  end if;
  update public.group_join_requests j
  set status = 'accepted', updated_at = now()
  where j.group_id = gid and j.player_id = them and j.status = 'pending';
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'No request to accept';
  end if;
  insert into public.group_members (group_id, player_id)
  values (gid, them);
end $$;

create or replace function public.decline_join(player_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.rg_me();
  them uuid := public.rg_player_id(player_name);
  gid uuid;
  n integer;
begin
  if them is null then
    raise exception 'No player by that name';
  end if;
  select g.id into gid
  from public.game_groups g
  join public.group_members m on m.group_id = g.id and m.player_id = uid and m.left_at is null
  where g.founder_id = uid;
  if gid is null then
    raise exception 'Only the founder can do that';
  end if;
  update public.group_join_requests j
  set status = 'declined', updated_at = now()
  where j.group_id = gid and j.player_id = them and j.status = 'pending';
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'No request to decline';
  end if;
end $$;

create or replace function public.leave_group()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.rg_me();
  n integer;
begin
  update public.group_members
  set left_at = now()
  where player_id = uid and left_at is null;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'You are not in a group';
  end if;
end $$;

create or replace function public.remove_inactive_member(player_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.rg_me();
  them uuid := public.rg_player_id(player_name);
  gid uuid;
  joined timestamptz;
  n integer;
begin
  if them is null then
    raise exception 'No player by that name';
  end if;
  if them = uid then
    raise exception 'Leave the group instead';
  end if;
  select g.id, m.joined_at into gid, joined
  from public.game_groups g
  join public.group_members m on m.group_id = g.id and m.player_id = them and m.left_at is null
  join public.group_members mine on mine.group_id = g.id and mine.player_id = uid and mine.left_at is null
  where g.founder_id = uid;
  if gid is null then
    raise exception 'Only the founder can remove';
  end if;
  if not public.rg_member_inactive(them, joined) then
    raise exception 'That member is still active';
  end if;
  update public.group_members
  set left_at = now(), removed_at = now()
  where group_id = gid and player_id = them and left_at is null;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'That member is already gone';
  end if;
end $$;

create or replace function public.send_friend_request(player_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.rg_me();
  them uuid := public.rg_player_id(player_name);
begin
  if them is null then
    raise exception 'No player by that name';
  end if;
  if them = uid then
    raise exception 'Pick someone else';
  end if;
  perform pg_advisory_xact_lock(hashtext('friend:' || least(uid::text, them::text) || ':' || greatest(uid::text, them::text)));
  if exists (
    select 1 from public.friend_links f
    where f.status = 'accepted'
      and ((f.from_player = uid and f.to_player = them) or (f.from_player = them and f.to_player = uid))
  ) then
    raise exception 'Already friends';
  end if;
  if exists (
    select 1 from public.friend_links f
    where f.status = 'pending' and f.from_player = uid and f.to_player = them
  ) then
    return;
  end if;
  if exists (
    select 1 from public.friend_links f
    where f.status = 'pending' and f.from_player = them and f.to_player = uid
  ) then
    raise exception 'They already asked';
  end if;
  insert into public.friend_links (from_player, to_player)
  values (uid, them);
exception
  when unique_violation then
    raise exception 'Already pending';
end $$;

create or replace function public.cancel_friend_request(player_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.rg_me();
  them uuid := public.rg_player_id(player_name);
  n integer;
begin
  if them is null then
    raise exception 'No player by that name';
  end if;
  update public.friend_links
  set status = 'cancelled', updated_at = now()
  where from_player = uid and to_player = them and status = 'pending';
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'No request to cancel';
  end if;
end $$;

create or replace function public.accept_friend(player_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.rg_me();
  them uuid := public.rg_player_id(player_name);
  n integer;
begin
  if them is null then
    raise exception 'No player by that name';
  end if;
  update public.friend_links
  set status = 'accepted', updated_at = now()
  where from_player = them and to_player = uid and status = 'pending';
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'No request to accept';
  end if;
end $$;

create or replace function public.decline_friend(player_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.rg_me();
  them uuid := public.rg_player_id(player_name);
  n integer;
begin
  if them is null then
    raise exception 'No player by that name';
  end if;
  update public.friend_links
  set status = 'declined', updated_at = now()
  where from_player = them and to_player = uid and status = 'pending';
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'No request to decline';
  end if;
end $$;

create or replace function public.unfriend(player_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.rg_me();
  them uuid := public.rg_player_id(player_name);
  n integer;
begin
  if them is null then
    raise exception 'No player by that name';
  end if;
  update public.friend_links
  set status = 'removed', updated_at = now()
  where status = 'accepted'
    and ((from_player = uid and to_player = them) or (from_player = them and to_player = uid));
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'Not friends';
  end if;
end $$;

-- First call on or after Dec 1 (Toronto) freezes each group's member names for that year.
-- Later calls do not rewrite a lock. No prize is granted here.
create or replace function public.lock_season_rosters()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  yr integer := extract(year from (now() at time zone 'America/Toronto'))::integer;
  lock_day date := make_date(yr, 12, 1);
begin
  if (now() at time zone 'America/Toronto')::date < lock_day then
    return;
  end if;
  insert into public.group_roster_lock (group_id, season_year, lock_on, member_names)
  select
    g.id,
    yr,
    lock_day,
    coalesce((
      select array_agg(p.public_name order by p.public_name)
      from public.group_members m
      join public.players p on p.id = m.player_id and not p.is_flagged
      where m.group_id = g.id and m.left_at is null
    ), array[]::text[])
  from public.game_groups g
  on conflict (group_id, season_year) do nothing;
end $$;

-- 6. API grants --------------------------------------------------------------

revoke all on function public.rg_me() from public, anon, authenticated;
revoke all on function public.rg_player_id(text) from public, anon, authenticated;
revoke all on function public.rg_current_group(uuid) from public, anon, authenticated;
revoke all on function public.rg_label(text) from public, anon, authenticated;
revoke all on function public.rg_games_between(uuid, date, date) from public, anon, authenticated;
revoke all on function public.rg_member_inactive(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.group_period_rows(text) from public, anon, authenticated;

revoke all on function public.friends_board() from public, anon, authenticated;
revoke all on function public.my_card() from public, anon, authenticated;
revoke all on function public.player_card(text) from public, anon, authenticated;
revoke all on function public.group_card(text) from public, anon, authenticated;
revoke all on function public.group_member_rows(text) from public, anon, authenticated;
revoke all on function public.request_inbox() from public, anon, authenticated;
revoke all on function public.record_my_group_points(integer) from public, anon, authenticated;
revoke all on function public.create_group(text) from public, anon, authenticated;
revoke all on function public.request_join(text) from public, anon, authenticated;
revoke all on function public.cancel_join(text) from public, anon, authenticated;
revoke all on function public.accept_join(text) from public, anon, authenticated;
revoke all on function public.decline_join(text) from public, anon, authenticated;
revoke all on function public.leave_group() from public, anon, authenticated;
revoke all on function public.remove_inactive_member(text) from public, anon, authenticated;
revoke all on function public.send_friend_request(text) from public, anon, authenticated;
revoke all on function public.cancel_friend_request(text) from public, anon, authenticated;
revoke all on function public.accept_friend(text) from public, anon, authenticated;
revoke all on function public.decline_friend(text) from public, anon, authenticated;
revoke all on function public.unfriend(text) from public, anon, authenticated;
revoke all on function public.lock_season_rosters() from public, anon, authenticated;

grant execute on function public.player_card(text) to anon, authenticated;
grant execute on function public.group_card(text) to anon, authenticated;

grant execute on function public.friends_board() to authenticated;
grant execute on function public.my_card() to authenticated;
grant execute on function public.group_member_rows(text) to authenticated;
grant execute on function public.request_inbox() to authenticated;
grant execute on function public.record_my_group_points(integer) to authenticated;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.request_join(text) to authenticated;
grant execute on function public.cancel_join(text) to authenticated;
grant execute on function public.accept_join(text) to authenticated;
grant execute on function public.decline_join(text) to authenticated;
grant execute on function public.leave_group() to authenticated;
grant execute on function public.remove_inactive_member(text) to authenticated;
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.cancel_friend_request(text) to authenticated;
grant execute on function public.accept_friend(text) to authenticated;
grant execute on function public.decline_friend(text) to authenticated;
grant execute on function public.unfriend(text) to authenticated;
grant execute on function public.lock_season_rosters() to authenticated;

notify pgrst, 'reload schema';

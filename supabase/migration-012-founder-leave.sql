-- Friends and groups, part 2. Apply after migration 011. Do not edit 011.
-- New tables and replaced functions only. No changes to existing table columns.
-- group_points rows are never deleted.
--
-- Ranks: Leader, then up to two Captains, then Members.
-- When the Leader leaves, the badge passes to the longest-standing active Captain,
-- else the longest-standing active Member, else the longest-standing member left.
-- The last member closes the group. It leaves the boards. Its points stay.
-- A player who rejoins is a Member again.
--
-- Group names are one listed adjective plus one listed noun, plus a #number
-- (Golden Owls #12). create_group and rename_group reject anything else.
-- Public reads return display names only.

-- 1. New tables --------------------------------------------------------------

create table if not exists public.group_roles (
  group_id uuid not null references public.game_groups (id),
  player_id uuid not null references public.players (id),
  role text not null check (role in ('leader', 'captain', 'member')),
  primary key (group_id, player_id)
);

create unique index if not exists group_roles_one_leader
  on public.group_roles (group_id)
  where role = 'leader';

create table if not exists public.group_titles (
  group_id uuid primary key references public.game_groups (id),
  adjective text not null,
  noun text not null,
  tag_no integer not null check (tag_no between 1 and 999)
);

create unique index if not exists group_titles_pair_tag
  on public.group_titles (lower(adjective), lower(noun), tag_no);

create table if not exists public.group_closed (
  group_id uuid primary key references public.game_groups (id),
  closed_at timestamptz not null default now()
);

create table if not exists public.group_adjectives (
  word text primary key
);

create table if not exists public.group_nouns (
  word text primary key
);

insert into public.group_adjectives (word) values
  ('Golden'), ('Brave'), ('Swift'), ('Loyal'), ('Silver'), ('Hidden'),
  ('Noble'), ('Bright'), ('Quiet'), ('Bold'), ('Kind'), ('Merry'),
  ('Ancient'), ('Wild'), ('Gentle'), ('Proud'), ('Steady'), ('Clever'),
  ('Sunny'), ('Starlit'), ('Misty'), ('Royal'), ('Little'), ('Grand'),
  ('True'), ('Calm'), ('Keen'), ('Warm'), ('Lucky'), ('Wandering')
on conflict (word) do nothing;

insert into public.group_nouns (word) values
  ('Owls'), ('Lions'), ('Knights'), ('Keepers'), ('Stars'), ('Foxes'),
  ('Ravens'), ('Stags'), ('Wolves'), ('Eagles'), ('Bears'), ('Hares'),
  ('Sparrows'), ('Badgers'), ('Falcons'), ('Otters'), ('Herons'), ('Horses'),
  ('Shields'), ('Banners'), ('Lanterns'), ('Crowns'), ('Rivers'), ('Stones'),
  ('Gardens'), ('Torches'), ('Sails'), ('Towers'), ('Quills'), ('Bells')
on conflict (word) do nothing;

alter table public.group_roles enable row level security;
alter table public.group_titles enable row level security;
alter table public.group_closed enable row level security;
alter table public.group_adjectives enable row level security;
alter table public.group_nouns enable row level security;

revoke all on public.group_roles from public, anon, authenticated;
revoke all on public.group_titles from public, anon, authenticated;
revoke all on public.group_closed from public, anon, authenticated;
revoke all on public.group_adjectives from public, anon, authenticated;
revoke all on public.group_nouns from public, anon, authenticated;

-- Current members. The original creator who is still here becomes Leader.
-- Everyone else currently in a group becomes a Member.
insert into public.group_roles (group_id, player_id, role)
select m.group_id, m.player_id,
  case when g.founder_id = m.player_id then 'leader' else 'member' end
from public.group_members m
join public.game_groups g on g.id = m.group_id
where m.left_at is null
on conflict (group_id, player_id) do nothing;

-- If that creator already left, give the badge to the next person in line.
insert into public.group_roles (group_id, player_id, role)
select pick.group_id, pick.player_id, 'leader'
from (
  select distinct on (m.group_id) m.group_id, m.player_id
  from public.group_members m
  where m.left_at is null
    and not exists (
      select 1 from public.group_roles r
      where r.group_id = m.group_id and r.role = 'leader'
    )
  order by m.group_id, public.rg_member_inactive(m.player_id, m.joined_at), m.joined_at, m.player_id
) pick
on conflict (group_id, player_id) do update set role = 'leader';

-- 2. Helpers -----------------------------------------------------------------

create or replace function public.rg_led_group(uid uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select r.group_id
  from public.group_roles r
  join public.group_members m
    on m.group_id = r.group_id and m.player_id = r.player_id and m.left_at is null
  where r.player_id = uid
    and r.role = 'leader'
    and not exists (select 1 from public.group_closed c where c.group_id = r.group_id)
  limit 1
$$;

-- Active Captain, else active Member, else whoever has been here longest.
create or replace function public.rg_next_leader(gid uuid, skip uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select picked.player_id
  from (
    select
      m.player_id,
      m.joined_at,
      case
        when r.role = 'captain' and not public.rg_member_inactive(m.player_id, m.joined_at) then 0
        when r.role = 'member' and not public.rg_member_inactive(m.player_id, m.joined_at) then 1
        else 2
      end as line_rank
    from public.group_members m
    join public.group_roles r on r.group_id = m.group_id and r.player_id = m.player_id
    where m.group_id = gid
      and m.left_at is null
      and m.player_id is distinct from skip
      and r.role <> 'leader'
  ) picked
  order by picked.line_rank, picked.joined_at, picked.player_id
  limit 1
$$;

-- Listed words only. Keeps the #number when the same pair is chosen again.
create or replace function public.rg_claim_title(gid uuid, adjective text, noun text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  adj text;
  noun_word text;
  tag integer;
  label text;
  tries integer := 0;
  same boolean;
begin
  select a.word into adj
  from public.group_adjectives a
  where lower(a.word) = lower(btrim(coalesce(adjective, '')));
  select n.word into noun_word
  from public.group_nouns n
  where lower(n.word) = lower(btrim(coalesce(noun, '')));
  if adj is null or noun_word is null then
    raise exception 'Pick a name from the list';
  end if;

  perform pg_advisory_xact_lock(hashtext('title:' || lower(adj) || ':' || lower(noun_word)));

  select t.adjective = adj and t.noun = noun_word into same
  from public.group_titles t
  where t.group_id = gid;
  if same then
    select t.tag_no into tag from public.group_titles t where t.group_id = gid;
  else
    select coalesce(max(t.tag_no), 0) + 1 into tag
    from public.group_titles t
    where lower(t.adjective) = lower(adj) and lower(t.noun) = lower(noun_word);
  end if;

  loop
    tries := tries + 1;
    if tag > 999 or tries > 30 then
      raise exception 'Too many groups with that name';
    end if;
    label := adj || ' ' || noun_word || ' #' || tag::text;
    if char_length(label) > 24 then
      raise exception 'Too many groups with that name';
    end if;
    begin
      update public.game_groups set name = label where id = gid;
      insert into public.group_titles (group_id, adjective, noun, tag_no)
      values (gid, adj, noun_word, tag)
      on conflict (group_id) do update
        set adjective = excluded.adjective,
            noun = excluded.noun,
            tag_no = excluded.tag_no;
      return label;
    exception
      when unique_violation then
        tag := tag + 1;
    end;
  end loop;
  return label;
end $$;

-- 3. Boards hide a closed group ----------------------------------------------

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
  where not exists (select 1 from public.group_closed c where c.group_id = g.id)
$$;

-- Name, rank, and score only. active_members is a count. No member names or ids.
create or replace view public.group_week_board
with (security_barrier = true, security_invoker = false) as
select group_name, average, place, active_members, season_points
from public.group_period_rows('week');

create or replace view public.group_month_board
with (security_barrier = true, security_invoker = false) as
select group_name, average, place, active_members, season_points
from public.group_period_rows('month');

comment on view public.group_week_board is
  'Group name, rank, and score for the Toronto week, plus a member count. No member names or ids.';

comment on view public.group_month_board is
  'Group name, rank, and score for the Toronto month, plus a member count. No member names or ids.';

revoke all on public.group_week_board from public, anon, authenticated;
revoke all on public.group_month_board from public, anon, authenticated;
grant select (group_name, average, place, active_members, season_points) on public.group_week_board to anon, authenticated;
grant select (group_name, average, place, active_members, season_points) on public.group_month_board to anon, authenticated;

-- Callers may run this. It returns the same name, rank, score, and member count as the views.
revoke all on function public.group_period_rows(text) from public;
grant execute on function public.group_period_rows(text) to anon, authenticated;

-- 4. Reads -------------------------------------------------------------------

drop function if exists public.my_card();

create function public.my_card()
returns table (
  name text,
  score integer,
  place integer,
  group_name text,
  friends_count integer,
  pending_count integer,
  founder boolean,
  role text,
  next_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.rg_me();
  gid uuid;
  heir uuid;
begin
  gid := public.rg_current_group(uid);
  if exists (select 1 from public.group_roles r where r.group_id = gid and r.player_id = uid and r.role = 'leader') then
    heir := public.rg_next_leader(gid, uid);
  end if;
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
      where j.status = 'pending'
        and j.group_id = public.rg_led_group(uid)
    ),
    exists (
      select 1 from public.group_roles gr
      where gr.group_id = gid and gr.player_id = uid and gr.role = 'leader'
    ),
    coalesce((
      select gr.role from public.group_roles gr
      where gr.group_id = gid and gr.player_id = uid
    ), ''),
    (select hp.public_name from public.players hp where hp.id = heir)
  from public.players p
  left join public.player_board_row r on r.player_id = p.id
  left join public.everyone_board eb on eb.name = p.public_name
  left join public.group_members m on m.player_id = p.id and m.left_at is null
  left join public.game_groups g on g.id = m.group_id
  where p.id = uid;
end $$;

drop function if exists public.player_card(text);

create function public.player_card(target text)
returns table (
  name text,
  score integer,
  place integer,
  group_name text,
  friend_status text,
  join_status text,
  is_you boolean,
  role text
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
  mine text;
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
  else
    select gr.role into mine
    from public.group_members m
    left join public.group_roles gr on gr.group_id = m.group_id and gr.player_id = m.player_id
    where m.group_id = their_group and m.player_id = uid and m.left_at is null;
    if mine = 'leader' then
      joined := 'leader';
    elsif mine = 'captain' then
      joined := 'captain';
    elsif mine is not null then
      joined := 'member';
    elsif uid is not null and exists (
      select 1 from public.group_join_requests j
      where j.group_id = their_group and j.player_id = uid and j.status = 'pending'
    ) then
      joined := 'pending';
    else
      joined := 'none';
    end if;
  end if;

  return query
  select
    p.public_name,
    coalesce(r.score, 0)::integer,
    eb.place,
    g.name,
    link,
    joined,
    uid is not null and uid = p.id,
    case
      when uid is not null and exists (
        select 1 from public.group_members mine
        where mine.group_id = their_group and mine.player_id = uid and mine.left_at is null
      ) then coalesce((
        select gr.role from public.group_roles gr
        where gr.group_id = their_group and gr.player_id = them
      ), '')
      else ''
    end
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
  mine text;
  week_start date := date_trunc('week', now() at time zone 'America/Toronto')::date;
  month_start date := date_trunc('month', now() at time zone 'America/Toronto')::date;
begin
  select g.id into gid
  from public.game_groups g
  where lower(g.name) = lower(btrim(coalesce(target, '')));
  if gid is null then
    return;
  end if;

  if uid is not null then
    select gr.role into mine
    from public.group_members m
    left join public.group_roles gr on gr.group_id = m.group_id and gr.player_id = m.player_id
    where m.group_id = gid and m.player_id = uid and m.left_at is null;
    if mine = 'leader' then
      link := 'leader';
    elsif mine = 'captain' then
      link := 'captain';
    elsif mine is not null then
      link := 'member';
    elsif exists (
      select 1 from public.group_join_requests j
      where j.group_id = gid and j.player_id = uid and j.status = 'pending'
    ) then
      link := 'pending';
    end if;
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

-- Names and ranks for one group. Empty unless the caller is a current member of that group.
drop function if exists public.group_member_rows(text);

create function public.group_member_rows(target text)
returns table (
  name text,
  member_status text,
  can_remove boolean,
  role text,
  next_in_line boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  gid uuid;
  leader_id uuid;
  heir uuid;
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
  select r.player_id into leader_id
  from public.group_roles r
  where r.group_id = gid and r.role = 'leader';
  heir := public.rg_next_leader(gid, leader_id);
  return query
  select
    p.public_name,
    case when public.rg_member_inactive(p.id, m.joined_at) then 'inactive' else 'active' end,
    leader_id = uid
      and p.id <> uid
      and public.rg_member_inactive(p.id, m.joined_at),
    coalesce(gr.role, 'member'),
    heir is not null and p.id = heir
  from public.group_members m
  join public.players p on p.id = m.player_id and not p.is_flagged
  left join public.group_roles gr on gr.group_id = m.group_id and gr.player_id = m.player_id
  where m.group_id = gid and m.left_at is null
  order by
    case gr.role when 'leader' then 0 when 'captain' then 1 else 2 end,
    m.joined_at,
    p.public_name;
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
    join public.game_groups g on g.id = j.group_id and g.id = public.rg_led_group(uid)
    join public.players p on p.id = j.player_id and not p.is_flagged
    where j.status = 'pending'
  ) q
  order by q.asked_at desc, q.player_name;
end $$;

create or replace function public.leave_preview()
returns table (
  next_name text,
  closes boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.rg_me();
  gid uuid;
  is_leader boolean := false;
  heir uuid;
  remain integer;
begin
  select m.group_id into gid
  from public.group_members m
  where m.player_id = uid and m.left_at is null;
  if gid is null then
    raise exception 'You are not in a group';
  end if;
  is_leader := exists (
    select 1 from public.group_roles r
    where r.group_id = gid and r.player_id = uid and r.role = 'leader'
  );
  select count(*)::integer into remain
  from public.group_members m
  where m.group_id = gid and m.left_at is null and m.player_id <> uid;
  if remain = 0 then
    return query select null::text, true;
    return;
  end if;
  if is_leader then
    heir := public.rg_next_leader(gid, uid);
    return query
    select (select p.public_name from public.players p where p.id = heir), false;
    return;
  end if;
  return query select null::text, false;
end $$;

-- 5. Writes ------------------------------------------------------------------
-- The free-text create_group(text) is gone. Only listed words are accepted.

drop function if exists public.create_group(text);
drop function if exists public.create_group(text, text);

create function public.create_group(adjective text, noun text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.rg_me();
  gid uuid;
  label text;
begin
  if public.rg_current_group(uid) is not null then
    raise exception 'Leave your group first';
  end if;
  if exists (select 1 from public.group_join_requests j where j.player_id = uid and j.status = 'pending') then
    raise exception 'Cancel your request first';
  end if;
  insert into public.game_groups (name, founder_id)
  values ('new-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12), uid)
  returning id into gid;
  insert into public.group_members (group_id, player_id)
  values (gid, uid);
  insert into public.group_roles (group_id, player_id, role)
  values (gid, uid, 'leader');
  label := public.rg_claim_title(gid, adjective, noun);
  return label;
end $$;

create or replace function public.rename_group(adjective text, noun text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.rg_me();
  gid uuid := public.rg_led_group(uid);
begin
  if gid is null then
    raise exception 'Only the Leader can rename';
  end if;
  return public.rg_claim_title(gid, adjective, noun);
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
  if exists (select 1 from public.group_closed c where c.group_id = gid) then
    raise exception 'That group has closed';
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

create or replace function public.accept_join(player_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.rg_me();
  them uuid := public.rg_player_id(player_name);
  gid uuid := public.rg_led_group(uid);
  n integer;
begin
  if them is null then
    raise exception 'No player by that name';
  end if;
  if gid is null then
    raise exception 'Only the Leader can do that';
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
  insert into public.group_roles (group_id, player_id, role)
  values (gid, them, 'member')
  on conflict (group_id, player_id) do update set role = 'member';
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
  gid uuid := public.rg_led_group(uid);
  n integer;
begin
  if them is null then
    raise exception 'No player by that name';
  end if;
  if gid is null then
    raise exception 'Only the Leader can do that';
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
  gid uuid;
  is_leader boolean := false;
  heir uuid;
  n integer;
begin
  select m.group_id into gid
  from public.group_members m
  where m.player_id = uid and m.left_at is null;
  if gid is null then
    raise exception 'You are not in a group';
  end if;
  is_leader := exists (
    select 1 from public.group_roles r
    where r.group_id = gid and r.player_id = uid and r.role = 'leader'
  );
  if is_leader then
    heir := public.rg_next_leader(gid, uid);
  end if;
  delete from public.group_roles r
  where r.group_id = gid and r.player_id = uid;
  if is_leader and heir is not null then
    insert into public.group_roles (group_id, player_id, role)
    values (gid, heir, 'leader')
    on conflict (group_id, player_id) do update set role = 'leader';
  elsif not exists (
    select 1 from public.group_members m
    where m.group_id = gid and m.left_at is null and m.player_id <> uid
  ) then
    insert into public.group_closed (group_id)
    values (gid)
    on conflict (group_id) do nothing;
  end if;
  update public.group_members
  set left_at = now()
  where group_id = gid and player_id = uid and left_at is null;
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
  gid uuid := public.rg_led_group(uid);
  joined timestamptz;
  n integer;
begin
  if them is null then
    raise exception 'No player by that name';
  end if;
  if them = uid then
    raise exception 'Leave the group instead';
  end if;
  if gid is null then
    raise exception 'Only the Leader can remove';
  end if;
  select m.joined_at into joined
  from public.group_members m
  where m.group_id = gid and m.player_id = them and m.left_at is null;
  if joined is null then
    raise exception 'They are not in your group';
  end if;
  if not public.rg_member_inactive(them, joined) then
    raise exception 'That member is still active';
  end if;
  delete from public.group_roles r
  where r.group_id = gid and r.player_id = them;
  update public.group_members
  set left_at = now(), removed_at = now()
  where group_id = gid and player_id = them and left_at is null;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'That member is already gone';
  end if;
end $$;

create or replace function public.promote_captain(player_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.rg_me();
  them uuid := public.rg_player_id(player_name);
  gid uuid := public.rg_led_group(uid);
  held text;
  captains integer;
begin
  if them is null then
    raise exception 'No player by that name';
  end if;
  if gid is null then
    raise exception 'Only the Leader can do that';
  end if;
  if them = uid then
    raise exception 'Pick someone else';
  end if;
  select r.role into held
  from public.group_roles r
  join public.group_members m
    on m.group_id = r.group_id and m.player_id = r.player_id and m.left_at is null
  where r.group_id = gid and r.player_id = them;
  if held is distinct from 'member' then
    raise exception 'Pick a member';
  end if;
  select count(*)::integer into captains
  from public.group_roles r
  join public.group_members m
    on m.group_id = r.group_id and m.player_id = r.player_id and m.left_at is null
  where r.group_id = gid and r.role = 'captain';
  if captains >= 2 then
    raise exception 'Two Captains already';
  end if;
  update public.group_roles
  set role = 'captain'
  where group_id = gid and player_id = them;
end $$;

create or replace function public.demote_captain(player_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.rg_me();
  them uuid := public.rg_player_id(player_name);
  gid uuid := public.rg_led_group(uid);
  n integer;
begin
  if them is null then
    raise exception 'No player by that name';
  end if;
  if gid is null then
    raise exception 'Only the Leader can do that';
  end if;
  update public.group_roles
  set role = 'member'
  where group_id = gid and player_id = them and role = 'captain';
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'They are not a Captain';
  end if;
end $$;

-- 6. API grants --------------------------------------------------------------

revoke all on function public.rg_led_group(uuid) from public, anon, authenticated;
revoke all on function public.rg_next_leader(uuid, uuid) from public, anon, authenticated;
revoke all on function public.rg_claim_title(uuid, text, text) from public, anon, authenticated;

revoke all on function public.my_card() from public, anon, authenticated;
revoke all on function public.player_card(text) from public, anon, authenticated;
revoke all on function public.group_card(text) from public, anon, authenticated;
revoke all on function public.group_member_rows(text) from public, anon, authenticated;
revoke all on function public.request_inbox() from public, anon, authenticated;
revoke all on function public.leave_preview() from public, anon, authenticated;
revoke all on function public.create_group(text, text) from public, anon, authenticated;
revoke all on function public.rename_group(text, text) from public, anon, authenticated;
revoke all on function public.promote_captain(text) from public, anon, authenticated;
revoke all on function public.demote_captain(text) from public, anon, authenticated;

grant execute on function public.player_card(text) to anon, authenticated;
grant execute on function public.group_card(text) to anon, authenticated;

grant execute on function public.my_card() to authenticated;
grant execute on function public.group_member_rows(text) to authenticated;
grant execute on function public.request_inbox() to authenticated;
grant execute on function public.leave_preview() to authenticated;
grant execute on function public.create_group(text, text) to authenticated;
grant execute on function public.rename_group(text, text) to authenticated;
grant execute on function public.promote_captain(text) to authenticated;
grant execute on function public.demote_captain(text) to authenticated;

notify pgrst, 'reload schema';

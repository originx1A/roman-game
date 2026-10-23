-- Group boards list every group that scored this Toronto week or month.
-- The old 3-game / 3-member gate stays in migration 011 and 012. This file only
-- replaces group_period_rows and the two board views. Closed groups stay hidden.
-- No member names and no deletes.

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
  )
  select
    g.name,
    a.avg_points,
    rank() over (order by a.avg_points desc, g.name asc)::integer,
    (select count(*)::integer from played p where p.group_id = g.id),
    coalesce((
      select sum(gp.points)::integer
      from public.group_points gp
      where gp.group_id = g.id
        and extract(year from (gp.played_at at time zone 'America/Toronto'))::integer
          = extract(year from (now() at time zone 'America/Toronto'))::integer
    ), 0)
  from averages a
  join public.game_groups g on g.id = a.group_id
  where not exists (select 1 from public.group_closed c where c.group_id = g.id)
$$;

-- Name, rank, and score only. active_members is how many members scored this period.
create or replace view public.group_week_board
with (security_barrier = true, security_invoker = false) as
select group_name, average, place, active_members, season_points
from public.group_period_rows('week');

create or replace view public.group_month_board
with (security_barrier = true, security_invoker = false) as
select group_name, average, place, active_members, season_points
from public.group_period_rows('month');

comment on view public.group_week_board is
  'Group name, rank, and score for the Toronto week. Any group with points is listed. No member names or ids.';

comment on view public.group_month_board is
  'Group name, rank, and score for the Toronto month. Any group with points is listed. No member names or ids.';

revoke all on public.group_week_board from public, anon, authenticated;
revoke all on public.group_month_board from public, anon, authenticated;
grant select (group_name, average, place, active_members, season_points) on public.group_week_board to anon, authenticated;
grant select (group_name, average, place, active_members, season_points) on public.group_month_board to anon, authenticated;

revoke all on function public.group_period_rows(text) from public;
grant execute on function public.group_period_rows(text) to anon, authenticated;

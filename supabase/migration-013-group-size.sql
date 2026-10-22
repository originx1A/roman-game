-- Roman's Game · migration 013 · a group holds at most 10 current members.
-- Replaces request_join and accept_join only. No table changes. No point deletes.
-- Apply in the Supabase SQL editor after migration 012.

create or replace function public.request_join(group_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.rg_me();
  gid uuid;
  n integer;
begin
  if uid is null then
    raise exception 'Sign in first';
  end if;
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
  select count(*) into n from public.group_members m where m.group_id = gid and m.left_at is null;
  if n >= 10 then
    raise exception 'That group is full';
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
  select count(*) into n from public.group_members m where m.group_id = gid and m.left_at is null;
  if n >= 10 then
    raise exception 'That group is full';
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

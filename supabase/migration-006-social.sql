-- Roman's Game · migration 006 · friends, inbox, challenges, presence, push, live play,
-- device link, profile locks, passkeys, and the atomic coin ledger.
--
-- Tony: paste this whole file into the Supabase SQL editor for romans-game and run it.
-- Do not run it against any other project. Safe to run more than once.
-- Run after migration 005. The game never runs this itself.
--
-- No emails are stored here. Players see public names only.

create extension if not exists pgcrypto with schema extensions;

-- 1. Friend codes -----------------------------------------------------------
create table if not exists public.friend_codes (
  player_id uuid primary key references public.players(id) on delete cascade,
  code text not null unique check (code ~ '^ROMAN-[0-9]{4}$'),
  created_at timestamptz not null default now()
);
alter table public.friend_codes enable row level security;
drop policy if exists "friend_codes: read own" on public.friend_codes;
create policy "friend_codes: read own" on public.friend_codes
  for select to authenticated using (player_id = auth.uid());
revoke all on public.friend_codes from anon;
grant select on public.friend_codes to authenticated;

-- 2. Friendships (one row, ids ordered) ------------------------------------
create table if not exists public.friendships (
  player_a uuid not null references public.players(id) on delete cascade,
  player_b uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (player_a, player_b),
  check (player_a < player_b)
);
alter table public.friendships enable row level security;
drop policy if exists "friendships: read own" on public.friendships;
create policy "friendships: read own" on public.friendships
  for select to authenticated using (auth.uid() = player_a or auth.uid() = player_b);
revoke all on public.friendships from anon;
grant select on public.friendships to authenticated;

-- 3. Friend requests --------------------------------------------------------
create table if not exists public.friend_requests (
  id bigint generated always as identity primary key,
  op_id uuid unique,
  from_id uuid not null references public.players(id) on delete cascade,
  to_id uuid not null references public.players(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'ignored')),
  created_at timestamptz not null default now(),
  unique (from_id, to_id)
);
alter table public.friend_requests enable row level security;
drop policy if exists "friend_requests: read own" on public.friend_requests;
create policy "friend_requests: read own" on public.friend_requests
  for select to authenticated using (auth.uid() = from_id or auth.uid() = to_id);
revoke all on public.friend_requests from anon;
grant select on public.friend_requests to authenticated;

-- 4. Inbox ------------------------------------------------------------------
create table if not exists public.inbox (
  id bigint generated always as identity primary key,
  op_id uuid,
  recipient_id uuid not null references public.players(id) on delete cascade,
  kind text not null check (kind in ('request', 'challenge', 'result', 'live')),
  from_id uuid references public.players(id) on delete set null,
  from_name text not null check (char_length(from_name) between 1 and 24),
  body text not null check (char_length(body) between 1 and 240),
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists inbox_recipient_idx on public.inbox (recipient_id, created_at desc);
alter table public.inbox enable row level security;
drop policy if exists "inbox: read own" on public.inbox;
drop policy if exists "inbox: mark read" on public.inbox;
create policy "inbox: read own" on public.inbox
  for select to authenticated using (recipient_id = auth.uid());
create policy "inbox: mark read" on public.inbox
  for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
revoke all on public.inbox from anon;
grant select, update (read_at) on public.inbox to authenticated;

-- 5. Presence ---------------------------------------------------------------
create table if not exists public.presence (
  player_id uuid primary key references public.players(id) on delete cascade,
  last_seen timestamptz not null default now(),
  playing boolean not null default false
);
alter table public.presence enable row level security;
drop policy if exists "presence: update own" on public.presence;
drop policy if exists "presence: read own" on public.presence;
create policy "presence: read own" on public.presence
  for select to authenticated using (player_id = auth.uid());
create policy "presence: update own" on public.presence
  for insert to authenticated with check (player_id = auth.uid());
create policy "presence: own update" on public.presence
  for update to authenticated using (player_id = auth.uid()) with check (player_id = auth.uid());
revoke all on public.presence from anon;
grant select, insert, update on public.presence to authenticated;

-- 6. Push subscriptions (the browser endpoint, never an email) -------------
create table if not exists public.push_subs (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  endpoint text not null check (char_length(endpoint) between 8 and 500),
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (player_id, endpoint)
);
alter table public.push_subs enable row level security;
drop policy if exists "push: own" on public.push_subs;
create policy "push: own" on public.push_subs
  for all to authenticated using (player_id = auth.uid()) with check (player_id = auth.uid());
revoke all on public.push_subs from anon;
grant select, insert, update, delete on public.push_subs to authenticated;

-- 7. Live "play now" --------------------------------------------------------
create table if not exists public.live_matches (
  id uuid primary key default gen_random_uuid(),
  op_id uuid unique,
  host_id uuid not null references public.players(id) on delete cascade,
  guest_id uuid references public.players(id) on delete cascade,
  layout text,
  puzzle_name text,
  status text not null default 'pending' check (status in ('pending', 'live', 'done', 'expired')),
  host_score integer,
  host_ms integer,
  guest_score integer,
  guest_ms integer,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes')
);
alter table public.live_matches enable row level security;
drop policy if exists "live: participants" on public.live_matches;
create policy "live: participants" on public.live_matches
  for select to authenticated using (auth.uid() = host_id or auth.uid() = guest_id);
revoke all on public.live_matches from anon;
grant select on public.live_matches to authenticated;

-- 8. Device link (WhatsApp-style). Codes are stored as hashes only. --------
create table if not exists public.device_links (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  code_hash text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.device_links enable row level security;
revoke all on public.device_links from anon, authenticated;

create table if not exists public.linked_devices (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
alter table public.linked_devices enable row level security;
drop policy if exists "devices: own read" on public.linked_devices;
drop policy if exists "devices: own insert" on public.linked_devices;
drop policy if exists "devices: own delete" on public.linked_devices;
create policy "devices: own read" on public.linked_devices
  for select to authenticated using (player_id = auth.uid());
create policy "devices: own insert" on public.linked_devices
  for insert to authenticated with check (player_id = auth.uid());
create policy "devices: own delete" on public.linked_devices
  for delete to authenticated using (player_id = auth.uid());
revoke all on public.linked_devices from anon;
grant select, insert, delete on public.linked_devices to authenticated;

-- 9. Profile PIN / picture password ----------------------------------------
create table if not exists public.profile_locks (
  player_id uuid primary key references public.players(id) on delete cascade,
  pin_hash text,
  picture_hash text,
  fails integer not null default 0,
  locked_until timestamptz
);
alter table public.profile_locks enable row level security;
revoke all on public.profile_locks from anon, authenticated;

-- 10. Passkeys. The public key is not contact info. ------------------------
create table if not exists public.passkeys (
  credential_id text primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  public_key text not null,
  counter bigint not null default 0,
  created_at timestamptz not null default now()
);
alter table public.passkeys enable row level security;
drop policy if exists "passkeys: own read" on public.passkeys;
create policy "passkeys: own read" on public.passkeys
  for select to authenticated using (player_id = auth.uid());
revoke all on public.passkeys from anon;
grant select on public.passkeys to authenticated;

-- 11. Coin ledger. Clients cannot write the balance. -----------------------
create table if not exists public.player_balances (
  player_id uuid primary key references public.players(id) on delete cascade,
  balance integer not null default 0 check (balance between 0 and 250000),
  updated_at timestamptz not null default now()
);
alter table public.player_balances enable row level security;
drop policy if exists "balances: read own" on public.player_balances;
create policy "balances: read own" on public.player_balances
  for select to authenticated using (player_id = auth.uid());
revoke all on public.player_balances from anon;
grant select on public.player_balances to authenticated;

create table if not exists public.coin_ops (
  op_id uuid primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  kind text not null check (kind in ('spend', 'earn', 'stripe')),
  cost integer not null default 0,
  amount integer not null default 0,
  item_type text,
  item_id text,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists coin_ops_player_idx on public.coin_ops (player_id, created_at);
alter table public.coin_ops enable row level security;
drop policy if exists "coin_ops: read own" on public.coin_ops;
create policy "coin_ops: read own" on public.coin_ops
  for select to authenticated using (player_id = auth.uid());
revoke all on public.coin_ops from anon;
grant select on public.coin_ops to authenticated;

create table if not exists public.player_items (
  player_id uuid not null references public.players(id) on delete cascade,
  item_type text not null,
  item_id text not null,
  op_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (player_id, item_type, item_id)
);
alter table public.player_items enable row level security;
drop policy if exists "items: read own" on public.player_items;
create policy "items: read own" on public.player_items
  for select to authenticated using (player_id = auth.uid());
revoke all on public.player_items from anon;
grant select on public.player_items to authenticated;

-- Stripe receipts. The webhook records a paid Checkout session. The claim
-- attaches it to the signed-in player. session id is the op id, so it credits once.
create table if not exists public.stripe_receipts (
  session_id text primary key check (session_id ~ '^cs_(test|live)_'),
  pack_id text not null,
  coins integer not null check (coins in (500, 1200, 3000)),
  player_id uuid references public.players(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.stripe_receipts enable row level security;
revoke all on public.stripe_receipts from anon, authenticated;

-- 12. Score de-dupe ---------------------------------------------------------
alter table public.scores add column if not exists op_id uuid;
create unique index if not exists scores_op_id_uniq on public.scores (op_id) where op_id is not null;

-- Helpers -------------------------------------------------------------------
create or replace function public._pair(a uuid, b uuid)
returns table (lo uuid, hi uuid)
language sql immutable as $$
  select least(a, b), greatest(a, b)
$$;

create or replace function public._public_name(uid uuid)
returns text
language sql stable security definer set search_path = public as $$
  select public_name from public.players where id = uid and not is_flagged
$$;

-- Anonymous players get a row without an age check or a news signup.
-- Email sign-up still goes through savePlayerName and the age policy.
create or replace function public.ensure_player()
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.players (id, display_name)
  values (auth.uid(), 'Player')
  on conflict (id) do nothing;
end $$;

-- Friend code ---------------------------------------------------------------
create or replace function public.ensure_friend_code()
returns text
language plpgsql security definer set search_path = public as $$
declare
  c text;
  i int := 0;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  select code into c from public.friend_codes where player_id = auth.uid();
  if found then return c; end if;
  loop
    i := i + 1;
    c := 'ROMAN-' || lpad((1000 + floor(random() * 9000))::int::text, 4, '0');
    begin
      insert into public.friend_codes (player_id, code) values (auth.uid(), c);
      return c;
    exception when unique_violation then
      if i >= 25 then raise exception 'could not assign a friend code'; end if;
    end;
  end loop;
end $$;

create or replace function public.connect_friend_code(friend_code text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  other uuid;
  lo uuid;
  hi uuid;
  nm text;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'signed_out'); end if;
  select player_id into other from public.friend_codes where code = upper(btrim(friend_code));
  if other is null or other = auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'unknown');
  end if;
  select p.lo, p.hi into lo, hi from public._pair(auth.uid(), other) p;
  insert into public.friendships (player_a, player_b) values (lo, hi) on conflict do nothing;
  nm := public._public_name(other);
  return jsonb_build_object('ok', true, 'name', nm);
end $$;

create or replace function public.request_friend(op uuid, friend_name text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  other uuid;
  nm text;
  mine text;
  existing uuid;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'signed_out'); end if;
  if op is not null then
    select op_id into existing from public.friend_requests where op_id = op;
    if found then return jsonb_build_object('ok', true, 'duplicate', true); end if;
  end if;
  select id, public_name into other, nm
  from public.players
  where lower(public_name) = lower(btrim(friend_name)) and not is_flagged
  limit 1;
  if other is null or other = auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'unknown');
  end if;
  if exists (
    select 1 from public.friendships f
    where (f.player_a, f.player_b) = (select lo, hi from public._pair(auth.uid(), other))
  ) then
    return jsonb_build_object('ok', true, 'already', true, 'name', nm);
  end if;
  insert into public.friend_requests (op_id, from_id, to_id)
  values (op, auth.uid(), other)
  on conflict (from_id, to_id) do nothing;
  if not found then
    return jsonb_build_object('ok', true, 'duplicate', true, 'name', nm);
  end if;
  mine := coalesce(public._public_name(auth.uid()), 'A friend');
  insert into public.inbox (op_id, recipient_id, kind, from_id, from_name, body, payload)
  values (op, other, 'request', auth.uid(), mine, mine || ' wants to be friends', jsonb_build_object('name', mine));
  return jsonb_build_object('ok', true, 'name', nm);
end $$;

create or replace function public.respond_friend(request_id bigint, accept boolean)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  req public.friend_requests%rowtype;
  lo uuid;
  hi uuid;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false); end if;
  select * into req from public.friend_requests where id = request_id and to_id = auth.uid();
  if not found then return jsonb_build_object('ok', false, 'error', 'missing'); end if;
  if accept then
    select p.lo, p.hi into lo, hi from public._pair(req.from_id, req.to_id) p;
    insert into public.friendships (player_a, player_b) values (lo, hi) on conflict do nothing;
    update public.friend_requests set status = 'accepted' where id = req.id;
  else
    update public.friend_requests set status = 'ignored' where id = req.id;
  end if;
  update public.inbox set read_at = coalesce(read_at, now())
  where recipient_id = auth.uid() and kind = 'request' and from_id = req.from_id;
  return jsonb_build_object('ok', true, 'accepted', accept);
end $$;

create or replace function public.my_friends()
returns table (name text)
language sql stable security definer set search_path = public as $$
  select p.public_name
  from public.friendships f
  join public.players p on p.id = case when f.player_a = auth.uid() then f.player_b else f.player_a end
  where auth.uid() in (f.player_a, f.player_b) and not p.is_flagged
$$;

create or replace function public.touch_presence(is_playing boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.presence (player_id, last_seen, playing)
  values (auth.uid(), now(), coalesce(is_playing, false))
  on conflict (player_id) do update set last_seen = now(), playing = excluded.playing;
end $$;

create or replace function public.friend_presence()
returns table (name text, playing boolean, last_seen timestamptz)
language sql stable security definer set search_path = public as $$
  select p.public_name, pr.playing, pr.last_seen
  from public.friendships f
  join public.players p on p.id = case when f.player_a = auth.uid() then f.player_b else f.player_a end
  left join public.presence pr on pr.player_id = p.id
  where auth.uid() in (f.player_a, f.player_b) and not p.is_flagged
$$;

-- Challenges, results, live play -------------------------------------------
create or replace function public.send_challenge(op uuid, to_name text, body text, payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  other uuid;
  mine text;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false); end if;
  if op is not null and exists (select 1 from public.inbox where op_id = op) then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;
  select id into other from public.players where lower(public_name) = lower(btrim(to_name)) and not is_flagged limit 1;
  if other is null or other = auth.uid() then return jsonb_build_object('ok', false, 'error', 'unknown'); end if;
  if not exists (
    select 1 from public.friendships f
    where (f.player_a, f.player_b) = (select lo, hi from public._pair(auth.uid(), other))
  ) then
    return jsonb_build_object('ok', false, 'error', 'not_friends');
  end if;
  mine := coalesce(public._public_name(auth.uid()), 'A friend');
  insert into public.inbox (op_id, recipient_id, kind, from_id, from_name, body, payload)
  values (op, other, 'challenge', auth.uid(), mine, left(coalesce(nullif(btrim(body), ''), mine || ' challenged you'), 240), coalesce(payload, '{}'::jsonb));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.post_result(op uuid, their_name text, my_score integer, their_score integer)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  other uuid;
  mine text;
  them text;
  mine_body text;
  their_body text;
  by_me integer;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false); end if;
  if op is not null and exists (select 1 from public.inbox where op_id = op and kind = 'result') then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;
  if my_score < 0 or my_score > 1000000 or their_score < 0 or their_score > 1000000 then
    return jsonb_build_object('ok', false, 'error', 'bad_score');
  end if;
  select id into other from public.players where lower(public_name) = lower(btrim(their_name)) and not is_flagged limit 1;
  mine := coalesce(public._public_name(auth.uid()), 'A friend');
  them := coalesce(their_name, 'Friend');
  if my_score = their_score then
    mine_body := 'It''s a tie';
    their_body := 'It''s a tie';
  elsif my_score > their_score then
    by_me := my_score - their_score;
    mine_body := 'You win';
    their_body := mine || ' beat you by ' || by_me::text;
  else
    mine_body := them || ' beat you by ' || (their_score - my_score)::text;
    their_body := 'You win';
  end if;
  insert into public.inbox (op_id, recipient_id, kind, from_id, from_name, body, payload)
  values (op, auth.uid(), 'result', other, left(them, 24), mine_body, jsonb_build_object('my', my_score, 'their', their_score));
  if other is not null then
    insert into public.inbox (op_id, recipient_id, kind, from_id, from_name, body, payload)
    values (op, other, 'result', auth.uid(), left(mine, 24), their_body, jsonb_build_object('my', their_score, 'their', my_score));
  end if;
  return jsonb_build_object('ok', true, 'mine', mine_body, 'theirs', their_body);
end $$;

create or replace function public.send_live(op uuid, to_name text, layout text, puzzle_name text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  other uuid;
  mine text;
  mid uuid;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false); end if;
  if op is not null then
    select id into mid from public.live_matches where op_id = op;
    if found then return jsonb_build_object('ok', true, 'id', mid, 'duplicate', true); end if;
  end if;
  select id into other from public.players where lower(public_name) = lower(btrim(to_name)) and not is_flagged limit 1;
  if other is null then return jsonb_build_object('ok', false, 'error', 'unknown'); end if;
  mine := coalesce(public._public_name(auth.uid()), 'A friend');
  insert into public.live_matches (op_id, host_id, guest_id, layout, puzzle_name)
  values (op, auth.uid(), other, layout, left(coalesce(puzzle_name, 'Live board'), 40))
  returning id into mid;
  insert into public.inbox (op_id, recipient_id, kind, from_id, from_name, body, payload)
  values (op, other, 'live', auth.uid(), mine, mine || ' wants to play now', jsonb_build_object('match', mid, 'layout', layout, 'name', puzzle_name));
  return jsonb_build_object('ok', true, 'id', mid);
end $$;

create or replace function public.join_live(match_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  row public.live_matches%rowtype;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false); end if;
  select * into row from public.live_matches where id = match_id and guest_id = auth.uid();
  if not found then return jsonb_build_object('ok', false, 'error', 'missing'); end if;
  if row.expires_at < now() then
    update public.live_matches set status = 'expired' where id = match_id;
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;
  update public.live_matches set status = 'live' where id = match_id;
  return jsonb_build_object('ok', true, 'layout', row.layout, 'name', row.puzzle_name);
end $$;

create or replace function public.finish_live(match_id uuid, score integer, ms integer)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  row public.live_matches%rowtype;
  host_name text;
  guest_name text;
  host_body text;
  guest_body text;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false); end if;
  if score < 0 or score > 1000000 or ms < 0 or ms > 86400000 then
    return jsonb_build_object('ok', false, 'error', 'bad_score');
  end if;
  select * into row from public.live_matches where id = match_id and (host_id = auth.uid() or guest_id = auth.uid()) for update;
  if not found then return jsonb_build_object('ok', false); end if;
  if auth.uid() = row.host_id and row.host_score is not null then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;
  if auth.uid() = row.guest_id and row.guest_score is not null then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;
  if auth.uid() = row.host_id then
    update public.live_matches set host_score = score, host_ms = ms where id = match_id;
  else
    update public.live_matches set guest_score = score, guest_ms = ms where id = match_id;
  end if;
  select * into row from public.live_matches where id = match_id;
  if row.host_score is null or row.guest_score is null then
    return jsonb_build_object('ok', true, 'waiting', true);
  end if;
  update public.live_matches set status = 'done' where id = match_id;
  host_name := coalesce(public._public_name(row.host_id), 'Friend');
  guest_name := coalesce(public._public_name(row.guest_id), 'Friend');
  if row.host_score = row.guest_score then
    host_body := 'It''s a tie';
    guest_body := 'It''s a tie';
  elsif row.host_score > row.guest_score then
    host_body := 'You win';
    guest_body := host_name || ' beat you by ' || (row.host_score - row.guest_score)::text;
  else
    guest_body := 'You win';
    host_body := guest_name || ' beat you by ' || (row.guest_score - row.host_score)::text;
  end if;
  insert into public.inbox (recipient_id, kind, from_id, from_name, body, payload)
  values (row.host_id, 'result', row.guest_id, left(guest_name, 24), host_body, jsonb_build_object('match', match_id));
  if row.guest_id is not null then
    insert into public.inbox (recipient_id, kind, from_id, from_name, body, payload)
    values (row.guest_id, 'result', row.host_id, left(host_name, 24), guest_body, jsonb_build_object('match', match_id));
  end if;
  return jsonb_build_object('ok', true, 'done', true);
end $$;

-- Device link ---------------------------------------------------------------
create or replace function public.device_link_start(label text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  code text;
  token text;
  exp timestamptz := now() + interval '5 minutes';
begin
  if auth.uid() is null then return jsonb_build_object('ok', false); end if;
  code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  token := encode(extensions.gen_random_bytes(16), 'hex');
  insert into public.device_links (player_id, code_hash, token_hash, expires_at)
  values (auth.uid(), encode(extensions.digest(code, 'sha256'), 'hex'), encode(extensions.digest(token, 'sha256'), 'hex'), exp);
  insert into public.linked_devices (player_id, label)
  values (auth.uid(), left(coalesce(nullif(btrim(label), ''), 'This device'), 80));
  return jsonb_build_object('ok', true, 'code', code, 'token', token, 'expires', exp);
end $$;

-- Redeem is service-role only. The Netlify function checks the hash, then mints a session.
create or replace function public.device_link_redeem(secret text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  row public.device_links%rowtype;
  hashed text;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    raise exception 'forbidden';
  end if;
  if secret is null or char_length(secret) < 6 or char_length(secret) > 64 then
    return jsonb_build_object('ok', false, 'error', 'bad');
  end if;
  hashed := encode(extensions.digest(secret, 'sha256'), 'hex');
  select * into row from public.device_links
  where (code_hash = hashed or token_hash = hashed) and used_at is null
  order by created_at desc
  limit 1
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'unknown');
  end if;
  if row.expires_at < now() or row.attempts >= 8 then
    update public.device_links set attempts = attempts + 1 where id = row.id;
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;
  update public.device_links set used_at = now(), attempts = attempts + 1 where id = row.id;
  return jsonb_build_object('ok', true, 'player_id', row.player_id);
end $$;

-- A wrong code still burns an attempt on the newest open link for that hash only.
-- Wrong guesses do not match a row, so also count them on the caller's latest link
-- when the Netlify function passes the link id. Kept simple: 8 misses lock THAT code
-- only after a matching hash... Add a counter bump for unknown secrets per player
-- is not possible without a match. The function below records a miss when the
-- hash matches but we still increment before success. Unknown codes return unknown
-- without locking every player. The Netlify function rate-limits by IP in memory too.

create or replace function public.device_link_miss(secret text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  row public.device_links%rowtype;
  hashed text;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    raise exception 'forbidden';
  end if;
  hashed := encode(extensions.digest(coalesce(secret, ''), 'sha256'), 'hex');
  select * into row from public.device_links
  where code_hash = hashed or token_hash = hashed
  order by created_at desc limit 1
  for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'unknown'); end if;
  update public.device_links set attempts = attempts + 1 where id = row.id;
  return jsonb_build_object('ok', false, 'error', case when row.attempts + 1 >= 8 or row.expires_at < now() then 'locked' else 'mismatch' end);
end $$;

-- Profile locks -------------------------------------------------------------
create or replace function public.set_profile_secret(kind text, secret text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  hashed text;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false); end if;
  if kind = 'pin' and secret !~ '^[0-9]{4}$' then return jsonb_build_object('ok', false, 'error', 'bad'); end if;
  if kind = 'picture' and (secret is null or char_length(secret) < 3 or char_length(secret) > 80) then
    return jsonb_build_object('ok', false, 'error', 'bad');
  end if;
  if secret is null or secret = '' then
    if kind = 'pin' then
      update public.profile_locks set pin_hash = null where player_id = auth.uid();
    else
      update public.profile_locks set picture_hash = null where player_id = auth.uid();
    end if;
    return jsonb_build_object('ok', true, 'cleared', true);
  end if;
  hashed := extensions.crypt(secret, extensions.gen_salt('bf', 6));
  insert into public.profile_locks (player_id, pin_hash, picture_hash)
  values (auth.uid(), case when kind = 'pin' then hashed end, case when kind = 'picture' then hashed end)
  on conflict (player_id) do update set
    pin_hash = case when kind = 'pin' then excluded.pin_hash else public.profile_locks.pin_hash end,
    picture_hash = case when kind = 'picture' then excluded.picture_hash else public.profile_locks.picture_hash end,
    fails = 0,
    locked_until = null;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.check_profile_secret(target uuid, kind text, secret text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  row public.profile_locks%rowtype;
  hashed text;
  good boolean;
begin
  select * into row from public.profile_locks where player_id = target for update;
  if not found then return jsonb_build_object('ok', true, 'open', true); end if;
  hashed := case when kind = 'picture' then row.picture_hash else row.pin_hash end;
  if hashed is null then return jsonb_build_object('ok', true, 'open', true); end if;
  if row.locked_until is not null and row.locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'locked', 'wait', extract(epoch from (row.locked_until - now()))::int);
  end if;
  good := hashed = extensions.crypt(secret, hashed);
  if good then
    update public.profile_locks set fails = 0, locked_until = null where player_id = target;
    return jsonb_build_object('ok', true);
  end if;
  update public.profile_locks set
    fails = fails + 1,
    locked_until = case when fails + 1 >= 5 then now() + interval '15 minutes' else null end
  where player_id = target;
  return jsonb_build_object('ok', false, 'error', 'wrong');
end $$;

-- Atomic coin spend ---------------------------------------------------------
create or replace function public._lock_balance(uid uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  bal integer;
begin
  insert into public.player_balances (player_id, balance) values (uid, 0)
  on conflict (player_id) do nothing;
  select balance into bal from public.player_balances where player_id = uid for update;
  return bal;
end $$;

create or replace function public.apply_coin_spend(op uuid, cost integer, item_type text, item_id text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  bal integer;
  prior jsonb;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'signed_out'); end if;
  if op is null or item_type is null or item_id is null
     or char_length(item_type) > 24 or char_length(item_id) > 80 or char_length(item_type) < 1 then
    return jsonb_build_object('ok', false, 'error', 'bad_item');
  end if;
  if cost is null or cost < 1 or cost > 50000 then
    return jsonb_build_object('ok', false, 'error', 'bad_cost');
  end if;
  select result into prior from public.coin_ops where op_id = op and player_id = uid;
  if found then return prior || jsonb_build_object('duplicate', true); end if;
  bal := public._lock_balance(uid);
  select result into prior from public.coin_ops where op_id = op;
  if found then return prior || jsonb_build_object('duplicate', true); end if;
  if exists (select 1 from public.player_items i where i.player_id = uid and i.item_type = apply_coin_spend.item_type and i.item_id = apply_coin_spend.item_id) then
    return jsonb_build_object('ok', false, 'error', 'bad_item', 'balance', bal);
  end if;
  if bal < cost then
    return jsonb_build_object('ok', false, 'error', 'insufficient', 'balance', bal);
  end if;
  -- Nested block: a unique clash rolls back the deduction and the grant together.
  begin
    update public.player_balances set balance = balance - cost, updated_at = now() where player_id = uid;
    insert into public.player_items (player_id, item_type, item_id, op_id)
    values (uid, item_type, item_id, op);
    prior := jsonb_build_object('ok', true, 'balance', bal - cost, 'item', item_type || ':' || item_id);
    insert into public.coin_ops (op_id, player_id, kind, cost, item_type, item_id, result)
    values (op, uid, 'spend', cost, item_type, item_id, prior);
    return prior;
  exception when unique_violation then
    select result into prior from public.coin_ops where op_id = op;
    if prior is not null then return prior || jsonb_build_object('duplicate', true); end if;
    return jsonb_build_object('ok', false, 'error', 'bad_item', 'balance', bal);
  end;
end $$;

create or replace function public.apply_coin_earn(op uuid, amount integer, reason text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  bal integer;
  prior jsonb;
  cap integer := 5000;
  recent integer;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'signed_out'); end if;
  if op is null or reason is null or char_length(reason) > 40 or reason = 'stripe' then
    return jsonb_build_object('ok', false, 'error', 'bad_item');
  end if;
  select result into prior from public.coin_ops where op_id = op and player_id = uid;
  if found then return prior || jsonb_build_object('duplicate', true); end if;
  if reason = 'opening' then cap := 50000; end if;
  if amount is null or amount < 1 or amount > cap then
    return jsonb_build_object('ok', false, 'error', 'bad_amount');
  end if;
  if reason = 'opening' and exists (select 1 from public.coin_ops where player_id = uid) then
    bal := public._lock_balance(uid);
    return jsonb_build_object('ok', true, 'duplicate', true, 'balance', bal);
  end if;
  select count(*) into recent from public.coin_ops
  where player_id = uid and kind = 'earn' and created_at > now() - interval '1 hour';
  if reason <> 'opening' and recent >= 100 then
    return jsonb_build_object('ok', false, 'error', 'rate');
  end if;
  bal := public._lock_balance(uid);
  begin
    update public.player_balances set balance = least(250000, balance + amount), updated_at = now() where player_id = uid;
    prior := jsonb_build_object('ok', true, 'balance', least(250000, bal + amount));
    insert into public.coin_ops (op_id, player_id, kind, amount, result)
    values (op, uid, 'earn', amount, prior);
    return prior;
  exception when unique_violation then
    select result into prior from public.coin_ops where op_id = op;
    return coalesce(prior, jsonb_build_object('ok', true, 'duplicate', true)) || jsonb_build_object('duplicate', true);
  end;
end $$;

-- Stripe credits. Service role only. Amounts are the website packs.
create or replace function public.apply_stripe_credit(player uuid, op text, amount integer)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  bal integer;
  prior jsonb;
  opu uuid;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    raise exception 'forbidden';
  end if;
  if amount not in (500, 1200, 3000) then
    return jsonb_build_object('ok', false, 'error', 'bad_amount');
  end if;
  opu := md5(op)::uuid;
  select result into prior from public.coin_ops where op_id = opu;
  if found then return prior || jsonb_build_object('duplicate', true); end if;
  bal := public._lock_balance(player);
  update public.player_balances set balance = least(250000, balance + amount), updated_at = now() where player_id = player;
  prior := jsonb_build_object('ok', true, 'balance', least(250000, bal + amount));
  insert into public.coin_ops (op_id, player_id, kind, amount, result)
  values (opu, player, 'stripe', amount, prior);
  return prior;
exception when unique_violation then
  select result into prior from public.coin_ops where op_id = opu;
  return coalesce(prior, jsonb_build_object('ok', true, 'duplicate', true));
end $$;

create or replace function public.coin_balance()
returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((select balance from public.player_balances where player_id = auth.uid()), 0)
$$;

-- Scores --------------------------------------------------------------------
create or replace function public.submit_score(
  op uuid,
  score integer,
  level integer,
  moves integer,
  time_seconds integer,
  mode text,
  puzzle_id text,
  daily_date date
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  recent integer;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false); end if;
  if op is not null and exists (select 1 from public.scores where op_id = op) then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;
  if score < 0 or score > 1000000 or level < 1 or level > 100 or moves < 0 or moves > 100000
     or time_seconds < 0 or time_seconds > 86400 or mode not in ('normal', 'trial', 'daily', 'endless', 'remix', 'other') then
    return jsonb_build_object('ok', false, 'error', 'bad_score');
  end if;
  if score > 200 and time_seconds < 1 then
    return jsonb_build_object('ok', false, 'error', 'bad_score');
  end if;
  select count(*) into recent from public.scores
  where player_id = auth.uid() and created_at > now() - interval '10 minutes';
  if recent >= 60 then return jsonb_build_object('ok', false, 'error', 'rate'); end if;
  insert into public.scores (player_id, op_id, score, level, moves, time_seconds, mode, puzzle_id, daily_date)
  values (auth.uid(), op, score, level, moves, time_seconds, mode, left(puzzle_id, 80), daily_date);
  return jsonb_build_object('ok', true);
exception when unique_violation then
  return jsonb_build_object('ok', true, 'duplicate', true);
end $$;

-- Grants --------------------------------------------------------------------
revoke all on function public._pair(uuid, uuid) from public;
revoke all on function public._public_name(uuid) from public;
revoke all on function public._lock_balance(uuid) from public;
revoke all on function public.device_link_redeem(text) from public, anon, authenticated;
revoke all on function public.device_link_miss(text) from public, anon, authenticated;
revoke all on function public.apply_stripe_credit(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.device_link_redeem(text) to service_role;
grant execute on function public.device_link_miss(text) to service_role;
grant execute on function public.apply_stripe_credit(uuid, text, integer) to service_role;

grant execute on function public.ensure_player() to authenticated;
grant execute on function public.ensure_friend_code() to authenticated;
grant execute on function public.connect_friend_code(text) to authenticated;
grant execute on function public.request_friend(uuid, text) to authenticated;
grant execute on function public.respond_friend(bigint, boolean) to authenticated;
grant execute on function public.my_friends() to authenticated;
grant execute on function public.touch_presence(boolean) to authenticated;
grant execute on function public.friend_presence() to authenticated;
grant execute on function public.send_challenge(uuid, text, text, jsonb) to authenticated;
grant execute on function public.post_result(uuid, text, integer, integer) to authenticated;
grant execute on function public.send_live(uuid, text, text, text) to authenticated;
grant execute on function public.join_live(uuid) to authenticated;
grant execute on function public.finish_live(uuid, integer, integer) to authenticated;
grant execute on function public.device_link_start(text) to authenticated;
grant execute on function public.set_profile_secret(text, text) to authenticated;
grant execute on function public.check_profile_secret(uuid, text, text) to authenticated;
grant execute on function public.apply_coin_spend(uuid, integer, text, text) to authenticated;
grant execute on function public.apply_coin_earn(uuid, integer, text) to authenticated;
grant execute on function public.coin_balance() to authenticated;
grant execute on function public.submit_score(uuid, integer, integer, integer, integer, text, text, date) to authenticated;

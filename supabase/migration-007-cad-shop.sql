-- Canadian shop amounts for Roman's Game.
-- Run in the SQL editor AFTER migration-006-social.sql.
-- This project only. Safe to re-run. Do not run against a different project.
--
-- Allows the proposed CAD catalog:
--   500, 1400, 3200 coin packs
--   300 starter, 1000 adventurer, 2500 stable
-- The Starter Pack is once per account via player_items
-- (item_type = 'bundle', item_id = 'starter'), written by the service role.

alter table public.stripe_receipts drop constraint if exists stripe_receipts_coins_check;
alter table public.stripe_receipts
  add constraint stripe_receipts_coins_check
  check (coins in (5000, 8000, 14000, 32000));

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
  if amount not in (5000, 8000, 14000, 32000) then
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
  return coalesce(prior, jsonb_build_object('ok', true, 'duplicate', true)) || jsonb_build_object('duplicate', true);
end $$;

revoke all on function public.apply_stripe_credit(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.apply_stripe_credit(uuid, text, integer) to service_role;

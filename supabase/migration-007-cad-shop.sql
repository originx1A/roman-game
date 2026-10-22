-- Canadian shop amounts for Roman's Game.
-- Run in the SQL editor AFTER migration-006-social.sql.
-- This project only. Safe to re-run. Do not run against a different project.
--
-- Coin grants this check allows:
--   5000, 14000, 32000 coin packs
--   8000 starter coins, every time
-- A Starter can be bought again. The price steps up per receiving account
-- (C$2.99, C$3.49, then C$4.49; US$1.49, US$1.99, then US$2.49).
-- This file does not store the price or the 5 treats. It only allows the coin amount.

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

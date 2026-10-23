-- Roman's Game · migration 015 · auto-named accounts
--
-- Do not run this from the app. Tony pastes it once. A second paste is safe.
-- Migration 014 is already applied. This only adds auto_named on account_flags.
-- It does not retype or drop any column. It does not write players.age_13_plus.
-- The confirmation trigger does not freeze auto_named, so picking a player name can clear it.

alter table public.account_flags
  add column if not exists auto_named boolean not null default false;

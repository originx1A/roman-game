-- NOT APPLIED. Do not run this file.
-- Do not run it on oelsglmfkpzbueqysvdm or wnczzbjxohharwnjrdia.
-- The game calls the service role only when ACCOUNT_LEDGER_ENABLED=1,
-- and it stops if this table is missing so a live account row is not deleted early.
--
-- Account deletion keeps:
--   coin_ledger       purchase and tax rows for 6 years. No name, no email.
--                     user_id has no foreign key, so deleting the player does not delete it.
--   account_deletions consent proof for 3 years after deletion. No name, no email.
--
-- Account deletion removes, in the server function:
--   scores, player_saves, purchase_pins, the players row, and the auth user.

create table if not exists public.account_deletions (
  user_id uuid primary key,
  deleted_at timestamptz not null default now(),
  privacy_version text,
  terms_version text,
  policy_consented_at timestamptz,
  guardian_consent boolean,
  consent_type text,
  retain_consent_until timestamptz not null default (now() + interval '3 years')
);

alter table public.account_deletions enable row level security;
revoke all on public.account_deletions from anon, authenticated;

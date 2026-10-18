-- NOT APPLIED. Do not run against a live project.
-- Especially do not run this on oelsglmfkpzbueqysvdm or wnczzbjxohharwnjrdia
-- until the owner has reviewed it and chosen to apply it.
--
-- One shared account (romansgame.com and the game) records acceptance of the
-- shared Privacy Policy and Terms of Use. Versions match the policy headers:
-- privacy 2026-10-18, terms of use 2026-10-18, terms of purchase 2026-10-18.
--
-- privacy_version           Privacy Policy version accepted at sign-up
-- terms_version             Terms of Use version accepted at sign-up
-- purchase_terms_version    Terms of Purchase version accepted at checkout
-- policy_consented_at       when they checked the sign-up consent box
-- guardian_consent          true when a parent or guardian accepted for a player under 13
-- consent_type              terms_privacy_13plus or terms_privacy_parent
--
-- The live players insert rule still requires age_13_plus = true. This file
-- does not change that rule. A parent agreeing for a younger player is
-- recorded in guardian_consent, not by writing age_13_plus = false.
--
-- Clients cannot write these columns. The server writes them with the service
-- role, and only when ACCOUNT_LEDGER_ENABLED=1, after this file is applied.
-- Until both of those happen, the timestamp and versions stay on the device.

alter table public.players add column if not exists privacy_version text;
alter table public.players add column if not exists terms_version text;
alter table public.players add column if not exists purchase_terms_version text;
alter table public.players add column if not exists policy_consented_at timestamptz;
alter table public.players add column if not exists guardian_consent boolean not null default false;
alter table public.players add column if not exists consent_type text;

-- Keep the existing column insert list. New columns are not on it, so the
-- game client cannot fill them even after this file is applied.
revoke insert on public.players from authenticated;
grant insert (id, display_name, age_13_plus, marketing_opt_in) on public.players to authenticated;

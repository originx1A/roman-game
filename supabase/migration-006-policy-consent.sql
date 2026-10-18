-- NOT APPLIED. Draft for owner review. Do not run against a live project.
-- Especially do not run this on oelsglmfkpzbueqysvdm or wnczzbjxohharwnjrdia
-- until the owner has reviewed it and chosen to apply it.
--
-- One shared account (romansgame.com and the game) records acceptance of the
-- shared Privacy Policy and Terms of Use.
-- Terms of Purchase stay game-only and are not stored here.
--
-- policy_version        text id of the policy pair that was accepted.
--                       The current placeholder is 2026-10-18-draft.
-- policy_consented_at   when they checked "I agree to the Terms and Privacy Policy"
-- guardian_consent      true when a parent or guardian accepted for a player under 13
--
-- The live players insert rule still requires age_13_plus = true. This file
-- does not change that rule. A parent agreeing for a younger player is
-- recorded in guardian_consent, not by writing age_13_plus = false.
--
-- Clients cannot write these columns. The server writes them with the service
-- role, and only when ACCOUNT_LEDGER_ENABLED=1, after this file is applied.
-- Until both of those happen, the timestamp and version stay on the device.

alter table public.players add column if not exists policy_version text;
alter table public.players add column if not exists policy_consented_at timestamptz;
alter table public.players add column if not exists guardian_consent boolean not null default false;

-- Keep the existing column insert list. New columns are not on it, so the
-- game client cannot fill them even after this file is applied.
revoke insert on public.players from authenticated;
grant insert (id, display_name, age_13_plus, marketing_opt_in) on public.players to authenticated;

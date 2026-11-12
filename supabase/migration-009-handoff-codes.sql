-- One-time cross-origin sign-in handoff (Tony, Nov 12, 2026):
-- sign in once, anywhere, and it works everywhere. romansgame.com
-- and play.romansgame.com are different origins with separate
-- localStorage, so the origin where the user signed in mints a
-- 5-minute single-use code and the other origin trades it for a
-- session pair via /api/auth/handoff/mint + /api/auth/handoff/redeem.
--
-- Numbered 009 to follow migration-008 (accounts-payments), which
-- defines the purchase_reauths table this mirrors: only the SHA-256
-- of the code is stored, the session pair is deleted the moment the
-- code is consumed. NO token ever goes in a URL.
--
-- APPLY IN THE SUPABASE SQL EDITOR (project "romans-game",
-- oelsglmfkpzbueqysvdm) — PostgREST cannot run DDL, and this file
-- is staged only. Until this table exists, mint returns 503 and the
-- live cross-origin round-trip cannot be proven.
create table if not exists public.handoff_codes (
  code_hash text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.handoff_codes enable row level security;
revoke all on public.handoff_codes from anon, authenticated;
grant all on public.handoff_codes to service_role;

create index if not exists handoff_codes_expires_at
  on public.handoff_codes (expires_at);

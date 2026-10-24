-- Roman's Game rewrite. NOT APPLIED.
-- Tony: review this file before anyone runs it on the romans-game Supabase project.
-- The preview stores accounts in Netlify Blobs so this SQL is not required to test the preview.
-- Existing migrations 002-012 stay as they are. Do not edit them.

-- Accounts for name + password sign-in, recovery email, and the saved age answer.
create table if not exists public.rg_accounts (
  id uuid primary key,
  login_key text not null unique,
  player_name text not null,
  email text,
  email_verified boolean not null default false,
  pass_hash text not null,
  pass_salt text not null,
  recovery_hash text,
  recovery_salt text,
  age_gate text check (age_gate in ('over', 'under')),
  wins integer not null default 0,
  coins integer not null default 0,
  starter_owned boolean not null default false,
  buying_stopped boolean not null default false,
  holder boolean not null default false,
  holder_id uuid,
  created_at timestamptz not null default now()
);

-- Family approval links. Expire after 7 days in application code.
create table if not exists public.rg_approvals (
  token text primary key,
  player_id uuid not null,
  holder_email text not null,
  status text not null check (status in ('pending', 'approved', 'declined', 'expired')),
  created_at timestamptz not null default now()
);

-- Orders. Coins are the only cash item. Amounts stay null until the coin chart.
create table if not exists public.rg_orders (
  id uuid primary key,
  account_id uuid not null,
  sku text not null,
  cents integer not null,
  currency text not null check (currency in ('cad', 'usd')),
  status text not null,
  terms_version text not null,
  accepted_at timestamptz,
  paid_at timestamptz,
  stripe_session text
);

-- Challenge links (/c/<code>) and teams (/t/<code>).
create table if not exists public.rg_challenges (
  code text primary key,
  puzzle jsonb not null,
  sender_name text not null,
  sender_seconds integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.rg_teams (
  id uuid primary key,
  code text not null unique,
  name text not null,
  mascot text not null,
  open_join boolean not null default false,
  closed boolean not null default false,
  created_at timestamptz not null default now()
);

-- Consent records: join, family approval, and the purchase Accept step.
create table if not exists public.rg_consent (
  id bigint generated always as identity primary key,
  account_id uuid,
  kind text not null,
  version text not null,
  at timestamptz not null default now()
);

alter table public.rg_accounts enable row level security;
alter table public.rg_approvals enable row level security;
alter table public.rg_orders enable row level security;
alter table public.rg_challenges enable row level security;
alter table public.rg_teams enable row level security;
alter table public.rg_consent enable row level security;

-- No anon policies. The game server uses the service role after this migration is approved.
revoke all on public.rg_accounts, public.rg_approvals, public.rg_orders, public.rg_challenges, public.rg_teams, public.rg_consent from anon, authenticated;

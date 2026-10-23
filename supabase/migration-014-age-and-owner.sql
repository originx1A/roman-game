-- Roman's Game · migration 014 · age choice, parent-email hold, payment owner
--
-- Do not run this from the app. Tony pastes it once. A second paste is safe.
--
-- New tables only, plus three columns on account_flags. Tony asked for the
-- owner flag, the time it was set, and the email Stripe collected, on
-- account_flags. No column from migrations 001–013 is retyped or dropped.
-- players.age_13_plus is not written.
--
-- The 013 confirmation trigger does not freeze the new owner columns, so
-- taking the card off can clear them. Payment evidence rows are append-only.

-- 1. Age. No row means unanswered. The choice cannot be flipped. -------------
create table if not exists public.age_choices (
  user_id uuid primary key references auth.users(id) on delete cascade,
  choice text not null check (choice in ('13_plus', 'under_13')),
  chosen_at timestamptz not null default now()
);
alter table public.age_choices enable row level security;
drop policy if exists "age: read own" on public.age_choices;
create policy "age: read own" on public.age_choices
  for select to authenticated using (user_id = auth.uid());
revoke all on public.age_choices from anon, authenticated;
grant select on public.age_choices to authenticated;
grant all on public.age_choices to service_role;

create or replace function public.age_choices_keep()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.choice is not null then
    new.choice := old.choice;
    new.chosen_at := old.chosen_at;
  end if;
  return new;
end;
$$;
revoke all on function public.age_choices_keep() from public, anon, authenticated;
grant execute on function public.age_choices_keep() to service_role;
drop trigger if exists age_choices_keep on public.age_choices;
create trigger age_choices_keep
  before update on public.age_choices
  for each row execute function public.age_choices_keep();

-- 2. Under-13 parent email, held off account_recovery until the link is opened.
create table if not exists public.parent_email_holds (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references auth.users(id) on delete cascade,
  parent_email text not null check (char_length(parent_email) between 6 and 120),
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  approved_at timestamptz
);
create index if not exists parent_email_holds_child_idx on public.parent_email_holds (child_id);
alter table public.parent_email_holds enable row level security;
revoke all on public.parent_email_holds from anon, authenticated;
grant all on public.parent_email_holds to service_role;

-- 3. Owner flag on the existing flags row. Null means kid mode. --------------
alter table public.account_flags add column if not exists owner_role text;
alter table public.account_flags add column if not exists owner_assumed_at timestamptz;
alter table public.account_flags add column if not exists owner_email text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'account_flags_owner_role') then
    alter table public.account_flags
      add constraint account_flags_owner_role
      check (owner_role is null or owner_role = 'adult');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'account_flags_owner_email_len') then
    alter table public.account_flags
      add constraint account_flags_owner_email_len
      check (owner_email is null or char_length(owner_email) between 6 and 120);
  end if;
end $$;

-- 4. Stripe evidence for disputes. Timestamps and device. Not the card number.
create table if not exists public.payment_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('attached', 'detached')),
  stripe_event_id text unique,
  stripe_payment_method_id text,
  stripe_customer_id text,
  occurred_at timestamptz not null,
  device_ua_hash text,
  device_ua text,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists payment_evidence_customer_idx
  on public.payment_evidence (stripe_customer_id, occurred_at desc);
alter table public.payment_evidence enable row level security;
revoke all on public.payment_evidence from anon, authenticated;
grant all on public.payment_evidence to service_role;

create or replace function public.payment_evidence_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'payment_evidence is append-only' using errcode = '55000';
end;
$$;
revoke all on function public.payment_evidence_append_only() from public, anon, authenticated;
grant execute on function public.payment_evidence_append_only() to service_role;
drop trigger if exists payment_evidence_append_only on public.payment_evidence;
create trigger payment_evidence_append_only
  before update or delete on public.payment_evidence
  for each row execute function public.payment_evidence_append_only();

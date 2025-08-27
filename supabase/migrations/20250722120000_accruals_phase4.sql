-- Phase 4: Accruals automation schema
-- Creates core tables for accrual candidates, entries, rules, and audit
-- Note: Use existing auth.users and public.clients tables for FK references

create table if not exists public.accrual_candidates (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  vendor_id uuid,
  period date not null,
  suggested_amount numeric(12,2) not null,
  confidence real,
  reason text,
  evidence jsonb default '{}'::jsonb,
  status text not null check (status in ('proposed','approved','accrued','reversed')) default 'proposed',
  expense_account text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists accrual_candidates_client_period_idx on public.accrual_candidates (client_id, period);

create table if not exists public.accrual_entries (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.accrual_candidates(id) on delete cascade,
  je_id uuid, -- reference to journal_entries.id when posted (nullable until posted)
  period_end_date date not null,
  amount numeric(12,2) not null,
  posted_at timestamptz,
  reversed_entry_id uuid references public.accrual_entries(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists accrual_entries_candidate_idx on public.accrual_entries (candidate_id);

create table if not exists public.accrual_rules (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  vendor_id uuid,
  method text not null check (method in ('recurring','contract','variance')),
  params jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  success_count int not null default 0,
  failure_count int not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists accrual_rules_client_vendor_idx on public.accrual_rules (client_id, vendor_id);

create table if not exists public.accrual_audit (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.accrual_candidates(id) on delete cascade,
  action text not null,
  actor_id uuid references auth.users(id),
  at timestamptz not null default now(),
  details jsonb default '{}'::jsonb
);

-- Basic RLS (mirrors existing pattern: enable and require client ownership)
alter table public.accrual_candidates enable row level security;
alter table public.accrual_entries enable row level security;
alter table public.accrual_rules enable row level security;
alter table public.accrual_audit enable row level security;

create policy if not exists accrual_candidates_isolation on public.accrual_candidates
  using (client_id in (select id from public.clients where user_id = auth.uid()));

create policy if not exists accrual_entries_isolation on public.accrual_entries
  using (candidate_id in (select id from public.accrual_candidates where client_id in (select id from public.clients where user_id = auth.uid())));

create policy if not exists accrual_rules_isolation on public.accrual_rules
  using (client_id in (select id from public.clients where user_id = auth.uid()));

create policy if not exists accrual_audit_isolation on public.accrual_audit
  using (candidate_id is null or candidate_id in (select id from public.accrual_candidates where client_id in (select id from public.clients where user_id = auth.uid())));

-- Updated at trigger for accrual_candidates
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;$$;

drop trigger if exists trg_accrual_candidates_updated_at on public.accrual_candidates;
create trigger trg_accrual_candidates_updated_at before update on public.accrual_candidates
for each row execute function public.set_updated_at();



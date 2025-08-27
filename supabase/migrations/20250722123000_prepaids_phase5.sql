-- Phase 5: Prepaid expenses tables

create table if not exists public.prepaid_schedules (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  vendor_id uuid,
  source_tx_id uuid,
  asset_account text not null default 'Assets:Prepaid',
  expense_account text not null default 'Expenses:Prepaid Amortization',
  start_date date not null,
  end_date date not null,
  total_amount numeric(12,2) not null,
  remaining_amount numeric(12,2) not null,
  frequency text not null default 'monthly',
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists public.prepaid_entries (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.prepaid_schedules(id) on delete cascade,
  period_date date not null,
  amount numeric(12,2) not null,
  je_id uuid,
  posted_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled','posted','skipped'))
);

alter table public.prepaid_schedules enable row level security;
alter table public.prepaid_entries enable row level security;

create policy if not exists prepaids_isolation on public.prepaid_schedules
  using (client_id in (select id from public.clients where user_id = auth.uid()));

create policy if not exists prepaids_entries_isolation on public.prepaid_entries
  using (schedule_id in (select id from public.prepaid_schedules where client_id in (select id from public.clients where user_id = auth.uid())));



-- Minimal journal tables to support accrual postings (idempotent)

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  date date not null,
  memo text,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.journal_entries(id) on delete cascade,
  account text not null,
  debit numeric(12,2) not null default 0,
  credit numeric(12,2) not null default 0,
  description text
);

create index if not exists jel_entry_idx on public.journal_entry_lines (journal_entry_id);

alter table public.journal_entries enable row level security;
alter table public.journal_entry_lines enable row level security;

create policy if not exists journal_entries_isolation on public.journal_entries
  using (client_id in (select id from public.clients where user_id = auth.uid()));

create policy if not exists journal_entry_lines_isolation on public.journal_entry_lines
  using (journal_entry_id in (select id from public.journal_entries where client_id in (select id from public.clients where user_id = auth.uid())));



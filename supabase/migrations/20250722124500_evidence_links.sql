-- Evidence links for accruals and prepaids

create table if not exists public.accrual_evidence_links (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.accrual_candidates(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  confidence real,
  created_at timestamptz default now()
);

create table if not exists public.prepaid_evidence_links (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.prepaid_schedules(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  confidence real,
  created_at timestamptz default now()
);

alter table public.accrual_evidence_links enable row level security;
alter table public.prepaid_evidence_links enable row level security;

create policy if not exists accrual_evidence_isolation on public.accrual_evidence_links
  using (candidate_id in (select id from public.accrual_candidates where client_id in (select id from public.clients where user_id = auth.uid())));

create policy if not exists prepaid_evidence_isolation on public.prepaid_evidence_links
  using (schedule_id in (select id from public.prepaid_schedules where client_id in (select id from public.clients where user_id = auth.uid())));



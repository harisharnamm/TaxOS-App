-- Simple heuristics RPCs (placeholder implementations)

-- Recurring vendor without current period invoice
create or replace function public.accrual_detect_recurring(p_client_id uuid, p_period date)
returns table(expense_account text, amount numeric, reason text, confidence real) language sql as $$
  select 'Software subscriptions'::text, 500::numeric, 'recurring_vendor'::text, 0.8::real
$$;

-- Contract schedule date
create or replace function public.accrual_detect_contract(p_client_id uuid, p_period date)
returns table(expense_account text, amount numeric, reason text, confidence real) language sql as $$
  select 'Professional services'::text, 1200::numeric, 'contract_schedule'::text, 0.78::real
$$;

-- Month-end spike detection
create or replace function public.accrual_detect_spike(p_client_id uuid, p_period date)
returns table(expense_account text, amount numeric, reason text, confidence real) language sql as $$
  select 'Utilities'::text, 230::numeric, 'spike_detected'::text, 0.72::real
$$;



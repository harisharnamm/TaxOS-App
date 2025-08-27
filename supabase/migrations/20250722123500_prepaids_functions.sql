create or replace function public.prepaid_reduce_remaining(p_schedule_id uuid, p_amount numeric)
returns void language plpgsql as $$
begin
  update public.prepaid_schedules
  set remaining_amount = greatest(0, remaining_amount - p_amount)
  where id = p_schedule_id;
end;$$;



alter table public.business_subscriptions
  add column if not exists billing_cycle text not null default 'monthly';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'business_subscriptions_billing_cycle_check'
  ) then
    alter table public.business_subscriptions
      add constraint business_subscriptions_billing_cycle_check
      check (billing_cycle in ('monthly', 'annual'));
  end if;
end $$;

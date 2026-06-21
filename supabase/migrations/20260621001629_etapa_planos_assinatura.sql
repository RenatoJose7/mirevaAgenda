create table if not exists public.subscription_plans (
  id text primary key,
  name text not null,
  description text not null,
  price_cents integer not null,
  max_professionals integer not null,
  max_services integer not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_plans_id_check check (id in ('basic', 'plus', 'business')),
  constraint subscription_plans_name_not_blank check (length(trim(name)) > 0),
  constraint subscription_plans_description_not_blank check (length(trim(description)) > 0),
  constraint subscription_plans_price_cents_check check (price_cents >= 0),
  constraint subscription_plans_max_professionals_check check (max_professionals > 0),
  constraint subscription_plans_max_services_check check (max_services > 0)
);

insert into public.subscription_plans (
  id,
  name,
  description,
  price_cents,
  max_professionals,
  max_services,
  sort_order
)
values
  ('basic', 'Basico', 'Para autonomos que precisam de uma agenda simples.', 1500, 1, 5, 1),
  ('plus', 'Plus', 'Para pequenas equipes com mais profissionais e servicos.', 3000, 5, 20, 2),
  ('business', 'Business', 'Para negocios com operacao maior e mais capacidade.', 5990, 15, 60, 3)
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  price_cents = excluded.price_cents,
  max_professionals = excluded.max_professionals,
  max_services = excluded.max_services,
  sort_order = excluded.sort_order,
  updated_at = now();

create table if not exists public.business_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  plan_id text not null references public.subscription_plans(id),
  status text not null default 'trialing',
  max_professionals integer not null,
  max_services integer not null,
  current_period_started_at timestamptz,
  current_period_ends_at timestamptz,
  trial_ends_at timestamptz,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_subscriptions_business_unique unique (business_id),
  constraint business_subscriptions_status_check
    check (status in ('trialing', 'pending', 'active', 'canceled', 'past_due')),
  constraint business_subscriptions_plan_check check (plan_id in ('basic', 'plus', 'business')),
  constraint business_subscriptions_max_professionals_check check (max_professionals > 0),
  constraint business_subscriptions_max_services_check check (max_services > 0),
  constraint business_subscriptions_provider_not_blank check (provider is null or length(trim(provider)) > 0),
  constraint business_subscriptions_provider_customer_not_blank check (
    provider_customer_id is null or length(trim(provider_customer_id)) > 0
  ),
  constraint business_subscriptions_provider_subscription_not_blank check (
    provider_subscription_id is null or length(trim(provider_subscription_id)) > 0
  )
);

create index if not exists business_subscriptions_business_id_idx
on public.business_subscriptions (business_id);

create index if not exists business_subscriptions_plan_status_idx
on public.business_subscriptions (plan_id, status);

create trigger subscription_plans_set_updated_at
before update on public.subscription_plans
for each row execute function public.set_updated_at();

create trigger business_subscriptions_set_updated_at
before update on public.business_subscriptions
for each row execute function public.set_updated_at();

create or replace function private.apply_subscription_plan_limits()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_plan public.subscription_plans;
begin
  select *
  into selected_plan
  from public.subscription_plans
  where id = new.plan_id
    and is_active = true;

  if selected_plan.id is null then
    raise exception 'Plano invalido ou inativo.';
  end if;

  new.max_professionals := selected_plan.max_professionals;
  new.max_services := selected_plan.max_services;

  return new;
end;
$$;

drop trigger if exists business_subscriptions_apply_plan_limits on public.business_subscriptions;

create trigger business_subscriptions_apply_plan_limits
before insert or update of plan_id on public.business_subscriptions
for each row execute function private.apply_subscription_plan_limits();

insert into public.business_subscriptions (
  business_id,
  plan_id,
  status,
  max_professionals,
  max_services
)
select
  b.id,
  'basic',
  'trialing',
  p.max_professionals,
  p.max_services
from public.businesses b
cross join public.subscription_plans p
where p.id = 'basic'
  and not exists (
    select 1
    from public.business_subscriptions bs
    where bs.business_id = b.id
  );

alter table public.subscription_plans enable row level security;
alter table public.business_subscriptions enable row level security;

create policy "subscription_plans_select_active"
on public.subscription_plans
for select
to authenticated
using (is_active = true);

create policy "business_subscriptions_select_member"
on public.business_subscriptions
for select
to authenticated
using (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = business_subscriptions.business_id
      and bm.user_id = (select auth.uid())
  )
);

grant select on public.subscription_plans to authenticated;
grant select on public.business_subscriptions to authenticated;

grant select, insert, update, delete on public.subscription_plans to service_role;
grant select, insert, update, delete on public.business_subscriptions to service_role;

revoke all on public.subscription_plans from anon;
revoke all on public.business_subscriptions from anon;

revoke execute on function private.apply_subscription_plan_limits() from public;
revoke execute on function private.apply_subscription_plan_limits() from anon;
revoke execute on function private.apply_subscription_plan_limits() from authenticated;

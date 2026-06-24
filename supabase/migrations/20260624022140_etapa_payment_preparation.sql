alter table public.business_subscriptions
  add column if not exists provider_plan_id text,
  add column if not exists provider_checkout_id text,
  add column if not exists provider_payment_method text,
  add column if not exists provider_status text,
  add column if not exists started_at timestamptz,
  add column if not exists renews_at timestamptz,
  add column if not exists cancel_requested_at timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.business_subscriptions
set
  started_at = coalesce(started_at, current_period_started_at),
  renews_at = coalesce(renews_at, current_period_ends_at)
where started_at is null
  or renews_at is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'business_subscriptions_provider_plan_not_blank'
  ) then
    alter table public.business_subscriptions
      add constraint business_subscriptions_provider_plan_not_blank
      check (provider_plan_id is null or length(trim(provider_plan_id)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'business_subscriptions_provider_checkout_not_blank'
  ) then
    alter table public.business_subscriptions
      add constraint business_subscriptions_provider_checkout_not_blank
      check (provider_checkout_id is null or length(trim(provider_checkout_id)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'business_subscriptions_provider_payment_method_not_blank'
  ) then
    alter table public.business_subscriptions
      add constraint business_subscriptions_provider_payment_method_not_blank
      check (provider_payment_method is null or length(trim(provider_payment_method)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'business_subscriptions_provider_status_not_blank'
  ) then
    alter table public.business_subscriptions
      add constraint business_subscriptions_provider_status_not_blank
      check (provider_status is null or length(trim(provider_status)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'business_subscriptions_metadata_object'
  ) then
    alter table public.business_subscriptions
      add constraint business_subscriptions_metadata_object
      check (jsonb_typeof(metadata) = 'object');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'business_subscriptions_cycle_dates_order'
  ) then
    alter table public.business_subscriptions
      add constraint business_subscriptions_cycle_dates_order
      check (
        (started_at is null or renews_at is null or renews_at >= started_at)
        and (started_at is null or canceled_at is null or canceled_at >= started_at)
        and (started_at is null or cancel_requested_at is null or cancel_requested_at >= started_at)
      );
  end if;
end;
$$;

create index if not exists business_subscriptions_provider_customer_idx
on public.business_subscriptions (provider, provider_customer_id)
where provider_customer_id is not null;

create index if not exists business_subscriptions_provider_subscription_idx
on public.business_subscriptions (provider, provider_subscription_id)
where provider_subscription_id is not null;

create index if not exists business_subscriptions_status_renews_idx
on public.business_subscriptions (status, renews_at);

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text,
  event_type text not null,
  business_id uuid references public.businesses(id) on delete set null,
  subscription_id uuid references public.business_subscriptions(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  headers jsonb not null default '{}'::jsonb,
  signature_hash text,
  processing_status text not null default 'received',
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_webhook_events_provider_not_blank check (length(trim(provider)) > 0),
  constraint payment_webhook_events_provider_event_not_blank check (
    provider_event_id is null or length(trim(provider_event_id)) > 0
  ),
  constraint payment_webhook_events_event_type_not_blank check (length(trim(event_type)) > 0),
  constraint payment_webhook_events_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint payment_webhook_events_headers_object check (jsonb_typeof(headers) = 'object'),
  constraint payment_webhook_events_signature_hash_not_blank check (
    signature_hash is null or length(trim(signature_hash)) > 0
  ),
  constraint payment_webhook_events_processing_status_check
    check (processing_status in ('received', 'ignored', 'processed', 'failed')),
  constraint payment_webhook_events_processed_at_check
    check (processed_at is null or processed_at >= received_at)
);

create unique index if not exists payment_webhook_events_provider_event_unique
on public.payment_webhook_events (provider, provider_event_id)
where provider_event_id is not null;

create index if not exists payment_webhook_events_subscription_idx
on public.payment_webhook_events (subscription_id, received_at desc);

create index if not exists payment_webhook_events_status_idx
on public.payment_webhook_events (processing_status, received_at);

drop trigger if exists payment_webhook_events_set_updated_at on public.payment_webhook_events;

create trigger payment_webhook_events_set_updated_at
before update on public.payment_webhook_events
for each row execute function public.set_updated_at();

alter table public.payment_webhook_events enable row level security;

revoke all on public.payment_webhook_events from anon;
revoke all on public.payment_webhook_events from authenticated;
grant select, insert, update, delete on public.payment_webhook_events to service_role;

notify pgrst, 'reload schema';

alter table public.professional_booking_settings
add column if not exists cancellation_notice_minutes integer not null default 1440,
add column if not exists reschedule_notice_minutes integer not null default 1440;

alter table public.professional_booking_settings
drop constraint if exists professional_booking_settings_cancellation_notice_check;

alter table public.professional_booking_settings
add constraint professional_booking_settings_cancellation_notice_check
check (cancellation_notice_minutes >= 0 and reschedule_notice_minutes >= 0);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  whatsapp text not null,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_name_not_blank check (length(trim(name)) >= 2),
  constraint customers_whatsapp_not_blank check (length(trim(whatsapp)) >= 8),
  constraint customers_email_length_check check (email is null or length(trim(email)) <= 160),
  constraint customers_unique_whatsapp unique (business_id, whatsapp)
);

alter table public.appointments
add column if not exists customer_id uuid references public.customers(id) on delete set null,
add column if not exists customer_note text,
add column if not exists internal_note text,
add column if not exists cancel_token text unique,
add column if not exists reschedule_token text unique,
add column if not exists cancelled_at timestamptz;

alter table public.appointments
alter column customer_name set not null,
alter column customer_whatsapp set not null,
alter column source set default 'public';

alter table public.appointments
drop constraint if exists appointments_status_check;

alter table public.appointments
add constraint appointments_status_check check (status in ('pending', 'confirmed', 'cancelled', 'no_show', 'completed'));

alter table public.appointments
drop constraint if exists appointments_source_check;

alter table public.appointments
add constraint appointments_source_check check (source in ('public', 'internal'));

alter table public.appointments
drop constraint if exists appointments_customer_note_length_check;

alter table public.appointments
add constraint appointments_customer_note_length_check check (customer_note is null or length(trim(customer_note)) <= 500);

alter table public.appointments
drop constraint if exists appointments_internal_note_length_check;

alter table public.appointments
add constraint appointments_internal_note_length_check check (internal_note is null or length(trim(internal_note)) <= 500);

create table public.internal_notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint internal_notifications_type_check check (
    type in (
      'appointment_created',
      'appointment_cancelled',
      'appointment_rescheduled',
      'appointment_status_changed'
    )
  ),
  constraint internal_notifications_title_not_blank check (length(trim(title)) > 0),
  constraint internal_notifications_message_not_blank check (length(trim(message)) > 0)
);

create index customers_business_id_idx on public.customers (business_id);
create index appointments_customer_id_idx on public.appointments (customer_id);
create index appointments_cancel_token_idx on public.appointments (cancel_token) where cancel_token is not null;
create index appointments_reschedule_token_idx on public.appointments (reschedule_token) where reschedule_token is not null;
create index appointments_business_status_date_idx on public.appointments (business_id, status, appointment_date);
create index internal_notifications_business_read_idx on public.internal_notifications (business_id, is_read, created_at desc);
create index internal_notifications_appointment_id_idx on public.internal_notifications (appointment_id);

create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

create or replace function private.ensure_customer_business_match()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  customer_business_id uuid;
begin
  if new.customer_id is null then
    return new;
  end if;

  select business_id
  into customer_business_id
  from public.customers
  where id = new.customer_id;

  if customer_business_id is null or customer_business_id <> new.business_id then
    raise exception 'Cliente pertence a outro estabelecimento.';
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_customer_business_match on public.appointments;

create trigger appointments_customer_business_match
before insert or update on public.appointments
for each row execute function private.ensure_customer_business_match();

alter table public.customers enable row level security;
alter table public.internal_notifications enable row level security;

create policy "customers_select_member"
on public.customers
for select
to authenticated
using (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = customers.business_id
      and bm.user_id = (select auth.uid())
  )
);

create policy "customers_insert_member"
on public.customers
for insert
to authenticated
with check (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = customers.business_id
      and bm.user_id = (select auth.uid())
      and bm.role in ('owner', 'staff')
  )
);

create policy "customers_update_member"
on public.customers
for update
to authenticated
using (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = customers.business_id
      and bm.user_id = (select auth.uid())
      and bm.role in ('owner', 'staff')
  )
)
with check (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = customers.business_id
      and bm.user_id = (select auth.uid())
      and bm.role in ('owner', 'staff')
  )
);

create policy "internal_notifications_select_member"
on public.internal_notifications
for select
to authenticated
using (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = internal_notifications.business_id
      and bm.user_id = (select auth.uid())
  )
);

create policy "internal_notifications_insert_member"
on public.internal_notifications
for insert
to authenticated
with check (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = internal_notifications.business_id
      and bm.user_id = (select auth.uid())
      and bm.role in ('owner', 'staff')
  )
);

create policy "internal_notifications_update_member"
on public.internal_notifications
for update
to authenticated
using (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = internal_notifications.business_id
      and bm.user_id = (select auth.uid())
      and bm.role in ('owner', 'staff')
  )
)
with check (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = internal_notifications.business_id
      and bm.user_id = (select auth.uid())
      and bm.role in ('owner', 'staff')
  )
);

grant select, insert, update on public.customers to authenticated;
grant select, insert, update on public.internal_notifications to authenticated;

revoke execute on function private.ensure_customer_business_match() from public;
revoke execute on function private.ensure_customer_business_match() from anon;
revoke execute on function private.ensure_customer_business_match() from authenticated;

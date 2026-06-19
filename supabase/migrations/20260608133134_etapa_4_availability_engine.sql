create table public.professional_working_hours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  weekday integer not null,
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_working_hours_weekday_check check (weekday between 0 and 6),
  constraint professional_working_hours_time_check check (start_time < end_time)
);

create table public.professional_breaks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  weekday integer not null,
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_breaks_weekday_check check (weekday between 0 and 6),
  constraint professional_breaks_time_check check (start_time < end_time)
);

create table public.professional_booking_settings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  buffer_minutes integer not null default 0,
  minimum_notice_minutes integer not null default 0,
  booking_window_days integer not null default 60,
  slot_step_minutes integer not null default 15,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_booking_settings_unique_professional unique (professional_id),
  constraint professional_booking_settings_buffer_check check (buffer_minutes >= 0),
  constraint professional_booking_settings_notice_check check (minimum_notice_minutes >= 0),
  constraint professional_booking_settings_window_check check (booking_window_days between 1 and 365),
  constraint professional_booking_settings_step_check check (slot_step_minutes in (5, 10, 15, 20, 30, 60))
);

create table public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  block_date date not null,
  is_full_day boolean not null default false,
  start_time time,
  end_time time,
  reason text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_blocks_time_required_check check (
    (is_full_day = true and start_time is null and end_time is null)
    or
    (is_full_day = false and start_time is not null and end_time is not null and start_time < end_time)
  ),
  constraint schedule_blocks_reason_length_check check (reason is null or length(trim(reason)) <= 160)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  professional_service_id uuid references public.professional_services(id) on delete set null,
  customer_name text,
  customer_whatsapp text,
  customer_email text,
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'confirmed',
  source text not null default 'internal',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_time_check check (start_time < end_time),
  constraint appointments_status_check check (status in ('confirmed', 'cancelled', 'no_show', 'pending')),
  constraint appointments_source_check check (source in ('internal', 'public')),
  constraint appointments_customer_name_length_check check (customer_name is null or length(trim(customer_name)) <= 120),
  constraint appointments_customer_whatsapp_length_check check (customer_whatsapp is null or length(trim(customer_whatsapp)) <= 40),
  constraint appointments_customer_email_length_check check (customer_email is null or length(trim(customer_email)) <= 160),
  constraint appointments_notes_length_check check (notes is null or length(trim(notes)) <= 500)
);

create index professional_working_hours_business_id_idx on public.professional_working_hours (business_id);
create index professional_working_hours_professional_weekday_idx on public.professional_working_hours (professional_id, weekday) where is_active = true;
create index professional_breaks_business_id_idx on public.professional_breaks (business_id);
create index professional_breaks_professional_weekday_idx on public.professional_breaks (professional_id, weekday) where is_active = true;
create index professional_booking_settings_business_id_idx on public.professional_booking_settings (business_id);
create index schedule_blocks_business_date_idx on public.schedule_blocks (business_id, block_date);
create index schedule_blocks_professional_date_idx on public.schedule_blocks (professional_id, block_date) where is_active = true;
create index appointments_business_date_idx on public.appointments (business_id, appointment_date);
create index appointments_professional_date_idx on public.appointments (professional_id, appointment_date) where status <> 'cancelled';

create trigger professional_working_hours_set_updated_at
before update on public.professional_working_hours
for each row execute function public.set_updated_at();

create trigger professional_breaks_set_updated_at
before update on public.professional_breaks
for each row execute function public.set_updated_at();

create trigger professional_booking_settings_set_updated_at
before update on public.professional_booking_settings
for each row execute function public.set_updated_at();

create trigger schedule_blocks_set_updated_at
before update on public.schedule_blocks
for each row execute function public.set_updated_at();

create trigger appointments_set_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

create or replace function private.ensure_professional_owned_by_business(
  target_business_id uuid,
  target_professional_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actual_business_id uuid;
begin
  select business_id
  into actual_business_id
  from public.professionals
  where id = target_professional_id
    and deleted_at is null;

  if actual_business_id is null then
    raise exception 'Profissional invalido.';
  end if;

  if actual_business_id <> target_business_id then
    raise exception 'Profissional pertence a outro estabelecimento.';
  end if;
end;
$$;

create or replace function private.ensure_schedule_professional_business_match()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.ensure_professional_owned_by_business(new.business_id, new.professional_id);
  return new;
end;
$$;

create or replace function private.ensure_working_hours_no_overlap()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.ensure_professional_owned_by_business(new.business_id, new.professional_id);

  if new.is_active and exists (
    select 1
    from public.professional_working_hours existing
    where existing.id <> new.id
      and existing.business_id = new.business_id
      and existing.professional_id = new.professional_id
      and existing.weekday = new.weekday
      and existing.is_active = true
      and new.start_time < existing.end_time
      and new.end_time > existing.start_time
  ) then
    raise exception 'Horario de atendimento sobreposto.';
  end if;

  return new;
end;
$$;

create or replace function private.ensure_breaks_no_overlap()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.ensure_professional_owned_by_business(new.business_id, new.professional_id);

  if new.is_active and exists (
    select 1
    from public.professional_breaks existing
    where existing.id <> new.id
      and existing.business_id = new.business_id
      and existing.professional_id = new.professional_id
      and existing.weekday = new.weekday
      and existing.is_active = true
      and new.start_time < existing.end_time
      and new.end_time > existing.start_time
  ) then
    raise exception 'Pausa sobreposta.';
  end if;

  return new;
end;
$$;

create or replace function private.ensure_appointment_business_match()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  service_business_id uuid;
  link_business_id uuid;
begin
  perform private.ensure_professional_owned_by_business(new.business_id, new.professional_id);

  select business_id
  into service_business_id
  from public.services
  where id = new.service_id
    and deleted_at is null;

  if service_business_id is null then
    raise exception 'Servico invalido.';
  end if;

  if service_business_id <> new.business_id then
    raise exception 'Servico pertence a outro estabelecimento.';
  end if;

  if new.professional_service_id is not null then
    select business_id
    into link_business_id
    from public.professional_services
    where id = new.professional_service_id
      and professional_id = new.professional_id
      and service_id = new.service_id;

    if link_business_id is null or link_business_id <> new.business_id then
      raise exception 'Vinculo servico-profissional invalido.';
    end if;
  end if;

  if new.status <> 'cancelled' and exists (
    select 1
    from public.appointments existing
    where existing.id <> new.id
      and existing.business_id = new.business_id
      and existing.professional_id = new.professional_id
      and existing.appointment_date = new.appointment_date
      and existing.status <> 'cancelled'
      and new.start_time < existing.end_time
      and new.end_time > existing.start_time
  ) then
    raise exception 'Agendamento conflita com outro horario.';
  end if;

  return new;
end;
$$;

create trigger professional_working_hours_validate
before insert or update on public.professional_working_hours
for each row execute function private.ensure_working_hours_no_overlap();

create trigger professional_breaks_validate
before insert or update on public.professional_breaks
for each row execute function private.ensure_breaks_no_overlap();

create trigger professional_booking_settings_validate
before insert or update on public.professional_booking_settings
for each row execute function private.ensure_schedule_professional_business_match();

create trigger schedule_blocks_validate
before insert or update on public.schedule_blocks
for each row execute function private.ensure_schedule_professional_business_match();

create trigger appointments_validate
before insert or update on public.appointments
for each row execute function private.ensure_appointment_business_match();

alter table public.professional_working_hours enable row level security;
alter table public.professional_breaks enable row level security;
alter table public.professional_booking_settings enable row level security;
alter table public.schedule_blocks enable row level security;
alter table public.appointments enable row level security;

create policy "professional_working_hours_select_member"
on public.professional_working_hours
for select
to authenticated
using (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = professional_working_hours.business_id
      and bm.user_id = (select auth.uid())
  )
);

create policy "professional_working_hours_insert_member"
on public.professional_working_hours
for insert
to authenticated
with check (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = professional_working_hours.business_id
      and bm.user_id = (select auth.uid())
      and bm.role in ('owner', 'staff')
  )
);

create policy "professional_working_hours_update_member"
on public.professional_working_hours
for update
to authenticated
using (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = professional_working_hours.business_id
      and bm.user_id = (select auth.uid())
      and bm.role in ('owner', 'staff')
  )
)
with check (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = professional_working_hours.business_id
      and bm.user_id = (select auth.uid())
      and bm.role in ('owner', 'staff')
  )
);

create policy "professional_breaks_select_member"
on public.professional_breaks
for select
to authenticated
using (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = professional_breaks.business_id
      and bm.user_id = (select auth.uid())
  )
);

create policy "professional_breaks_insert_member"
on public.professional_breaks
for insert
to authenticated
with check (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = professional_breaks.business_id
      and bm.user_id = (select auth.uid())
      and bm.role in ('owner', 'staff')
  )
);

create policy "professional_breaks_update_member"
on public.professional_breaks
for update
to authenticated
using (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = professional_breaks.business_id
      and bm.user_id = (select auth.uid())
      and bm.role in ('owner', 'staff')
  )
)
with check (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = professional_breaks.business_id
      and bm.user_id = (select auth.uid())
      and bm.role in ('owner', 'staff')
  )
);

create policy "professional_booking_settings_select_member"
on public.professional_booking_settings
for select
to authenticated
using (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = professional_booking_settings.business_id
      and bm.user_id = (select auth.uid())
  )
);

create policy "professional_booking_settings_insert_member"
on public.professional_booking_settings
for insert
to authenticated
with check (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = professional_booking_settings.business_id
      and bm.user_id = (select auth.uid())
      and bm.role in ('owner', 'staff')
  )
);

create policy "professional_booking_settings_update_member"
on public.professional_booking_settings
for update
to authenticated
using (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = professional_booking_settings.business_id
      and bm.user_id = (select auth.uid())
      and bm.role in ('owner', 'staff')
  )
)
with check (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = professional_booking_settings.business_id
      and bm.user_id = (select auth.uid())
      and bm.role in ('owner', 'staff')
  )
);

create policy "schedule_blocks_select_member"
on public.schedule_blocks
for select
to authenticated
using (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = schedule_blocks.business_id
      and bm.user_id = (select auth.uid())
  )
);

create policy "schedule_blocks_insert_member"
on public.schedule_blocks
for insert
to authenticated
with check (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = schedule_blocks.business_id
      and bm.user_id = (select auth.uid())
      and bm.role in ('owner', 'staff')
  )
);

create policy "schedule_blocks_update_member"
on public.schedule_blocks
for update
to authenticated
using (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = schedule_blocks.business_id
      and bm.user_id = (select auth.uid())
      and bm.role in ('owner', 'staff')
  )
)
with check (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = schedule_blocks.business_id
      and bm.user_id = (select auth.uid())
      and bm.role in ('owner', 'staff')
  )
);

create policy "appointments_select_member"
on public.appointments
for select
to authenticated
using (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = appointments.business_id
      and bm.user_id = (select auth.uid())
  )
);

create policy "appointments_insert_member"
on public.appointments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = appointments.business_id
      and bm.user_id = (select auth.uid())
      and bm.role in ('owner', 'staff')
  )
);

create policy "appointments_update_member"
on public.appointments
for update
to authenticated
using (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = appointments.business_id
      and bm.user_id = (select auth.uid())
      and bm.role in ('owner', 'staff')
  )
)
with check (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = appointments.business_id
      and bm.user_id = (select auth.uid())
      and bm.role in ('owner', 'staff')
  )
);

grant select, insert, update on public.professional_working_hours to authenticated;
grant select, insert, update on public.professional_breaks to authenticated;
grant select, insert, update on public.professional_booking_settings to authenticated;
grant select, insert, update on public.schedule_blocks to authenticated;
grant select, insert, update on public.appointments to authenticated;

revoke execute on function private.ensure_professional_owned_by_business(uuid, uuid) from public;
revoke execute on function private.ensure_professional_owned_by_business(uuid, uuid) from anon;
revoke execute on function private.ensure_professional_owned_by_business(uuid, uuid) from authenticated;
revoke execute on function private.ensure_schedule_professional_business_match() from public;
revoke execute on function private.ensure_schedule_professional_business_match() from anon;
revoke execute on function private.ensure_schedule_professional_business_match() from authenticated;
revoke execute on function private.ensure_working_hours_no_overlap() from public;
revoke execute on function private.ensure_working_hours_no_overlap() from anon;
revoke execute on function private.ensure_working_hours_no_overlap() from authenticated;
revoke execute on function private.ensure_breaks_no_overlap() from public;
revoke execute on function private.ensure_breaks_no_overlap() from anon;
revoke execute on function private.ensure_breaks_no_overlap() from authenticated;
revoke execute on function private.ensure_appointment_business_match() from public;
revoke execute on function private.ensure_appointment_business_match() from anon;
revoke execute on function private.ensure_appointment_business_match() from authenticated;

alter table public.businesses
drop constraint if exists businesses_theme_key_check;

alter table public.businesses
add constraint businesses_theme_key_check
check (theme_key in ('mireva', 'essencial', 'premium', 'calmo', 'editorial'));

create or replace function private.create_business_for_current_user(
  business_name text,
  business_segment text default null,
  business_whatsapp text default null,
  business_address text default null,
  business_theme_key text default 'mireva',
  business_booking_confirmation_mode text default 'automatic'
)
returns public.businesses
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  base_slug text;
  candidate_slug text;
  suffix integer := 1;
  created_business public.businesses;
begin
  if current_user_id is null then
    raise exception 'Usuario autenticado obrigatorio.';
  end if;

  if length(trim(coalesce(business_name, ''))) = 0 then
    raise exception 'Nome do negocio obrigatorio.';
  end if;

  if business_theme_key not in ('mireva', 'essencial', 'premium', 'calmo', 'editorial') then
    raise exception 'Tema invalido.';
  end if;

  if business_booking_confirmation_mode not in ('automatic', 'manual') then
    raise exception 'Modo de confirmacao invalido.';
  end if;

  if exists (
    select 1
    from public.business_members
    where user_id = current_user_id
  ) then
    raise exception 'Usuario ja possui um estabelecimento configurado.';
  end if;

  insert into public.profiles (id)
  values (current_user_id)
  on conflict (id) do nothing;

  base_slug := public.slugify_business_name(business_name);

  if base_slug = '' then
    base_slug := 'negocio';
  end if;

  candidate_slug := base_slug;

  while exists (select 1 from public.businesses where slug = candidate_slug) loop
    suffix := suffix + 1;
    candidate_slug := base_slug || '-' || suffix::text;
  end loop;

  insert into public.businesses (
    name,
    slug,
    segment,
    whatsapp,
    address,
    theme_key,
    booking_confirmation_mode
  )
  values (
    trim(business_name),
    candidate_slug,
    nullif(trim(coalesce(business_segment, '')), ''),
    nullif(trim(coalesce(business_whatsapp, '')), ''),
    nullif(trim(coalesce(business_address, '')), ''),
    business_theme_key,
    business_booking_confirmation_mode
  )
  returning * into created_business;

  insert into public.business_members (business_id, user_id, role)
  values (created_business.id, current_user_id, 'owner');

  return created_business;
end;
$$;

create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  role_title text,
  bio text,
  avatar_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint professionals_name_not_blank check (length(trim(name)) > 0)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  short_description text,
  base_price_cents integer,
  base_duration_minutes integer not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint services_name_not_blank check (length(trim(name)) > 0),
  constraint services_base_price_cents_check check (base_price_cents is null or base_price_cents >= 0),
  constraint services_base_duration_minutes_check check (base_duration_minutes > 0)
);

create table public.professional_services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  custom_price_cents integer,
  custom_duration_minutes integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_services_unique_pair unique (professional_id, service_id),
  constraint professional_services_custom_price_cents_check check (custom_price_cents is null or custom_price_cents >= 0),
  constraint professional_services_custom_duration_minutes_check check (custom_duration_minutes is null or custom_duration_minutes > 0)
);

create index professionals_business_id_idx on public.professionals (business_id);
create index professionals_active_idx on public.professionals (business_id, is_active) where deleted_at is null;
create index services_business_id_idx on public.services (business_id);
create index services_active_idx on public.services (business_id, is_active) where deleted_at is null;
create index professional_services_business_id_idx on public.professional_services (business_id);
create index professional_services_professional_id_idx on public.professional_services (professional_id);
create index professional_services_service_id_idx on public.professional_services (service_id);

create trigger professionals_set_updated_at
before update on public.professionals
for each row execute function public.set_updated_at();

create trigger services_set_updated_at
before update on public.services
for each row execute function public.set_updated_at();

create trigger professional_services_set_updated_at
before update on public.professional_services
for each row execute function public.set_updated_at();

create or replace function private.ensure_professional_service_business_match()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  professional_business_id uuid;
  service_business_id uuid;
begin
  select business_id
  into professional_business_id
  from public.professionals
  where id = new.professional_id
    and deleted_at is null;

  select business_id
  into service_business_id
  from public.services
  where id = new.service_id
    and deleted_at is null;

  if professional_business_id is null then
    raise exception 'Profissional invalido.';
  end if;

  if service_business_id is null then
    raise exception 'Servico invalido.';
  end if;

  if new.business_id <> professional_business_id or new.business_id <> service_business_id then
    raise exception 'Servico e profissional precisam pertencer ao mesmo estabelecimento.';
  end if;

  return new;
end;
$$;

create trigger professional_services_business_match
before insert or update on public.professional_services
for each row execute function private.ensure_professional_service_business_match();

alter table public.professionals enable row level security;
alter table public.services enable row level security;
alter table public.professional_services enable row level security;

create policy "professionals_select_member"
on public.professionals
for select
to authenticated
using (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = professionals.business_id
      and bm.user_id = (select auth.uid())
  )
);

create policy "professionals_insert_owner"
on public.professionals
for insert
to authenticated
with check (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = professionals.business_id
      and bm.user_id = (select auth.uid())
      and bm.role = 'owner'
  )
);

create policy "professionals_update_owner"
on public.professionals
for update
to authenticated
using (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = professionals.business_id
      and bm.user_id = (select auth.uid())
      and bm.role = 'owner'
  )
)
with check (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = professionals.business_id
      and bm.user_id = (select auth.uid())
      and bm.role = 'owner'
  )
);

create policy "services_select_member"
on public.services
for select
to authenticated
using (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = services.business_id
      and bm.user_id = (select auth.uid())
  )
);

create policy "services_insert_owner"
on public.services
for insert
to authenticated
with check (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = services.business_id
      and bm.user_id = (select auth.uid())
      and bm.role = 'owner'
  )
);

create policy "services_update_owner"
on public.services
for update
to authenticated
using (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = services.business_id
      and bm.user_id = (select auth.uid())
      and bm.role = 'owner'
  )
)
with check (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = services.business_id
      and bm.user_id = (select auth.uid())
      and bm.role = 'owner'
  )
);

create policy "professional_services_select_member"
on public.professional_services
for select
to authenticated
using (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = professional_services.business_id
      and bm.user_id = (select auth.uid())
  )
);

create policy "professional_services_insert_owner"
on public.professional_services
for insert
to authenticated
with check (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = professional_services.business_id
      and bm.user_id = (select auth.uid())
      and bm.role = 'owner'
  )
);

create policy "professional_services_update_owner"
on public.professional_services
for update
to authenticated
using (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = professional_services.business_id
      and bm.user_id = (select auth.uid())
      and bm.role = 'owner'
  )
)
with check (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = professional_services.business_id
      and bm.user_id = (select auth.uid())
      and bm.role = 'owner'
  )
);

grant select, insert, update on public.professionals to authenticated;
grant select, insert, update on public.services to authenticated;
grant select, insert, update on public.professional_services to authenticated;

revoke execute on function private.ensure_professional_service_business_match() from public;
revoke execute on function private.ensure_professional_service_business_match() from anon;
revoke execute on function private.ensure_professional_service_business_match() from authenticated;

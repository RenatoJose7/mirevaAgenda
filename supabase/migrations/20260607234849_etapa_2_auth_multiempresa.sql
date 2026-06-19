create extension if not exists pgcrypto;
create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;
create schema if not exists private;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  segment text,
  whatsapp text,
  address text,
  theme_key text not null default 'mireva',
  booking_confirmation_mode text not null default 'automatic',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint businesses_name_not_blank check (length(trim(name)) > 0),
  constraint businesses_slug_not_blank check (length(trim(slug)) > 0),
  constraint businesses_booking_confirmation_mode_check
    check (booking_confirmation_mode in ('automatic', 'manual')),
  constraint businesses_theme_key_check
    check (theme_key in ('mireva', 'essencial', 'premium', 'calmo', 'editorial'))
);

create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  constraint business_members_unique_member unique (business_id, user_id),
  constraint business_members_role_check check (role in ('owner', 'staff'))
);

create index business_members_user_id_idx on public.business_members (user_id);
create index business_members_business_id_idx on public.business_members (business_id);
create index businesses_slug_idx on public.businesses (slug);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger businesses_set_updated_at
before update on public.businesses
for each row execute function public.set_updated_at();

create or replace function public.slugify_business_name(input text)
returns text
language sql
stable
as $$
  select trim(
    both '-' from regexp_replace(
      regexp_replace(lower(extensions.unaccent(coalesce(input, ''))), '[^a-z0-9]+', '-', 'g'),
      '-+',
      '-',
      'g'
    )
  );
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
  set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

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

create or replace function public.create_business_for_current_user(
  business_name text,
  business_segment text default null,
  business_whatsapp text default null,
  business_address text default null,
  business_theme_key text default 'mireva',
  business_booking_confirmation_mode text default 'automatic'
)
returns public.businesses
language sql
security invoker
set search_path = public, pg_temp
as $$
  select *
  from private.create_business_for_current_user(
    business_name,
    business_segment,
    business_whatsapp,
    business_address,
    business_theme_key,
    business_booking_confirmation_mode
  );
$$;

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "business_members_select_own"
on public.business_members
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "businesses_select_member"
on public.businesses
for select
to authenticated
using (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = businesses.id
      and bm.user_id = (select auth.uid())
  )
);

create policy "businesses_update_owner"
on public.businesses
for update
to authenticated
using (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = businesses.id
      and bm.user_id = (select auth.uid())
      and bm.role = 'owner'
  )
)
with check (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = businesses.id
      and bm.user_id = (select auth.uid())
      and bm.role = 'owner'
  )
);

grant select, insert, update on public.profiles to authenticated;
grant select, update on public.businesses to authenticated;
grant select on public.business_members to authenticated;
revoke execute on function public.handle_new_user_profile() from public;
revoke execute on function public.handle_new_user_profile() from anon;
revoke execute on function public.handle_new_user_profile() from authenticated;
revoke all on schema private from public;
grant usage on schema private to authenticated;

grant execute on function private.create_business_for_current_user(
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated;

grant execute on function public.create_business_for_current_user(
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated;

revoke execute on function public.create_business_for_current_user(
  text,
  text,
  text,
  text,
  text,
  text
) from anon;

revoke execute on function private.create_business_for_current_user(
  text,
  text,
  text,
  text,
  text,
  text
) from anon;

-- Estabilizacao MVP: hardening idempotente para projetos Supabase novos.

alter table if exists public.profiles enable row level security;
alter table if exists public.businesses enable row level security;
alter table if exists public.business_members enable row level security;
alter table if exists public.professionals enable row level security;
alter table if exists public.services enable row level security;
alter table if exists public.professional_services enable row level security;
alter table if exists public.professional_working_hours enable row level security;
alter table if exists public.professional_breaks enable row level security;
alter table if exists public.professional_booking_settings enable row level security;
alter table if exists public.schedule_blocks enable row level security;
alter table if exists public.appointments enable row level security;
alter table if exists public.customers enable row level security;
alter table if exists public.internal_notifications enable row level security;

grant select, insert, update on public.profiles to service_role;

revoke execute on function public.create_business_for_current_user(
  text,
  text,
  text,
  text,
  text,
  text
) from public;

revoke execute on function public.create_business_for_current_user(
  text,
  text,
  text,
  text,
  text,
  text
) from anon;

grant execute on function public.create_business_for_current_user(
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated;

revoke all on schema private from public;
grant usage on schema private to authenticated;

notify pgrst, 'reload schema';

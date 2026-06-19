-- Grants minimos para a Data API. RLS continua sendo a camada de isolamento por linha.

revoke all on table
  public.profiles,
  public.businesses,
  public.business_members,
  public.professionals,
  public.services,
  public.professional_services,
  public.professional_working_hours,
  public.professional_breaks,
  public.professional_booking_settings,
  public.schedule_blocks,
  public.appointments,
  public.customers,
  public.internal_notifications
from anon;

revoke all on table
  public.profiles,
  public.businesses,
  public.business_members,
  public.professionals,
  public.services,
  public.professional_services,
  public.professional_working_hours,
  public.professional_breaks,
  public.professional_booking_settings,
  public.schedule_blocks,
  public.appointments,
  public.customers,
  public.internal_notifications
from authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, update on public.businesses to authenticated;
grant select on public.business_members to authenticated;
grant select, insert, update on public.professionals to authenticated;
grant select, insert, update on public.services to authenticated;
grant select, insert, update on public.professional_services to authenticated;
grant select, insert, update on public.professional_working_hours to authenticated;
grant select, insert, update on public.professional_breaks to authenticated;
grant select, insert, update on public.professional_booking_settings to authenticated;
grant select, insert, update on public.schedule_blocks to authenticated;
grant select, insert, update on public.appointments to authenticated;
grant select, insert, update on public.customers to authenticated;
grant select, insert, update on public.internal_notifications to authenticated;

grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.businesses to service_role;
grant select, insert, update, delete on public.business_members to service_role;
grant select, insert, update, delete on public.professionals to service_role;
grant select, insert, update, delete on public.services to service_role;
grant select, insert, update, delete on public.professional_services to service_role;
grant select, insert, update, delete on public.professional_working_hours to service_role;
grant select, insert, update, delete on public.professional_breaks to service_role;
grant select, insert, update, delete on public.professional_booking_settings to service_role;
grant select, insert, update, delete on public.schedule_blocks to service_role;
grant select, insert, update, delete on public.appointments to service_role;
grant select, insert, update, delete on public.customers to service_role;
grant select, insert, update, delete on public.internal_notifications to service_role;

notify pgrst, 'reload schema';

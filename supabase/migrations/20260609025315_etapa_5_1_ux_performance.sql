create index if not exists businesses_public_search_idx
on public.businesses (name, segment);

grant select on public.profiles to service_role;
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

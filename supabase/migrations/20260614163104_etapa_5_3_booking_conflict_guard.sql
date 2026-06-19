create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;

set search_path = public, extensions, pg_temp;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.appointments'::regclass
      and conname = 'appointments_no_overlapping_active'
  ) then
    alter table public.appointments
      add constraint appointments_no_overlapping_active
      exclude using gist (
        business_id with =,
        professional_id with =,
        appointment_date with =,
        tsrange(
          appointment_date::timestamp + start_time,
          appointment_date::timestamp + end_time,
          '[)'
        ) with &&
      )
      where (status <> 'cancelled');
  end if;
end;
$$;

notify pgrst, 'reload schema';

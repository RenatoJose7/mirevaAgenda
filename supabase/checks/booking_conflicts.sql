select
  a.id as appointment_id,
  b.id as conflicting_appointment_id,
  a.business_id,
  a.professional_id,
  a.appointment_date,
  a.start_time,
  a.end_time,
  b.start_time as conflict_start_time,
  b.end_time as conflict_end_time
from public.appointments a
join public.appointments b
  on a.id < b.id
 and a.business_id = b.business_id
 and a.professional_id = b.professional_id
 and a.appointment_date = b.appointment_date
 and a.status <> 'cancelled'
 and b.status <> 'cancelled'
 and a.start_time < b.end_time
 and a.end_time > b.start_time
limit 10;

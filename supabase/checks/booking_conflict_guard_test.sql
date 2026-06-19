do $$
declare
  test_business_id uuid;
  test_professional_id uuid;
  test_service_id uuid;
  conflict_blocked boolean := false;
begin
  insert into public.businesses (name, slug, theme_key, booking_confirmation_mode)
  values ('Mireva Conflict Guard Test', 'mireva-conflict-guard-test-' || replace(gen_random_uuid()::text, '-', ''), 'mireva', 'automatic')
  returning id into test_business_id;

  insert into public.professionals (business_id, name)
  values (test_business_id, 'Profissional Teste')
  returning id into test_professional_id;

  insert into public.services (business_id, name, base_duration_minutes)
  values (test_business_id, 'Servico Teste', 60)
  returning id into test_service_id;

  insert into public.professional_services (business_id, professional_id, service_id)
  values (test_business_id, test_professional_id, test_service_id);

  insert into public.appointments (
    business_id,
    professional_id,
    service_id,
    customer_name,
    customer_whatsapp,
    appointment_date,
    start_time,
    end_time,
    status,
    source
  )
  values (
    test_business_id,
    test_professional_id,
    test_service_id,
    'Cliente Teste 1',
    '11999999999',
    date '2026-06-20',
    time '09:00',
    time '10:00',
    'confirmed',
    'internal'
  );

  begin
    insert into public.appointments (
      business_id,
      professional_id,
      service_id,
      customer_name,
      customer_whatsapp,
      appointment_date,
      start_time,
      end_time,
      status,
      source
    )
    values (
      test_business_id,
      test_professional_id,
      test_service_id,
      'Cliente Teste 2',
      '11888888888',
      date '2026-06-20',
      time '09:30',
      time '10:30',
      'confirmed',
      'internal'
    );
  exception
    when exclusion_violation or raise_exception then
      conflict_blocked := true;
  end;

  if not conflict_blocked then
    raise exception 'booking conflict was not blocked';
  end if;

  delete from public.businesses where id = test_business_id;
end;
$$;

select 'booking_conflict_guard_ok' as check_result;

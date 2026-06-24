create or replace function private.ensure_plan_resource_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_count integer;
  max_allowed integer;
  entity_name text;
begin
  if new.deleted_at is not null then
    return new;
  end if;

  if TG_OP = 'UPDATE'
    and old.deleted_at is null
    and old.business_id = new.business_id
  then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('mireva_plan_limit:' || TG_TABLE_NAME || ':' || new.business_id::text));

  if TG_TABLE_NAME = 'professionals' then
    entity_name := 'profissionais';

    select coalesce(bs.max_professionals, sp.max_professionals)
    into max_allowed
    from public.subscription_plans sp
    left join public.business_subscriptions bs
      on bs.business_id = new.business_id
    where sp.id = coalesce(bs.plan_id, 'basic')
    limit 1;

    select count(*)
    into current_count
    from public.professionals
    where business_id = new.business_id
      and deleted_at is null;
  elsif TG_TABLE_NAME = 'services' then
    entity_name := 'servicos';

    select coalesce(bs.max_services, sp.max_services)
    into max_allowed
    from public.subscription_plans sp
    left join public.business_subscriptions bs
      on bs.business_id = new.business_id
    where sp.id = coalesce(bs.plan_id, 'basic')
    limit 1;

    select count(*)
    into current_count
    from public.services
    where business_id = new.business_id
      and deleted_at is null;
  else
    return new;
  end if;

  if max_allowed is null then
    select
      case
        when TG_TABLE_NAME = 'professionals' then max_professionals
        else max_services
      end
    into max_allowed
    from public.subscription_plans
    where id = 'basic';
  end if;

  if current_count >= max_allowed then
    raise exception 'Limite do plano atingido: seu plano permite ate % %.', max_allowed, entity_name;
  end if;

  return new;
end;
$$;

drop trigger if exists professionals_plan_limit on public.professionals;
drop trigger if exists services_plan_limit on public.services;

create trigger professionals_plan_limit
before insert or update of business_id, deleted_at on public.professionals
for each row execute function private.ensure_plan_resource_limit();

create trigger services_plan_limit
before insert or update of business_id, deleted_at on public.services
for each row execute function private.ensure_plan_resource_limit();

revoke execute on function private.ensure_plan_resource_limit() from public;
revoke execute on function private.ensure_plan_resource_limit() from anon;
revoke execute on function private.ensure_plan_resource_limit() from authenticated;

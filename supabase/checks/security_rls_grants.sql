with expected_tables(tablename) as (
  values
    ('profiles'),
    ('businesses'),
    ('business_members'),
    ('professionals'),
    ('services'),
    ('professional_services'),
    ('professional_working_hours'),
    ('professional_breaks'),
    ('professional_booking_settings'),
    ('schedule_blocks'),
    ('appointments'),
    ('customers'),
    ('internal_notifications')
),
rls_status as (
  select
    expected_tables.tablename,
    coalesce(pg_tables.rowsecurity, false) as rowsecurity
  from expected_tables
  left join pg_tables
    on pg_tables.schemaname = 'public'
   and pg_tables.tablename = expected_tables.tablename
),
anon_table_grants as (
  select
    table_name,
    privilege_type
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee = 'anon'
    and table_name in (select tablename from expected_tables)
)
select
  (select count(*) from rls_status where rowsecurity = true) as rls_enabled_tables,
  (select count(*) from rls_status where rowsecurity = false) as rls_disabled_tables,
  (select count(*) from anon_table_grants) as anon_table_grants;

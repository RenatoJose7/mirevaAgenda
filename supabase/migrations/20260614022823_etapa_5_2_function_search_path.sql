create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.slugify_business_name(input text)
returns text
language sql
stable
set search_path = public, extensions, pg_temp
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

notify pgrst, 'reload schema';

alter table public.businesses
add column if not exists logo_url text,
add column if not exists logo_path text;

alter table public.businesses
drop constraint if exists businesses_logo_url_length_check;

alter table public.businesses
add constraint businesses_logo_url_length_check
check (logo_url is null or length(logo_url) <= 600);

alter table public.businesses
drop constraint if exists businesses_logo_path_length_check;

alter table public.businesses
add constraint businesses_logo_path_length_check
check (logo_path is null or length(logo_path) <= 260);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-logos',
  'business-logos',
  true,
  1048576,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "business_logos_select_member_folder" on storage.objects;
drop policy if exists "business_logos_insert_owner_folder" on storage.objects;
drop policy if exists "business_logos_update_owner_folder" on storage.objects;
drop policy if exists "business_logos_delete_owner_folder" on storage.objects;

create policy "business_logos_select_member_folder"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'business-logos'
  and exists (
    select 1
    from public.business_members bm
    where bm.business_id::text = (storage.foldername(name))[1]
      and bm.user_id = (select auth.uid())
  )
);

create policy "business_logos_insert_owner_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'business-logos'
  and exists (
    select 1
    from public.business_members bm
    where bm.business_id::text = (storage.foldername(name))[1]
      and bm.user_id = (select auth.uid())
      and bm.role = 'owner'
  )
);

create policy "business_logos_update_owner_folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'business-logos'
  and exists (
    select 1
    from public.business_members bm
    where bm.business_id::text = (storage.foldername(name))[1]
      and bm.user_id = (select auth.uid())
      and bm.role = 'owner'
  )
)
with check (
  bucket_id = 'business-logos'
  and exists (
    select 1
    from public.business_members bm
    where bm.business_id::text = (storage.foldername(name))[1]
      and bm.user_id = (select auth.uid())
      and bm.role = 'owner'
  )
);

create policy "business_logos_delete_owner_folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'business-logos'
  and exists (
    select 1
    from public.business_members bm
    where bm.business_id::text = (storage.foldername(name))[1]
      and bm.user_id = (select auth.uid())
      and bm.role = 'owner'
  )
);

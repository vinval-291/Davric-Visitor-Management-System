-- =============================================================
--  Migration 0004 - private storage for visitor signatures
--
--  Signatures are personal data and part of the visit record, so the
--  bucket is private. Files are reached only through short-lived
--  signed URLs generated for an authorised session.
-- =============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'signatures',
  'signatures',
  false,                     -- never publicly listable or linkable
  524288,                    -- 512 KB ceiling; a real signature is ~10-30 KB
  array['image/png']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- Desk staff (receptionist + super admin) upload at check-in.
drop policy if exists signatures_desk_insert on storage.objects;
create policy signatures_desk_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'signatures' and public.is_desk_staff());

-- Desk staff read them back when reviewing a visit record.
-- PAs are deliberately excluded: they need to know who arrived, not to
-- hold a copy of the visitor's signature.
drop policy if exists signatures_desk_read on storage.objects;
create policy signatures_desk_read on storage.objects
  for select to authenticated
  using (bucket_id = 'signatures' and public.is_desk_staff());

-- Is this storage object referenced by a visit record?
-- SECURITY DEFINER so the storage policy does not have to read the
-- visitors table through that table's own RLS.
create or replace function public.signature_is_attached(object_name text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.visitors v where v.signature_path = object_name
  )
$$;

grant execute on function public.signature_is_attached(text) to authenticated;

-- Deleting is allowed ONLY for an orphan: a file the caller uploaded
-- that no visit record points at. That happens when the upload
-- succeeds but the insert then fails, and it lets the app tidy up
-- after itself.
--
-- The moment a signature is attached to a visit it becomes permanent.
-- There is no UPDATE policy at all, so it can never be swapped either.
-- A signature is evidence that the visitor signed in.
drop policy if exists signatures_delete_orphan on storage.objects;
create policy signatures_delete_orphan on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'signatures'
    and owner = (select auth.uid())
    and not public.signature_is_attached(name)
  );

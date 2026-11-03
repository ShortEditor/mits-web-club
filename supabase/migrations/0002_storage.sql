-- Storage: ONE private bucket "media". No public bucket URLs, so drafts/unpublished
-- assets are never exposed by guessing a URL. Reads go through signed URLs the app
-- mints at render time; this RLS decides who may read which object.
-- Path convention: events/<event_id>/<filename> and docs/<event_id>/<filename>

insert into storage.buckets (id, name, public) values ('media', 'media', false)
on conflict (id) do nothing;

-- Helper: extract the event id from the first path segment pair
create or replace function public.media_event_id(object_name text) returns uuid
language sql stable as $$
  select nullif(split_part(object_name, '/', 2), '')::uuid
$$;

-- SIGN-IN REQUIRED: only authenticated users read media of PUBLISHED events.
-- No public bucket, no anon access: drafts and unpublished assets stay sealed.
create policy media_student_read on storage.objects for select to authenticated
  using (
    bucket_id = 'media' and (
      public.is_admin()
      or (
        -- documentation PDFs live under docs/ and are ADMIN-ONLY, never student-readable
        split_part(name, '/', 1) <> 'docs'
        and exists (
          select 1 from public.events e
          where e.id = public.media_event_id(name) and e.published
        )
      )
    )
  );

-- Only admins write/delete media.
create policy media_admin_write on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_admin());
create policy media_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_admin());
create policy media_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_admin());

-- Documentation PDFs (docs/<event_id>/...) are admin-only at the STORAGE level too:
-- the read policy above excludes the docs/ prefix for non-admins, so no signed URL
-- a student could mint ever covers a report PDF.

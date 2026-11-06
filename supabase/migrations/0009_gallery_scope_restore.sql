-- 0009: gallery read scope reconciliation (2026-11-06 review).
-- 0008 opened published-event gallery rows and all non-docs media to any
-- signed-in user. The 2026-11-06 user request authorizes student visibility of
-- EVENTS and their POSTERS only (students must see events to register); it does
-- not widen the gallery audience. Gallery reads return to the 0006 editors-only
-- scope until the user independently approves opening them. Event/poster
-- student visibility from 0008 is preserved.

-- GALLERY rows: editors-only again (admins + assigned faculty editors).
drop policy gallery_read on public.event_gallery_images;
create policy gallery_editor_read on public.event_gallery_images for select to authenticated
  using (public.is_admin() or public.is_faculty_editor());

-- STORAGE media reads: signed-in non-editors read only POSTER media of
-- published events (events/<id>/poster/... plus legacy three-part
-- events/<id>/<file> shapes, which predate the poster/gallery split).
-- Gallery (events/<id>/gallery/...) and docs/ objects stay editor/admin-only.
drop policy media_read on storage.objects;
create policy media_read on storage.objects for select to authenticated
  using (
    bucket_id = 'media' and (
      public.is_admin() or public.is_faculty_editor()
      or (
        split_part(name, '/', 1) = 'events'
        and split_part(name, '/', 3) <> 'gallery'
        and exists (
          select 1 from public.events e
          where e.id = public.media_event_id(name) and e.published
        )
      )
    )
  );

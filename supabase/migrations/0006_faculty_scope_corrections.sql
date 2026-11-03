-- Scope corrections (2026-11-03):
-- 1. Gallery + media writes are ADMIN-ONLY (user: "In Admin lo only adding gallery").
--    Faculty editors keep EVENT ROW create/edit/delete only.
-- 2. Faculty event write scoped to their OWN events (created_by) until the
--    own-vs-all question is answered - no guessed broad authority.
-- 3. Viewer eligibility stays frozen: events/gallery reads are editors-only
--    (admins + assigned faculty editors) until the club picks roster/domain/open.
--    The earlier published-read-for-all-signed-in was applied too broadly and is
--    reverted here.

alter table public.events add column if not exists created_by uuid references auth.users(id) default auth.uid();

-- EVENTS: reads editors-only again
drop policy events_read on public.events;
create policy events_editor_read on public.events for select to authenticated
  using (public.is_admin() or public.is_faculty_editor());

-- EVENTS: admins write everything; faculty write only their own events
drop policy events_editor_write on public.events;
create policy events_admin_write on public.events for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy events_faculty_insert on public.events for insert to authenticated
  with check (public.is_faculty_editor() and created_by = auth.uid());
create policy events_faculty_update on public.events for update to authenticated
  using (public.is_faculty_editor() and created_by = auth.uid())
  with check (public.is_faculty_editor() and created_by = auth.uid());
create policy events_faculty_delete on public.events for delete to authenticated
  using (public.is_faculty_editor() and created_by = auth.uid());

-- GALLERY rows: reads editors-only; writes ADMIN-ONLY
drop policy gallery_read on public.event_gallery_images;
create policy gallery_editor_read on public.event_gallery_images for select to authenticated
  using (public.is_admin() or public.is_faculty_editor());
drop policy gallery_editor_write on public.event_gallery_images;
create policy gallery_admin_write on public.event_gallery_images for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- STORAGE media writes: ADMIN-ONLY again (faculty cannot upload posters/photos/docs)
drop policy media_editor_write on storage.objects;
create policy media_admin_write on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_admin());
drop policy media_editor_update on storage.objects;
create policy media_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_admin());
drop policy media_editor_delete on storage.objects;
create policy media_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_admin());

-- STORAGE media READS: also restricted. The old media_student_read let ANY signed-in user
-- read media attached to published events; viewer eligibility is undecided, so reads are
-- editors-only until the user picks roster/domain/open.
drop policy media_student_read on storage.objects;
create policy media_editor_read on storage.objects for select to authenticated
  using (bucket_id = 'media' and (public.is_admin() or public.is_faculty_editor()));

-- 0007: poster/gallery storage separation + created_by immutability guard.
--
-- Path convention in the media bucket:
--   events/<event_id>/poster/...   event posters
--   events/<event_id>/gallery/...  gallery images (admin-only writes)
--   docs/<event_id>/...            report PDFs (admin-only writes)
-- Legacy objects at events/<event_id>/<file> (no kind segment) keep working for
-- reads (media_editor_read is path-agnostic) but are admin-only for writes,
-- because no faculty policy matches them.

-- Helper: event id only from a poster path; null for every other shape.
create or replace function public.media_poster_event_id(object_name text)
returns uuid language sql immutable as $$
  select case
    when split_part(object_name, '/', 1) = 'events'
     and split_part(object_name, '/', 3) = 'poster'
    then nullif(split_part(object_name, '/', 2), '')::uuid
  end
$$;

-- Faculty poster writes: only for events they own (created_by = auth.uid()).
-- Gallery and docs paths match no faculty policy, so they stay admin-only.
create policy media_faculty_poster_write on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_faculty_editor()
    and exists (select 1 from public.events e
                where e.id = public.media_poster_event_id(name)
                  and e.created_by = auth.uid()));
create policy media_faculty_poster_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_faculty_editor()
    and exists (select 1 from public.events e
                where e.id = public.media_poster_event_id(name)
                  and e.created_by = auth.uid()))
  with check (bucket_id = 'media' and public.is_faculty_editor()
    and exists (select 1 from public.events e
                where e.id = public.media_poster_event_id(name)
                  and e.created_by = auth.uid()));
create policy media_faculty_poster_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_faculty_editor()
    and exists (select 1 from public.events e
                where e.id = public.media_poster_event_id(name)
                  and e.created_by = auth.uid()));

-- created_by immutability: RLS already stops faculty from claiming rows (USING
-- requires created_by = auth.uid()) and from transferring them (WITH CHECK
-- requires the new created_by = auth.uid()). This trigger adds an explicit
-- guard so only an admin can ever change an event's owner.
create or replace function public.guard_event_created_by()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is distinct from old.created_by and not public.is_admin() then
    raise exception 'created_by cannot be changed';
  end if;
  return new;
end $$;
drop trigger if exists events_guard_created_by on public.events;
create trigger events_guard_created_by before update on public.events
  for each row execute function public.guard_event_created_by();

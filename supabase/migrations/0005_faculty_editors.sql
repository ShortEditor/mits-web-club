-- Faculty editors (2026-11-03, user-directed): admins ASSIGN faculty event-management
-- access; it is never self-declared at signup/login. Faculty editors can create,
-- edit and delete events and manage their gallery (all events, not just their own).
-- Documentation stays admin-only. Students are unaffected.

create table if not exists public.faculty_editors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.faculty_editors enable row level security;
create policy faculty_editors_admin_all on public.faculty_editors for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy faculty_editors_self_read on public.faculty_editors for select to authenticated
  using (user_id = auth.uid());

create or replace function public.is_faculty_editor() returns boolean language sql stable security definer
set search_path = public as $$ select exists (select 1 from public.faculty_editors where user_id = auth.uid()) $$;

-- Admin-managed grant/revoke by email (mirrors admin management): no self-escalation,
-- unregistered emails return no_account.
create or replace function public.add_faculty_editor_by_email(target_email text)
returns json language plpgsql security definer
set search_path = public as $$
declare
  target uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  select id into target from auth.users where lower(email) = lower(trim(target_email));
  if target is null then
    return json_build_object('added', false, 'reason', 'no_account');
  end if;
  insert into public.faculty_editors (user_id) values (target) on conflict do nothing;
  return json_build_object('added', true, 'user_id', target);
end;
$$;

create or replace function public.remove_faculty_editor_by_email(target_email text)
returns json language plpgsql security definer
set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  delete from public.faculty_editors
    where user_id = (select id from auth.users where lower(email) = lower(trim(target_email)));
  return json_build_object('removed', true);
end;
$$;

create or replace function public.faculty_editor_directory()
returns table (user_id uuid, email text, created_at timestamptz)
language sql stable security definer
set search_path = public as $$
  select f.user_id, u.email::text, f.created_at
  from public.faculty_editors f join auth.users u on u.id = f.user_id
  where public.is_admin()
  order by f.created_at;
$$;

revoke all on function public.add_faculty_editor_by_email(text) from public, anon;
revoke all on function public.remove_faculty_editor_by_email(text) from public, anon;
revoke all on function public.faculty_editor_directory() from public, anon;
grant execute on function public.add_faculty_editor_by_email(text) to authenticated;
grant execute on function public.remove_faculty_editor_by_email(text) to authenticated;
grant execute on function public.faculty_editor_directory() to authenticated;

-- EVENTS: admins and faculty editors see and manage everything; any signed-in user
-- can read PUBLISHED events (user clarification 2026-11-03: once published,
-- students and faculty can view). Drafts stay editor-only.
drop policy events_admin_read on public.events;
create policy events_read on public.events for select to authenticated
  using (public.is_admin() or public.is_faculty_editor() or published);
drop policy events_admin_write on public.events;
create policy events_editor_write on public.events for all to authenticated
  using (public.is_admin() or public.is_faculty_editor())
  with check (public.is_admin() or public.is_faculty_editor());

-- GALLERY rows: same read shape (published event => signed-in users read);
-- writes are editors only.
drop policy gallery_admin_read on public.event_gallery_images;
create policy gallery_read on public.event_gallery_images for select to authenticated
  using (
    public.is_admin() or public.is_faculty_editor()
    or exists (select 1 from public.events e where e.id = event_id and e.published)
  );
drop policy gallery_admin_write on public.event_gallery_images;
create policy gallery_editor_write on public.event_gallery_images for all to authenticated
  using (public.is_admin() or public.is_faculty_editor())
  with check (public.is_admin() or public.is_faculty_editor());

-- STORAGE: faculty editors can also write media files (posters, gallery photos).
-- docs/ stays admin-only at the read policy level, unchanged.
drop policy media_admin_write on storage.objects;
create policy media_editor_write on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (public.is_admin() or public.is_faculty_editor()));
drop policy media_admin_update on storage.objects;
create policy media_editor_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and (public.is_admin() or public.is_faculty_editor()));
drop policy media_admin_delete on storage.objects;
create policy media_editor_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (public.is_admin() or public.is_faculty_editor()));

-- event_documents remain ADMIN-ONLY (unchanged policy from 0001).

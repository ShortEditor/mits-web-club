-- 0008: student self-registration + faculty attendance (user direction 2026-11-06,
-- WhatsApp +919160068402, 06:40 IST):
-- - Students see published events and a "Register Now" flow inside the event page.
-- - Registration collects roll number, name, college email, section, department, year.
-- - Event-owning faculty and admins see the registered students list per event.
-- - Faculty add/edit/save attendance (present/absent) with totals; students see
--   their own present/absent status on the event page.
--
-- This also settles the viewer-eligibility hold from 0001/0004/0006: the new
-- student flows require published events (and their poster/gallery media) to be
-- readable by ANY signed-in user. Drafts stay editor-only; docs/ report PDFs
-- stay admin-only at the storage layer. The DRAFT variants in 0004 are resolved
-- by this migration (open-signup read model for published content).

-- 1) EVENTS: any signed-in user reads PUBLISHED events; drafts stay editor-only.
drop policy events_editor_read on public.events;
create policy events_read on public.events for select to authenticated
  using (public.is_admin() or public.is_faculty_editor() or published);

-- GALLERY rows: images of published events readable by any signed-in user
-- (matches the 2026-11-03 "after publish, students & faculty view" direction).
drop policy gallery_editor_read on public.event_gallery_images;
create policy gallery_read on public.event_gallery_images for select to authenticated
  using (
    public.is_admin() or public.is_faculty_editor()
    or exists (select 1 from public.events e where e.id = event_id and e.published)
  );

-- STORAGE media reads: signed-in users read non-docs media of published events.
drop policy media_editor_read on storage.objects;
create policy media_read on storage.objects for select to authenticated
  using (
    bucket_id = 'media' and (
      public.is_admin() or public.is_faculty_editor()
      or (
        split_part(name, '/', 1) <> 'docs'
        and exists (
          select 1 from public.events e
          where e.id = public.media_event_id(name) and e.published
        )
      )
    )
  );

-- 2) Registrations table (attendance lives on the registration row).
create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  roll_number text not null,
  name text not null,
  email text not null,
  department text,
  section text,
  year text,
  -- attendance: null = not marked yet; set only by the event's faculty owner/admin
  attendance_status text check (attendance_status in ('present', 'absent')),
  attendance_marked_by uuid references auth.users(id),
  attendance_marked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id),
  unique (event_id, roll_number)
);
alter table public.event_registrations enable row level security;
create index if not exists registrations_event_idx on public.event_registrations (event_id);

-- Helper: does the current user manage this event (admin, or faculty editor who
-- created it)? Own-event scope per user direction 2026-11-03.
create or replace function public.can_manage_event(target_event uuid)
returns boolean language sql stable security definer
set search_path = public as $$
  select public.is_admin() or (
    public.is_faculty_editor()
    and exists (select 1 from public.events e
                where e.id = target_event and e.created_by = auth.uid())
  )
$$;

-- Students self-register for PUBLISHED events only, as themselves, and can
-- never pre-set attendance.
create policy registrations_student_insert on public.event_registrations for insert to authenticated
  with check (
    user_id = auth.uid()
    and attendance_status is null
    and exists (select 1 from public.events e where e.id = event_id and e.published)
  );

-- A student reads only their own registration rows.
create policy registrations_self_read on public.event_registrations for select to authenticated
  using (user_id = auth.uid());

-- Event managers read the full registration list for their events.
create policy registrations_manager_read on public.event_registrations for select to authenticated
  using (public.can_manage_event(event_id));

-- Event managers mark/edit attendance (and correct registration rows) for their
-- own events. Students get no update policy at all, so they cannot edit after
-- registering.
create policy registrations_manager_update on public.event_registrations for update to authenticated
  using (public.can_manage_event(event_id))
  with check (public.can_manage_event(event_id));

-- Only admins can delete a registration row.
create policy registrations_admin_delete on public.event_registrations for delete to authenticated
  using (public.is_admin());

-- Guard trigger: attendance fields only by event managers, and the
-- event/student identity of a row is admin-only to change. Defense in depth on
-- top of the RLS policies above.
create or replace function public.guard_registration()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.attendance_status is not null and not public.can_manage_event(new.event_id) then
      raise exception 'attendance can only be set by the event faculty or an admin';
    end if;
    return new;
  end if;
  if (new.event_id is distinct from old.event_id or new.user_id is distinct from old.user_id)
     and not public.is_admin() then
    raise exception 'registration event and student cannot be changed';
  end if;
  if (new.attendance_status is distinct from old.attendance_status
      or new.attendance_marked_by is distinct from old.attendance_marked_by
      or new.attendance_marked_at is distinct from old.attendance_marked_at)
     and not public.can_manage_event(old.event_id) then
    raise exception 'attendance can only be changed by the event faculty or an admin';
  end if;
  return new;
end $$;
drop trigger if exists registrations_guard on public.event_registrations;
create trigger registrations_guard before insert or update on public.event_registrations
  for each row execute function public.guard_registration();

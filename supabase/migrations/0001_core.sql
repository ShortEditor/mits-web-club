-- MITS Web Club - core schema (drafted from confirmed brief; access model flags below)
-- Publication (draft/published) is SEPARATE from lifecycle status (ongoing/completed/incomplete).

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  short_description text,
  description text,
  poster_path text,
  event_date date,
  start_time time,
  end_time time,
  venue text,
  category text,
  eligibility text,
  rules text,
  guidelines text,
  schedule text,
  prizes text,
  external_registration_url text,
  -- lifecycle: what stage the event itself is in (three only, per brief)
  lifecycle text not null default 'ongoing' check (lifecycle in ('ongoing','completed','incomplete')),
  -- publication: whether it is visible publicly at all
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_documents (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade unique,  -- one documentation record per event
  objectives text,
  activities text,
  outcomes text,
  winners text,
  organizing_team text,
  participation_summary text,
  acknowledgements text,
  report_content text,
  pdf_path text,
  published boolean not null default false,   -- publication flag kept, but access is admin-only per updated brief
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_gallery_images (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  image_path text not null,
  caption text,
  alt_text text,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Members: registered viewers - students AND faculty (faculty are viewers, not
-- automatically admins). Roll-number accounts for students, registered by admin
-- (no self-registration). Faculty rows may omit roll_number/section.
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),  -- matches auth.users id once activated
  role text not null default 'student' check (role in ('student','faculty')),
  roll_number text unique,                        -- required for students, optional for faculty
  name text not null,
  department text,
  section text,
  activated boolean not null default false,       -- true once they set their own password
  created_at timestamptz not null default now()
);

-- Per-event participant registry: name, roll, department, section (no phone/email, no attendance)
create table if not exists public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  student_id uuid references public.members(id) on delete set null,
  roll_number text not null,
  name text not null,
  department text,
  section text,
  created_at timestamptz not null default now(),
  unique (event_id, roll_number)
);

-- Admin role marker: user ids allowed to administer. Seeded manually with the first admin's user id.
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean language sql stable security definer
set search_path = public as $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;

alter table public.events enable row level security;
alter table public.event_documents enable row level security;
alter table public.event_gallery_images enable row level security;
alter table public.members enable row level security;
alter table public.event_participants enable row level security;
alter table public.admins enable row level security;

-- EVENTS: VIEWER ELIGIBILITY HOLD (2026-11-03): who may view (roster vs college
-- domain vs open signup) is NOT decided by the club yet. Until it is, reads are
-- admin-only so the first real event cannot silently go public. When decided,
-- replace this policy: roster -> join members; open signup -> published or is_admin().
create policy events_admin_read on public.events for select to authenticated
  using (public.is_admin());
create policy events_admin_write on public.events for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- DOCUMENTS: ADMIN ONLY (updated brief: documentation shown to admin only).
create policy docs_admin_all on public.event_documents for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- GALLERY: same eligibility hold as events - admin-only until the viewer model is decided.
create policy gallery_admin_read on public.event_gallery_images for select to authenticated
  using (public.is_admin());
create policy gallery_admin_write on public.event_gallery_images for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- MEMBERS: roster readable by admins; a member reads only their own row. Admin-managed.
create policy members_admin_all on public.members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy members_self_read on public.members for select to authenticated
  using (id = auth.uid());

-- PARTICIPANTS: admin-managed. Students may NOT browse other students' participant
-- data; a student sees only rows linked to their own student record.
create policy participants_admin_all on public.event_participants for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy participants_self_read on public.event_participants for select to authenticated
  using (student_id = auth.uid());

-- ADMINS table: only existing admins can see/manage it (first admin seeded via SQL in dashboard).
create policy admins_admin_read on public.admins for select to authenticated using (public.is_admin());

create index if not exists events_published_date_idx on public.events (published, event_date desc);
create index if not exists gallery_event_idx on public.event_gallery_images (event_id, display_order);
create index if not exists participants_event_idx on public.event_participants (event_id);

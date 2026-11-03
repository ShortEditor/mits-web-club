-- Admin management: an existing admin can grant admin to another registered
-- account by email, and see the current admin list. Server-enforced via
-- security-definer functions; normal users cannot self-escalate (is_admin
-- gate runs first). Unregistered emails return no_account - no auto-grant,
-- no user creation.

create or replace function public.add_admin_by_email(target_email text)
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
  insert into public.admins (user_id) values (target) on conflict do nothing;
  return json_build_object('added', true, 'user_id', target);
end;
$$;

create or replace function public.admin_directory()
returns table (user_id uuid, email text, created_at timestamptz)
language sql stable security definer
set search_path = public as $$
  select a.user_id, u.email::text, a.created_at
  from public.admins a join auth.users u on u.id = a.user_id
  where public.is_admin()
  order by a.created_at;
$$;

revoke all on function public.add_admin_by_email(text) from public, anon;
revoke all on function public.admin_directory() from public, anon;
grant execute on function public.add_admin_by_email(text) to authenticated;
grant execute on function public.admin_directory() to authenticated;

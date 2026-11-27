create or replace function public.super_admin_promote_user_to_admin(
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.user_profiles p
    where p.id = (select auth.uid())
      and p.account_status = 'Active'
      and p.role = 'Super Admin'
  ) then
    raise exception 'Only an active Super Admin can promote users to Admin';
  end if;

  if target_user_id = (select auth.uid()) then
    raise exception 'A Super Admin cannot promote their own account';
  end if;

  update public.user_profiles
  set role = 'Admin',
      verified = true,
      updated_at = now()
  where id = target_user_id
    and account_status = 'Active'
    and role in (
      'Participant',
      'Volunteer',
      'Judge',
      'Guest',
      'Sponsor',
      'Mentor',
      'Admin'
    );

  if not found then
    raise exception 'Only another active non-administrator account can be promoted';
  end if;
end;
$$;

revoke all on function public.super_admin_promote_user_to_admin(uuid) from public;
grant execute on function public.super_admin_promote_user_to_admin(uuid) to authenticated;

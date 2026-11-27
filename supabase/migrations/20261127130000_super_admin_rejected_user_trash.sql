alter table public.user_profiles
  add column if not exists trashed_at timestamptz;

create or replace function public.review_user_registration(
  target_user_id uuid,
  approve boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_active_staff() then
    raise exception 'Only active staff can review registrations';
  end if;

  update public.user_profiles
  set account_status = case when approve then 'Active' else 'Rejected' end,
      role = case when approve then requested_role else role end,
      verified = approve,
      updated_at = now()
  where id = target_user_id
    and trashed_at is null
    and (
      account_status = 'Pending Approval'
      or (approve and account_status = 'Rejected')
    );

  if not found then
    raise exception 'Pending or rejected user profile was not found';
  end if;
end;
$$;

create or replace function public.super_admin_trash_rejected_user(
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
    raise exception 'Only an active Super Admin can move accounts to Trash';
  end if;

  update public.user_profiles
  set trashed_at = now(),
      updated_at = now()
  where id = target_user_id
    and account_status = 'Rejected'
    and trashed_at is null;

  if not found then
    raise exception 'Only a rejected account can be moved to Trash';
  end if;
end;
$$;

create or replace function public.super_admin_restore_rejected_user(
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
    raise exception 'Only an active Super Admin can restore accounts from Trash';
  end if;

  update public.user_profiles
  set trashed_at = null,
      updated_at = now()
  where id = target_user_id
    and account_status = 'Rejected'
    and trashed_at is not null;

  if not found then
    raise exception 'Trashed rejected account was not found';
  end if;
end;
$$;

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
      'Organizer',
      'Participant',
      'Volunteer',
      'Judge',
      'Guest',
      'Sponsor',
      'Mentor',
      'Admin'
    );

  if not found then
    raise exception 'Only another active non-Super-Admin account can be promoted';
  end if;
end;
$$;

revoke all on function public.review_user_registration(uuid, boolean) from public;
grant execute on function public.review_user_registration(uuid, boolean) to authenticated;

revoke all on function public.super_admin_trash_rejected_user(uuid) from public;
grant execute on function public.super_admin_trash_rejected_user(uuid) to authenticated;

revoke all on function public.super_admin_restore_rejected_user(uuid) from public;
grant execute on function public.super_admin_restore_rejected_user(uuid) to authenticated;

revoke all on function public.super_admin_promote_user_to_admin(uuid) from public;
grant execute on function public.super_admin_promote_user_to_admin(uuid) to authenticated;

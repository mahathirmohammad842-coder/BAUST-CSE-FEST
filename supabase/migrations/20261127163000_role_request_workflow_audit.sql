alter table public.user_profiles
  add column if not exists verification_status text not null default 'Pending',
  add column if not exists last_login_at timestamptz,
  add column if not exists can_manage_approvals boolean not null default false,
  add column if not exists recommended_action text,
  add column if not exists recommended_role text,
  add column if not exists recommended_by uuid references auth.users (id) on delete set null,
  add column if not exists recommended_by_name text,
  add column if not exists recommendation_notes text,
  add column if not exists recommended_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_profiles_verification_status_check'
  ) then
    alter table public.user_profiles
      add constraint user_profiles_verification_status_check
      check (verification_status in ('Pending', 'Verified', 'Rejected'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'user_profiles_recommended_action_check'
  ) then
    alter table public.user_profiles
      add constraint user_profiles_recommended_action_check
      check (recommended_action is null or recommended_action in ('Approve', 'Reject'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'user_profiles_recommended_role_check'
  ) then
    alter table public.user_profiles
      add constraint user_profiles_recommended_role_check
      check (
        recommended_role is null or recommended_role in (
          'Participant', 'Volunteer', 'Judge', 'Guest',
          'Sponsor', 'Mentor', 'Organizer', 'Admin', 'Super Admin'
        )
      );
  end if;
end $$;

update public.user_profiles
set verification_status = case
  when verified = true then 'Verified'
  when account_status = 'Rejected' then 'Rejected'
  else 'Pending'
end
where verification_status = 'Pending'
  and (verified = true or account_status = 'Rejected');

create table if not exists public.role_change_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  user_email text not null default '',
  user_name text not null default '',
  previous_role text not null,
  new_role text not null,
  changed_by uuid references auth.users (id) on delete set null,
  changed_by_name text not null default '',
  changed_at timestamptz not null default now(),
  notes text not null default ''
);

create table if not exists public.approval_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  user_email text not null default '',
  user_name text not null default '',
  action text not null
    check (action in ('approved', 'rejected', 'recommended', 'status_changed', 'permission_granted', 'permission_revoked')),
  requested_role text not null default '',
  assigned_role text not null default '',
  previous_status text not null default '',
  new_status text not null default '',
  actor_id uuid references auth.users (id) on delete set null,
  actor_name text not null default '',
  created_at timestamptz not null default now(),
  approval_notes text not null default ''
);

create table if not exists public.verification_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  user_email text not null default '',
  user_name text not null default '',
  previous_status text not null,
  new_status text not null
    check (new_status in ('Pending', 'Verified', 'Rejected')),
  verified_by uuid references auth.users (id) on delete set null,
  verified_by_name text not null default '',
  verified_at timestamptz not null default now(),
  verification_notes text not null default ''
);

create index if not exists idx_role_change_logs_user_time
  on public.role_change_logs (user_id, changed_at desc);
create index if not exists idx_approval_logs_user_time
  on public.approval_logs (user_id, created_at desc);
create index if not exists idx_verification_logs_user_time
  on public.verification_logs (user_id, verified_at desc);

alter table public.role_change_logs enable row level security;
alter table public.approval_logs enable row level security;
alter table public.verification_logs enable row level security;

revoke all on public.role_change_logs from anon, authenticated;
revoke all on public.approval_logs from anon, authenticated;
revoke all on public.verification_logs from anon, authenticated;

grant select on public.role_change_logs to authenticated;
grant select on public.approval_logs to authenticated;
grant select on public.verification_logs to authenticated;

drop policy if exists "Staff read role change logs and users read own" on public.role_change_logs;
create policy "Staff read role change logs and users read own"
  on public.role_change_logs for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_active_staff()));

drop policy if exists "Staff read approval logs and users read own" on public.approval_logs;
create policy "Staff read approval logs and users read own"
  on public.approval_logs for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_active_staff()));

drop policy if exists "Staff read verification logs and users read own" on public.verification_logs;
create policy "Staff read verification logs and users read own"
  on public.verification_logs for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_active_staff()));

-- Ensure every newly registered user always starts with Assigned Role = Participant,
-- Verification Status = Pending, Account Status = Pending Approval.
create or replace function public.create_user_profile_on_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text := coalesce(new.raw_user_meta_data ->> 'requested_role', 'Participant');
begin
  if requested not in ('Participant', 'Volunteer', 'Judge', 'Guest', 'Sponsor', 'Mentor') then
    requested := 'Participant';
  end if;

  insert into public.user_profiles (
    id, full_name, email, phone, role, requested_role, department,
    institution, account_status, verified, verification_status
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    'Participant',
    requested,
    coalesce(new.raw_user_meta_data ->> 'department', ''),
    coalesce(new.raw_user_meta_data ->> 'institution', ''),
    'Pending Approval',
    false,
    'Pending'
  );
  return new;
end;
$$;

create or replace function public.is_active_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_profiles p
    where p.id = (select auth.uid())
      and p.account_status = 'Active'
      and p.role = 'Super Admin'
  );
$$;

revoke all on function public.is_active_super_admin() from public;
grant execute on function public.is_active_super_admin() to authenticated;

create or replace function public.record_my_last_login()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.user_profiles
  set last_login_at = now()
  where id = (select auth.uid());
end;
$$;

revoke all on function public.record_my_last_login() from public;
grant execute on function public.record_my_last_login() to authenticated;

create or replace function public.organizer_recommend_registration(
  target_user_id uuid,
  recommendation text,
  suggested_role text default null,
  notes text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile public.user_profiles%rowtype;
  target_profile public.user_profiles%rowtype;
  clean_role text;
begin
  select * into actor_profile
  from public.user_profiles
  where id = (select auth.uid())
    and account_status = 'Active'
    and role in ('Organizer', 'Super Admin');

  if not found then
    raise exception 'Only an active Organizer or Super Admin can submit a recommendation';
  end if;

  if target_user_id = actor_profile.id then
    raise exception 'Users cannot recommend changes for their own account';
  end if;

  if recommendation not in ('Approve', 'Reject') then
    raise exception 'Invalid recommendation action';
  end if;

  select * into target_profile
  from public.user_profiles
  where id = target_user_id
    and trashed_at is null;

  if not found then
    raise exception 'User profile was not found';
  end if;

  clean_role := coalesce(nullif(trim(coalesce(suggested_role, '')), ''), target_profile.requested_role);

  if actor_profile.role <> 'Super Admin' then
    if clean_role not in ('Participant', 'Volunteer', 'Judge', 'Guest', 'Sponsor', 'Mentor') then
      raise exception 'Organizers cannot recommend Organizer, Admin, or Super Admin roles';
    end if;
  elsif clean_role not in ('Participant', 'Volunteer', 'Judge', 'Guest', 'Sponsor', 'Mentor', 'Organizer', 'Admin', 'Super Admin') then
    raise exception 'Invalid suggested role';
  end if;

  update public.user_profiles
  set recommended_action = recommendation,
      recommended_role = clean_role,
      recommended_by = actor_profile.id,
      recommended_by_name = actor_profile.full_name,
      recommendation_notes = coalesce(notes, ''),
      recommended_at = now(),
      updated_at = now()
  where id = target_user_id;

  insert into public.approval_logs (
    user_id, user_email, user_name, action, requested_role, assigned_role,
    previous_status, new_status, actor_id, actor_name, approval_notes
  ) values (
    target_profile.id,
    target_profile.email,
    target_profile.full_name,
    'recommended',
    target_profile.requested_role,
    clean_role,
    target_profile.account_status,
    target_profile.account_status,
    actor_profile.id,
    actor_profile.full_name,
    trim(concat('[Recommend ', recommendation, '] ', coalesce(notes, '')))
  );
end;
$$;

revoke all on function public.organizer_recommend_registration(uuid, text, text, text) from public;
grant execute on function public.organizer_recommend_registration(uuid, text, text, text) to authenticated;

drop function if exists public.review_user_registration(uuid, boolean);

create or replace function public.review_user_registration(
  target_user_id uuid,
  approve boolean,
  assigned_role text default null,
  approval_notes text default '',
  mark_verified boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile public.user_profiles%rowtype;
  target_profile public.user_profiles%rowtype;
  next_role text;
  next_status text;
  next_verification text;
begin
  select * into actor_profile
  from public.user_profiles
  where id = (select auth.uid())
    and account_status = 'Active'
    and role in ('Organizer', 'Super Admin');

  if not found then
    raise exception 'Only an active Super Admin or authorized Organizer can review registrations';
  end if;

  if actor_profile.role <> 'Super Admin' and not coalesce(actor_profile.can_manage_approvals, false) then
    raise exception 'Organizer does not have permission to change approval status. Submit a recommendation or verify details instead.';
  end if;

  if target_user_id = actor_profile.id then
    raise exception 'Users cannot approve, reject, or assign roles to themselves';
  end if;

  select * into target_profile
  from public.user_profiles
  where id = target_user_id
    and trashed_at is null
    and (
      account_status = 'Pending Approval'
      or (approve and account_status = 'Rejected')
    );

  if not found then
    raise exception 'Pending or rejected user profile was not found';
  end if;

  if target_profile.role = 'Super Admin' then
    raise exception 'Super Admin accounts cannot be modified via registration review';
  end if;

  next_status := case when approve then 'Active' else 'Rejected' end;

  if approve then
    next_role := coalesce(nullif(trim(coalesce(assigned_role, '')), ''), target_profile.requested_role);
    if actor_profile.role <> 'Super Admin' then
      if next_role not in ('Participant', 'Volunteer', 'Judge', 'Guest', 'Sponsor', 'Mentor') then
        raise exception 'Only a Super Admin can assign Organizer, Admin, or Super Admin roles';
      end if;
    elsif next_role not in ('Participant', 'Volunteer', 'Judge', 'Guest', 'Sponsor', 'Mentor', 'Organizer', 'Admin', 'Super Admin') then
      raise exception 'Unsupported assigned role';
    end if;
  else
    next_role := target_profile.role;
  end if;

  next_verification := case
    when approve and mark_verified then 'Verified'
    when not approve and target_profile.verification_status = 'Pending' then 'Rejected'
    else target_profile.verification_status
  end;

  update public.user_profiles
  set account_status = next_status,
      role = next_role,
      verification_status = next_verification,
      verified = (next_verification = 'Verified'),
      updated_at = now()
  where id = target_user_id;

  insert into public.approval_logs (
    user_id, user_email, user_name, action, requested_role, assigned_role,
    previous_status, new_status, actor_id, actor_name, approval_notes
  ) values (
    target_profile.id,
    target_profile.email,
    target_profile.full_name,
    case when approve then 'approved' else 'rejected' end,
    target_profile.requested_role,
    next_role,
    target_profile.account_status,
    next_status,
    actor_profile.id,
    actor_profile.full_name,
    coalesce(approval_notes, '')
  );

  if target_profile.role <> next_role then
    insert into public.role_change_logs (
      user_id, user_email, user_name, previous_role, new_role,
      changed_by, changed_by_name, notes
    ) values (
      target_profile.id,
      target_profile.email,
      target_profile.full_name,
      target_profile.role,
      next_role,
      actor_profile.id,
      actor_profile.full_name,
      coalesce(nullif(trim(coalesce(approval_notes, '')), ''), 'Assigned during registration approval')
    );
  end if;

  if target_profile.verification_status <> next_verification then
    insert into public.verification_logs (
      user_id, user_email, user_name, previous_status, new_status,
      verified_by, verified_by_name, verification_notes
    ) values (
      target_profile.id,
      target_profile.email,
      target_profile.full_name,
      target_profile.verification_status,
      next_verification,
      actor_profile.id,
      actor_profile.full_name,
      coalesce(approval_notes, '')
    );
  end if;
end;
$$;

revoke all on function public.review_user_registration(uuid, boolean, text, text, boolean) from public;
grant execute on function public.review_user_registration(uuid, boolean, text, text, boolean) to authenticated;

create or replace function public.super_admin_assign_user_role(
  target_user_id uuid,
  new_role text,
  role_notes text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile public.user_profiles%rowtype;
  target_profile public.user_profiles%rowtype;
begin
  select * into actor_profile
  from public.user_profiles
  where id = (select auth.uid())
    and account_status = 'Active'
    and role = 'Super Admin';

  if not found then
    raise exception 'Only an active Super Admin can change user roles';
  end if;

  if target_user_id = actor_profile.id then
    raise exception 'Users cannot change or promote their own role';
  end if;

  if new_role not in ('Participant', 'Volunteer', 'Judge', 'Guest', 'Sponsor', 'Mentor', 'Organizer', 'Admin', 'Super Admin') then
    raise exception 'Unsupported role';
  end if;

  select * into target_profile
  from public.user_profiles
  where id = target_user_id
    and trashed_at is null;

  if not found then
    raise exception 'Target user profile was not found';
  end if;

  if target_profile.role = new_role then
    return;
  end if;

  update public.user_profiles
  set role = new_role,
      can_manage_approvals = case
        when new_role in ('Organizer', 'Super Admin') then can_manage_approvals
        else false
      end,
      updated_at = now()
  where id = target_user_id;

  insert into public.role_change_logs (
    user_id, user_email, user_name, previous_role, new_role,
    changed_by, changed_by_name, notes
  ) values (
    target_profile.id,
    target_profile.email,
    target_profile.full_name,
    target_profile.role,
    new_role,
    actor_profile.id,
    actor_profile.full_name,
    coalesce(role_notes, '')
  );
end;
$$;

revoke all on function public.super_admin_assign_user_role(uuid, text, text) from public;
grant execute on function public.super_admin_assign_user_role(uuid, text, text) to authenticated;

create or replace function public.super_admin_bulk_assign_roles(
  target_user_ids uuid[],
  new_role text,
  role_notes text default ''
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile public.user_profiles%rowtype;
  target_profile public.user_profiles%rowtype;
  updated_count integer := 0;
begin
  select * into actor_profile
  from public.user_profiles
  where id = (select auth.uid())
    and account_status = 'Active'
    and role = 'Super Admin';

  if not found then
    raise exception 'Only an active Super Admin can bulk assign user roles';
  end if;

  if new_role not in ('Participant', 'Volunteer', 'Judge', 'Guest', 'Sponsor', 'Mentor', 'Organizer', 'Admin', 'Super Admin') then
    raise exception 'Unsupported role';
  end if;

  for target_profile in
    select *
    from public.user_profiles
    where id = any(target_user_ids)
      and id <> actor_profile.id
      and trashed_at is null
  loop
    if target_profile.role <> new_role then
      update public.user_profiles
      set role = new_role,
          can_manage_approvals = case
            when new_role in ('Organizer', 'Super Admin') then can_manage_approvals
            else false
          end,
          updated_at = now()
      where id = target_profile.id;

      insert into public.role_change_logs (
        user_id, user_email, user_name, previous_role, new_role,
        changed_by, changed_by_name, notes
      ) values (
        target_profile.id,
        target_profile.email,
        target_profile.full_name,
        target_profile.role,
        new_role,
        actor_profile.id,
        actor_profile.full_name,
        coalesce(nullif(trim(coalesce(role_notes, '')), ''), 'Bulk role assignment')
      );
      updated_count := updated_count + 1;
    end if;
  end loop;

  return updated_count;
end;
$$;

revoke all on function public.super_admin_bulk_assign_roles(uuid[], text, text) from public;
grant execute on function public.super_admin_bulk_assign_roles(uuid[], text, text) to authenticated;

create or replace function public.staff_update_verification_status(
  target_user_id uuid,
  new_status text,
  verification_notes text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile public.user_profiles%rowtype;
  target_profile public.user_profiles%rowtype;
begin
  select * into actor_profile
  from public.user_profiles
  where id = (select auth.uid())
    and account_status = 'Active'
    and role in ('Organizer', 'Admin', 'Super Admin');

  if not found then
    raise exception 'Only active staff can verify user information';
  end if;

  if target_user_id = actor_profile.id then
    raise exception 'Users cannot change their own verification status';
  end if;

  if new_status not in ('Pending', 'Verified', 'Rejected') then
    raise exception 'Unsupported verification status';
  end if;

  select * into target_profile
  from public.user_profiles
  where id = target_user_id
    and trashed_at is null;

  if not found then
    raise exception 'Target user profile was not found';
  end if;

  if target_profile.role = 'Super Admin' and actor_profile.role <> 'Super Admin' then
    raise exception 'Only a Super Admin can modify a Super Admin verification state';
  end if;

  update public.user_profiles
  set verification_status = new_status,
      verified = (new_status = 'Verified'),
      updated_at = now()
  where id = target_user_id;

  insert into public.verification_logs (
    user_id, user_email, user_name, previous_status, new_status,
    verified_by, verified_by_name, verification_notes
  ) values (
    target_profile.id,
    target_profile.email,
    target_profile.full_name,
    target_profile.verification_status,
    new_status,
    actor_profile.id,
    actor_profile.full_name,
    coalesce(verification_notes, '')
  );
end;
$$;

revoke all on function public.staff_update_verification_status(uuid, text, text) from public;
grant execute on function public.staff_update_verification_status(uuid, text, text) to authenticated;

create or replace function public.staff_bulk_verify_users(
  target_user_ids uuid[],
  new_status text,
  verification_notes text default ''
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile public.user_profiles%rowtype;
  target_profile public.user_profiles%rowtype;
  updated_count integer := 0;
begin
  select * into actor_profile
  from public.user_profiles
  where id = (select auth.uid())
    and account_status = 'Active'
    and role in ('Organizer', 'Admin', 'Super Admin');

  if not found then
    raise exception 'Only active staff can verify users';
  end if;

  if new_status not in ('Pending', 'Verified', 'Rejected') then
    raise exception 'Unsupported verification status';
  end if;

  for target_profile in
    select *
    from public.user_profiles
    where id = any(target_user_ids)
      and id <> actor_profile.id
      and trashed_at is null
      and (role <> 'Super Admin' or actor_profile.role = 'Super Admin')
  loop
    if target_profile.verification_status <> new_status then
      update public.user_profiles
      set verification_status = new_status,
          verified = (new_status = 'Verified'),
          updated_at = now()
      where id = target_profile.id;

      insert into public.verification_logs (
        user_id, user_email, user_name, previous_status, new_status,
        verified_by, verified_by_name, verification_notes
      ) values (
        target_profile.id,
        target_profile.email,
        target_profile.full_name,
        target_profile.verification_status,
        new_status,
        actor_profile.id,
        actor_profile.full_name,
        coalesce(nullif(trim(coalesce(verification_notes, '')), ''), 'Bulk verification')
      );
      updated_count := updated_count + 1;
    end if;
  end loop;

  return updated_count;
end;
$$;

revoke all on function public.staff_bulk_verify_users(uuid[], text, text) from public;
grant execute on function public.staff_bulk_verify_users(uuid[], text, text) to authenticated;

create or replace function public.super_admin_set_organizer_approval_permission(
  target_user_id uuid,
  granted boolean,
  permission_notes text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile public.user_profiles%rowtype;
  target_profile public.user_profiles%rowtype;
begin
  select * into actor_profile
  from public.user_profiles
  where id = (select auth.uid())
    and account_status = 'Active'
    and role = 'Super Admin';

  if not found then
    raise exception 'Only an active Super Admin can configure organizer approval permissions';
  end if;

  if target_user_id = actor_profile.id then
    raise exception 'Users cannot modify their own permission flags';
  end if;

  select * into target_profile
  from public.user_profiles
  where id = target_user_id
    and role = 'Organizer'
    and trashed_at is null;

  if not found then
    raise exception 'Target Organizer profile was not found';
  end if;

  update public.user_profiles
  set can_manage_approvals = granted,
      updated_at = now()
  where id = target_user_id;

  insert into public.approval_logs (
    user_id, user_email, user_name, action, requested_role, assigned_role,
    previous_status, new_status, actor_id, actor_name, approval_notes
  ) values (
    target_profile.id,
    target_profile.email,
    target_profile.full_name,
    case when granted then 'permission_granted' else 'permission_revoked' end,
    target_profile.requested_role,
    target_profile.role,
    target_profile.account_status,
    target_profile.account_status,
    actor_profile.id,
    actor_profile.full_name,
    coalesce(nullif(trim(coalesce(permission_notes, '')), ''),
      case when granted
        then 'Granted Organizer permission to approve/reject non-privileged role requests'
        else 'Revoked Organizer approval status permission'
      end
    )
  );
end;
$$;

revoke all on function public.super_admin_set_organizer_approval_permission(uuid, boolean, text) from public;
grant execute on function public.super_admin_set_organizer_approval_permission(uuid, boolean, text) to authenticated;

-- Keep legacy admin_update_profile_flags and super_admin_promote_user_to_admin synchronized with audit tables.
create or replace function public.admin_update_profile_flags(
  target_user_id uuid,
  new_account_status text default null,
  new_verified boolean default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile public.user_profiles%rowtype;
  target_profile public.user_profiles%rowtype;
  next_verification text;
begin
  select * into actor_profile
  from public.user_profiles
  where id = (select auth.uid())
    and account_status = 'Active'
    and role in ('Organizer', 'Admin', 'Super Admin');

  if not found then
    raise exception 'Only active staff can manage profiles';
  end if;

  if target_user_id = actor_profile.id then
    raise exception 'Users cannot change their own verification or status flags';
  end if;

  if new_account_status is not null
    and new_account_status not in ('Active', 'Suspended') then
    raise exception 'Unsupported account status';
  end if;

  if new_account_status is not null
    and actor_profile.role <> 'Super Admin'
    and not (
      actor_profile.role = 'Organizer'
      and coalesce(actor_profile.can_manage_approvals, false)
    ) then
    raise exception 'Account status changes require Super Admin or delegated Organizer permission';
  end if;

  select * into target_profile
  from public.user_profiles
  where id = target_user_id;

  if not found then
    raise exception 'User profile was not found';
  end if;

  if target_profile.role = 'Super Admin' and actor_profile.role <> 'Super Admin' then
    raise exception 'Only a Super Admin can modify a Super Admin account';
  end if;

  next_verification := case
    when new_verified is null then target_profile.verification_status
    when new_verified then 'Verified'
    else 'Pending'
  end;

  update public.user_profiles
  set account_status = coalesce(new_account_status, account_status),
      verified = coalesce(new_verified, verified),
      verification_status = next_verification,
      updated_at = now()
  where id = target_user_id;

  if new_account_status is not null and new_account_status <> target_profile.account_status then
    insert into public.approval_logs (
      user_id, user_email, user_name, action, requested_role, assigned_role,
      previous_status, new_status, actor_id, actor_name, approval_notes
    ) values (
      target_profile.id, target_profile.email, target_profile.full_name,
      'status_changed', target_profile.requested_role, target_profile.role,
      target_profile.account_status, new_account_status,
      actor_profile.id, actor_profile.full_name,
      'Account status updated'
    );
  end if;

  if new_verified is not null and next_verification <> target_profile.verification_status then
    insert into public.verification_logs (
      user_id, user_email, user_name, previous_status, new_status,
      verified_by, verified_by_name, verification_notes
    ) values (
      target_profile.id, target_profile.email, target_profile.full_name,
      target_profile.verification_status, next_verification,
      actor_profile.id, actor_profile.full_name,
      case when new_verified then 'Marked as Verified' else 'Verification reset to Pending' end
    );
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
declare
  actor_profile public.user_profiles%rowtype;
  target_profile public.user_profiles%rowtype;
begin
  select * into actor_profile
  from public.user_profiles
  where id = (select auth.uid())
    and account_status = 'Active'
    and role = 'Super Admin';

  if not found then
    raise exception 'Only an active Super Admin can promote users to Admin';
  end if;

  if target_user_id = actor_profile.id then
    raise exception 'A Super Admin cannot promote their own account';
  end if;

  select * into target_profile
  from public.user_profiles
  where id = target_user_id
    and account_status = 'Active'
    and role in (
      'Organizer', 'Participant', 'Volunteer', 'Judge', 'Guest', 'Sponsor', 'Mentor', 'Admin'
    );

  if not found then
    raise exception 'Only another active non-Super-Admin account can be promoted';
  end if;

  update public.user_profiles
  set role = 'Admin',
      verified = true,
      verification_status = 'Verified',
      updated_at = now()
  where id = target_user_id;

  if target_profile.role <> 'Admin' then
    insert into public.role_change_logs (
      user_id, user_email, user_name, previous_role, new_role,
      changed_by, changed_by_name, notes
    ) values (
      target_profile.id, target_profile.email, target_profile.full_name,
      target_profile.role, 'Admin', actor_profile.id, actor_profile.full_name,
      'Promoted to Admin by Super Admin'
    );
  end if;
end;
$$;

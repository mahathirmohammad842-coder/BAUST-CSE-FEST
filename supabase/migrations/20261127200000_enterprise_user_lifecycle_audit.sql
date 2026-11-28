-- Enterprise User Lifecycle Management (Soft Delete, Archive, Restore, Permanent Delete Audit)
-- Strict RBAC enforcement across Super Admin and Organizer roles

-- 1. Expand user_profiles lifecycle columns and account_status check constraint
alter table public.user_profiles
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users (id) on delete set null,
  add column if not exists deleted_by_name text not null default '',
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users (id) on delete set null,
  add column if not exists archived_by_name text not null default '',
  add column if not exists restored_at timestamptz,
  add column if not exists restored_by uuid references auth.users (id) on delete set null,
  add column if not exists restored_by_name text not null default '';

alter table public.user_profiles
  drop constraint if exists user_profiles_account_status_check;

alter table public.user_profiles
  add constraint user_profiles_account_status_check
    check (account_status in ('Active', 'Suspended', 'Rejected', 'Archived', 'Deleted'));

create index if not exists idx_user_profiles_is_deleted
  on public.user_profiles (is_deleted, deleted_at desc);

create index if not exists idx_user_profiles_is_archived
  on public.user_profiles (is_archived, archived_at desc);

-- 2. Extend role_permissions with lifecycle governance flags
alter table public.role_permissions
  add column if not exists can_archive_users boolean not null default false,
  add column if not exists can_soft_delete_users boolean not null default false,
  add column if not exists can_restore_users boolean not null default false,
  add column if not exists can_permanently_delete_users boolean not null default false;

update public.role_permissions
set can_archive_users = (role in ('Super Admin', 'Organizer')),
    can_soft_delete_users = (role in ('Super Admin', 'Organizer')),
    can_restore_users = (role = 'Super Admin'),
    can_permanently_delete_users = (role = 'Super Admin'),
    updated_at = now();

-- 3. Immutable Deletion & Restoration Audit Log Table
-- target_user_id is intentionally NOT a cascading foreign key so audit history survives permanent auth deletion.
create table if not exists public.user_deletion_audit_logs (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null,
  target_user_email text not null default '',
  target_user_name text not null default '',
  target_user_role text not null default 'Participant',
  action text not null
    check (action in ('soft_deleted', 'archived', 'restored', 'unarchived', 'permanently_deleted')),
  actor_id uuid references auth.users (id) on delete set null,
  actor_name text not null default '',
  notes text not null default '',
  deleted_at timestamptz,
  restored_at timestamptz,
  restored_by uuid references auth.users (id) on delete set null,
  restored_by_name text not null default '',
  permanently_deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_deletion_audit_logs_created
  on public.user_deletion_audit_logs (created_at desc);
create index if not exists idx_user_deletion_audit_logs_target
  on public.user_deletion_audit_logs (target_user_id, created_at desc);

alter table public.user_deletion_audit_logs enable row level security;
revoke all on public.user_deletion_audit_logs from public, anon, authenticated;
grant select on public.user_deletion_audit_logs to authenticated;

drop policy if exists "Staff read deletion audit logs" on public.user_deletion_audit_logs;
create policy "Staff read deletion audit logs"
  on public.user_deletion_audit_logs for select to authenticated
  using ((select public.is_active_staff()));

-- 4. Harden active staff helpers so deleted or archived accounts immediately lose privileges
create or replace function public.is_active_staff()
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
      and p.approval_status = 'Approved'
      and not coalesce(p.is_deleted, false)
      and not coalesce(p.is_archived, false)
      and p.role in ('Organizer', 'Super Admin')
  );
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
      and p.approval_status = 'Approved'
      and not coalesce(p.is_deleted, false)
      and not coalesce(p.is_archived, false)
      and p.role = 'Super Admin'
  );
$$;

-- Tighten announcements select policy so deleted/archived users cannot read notices
drop policy if exists "Active users read announcements" on public.announcements;
create policy "Active users read announcements"
  on public.announcements for select to authenticated
  using (
    (select public.is_active_staff())
    or exists (
      select 1
      from public.user_profiles p
      where p.id = (select auth.uid())
        and p.account_status = 'Active'
        and p.approval_status <> 'Rejected'
        and not coalesce(p.is_deleted, false)
        and not coalesce(p.is_archived, false)
        and coalesce(payload->>'status', '') = 'Delivered'
        and (
          coalesce((payload->'targeting'->>'everyoneAttending')::boolean, false) = true
          or (
            p.approval_status = 'Pending'
            and coalesce(payload->'targeting'->'roles', '[]'::jsonb) ? 'Participant'
          )
          or (
            p.approval_status = 'Approved'
            and coalesce(payload->'targeting'->'roles', '[]'::jsonb) ? p.role
          )
        )
    )
  );

-- 5. Harden sync_and_guard_user_profile trigger to guard lifecycle fields & Super Admin profiles
create or replace function public.sync_and_guard_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_uid uuid := auth.uid();
  is_bypass boolean := current_setting('app.bypass_profile_guard', true) = 'true';
begin
  new.assigned_role := new.role;
  new.department := btrim(coalesce(new.department, ''));
  new.institution := btrim(coalesce(new.institution, ''));

  if tg_op = 'INSERT' then
    if public.is_email_like(new.department) or lower(new.department) = lower(coalesce(new.email, '')) then
      new.department := '';
    end if;
    if public.is_email_like(new.institution) or lower(new.institution) = lower(coalesce(new.email, '')) then
      new.institution := '';
    end if;
  elsif tg_op = 'UPDATE' then
    if public.is_email_like(new.department) or (new.department <> '' and lower(new.department) = lower(coalesce(new.email, ''))) then
      raise exception 'Department must be a text field and cannot contain an email address';
    end if;
    if public.is_email_like(new.institution) or (new.institution <> '' and lower(new.institution) = lower(coalesce(new.email, ''))) then
      raise exception 'Institution must be a text field and cannot contain an email address';
    end if;

    if caller_uid is not null and not is_bypass then
      if old.role = 'Super Admin' and new.id <> caller_uid and not public.is_active_super_admin() then
        raise exception 'Only a Super Admin can update a Super Admin profile';
      end if;

      if (
        new.id is distinct from old.id
        or new.email is distinct from old.email
        or new.role is distinct from old.role
        or new.assigned_role is distinct from old.assigned_role
        or new.requested_role is distinct from old.requested_role
        or new.approval_status is distinct from old.approval_status
        or new.verification_status is distinct from old.verification_status
        or new.account_status is distinct from old.account_status
        or new.verified is distinct from old.verified
        or new.can_manage_approvals is distinct from old.can_manage_approvals
        or new.trashed_at is distinct from old.trashed_at
        or new.is_deleted is distinct from old.is_deleted
        or new.deleted_at is distinct from old.deleted_at
        or new.deleted_by is distinct from old.deleted_by
        or new.deleted_by_name is distinct from old.deleted_by_name
        or new.is_archived is distinct from old.is_archived
        or new.archived_at is distinct from old.archived_at
        or new.archived_by is distinct from old.archived_by
        or new.archived_by_name is distinct from old.archived_by_name
        or new.restored_at is distinct from old.restored_at
        or new.restored_by is distinct from old.restored_by
        or new.restored_by_name is distinct from old.restored_by_name
      ) then
        if not public.is_active_staff() then
          raise exception 'Privilege escalation blocked: restricted profile fields require authorized staff approval';
        end if;
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- 6. Staff Archive User RPC
create or replace function public.staff_archive_user(
  target_user_id uuid,
  archive_notes text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile public.user_profiles%rowtype;
  target_profile public.user_profiles%rowtype;
  now_ts timestamptz := now();
begin
  select * into actor_profile
  from public.user_profiles
  where id = (select auth.uid())
    and account_status = 'Active'
    and approval_status = 'Approved'
    and not coalesce(is_deleted, false)
    and not coalesce(is_archived, false)
    and role in ('Organizer', 'Super Admin');

  if not found then
    raise exception 'Only an active approved Organizer or Super Admin can archive accounts';
  end if;

  if target_user_id = actor_profile.id then
    raise exception 'Users cannot archive their own account';
  end if;

  select * into target_profile
  from public.user_profiles
  where id = target_user_id;

  if not found then
    raise exception 'Target user profile was not found';
  end if;

  if coalesce(target_profile.is_deleted, false) then
    raise exception 'Deleted accounts cannot be archived; restore the account first';
  end if;

  if target_profile.role = 'Super Admin' then
    raise exception 'Super Admin accounts cannot be archived';
  end if;

  if target_profile.role = 'Organizer' and actor_profile.role <> 'Super Admin' then
    raise exception 'Only a Super Admin can archive Organizer accounts';
  end if;

  perform set_config('app.bypass_profile_guard', 'true', true);

  update public.user_profiles
  set is_archived = true,
      archived_at = now_ts,
      archived_by = actor_profile.id,
      archived_by_name = actor_profile.full_name,
      account_status = 'Archived',
      updated_at = now_ts
  where id = target_user_id;

  insert into public.user_deletion_audit_logs (
    target_user_id, target_user_email, target_user_name, target_user_role,
    action, actor_id, actor_name, notes
  ) values (
    target_profile.id,
    target_profile.email,
    target_profile.full_name,
    target_profile.role,
    'archived',
    actor_profile.id,
    actor_profile.full_name,
    coalesce(nullif(btrim(coalesce(archive_notes, '')), ''), 'Account archived to Recycle Bin')
  );

  insert into public.activity_logs (
    user_id, user_email, user_name, actor_id, actor_name,
    action, category, details
  ) values (
    target_profile.id,
    target_profile.email,
    target_profile.full_name,
    actor_profile.id,
    actor_profile.full_name,
    'account_archived',
    'governance',
    'Account archived by ' || actor_profile.full_name
  );
end;
$$;

revoke all on function public.staff_archive_user(uuid, text) from public;
grant execute on function public.staff_archive_user(uuid, text) to authenticated;

-- 7. Staff Soft-Delete User RPC
create or replace function public.staff_soft_delete_user(
  target_user_id uuid,
  delete_notes text default '',
  is_blocked_account boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile public.user_profiles%rowtype;
  target_profile public.user_profiles%rowtype;
  now_ts timestamptz := now();
begin
  select * into actor_profile
  from public.user_profiles
  where id = (select auth.uid())
    and account_status = 'Active'
    and approval_status = 'Approved'
    and not coalesce(is_deleted, false)
    and not coalesce(is_archived, false)
    and role in ('Organizer', 'Super Admin');

  if not found then
    raise exception 'Only an active approved Organizer or Super Admin can delete accounts';
  end if;

  if target_user_id = actor_profile.id then
    raise exception 'Self deletion is strictly prohibited';
  end if;

  select * into target_profile
  from public.user_profiles
  where id = target_user_id;

  if not found then
    raise exception 'Target user profile was not found';
  end if;

  if target_profile.role = 'Super Admin' then
    raise exception 'Active Super Admin accounts cannot be deleted';
  end if;

  if target_profile.role = 'Organizer' and actor_profile.role <> 'Super Admin' then
    raise exception 'Only a Super Admin can delete Organizer accounts';
  end if;

  if (is_blocked_account or target_profile.account_status = 'Suspended')
     and actor_profile.role <> 'Super Admin' then
    raise exception 'Only a Super Admin can delete suspended or blocked accounts';
  end if;

  if coalesce(target_profile.is_deleted, false) then
    return;
  end if;

  perform set_config('app.bypass_profile_guard', 'true', true);

  update public.user_profiles
  set is_deleted = true,
      deleted_at = now_ts,
      deleted_by = actor_profile.id,
      deleted_by_name = actor_profile.full_name,
      is_archived = false,
      account_status = 'Deleted',
      updated_at = now_ts
  where id = target_user_id;

  insert into public.user_deletion_audit_logs (
    target_user_id, target_user_email, target_user_name, target_user_role,
    action, actor_id, actor_name, notes, deleted_at
  ) values (
    target_profile.id,
    target_profile.email,
    target_profile.full_name,
    target_profile.role,
    'soft_deleted',
    actor_profile.id,
    actor_profile.full_name,
    coalesce(nullif(btrim(coalesce(delete_notes, '')), ''), 'Soft-deleted to Recycle Bin'),
    now_ts
  );

  insert into public.activity_logs (
    user_id, user_email, user_name, actor_id, actor_name,
    action, category, details
  ) values (
    target_profile.id,
    target_profile.email,
    target_profile.full_name,
    actor_profile.id,
    actor_profile.full_name,
    'account_soft_deleted',
    'security',
    'Account soft-deleted to Recycle Bin by ' || actor_profile.full_name
  );
end;
$$;

revoke all on function public.staff_soft_delete_user(uuid, text, boolean) from public;
grant execute on function public.staff_soft_delete_user(uuid, text, boolean) to authenticated;

-- 8. Super Admin Restore Deleted or Archived User RPC
create or replace function public.super_admin_restore_user(
  target_user_id uuid,
  restore_notes text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile public.user_profiles%rowtype;
  target_profile public.user_profiles%rowtype;
  now_ts timestamptz := now();
  was_deleted boolean;
  was_archived boolean;
  next_status text;
begin
  select * into actor_profile
  from public.user_profiles
  where id = (select auth.uid())
    and account_status = 'Active'
    and approval_status = 'Approved'
    and not coalesce(is_deleted, false)
    and not coalesce(is_archived, false)
    and role = 'Super Admin';

  if not found then
    raise exception 'Only an active approved Super Admin can restore deleted or archived users';
  end if;

  if target_user_id = actor_profile.id then
    raise exception 'Invalid restore target';
  end if;

  select * into target_profile
  from public.user_profiles
  where id = target_user_id;

  if not found then
    raise exception 'Target user profile was not found';
  end if;

  was_deleted := coalesce(target_profile.is_deleted, false) or target_profile.account_status = 'Deleted';
  was_archived := coalesce(target_profile.is_archived, false) or target_profile.account_status = 'Archived';

  if not was_deleted and not was_archived then
    raise exception 'User is neither deleted nor archived';
  end if;

  next_status := case
    when target_profile.approval_status = 'Rejected' then 'Rejected'
    else 'Active'
  end;

  perform set_config('app.bypass_profile_guard', 'true', true);

  update public.user_profiles
  set is_deleted = false,
      deleted_at = null,
      deleted_by = null,
      deleted_by_name = '',
      is_archived = false,
      archived_at = null,
      archived_by = null,
      archived_by_name = '',
      restored_at = now_ts,
      restored_by = actor_profile.id,
      restored_by_name = actor_profile.full_name,
      account_status = next_status,
      updated_at = now_ts
  where id = target_user_id;

  insert into public.user_deletion_audit_logs (
    target_user_id, target_user_email, target_user_name, target_user_role,
    action, actor_id, actor_name, notes,
    deleted_at, restored_at, restored_by, restored_by_name
  ) values (
    target_profile.id,
    target_profile.email,
    target_profile.full_name,
    target_profile.role,
    case when was_deleted then 'restored' else 'unarchived' end,
    actor_profile.id,
    actor_profile.full_name,
    coalesce(nullif(btrim(coalesce(restore_notes, '')), ''), 'Account restored by Super Admin'),
    target_profile.deleted_at,
    now_ts,
    actor_profile.id,
    actor_profile.full_name
  );

  insert into public.activity_logs (
    user_id, user_email, user_name, actor_id, actor_name,
    action, category, details
  ) values (
    target_profile.id,
    target_profile.email,
    target_profile.full_name,
    actor_profile.id,
    actor_profile.full_name,
    case when was_deleted then 'account_restored' else 'account_unarchived' end,
    'governance',
    'Account restored from Recycle Bin by ' || actor_profile.full_name
  );
end;
$$;

revoke all on function public.super_admin_restore_user(uuid, text) from public;
grant execute on function public.super_admin_restore_user(uuid, text) to authenticated;

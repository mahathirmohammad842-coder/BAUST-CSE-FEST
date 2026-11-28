-- Enterprise Real-Time Auto Sync, Live Presence, Organizer Permission & Delete Fixes,
-- Announcement Audit Logs, and Live Quick-Action Operations (Messages, Incidents, Info Requests)

-- ============================================================================
-- 1. ENSURE USER LIFECYCLE COLUMNS & STAFF_SOFT_DELETE_USER RPC EXIST
-- ============================================================================

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
  add column if not exists restored_by_name text not null default '',
  add column if not exists last_seen_at timestamptz,
  add column if not exists presence_status text not null default 'Offline';

alter table public.user_profiles
  drop constraint if exists user_profiles_account_status_check;

alter table public.user_profiles
  add constraint user_profiles_account_status_check
    check (account_status in ('Active', 'Suspended', 'Rejected', 'Archived', 'Deleted'));

alter table public.user_profiles
  drop constraint if exists user_profiles_presence_status_check;

alter table public.user_profiles
  add constraint user_profiles_presence_status_check
    check (presence_status in ('Online', 'Away', 'Offline'));

create index if not exists idx_user_profiles_is_deleted
  on public.user_profiles (is_deleted, deleted_at desc);

create index if not exists idx_user_profiles_is_archived
  on public.user_profiles (is_archived, archived_at desc);

create index if not exists idx_user_profiles_presence
  on public.user_profiles (presence_status, last_seen_at desc);

alter table public.role_permissions
  add column if not exists can_archive_users boolean not null default false,
  add column if not exists can_soft_delete_users boolean not null default false,
  add column if not exists can_restore_users boolean not null default false,
  add column if not exists can_permanently_delete_users boolean not null default false;

update public.role_permissions
set can_manage_users = (role in ('Super Admin', 'Organizer')),
    can_recommend_approvals = (role in ('Super Admin', 'Organizer')),
    can_verify_users = (role in ('Super Admin', 'Organizer')),
    can_publish_announcements = (role in ('Super Admin', 'Organizer')),
    can_access_organizer_panel = (role in ('Super Admin', 'Organizer')),
    can_manage_events = (role in ('Super Admin', 'Organizer')),
    can_archive_users = (role in ('Super Admin', 'Organizer')),
    can_soft_delete_users = (role in ('Super Admin', 'Organizer')),
    can_restore_users = (role = 'Super Admin'),
    can_permanently_delete_users = (role = 'Super Admin'),
    updated_at = now();

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

alter table public.user_deletion_audit_logs enable row level security;
revoke all on public.user_deletion_audit_logs from public, anon, authenticated;
grant select on public.user_deletion_audit_logs to authenticated;

drop policy if exists "Staff read deletion audit logs" on public.user_deletion_audit_logs;
create policy "Staff read deletion audit logs"
  on public.user_deletion_audit_logs for select to authenticated
  using ((select public.is_active_staff()));

-- Ensure soft-delete, archive, and restore RPCs exist cleanly in public schema
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
      presence_status = 'Offline',
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
      presence_status = 'Offline',
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

-- ============================================================================
-- 2. PRESENCE & LAST SEEN TRACKING RPCs + ROLE PROMOTION CONSISTENCY FIXES
-- ============================================================================

create or replace function public.record_my_last_login()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.user_profiles%rowtype;
  now_ts timestamptz := now();
begin
  perform set_config('app.bypass_profile_guard', 'true', true);

  update public.user_profiles
  set last_login_at = now_ts,
      last_seen_at = now_ts,
      presence_status = 'Online'
  where id = (select auth.uid())
  returning * into me;

  if found then
    insert into public.activity_logs (
      user_id, user_email, user_name, actor_id, actor_name,
      action, category, details
    ) values (
      me.id, me.email, me.full_name, me.id, me.full_name,
      'login', 'auth', 'Signed in to BAUST CSE Fest portal'
    );
  end if;
end;
$$;

revoke all on function public.record_my_last_login() from public;
grant execute on function public.record_my_last_login() to authenticated;

create or replace function public.update_my_presence_status(
  new_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new_status not in ('Online', 'Away', 'Offline') then
    raise exception 'Unsupported presence status';
  end if;

  perform set_config('app.bypass_profile_guard', 'true', true);

  update public.user_profiles
  set presence_status = new_status,
      last_seen_at = now(),
      updated_at = now()
  where id = (select auth.uid())
    and not coalesce(is_deleted, false)
    and not coalesce(is_archived, false);
end;
$$;

revoke all on function public.update_my_presence_status(text) from public;
grant execute on function public.update_my_presence_status(text) to authenticated;

-- Ensure Organizer/Super Admin promotion activates all staff gating flags
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
    and approval_status = 'Approved'
    and not coalesce(is_deleted, false)
    and not coalesce(is_archived, false)
    and role = 'Super Admin';

  if not found then
    raise exception 'Only an active approved Super Admin can change user roles';
  end if;

  if target_user_id = actor_profile.id then
    raise exception 'Users cannot change or promote their own role';
  end if;

  if new_role not in ('Participant', 'Volunteer', 'Judge', 'Guest', 'Sponsor', 'Mentor', 'Organizer', 'Super Admin') then
    raise exception 'Unsupported role';
  end if;

  select * into target_profile
  from public.user_profiles
  where id = target_user_id
    and trashed_at is null
    and not coalesce(is_deleted, false)
    and not coalesce(is_archived, false);

  if not found then
    raise exception 'Target user profile was not found';
  end if;

  if target_profile.role = new_role then
    return;
  end if;

  perform set_config('app.bypass_profile_guard', 'true', true);

  update public.user_profiles
  set role = new_role,
      assigned_role = new_role,
      approval_status = case
        when new_role in ('Organizer', 'Super Admin') then 'Approved'
        else approval_status
      end,
      account_status = case
        when new_role in ('Organizer', 'Super Admin') then 'Active'
        else account_status
      end,
      can_manage_approvals = case
        when new_role = 'Super Admin' then true
        when new_role = 'Organizer' then can_manage_approvals
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

  insert into public.activity_logs (
    user_id, user_email, user_name, actor_id, actor_name,
    action, category, details
  ) values (
    target_profile.id, target_profile.email, target_profile.full_name,
    actor_profile.id, actor_profile.full_name,
    'role_changed', 'governance',
    'Role changed from ' || target_profile.role || ' to ' || new_role
  );
end;
$$;

-- ============================================================================
-- 3. ANNOUNCEMENTS OWNERSHIP DELETE RLS + AUDIT LOGS + RPCs
-- ============================================================================

create table if not exists public.announcement_audit_logs (
  id uuid primary key default gen_random_uuid(),
  announcement_id text not null,
  announcement_title text not null default '',
  action text not null
    check (action in ('created', 'updated', 'published', 'soft_deleted', 'restored', 'permanently_deleted')),
  actor_id uuid references auth.users (id) on delete set null,
  actor_name text not null default '',
  actor_role text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_announcement_audit_logs_created
  on public.announcement_audit_logs (created_at desc);

alter table public.announcement_audit_logs enable row level security;
revoke all on public.announcement_audit_logs from public, anon, authenticated;
grant select on public.announcement_audit_logs to authenticated;

drop policy if exists "Staff read announcement audit logs" on public.announcement_audit_logs;
create policy "Staff read announcement audit logs"
  on public.announcement_audit_logs for select to authenticated
  using ((select public.is_active_staff()));

-- Replace monolithic 'for all' staff policy so delete enforces own-announcement rule for Organizers
drop policy if exists "Staff manage announcements" on public.announcements;
drop policy if exists "Staff insert announcements" on public.announcements;
drop policy if exists "Staff update announcements" on public.announcements;
drop policy if exists "Staff delete announcements" on public.announcements;

create policy "Staff insert announcements"
  on public.announcements for insert to authenticated
  with check ((select public.is_active_staff()));

create policy "Staff update announcements"
  on public.announcements for update to authenticated
  using ((select public.is_active_staff()))
  with check ((select public.is_active_staff()));

create policy "Staff delete announcements"
  on public.announcements for delete to authenticated
  using (
    (select public.is_active_super_admin())
    or (
      (select public.is_active_staff())
      and coalesce(payload->>'senderId', updated_by::text) = (select auth.uid())::text
    )
  );

create or replace function public.staff_soft_delete_announcement(
  target_announcement_id text,
  delete_notes text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile public.user_profiles%rowtype;
  ann_row public.announcements%rowtype;
  now_ts timestamptz := now();
  owner_id text;
  updated_payload jsonb;
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
    raise exception 'Only active Organizers or Super Admins can delete announcements';
  end if;

  select * into ann_row
  from public.announcements
  where id = target_announcement_id;

  if not found then
    raise exception 'Announcement not found';
  end if;

  owner_id := coalesce(nullif(ann_row.payload->>'senderId', ''), ann_row.updated_by::text);
  if actor_profile.role <> 'Super Admin' and owner_id <> actor_profile.id::text then
    raise exception 'Organizers can only delete announcements they created; Super Admins can delete any announcement';
  end if;

  updated_payload := jsonb_set(
    jsonb_set(
      jsonb_set(ann_row.payload, '{trashedAt}', to_jsonb(now_ts::text)),
      '{trashedBy}', to_jsonb(actor_profile.full_name)
    ),
    '{trashedById}', to_jsonb(actor_profile.id::text)
  );

  update public.announcements
  set payload = updated_payload,
      updated_by = actor_profile.id,
      updated_at = now_ts
  where id = target_announcement_id;

  insert into public.announcement_audit_logs (
    announcement_id, announcement_title, action, actor_id, actor_name, actor_role, notes
  ) values (
    ann_row.id,
    coalesce(ann_row.payload->>'title', 'Untitled Notice'),
    'soft_deleted',
    actor_profile.id,
    actor_profile.full_name,
    actor_profile.role,
    coalesce(nullif(btrim(coalesce(delete_notes, '')), ''), 'Moved to Recycle Bin')
  );

  insert into public.activity_logs (
    user_id, user_email, user_name, actor_id, actor_name,
    action, category, details
  ) values (
    actor_profile.id, actor_profile.email, actor_profile.full_name,
    actor_profile.id, actor_profile.full_name,
    'announcement_soft_deleted', 'notifications',
    'Moved "' || coalesce(ann_row.payload->>'title', ann_row.id) || '" to Recycle Bin'
  );
end;
$$;

revoke all on function public.staff_soft_delete_announcement(text, text) from public;
grant execute on function public.staff_soft_delete_announcement(text, text) to authenticated;

create or replace function public.staff_restore_announcement(
  target_announcement_id text,
  restore_notes text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile public.user_profiles%rowtype;
  ann_row public.announcements%rowtype;
  now_ts timestamptz := now();
  owner_id text;
  updated_payload jsonb;
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
    raise exception 'Only active Organizers or Super Admins can restore announcements';
  end if;

  select * into ann_row
  from public.announcements
  where id = target_announcement_id;

  if not found then
    raise exception 'Announcement not found';
  end if;

  owner_id := coalesce(nullif(ann_row.payload->>'senderId', ''), ann_row.updated_by::text);
  if actor_profile.role <> 'Super Admin' and owner_id <> actor_profile.id::text then
    raise exception 'Organizers can only restore their own announcements';
  end if;

  updated_payload := (ann_row.payload - 'trashedAt' - 'trashedBy' - 'trashedById');

  update public.announcements
  set payload = updated_payload,
      updated_by = actor_profile.id,
      updated_at = now_ts
  where id = target_announcement_id;

  insert into public.announcement_audit_logs (
    announcement_id, announcement_title, action, actor_id, actor_name, actor_role, notes
  ) values (
    ann_row.id,
    coalesce(ann_row.payload->>'title', 'Untitled Notice'),
    'restored',
    actor_profile.id,
    actor_profile.full_name,
    actor_profile.role,
    coalesce(nullif(btrim(coalesce(restore_notes, '')), ''), 'Restored from Recycle Bin')
  );

  insert into public.activity_logs (
    user_id, user_email, user_name, actor_id, actor_name,
    action, category, details
  ) values (
    actor_profile.id, actor_profile.email, actor_profile.full_name,
    actor_profile.id, actor_profile.full_name,
    'announcement_restored', 'notifications',
    'Restored "' || coalesce(ann_row.payload->>'title', ann_row.id) || '" from Recycle Bin'
  );
end;
$$;

revoke all on function public.staff_restore_announcement(text, text) from public;
grant execute on function public.staff_restore_announcement(text, text) to authenticated;

create or replace function public.staff_permanent_delete_announcement(
  target_announcement_id text,
  delete_notes text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile public.user_profiles%rowtype;
  ann_row public.announcements%rowtype;
  owner_id text;
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
    raise exception 'Only active Organizers or Super Admins can permanently delete announcements';
  end if;

  select * into ann_row
  from public.announcements
  where id = target_announcement_id;

  if not found then
    return;
  end if;

  owner_id := coalesce(nullif(ann_row.payload->>'senderId', ''), ann_row.updated_by::text);
  if actor_profile.role <> 'Super Admin' and owner_id <> actor_profile.id::text then
    raise exception 'Organizers can only permanently delete their own announcements';
  end if;

  delete from public.announcements where id = target_announcement_id;

  insert into public.announcement_audit_logs (
    announcement_id, announcement_title, action, actor_id, actor_name, actor_role, notes
  ) values (
    ann_row.id,
    coalesce(ann_row.payload->>'title', 'Untitled Notice'),
    'permanently_deleted',
    actor_profile.id,
    actor_profile.full_name,
    actor_profile.role,
    coalesce(nullif(btrim(coalesce(delete_notes, '')), ''), 'Permanently deleted from Recycle Bin')
  );

  insert into public.activity_logs (
    user_id, user_email, user_name, actor_id, actor_name,
    action, category, details
  ) values (
    actor_profile.id, actor_profile.email, actor_profile.full_name,
    actor_profile.id, actor_profile.full_name,
    'announcement_permanently_deleted', 'notifications',
    'Permanently deleted "' || coalesce(ann_row.payload->>'title', ann_row.id) || '"'
  );
end;
$$;

revoke all on function public.staff_permanent_delete_announcement(text, text) from public;
grant execute on function public.staff_permanent_delete_announcement(text, text) to authenticated;

-- ============================================================================
-- 4. QUICK ACTIONS BACKEND: ORGANIZERS DIRECTORY, MESSAGES, INCIDENTS, INFO REQUESTS
-- ============================================================================

-- Expose active approved Organizers & Super Admins safely to authenticated attendees
create or replace function public.get_active_organizer_contacts()
returns table (
  id uuid,
  full_name text,
  email text,
  phone text,
  role text,
  department text,
  institution text,
  photo_url text,
  presence_status text,
  last_seen_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.full_name,
    p.email,
    p.phone,
    p.role,
    p.department,
    p.institution,
    p.photo_url,
    p.presence_status,
    p.last_seen_at
  from public.user_profiles p
  where p.account_status = 'Active'
    and p.approval_status = 'Approved'
    and not coalesce(p.is_deleted, false)
    and not coalesce(p.is_archived, false)
    and p.role in ('Organizer', 'Super Admin')
  order by
    case when p.role = 'Organizer' then 0 else 1 end,
    p.full_name asc;
$$;

revoke all on function public.get_active_organizer_contacts() from public;
grant execute on function public.get_active_organizer_contacts() to authenticated;

-- 4A. Organizer Messages + Conversation Replies
create table if not exists public.organizer_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  sender_name text not null default '',
  sender_email text not null default '',
  sender_role text not null default 'Participant',
  recipient_organizer_id uuid references auth.users (id) on delete set null,
  recipient_organizer_name text not null default 'Executive Organizing Committee',
  subject text not null,
  body text not null,
  status text not null default 'Delivered'
    check (status in ('Sent', 'Delivered', 'Read', 'Replied')),
  read_at timestamptz,
  read_by uuid references auth.users (id) on delete set null,
  replied_at timestamptz,
  reply_count integer not null default 0,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_organizer_messages_sender
  on public.organizer_messages (sender_id, last_message_at desc);
create index if not exists idx_organizer_messages_recipient
  on public.organizer_messages (recipient_organizer_id, last_message_at desc);

create table if not exists public.organizer_message_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.organizer_messages (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null default '',
  author_role text not null default 'Participant',
  body text not null,
  is_staff_reply boolean not null default false,
  delivery_status text not null default 'Delivered'
    check (delivery_status in ('Sent', 'Delivered', 'Read')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_organizer_message_replies_thread
  on public.organizer_message_replies (thread_id, created_at asc);

alter table public.organizer_messages enable row level security;
alter table public.organizer_message_replies enable row level security;

revoke all on public.organizer_messages from anon;
revoke all on public.organizer_message_replies from anon;
grant select, insert, update on public.organizer_messages to authenticated;
grant select, insert, update on public.organizer_message_replies to authenticated;

drop policy if exists "Participants read own threads and staff read all" on public.organizer_messages;
create policy "Participants read own threads and staff read all"
  on public.organizer_messages for select to authenticated
  using (
    sender_id = (select auth.uid())
    or recipient_organizer_id = (select auth.uid())
    or (select public.is_active_staff())
  );

drop policy if exists "Users create own organizer messages" on public.organizer_messages;
create policy "Users create own organizer messages"
  on public.organizer_messages for insert to authenticated
  with check (sender_id = (select auth.uid()));

drop policy if exists "Thread participants update read state" on public.organizer_messages;
create policy "Thread participants update read state"
  on public.organizer_messages for update to authenticated
  using (
    sender_id = (select auth.uid())
    or recipient_organizer_id = (select auth.uid())
    or (select public.is_active_staff())
  )
  with check (
    sender_id = (select auth.uid())
    or recipient_organizer_id = (select auth.uid())
    or (select public.is_active_staff())
  );

drop policy if exists "Participants read replies in accessible threads" on public.organizer_message_replies;
create policy "Participants read replies in accessible threads"
  on public.organizer_message_replies for select to authenticated
  using (
    exists (
      select 1 from public.organizer_messages m
      where m.id = thread_id
        and (
          m.sender_id = (select auth.uid())
          or m.recipient_organizer_id = (select auth.uid())
          or (select public.is_active_staff())
        )
    )
  );

drop policy if exists "Participants insert replies in accessible threads" on public.organizer_message_replies;
create policy "Participants insert replies in accessible threads"
  on public.organizer_message_replies for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.organizer_messages m
      where m.id = thread_id
        and (
          m.sender_id = (select auth.uid())
          or m.recipient_organizer_id = (select auth.uid())
          or (select public.is_active_staff())
        )
    )
  );

create or replace function public.submit_organizer_message(
  recipient_id uuid default null,
  subject_text text default '',
  body_text text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  sender_profile public.user_profiles%rowtype;
  recipient_profile public.user_profiles%rowtype;
  clean_subject text := btrim(coalesce(subject_text, ''));
  clean_body text := btrim(coalesce(body_text, ''));
  new_id uuid;
  recipient_label text := 'Executive Organizing Committee';
begin
  select * into sender_profile
  from public.user_profiles
  where id = (select auth.uid())
    and account_status = 'Active'
    and not coalesce(is_deleted, false)
    and not coalesce(is_archived, false);

  if not found then
    raise exception 'Active authenticated user profile required';
  end if;

  if clean_subject = '' or clean_body = '' then
    raise exception 'Subject and message body are required';
  end if;

  if recipient_id is not null then
    select * into recipient_profile
    from public.user_profiles
    where id = recipient_id
      and account_status = 'Active'
      and approval_status = 'Approved'
      and not coalesce(is_deleted, false)
      and not coalesce(is_archived, false)
      and role in ('Organizer', 'Super Admin');

    if not found then
      raise exception 'Selected organizer is unavailable';
    end if;
    recipient_label := recipient_profile.full_name || ' (' || recipient_profile.role || ')';
  end if;

  insert into public.organizer_messages (
    sender_id, sender_name, sender_email, sender_role,
    recipient_organizer_id, recipient_organizer_name,
    subject, body, status, last_message_at
  ) values (
    sender_profile.id, sender_profile.full_name, sender_profile.email, sender_profile.role,
    recipient_id, recipient_label,
    clean_subject, clean_body, 'Delivered', now()
  )
  returning id into new_id;

  -- Notify targeted organizer or all active organizers/super admins
  insert into public.notifications (
    user_id, announcement_id, title, body, channel, priority
  )
  select
    staff.id,
    'msg-' || new_id::text,
    'New Message from ' || sender_profile.full_name || ': ' || clean_subject,
    left(clean_body, 220),
    'In-App',
    'High'
  from public.user_profiles staff
  where staff.account_status = 'Active'
    and staff.approval_status = 'Approved'
    and not coalesce(staff.is_deleted, false)
    and not coalesce(staff.is_archived, false)
    and staff.role in ('Organizer', 'Super Admin')
    and (recipient_id is null or staff.id = recipient_id)
  on conflict (user_id, announcement_id) do nothing;

  insert into public.activity_logs (
    user_id, user_email, user_name, actor_id, actor_name,
    action, category, details
  ) values (
    sender_profile.id, sender_profile.email, sender_profile.full_name,
    sender_profile.id, sender_profile.full_name,
    'organizer_message_sent', 'notifications',
    'Sent message "' || clean_subject || '" to ' || recipient_label
  );

  return new_id;
end;
$$;

revoke all on function public.submit_organizer_message(uuid, text, text) from public;
grant execute on function public.submit_organizer_message(uuid, text, text) to authenticated;

create or replace function public.reply_organizer_message(
  target_thread_id uuid,
  reply_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile public.user_profiles%rowtype;
  thread_row public.organizer_messages%rowtype;
  clean_body text := btrim(coalesce(reply_body, ''));
  is_staff boolean := false;
  reply_id uuid;
  now_ts timestamptz := now();
begin
  select * into actor_profile
  from public.user_profiles
  where id = (select auth.uid())
    and account_status = 'Active'
    and not coalesce(is_deleted, false)
    and not coalesce(is_archived, false);

  if not found then
    raise exception 'Active authenticated user profile required';
  end if;

  if clean_body = '' then
    raise exception 'Reply message cannot be empty';
  end if;

  select * into thread_row
  from public.organizer_messages
  where id = target_thread_id;

  if not found then
    raise exception 'Message thread not found';
  end if;

  is_staff := (
    actor_profile.approval_status = 'Approved'
    and actor_profile.role in ('Organizer', 'Super Admin')
  );

  if not is_staff and thread_row.sender_id <> actor_profile.id then
    raise exception 'You do not have permission to reply to this thread';
  end if;

  insert into public.organizer_message_replies (
    thread_id, author_id, author_name, author_role,
    body, is_staff_reply, delivery_status
  ) values (
    thread_row.id, actor_profile.id, actor_profile.full_name, actor_profile.role,
    clean_body, is_staff, 'Delivered'
  )
  returning id into reply_id;

  update public.organizer_messages
  set status = case when is_staff then 'Replied' else 'Delivered' end,
      replied_at = case when is_staff then now_ts else replied_at end,
      reply_count = reply_count + 1,
      last_message_at = now_ts
  where id = thread_row.id;

  if is_staff and thread_row.sender_id <> actor_profile.id then
    insert into public.notifications (
      user_id, announcement_id, title, body, channel, priority
    ) values (
      thread_row.sender_id,
      'msg-reply-' || reply_id::text,
      'Reply from ' || actor_profile.full_name || ': ' || thread_row.subject,
      left(clean_body, 220),
      'In-App',
      'Normal'
    ) on conflict (user_id, announcement_id) do nothing;
  elsif not is_staff then
    insert into public.notifications (
      user_id, announcement_id, title, body, channel, priority
    )
    select
      staff.id,
      'msg-reply-' || reply_id::text,
      'Follow-up from ' || actor_profile.full_name || ': ' || thread_row.subject,
      left(clean_body, 220),
      'In-App',
      'Normal'
    from public.user_profiles staff
    where staff.account_status = 'Active'
      and staff.approval_status = 'Approved'
      and not coalesce(staff.is_deleted, false)
      and not coalesce(staff.is_archived, false)
      and staff.role in ('Organizer', 'Super Admin')
      and (thread_row.recipient_organizer_id is null or staff.id = thread_row.recipient_organizer_id)
    on conflict (user_id, announcement_id) do nothing;
  end if;

  return reply_id;
end;
$$;

revoke all on function public.reply_organizer_message(uuid, text) from public;
grant execute on function public.reply_organizer_message(uuid, text) to authenticated;

create or replace function public.mark_organizer_thread_read(
  target_thread_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile public.user_profiles%rowtype;
  thread_row public.organizer_messages%rowtype;
  is_staff boolean := false;
  now_ts timestamptz := now();
begin
  select * into actor_profile
  from public.user_profiles
  where id = (select auth.uid());
  if not found then return; end if;

  select * into thread_row
  from public.organizer_messages
  where id = target_thread_id;
  if not found then return; end if;

  is_staff := (
    actor_profile.account_status = 'Active'
    and actor_profile.approval_status = 'Approved'
    and actor_profile.role in ('Organizer', 'Super Admin')
  );

  if not is_staff and thread_row.sender_id <> actor_profile.id then
    return;
  end if;

  if is_staff and thread_row.status in ('Sent', 'Delivered') then
    update public.organizer_messages
    set status = 'Read',
        read_at = coalesce(read_at, now_ts),
        read_by = coalesce(read_by, actor_profile.id)
    where id = target_thread_id;
  end if;

  update public.organizer_message_replies
  set delivery_status = 'Read',
      read_at = coalesce(read_at, now_ts)
  where thread_id = target_thread_id
    and author_id <> actor_profile.id
    and delivery_status <> 'Read';
end;
$$;

revoke all on function public.mark_organizer_thread_read(uuid) from public;
grant execute on function public.mark_organizer_thread_read(uuid) to authenticated;

-- 4B. Incident Reports Table & RPCs
create table if not exists public.incident_reports (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reporter_name text not null default '',
  reporter_email text not null default '',
  reporter_role text not null default 'Participant',
  category text not null,
  location text not null,
  severity text not null default 'Medium'
    check (severity in ('Low', 'Medium', 'High', 'Critical')),
  description text not null,
  status text not null default 'Open'
    check (status in ('Open', 'Investigating', 'Resolved', 'Closed')),
  assigned_to uuid references auth.users (id) on delete set null,
  assigned_to_name text not null default '',
  resolution_notes text not null default '',
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_incident_reports_created
  on public.incident_reports (created_at desc);

alter table public.incident_reports enable row level security;
revoke all on public.incident_reports from anon;
grant select, insert, update on public.incident_reports to authenticated;

drop policy if exists "Reporters read own incidents and staff read all" on public.incident_reports;
create policy "Reporters read own incidents and staff read all"
  on public.incident_reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select public.is_active_staff()));

drop policy if exists "Users insert own incident reports" on public.incident_reports;
create policy "Users insert own incident reports"
  on public.incident_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));

drop policy if exists "Staff update incident reports" on public.incident_reports;
create policy "Staff update incident reports"
  on public.incident_reports for update to authenticated
  using ((select public.is_active_staff()))
  with check ((select public.is_active_staff()));

create or replace function public.submit_incident_report(
  category_text text,
  location_text text,
  severity_text text default 'Medium',
  description_text text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  reporter public.user_profiles%rowtype;
  clean_desc text := btrim(coalesce(description_text, ''));
  safe_severity text := case
    when severity_text in ('Low', 'Medium', 'High', 'Critical') then severity_text
    else 'Medium'
  end;
  ref_code text := 'INC-' || lpad(floor(random() * 9000 + 1000)::int::text, 4, '0');
  new_id uuid;
begin
  select * into reporter
  from public.user_profiles
  where id = (select auth.uid())
    and account_status = 'Active'
    and not coalesce(is_deleted, false)
    and not coalesce(is_archived, false);

  if not found then
    raise exception 'Active authenticated user profile required';
  end if;

  if clean_desc = '' then
    raise exception 'Incident description is required';
  end if;

  insert into public.incident_reports (
    reference_code, reporter_id, reporter_name, reporter_email, reporter_role,
    category, location, severity, description, status
  ) values (
    ref_code, reporter.id, reporter.full_name, reporter.email, reporter.role,
    coalesce(nullif(btrim(category_text), ''), 'General Issue'),
    coalesce(nullif(btrim(location_text), ''), 'Campus'),
    safe_severity,
    clean_desc,
    'Open'
  )
  returning id into new_id;

  insert into public.notifications (
    user_id, announcement_id, title, body, channel, priority
  )
  select
    staff.id,
    'inc-' || new_id::text,
    '[' || safe_severity || '] Incident ' || ref_code || ': ' || category_text,
    location_text || ' · Reported by ' || reporter.full_name || ': ' || left(clean_desc, 180),
    'In-App',
    case when safe_severity in ('High', 'Critical') then 'Emergency' else 'High' end
  from public.user_profiles staff
  where staff.account_status = 'Active'
    and staff.approval_status = 'Approved'
    and not coalesce(staff.is_deleted, false)
    and not coalesce(staff.is_archived, false)
    and staff.role in ('Organizer', 'Super Admin')
  on conflict (user_id, announcement_id) do nothing;

  insert into public.activity_logs (
    user_id, user_email, user_name, actor_id, actor_name,
    action, category, details
  ) values (
    reporter.id, reporter.email, reporter.full_name,
    reporter.id, reporter.full_name,
    'incident_reported', 'security',
    'Submitted incident ' || ref_code || ' at ' || location_text
  );

  return new_id;
end;
$$;

revoke all on function public.submit_incident_report(text, text, text, text) from public;
grant execute on function public.submit_incident_report(text, text, text, text) to authenticated;

create or replace function public.staff_update_incident_report(
  target_incident_id uuid,
  new_status text,
  resolution_text text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile public.user_profiles%rowtype;
  inc_row public.incident_reports%rowtype;
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
    raise exception 'Only active approved Organizers or Super Admins can manage incidents';
  end if;

  if new_status not in ('Open', 'Investigating', 'Resolved', 'Closed') then
    raise exception 'Unsupported incident status';
  end if;

  select * into inc_row
  from public.incident_reports
  where id = target_incident_id;

  if not found then
    raise exception 'Incident report not found';
  end if;

  update public.incident_reports
  set status = new_status,
      assigned_to = coalesce(assigned_to, actor_profile.id),
      assigned_to_name = case when assigned_to_name = '' then actor_profile.full_name else assigned_to_name end,
      resolution_notes = coalesce(nullif(btrim(coalesce(resolution_text, '')), ''), resolution_notes),
      resolved_at = case when new_status in ('Resolved', 'Closed') then now_ts else null end,
      resolved_by = case when new_status in ('Resolved', 'Closed') then actor_profile.id else null end,
      resolved_by_name = case when new_status in ('Resolved', 'Closed') then actor_profile.full_name else '' end,
      updated_at = now_ts
  where id = target_incident_id;

  insert into public.notifications (
    user_id, announcement_id, title, body, channel, priority
  ) values (
    inc_row.reporter_id,
    'inc-upd-' || inc_row.id::text || '-' || extract(epoch from now_ts)::bigint::text,
    'Incident ' || inc_row.reference_code || ' marked ' || new_status,
    coalesce(nullif(btrim(coalesce(resolution_text, '')), ''), 'Updated by ' || actor_profile.full_name),
    'In-App',
    'Normal'
  ) on conflict (user_id, announcement_id) do nothing;
end;
$$;

revoke all on function public.staff_update_incident_report(uuid, text, text) from public;
grant execute on function public.staff_update_incident_report(uuid, text, text) to authenticated;

-- 4C. Event Information Requests Table & RPCs
create table if not exists public.event_info_requests (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null,
  requester_id uuid not null references auth.users (id) on delete cascade,
  requester_name text not null default '',
  requester_email text not null default '',
  requester_role text not null default 'Participant',
  topic text not null,
  question text not null,
  status text not null default 'Pending'
    check (status in ('Pending', 'Answered', 'Closed')),
  response_text text not null default '',
  responded_by uuid references auth.users (id) on delete set null,
  responded_by_name text not null default '',
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_event_info_requests_created
  on public.event_info_requests (created_at desc);

alter table public.event_info_requests enable row level security;
revoke all on public.event_info_requests from anon;
grant select, insert, update on public.event_info_requests to authenticated;

drop policy if exists "Requesters read own info requests and staff read all" on public.event_info_requests;
create policy "Requesters read own info requests and staff read all"
  on public.event_info_requests for select to authenticated
  using (requester_id = (select auth.uid()) or (select public.is_active_staff()));

drop policy if exists "Users insert own info requests" on public.event_info_requests;
create policy "Users insert own info requests"
  on public.event_info_requests for insert to authenticated
  with check (requester_id = (select auth.uid()));

drop policy if exists "Staff update info requests" on public.event_info_requests;
create policy "Staff update info requests"
  on public.event_info_requests for update to authenticated
  using ((select public.is_active_staff()))
  with check ((select public.is_active_staff()));

create or replace function public.submit_event_info_request(
  topic_text text,
  question_text text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester public.user_profiles%rowtype;
  clean_question text := btrim(coalesce(question_text, ''));
  ref_code text := 'REQ-' || lpad(floor(random() * 9000 + 1000)::int::text, 4, '0');
  new_id uuid;
begin
  select * into requester
  from public.user_profiles
  where id = (select auth.uid())
    and account_status = 'Active'
    and not coalesce(is_deleted, false)
    and not coalesce(is_archived, false);

  if not found then
    raise exception 'Active authenticated user profile required';
  end if;

  if clean_question = '' then
    raise exception 'Question text is required';
  end if;

  insert into public.event_info_requests (
    reference_code, requester_id, requester_name, requester_email, requester_role,
    topic, question, status
  ) values (
    ref_code, requester.id, requester.full_name, requester.email, requester.role,
    coalesce(nullif(btrim(topic_text), ''), 'General Info'),
    clean_question,
    'Pending'
  )
  returning id into new_id;

  insert into public.notifications (
    user_id, announcement_id, title, body, channel, priority
  )
  select
    staff.id,
    'req-' || new_id::text,
    'Info Request ' || ref_code || ' (' || topic_text || ')',
    requester.full_name || ': ' || left(clean_question, 180),
    'In-App',
    'Normal'
  from public.user_profiles staff
  where staff.account_status = 'Active'
    and staff.approval_status = 'Approved'
    and not coalesce(staff.is_deleted, false)
    and not coalesce(staff.is_archived, false)
    and staff.role in ('Organizer', 'Super Admin')
  on conflict (user_id, announcement_id) do nothing;

  insert into public.activity_logs (
    user_id, user_email, user_name, actor_id, actor_name,
    action, category, details
  ) values (
    requester.id, requester.email, requester.full_name,
    requester.id, requester.full_name,
    'event_info_requested', 'notifications',
    'Submitted info request ' || ref_code || ' (' || topic_text || ')'
  );

  return new_id;
end;
$$;

revoke all on function public.submit_event_info_request(text, text) from public;
grant execute on function public.submit_event_info_request(text, text) to authenticated;

create or replace function public.staff_respond_event_info_request(
  target_request_id uuid,
  response_body text,
  new_status text default 'Answered'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile public.user_profiles%rowtype;
  req_row public.event_info_requests%rowtype;
  clean_response text := btrim(coalesce(response_body, ''));
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
    raise exception 'Only active approved Organizers or Super Admins can respond to requests';
  end if;

  if new_status not in ('Pending', 'Answered', 'Closed') then
    raise exception 'Unsupported info request status';
  end if;

  select * into req_row
  from public.event_info_requests
  where id = target_request_id;

  if not found then
    raise exception 'Event info request not found';
  end if;

  if clean_response = '' and new_status = 'Answered' then
    raise exception 'Response text is required when marking a request Answered';
  end if;

  update public.event_info_requests
  set status = new_status,
      response_text = case when clean_response <> '' then clean_response else response_text end,
      responded_by = actor_profile.id,
      responded_by_name = actor_profile.full_name,
      responded_at = now_ts,
      updated_at = now_ts
  where id = target_request_id;

  insert into public.notifications (
    user_id, announcement_id, title, body, channel, priority
  ) values (
    req_row.requester_id,
    'req-ans-' || req_row.id::text || '-' || extract(epoch from now_ts)::bigint::text,
    'Response to ' || req_row.reference_code || ' (' || req_row.topic || ')',
    coalesce(nullif(clean_response, ''), 'Marked ' || new_status || ' by ' || actor_profile.full_name),
    'In-App',
    'Normal'
  ) on conflict (user_id, announcement_id) do nothing;
end;
$$;

revoke all on function public.staff_respond_event_info_request(uuid, text, text) from public;
grant execute on function public.staff_respond_event_info_request(uuid, text, text) to authenticated;

-- ============================================================================
-- 5. SUPABASE REALTIME PUBLICATION & SCHEMA CACHE RELOAD
-- ============================================================================

do $$
declare
  tbl text;
  realtime_tables text[] := array[
    'user_profiles',
    'announcements',
    'personal_notification_actions',
    'notifications',
    'role_permissions',
    'role_change_logs',
    'approval_logs',
    'verification_logs',
    'activity_logs',
    'user_deletion_audit_logs',
    'announcement_audit_logs',
    'organizer_messages',
    'organizer_message_replies',
    'incident_reports',
    'event_info_requests'
  ];
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach tbl in array realtime_tables loop
      begin
        execute format('alter publication supabase_realtime add table public.%I', tbl);
      exception
        when duplicate_object then null;
        when undefined_table then null;
      end;
    end loop;
  end if;
end;
$$;

create or replace function public.log_announcement_audit(
  target_announcement_id text,
  target_title text,
  audit_action text,
  audit_notes text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile public.user_profiles%rowtype;
begin
  if audit_action not in ('created', 'updated', 'published', 'soft_deleted', 'restored', 'permanently_deleted') then
    return;
  end if;

  select * into actor_profile
  from public.user_profiles
  where id = (select auth.uid())
    and account_status = 'Active'
    and approval_status = 'Approved'
    and not coalesce(is_deleted, false)
    and not coalesce(is_archived, false)
    and role in ('Organizer', 'Super Admin');

  if not found then
    return;
  end if;

  insert into public.announcement_audit_logs (
    announcement_id, announcement_title, action, actor_id, actor_name, actor_role, notes
  ) values (
    target_announcement_id,
    left(coalesce(target_title, 'Untitled Notice'), 240),
    audit_action,
    actor_profile.id,
    actor_profile.full_name,
    actor_profile.role,
    left(coalesce(audit_notes, ''), 500)
  );
end;
$$;

revoke all on function public.log_announcement_audit(text, text, text, text) from public;
grant execute on function public.log_announcement_audit(text, text, text, text) to authenticated;

notify pgrst, 'reload schema';

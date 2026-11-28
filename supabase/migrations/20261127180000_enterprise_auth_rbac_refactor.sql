-- Enterprise Auth, RBAC Hierarchy (Super Admin > Organizer > Participant),
-- Instant Registration without Email Confirmation Lockouts,
-- Address & Personal Info, Role Permissions, Activity Logs, and Cloud Notifications.

alter table public.user_profiles
  add column if not exists assigned_role text not null default 'Participant',
  add column if not exists approval_status text not null default 'Pending',
  add column if not exists address text not null default '',
  add column if not exists personal_info jsonb not null default '{"studentId":"","batch":"","tshirtSize":"","emergencyContact":"","dietaryNotes":""}'::jsonb;

-- 1. Migrate legacy 'Admin' role and 'Pending Approval' account_status before tightening constraints.
update public.user_profiles
set role = 'Organizer',
    assigned_role = 'Organizer',
    updated_at = now()
where role = 'Admin';

update public.user_profiles
set recommended_role = 'Organizer'
where recommended_role = 'Admin';

update public.role_change_logs
set previous_role = case when previous_role = 'Admin' then 'Organizer' else previous_role end,
    new_role = case when new_role = 'Admin' then 'Organizer' else new_role end
where previous_role = 'Admin' or new_role = 'Admin';

update public.approval_logs
set assigned_role = 'Organizer'
where assigned_role = 'Admin';

update public.user_profiles
set approval_status = case
      when account_status = 'Pending Approval' then 'Pending'
      when account_status = 'Rejected' then 'Rejected'
      else 'Approved'
    end,
    account_status = case
      when account_status = 'Pending Approval' then 'Active'
      else account_status
    end,
    assigned_role = role;

-- 2. Replace legacy check constraints with strict Organizer/Super Admin hierarchy.
alter table public.user_profiles drop constraint if exists user_profiles_role_check;
alter table public.user_profiles drop constraint if exists user_profiles_assigned_role_check;
alter table public.user_profiles drop constraint if exists user_profiles_account_status_check;
alter table public.user_profiles drop constraint if exists user_profiles_approval_status_check;
alter table public.user_profiles drop constraint if exists user_profiles_recommended_role_check;

alter table public.user_profiles
  add constraint user_profiles_role_check
    check (role in ('Participant', 'Volunteer', 'Judge', 'Guest', 'Sponsor', 'Mentor', 'Organizer', 'Super Admin')),
  add constraint user_profiles_assigned_role_check
    check (assigned_role in ('Participant', 'Volunteer', 'Judge', 'Guest', 'Sponsor', 'Mentor', 'Organizer', 'Super Admin')),
  add constraint user_profiles_account_status_check
    check (account_status in ('Active', 'Suspended', 'Rejected')),
  add constraint user_profiles_approval_status_check
    check (approval_status in ('Pending', 'Approved', 'Rejected')),
  add constraint user_profiles_recommended_role_check
    check (
      recommended_role is null or recommended_role in (
        'Participant', 'Volunteer', 'Judge', 'Guest',
        'Sponsor', 'Mentor', 'Organizer', 'Super Admin'
      )
    );

alter table public.user_profiles
  alter column account_status set default 'Active',
  alter column approval_status set default 'Pending',
  alter column role set default 'Participant',
  alter column assigned_role set default 'Participant';

-- 3. Role Permissions Matrix Table
create table if not exists public.role_permissions (
  role text primary key
    check (role in ('Participant', 'Volunteer', 'Judge', 'Guest', 'Sponsor', 'Mentor', 'Organizer', 'Super Admin')),
  hierarchy_level integer not null,
  can_manage_users boolean not null default false,
  can_approve_users boolean not null default false,
  can_recommend_approvals boolean not null default false,
  can_verify_users boolean not null default false,
  can_change_roles boolean not null default false,
  can_assign_organizer boolean not null default false,
  can_assign_super_admin boolean not null default false,
  can_publish_announcements boolean not null default false,
  can_access_organizer_panel boolean not null default false,
  can_access_super_admin_panel boolean not null default false,
  can_access_judge_features boolean not null default false,
  can_manage_events boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.role_permissions (
  role, hierarchy_level, can_manage_users, can_approve_users,
  can_recommend_approvals, can_verify_users, can_change_roles,
  can_assign_organizer, can_assign_super_admin, can_publish_announcements,
  can_access_organizer_panel, can_access_super_admin_panel,
  can_access_judge_features, can_manage_events
) values
  ('Super Admin', 100, true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true),
  ('Organizer',    70, true,  false, true,  true,  false, false, false, true,  true,  false, false, true),
  ('Judge',        30, false, false, false, false, false, false, false, false, false, false, true,  false),
  ('Mentor',       25, false, false, false, false, false, false, false, false, false, false, false, false),
  ('Sponsor',      20, false, false, false, false, false, false, false, false, false, false, false, false),
  ('Volunteer',    15, false, false, false, false, false, false, false, false, false, false, false, false),
  ('Guest',        10, false, false, false, false, false, false, false, false, false, false, false, false),
  ('Participant',  10, false, false, false, false, false, false, false, false, false, false, false, false)
on conflict (role) do update set
  hierarchy_level = excluded.hierarchy_level,
  can_manage_users = excluded.can_manage_users,
  can_approve_users = excluded.can_approve_users,
  can_recommend_approvals = excluded.can_recommend_approvals,
  can_verify_users = excluded.can_verify_users,
  can_change_roles = excluded.can_change_roles,
  can_assign_organizer = excluded.can_assign_organizer,
  can_assign_super_admin = excluded.can_assign_super_admin,
  can_publish_announcements = excluded.can_publish_announcements,
  can_access_organizer_panel = excluded.can_access_organizer_panel,
  can_access_super_admin_panel = excluded.can_access_super_admin_panel,
  can_access_judge_features = excluded.can_access_judge_features,
  can_manage_events = excluded.can_manage_events,
  updated_at = now();

alter table public.role_permissions enable row level security;
revoke all on public.role_permissions from anon, authenticated;
grant select on public.role_permissions to authenticated;

drop policy if exists "Authenticated read role permissions" on public.role_permissions;
create policy "Authenticated read role permissions"
  on public.role_permissions for select to authenticated
  using (true);

-- 4. Activity Logs Table (Auth, Profile, Security & Governance events)
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  user_email text not null default '',
  user_name text not null default '',
  actor_id uuid references auth.users (id) on delete set null,
  actor_name text not null default '',
  action text not null,
  category text not null default 'account'
    check (category in ('auth', 'profile', 'governance', 'security', 'notifications')),
  details text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_logs_user_time
  on public.activity_logs (user_id, created_at desc);
create index if not exists idx_activity_logs_created_at
  on public.activity_logs (created_at desc);

alter table public.activity_logs enable row level security;
revoke all on public.activity_logs from anon, authenticated;
grant select on public.activity_logs to authenticated;

-- 5. Notifications Table (Per-user notification inbox state & dispatch records)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  announcement_id text not null,
  title text not null default '',
  body text not null default '',
  channel text not null default 'In-App',
  priority text not null default 'Normal',
  is_read boolean not null default false,
  is_starred boolean not null default false,
  is_archived boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, announcement_id)
);

create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select, insert, update, delete on public.notifications to authenticated;

drop policy if exists "Users manage own notifications" on public.notifications;
create policy "Users manage own notifications"
  on public.notifications for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 6. Hardened Staff & Super Admin Helper Functions (Approval-gated)
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
      and p.role in ('Organizer', 'Super Admin')
  );
$$;

revoke all on function public.is_active_staff() from public;
grant execute on function public.is_active_staff() to authenticated;

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
      and p.role = 'Super Admin'
  );
$$;

revoke all on function public.is_active_super_admin() from public;
grant execute on function public.is_active_super_admin() to authenticated;

drop policy if exists "Staff read activity logs and users read own" on public.activity_logs;
create policy "Staff read activity logs and users read own"
  on public.activity_logs for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_active_staff()));

-- Tighten announcements RLS so Pending users only see public / Participant notices
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

-- 7. Column-level Update Grants + Guard Trigger on user_profiles
revoke update on public.user_profiles from authenticated;
grant update (
  full_name,
  phone,
  department,
  institution,
  address,
  personal_info,
  biography,
  photo_url,
  social_links,
  notification_preferences,
  updated_at
) on public.user_profiles to authenticated;

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
  -- Always keep assigned_role synchronized with role
  new.assigned_role := new.role;

  if tg_op = 'UPDATE' and caller_uid is not null and not is_bypass then
    -- Prevent self-promotion, self-approval, self-verification, or direct privilege escalation
    if (
      new.role is distinct from old.role
      or new.assigned_role is distinct from old.assigned_role
      or new.requested_role is distinct from old.requested_role
      or new.approval_status is distinct from old.approval_status
      or new.verification_status is distinct from old.verification_status
      or new.account_status is distinct from old.account_status
      or new.verified is distinct from old.verified
      or new.can_manage_approvals is distinct from old.can_manage_approvals
      or new.trashed_at is distinct from old.trashed_at
    ) then
      if not public.is_active_staff() then
        raise exception 'Privilege escalation blocked: restricted profile fields require authorized staff approval';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists user_profiles_sync_and_guard on public.user_profiles;
create trigger user_profiles_sync_and_guard
  before insert or update on public.user_profiles
  for each row execute function public.sync_and_guard_user_profile();

-- 8. Instant Registration Trigger (Assigned Role = Participant, Approval = Pending, Account = Active)
create or replace function public.create_user_profile_on_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text := coalesce(new.raw_user_meta_data ->> 'requested_role', 'Participant');
  full_name_val text := coalesce(new.raw_user_meta_data ->> 'full_name', '');
  email_val text := coalesce(new.email, '');
begin
  if requested not in ('Participant', 'Volunteer', 'Judge', 'Guest', 'Sponsor', 'Mentor') then
    requested := 'Participant';
  end if;

  perform set_config('app.bypass_profile_guard', 'true', true);

  insert into public.user_profiles (
    id, full_name, email, phone, role, assigned_role, requested_role,
    department, institution, address, personal_info,
    account_status, approval_status, verified, verification_status
  ) values (
    new.id,
    full_name_val,
    email_val,
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    'Participant',
    'Participant',
    requested,
    coalesce(new.raw_user_meta_data ->> 'department', ''),
    coalesce(new.raw_user_meta_data ->> 'institution', ''),
    coalesce(new.raw_user_meta_data ->> 'address', ''),
    '{"studentId":"","batch":"","tshirtSize":"","emergencyContact":"","dietaryNotes":""}'::jsonb,
    'Active',
    'Pending',
    false,
    'Pending'
  );

  insert into public.activity_logs (
    user_id, user_email, user_name, actor_id, actor_name,
    action, category, details, metadata
  ) values (
    new.id,
    email_val,
    full_name_val,
    new.id,
    full_name_val,
    'account_registered',
    'auth',
    'Account registered with immediate Participant access (Pending approval)',
    jsonb_build_object('requested_role', requested, 'assigned_role', 'Participant')
  );

  return new;
end;
$$;

-- 9. Activity & Last Login RPCs
create or replace function public.record_my_last_login()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.user_profiles%rowtype;
begin
  perform set_config('app.bypass_profile_guard', 'true', true);

  update public.user_profiles
  set last_login_at = now()
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

create or replace function public.log_user_activity(
  action_name text,
  category_name text default 'account',
  details_text text default '',
  metadata_json jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.user_profiles%rowtype;
  safe_category text;
begin
  select * into me
  from public.user_profiles
  where id = (select auth.uid());

  if not found then
    return;
  end if;

  safe_category := case
    when category_name in ('auth', 'profile', 'governance', 'security', 'notifications')
      then category_name
    else 'profile'
  end;

  insert into public.activity_logs (
    user_id, user_email, user_name, actor_id, actor_name,
    action, category, details, metadata
  ) values (
    me.id, me.email, me.full_name, me.id, me.full_name,
    left(coalesce(nullif(trim(action_name), ''), 'profile_updated'), 80),
    safe_category,
    left(coalesce(details_text, ''), 500),
    coalesce(metadata_json, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.log_user_activity(text, text, text, jsonb) from public;
grant execute on function public.log_user_activity(text, text, text, jsonb) to authenticated;

-- 10. Updated Governance RPCs (Super Admin > Organizer > Participant)
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
    and approval_status = 'Approved'
    and role in ('Organizer', 'Super Admin');

  if not found then
    raise exception 'Only an approved active Organizer or Super Admin can submit a recommendation';
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
      raise exception 'Organizers cannot recommend Organizer or Super Admin roles';
    end if;
  elsif clean_role not in ('Participant', 'Volunteer', 'Judge', 'Guest', 'Sponsor', 'Mentor', 'Organizer', 'Super Admin') then
    raise exception 'Unsupported suggested role';
  end if;

  perform set_config('app.bypass_profile_guard', 'true', true);

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
    target_profile.approval_status,
    'Recommended ' || recommendation,
    actor_profile.id,
    actor_profile.full_name,
    coalesce(notes, '')
  );

  insert into public.activity_logs (
    user_id, user_email, user_name, actor_id, actor_name,
    action, category, details
  ) values (
    target_profile.id, target_profile.email, target_profile.full_name,
    actor_profile.id, actor_profile.full_name,
    'approval_recommended', 'governance',
    'Recommended ' || recommendation || ' (' || clean_role || ')'
  );
end;
$$;

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
  next_approval text;
  next_account_status text;
  next_verification text;
begin
  select * into actor_profile
  from public.user_profiles
  where id = (select auth.uid())
    and account_status = 'Active'
    and approval_status = 'Approved'
    and role in ('Organizer', 'Super Admin');

  if not found then
    raise exception 'Only an approved active Super Admin or authorized Organizer can review registrations';
  end if;

  if actor_profile.role <> 'Super Admin' and not coalesce(actor_profile.can_manage_approvals, false) then
    raise exception 'Organizers must be granted approval permission by Super Admin or submit a recommendation';
  end if;

  if target_user_id = actor_profile.id then
    raise exception 'Users cannot approve, reject, or assign roles to their own account';
  end if;

  select * into target_profile
  from public.user_profiles
  where id = target_user_id
    and trashed_at is null
    and (
      approval_status = 'Pending'
      or (approve and approval_status = 'Rejected')
    );

  if not found then
    raise exception 'Pending or rejected user profile was not found';
  end if;

  if target_profile.role = 'Super Admin' then
    raise exception 'Super Admin accounts cannot be modified via registration review';
  end if;

  if approve then
    next_approval := 'Approved';
    next_account_status := 'Active';
    next_role := coalesce(nullif(trim(coalesce(assigned_role, '')), ''), target_profile.requested_role);
    if actor_profile.role <> 'Super Admin' then
      if next_role not in ('Participant', 'Volunteer', 'Judge', 'Guest', 'Sponsor', 'Mentor') then
        raise exception 'Only a Super Admin can assign Organizer or Super Admin roles';
      end if;
    elsif next_role not in ('Participant', 'Volunteer', 'Judge', 'Guest', 'Sponsor', 'Mentor', 'Organizer', 'Super Admin') then
      raise exception 'Unsupported assigned role';
    end if;
  else
    next_approval := 'Rejected';
    next_account_status := 'Rejected';
    next_role := target_profile.role;
  end if;

  next_verification := case
    when approve and mark_verified then 'Verified'
    when not approve and target_profile.verification_status = 'Pending' then 'Rejected'
    else target_profile.verification_status
  end;

  perform set_config('app.bypass_profile_guard', 'true', true);

  update public.user_profiles
  set approval_status = next_approval,
      account_status = next_account_status,
      role = next_role,
      assigned_role = next_role,
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
    target_profile.approval_status,
    next_approval,
    actor_profile.id,
    actor_profile.full_name,
    coalesce(approval_notes, '')
  );

  insert into public.activity_logs (
    user_id, user_email, user_name, actor_id, actor_name,
    action, category, details
  ) values (
    target_profile.id, target_profile.email, target_profile.full_name,
    actor_profile.id, actor_profile.full_name,
    case when approve then 'approval_approved' else 'approval_rejected' end,
    'governance',
    case when approve then 'Approved as ' || next_role else 'Role request rejected' end
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
    and trashed_at is null;

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
    and approval_status = 'Approved'
    and role = 'Super Admin';

  if not found then
    raise exception 'Only an active approved Super Admin can bulk assign user roles';
  end if;

  if new_role not in ('Participant', 'Volunteer', 'Judge', 'Guest', 'Sponsor', 'Mentor', 'Organizer', 'Super Admin') then
    raise exception 'Unsupported role';
  end if;

  perform set_config('app.bypass_profile_guard', 'true', true);

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
          assigned_role = new_role,
          approval_status = case
            when new_role in ('Organizer', 'Super Admin') then 'Approved'
            else approval_status
          end,
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
    and approval_status = 'Approved'
    and role in ('Organizer', 'Super Admin');

  if not found then
    raise exception 'Only approved active staff can verify user information';
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

  perform set_config('app.bypass_profile_guard', 'true', true);

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

  insert into public.activity_logs (
    user_id, user_email, user_name, actor_id, actor_name,
    action, category, details
  ) values (
    target_profile.id, target_profile.email, target_profile.full_name,
    actor_profile.id, actor_profile.full_name,
    'verification_updated', 'governance',
    'Verification updated to ' || new_status
  );
end;
$$;

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
    and approval_status = 'Approved'
    and role in ('Organizer', 'Super Admin');

  if not found then
    raise exception 'Only approved active staff can verify users';
  end if;

  if new_status not in ('Pending', 'Verified', 'Rejected') then
    raise exception 'Unsupported verification status';
  end if;

  perform set_config('app.bypass_profile_guard', 'true', true);

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
    and approval_status = 'Approved'
    and role = 'Super Admin';

  if not found then
    raise exception 'Only an active approved Super Admin can configure organizer approval permissions';
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

  perform set_config('app.bypass_profile_guard', 'true', true);

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
    target_profile.approval_status,
    target_profile.approval_status,
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
    and approval_status = 'Approved'
    and role in ('Organizer', 'Super Admin');

  if not found then
    raise exception 'Only approved active staff can manage profiles';
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

  if target_profile.role = 'Organizer' and actor_profile.role <> 'Super Admin' then
    raise exception 'Only a Super Admin can modify another Organizer account status';
  end if;

  next_verification := case
    when new_verified is null then target_profile.verification_status
    when new_verified then 'Verified'
    else 'Pending'
  end;

  perform set_config('app.bypass_profile_guard', 'true', true);

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

    insert into public.activity_logs (
      user_id, user_email, user_name, actor_id, actor_name,
      action, category, details
    ) values (
      target_profile.id, target_profile.email, target_profile.full_name,
      actor_profile.id, actor_profile.full_name,
      'status_changed', 'security',
      'Account status changed from ' || target_profile.account_status || ' to ' || new_account_status
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

-- Replace legacy Admin promotion RPC with Organizer promotion RPC
drop function if exists public.super_admin_promote_user_to_admin(uuid);

create or replace function public.super_admin_promote_user_to_organizer(
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
    and approval_status = 'Approved'
    and role = 'Super Admin';

  if not found then
    raise exception 'Only an active approved Super Admin can promote users to Organizer';
  end if;

  if target_user_id = actor_profile.id then
    raise exception 'A Super Admin cannot promote their own account';
  end if;

  select * into target_profile
  from public.user_profiles
  where id = target_user_id
    and account_status = 'Active'
    and role in ('Participant', 'Volunteer', 'Judge', 'Guest', 'Sponsor', 'Mentor', 'Organizer');

  if not found then
    raise exception 'Only another active non-Super-Admin account can be promoted';
  end if;

  perform set_config('app.bypass_profile_guard', 'true', true);

  update public.user_profiles
  set role = 'Organizer',
      assigned_role = 'Organizer',
      approval_status = 'Approved',
      verified = true,
      verification_status = 'Verified',
      updated_at = now()
  where id = target_user_id;

  if target_profile.role <> 'Organizer' then
    insert into public.role_change_logs (
      user_id, user_email, user_name, previous_role, new_role,
      changed_by, changed_by_name, notes
    ) values (
      target_profile.id, target_profile.email, target_profile.full_name,
      target_profile.role, 'Organizer', actor_profile.id, actor_profile.full_name,
      'Promoted to Organizer by Super Admin'
    );

    insert into public.activity_logs (
      user_id, user_email, user_name, actor_id, actor_name,
      action, category, details
    ) values (
      target_profile.id, target_profile.email, target_profile.full_name,
      actor_profile.id, actor_profile.full_name,
      'role_changed', 'governance',
      'Promoted to Organizer by Super Admin'
    );
  end if;
end;
$$;

revoke all on function public.super_admin_promote_user_to_organizer(uuid) from public;
grant execute on function public.super_admin_promote_user_to_organizer(uuid) to authenticated;

create or replace function public.super_admin_trash_rejected_user(
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_active_super_admin() then
    raise exception 'Only an active approved Super Admin can move accounts to Trash';
  end if;

  perform set_config('app.bypass_profile_guard', 'true', true);

  update public.user_profiles
  set trashed_at = now(),
      updated_at = now()
  where id = target_user_id
    and (approval_status = 'Rejected' or account_status = 'Rejected')
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
  if not public.is_active_super_admin() then
    raise exception 'Only an active approved Super Admin can restore accounts from Trash';
  end if;

  perform set_config('app.bypass_profile_guard', 'true', true);

  update public.user_profiles
  set trashed_at = null,
      updated_at = now()
  where id = target_user_id
    and (approval_status = 'Rejected' or account_status = 'Rejected')
    and trashed_at is not null;

  if not found then
    raise exception 'Trashed rejected account was not found';
  end if;
end;
$$;

-- Strict Profile Isolation, Non-Email Enforcement for Department & Institution,
-- Corrupted Metadata Cleanup, and Hardened user_profiles RLS Policies

-- 1. Immutable email-pattern detector for plain-text affiliation columns
create or replace function public.is_email_like(val text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(btrim(val), '') ~* '[^\s@]+@[^\s@]+\.[^\s@]+';
$$;

-- 2. Clean up any previously corrupted rows where browser autofill or legacy code
-- stored an email address inside department or institution.
do $$
begin
  perform set_config('app.bypass_profile_guard', 'true', true);

  update public.user_profiles
  set department = case
        when public.is_email_like(department) then ''
        else btrim(department)
      end,
      institution = case
        when public.is_email_like(institution) then ''
        else btrim(institution)
      end,
      updated_at = now()
  where public.is_email_like(department)
     or public.is_email_like(institution);
end $$;

-- 3. Enforce database-level CHECK constraints forbidding email values in department/institution
alter table public.user_profiles
  drop constraint if exists user_profiles_department_not_email_check,
  drop constraint if exists user_profiles_institution_not_email_check;

alter table public.user_profiles
  add constraint user_profiles_department_not_email_check
    check (not public.is_email_like(department)),
  add constraint user_profiles_institution_not_email_check
    check (not public.is_email_like(institution));

-- 4. Re-assert strict RLS policies on user_profiles (auth.uid() only, unless approved active staff)
alter table public.user_profiles enable row level security;

revoke all on public.user_profiles from public, anon;
revoke all on public.user_profiles from authenticated;
grant select on public.user_profiles to authenticated;
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

drop policy if exists "Users read own profile and staff read all" on public.user_profiles;
create policy "Users read own profile and staff read all"
  on public.user_profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.is_active_staff())
  );

drop policy if exists "Users update own profile" on public.user_profiles;
create policy "Users update own profile"
  on public.user_profiles for update to authenticated
  using (
    id = (select auth.uid())
    or (select public.is_active_staff())
  )
  with check (
    id = (select auth.uid())
    or (select public.is_active_staff())
  );

-- 5. Harden sync_and_guard_user_profile trigger against email contamination & privilege escalation
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

-- 6. Harden signup trigger to keep empty fields empty and never populate email values into department/institution
create or replace function public.create_user_profile_on_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text := coalesce(new.raw_user_meta_data ->> 'requested_role', 'Participant');
  full_name_val text := btrim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  email_val text := btrim(coalesce(new.email, ''));
  phone_val text := btrim(coalesce(new.raw_user_meta_data ->> 'phone', ''));
  dept_val text := btrim(coalesce(new.raw_user_meta_data ->> 'department', ''));
  inst_val text := btrim(coalesce(new.raw_user_meta_data ->> 'institution', ''));
  addr_val text := btrim(coalesce(new.raw_user_meta_data ->> 'address', ''));
begin
  if requested not in ('Participant', 'Volunteer', 'Judge', 'Guest', 'Sponsor', 'Mentor') then
    requested := 'Participant';
  end if;

  if public.is_email_like(dept_val) or (dept_val <> '' and lower(dept_val) = lower(email_val)) then
    dept_val := '';
  end if;
  if public.is_email_like(inst_val) or (inst_val <> '' and lower(inst_val) = lower(email_val)) then
    inst_val := '';
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
    phone_val,
    'Participant',
    'Participant',
    requested,
    dept_val,
    inst_val,
    addr_val,
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

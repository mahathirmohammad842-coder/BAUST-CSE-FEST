create table if not exists public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null unique,
  phone text not null default '',
  role text not null default 'Participant'
    check (role in ('Organizer', 'Participant', 'Volunteer', 'Judge', 'Guest', 'Sponsor', 'Mentor', 'Admin', 'Super Admin')),
  requested_role text not null default 'Participant'
    check (requested_role in ('Participant', 'Volunteer', 'Judge', 'Guest', 'Sponsor', 'Mentor')),
  department text not null default '',
  institution text not null default '',
  biography text not null default '',
  photo_url text not null default '',
  social_links jsonb not null default '{"website":"","linkedIn":"","github":""}'::jsonb,
  notification_preferences jsonb not null default '{"email":true,"push":true,"inApp":true,"securityAlerts":true}'::jsonb,
  account_status text not null default 'Pending Approval'
    check (account_status in ('Active', 'Pending Approval', 'Rejected', 'Suspended')),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id text primary key,
  payload jsonb not null,
  updated_by uuid not null references auth.users (id),
  updated_at timestamptz not null default now()
);

create table if not exists public.personal_notification_actions (
  user_id uuid not null references auth.users (id) on delete cascade,
  notification_id text not null,
  state jsonb not null default '{}'::jsonb,
  events jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, notification_id)
);

create or replace function public.touch_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_profiles_updated_at on public.user_profiles;
create trigger user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function public.touch_profile_updated_at();

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
      and p.role in ('Organizer', 'Admin', 'Super Admin')
  );
$$;

revoke all on function public.is_active_staff() from public;
grant execute on function public.is_active_staff() to authenticated;

create or replace function public.create_user_profile_on_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text := coalesce(new.raw_user_meta_data ->> 'requested_role', 'Participant');
  safe_role text;
begin
  if requested not in ('Participant', 'Volunteer', 'Judge', 'Guest', 'Sponsor', 'Mentor') then
    requested := 'Participant';
  end if;
  safe_role := requested;
  insert into public.user_profiles (
    id, full_name, email, phone, role, requested_role, department,
    institution, account_status, verified
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    safe_role,
    requested,
    coalesce(new.raw_user_meta_data ->> 'department', ''),
    coalesce(new.raw_user_meta_data ->> 'institution', ''),
    'Pending Approval',
    false
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.create_user_profile_on_signup();

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
    and account_status = 'Pending Approval';
  if not found then
    raise exception 'Pending user profile was not found';
  end if;
end;
$$;

revoke all on function public.review_user_registration(uuid, boolean) from public;
grant execute on function public.review_user_registration(uuid, boolean) to authenticated;

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
begin
  if not public.is_active_staff() then
    raise exception 'Only active staff can manage profiles';
  end if;
  if new_account_status is not null
    and new_account_status not in ('Active', 'Suspended') then
    raise exception 'Unsupported account status';
  end if;
  update public.user_profiles
  set account_status = coalesce(new_account_status, account_status),
      verified = coalesce(new_verified, verified),
      updated_at = now()
  where id = target_user_id;
  if not found then
    raise exception 'User profile was not found';
  end if;
end;
$$;

revoke all on function public.admin_update_profile_flags(uuid, text, boolean) from public;
grant execute on function public.admin_update_profile_flags(uuid, text, boolean) to authenticated;

alter table public.user_profiles enable row level security;
alter table public.announcements enable row level security;
alter table public.personal_notification_actions enable row level security;

revoke all on public.user_profiles from anon, authenticated;
grant select on public.user_profiles to authenticated;
grant update (
  full_name, phone, department, institution, biography, photo_url,
  social_links, notification_preferences, updated_at
) on public.user_profiles to authenticated;

drop policy if exists "Users read own profile and staff read all" on public.user_profiles;
create policy "Users read own profile and staff read all"
  on public.user_profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_active_staff()));

drop policy if exists "Users update own profile" on public.user_profiles;
create policy "Users update own profile"
  on public.user_profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.is_active_staff()))
  with check (id = (select auth.uid()) or (select public.is_active_staff()));

grant select on public.announcements to authenticated;
grant insert, update, delete on public.announcements to authenticated;

drop policy if exists "Active users read announcements" on public.announcements;
create policy "Active users read announcements"
  on public.announcements for select to authenticated
  using (exists (
    select 1 from public.user_profiles p
    where p.id = (select auth.uid()) and p.account_status = 'Active'
  ));

drop policy if exists "Staff manage announcements" on public.announcements;
create policy "Staff manage announcements"
  on public.announcements for all to authenticated
  using ((select public.is_active_staff()))
  with check ((select public.is_active_staff()));

grant select, insert, update, delete on public.personal_notification_actions to authenticated;

drop policy if exists "Users manage own notification actions" on public.personal_notification_actions;
create policy "Users manage own notification actions"
  on public.personal_notification_actions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) values (
  'notice-attachments',
  'notice-attachments',
  false,
  26214400,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/zip',
    'text/plain'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Active users read notice attachments" on storage.objects;
create policy "Active users read notice attachments"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'notice-attachments'
    and exists (
      select 1 from public.user_profiles p
      where p.id = (select auth.uid()) and p.account_status = 'Active'
    )
  );

drop policy if exists "Staff upload notice attachments" on storage.objects;
create policy "Staff upload notice attachments"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'notice-attachments'
    and (select public.is_active_staff())
  );

drop policy if exists "Staff update notice attachments" on storage.objects;
create policy "Staff update notice attachments"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'notice-attachments'
    and (select public.is_active_staff())
  )
  with check (
    bucket_id = 'notice-attachments'
    and (select public.is_active_staff())
  );

drop policy if exists "Staff delete notice attachments" on storage.objects;
create policy "Staff delete notice attachments"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'notice-attachments'
    and (select public.is_active_staff())
  );

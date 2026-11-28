-- Run manually in the Supabase SQL Editor after creating the Super Admin user in Authentication.
-- Replace '<SUPER_ADMIN_EMAIL>' and '<SUPER_ADMIN_NAME>' with your administrator's account details.

insert into public.user_profiles (
  id,
  full_name,
  email,
  phone,
  role,
  assigned_role,
  requested_role,
  department,
  institution,
  account_status,
  approval_status,
  verification_status,
  verified
)
select
  users.id,
  coalesce(nullif(btrim(users.raw_user_meta_data ->> 'full_name'), ''), 'Platform Super Admin'),
  users.email,
  coalesce(btrim(users.raw_user_meta_data ->> 'phone'), ''),
  'Super Admin',
  'Super Admin',
  'Participant',
  'Computer Science & Engineering',
  'BAUST',
  'Active',
  'Approved',
  'Verified',
  true
from auth.users as users
where lower(users.email) = lower('<SUPER_ADMIN_EMAIL>')
on conflict (id) do update
set role = excluded.role,
    assigned_role = excluded.assigned_role,
    account_status = excluded.account_status,
    approval_status = excluded.approval_status,
    verification_status = excluded.verification_status,
    verified = excluded.verified,
    updated_at = now();

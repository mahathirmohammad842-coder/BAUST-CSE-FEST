insert into public.user_profiles (
  id,
  full_name,
  email,
  phone,
  role,
  requested_role,
  department,
  institution,
  account_status,
  verified
)
select
  users.id,
  'Mahathir Mohammad',
  users.email,
  '+8801792102548',
  'Super Admin',
  'Participant',
  'Computer Science & Engineering',
  'BAUST',
  'Active',
  true
from auth.users as users
where lower(users.email) = lower('mahathirmohammad842@gmail.com')
on conflict (id) do update
set full_name = excluded.full_name,
    email = excluded.email,
    phone = excluded.phone,
    role = excluded.role,
    requested_role = excluded.requested_role,
    department = excluded.department,
    institution = excluded.institution,
    account_status = excluded.account_status,
    verified = excluded.verified,
    updated_at = now();

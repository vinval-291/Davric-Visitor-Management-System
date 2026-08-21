-- =============================================================
--  Utility: assign application roles to user accounts.
--
--  Supabase Auth has no role field -- deliberately. It handles
--  identity only. Roles are an application concern and live in
--  public.profiles, which is where the RLS policies read them from.
--
--  Roles are also NOT settable at signup (see handle_new_user in
--  0001), otherwise anyone could self-assign super_admin. So the
--  first accounts are assigned here. After Step 11 the admin screen
--  does this job.
--
--  HOW TO USE
--  1. Supabase dashboard > Authentication > Users > Add user.
--     Tick "Auto Confirm User" so no confirmation email is needed.
--     Repeat for each person. No role is chosen there.
--  2. List the emails and roles below.
--  3. SQL Editor > paste this whole file > Run.
--
--  Emails that have no account yet are simply skipped, so it is safe
--  to run this before every account exists, and safe to re-run.
--
--  Valid roles: 'super_admin', 'receptionist', 'pa'
-- =============================================================

update public.profiles p
   set role = v.role::public.app_role
  from auth.users u,
       (values
          ('kuteyioluwaloyevincent291@gmail.com', 'super_admin'),
          ('reception@test.local',                'receptionist'),
          ('pa@test.local',                       'pa')
       ) as v(email, role)
 where u.id = p.id
   and lower(u.email) = lower(v.email);


-- Confirm the result. Every account and the role it now holds:
select p.full_name,
       u.email,
       p.role,
       p.is_active,
       p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
 order by p.created_at;

-- =============================================================
--  Dav-Ric Group Visitor Management System
--  Migration 0002 - role helpers, guard triggers, RLS policies
--
--  Run after 0001. Safe to re-run.
-- =============================================================


-- =============================================================
--  1. Role helper functions
--
--  These are SECURITY DEFINER on purpose. They execute as the
--  function owner, which bypasses RLS, so a policy on profiles can
--  call them without re-entering profiles' own policies. Calling
--  profiles directly from a profiles policy would recurse forever
--  and take every query in the app down with it.
--
--  STABLE lets the planner call them once per statement instead of
--  once per row.
-- =============================================================

create or replace function public.current_app_role()
returns public.app_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles
   where id = (select auth.uid()) and is_active
$$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_app_role() = 'super_admin', false)
$$;

create or replace function public.is_receptionist()
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_app_role() = 'receptionist', false)
$$;

create or replace function public.is_pa()
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_app_role() = 'pa', false)
$$;

-- Reception staff and admins both work the front desk data.
create or replace function public.is_desk_staff()
returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_super_admin() or public.is_receptionist()
$$;

-- Is the caller an assigned PA for this executive? Wrapped in a
-- SECURITY DEFINER function so the visitors policy does not have to
-- read executive_assignments through that table's own RLS.
create or replace function public.is_pa_for_executive(exec_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.executive_assignments a
     where a.executive_id = exec_id
       and a.pa_user_id = (select auth.uid())
  )
$$;

grant execute on function
  public.current_app_role(), public.is_super_admin(),
  public.is_receptionist(), public.is_pa(),
  public.is_desk_staff(), public.is_pa_for_executive(uuid)
to authenticated;


-- =============================================================
--  2. Guard triggers
--
--  RLS decides which ROWS you may touch, but it cannot stop you
--  editing a column you should not. These triggers close that gap.
-- =============================================================

-- Nobody promotes themselves. Only a super admin changes role,
-- department or active status.
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_super_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Only a super admin can change a user role';
  end if;
  if new.is_active is distinct from old.is_active then
    raise exception 'Only a super admin can activate or deactivate a user';
  end if;
  if new.department_id is distinct from old.department_id then
    raise exception 'Only a super admin can change a user department';
  end if;

  return new;
end $$;

drop trigger if exists profiles_guard_privileges on public.profiles;
create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();


-- A visit record is evidence. Once written, a receptionist may only
-- check the visitor out; the identity, signature and arrival time are
-- immutable. Super admins can still correct genuine mistakes, and the
-- audit log records it.
create or replace function public.guard_visitor_immutability()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_super_admin() then
    return new;
  end if;

  if new.full_name       is distinct from old.full_name
  or new.phone           is distinct from old.phone
  or new.organization    is distinct from old.organization
  or new.purpose         is distinct from old.purpose
  or new.executive_id    is distinct from old.executive_id
  or new.signature_path  is distinct from old.signature_path
  or new.check_in_time   is distinct from old.check_in_time
  or new.created_by      is distinct from old.created_by then
    raise exception
      'A visit record cannot be altered after check-in. Only check-out is allowed.';
  end if;

  if old.check_out_time is not null
     and new.check_out_time is distinct from old.check_out_time then
    raise exception 'This visitor has already been checked out';
  end if;

  return new;
end $$;

drop trigger if exists visitors_guard_immutability on public.visitors;
create trigger visitors_guard_immutability
  before update on public.visitors
  for each row execute function public.guard_visitor_immutability();


-- A PA may only flip their own notification's read state.
create or replace function public.guard_notification_updates()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_super_admin() then
    return new;
  end if;

  if new.visitor_id   is distinct from old.visitor_id
  or new.recipient_id is distinct from old.recipient_id
  or new.message      is distinct from old.message
  or new.type         is distinct from old.type then
    raise exception 'Only the read status of a notification can be changed';
  end if;

  if new.is_read and not old.is_read then
    new.read_at := now();
  end if;

  return new;
end $$;

drop trigger if exists notifications_guard_updates on public.notifications;
create trigger notifications_guard_updates
  before update on public.notifications
  for each row execute function public.guard_notification_updates();


-- =============================================================
--  3. Grants
--
--  anon is the unauthenticated browser role. It gets nothing at all:
--  no dashboard, no visitor data, not even a table shape.
-- =============================================================

revoke all on all tables in schema public from anon;

grant select on public.departments, public.executives to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant insert, update, delete on public.departments, public.executives to authenticated;
grant select, insert, update, delete on public.executive_assignments to authenticated;
grant select, insert, update, delete on public.visitors to authenticated;
grant select, update, delete on public.notifications to authenticated;
grant select, insert on public.audit_logs to authenticated;


-- =============================================================
--  4. Policies
-- =============================================================

-- ---------- departments -------------------------------------------
-- Everyone signed in reads them: the receptionist picks one at
-- check-in, the PA sees it on the alert. Only admins change them.

drop policy if exists departments_read on public.departments;
create policy departments_read on public.departments
  for select to authenticated using (true);

drop policy if exists departments_admin_write on public.departments;
create policy departments_admin_write on public.departments
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());


-- ---------- executives --------------------------------------------

drop policy if exists executives_read on public.executives;
create policy executives_read on public.executives
  for select to authenticated using (true);

drop policy if exists executives_admin_write on public.executives;
create policy executives_admin_write on public.executives
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());


-- ---------- profiles ----------------------------------------------

drop policy if exists profiles_read_own on public.profiles;
create policy profiles_read_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_super_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or public.is_super_admin())
  with check (id = (select auth.uid()) or public.is_super_admin());

drop policy if exists profiles_admin_insert on public.profiles;
create policy profiles_admin_insert on public.profiles
  for insert to authenticated
  with check (public.is_super_admin());


-- ---------- executive_assignments ---------------------------------
-- A PA can see which executives they cover. Only admins edit.

drop policy if exists assignments_read on public.executive_assignments;
create policy assignments_read on public.executive_assignments
  for select to authenticated
  using (pa_user_id = (select auth.uid()) or public.is_super_admin());

drop policy if exists assignments_admin_write on public.executive_assignments;
create policy assignments_admin_write on public.executive_assignments
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());


-- ---------- visitors ----------------------------------------------
-- Desk staff see everything: they run the front desk and search
-- history. A PA sees only visits for executives they are assigned to,
-- which is the least privilege that still does their job.

drop policy if exists visitors_read on public.visitors;
create policy visitors_read on public.visitors
  for select to authenticated
  using (
    public.is_desk_staff()
    or (public.is_pa() and public.is_pa_for_executive(executive_id))
  );

-- created_by is forced to the caller, so a receptionist cannot file a
-- visit under someone else's name.
drop policy if exists visitors_desk_insert on public.visitors;
create policy visitors_desk_insert on public.visitors
  for insert to authenticated
  with check (public.is_desk_staff() and created_by = (select auth.uid()));

-- The check-out path. The guard trigger above limits WHAT may change.
drop policy if exists visitors_desk_update on public.visitors;
create policy visitors_desk_update on public.visitors
  for update to authenticated
  using (public.is_desk_staff())
  with check (public.is_desk_staff());

drop policy if exists visitors_admin_delete on public.visitors;
create policy visitors_admin_delete on public.visitors
  for delete to authenticated
  using (public.is_super_admin());


-- ---------- notifications -----------------------------------------
-- No INSERT policy anywhere. Notifications are created only by the
-- SECURITY DEFINER trigger from Step 3, which bypasses RLS. That means
-- no client can ever forge a visitor alert.

drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications
  for select to authenticated
  using (recipient_id = (select auth.uid()) or public.is_super_admin());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (recipient_id = (select auth.uid()) or public.is_super_admin())
  with check (recipient_id = (select auth.uid()) or public.is_super_admin());

drop policy if exists notifications_admin_delete on public.notifications;
create policy notifications_admin_delete on public.notifications
  for delete to authenticated
  using (public.is_super_admin());


-- ---------- audit_logs --------------------------------------------
-- Append-only by design. There is deliberately no UPDATE or DELETE
-- policy, so not even a super admin can rewrite the record through
-- the API.

drop policy if exists audit_read_admin on public.audit_logs;
create policy audit_read_admin on public.audit_logs
  for select to authenticated
  using (public.is_super_admin());

drop policy if exists audit_insert_self on public.audit_logs;
create policy audit_insert_self on public.audit_logs
  for insert to authenticated
  with check (actor_id = (select auth.uid()));


-- =============================================================
--  5. Realtime
--  The PA dashboard subscribes to notifications. Realtime respects
--  RLS, so a PA receives only rows addressed to them.
-- =============================================================

do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.visitors;
exception when duplicate_object then null; end $$;

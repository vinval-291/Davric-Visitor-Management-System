-- =============================================================
--  Migration 0003 - let trusted server context through the guards
--
--  Problem this fixes:
--  The guard triggers in 0002 allow privileged edits only when
--  is_super_admin() is true. In the SQL Editor there is no signed-in
--  user, so auth.uid() is NULL, is_super_admin() is false, and even
--  creating the very first super admin is rejected. The system could
--  never be bootstrapped, and no maintenance SQL could ever run.
--
--  Why the carve-out is safe:
--  Every request through the API carries a JWT, so auth.uid() is
--  always populated for a real user -- a signed-in receptionist is
--  still blocked exactly as before. auth.uid() is NULL only for the
--  SQL Editor, migrations and the service_role key, all of which
--  already have full database access by other means. This grants no
--  new capability; it just stops the trigger from blocking the
--  contexts that were never the threat.
-- =============================================================

create or replace function public.is_privileged_context()
returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is null   -- SQL Editor / migration / service_role
      or public.is_super_admin()
$$;

grant execute on function public.is_privileged_context() to authenticated;


-- ---------- profiles guard ----------------------------------------

create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_privileged_context() then
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


-- ---------- visitors guard ----------------------------------------

create or replace function public.guard_visitor_immutability()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_privileged_context() then
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


-- ---------- notifications guard -----------------------------------

create or replace function public.guard_notification_updates()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_privileged_context() then
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

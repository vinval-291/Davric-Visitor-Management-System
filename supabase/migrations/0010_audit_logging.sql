-- =============================================================
--  Migration 0010 - audit logging
--
--  Written by database triggers, not by the application. Client-side
--  logging records only what the client chooses to admit to; a
--  trigger fires on the write itself, so an action cannot happen
--  without being logged.
--
--  actor_id is null when the change came from the SQL Editor, a
--  migration or service_role tooling. That is information, not a gap:
--  a null actor means "changed outside the application".
-- =============================================================

create or replace function public.write_audit(
  p_action      text,
  p_entity_type text,
  p_entity_id   uuid,
  p_details     jsonb default '{}'::jsonb
)
returns void
language sql security definer set search_path = '' as $$
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), p_action, p_entity_type, p_entity_id, p_details)
$$;


-- ---------- visitor lifecycle -------------------------------------

create or replace function public.audit_visitors()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit('visitor.check_in', 'visitor', new.id,
      jsonb_build_object(
        'visitor',      new.full_name,
        'organization', new.organization,
        'visiting',     new.executive_name_snapshot,
        'department',   new.department_name_snapshot,
        'signed',       new.signature_path is not null
      ));
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.write_audit('visitor.deleted', 'visitor', old.id,
      jsonb_build_object(
        'visitor',  old.full_name,
        'visiting', old.executive_name_snapshot,
        'arrived',  old.check_in_time
      ));
    return old;
  end if;

  -- UPDATE. Each meaningful transition is logged separately so the
  -- log reads as a story rather than a diff.
  if old.admitted_at is null and new.admitted_at is not null then
    perform public.write_audit('visitor.admitted', 'visitor', new.id,
      jsonb_build_object(
        'visitor',       new.full_name,
        'visiting',      new.executive_name_snapshot,
        'waited_seconds', extract(epoch from new.admitted_at - new.check_in_time)
      ));
  end if;

  if old.check_out_time is null and new.check_out_time is not null then
    perform public.write_audit('visitor.check_out', 'visitor', new.id,
      jsonb_build_object(
        'visitor',       new.full_name,
        'visiting',      new.executive_name_snapshot,
        'stayed_seconds', extract(epoch from new.check_out_time - new.check_in_time)
      ));
  end if;

  -- Anything else changing on a visit record should be rare and is
  -- worth a loud entry: only a super admin can do it.
  if new.full_name      is distinct from old.full_name
  or new.phone          is distinct from old.phone
  or new.organization   is distinct from old.organization
  or new.purpose        is distinct from old.purpose
  or new.executive_id   is distinct from old.executive_id
  or new.signature_path is distinct from old.signature_path
  or new.check_in_time  is distinct from old.check_in_time then
    perform public.write_audit('visitor.amended', 'visitor', new.id,
      jsonb_build_object(
        'before', jsonb_build_object(
          'full_name', old.full_name, 'phone', old.phone,
          'organization', old.organization, 'purpose', old.purpose,
          'check_in_time', old.check_in_time),
        'after', jsonb_build_object(
          'full_name', new.full_name, 'phone', new.phone,
          'organization', new.organization, 'purpose', new.purpose,
          'check_in_time', new.check_in_time)
      ));
  end if;

  return new;
end $$;

drop trigger if exists visitors_audit on public.visitors;
create trigger visitors_audit
  after insert or update or delete on public.visitors
  for each row execute function public.audit_visitors();


-- ---------- privilege changes -------------------------------------

create or replace function public.audit_profiles()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role is distinct from old.role then
    perform public.write_audit('user.role_changed', 'profile', new.id,
      jsonb_build_object('user', new.full_name, 'email', new.email,
                         'from', old.role, 'to', new.role));
  end if;

  if new.is_active is distinct from old.is_active then
    perform public.write_audit(
      case when new.is_active then 'user.activated' else 'user.deactivated' end,
      'profile', new.id,
      jsonb_build_object('user', new.full_name, 'email', new.email));
  end if;

  return new;
end $$;

drop trigger if exists profiles_audit on public.profiles;
create trigger profiles_audit
  after update on public.profiles
  for each row execute function public.audit_profiles();


-- ---------- notification routing ----------------------------------
-- Who gets told about arrivals is a security-relevant setting: change
-- it quietly and visitors for an executive start going to the wrong
-- person, or to nobody.

create or replace function public.audit_assignments()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  exec_name text;
  pa_name   text;
begin
  select full_name into exec_name from public.executives
   where id = coalesce(new.executive_id, old.executive_id);
  select full_name into pa_name from public.profiles
   where id = coalesce(new.pa_user_id, old.pa_user_id);

  if tg_op = 'INSERT' then
    perform public.write_audit('pa.assigned', 'assignment', new.id,
      jsonb_build_object('executive', exec_name, 'pa', pa_name,
                         'primary', new.is_primary));
    return new;
  elsif tg_op = 'DELETE' then
    perform public.write_audit('pa.unassigned', 'assignment', old.id,
      jsonb_build_object('executive', exec_name, 'pa', pa_name));
    return old;
  else
    if new.is_primary is distinct from old.is_primary then
      perform public.write_audit('pa.primary_changed', 'assignment', new.id,
        jsonb_build_object('executive', exec_name, 'pa', pa_name,
                           'primary', new.is_primary));
    end if;
    return new;
  end if;
end $$;

drop trigger if exists assignments_audit on public.executive_assignments;
create trigger assignments_audit
  after insert or update or delete on public.executive_assignments
  for each row execute function public.audit_assignments();


-- ---------- executives --------------------------------------------

create or replace function public.audit_executives()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit('executive.created', 'executive', new.id,
      jsonb_build_object('name', new.full_name, 'position', new.position));
    return new;
  elsif tg_op = 'DELETE' then
    perform public.write_audit('executive.deleted', 'executive', old.id,
      jsonb_build_object('name', old.full_name));
    return old;
  elsif new.is_active is distinct from old.is_active then
    perform public.write_audit(
      case when new.is_active then 'executive.activated'
           else 'executive.deactivated' end,
      'executive', new.id,
      jsonb_build_object('name', new.full_name));
  end if;
  return new;
end $$;

drop trigger if exists executives_audit on public.executives;
create trigger executives_audit
  after insert or update or delete on public.executives
  for each row execute function public.audit_executives();


-- ---------- retention --------------------------------------------
-- Audit rows are small but they accumulate. This is here for whoever
-- inherits the system; call it from a scheduled job if Dav-Ric sets a
-- retention policy. Nothing calls it automatically.

create or replace function public.prune_audit_logs(keep_days int default 730)
returns bigint
language plpgsql security definer set search_path = '' as $$
declare removed bigint;
begin
  delete from public.audit_logs
   where created_at < now() - make_interval(days => keep_days);
  get diagnostics removed = row_count;
  return removed;
end $$;

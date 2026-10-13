-- =============================================================
--  Migration 0018 - send a visitor to the Experience Center
--
--  Run after 0017. Safe to re-run.
--
--  "Send up" was the host's only answer to an arrival. Some visitors
--  are not meant to go upstairs at all -- they are better served at
--  the Experience Center -- and reception had no way of being told so.
--
--  This is a second destination for the same admission event, not a
--  new event. A visit is still admitted once, by the host or their PA,
--  at the server's time; admitted_to records where they were sent.
--  Keeping it on the admission means wait time, the audit trail and
--  "who is still waiting" all work unchanged for both answers.
-- =============================================================

alter table public.visitors
  add column if not exists admitted_to text;

-- Every visit admitted before this migration went upstairs.
update public.visitors
   set admitted_to = 'office'
 where admitted_at is not null
   and admitted_to is null;

alter table public.visitors
  drop constraint if exists visitors_admitted_to_valid;
alter table public.visitors
  add constraint visitors_admitted_to_valid
  check (admitted_to in ('office', 'experience_center'));

-- A destination without an admission, or an admission without a
-- destination, would each be a record that contradicts itself.
alter table public.visitors
  drop constraint if exists visitors_admitted_to_with_admission;
alter table public.visitors
  add constraint visitors_admitted_to_with_admission
  check ((admitted_to is null) = (admitted_at is null));


-- ---------- guard ----------------------------------------------------
-- As 0017, plus: the destination is chosen at admission and frozen
-- with it.

create or replace function public.guard_visitor_immutability()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Before the privileged return, so it applies to everyone: an app
  -- still running a build from before this migration sends only
  -- admitted_at, and that has always meant "send up".
  if new.admitted_at is not null and new.admitted_to is null then
    new.admitted_to := 'office';
  end if;

  if public.is_privileged_context() then
    return new;
  end if;

  if new.full_name       is distinct from old.full_name
  or new.phone           is distinct from old.phone
  or new.organization    is distinct from old.organization
  or new.purpose         is distinct from old.purpose
  or new.visit_type      is distinct from old.visit_type
  or new.has_appointment is distinct from old.has_appointment
  or new.executive_id    is distinct from old.executive_id
  or new.signature_path  is distinct from old.signature_path
  or new.check_in_time   is distinct from old.check_in_time
  or new.created_by      is distinct from old.created_by
  or new.admitted_by     is distinct from old.admitted_by then
    raise exception
      'A visit record cannot be altered after check-in. Only admission and check-out are allowed.';
  end if;

  if new.admitted_at is distinct from old.admitted_at then
    if old.admitted_at is not null then
      raise exception 'This visitor has already been sent on';
    end if;
    if not (public.is_desk_staff()
            or public.is_host_for_executive(new.executive_id)) then
      raise exception 'Only the host or their PA can send a visitor on';
    end if;
    new.admitted_at := now();
    new.admitted_by := (select auth.uid());
  elsif new.admitted_to is distinct from old.admitted_to then
    raise exception 'Where a visitor was sent cannot be changed afterwards';
  end if;

  if new.check_out_time is distinct from old.check_out_time then
    if not public.is_desk_staff() then
      raise exception 'Only reception can check a visitor out';
    end if;
    if old.check_out_time is not null then
      raise exception 'This visitor has already been checked out';
    end if;
    new.check_out_time := now();
  end if;

  return new;
end $$;


-- ---------- reception's alert --------------------------------------
-- Same recipients as 0013. Only the wording depends on the destination,
-- since it is what the receptionist reads out to the visitor.

create or replace function public.notify_desk_on_admission()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  msg        text;
  recipients uuid[];
begin
  if old.admitted_at is not null or new.admitted_at is null then
    return new;
  end if;

  if new.admitted_to = 'experience_center' then
    msg := format(
      '%s should go to the Experience Center (here to see %s).',
      new.full_name,
      coalesce(new.executive_name_snapshot, 'their host')
    );
  else
    msg := format(
      '%s may now go up to %s.',
      new.full_name,
      coalesce(new.executive_name_snapshot, 'their host')
    );
  end if;

  select array_agg(id) into recipients
    from public.profiles
   where id = new.created_by
     and is_active
     and role in ('receptionist', 'super_admin');

  if recipients is null then
    select array_agg(id) into recipients
      from public.profiles
     where role = 'receptionist' and is_active;
  end if;

  if recipients is not null then
    insert into public.notifications (visitor_id, recipient_id, message, type)
    select new.id, r, msg, 'visitor_admitted'
      from unnest(recipients) as r;
  end if;

  return new;
end $$;


-- ---------- audit --------------------------------------------------
-- As 0017, with the destination recorded on admission.

create or replace function public.audit_visitors()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit('visitor.check_in', 'visitor', new.id,
      jsonb_build_object(
        'visitor',         new.full_name,
        'organization',    new.organization,
        'visiting',        new.executive_name_snapshot,
        'department',      new.department_name_snapshot,
        'visit_type',      new.visit_type,
        'has_appointment', new.has_appointment,
        'signed',          new.signature_path is not null
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

  if old.admitted_at is null and new.admitted_at is not null then
    perform public.write_audit('visitor.admitted', 'visitor', new.id,
      jsonb_build_object(
        'visitor',        new.full_name,
        'visiting',       new.executive_name_snapshot,
        'sent_to',        new.admitted_to,
        'waited_seconds', extract(epoch from new.admitted_at - new.check_in_time)
      ));
  end if;

  if old.check_out_time is null and new.check_out_time is not null then
    perform public.write_audit('visitor.check_out', 'visitor', new.id,
      jsonb_build_object(
        'visitor',        new.full_name,
        'visiting',       new.executive_name_snapshot,
        'stayed_seconds', extract(epoch from new.check_out_time - new.check_in_time)
      ));
  end if;

  if new.full_name       is distinct from old.full_name
  or new.phone           is distinct from old.phone
  or new.organization    is distinct from old.organization
  or new.purpose         is distinct from old.purpose
  or new.visit_type      is distinct from old.visit_type
  or new.has_appointment is distinct from old.has_appointment
  or new.executive_id    is distinct from old.executive_id
  or new.signature_path  is distinct from old.signature_path
  or new.check_in_time   is distinct from old.check_in_time then
    perform public.write_audit('visitor.amended', 'visitor', new.id,
      jsonb_build_object(
        'before', jsonb_build_object(
          'full_name', old.full_name, 'phone', old.phone,
          'organization', old.organization, 'purpose', old.purpose,
          'visit_type', old.visit_type, 'has_appointment', old.has_appointment,
          'check_in_time', old.check_in_time),
        'after', jsonb_build_object(
          'full_name', new.full_name, 'phone', new.phone,
          'organization', new.organization, 'purpose', new.purpose,
          'visit_type', new.visit_type, 'has_appointment', new.has_appointment,
          'check_in_time', new.check_in_time)
      ));
  end if;

  return new;
end $$;

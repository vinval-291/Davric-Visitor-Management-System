-- =============================================================
--  Migration 0017 - official or personal, and appointment or not
--
--  Two questions reception now asks every visitor, and that the host
--  sees before deciding what to do. A scheduled official meeting and
--  an unannounced personal call want very different answers from a
--  PA, and until now the alert gave them no way to tell the two apart.
--
--  The alert text itself now carries both answers and the purpose, so
--  they reach a locked phone through push without the app opening.
-- =============================================================

alter table public.visitors
  add column if not exists visit_type text,
  add column if not exists has_appointment boolean;

alter table public.visitors
  drop constraint if exists visitors_visit_type_valid;
alter table public.visitors
  add constraint visitors_visit_type_valid
  check (visit_type in ('official', 'personal'));

-- Reporting will filter on this.
create index if not exists visitors_visit_type_idx
  on public.visitors (visit_type);


-- ---------- required on every NEW visit ----------------------------
-- Enforced here, in the insert-only trigger, rather than as NOT NULL.
-- Visits recorded before this migration have no answer, and a NOT NULL
-- or table-wide check would make checking one of those visitors out
-- fail, because an update re-tests every constraint on the row.

create or replace function public.snapshot_visitor_host()
returns trigger language plpgsql security definer set search_path = '' as $$
declare ex record;
begin
  if new.executive_id is not null then
    select e.full_name, e.position, e.department_id, d.name as dept_name
      into ex
      from public.executives e
      left join public.departments d on d.id = e.department_id
     where e.id = new.executive_id;

    if found then
      new.executive_name_snapshot     := ex.full_name;
      new.executive_position_snapshot := ex.position;
      new.department_id               := coalesce(new.department_id, ex.department_id);
      new.department_name_snapshot    := coalesce(new.department_name_snapshot, ex.dept_name);
    end if;
  end if;

  if nullif(trim(coalesce(new.executive_name_snapshot, '')), '') is null then
    raise exception 'A visitor record must say who is being visited';
  end if;

  if new.visit_type is null then
    raise exception 'Record whether the visit is official or personal';
  end if;

  if new.has_appointment is null then
    raise exception 'Record whether the visitor has an appointment';
  end if;

  -- Every question on the form is compulsory, so the database refuses a
  -- visit without them too; a browser can skip its own validation.
  -- Checked here on insert only, for the same reason as above: older
  -- visits with no phone or purpose must still be able to check out.
  if nullif(trim(coalesce(new.phone, '')), '') is null then
    raise exception 'Record the visitor''s phone number';
  end if;

  if new.phone ~ '^(\d)\1+$' then
    raise exception 'That phone number is a placeholder, not a real number';
  end if;

  if nullif(trim(coalesce(new.organization, '')), '') is null then
    raise exception 'Record the visitor''s company, or Individual if none';
  end if;

  if nullif(trim(coalesce(new.purpose, '')), '') is null then
    raise exception 'Record the purpose of the visit';
  end if;

  return new;
end $$;


-- ---------- the alert text -----------------------------------------
-- Routing is unchanged from 0016. Only the message grows.
--
-- The purpose is trimmed to 140 characters: this text is also the body
-- of the push notification, and a paragraph pasted into the purpose
-- field would otherwise be cut off unpredictably by the phone.

create or replace function public.notify_assigned_pa()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  msg        text;
  purpose    text;
  recipients uuid[];
begin
  purpose := nullif(trim(coalesce(new.purpose, '')), '');
  if length(purpose) > 140 then
    purpose := left(purpose, 139) || '…';
  end if;

  msg := format(
    'NEW VISITOR - %s has arrived to see %s. %s, %s.%s Check-in time: %s.',
    new.full_name,
    coalesce(new.executive_name_snapshot, 'the office'),
    case new.visit_type when 'personal' then 'Personal visit'
                        else 'Official visit' end,
    case when new.has_appointment then 'has an appointment'
         else 'no appointment' end,
    case when purpose is not null then ' Purpose: ' || purpose || '.'
         else '' end,
    to_char(new.check_in_time at time zone 'Africa/Lagos', 'HH12:MI AM')
  );

  -- 1. the assigned PA(s)
  select array_agg(a.pa_user_id)
    into recipients
    from public.executive_assignments a
    join public.profiles p on p.id = a.pa_user_id and p.is_active
   where a.executive_id = new.executive_id;

  -- 2. no PA: the executive themselves, if they can sign in
  if recipients is null then
    select array_agg(e.user_id)
      into recipients
      from public.executives e
      join public.profiles p on p.id = e.user_id and p.is_active
     where e.id = new.executive_id
       and e.user_id is not null;
  end if;

  -- 3. nobody at all: the super admins, so an arrival is never lost
  if recipients is null then
    select array_agg(id) into recipients
      from public.profiles
     where role = 'super_admin' and is_active;
  end if;

  if recipients is not null then
    insert into public.notifications (visitor_id, recipient_id, message, type)
    select new.id, r, msg, 'visitor_arrival'
      from unnest(recipients) as r;
  end if;

  return new;
end $$;


-- ---------- both answers are part of the evidence ------------------

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
      raise exception 'This visitor has already been sent up';
    end if;
    if not (public.is_desk_staff()
            or public.is_host_for_executive(new.executive_id)) then
      raise exception 'Only the host or their PA can send a visitor up';
    end if;
    new.admitted_at := now();
    new.admitted_by := (select auth.uid());
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


-- ---------- audit --------------------------------------------------

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

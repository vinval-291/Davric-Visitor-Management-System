-- =============================================================
--  Migration 0019 - server time for super admins too
--
--  Run after 0018. Safe to re-run.
--
--  The guard returned early for a super admin before doing anything,
--  so when a super admin sent a visitor on or checked them out, the
--  record kept whatever time their browser sent -- and admitted_by was
--  never filled in. Every other role has always been stamped by the
--  server. A super admin's clock is no more trustworthy than a
--  tablet's, so the stamping now happens before that early return.
--
--  Only the moment of the event is stamped: admission when admitted_at
--  goes from empty to set, check-out likewise. A super admin can still
--  correct a time that is already recorded, as with any other field.
--
--  The SQL Editor, migrations and the service role (no signed-in user)
--  are left alone: maintenance and backfills sometimes need to write a
--  specific time on purpose.
--
--  The notification guard had the same shape: read_at was stamped
--  after the early return, so a super admin marking an alert read --
--  they receive every alert nobody else covers -- left read_at empty.
-- =============================================================

create or replace function public.guard_visitor_immutability()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  signed_in boolean := (select auth.uid()) is not null;
begin
  -- Before the privileged return, so it applies to everyone: an app
  -- still running a build from before 0018 sends only admitted_at,
  -- and that has always meant "send up".
  if new.admitted_at is not null and new.admitted_to is null then
    new.admitted_to := 'office';
  end if;

  -- Server time and server identity for anyone signed in, super admins
  -- included. The browser's value only signals that the event happened.
  if signed_in then
    if old.admitted_at is null and new.admitted_at is not null then
      new.admitted_at := now();
      new.admitted_by := (select auth.uid());
    end if;
    if old.check_out_time is null and new.check_out_time is not null then
      new.check_out_time := now();
    end if;
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
  or new.created_by      is distinct from old.created_by then
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
  elsif new.admitted_to is distinct from old.admitted_to then
    raise exception 'Where a visitor was sent cannot be changed afterwards';
  end if;

  -- admitted_by is set above, at the moment of admission, and only
  -- there. Any other change to it is an attempt to rewrite who did it.
  if new.admitted_by is distinct from old.admitted_by
     and not (old.admitted_at is null and new.admitted_at is not null) then
    raise exception
      'A visit record cannot be altered after check-in. Only admission and check-out are allowed.';
  end if;

  if new.check_out_time is distinct from old.check_out_time then
    if not public.is_desk_staff() then
      raise exception 'Only reception can check a visitor out';
    end if;
    if old.check_out_time is not null then
      raise exception 'This visitor has already been checked out';
    end if;
  end if;

  return new;
end $$;


-- ---------- notifications ------------------------------------------
-- As 0003, with read_at stamped before the privileged return.

create or replace function public.guard_notification_updates()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.is_read and not old.is_read
     and (select auth.uid()) is not null then
    new.read_at := now();
  end if;

  if public.is_privileged_context() then
    return new;
  end if;

  if new.visitor_id   is distinct from old.visitor_id
  or new.recipient_id is distinct from old.recipient_id
  or new.message      is distinct from old.message
  or new.type         is distinct from old.type then
    raise exception 'Only the read status of a notification can be changed';
  end if;

  return new;
end $$;

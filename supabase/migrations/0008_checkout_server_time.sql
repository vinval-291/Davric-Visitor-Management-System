-- =============================================================
--  Migration 0008 - stamp check-out with server time
--
--  admitted_at is already set by the server and ignores whatever the
--  client sends. check_out_time was still taking the browser's value,
--  which means a wrong clock on the reception tablet would silently
--  produce wrong departure times -- and visit duration is calculated
--  from it.
--
--  Super admins keep full control (is_privileged_context returns
--  early) so a genuine mistake can still be corrected by hand.
-- =============================================================

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
            or public.is_pa_for_executive(new.executive_id)) then
      raise exception 'Only the assigned PA can send a visitor up';
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
    -- Server clock, not the tablet's.
    new.check_out_time := now();
  end if;

  return new;
end $$;

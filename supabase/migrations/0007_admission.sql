-- =============================================================
--  Migration 0007 - the admission event
--
--  A visit now has three moments, not one:
--    check_in_time  the visitor arrived at reception   (automatic)
--    admitted_at    the host said "send them up"       (PA action)
--    check_out_time the visitor left                   (reception)
--
--  Keeping arrival separate from admission matters: a visitor waiting
--  in the lobby is on the premises, and must appear in an emergency
--  roll call from the moment they walk in. It also makes waiting time
--  (admitted_at - check_in_time) measurable, which is lost forever if
--  the two are collapsed into one timestamp.
-- =============================================================

alter table public.visitors
  add column if not exists admitted_at timestamptz,
  add column if not exists admitted_by uuid references public.profiles(id)
    on delete set null;

alter table public.visitors
  drop constraint if exists visitors_admitted_after_checkin;
alter table public.visitors
  add constraint visitors_admitted_after_checkin
  check (admitted_at is null or admitted_at >= check_in_time);

-- How long the visitor waited in reception. Generated, so it can
-- never disagree with the two timestamps it comes from.
alter table public.visitors
  drop column if exists wait_duration;
alter table public.visitors
  add column wait_duration interval
  generated always as (admitted_at - check_in_time) stored;

-- Finding everyone still waiting is the PA dashboard's main query.
create index if not exists visitors_awaiting_admission_idx
  on public.visitors (check_in_time desc)
  where admitted_at is null and check_out_time is null;


-- ---------- who may admit ------------------------------------------
-- PAs could not touch visitors at all before this: the only UPDATE
-- policy was desk-staff-only. This adds a narrow one, scoped to the
-- executives they actually cover. The guard trigger below then limits
-- WHICH column they may change.

drop policy if exists visitors_pa_admit on public.visitors;
create policy visitors_pa_admit on public.visitors
  for update to authenticated
  using (public.is_pa() and public.is_pa_for_executive(executive_id))
  with check (public.is_pa() and public.is_pa_for_executive(executive_id));


-- ---------- extended immutability guard ----------------------------

create or replace function public.guard_visitor_immutability()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_privileged_context() then
    return new;
  end if;

  -- The evidence of the visit. Frozen for everyone but a super admin.
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

  -- Admission: once, forwards only, by the assigned PA or reception.
  if new.admitted_at is distinct from old.admitted_at then
    if old.admitted_at is not null then
      raise exception 'This visitor has already been sent up';
    end if;
    if not (public.is_desk_staff()
            or public.is_pa_for_executive(new.executive_id)) then
      raise exception 'Only the assigned PA can send a visitor up';
    end if;
    -- Server time and server identity. The client does not get a say.
    new.admitted_at := now();
    new.admitted_by := (select auth.uid());
  end if;

  -- Check-out stays a reception action.
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

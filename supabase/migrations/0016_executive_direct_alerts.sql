-- =============================================================
--  Migration 0016 - alert an executive directly when they have no PA
--
--  Run 0015 first.
--
--  Until now an executive was a name in a list, not someone who could
--  sign in. If nobody was assigned to cover them their visitors fell
--  back to the super admins -- which loses nothing, but means the
--  person actually being visited is the last to know.
--
--  An executive can now be linked to a login and be told directly.
--  Routing order for an arrival:
--
--    1. the assigned PA(s), if any
--    2. otherwise the executive themselves, if they have a login
--    3. otherwise the active super admins
--
--  Deliberately not "both": an executive who has a PA has one so that
--  arrivals are filtered for them, and notifying both would undo that.
-- =============================================================

-- ---------- link an executive to a login ---------------------------

alter table public.executives
  add column if not exists user_id uuid references public.profiles(id)
    on delete set null;

-- One login per executive, and one executive per login.
create unique index if not exists executives_user_idx
  on public.executives (user_id) where user_id is not null;


-- ---------- who may act for an executive ---------------------------
-- Replaces is_pa_for_executive at every call site. An executive is a
-- host for themselves, so identity is checked here rather than being
-- paired with a role test at each policy.

create or replace function public.is_host_for_executive(exec_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.executive_assignments a
     where a.executive_id = exec_id
       and a.pa_user_id = (select auth.uid())
  )
  or exists (
    select 1 from public.executives e
     where e.id = exec_id
       and e.user_id = (select auth.uid())
  )
$$;

create or replace function public.is_executive()
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_app_role() = 'executive', false)
$$;

grant execute on function
  public.is_host_for_executive(uuid), public.is_executive()
to authenticated;


-- ---------- routing ------------------------------------------------

create or replace function public.notify_assigned_pa()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  msg        text;
  recipients uuid[];
begin
  msg := format(
    'NEW VISITOR - %s has arrived to see %s. Check-in time: %s.',
    new.full_name,
    coalesce(new.executive_name_snapshot, 'the office'),
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


-- ---------- policies -----------------------------------------------
-- An executive sees the visits that are for them, and may send them
-- up. Nothing else changes: they cannot register a visitor, cannot
-- check anyone out, and cannot see another executive's visitors.

drop policy if exists visitors_read on public.visitors;
create policy visitors_read on public.visitors
  for select to authenticated
  using (
    public.is_desk_staff()
    or public.is_host_for_executive(executive_id)
  );

drop policy if exists visitors_pa_admit on public.visitors;
drop policy if exists visitors_host_admit on public.visitors;
create policy visitors_host_admit on public.visitors
  for update to authenticated
  using (public.is_host_for_executive(executive_id))
  with check (public.is_host_for_executive(executive_id));

-- An executive may see who is assigned to cover them.
drop policy if exists assignments_read on public.executive_assignments;
create policy assignments_read on public.executive_assignments
  for select to authenticated
  using (
    pa_user_id = (select auth.uid())
    or public.is_super_admin()
    or public.is_host_for_executive(executive_id)
  );


-- ---------- guard --------------------------------------------------
-- Same rules as before, with the admission check widened from "the
-- assigned PA" to "whoever hosts this visit".

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
-- Linking or unlinking a login changes who hears about arrivals, so
-- it belongs in the audit trail alongside PA assignment.

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
  else
    if new.is_active is distinct from old.is_active then
      perform public.write_audit(
        case when new.is_active then 'executive.activated'
             else 'executive.deactivated' end,
        'executive', new.id,
        jsonb_build_object('name', new.full_name));
    end if;
    if new.user_id is distinct from old.user_id then
      perform public.write_audit(
        case when new.user_id is null then 'executive.login_unlinked'
             else 'executive.login_linked' end,
        'executive', new.id,
        jsonb_build_object('name', new.full_name));
    end if;
  end if;
  return new;
end $$;

-- =============================================================
--  Migration 0013 - tell reception when a visitor may go up
--
--  Run 0012 first.
--
--  Until now the admission travelled one way: the PA saw the arrival
--  and pressed "Send up", and the reception table quietly changed a
--  status pill. A receptionist looking at the visitor rather than at
--  the screen had no way of knowing the PA had responded, so the
--  visitor kept waiting in front of a desk where somebody already had
--  permission to send them up.
--
--  The alert is created by a trigger for the same reason arrivals are:
--  it happens in the same transaction as the admission, so the two
--  cannot come apart.
-- =============================================================

create or replace function public.notify_desk_on_admission()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  msg        text;
  recipients uuid[];
begin
  -- Only the moment of admission. Not re-admission (impossible), and
  -- not any other update to the row.
  if old.admitted_at is not null or new.admitted_at is null then
    return new;
  end if;

  msg := format(
    '%s may now go up to %s.',
    new.full_name,
    coalesce(new.executive_name_snapshot, 'their host')
  );

  -- The receptionist who registered them: they are the one holding the
  -- conversation with the visitor.
  select array_agg(id) into recipients
    from public.profiles
   where id = new.created_by
     and is_active
     and role in ('receptionist', 'super_admin');

  -- Shift change, or the account was deactivated: tell whoever is on
  -- the desk now rather than nobody.
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

drop trigger if exists visitors_notify_desk_admission on public.visitors;
create trigger visitors_notify_desk_admission
  after update on public.visitors
  for each row execute function public.notify_desk_on_admission();

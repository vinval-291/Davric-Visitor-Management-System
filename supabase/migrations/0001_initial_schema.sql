-- =============================================================
--  Dav-Ric Group Visitor Management System
--  Migration 0001 - initial schema
--
--  Run this in the Supabase dashboard: SQL Editor > New query >
--  paste > Run. It is written to be safe to re-run.
-- =============================================================

-- ---------- enums -------------------------------------------------

do $$ begin
  create type public.app_role as enum ('super_admin', 'receptionist', 'pa');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.visitor_status as enum ('checked_in', 'checked_out');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_type as enum
    ('visitor_arrival', 'visitor_checkout', 'system');
exception when duplicate_object then null; end $$;


-- ---------- departments -------------------------------------------

create table if not exists public.departments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);


-- ---------- profiles ----------------------------------------------
-- Mirrors auth.users. Supabase Auth owns identity; this table owns
-- the application-level facts (role, department, active flag).

create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  full_name      text not null,
  email          text,
  phone          text,
  role           public.app_role not null default 'receptionist',
  department_id  uuid references public.departments(id) on delete set null,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role)
  where is_active;


-- ---------- executives --------------------------------------------

create table if not exists public.executives (
  id             uuid primary key default gen_random_uuid(),
  full_name      text not null,
  position       text,
  department_id  uuid references public.departments(id) on delete set null,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

create index if not exists executives_department_idx
  on public.executives (department_id) where is_active;


-- ---------- executive_assignments ---------------------------------
-- The project document modelled this as a single executives.pa_user_id.
-- Reception reality breaks that: one PA often covers several
-- executives, and cover is needed when a PA is on leave. A join table
-- supports many-to-many while still marking one primary PA.

create table if not exists public.executive_assignments (
  id            uuid primary key default gen_random_uuid(),
  executive_id  uuid not null references public.executives(id) on delete cascade,
  pa_user_id    uuid not null references public.profiles(id)   on delete cascade,
  is_primary    boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (executive_id, pa_user_id)
);

-- At most one primary PA per executive.
create unique index if not exists executive_assignments_one_primary_idx
  on public.executive_assignments (executive_id) where is_primary;

create index if not exists executive_assignments_pa_idx
  on public.executive_assignments (pa_user_id);


-- ---------- visitors ----------------------------------------------
-- Foreign keys give us reporting and filtering. The *_snapshot columns
-- freeze who was visited at the time of the visit, so history stays
-- truthful after an executive changes role or leaves the company.

create table if not exists public.visitors (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  phone         text,
  organization  text,
  purpose       text,

  executive_id   uuid references public.executives(id)  on delete set null,
  department_id  uuid references public.departments(id) on delete set null,

  executive_name_snapshot      text not null,
  executive_position_snapshot  text,
  department_name_snapshot     text,

  -- Storage object path, not the image itself. Keeping base64 in the row
  -- would drag ~50-100 KB through every dashboard query that never needs it.
  signature_path text,

  check_in_time   timestamptz not null default now(),
  check_out_time  timestamptz,

  -- Derived, never stored independently. Two sources of truth for
  -- "is this person still in the building" would eventually disagree,
  -- and this is the field an emergency roll call depends on.
  status public.visitor_status
    generated always as (
      case when check_out_time is null
           then 'checked_in'::public.visitor_status
           else 'checked_out'::public.visitor_status end
    ) stored,

  visit_duration interval
    generated always as (check_out_time - check_in_time) stored,

  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),

  constraint visitors_checkout_after_checkin
    check (check_out_time is null or check_out_time >= check_in_time)
);

-- "Currently inside" is the most-run query in the whole system.
create index if not exists visitors_active_idx
  on public.visitors (check_in_time desc) where check_out_time is null;

create index if not exists visitors_check_in_idx
  on public.visitors (check_in_time desc);
create index if not exists visitors_executive_idx
  on public.visitors (executive_id);
create index if not exists visitors_department_idx
  on public.visitors (department_id);
create index if not exists visitors_name_idx
  on public.visitors (lower(full_name));
create index if not exists visitors_phone_idx
  on public.visitors (phone);


-- ---------- notifications -----------------------------------------

create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  visitor_id    uuid not null references public.visitors(id) on delete cascade,
  recipient_id  uuid not null references public.profiles(id) on delete cascade,
  message       text not null,
  type          public.notification_type not null default 'visitor_arrival',
  is_read       boolean not null default false,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists notifications_inbox_idx
  on public.notifications (recipient_id, is_read, created_at desc);


-- ---------- audit_logs --------------------------------------------
-- Required by section 15 of the project document, which the proposed
-- schema in section 6 omitted.

create table if not exists public.audit_logs (
  id           bigint generated always as identity primary key,
  actor_id     uuid references public.profiles(id) on delete set null,
  action       text not null,
  entity_type  text,
  entity_id    uuid,
  details      jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists audit_logs_created_idx
  on public.audit_logs (created_at desc);
create index if not exists audit_logs_actor_idx
  on public.audit_logs (actor_id, created_at desc);


-- =============================================================
--  Triggers
-- =============================================================

-- ---------- keep profiles.updated_at honest -----------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();


-- ---------- auto-create a profile for every new auth user ---------
-- Role is deliberately NOT read from signup metadata: that would let
-- anyone self-assign super_admin if public signup were ever enabled.
-- Everyone starts as receptionist and an admin promotes them.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(new.email, '@', 1)
    ),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------- freeze the host details onto the visit ----------------

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

  return new;
end $$;

drop trigger if exists visitors_snapshot_host on public.visitors;
create trigger visitors_snapshot_host
  before insert on public.visitors
  for each row execute function public.snapshot_visitor_host();


-- ---------- notify the assigned PA on check-in --------------------
-- This runs in the same transaction as the visitor INSERT. If the
-- receptionist's tab closes or the network drops mid-flow, we can never
-- end up with a checked-in visitor whose PA was never told.

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

  select array_agg(a.pa_user_id)
    into recipients
    from public.executive_assignments a
    join public.profiles p on p.id = a.pa_user_id and p.is_active
   where a.executive_id = new.executive_id;

  -- Fallback: an executive with no PA assigned must never mean the
  -- arrival goes unnoticed. Route it to the active super admins.
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

drop trigger if exists visitors_notify_pa on public.visitors;
create trigger visitors_notify_pa
  after insert on public.visitors
  for each row execute function public.notify_assigned_pa();


-- =============================================================
--  Lock everything down.
--  RLS on with no policies = deny all. Step 4 adds the policies
--  that grant each role exactly what it needs. Enabling this now
--  means the tables are never briefly world-readable.
-- =============================================================

alter table public.departments           enable row level security;
alter table public.profiles              enable row level security;
alter table public.executives            enable row level security;
alter table public.executive_assignments enable row level security;
alter table public.visitors              enable row level security;
alter table public.notifications         enable row level security;
alter table public.audit_logs            enable row level security;

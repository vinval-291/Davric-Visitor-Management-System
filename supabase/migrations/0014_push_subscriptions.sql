-- =============================================================
--  Migration 0014 - Web Push subscriptions
--
--  Why this exists:
--  Every alert so far depends on the page being alive to hold a
--  realtime socket. A phone freezes a backgrounded app within
--  seconds, closing that socket, and a closed app has no socket at
--  all -- so a PA with the phone in their pocket is never told a
--  visitor is waiting. Web Push delivers to the operating system
--  instead, which wakes the service worker even when the app is shut.
--
--  One row per device, not per user: a PA with a phone and a desktop
--  should be reachable on both.
-- =============================================================

create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,

  -- The push service's URL for this device. Unique: re-subscribing
  -- the same browser must update the row, not accumulate duplicates
  -- that would deliver the same alert several times.
  endpoint     text not null unique,
  p256dh       text not null,   -- device public key, for encryption
  auth         text not null,   -- device auth secret
  user_agent   text,            -- so a person can recognise the device
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- A device subscription is personal. Nobody reads anyone else's, and
-- there is deliberately no policy letting an admin read them either:
-- the only thing that needs them is the send function, which runs
-- with the service role and bypasses RLS.
drop policy if exists push_own_select on public.push_subscriptions;
create policy push_own_select on public.push_subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists push_own_insert on public.push_subscriptions;
create policy push_own_insert on public.push_subscriptions
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists push_own_update on public.push_subscriptions;
create policy push_own_update on public.push_subscriptions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists push_own_delete on public.push_subscriptions;
create policy push_own_delete on public.push_subscriptions
  for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.push_subscriptions to authenticated;
revoke all on public.push_subscriptions from anon;

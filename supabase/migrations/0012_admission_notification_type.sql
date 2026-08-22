-- =============================================================
--  Migration 0012 - new notification type
--
--  RUN THIS FILE ON ITS OWN, BEFORE 0013.
--
--  Postgres will not let a new enum value be added and then used
--  inside the same transaction. Keeping the ALTER TYPE in its own
--  migration avoids "unsafe use of new value" when 0013 inserts a
--  notification of this type.
-- =============================================================

alter type public.notification_type add value if not exists 'visitor_admitted';

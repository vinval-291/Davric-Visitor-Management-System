-- =============================================================
--  Migration 0015 - the executive role
--
--  RUN THIS FILE ON ITS OWN, BEFORE 0016.
--
--  Postgres will not let a new enum value be added and then used in
--  the same transaction, and 0016 references 'executive' directly.
-- =============================================================

alter type public.app_role add value if not exists 'executive';

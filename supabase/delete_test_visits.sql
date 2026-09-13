-- =============================================================
--  Utility: remove test visits from history.
--
--  For clearing out test data before the system goes into real use.
--  Run in the Supabase SQL Editor, one part at a time.
--
--  Why this is not a button in the app: a visit record is evidence
--  that someone was on the premises, and the system is built so that
--  nobody can quietly remove one. The SQL Editor runs as the database
--  owner, outside those rules, which is exactly why it is the right
--  place for a deliberate one-off clean-up and the wrong place for
--  routine use.
--
--  What deleting a visit also removes, automatically:
--    * its notifications (they cascade)
--
--  What it does not remove:
--    * the signature image, in Storage -> signatures (see PART 4)
--    * its audit history (see PART 3)
-- =============================================================


-- -------------------------------------------------------------
-- PART 1 -- look first.
-- Run this on its own. Copy the id of every test visit.
-- -------------------------------------------------------------

select v.id,
       to_char(v.check_in_time at time zone 'Africa/Lagos',
               'DD Mon YYYY HH12:MI AM')          as arrived,
       v.full_name,
       v.organization,
       v.executive_name_snapshot                  as visiting,
       case when v.check_out_time is null
            then 'inside' else 'checked out' end  as status,
       v.signature_path
  from public.visitors v
 order by v.check_in_time desc;


-- -------------------------------------------------------------
-- PART 2 -- delete the visits you chose.
--
-- Paste the ids between the brackets, one per line, each in single
-- quotes and separated by commas. Then select just this statement and
-- run it. It prints every row it removed -- check the list.
--
-- There is no undo. If you are unsure about a row, leave it out.
-- -------------------------------------------------------------

delete from public.visitors
 where id in (
   '00000000-0000-0000-0000-000000000000'   -- <-- replace with real ids
 )
returning id, full_name, check_in_time, signature_path;


-- -------------------------------------------------------------
-- ALTERNATIVE to PART 2 -- clear everything before a date.
--
-- Use this instead if every visit before the pilot was a test. Set the
-- date to the morning the pilot starts; nothing on or after it is
-- touched.
-- -------------------------------------------------------------

-- delete from public.visitors
--  where check_in_time < '2026-09-15 00:00:00+01'   -- <-- pilot start
-- returning id, full_name, check_in_time, signature_path;


-- -------------------------------------------------------------
-- PART 3 (optional) -- the audit history for those visits.
--
-- Deleting a visit writes a "visitor.deleted" entry, and the visit's
-- earlier check-in, send-up and check-out entries stay. That is the
-- audit log doing its job, and once the system is in real use it
-- should never be edited.
--
-- Before go-live, though, entries about test visits are noise. This
-- removes audit entries for visits that no longer exist. It only
-- touches visitor entries, and only for deleted visits: user, role
-- and PA-assignment history is left alone.
-- -------------------------------------------------------------

-- delete from public.audit_logs a
--  where a.entity_type = 'visitor'
--    and not exists (select 1 from public.visitors v where v.id = a.entity_id)
-- returning a.action, a.created_at, a.details ->> 'visitor' as visitor;


-- -------------------------------------------------------------
-- PART 4 (optional) -- the signature images.
--
-- The signature_path column from PART 2 names each file. Remove them
-- in the dashboard: Storage -> signatures -> select the files ->
-- Delete. Use the dashboard rather than SQL: deleting a row from
-- storage.objects removes the record of a file without removing the
-- file itself.
--
-- Leaving them is harmless -- the bucket is private and nothing links
-- to them any more -- but they are personal data with no purpose.
-- -------------------------------------------------------------

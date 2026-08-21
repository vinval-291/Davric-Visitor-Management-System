-- =============================================================
--  Migration 0005 - standardise visitor phone numbers
--
--  Nigerian numbers are 11 digits (08012345678). Stored as bare
--  digits with no spaces or punctuation, so that a search by phone
--  matches regardless of how it was typed at the desk.
--
--  The browser formats and normalises as the receptionist types, but
--  the rule is enforced here as well. Client-side validation is a
--  convenience; this is the guarantee.
-- =============================================================

-- Clean up anything already captured under the looser earlier rule.
update public.visitors
   set phone = regexp_replace(phone, '\D', '', 'g')
 where phone is not null
   and phone <> regexp_replace(phone, '\D', '', 'g');

-- Drop numbers that cannot be salvaged, rather than fail the constraint.
update public.visitors
   set phone = null
 where phone is not null
   and phone !~ '^\d{11}$';

alter table public.visitors
  drop constraint if exists visitors_phone_format;

alter table public.visitors
  add constraint visitors_phone_format
  check (phone is null or phone ~ '^\d{11}$');

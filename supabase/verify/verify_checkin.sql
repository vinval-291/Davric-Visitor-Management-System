-- =============================================================
--  Inspect what a check-in actually wrote.
--  Run in the SQL Editor after registering a visitor.
--
--  Confirms four things at once:
--    * the visit row exists with an automatic check_in_time
--    * the trigger froze the host name onto the record (snapshot)
--    * status derived itself as checked_in
--    * a notification was created, and who it went to
-- =============================================================

select v.full_name                    as visitor,
       v.organization,
       v.executive_name_snapshot      as visiting,
       v.department_name_snapshot     as department,
       v.status,
       to_char(v.check_in_time at time zone 'Africa/Lagos',
               'DD Mon HH12:MI AM')   as checked_in,
       v.signature_path,
       creator.full_name              as registered_by,
       recipient.full_name            as notified,
       recipient.role                 as notified_role,
       n.message
  from public.visitors v
  left join public.profiles creator   on creator.id = v.created_by
  left join public.notifications n    on n.visitor_id = v.id
  left join public.profiles recipient on recipient.id = n.recipient_id
 order by v.check_in_time desc
 limit 20;

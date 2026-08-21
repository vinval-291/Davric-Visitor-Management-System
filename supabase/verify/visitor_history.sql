-- =============================================================
--  Full visitor history, including previous days.
--
--  The reception dashboard deliberately shows only today's arrivals
--  plus anyone still inside, so the desk is not scrolling past last
--  month to find the person standing in front of them. Searchable
--  history with date filters and export arrives in Step 12; until
--  then this query answers the same questions.
--
--  Adjust the WHERE clause as needed.
-- =============================================================

select v.full_name                                    as visitor,
       v.organization,
       v.phone,
       v.executive_name_snapshot                      as visiting,
       v.department_name_snapshot                     as department,
       v.status,
       to_char(v.check_in_time  at time zone 'Africa/Lagos',
               'DD Mon YYYY HH12:MI AM')               as arrived,
       to_char(v.admitted_at    at time zone 'Africa/Lagos',
               'HH12:MI AM')                           as sent_up,
       to_char(v.check_out_time at time zone 'Africa/Lagos',
               'DD Mon HH12:MI AM')                    as departed,
       v.wait_duration                                as waited,
       v.visit_duration                               as stayed,
       case when v.check_out_time is null
                 and v.check_in_time < date_trunc('day', now())
            then 'NEVER CHECKED OUT'
       end                                            as flag
  from public.visitors v
 where v.check_in_time >= now() - interval '30 days'   -- <-- date range
 order by v.check_in_time desc;


-- Anyone still recorded as on the premises from a previous day.
-- These are almost always forgotten check-outs. Left alone they
-- inflate the "currently inside" count and make an emergency roll
-- call meaningless.
select v.id,
       v.full_name,
       v.executive_name_snapshot as visiting,
       to_char(v.check_in_time at time zone 'Africa/Lagos',
               'DD Mon YYYY HH12:MI AM') as arrived_on
  from public.visitors v
 where v.check_out_time is null
   and v.check_in_time < date_trunc('day', now())
 order by v.check_in_time;

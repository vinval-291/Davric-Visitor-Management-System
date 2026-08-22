-- =============================================================
--  Migration 0009 - report summary function
--
--  Counting and averaging in the browser would mean downloading every
--  matching visit just to add it up. This does the arithmetic where
--  the data already is and returns five numbers.
--
--  NOTE: security INVOKER, not DEFINER -- deliberately. The function
--  runs as the caller, so the visitors RLS policy still applies and a
--  PA's totals cover only the executives they are assigned to. A
--  DEFINER function here would quietly leak company-wide figures to
--  anyone who could call it.
--
--  Durations come back as seconds rather than intervals: PostgREST
--  renders intervals as strings that need parsing, and seconds are
--  unambiguous.
-- =============================================================

create or replace function public.visitor_report(
  from_ts timestamptz default null,
  to_ts   timestamptz default null,
  exec_id uuid        default null,
  dept_id uuid        default null
)
returns table (
  total            bigint,
  inside           bigint,
  checked_out      bigint,
  avg_wait_seconds numeric,
  avg_stay_seconds numeric
)
language sql stable as $$
  select count(*)                                             as total,
         count(*) filter (where v.check_out_time is null)      as inside,
         count(*) filter (where v.check_out_time is not null)  as checked_out,
         round(extract(epoch from avg(v.wait_duration))::numeric, 0),
         round(extract(epoch from avg(v.visit_duration))::numeric, 0)
    from public.visitors v
   where (from_ts is null or v.check_in_time >= from_ts)
     and (to_ts   is null or v.check_in_time <  to_ts)
     and (exec_id is null or v.executive_id  = exec_id)
     and (dept_id is null or v.department_id = dept_id)
$$;

grant execute on function
  public.visitor_report(timestamptz, timestamptz, uuid, uuid)
to authenticated;

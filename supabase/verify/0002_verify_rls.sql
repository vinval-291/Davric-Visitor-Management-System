-- =============================================================
--  Verification for migration 0002.
--  Run in the Supabase SQL Editor after 0002 and read the report.
--
--  Expected: every table "RLS on", every helper "SECURITY DEFINER",
--  and notifications + visitors both "published" for realtime.
--
--  Expected policy counts:
--    audit_logs 2 | departments 2 | executive_assignments 2
--    executives 2 | notifications 3 | profiles 3 | visitors 4
-- =============================================================

with t as (
  select c.relname, c.relrowsecurity, count(p.polname)::int as policies
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_policy p on p.polrelid = c.oid
   where n.nspname = 'public'
     and c.relkind = 'r'
     and c.relname in ('departments','profiles','executives',
                       'executive_assignments','visitors',
                       'notifications','audit_logs')
   group by 1, 2
),
f as (
  select p.proname, p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('current_app_role','is_super_admin','is_receptionist',
                       'is_pa','is_desk_staff','is_pa_for_executive')
),
r as (
  select c.relname
    from pg_publication_rel pr
    join pg_class c        on c.oid = pr.prrelid
    join pg_publication pub on pub.oid = pr.prpubid
   where pub.pubname = 'supabase_realtime'
)
select 'table' as kind, relname as name,
       (case when relrowsecurity then 'RLS on' else '*** RLS OFF ***' end)
       || ', ' || policies || ' policies' as status
  from t
union all
select 'function', proname,
       case when prosecdef then 'SECURITY DEFINER' else '*** NOT DEFINER ***' end
  from f
union all
select 'realtime', relname, 'published' from r
 order by kind, name;

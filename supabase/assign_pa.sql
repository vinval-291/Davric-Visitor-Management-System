-- =============================================================
--  Utility: assign PAs to executives.
--
--  This is the mapping the whole notification system turns on. If it
--  is wrong, visitors arrive and nobody is told -- which is worse
--  than the paper logbook it replaces.
--
--  A PA may cover several executives. An executive may have more than
--  one PA (a primary and a stand-in for leave cover). At most one
--  can be marked primary, enforced by a unique index.
--
--  After Step 11 this is done through the admin screen. Until then,
--  edit the list and run it here.
--
--  Executives with NO assignment are not broken: their alerts route
--  to the active super admins instead, so nothing is ever lost.
-- =============================================================

insert into public.executive_assignments (executive_id, pa_user_id, is_primary)
select e.id, p.id, v.is_primary
  from (values
        -- executive full_name          , PA account email  , primary?
          ('Managing Director'           , 'pa@test.local'   , true),
          ('Head of Human Resources'     , 'pa@test.local'   , true)
       ) as v(executive_name, pa_email, is_primary)
  join public.executives e on e.full_name = v.executive_name
  join auth.users u        on lower(u.email) = lower(v.pa_email)
  join public.profiles p   on p.id = u.id
on conflict (executive_id, pa_user_id)
  do update set is_primary = excluded.is_primary;


-- Who gets told when a visitor arrives for each executive?
select e.full_name                                   as executive,
       d.name                                        as department,
       coalesce(
         string_agg(p.full_name || case when a.is_primary
                                        then ' (primary)' else '' end,
                    ', ' order by a.is_primary desc, p.full_name),
         '>> no PA - falls back to super admins'
       )                                             as notifies
  from public.executives e
  left join public.departments d           on d.id = e.department_id
  left join public.executive_assignments a on a.executive_id = e.id
  left join public.profiles p              on p.id = a.pa_user_id
 where e.is_active
 group by e.full_name, d.name
 order by e.full_name;

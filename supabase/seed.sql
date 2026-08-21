-- =============================================================
--  Placeholder org data for development.
--
--  PLACEHOLDER NAMES - replace with the real Dav-Ric Group
--  departments and executives once section 12 of the project
--  document has been answered by the company.
--
--  Safe to re-run: existing rows are left alone.
--  PA assignments are NOT seeded here because they need real user
--  accounts to exist first. We do those in Step 5.
-- =============================================================

insert into public.departments (name) values
  ('Executive Office'),
  ('Finance'),
  ('Human Resources'),
  ('Operations'),
  ('Projects'),
  ('Legal')
on conflict (name) do nothing;


insert into public.executives (full_name, position, department_id)
select v.full_name, v.position, d.id
from (values
  ('Managing Director',        'Managing Director',        'Executive Office'),
  ('Executive Director',       'Executive Director',       'Executive Office'),
  ('Chief Finance Officer',    'Chief Finance Officer',    'Finance'),
  ('Head of Human Resources',  'Head of Human Resources',  'Human Resources'),
  ('Head of Operations',       'Head of Operations',       'Operations'),
  ('Head of Projects',         'Head of Projects',         'Projects')
) as v(full_name, position, dept_name)
join public.departments d on d.name = v.dept_name
where not exists (
  select 1 from public.executives e where e.full_name = v.full_name
);

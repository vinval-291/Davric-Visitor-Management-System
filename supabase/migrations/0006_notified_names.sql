-- =============================================================
--  Migration 0006 - tell the receptionist who was notified
--
--  After checking a visitor in, the receptionist needs to be able to
--  say "I have let Mrs Adeyemi know, she will come down for you".
--  Without that they are guessing, and the visitor is left waiting
--  with no idea whether anyone knows they arrived.
--
--  They cannot read it directly: profiles is own-row-only for a
--  receptionist and executive_assignments is admin/PA only. Rather
--  than widen either table -- which would expose far more than one
--  name -- this function returns exactly the fact needed and nothing
--  else.
-- =============================================================

create or replace function public.visit_notified_names(visit_id uuid)
returns text[]
language sql stable security definer set search_path = '' as $$
  select array_agg(p.full_name order by p.full_name)
    from public.notifications n
    join public.profiles p on p.id = n.recipient_id
   where n.visitor_id = visit_id
     and public.is_desk_staff()   -- no other role gets an answer
$$;

grant execute on function public.visit_notified_names(uuid) to authenticated;

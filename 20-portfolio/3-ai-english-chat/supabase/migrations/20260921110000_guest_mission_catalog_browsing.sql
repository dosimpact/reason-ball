begin;

-- Browsing only: assignment/start guards and private instructions stay unchanged.
create or replace function public.can_view_mission(_mission_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select public.is_admin() or exists(
    select 1 from public.missions m where m.id=_mission_id and (
      -- Auth's authoritative flag also handles a guest converted to a member
      -- with an older anonymous JWT. User-editable metadata is not trusted.
      (m.status='published' and m.visibility='public' and (
        (select auth.uid()) is null
        or exists(select 1 from auth.users u where u.id=(select auth.uid()) and u.is_anonymous)
      )) or m.owner_id=(select auth.uid()) or (
        exists(select 1 from public.mission_catalog_managers where user_id=(select auth.uid()))
        and (exists(select 1 from public.mission_catalog_entries where mission_id=m.id)
          or (m.status='published' and m.visibility='public'))
      ) or (m.status='published' and exists(
        select 1 from public.mission_assignments a where a.user_id=(select auth.uid()) and a.mission_id=m.id
      ))
    )
  );
$$;


commit;

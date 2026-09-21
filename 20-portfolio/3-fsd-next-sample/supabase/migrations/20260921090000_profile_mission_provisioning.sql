begin;

-- Initial profile-based assignments. Existing learning history is not rewritten.
create table public.mission_catalog_entries (
  mission_id uuid primary key references public.missions(id) on delete cascade,
  authoring_key text not null unique check (length(btrim(authoring_key)) between 1 and 300)
);
create table public.mission_catalog_managers (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table public.mission_catalog_state (
  singleton boolean primary key default true check (singleton),
  is_ready boolean not null default false
);
insert into public.mission_catalog_state(singleton,is_ready) values(true,false);
create table public.mission_assignments (
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  profile_snapshot jsonb not null default '{}'::jsonb,
  primary key(user_id,mission_id)
);
create index mission_assignments_mission_idx on public.mission_assignments(mission_id);
alter table public.mission_catalog_entries enable row level security;
alter table public.mission_catalog_managers enable row level security;
alter table public.mission_catalog_state enable row level security;
alter table public.mission_assignments enable row level security;
revoke all on public.mission_catalog_entries,public.mission_catalog_managers,public.mission_catalog_state,public.mission_assignments from public,anon,authenticated;
grant all on public.mission_catalog_entries,public.mission_catalog_managers,public.mission_catalog_state,public.mission_assignments to service_role;
grant select on public.mission_catalog_managers,public.mission_assignments to authenticated;
create policy mission_catalog_managers_self on public.mission_catalog_managers for select to authenticated using(user_id=(select auth.uid()));
create policy mission_assignments_self on public.mission_assignments for select to authenticated using(user_id=(select auth.uid()));

create or replace function public.can_view_mission(_mission_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select public.is_admin() or exists(
    select 1 from public.missions m where m.id=_mission_id and (
      m.owner_id=(select auth.uid()) or (
        exists(select 1 from public.mission_catalog_managers where user_id=(select auth.uid()))
        and (exists(select 1 from public.mission_catalog_entries where mission_id=m.id)
          or (m.status='published' and m.visibility='public'))
      ) or (m.status='published' and exists(
        select 1 from public.mission_assignments a where a.user_id=(select auth.uid()) and a.mission_id=m.id
      ))
    )
  );
$$;

create function public.provision_my_missions()
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  learner uuid := auth.uid();
  preferences jsonb;
  assigned integer;
  level_index integer;
begin
  if learner is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('mission-provision:'||learner::text,0));
  if exists(select 1 from public.mission_catalog_managers where user_id=learner) then
    return jsonb_build_object('mode','manager','assignedCount',0);
  end if;
  select count(*) into assigned from public.mission_assignments where user_id=learner;
  if assigned>0 then return jsonb_build_object('mode','assigned','assignedCount',assigned); end if;
  select settings into preferences from public.learner_preferences where user_id=learner;
  if not found then return jsonb_build_object('mode','needs-profile','assignedCount',0); end if;
  if not exists(select 1 from public.mission_catalog_state where singleton and is_ready) then
    return jsonb_build_object('mode','catalog-empty','assignedCount',0);
  end if;
  level_index := array_position(array['PRE_A1','A1','A2','B1','B2','C1','C2'],preferences->>'learnerLevel');
  if level_index is null then raise exception 'Invalid learner level' using errcode='22023'; end if;
  with candidates as (
    select m.id,m.category_id,e.authoring_key,
      level_index-array_position(array['pre-A1','A1','A2','B1','B2','C1','C2'],m.difficulty) as distance,
      case when (c.parent_id='travel' and preferences->'interests' ? '여행')
        or (c.parent_id='daily' and preferences->'interests' ? '일상')
        or (c.parent_id='work' and (preferences->'interests' ? '직장' or preferences->'interests' ? '학업'))
        or (c.parent_id='social' and preferences->'interests' ? '문화') then 0 else 1 end as interest_rank
    from public.mission_catalog_entries e
    join public.missions m on m.id=e.mission_id
    join public.mission_versions v on v.id=m.current_version_id and v.mission_id=m.id
    join public.mission_categories c on c.id=m.category_id
    where m.status='published' and m.visibility='public' and v.published_at is not null
      and array_position(array['pre-A1','A1','A2','B1','B2','C1','C2'],m.difficulty)<=level_index
  ), ranked as (
    select *,row_number() over(partition by distance,category_id order by interest_rank,authoring_key,id) as subcategory_rank
    from candidates
  )
  insert into public.mission_assignments(user_id,mission_id,profile_snapshot)
    select learner,id,jsonb_build_object('learnerLevel',preferences->'learnerLevel','interests',preferences->'interests') from ranked
    order by distance,subcategory_rank,interest_rank,authoring_key,id limit 5;
  get diagnostics assigned=row_count;
  return jsonb_build_object('mode',case when assigned=0 then 'catalog-empty' else 'assigned' end,'assignedCount',assigned);
end;
$$;
revoke all on function public.provision_my_missions() from public,anon;
grant execute on function public.provision_my_missions() to authenticated;

create function public.guard_mission_assignment()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' then
    if new.owner_id is not distinct from old.owner_id
      and new.mission_id is not distinct from old.mission_id
      and new.mission_version_id is not distinct from old.mission_version_id then return new; end if;
  end if;
  if new.mission_id is null then return new; end if;
  if exists(select 1 from public.missions where id=new.mission_id and owner_id=new.owner_id)
    or exists(select 1 from public.mission_catalog_managers managers
      join public.missions m on m.id=new.mission_id
      where managers.user_id=new.owner_id and (
        exists(select 1 from public.mission_catalog_entries where mission_id=m.id)
        or (m.status='published' and m.visibility='public')
      ))
    or exists(select 1 from auth.users where id=new.owner_id and raw_app_meta_data->>'role'='admin')
    or exists(select 1 from public.mission_assignments where user_id=new.owner_id and mission_id=new.mission_id)
    then return new; end if;
  raise exception 'Mission assignment required' using errcode='42501';
end;
$$;
revoke all on function public.guard_mission_assignment() from public,anon,authenticated;
create trigger conversations_mission_assignment before insert or update of owner_id,mission_id,mission_version_id on public.conversations for each row execute function public.guard_mission_assignment();
create trigger mission_runs_assignment before insert or update of owner_id,mission_id,mission_version_id on public.mission_runs for each row execute function public.guard_mission_assignment();

commit;

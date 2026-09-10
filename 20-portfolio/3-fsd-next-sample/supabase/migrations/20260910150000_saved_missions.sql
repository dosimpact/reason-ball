begin;

create table public.mission_favorite_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  mission_id uuid not null,
  saved boolean not null,
  primary key(user_id,request_id)
);
alter table public.mission_favorite_requests enable row level security;
revoke all on public.mission_favorite_requests from public,anon,authenticated;
grant all on public.mission_favorite_requests to service_role;

create function public.set_saved_mission(_request_id uuid, _mission_id uuid, _saved boolean)
returns table(mission_id uuid, saved boolean)
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid(); previous public.mission_favorite_requests%rowtype;
begin
  if owner_id is null then raise exception using errcode='42501', message='authenticated user required'; end if;
  if _request_id is null or _mission_id is null or _saved is null then raise exception using errcode='22023', message='invalid bookmark request'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('saved-missions:' || owner_id::text, 0));
  select * into previous from public.mission_favorite_requests r where r.user_id=owner_id and r.request_id=_request_id;
  if found then
    if previous.mission_id <> _mission_id or previous.saved <> _saved then raise exception using errcode='40001', message='bookmark request changed'; end if;
    return query select previous.mission_id, previous.saved;
    return;
  end if;
  if _saved then
    perform 1 from public.missions m where m.id=_mission_id and m.status<>'archived' and public.can_view_mission(m.id) for share;
    if not found then raise exception using errcode='P0002', message='visible mission required'; end if;
    insert into public.mission_favorites(user_id,mission_id) values(owner_id,_mission_id) on conflict do nothing;
  else
    -- A previously saved but now hidden mission can still be removed by owner.
    delete from public.mission_favorites f where f.user_id=owner_id and f.mission_id=_mission_id;
  end if;
  insert into public.mission_favorite_requests(user_id,request_id,mission_id,saved) values(owner_id,_request_id,_mission_id,_saved);
  return query select _mission_id,_saved;
end;
$$;
revoke execute on function public.set_saved_mission(uuid,uuid,boolean) from public,anon;
grant execute on function public.set_saved_mission(uuid,uuid,boolean) to authenticated;

commit;

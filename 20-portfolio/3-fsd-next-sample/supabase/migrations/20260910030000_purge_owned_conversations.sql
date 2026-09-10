begin;

create table public.conversation_purge_requests (
  owner_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  deleted_count integer not null,
  primary key (owner_id, request_id)
);
alter table public.conversation_purge_requests enable row level security;
revoke all on public.conversation_purge_requests from public, anon, authenticated;

create function public.purge_owned_conversations(_expected_owner_id uuid, _request_id uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  target uuid;
  deleted_count integer := 0;
  previous_count integer;
begin
  if _request_id is null then
    raise exception using errcode = '23514', message = 'request id is required';
  end if;
  -- Serialize purge retries for this owner; never trust a browser-supplied owner.
  perform 1 from auth.users where id = _expected_owner_id for update;
  if not found then
    raise exception using errcode = '42501', message = 'owner not found';
  end if;
  select r.deleted_count into previous_count from public.conversation_purge_requests r
    where r.owner_id = _expected_owner_id and r.request_id = _request_id;
  if found then return previous_count; end if;

  -- A single ordered cursor fixes the targets and uses the same conversation
  -- locks as generation/revision commits. Any failure rolls back the whole purge.
  for target in select c.id from public.conversations c
    where c.owner_id = _expected_owner_id order by c.id for update
  loop
    update public.conversations set status = 'deleted', visibility = 'private' where id = target;
    perform public.purge_deleted_conversation(target, _expected_owner_id);
    deleted_count := deleted_count + 1;
  end loop;
  insert into public.conversation_purge_requests values (_expected_owner_id, _request_id, deleted_count);
  return deleted_count;
end;
$$;
revoke execute on function public.purge_owned_conversations(uuid, uuid) from public, anon, authenticated;
grant execute on function public.purge_owned_conversations(uuid, uuid) to service_role;

commit;

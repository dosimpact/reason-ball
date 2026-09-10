begin;

create table public.conversation_clear_requests (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  request_id uuid not null,
  deleted_count integer not null,
  primary key (conversation_id, request_id)
);
alter table public.conversation_clear_requests enable row level security;
revoke all on public.conversation_clear_requests from public, anon, authenticated;

create function public.clear_conversation_messages(_conversation_id uuid, _owner_id uuid, _request_id uuid)
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  owned public.conversations%rowtype;
  removed integer;
  previous_purge text := current_setting('app.immutable_purge', true);
begin
  if _request_id is null then
    raise exception using errcode = '23514', message = 'request id is required';
  end if;
  select * into owned from public.conversations where id = _conversation_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'conversation not found'; end if;
  if owned.owner_id is distinct from _owner_id then
    raise exception using errcode = '42501', message = 'conversation owner mismatch';
  end if;
  if owned.status <> 'active' then
    raise exception using errcode = '55000', message = 'conversation is not active';
  end if;
  select deleted_count into removed from public.conversation_clear_requests
    where conversation_id = _conversation_id and request_id = _request_id;
  if found then return removed; end if;
  if exists (select 1 from public.chat_generations where conversation_id = _conversation_id
    and status = 'running' and lease_expires_at > clock_timestamp()) then
    raise exception using errcode = '55000', message = 'conversation generation is running';
  end if;

  -- Deleting messages detaches published Artifact source_message_id via its FK.
  -- Only this server-owned transaction may detach those references; version
  -- content, Storage references and mission result snapshots stay unchanged.
  perform set_config('app.immutable_purge', 'enabled', true);
  delete from public.messages where conversation_id = _conversation_id;
  get diagnostics removed = row_count;
  perform set_config('app.immutable_purge', coalesce(previous_purge, ''), true);
  update public.conversations set last_message_at = null where id = _conversation_id;
  insert into public.conversation_clear_requests values (_conversation_id, _request_id, removed);
  return removed;
end;
$$;
revoke execute on function public.clear_conversation_messages(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.clear_conversation_messages(uuid, uuid, uuid) to service_role;

commit;

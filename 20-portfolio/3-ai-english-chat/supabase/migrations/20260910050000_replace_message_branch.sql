begin;

create table public.message_branch_requests (
  request_id uuid primary key references public.messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  source_message_id uuid not null,
  expected_tail_id uuid not null,
  parts jsonb not null
);
alter table public.message_branch_requests enable row level security;
revoke all on public.message_branch_requests from public, anon, authenticated;

create function public.replace_message_branch(
  _conversation_id uuid, _owner_id uuid, _source_id uuid,
  _expected_tail_id uuid, _request_id uuid, _parts jsonb
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  owned public.conversations%rowtype;
  source public.messages%rowtype;
  receipt public.message_branch_requests%rowtype;
  tail_id uuid;
  previous_purge text := current_setting('app.immutable_purge', true);
begin
  if _source_id is null or _expected_tail_id is null or _request_id is null
    or _parts is null or jsonb_typeof(_parts) <> 'array' or jsonb_array_length(_parts) not between 1 and 20 then
    raise exception using errcode = '22023', message = 'invalid branch input';
  end if;
  select * into owned from public.conversations where id = _conversation_id for update;
  if not found or owned.owner_id is distinct from _owner_id then
    raise exception using errcode = '42501', message = 'conversation owner mismatch';
  end if;
  if owned.status <> 'active' then raise exception using errcode = '55000', message = 'conversation not active'; end if;
  select * into receipt from public.message_branch_requests where request_id = _request_id;
  if found then
    if receipt.conversation_id <> _conversation_id or receipt.source_message_id <> _source_id
      or receipt.expected_tail_id <> _expected_tail_id or receipt.parts is distinct from _parts then
      raise exception using errcode = '40001', message = 'branch key reused with different input';
    end if;
    return _request_id;
  end if;
  if exists (select 1 from public.chat_generations where conversation_id = _conversation_id
    and status = 'running' and lease_expires_at > clock_timestamp()) then
    raise exception using errcode = '40001', message = 'a generation is running';
  end if;
  select id into tail_id from public.messages where conversation_id = _conversation_id
    order by sequence_number desc limit 1;
  if tail_id is distinct from _expected_tail_id then
    raise exception using errcode = '40001', message = 'conversation changed since editing began';
  end if;
  select * into source from public.messages where id = _source_id
    and conversation_id = _conversation_id and author_id = _owner_id and role = 'user';
  if not found then raise exception using errcode = 'P0002', message = 'editable message not found'; end if;

  -- Keep earlier messages and Artifact content. Detach only references to the
  -- discarded branch under the same narrowly scoped exception as /clear.
  perform set_config('app.immutable_purge', 'enabled', true);
  delete from public.messages where conversation_id = _conversation_id
    and sequence_number >= source.sequence_number;
  perform set_config('app.immutable_purge', coalesce(previous_purge, ''), true);
  insert into public.messages(id, conversation_id, author_id, role, status, parts,
    plain_text, parent_message_id, client_message_id)
  values (_request_id, _conversation_id, _owner_id, 'user', 'complete', _parts,
    coalesce((select string_agg(p.part ->> 'text', E'\n' order by p.ordinal)
      from jsonb_array_elements(_parts) with ordinality as p(part, ordinal)
      where p.part ->> 'type' = 'text'), ''), source.parent_message_id, _request_id::text);
  insert into public.message_branch_requests values (_request_id, _conversation_id, _source_id, _expected_tail_id, _parts);
  return _request_id;
end;
$$;
revoke execute on function public.replace_message_branch(uuid,uuid,uuid,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.replace_message_branch(uuid,uuid,uuid,uuid,uuid,jsonb) to service_role;

commit;

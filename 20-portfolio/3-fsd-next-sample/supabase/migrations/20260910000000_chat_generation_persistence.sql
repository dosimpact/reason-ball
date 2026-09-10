begin;

-- Only the server may claim generation work or write an assistant response.
create table public.chat_generations (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_message_id uuid primary key references public.messages(id) on delete cascade,
  assistant_message_id uuid not null unique references public.messages(id) on delete cascade,
  request_id uuid not null,
  lease_expires_at timestamptz not null,
  status text not null check (status in ('running', 'complete', 'error', 'cancelled'))
);
alter table public.chat_generations enable row level security;
revoke all on public.chat_generations from public, anon, authenticated;
grant all on public.chat_generations to service_role;

create or replace function public.begin_chat_generation(
  _conversation_id uuid, _owner_id uuid, _client_message_id text,
  _parts jsonb, _request_id uuid, _model_id text
)
returns table(user_message_id uuid, assistant_message_id uuid, replayed boolean, user_sequence_number bigint)
language plpgsql security definer set search_path = ''
as $$
declare
  owned public.conversations%rowtype;
  user_row public.messages%rowtype;
  generation public.chat_generations%rowtype;
  response_id uuid;
begin
  if _request_id is null or _owner_id is null
    or char_length(coalesce(_client_message_id, '')) not between 1 and 200
    or char_length(coalesce(_model_id, '')) not between 1 and 200
    or _parts is null or jsonb_typeof(_parts) <> 'array'
    or jsonb_array_length(_parts) not between 1 and 20 then
    raise exception using errcode = '22023', message = 'invalid chat generation input';
  end if;

  select * into owned from public.conversations c where c.id = _conversation_id for update;
  if not found or owned.owner_id is distinct from _owner_id or owned.status <> 'active' then
    raise exception using errcode = '42501', message = 'active conversation owner mismatch';
  end if;

  select * into user_row from public.messages m
    where m.conversation_id = _conversation_id and m.client_message_id = _client_message_id;
  if found then
    if user_row.role <> 'user' or user_row.author_id is distinct from _owner_id
      or user_row.parts is distinct from _parts then
      raise exception using errcode = '40001', message = 'message key reused with different content';
    end if;
    select * into generation from public.chat_generations g where g.user_message_id = user_row.id;
    if found and generation.status = 'complete' then
      return query select user_row.id, generation.assistant_message_id, true, user_row.sequence_number;
      return;
    end if;
    if exists (select 1 from public.messages m where m.conversation_id = _conversation_id
      and m.role = 'user' and m.sequence_number > user_row.sequence_number) then
      raise exception using errcode = '40001', message = 'only the latest user turn can be retried';
    end if;
  end if;

  if exists (select 1 from public.chat_generations g where g.conversation_id = _conversation_id
    and g.status = 'running' and g.lease_expires_at > clock_timestamp()) then
    raise exception using errcode = '40001', message = 'a chat generation is already running';
  end if;
  -- A crashed worker must not strand the conversation forever. Late writes are
  -- fenced by request_id below, even after the same turn is reclaimed.
  update public.messages m set status = 'error', error_code = 'GENERATION_EXPIRED'
    from public.chat_generations g where g.conversation_id = _conversation_id
      and g.status = 'running' and g.assistant_message_id = m.id;
  update public.chat_generations g set status = 'error'
    where g.conversation_id = _conversation_id and g.status = 'running';

  if user_row.id is null then
    insert into public.messages(conversation_id, author_id, role, parts, plain_text, client_message_id)
    values (_conversation_id, _owner_id, 'user', _parts,
      coalesce((select string_agg(part ->> 'text', E'\n' order by ordinal)
        from jsonb_array_elements(_parts) with ordinality as p(part, ordinal)
        where part ->> 'type' = 'text'), ''), _client_message_id)
    returning * into user_row;
  end if;

  response_id := generation.assistant_message_id;
  if response_id is null then
    insert into public.messages(conversation_id, role, status, parent_message_id, model_id)
    values (_conversation_id, 'assistant', 'pending', user_row.id, _model_id)
    returning id into response_id;
  else
    update public.messages set status = 'pending', parts = '[]', plain_text = '',
      error_code = null, error_message = null, finish_reason = null, model_id = _model_id
      where id = response_id;
  end if;

  insert into public.chat_generations as g
    (conversation_id, user_message_id, assistant_message_id, request_id, lease_expires_at, status)
  values (_conversation_id, user_row.id, response_id, _request_id, clock_timestamp() + interval '90 seconds', 'running')
  on conflict on constraint chat_generations_pkey do update
    set request_id = excluded.request_id, lease_expires_at = excluded.lease_expires_at, status = 'running';
  return query select user_row.id, response_id, false, user_row.sequence_number;
end;
$$;

create or replace function public.finish_chat_generation(
  _conversation_id uuid, _owner_id uuid, _assistant_message_id uuid,
  _request_id uuid, _status text, _parts jsonb, _finish_reason text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  owned public.conversations%rowtype;
  generation public.chat_generations%rowtype;
begin
  if _status is null or _status not in ('complete', 'error', 'cancelled')
    or _parts is null or jsonb_typeof(_parts) <> 'array' then
    raise exception using errcode = '22023', message = 'invalid generation completion';
  end if;
  select * into owned from public.conversations c where c.id = _conversation_id for update;
  if not found or owned.owner_id is distinct from _owner_id or owned.status <> 'active' then
    raise exception using errcode = '42501', message = 'active conversation owner mismatch';
  end if;
  select * into generation from public.chat_generations g
    where g.conversation_id = _conversation_id and g.assistant_message_id = _assistant_message_id;
  if not found or generation.request_id is distinct from _request_id then
    raise exception using errcode = '40001', message = 'stale generation completion';
  end if;
  if generation.status <> 'running' then
    if generation.status = _status and exists (select 1 from public.messages m
      where m.id = _assistant_message_id and m.parts = _parts) then return _assistant_message_id; end if;
    raise exception using errcode = '40001', message = 'generation already finalized';
  end if;
  update public.messages set parts = _parts,
    plain_text = coalesce((select string_agg(part ->> 'text', E'\n' order by ordinal)
      from jsonb_array_elements(_parts) with ordinality as p(part, ordinal)
      where part ->> 'type' = 'text'), ''),
    status = _status, finish_reason = _finish_reason,
    error_code = case when _status = 'error' then 'GENERATION_FAILED' else null end
    where id = _assistant_message_id;
  update public.chat_generations set status = _status where user_message_id = generation.user_message_id;
  return _assistant_message_id;
end;
$$;

revoke execute on function public.begin_chat_generation(uuid, uuid, text, jsonb, uuid, text) from public, anon, authenticated;
revoke execute on function public.finish_chat_generation(uuid, uuid, uuid, uuid, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.begin_chat_generation(uuid, uuid, text, jsonb, uuid, text) to service_role;
grant execute on function public.finish_chat_generation(uuid, uuid, uuid, uuid, text, jsonb, text) to service_role;

commit;

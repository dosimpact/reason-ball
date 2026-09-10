begin;

-- The current approval stage is a durable retry checkpoint, not client history.
alter table public.chat_generations
  add column continuation_parts jsonb,
  add column continuation_decisions jsonb;

create function public.begin_chat_tool_continuation(
  _conversation_id uuid, _owner_id uuid, _assistant_id uuid,
  _request_id uuid, _model_id text, _decisions jsonb
)
returns table(user_message_id uuid, assistant_message_id uuid, replayed boolean,
  user_sequence_number bigint, continuation_parts jsonb)
language plpgsql security definer set search_path = ''
as $$
declare
  owned public.conversations%rowtype;
  answer public.messages%rowtype;
  learner public.messages%rowtype;
  generation public.chat_generations%rowtype;
  decision jsonb;
  part jsonb;
  merged jsonb;
  canonical jsonb;
  part_index integer;
  matching integer;
  new_decisions integer := 0;
begin
  if _owner_id is null or _assistant_id is null or _request_id is null
    or char_length(coalesce(_model_id, '')) not between 1 and 200
    or _decisions is null or jsonb_typeof(_decisions) <> 'array' then
    raise exception using errcode = '22023', message = 'invalid approval continuation';
  end if;
  if jsonb_array_length(_decisions) not between 1 and 20 then
    raise exception using errcode = '22023', message = 'invalid approval count';
  end if;
  for decision in select value from jsonb_array_elements(_decisions) loop
    if jsonb_typeof(decision) <> 'object'
      or jsonb_typeof(decision->'approvalId') is distinct from 'string'
      or jsonb_typeof(decision->'toolCallId') is distinct from 'string'
      or char_length(decision->>'approvalId') not between 1 and 200
      or char_length(decision->>'toolCallId') not between 1 and 200
      or jsonb_typeof(decision->'approved') is distinct from 'boolean'
      or (decision ? 'reason' and (jsonb_typeof(decision->'reason') <> 'string' or char_length(decision->>'reason') > 500))
      or (decision - array['approvalId', 'toolCallId', 'approved', 'reason']) <> '{}'::jsonb then
      raise exception using errcode = '22023', message = 'invalid approval decision';
    end if;
  end loop;
  if (select count(distinct value->>'approvalId') from jsonb_array_elements(_decisions)) <> jsonb_array_length(_decisions)
    or (select count(distinct value->>'toolCallId') from jsonb_array_elements(_decisions)) <> jsonb_array_length(_decisions) then
    raise exception using errcode = '22023', message = 'duplicate approval decision';
  end if;
  select jsonb_agg(value order by value->>'approvalId') into canonical from jsonb_array_elements(_decisions);
  select * into owned from public.conversations where id = _conversation_id for update;
  if not found or owned.owner_id is distinct from _owner_id or owned.status <> 'active' then
    raise exception using errcode = '42501', message = 'active conversation owner mismatch';
  end if;
  select * into answer from public.messages where conversation_id = _conversation_id
    order by sequence_number desc limit 1;
  if answer.id is distinct from _assistant_id or answer.role <> 'assistant' or answer.model_id is distinct from _model_id then
    raise exception using errcode = '40001', message = 'approval turn or model changed';
  end if;
  select * into generation from public.chat_generations g
    where g.conversation_id = _conversation_id and g.assistant_message_id = _assistant_id;
  if not found then raise exception using errcode = '40001', message = 'approval generation missing'; end if;
  select * into learner from public.messages where id = generation.user_message_id;
  if learner.author_id is distinct from _owner_id or learner.role <> 'user' then
    raise exception using errcode = '42501', message = 'approval author mismatch';
  end if;
  if exists (select 1 from public.chat_generations g where g.conversation_id = _conversation_id
    and g.status = 'running' and g.lease_expires_at > clock_timestamp()) then
    raise exception using errcode = '40001', message = 'generation running';
  end if;

  if generation.status <> 'complete' then
    -- Only the same decisions can reclaim a failed or expired continuation.
    if generation.continuation_parts is null or generation.continuation_decisions is distinct from canonical then
      raise exception using errcode = '40001', message = 'approval retry changed';
    end if;
    merged := generation.continuation_parts;
  else
    merged := answer.parts;
    for decision in select value from jsonb_array_elements(canonical) loop
      select count(*) into matching from jsonb_array_elements(merged) p
        where p->>'toolCallId' = decision->>'toolCallId' and p->'approval'->>'id' = decision->>'approvalId'
          and (p->>'type' like 'tool-%' or p->>'type' = 'dynamic-tool');
      if matching <> 1 then raise exception using errcode = '40001', message = 'approval target missing'; end if;
      select value, (ordinality - 1)::integer into part, part_index
        from jsonb_array_elements(merged) with ordinality
        where value->>'toolCallId' = decision->>'toolCallId' and value->'approval'->>'id' = decision->>'approvalId';
      if part->>'state' = 'approval-requested' then
        part := jsonb_set(part, '{state}', '"approval-responded"');
        part := jsonb_set(part, '{approval}', (part->'approval') || (decision - array['approvalId', 'toolCallId']));
        merged := jsonb_set(merged, array[part_index::text], part);
        new_decisions := new_decisions + 1;
      elsif part->>'state' in ('approval-responded', 'output-available', 'output-error', 'output-denied')
        and part->'approval'->'approved' = decision->'approved'
        and (part->'approval'->'reason') is not distinct from (decision->'reason') then
        null;
      else raise exception using errcode = '40001', message = 'approval decision changed';
      end if;
    end loop;
    if new_decisions = 0 then
      return query select learner.id, answer.id, true, learner.sequence_number, answer.parts;
      return;
    end if;
    if exists (select 1 from jsonb_array_elements(merged) p where p->>'state' = 'approval-requested') then
      raise exception using errcode = '22023', message = 'all pending approvals must be decided';
    end if;
  end if;
  update public.chat_generations g set status = 'running', request_id = _request_id,
    lease_expires_at = clock_timestamp() + interval '90 seconds',
    continuation_parts = merged, continuation_decisions = canonical
    where g.assistant_message_id = _assistant_id;
  update public.messages set status = 'pending', parts = merged, error_code = null,
    error_message = null, finish_reason = null where id = _assistant_id;
  return query select learner.id, answer.id, false, learner.sequence_number, merged;
end;
$$;

-- Preserve the existing user-turn and completion RPC contracts while guarding
-- their new continuation checkpoints. Internal implementations are not RPC APIs.
alter function public.begin_chat_generation(uuid,uuid,text,jsonb,uuid,text) rename to begin_chat_generation_user;
create function public.begin_chat_generation(
  _conversation_id uuid, _owner_id uuid, _client_message_id text,
  _parts jsonb, _request_id uuid, _model_id text
) returns table(user_message_id uuid, assistant_message_id uuid, replayed boolean, user_sequence_number bigint)
language plpgsql security definer set search_path = '' as $$
declare owned public.conversations%rowtype;
begin
  select * into owned from public.conversations where id = _conversation_id for update;
  if not found or owned.owner_id is distinct from _owner_id or owned.status <> 'active' then
    raise exception using errcode = '42501', message = 'active conversation owner mismatch';
  end if;
  if exists (select 1 from public.chat_generations g join public.messages m on m.id = g.user_message_id
    where g.conversation_id = _conversation_id and m.client_message_id = _client_message_id
      and g.continuation_parts is not null and g.status <> 'complete') then
    raise exception using errcode = '40001', message = 'retry the saved approval continuation';
  end if;
  return query select * from public.begin_chat_generation_user(_conversation_id, _owner_id, _client_message_id, _parts, _request_id, _model_id);
end;
$$;

alter function public.finish_chat_generation(uuid,uuid,uuid,uuid,text,jsonb,text) rename to finish_chat_generation_base;
create function public.finish_chat_generation(
  _conversation_id uuid, _owner_id uuid, _assistant_message_id uuid,
  _request_id uuid, _status text, _parts jsonb, _finish_reason text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare owned public.conversations%rowtype; checkpoint jsonb; saved_parts jsonb := _parts;
begin
  select * into owned from public.conversations where id = _conversation_id for update;
  if not found or owned.owner_id is distinct from _owner_id or owned.status <> 'active' then
    raise exception using errcode = '42501', message = 'active conversation owner mismatch';
  end if;
  select g.continuation_parts into checkpoint from public.chat_generations g
    where g.conversation_id = _conversation_id and g.assistant_message_id = _assistant_message_id
      and g.request_id = _request_id;
  if checkpoint is not null and _status in ('error', 'cancelled') then saved_parts := checkpoint; end if;
  return public.finish_chat_generation_base(_conversation_id, _owner_id, _assistant_message_id, _request_id, _status, saved_parts, _finish_reason);
end;
$$;

revoke execute on function public.begin_chat_generation_user(uuid,uuid,text,jsonb,uuid,text) from public, anon, authenticated, service_role;
revoke execute on function public.finish_chat_generation_base(uuid,uuid,uuid,uuid,text,jsonb,text) from public, anon, authenticated, service_role;
revoke execute on function public.begin_chat_generation(uuid,uuid,text,jsonb,uuid,text) from public, anon, authenticated;
revoke execute on function public.finish_chat_generation(uuid,uuid,uuid,uuid,text,jsonb,text) from public, anon, authenticated;
revoke execute on function public.begin_chat_tool_continuation(uuid,uuid,uuid,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.begin_chat_generation(uuid,uuid,text,jsonb,uuid,text) to service_role;
grant execute on function public.finish_chat_generation(uuid,uuid,uuid,uuid,text,jsonb,text) to service_role;
grant execute on function public.begin_chat_tool_continuation(uuid,uuid,uuid,uuid,text,jsonb) to service_role;

commit;

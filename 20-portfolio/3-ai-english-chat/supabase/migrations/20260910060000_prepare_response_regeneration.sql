begin;

create table public.response_regeneration_requests (
  request_id uuid primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  assistant_message_id uuid not null,
  user_message_id uuid not null references public.messages(id) on delete cascade
);
alter table public.response_regeneration_requests enable row level security;
revoke all on public.response_regeneration_requests from public, anon, authenticated;

create function public.prepare_response_regeneration(_conversation_id uuid, _owner_id uuid, _assistant_id uuid, _request_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  owned public.conversations%rowtype;
  answer public.messages%rowtype;
  learner public.messages%rowtype;
  receipt public.response_regeneration_requests%rowtype;
  previous_purge text := current_setting('app.immutable_purge', true);
begin
  if _assistant_id is null or _request_id is null then
    raise exception using errcode = '22023', message = 'regeneration IDs required';
  end if;
  select * into owned from public.conversations where id = _conversation_id for update;
  if not found or owned.owner_id is distinct from _owner_id then
    raise exception using errcode = '42501', message = 'conversation owner mismatch';
  end if;
  if owned.status <> 'active' then raise exception using errcode = '55000', message = 'conversation not active'; end if;
  select * into receipt from public.response_regeneration_requests where request_id = _request_id;
  if found then
    if receipt.conversation_id <> _conversation_id or receipt.assistant_message_id <> _assistant_id then
      raise exception using errcode = '40001', message = 'regeneration key reused';
    end if;
    return receipt.user_message_id;
  end if;
  if exists (select 1 from public.chat_generations where conversation_id = _conversation_id
    and status = 'running' and lease_expires_at > clock_timestamp()) then
    raise exception using errcode = '40001', message = 'generation running';
  end if;
  select * into answer from public.messages where conversation_id = _conversation_id
    order by sequence_number desc limit 1;
  if answer.id is distinct from _assistant_id or answer.role <> 'assistant' or answer.status <> 'complete' then
    raise exception using errcode = '40001', message = 'only the latest completed answer can be regenerated';
  end if;
  select * into learner from public.messages where conversation_id = _conversation_id
    and role = 'user' and author_id = _owner_id and sequence_number < answer.sequence_number
    order by sequence_number desc limit 1;
  if not found or learner.status <> 'complete' or (answer.parent_message_id is not null and answer.parent_message_id <> learner.id) then
    raise exception using errcode = '55000', message = 'answer user turn missing';
  end if;
  perform set_config('app.immutable_purge', 'enabled', true);
  delete from public.messages where id = answer.id;
  perform set_config('app.immutable_purge', coalesce(previous_purge, ''), true);
  -- Preserve the user row and its text, attaching a stable key for legacy rows.
  update public.messages set client_message_id = coalesce(client_message_id, id::text) where id = learner.id;
  update public.conversations set last_message_at = learner.created_at where id = _conversation_id;
  insert into public.response_regeneration_requests values (_request_id, _conversation_id, _assistant_id, learner.id);
  return learner.id;
end;
$$;
revoke execute on function public.prepare_response_regeneration(uuid,uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.prepare_response_regeneration(uuid,uuid,uuid,uuid) to service_role;

commit;

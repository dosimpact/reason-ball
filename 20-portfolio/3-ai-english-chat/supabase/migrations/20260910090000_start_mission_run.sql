-- Server-only, atomic start. The caller supplies the authenticated owner, never
-- an owner from the request body. Existing conversations are idempotency keys.
begin;

create function public.start_mission_run(
  _expected_owner_id uuid,
  _mission_id uuid,
  _mission_version_id uuid,
  _character_id uuid,
  _character_version_id uuid,
  _conversation_id uuid default null,
  _model_id text default 'gpt-5.6-terra'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  chat public.conversations%rowtype;
  existing public.mission_runs%rowtype;
  mission public.missions%rowtype;
  persona public.characters%rowtype;
  first_step integer;
  next_attempt integer;
  result_id uuid;
  chat_id uuid := _conversation_id;
  started timestamptz := now();
begin
  if _expected_owner_id is null or _mission_id is null or _mission_version_id is null
    or _character_id is null or _character_version_id is null
    or _model_id is null or char_length(btrim(_model_id)) not between 1 and 100 then
    raise exception 'Invalid mission start input' using errcode = '22023';
  end if;

  -- All starts through this RPC serialize attempt allocation for one learner
  -- and mission, including different characters and different conversations.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('mission-start:' || _expected_owner_id::text || ':' || _mission_id::text, 0)
  );

  if chat_id is not null then
    select * into chat from public.conversations
    where id = chat_id and owner_id = _expected_owner_id and status = 'active'
    for update;
    if not found or chat.mission_id is distinct from _mission_id
      or chat.character_id is distinct from _character_id then
      raise exception 'Conversation context mismatch' using errcode = 'P2002';
    end if;
    select * into existing from public.mission_runs where conversation_id = chat_id;
    if found then
      if existing.owner_id is distinct from _expected_owner_id
        or existing.mission_id is distinct from chat.mission_id
        or existing.mission_version_id is distinct from chat.mission_version_id
        or existing.character_id is distinct from chat.character_id
        or existing.character_version_id is distinct from chat.character_version_id then
        raise exception 'Conversation context mismatch' using errcode = 'P2002';
      end if;
      -- No latest-publication, prerequisite, score or progress mutation on replay.
      return existing.id;
    end if;
    if chat.mission_version_id is distinct from _mission_version_id
      or chat.character_version_id is distinct from _character_version_id then
      raise exception 'Conversation context mismatch' using errcode = 'P2002';
    end if;
  end if;

  -- Recheck the snapshots while holding their rows through the transaction.
  select * into mission from public.missions where id = _mission_id for share;
  if not found or mission.status <> 'published'
    or not (mission.owner_id is not distinct from _expected_owner_id or mission.visibility in ('public', 'unlisted')) then
    raise exception 'Mission is unavailable for a new run' using errcode = 'P2005';
  end if;
  select * into persona from public.characters where id = _character_id for share;
  if not found or persona.status <> 'published'
    or not (persona.owner_id is not distinct from _expected_owner_id or persona.visibility in ('public', 'unlisted')) then
    raise exception 'Character is unavailable for a new run' using errcode = 'P2005';
  end if;
  if mission.current_version_id is distinct from _mission_version_id
    or persona.current_version_id is distinct from _character_version_id then
    raise exception 'Publication changed before mission start' using errcode = '40001';
  end if;
  if not exists (select 1 from public.mission_versions where id = _mission_version_id
      and mission_id = _mission_id and published_at is not null)
    or not exists (select 1 from public.character_versions where id = _character_version_id
      and character_id = _character_id and published_at is not null) then
    raise exception 'Published versions are required' using errcode = 'P2005';
  end if;
  perform 1 from public.mission_characters
    where mission_id = _mission_id and character_id = _character_id for share;
  if not found then
    raise exception 'Character is not assigned to the mission' using errcode = 'P2003';
  end if;

  -- Legacy callers without a conversation resume an active, usable context only.
  if chat_id is null then
    select run.* into existing from public.mission_runs run
    join public.conversations conversation on conversation.id = run.conversation_id
    where run.owner_id = _expected_owner_id and run.mission_id = _mission_id
      and run.character_id = _character_id and run.status in ('not-started', 'in-progress', 'evaluating')
      and conversation.owner_id = _expected_owner_id and conversation.status = 'active'
      and conversation.mission_id = run.mission_id and conversation.mission_version_id = run.mission_version_id
      and conversation.character_id = run.character_id and conversation.character_version_id = run.character_version_id
    order by run.created_at desc, run.id limit 1;
    if found then return existing.id; end if;
  end if;

  select min(step_order) into first_step from public.mission_steps where mission_version_id = _mission_version_id;
  if first_step is null then
    raise exception 'Mission learning steps are required' using errcode = 'P2004';
  end if;
  select coalesce(max(attempt_number), 0) + 1 into next_attempt from public.mission_runs
    where owner_id = _expected_owner_id and mission_id = _mission_id;

  if chat_id is null then
    insert into public.conversations(owner_id, mission_id, mission_version_id, character_id,
      character_version_id, title, model_id, metadata)
    values (_expected_owner_id, _mission_id, _mission_version_id, _character_id,
      _character_version_id, mission.title, _model_id, '{"source":"mission-run"}'::jsonb)
    returning id into chat_id;
  end if;
  insert into public.mission_runs(owner_id, mission_id, mission_version_id, character_id,
    character_version_id, conversation_id, status, current_step_order, attempt_number, started_at)
  values (_expected_owner_id, _mission_id, _mission_version_id, _character_id,
    _character_version_id, chat_id, 'in-progress', first_step, next_attempt, started)
  returning id into result_id;

  insert into public.mission_step_progress(mission_run_id, mission_step_id, status, started_at)
  select result_id, step.id, case when step.step_order = first_step then 'active' else 'locked' end,
    case when step.step_order = first_step then started else null end
  from public.mission_steps step where step.mission_version_id = _mission_version_id;
  return result_id;
end;
$$;

revoke all on function public.start_mission_run(uuid, uuid, uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.start_mission_run(uuid, uuid, uuid, uuid, uuid, uuid, text) to service_role;

commit;

-- Current public schema snapshot (2026-09-10). No application data or credentials.
-- Reference only: auth/storage objects and extensions remain in migrations/.
-- Apply migrations/ for deployments; do not execute this file on an existing database.
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: append_artifact_version(uuid, uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.append_artifact_version(_artifact_version_id uuid, _artifact_id uuid, _expected_owner_id uuid, _payload jsonb) RETURNS TABLE(artifact_id uuid, artifact_version_id uuid, version_number integer, status text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  locked_artifact public.artifacts%rowtype;
  next_version integer;
  desired_status text := coalesce(nullif(_payload ->> 'status', ''), 'draft');
  source_message uuid := nullif(_payload ->> 'sourceMessageId', '')::uuid;
  storage_bucket text := nullif(_payload ->> 'storageBucket', '');
  storage_path text := nullif(_payload ->> 'storagePath', '');
begin
  if _artifact_version_id is null or _artifact_id is null
    or _expected_owner_id is null or _payload is null
    or jsonb_typeof(_payload) <> 'object'
    or desired_status not in ('draft', 'published')
  then
    raise exception using errcode = '22023', message = 'invalid artifact version request';
  end if;

  select * into locked_artifact
  from public.artifacts as artifact
  where artifact.id = _artifact_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'artifact not found';
  end if;
  if locked_artifact.owner_id is distinct from _expected_owner_id then
    raise exception using errcode = '42501', message = 'artifact owner mismatch';
  end if;
  if locked_artifact.kind = 'image' and (
    (_payload -> 'contentJson') ? 'imageUrl'
    or (storage_bucket is not null and storage_bucket <> 'artifact-images')
  ) then
    raise exception using errcode = '23514', message = 'image artifacts require private immutable storage references';
  end if;
  if source_message is not null and not exists (
    select 1 from public.messages as message
    where message.id = source_message
      and message.conversation_id = locked_artifact.conversation_id
  ) then
    raise exception using errcode = '23514', message = 'artifact source message mismatch';
  end if;
  if nullif(_payload ->> 'contentText', '') is null
    and _payload -> 'contentJson' is null
    and (storage_bucket is null or storage_path is null)
  then
    raise exception using errcode = '23514', message = 'artifact version content is required';
  end if;
  if storage_bucket is not null and (
    storage_bucket not in ('chat-attachments', 'artifact-images')
    or split_part(storage_path, '/', 1) <> _expected_owner_id::text
    or (storage_bucket = 'artifact-images' and (split_part(storage_path, '/', 2) <> locked_artifact.id::text or locked_artifact.kind <> 'image'))
    or not exists (
      select 1 from storage.objects as object
      where object.bucket_id = storage_bucket and object.name = storage_path
    )
  ) then
    raise exception using errcode = '23514', message = 'invalid artifact storage object';
  end if;

  select coalesce(max(version.version_number), 0) + 1 into next_version
  from public.artifact_versions as version
  where version.artifact_id = locked_artifact.id;

  insert into public.artifact_versions (
    id, artifact_id, version_number, source_message_id,
    content_text, content_json, storage_bucket, storage_path, created_by
  ) values (
    _artifact_version_id, locked_artifact.id, next_version, source_message,
    nullif(_payload ->> 'contentText', ''), _payload -> 'contentJson',
    storage_bucket, storage_path, _expected_owner_id
  );

  update public.artifacts as artifact
  set current_version_id = _artifact_version_id, status = desired_status
  where artifact.id = locked_artifact.id;

  if desired_status = 'published' then
    update public.artifact_versions as version
    set published_at = timezone('utc', now())
    where version.id = _artifact_version_id;
  end if;

  return query select locked_artifact.id, _artifact_version_id, next_version, desired_status;
end;
$$;


--
-- Name: archive_character(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.archive_character(_character_id uuid, _expected_owner_id uuid) RETURNS TABLE(character_id uuid, status text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  locked_character public.characters%rowtype;
begin
  select * into locked_character
  from public.characters as character
  where character.id = _character_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'character not found';
  end if;
  if locked_character.owner_id is distinct from _expected_owner_id then
    raise exception using errcode = '42501', message = 'character owner mismatch';
  end if;

  update public.characters as character
  set status = 'archived'
  where character.id = locked_character.id;

  return query select locked_character.id, 'archived'::text;
end;
$$;


--
-- Name: archive_mission(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.archive_mission(_mission_id uuid, _expected_owner_id uuid) RETURNS TABLE(mission_id uuid, status text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  locked_mission public.missions%rowtype;
begin
  select * into locked_mission
  from public.missions as mission
  where mission.id = _mission_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'mission not found';
  end if;
  if locked_mission.owner_id is distinct from _expected_owner_id then
    raise exception using errcode = '42501', message = 'mission owner mismatch';
  end if;

  update public.missions as mission
  set status = 'archived'
  where mission.id = locked_mission.id;

  return query select locked_mission.id, 'archived'::text;
end;
$$;


--
-- Name: attach_character_asset(uuid, uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.attach_character_asset(_asset_id uuid, _character_id uuid, _expected_owner_id uuid, _payload jsonb) RETURNS TABLE(asset_id uuid, storage_bucket text, storage_path text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  locked_character public.characters%rowtype;
begin
  select * into locked_character
  from public.characters as character
  where character.id = _character_id
  for share;

  if not found then
    raise exception using errcode = 'P0002', message = 'character not found';
  end if;
  if locked_character.owner_id is distinct from _expected_owner_id then
    raise exception using errcode = '42501', message = 'character owner mismatch';
  end if;
  if _payload ->> 'storageBucket' not in ('character-public', 'character-private')
    or split_part(_payload ->> 'storagePath', '/', 1) <> _expected_owner_id::text
    or not exists (
      select 1 from storage.objects as object
      where object.bucket_id = _payload ->> 'storageBucket'
        and object.name = _payload ->> 'storagePath'
    )
  then
    raise exception using errcode = '23514', message = 'invalid character asset storage object';
  end if;

  insert into public.character_assets (
    id, character_id, character_version_id, asset_type, access_level,
    storage_bucket, storage_path, mime_type, alt_text, is_primary,
    metadata, created_by
  )
  values (
    _asset_id, locked_character.id, locked_character.current_version_id,
    _payload ->> 'assetType', _payload ->> 'accessLevel',
    _payload ->> 'storageBucket', _payload ->> 'storagePath',
    _payload ->> 'mimeType', coalesce(_payload ->> 'altText', ''),
    coalesce((_payload ->> 'isPrimary')::boolean, false),
    coalesce(_payload -> 'metadata', '{}'::jsonb), _expected_owner_id
  );

  return query select _asset_id, _payload ->> 'storageBucket', _payload ->> 'storagePath';
end;
$$;


--
-- Name: attach_mission_asset(uuid, uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.attach_mission_asset(_asset_id uuid, _mission_id uuid, _expected_owner_id uuid, _payload jsonb) RETURNS TABLE(asset_id uuid, storage_bucket text, storage_path text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  locked_mission public.missions%rowtype;
begin
  select * into locked_mission
  from public.missions as mission
  where mission.id = _mission_id
  for share;

  if not found then
    raise exception using errcode = 'P0002', message = 'mission not found';
  end if;
  if locked_mission.owner_id is distinct from _expected_owner_id then
    raise exception using errcode = '42501', message = 'mission owner mismatch';
  end if;
  if _payload ->> 'storageBucket' not in ('mission-public', 'mission-private')
    or split_part(_payload ->> 'storagePath', '/', 1) <> _expected_owner_id::text
    or not exists (
      select 1 from storage.objects as object
      where object.bucket_id = _payload ->> 'storageBucket'
        and object.name = _payload ->> 'storagePath'
    )
  then
    raise exception using errcode = '23514', message = 'invalid mission asset storage object';
  end if;

  insert into public.mission_assets (
    id, mission_id, mission_version_id, asset_type, access_level,
    storage_bucket, storage_path, mime_type, alt_text, is_primary, metadata
  )
  values (
    _asset_id, locked_mission.id, locked_mission.current_version_id,
    _payload ->> 'assetType', _payload ->> 'accessLevel',
    _payload ->> 'storageBucket', _payload ->> 'storagePath',
    _payload ->> 'mimeType', coalesce(_payload ->> 'altText', ''),
    coalesce((_payload ->> 'isPrimary')::boolean, false),
    coalesce(_payload -> 'metadata', '{}'::jsonb)
  );

  return query select _asset_id, _payload ->> 'storageBucket', _payload ->> 'storagePath';
end;
$$;


--
-- Name: begin_chat_generation(uuid, uuid, text, jsonb, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.begin_chat_generation(_conversation_id uuid, _owner_id uuid, _client_message_id text, _parts jsonb, _request_id uuid, _model_id text) RETURNS TABLE(user_message_id uuid, assistant_message_id uuid, replayed boolean, user_sequence_number bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare owned public.conversations%rowtype;
begin
  select * into owned from public.conversations where id = _conversation_id for update;
  if not found or owned.owner_id is distinct from _owner_id or owned.status <> 'active' then
    raise exception using errcode = '42501', message = 'active conversation owner mismatch';
  end if;
  if exists (select 1 from public.chat_generations g join public.messages m on m.id = g.user_message_id
    where g.conversation_id = _conversation_id and m.client_message_id = _client_message_id
      and g.continuation_parts is not null and g.status <> 'complete') then
    raise exception using errcode = 'PT409', message = 'retry the saved approval continuation';
  end if;
  return query select * from public.begin_chat_generation_user(_conversation_id, _owner_id, _client_message_id, _parts, _request_id, _model_id);
end;
$$;


--
-- Name: begin_chat_generation_user(uuid, uuid, text, jsonb, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.begin_chat_generation_user(_conversation_id uuid, _owner_id uuid, _client_message_id text, _parts jsonb, _request_id uuid, _model_id text) RETURNS TABLE(user_message_id uuid, assistant_message_id uuid, replayed boolean, user_sequence_number bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
      raise exception using errcode = 'PT409', message = 'message key reused with different content';
    end if;
    select * into generation from public.chat_generations g where g.user_message_id = user_row.id;
    if found and generation.status = 'complete' then
      return query select user_row.id, generation.assistant_message_id, true, user_row.sequence_number;
      return;
    end if;
    if exists (select 1 from public.messages m where m.conversation_id = _conversation_id
      and m.role = 'user' and m.sequence_number > user_row.sequence_number) then
      raise exception using errcode = 'PT409', message = 'only the latest user turn can be retried';
    end if;
  end if;

  if exists (select 1 from public.chat_generations g where g.conversation_id = _conversation_id
    and g.status = 'running' and g.lease_expires_at > clock_timestamp()) then
    raise exception using errcode = 'PT409', message = 'a chat generation is already running';
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


--
-- Name: begin_chat_tool_continuation(uuid, uuid, uuid, uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.begin_chat_tool_continuation(_conversation_id uuid, _owner_id uuid, _assistant_id uuid, _request_id uuid, _model_id text, _decisions jsonb) RETURNS TABLE(user_message_id uuid, assistant_message_id uuid, replayed boolean, user_sequence_number bigint, continuation_parts jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
    raise exception using errcode = 'PT409', message = 'approval turn or model changed';
  end if;
  select * into generation from public.chat_generations g
    where g.conversation_id = _conversation_id and g.assistant_message_id = _assistant_id;
  if not found then raise exception using errcode = 'PT409', message = 'approval generation missing'; end if;
  select * into learner from public.messages where id = generation.user_message_id;
  if learner.author_id is distinct from _owner_id or learner.role <> 'user' then
    raise exception using errcode = '42501', message = 'approval author mismatch';
  end if;
  if exists (select 1 from public.chat_generations g where g.conversation_id = _conversation_id
    and g.status = 'running' and g.lease_expires_at > clock_timestamp()) then
    raise exception using errcode = 'PT409', message = 'generation running';
  end if;

  if generation.status <> 'complete' then
    -- Only the same decisions can reclaim a failed or expired continuation.
    if generation.continuation_parts is null or generation.continuation_decisions is distinct from canonical then
      raise exception using errcode = 'PT409', message = 'approval retry changed';
    end if;
    merged := generation.continuation_parts;
  else
    merged := answer.parts;
    for decision in select value from jsonb_array_elements(canonical) loop
      select count(*) into matching from jsonb_array_elements(merged) p
        where p->>'toolCallId' = decision->>'toolCallId' and p->'approval'->>'id' = decision->>'approvalId'
          and (p->>'type' like 'tool-%' or p->>'type' = 'dynamic-tool');
      if matching <> 1 then raise exception using errcode = 'PT409', message = 'approval target missing'; end if;
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
      else raise exception using errcode = 'PT409', message = 'approval decision changed';
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


--
-- Name: can_read_storage_object(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_read_storage_object(_bucket_id text, _object_name text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select
    case
      when _bucket_id in ('profile-avatars', 'character-public', 'mission-public')
        then true
      when _bucket_id = 'character-private' then
        split_part(_object_name, '/', 1) = (select auth.uid())::text
        or exists (
          select 1
          from public.character_assets as asset
          join public.characters as character on character.id = asset.character_id
          where asset.storage_bucket = _bucket_id
            and asset.storage_path = _object_name
            and (
              character.owner_id = (select auth.uid())
              or (
                asset.access_level = 'reward'
                and exists (
                  select 1
                  from public.reward_unlocks as reward
                  where reward.character_asset_id = asset.id
                    and reward.user_id = (select auth.uid())
                )
              )
            )
        )
      when _bucket_id = 'mission-private' then
        split_part(_object_name, '/', 1) = (select auth.uid())::text
        or exists (
          select 1
          from public.mission_assets as asset
          join public.missions as mission on mission.id = asset.mission_id
          where asset.storage_bucket = _bucket_id
            and asset.storage_path = _object_name
            and mission.owner_id = (select auth.uid())
        )
      when _bucket_id = 'chat-attachments' then
        split_part(_object_name, '/', 1) = (select auth.uid())::text
        or exists (
          select 1
          from public.message_attachments as attachment
          join public.messages as message on message.id = attachment.message_id
          where attachment.storage_bucket = _bucket_id
            and attachment.storage_path = _object_name
            and (
              attachment.owner_id = (select auth.uid())
              or (
                attachment.access_level = 'conversation'
                and public.can_view_conversation(message.conversation_id)
              )
            )
        )
        or exists (
          select 1
          from public.message_audio as audio
          where audio.storage_bucket = _bucket_id
            and audio.storage_path = _object_name
            and audio.owner_id = (select auth.uid())
        )
      else false
    end;
$$;


--
-- Name: can_view_character(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_view_character(_character_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
    from public.characters
    where id = _character_id
      and (
        owner_id = (select auth.uid())
        or (
          status = 'published'
          and (
            visibility = 'public'
            or (visibility = 'unlisted' and (select auth.uid()) is not null)
          )
        )
      )
  ) or public.is_admin();
$$;


--
-- Name: can_view_conversation(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_view_conversation(_conversation_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
    from public.conversations
    where id = _conversation_id
      and status <> 'deleted'
      and (
        owner_id = (select auth.uid())
        or visibility = 'public'
      )
  ) or public.is_admin();
$$;


--
-- Name: can_view_mission(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_view_mission(_mission_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
    from public.missions
    where id = _mission_id
      and (
        owner_id = (select auth.uid())
        or (
          status = 'published'
          and (
            visibility = 'public'
            or (visibility = 'unlisted' and (select auth.uid()) is not null)
          )
        )
      )
  ) or public.is_admin();
$$;


--
-- Name: capture_version_display_metadata(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.capture_version_display_metadata() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if tg_op = 'UPDATE' then
    if old.published_at is not null then
      -- The existing immutability trigger rejects any published-row mutation.
      return new;
    end if;
  end if;
  new.display_metadata := null;
  if new.published_at is null then return new; end if;

  if tg_table_name = 'character_versions' then
    select jsonb_build_object(
      'schemaVersion', 1, 'name', base.name, 'tagline', base.tagline,
      'description', base.description,
      'tags', coalesce((select jsonb_agg(tag.tag order by tag.tag)
        from public.character_tags tag where tag.character_id = base.id), '[]'::jsonb)
    ) into new.display_metadata
    from public.characters base where base.id = new.character_id;
  else
    select jsonb_build_object(
      'schemaVersion', 1, 'title', base.title, 'summary', base.summary,
      'scenario_category', base.scenario_category, 'difficulty', base.difficulty,
      'estimated_minutes', base.estimated_minutes
    ) into new.display_metadata
    from public.missions base where base.id = new.mission_id;
  end if;
  if new.display_metadata is null then
    raise exception 'Version display metadata source is missing' using errcode = '23503';
  end if;
  return new;
end;
$$;


--
-- Name: clear_conversation_messages(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.clear_conversation_messages(_conversation_id uuid, _owner_id uuid, _request_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: commit_artifact_revision(uuid, uuid, uuid, uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commit_artifact_revision(_request_id uuid, _artifact_id uuid, _expected_owner_id uuid, _conversation_id uuid, _expected_version_id uuid, _payload jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  saved_request public.artifact_revision_requests%rowtype;
  locked_artifact public.artifacts%rowtype;
begin
  if _request_id is null or _artifact_id is null or _expected_owner_id is null
    or _conversation_id is null or _payload is null or jsonb_typeof(_payload) <> 'object'
  then
    raise exception using errcode = '22023', message = 'invalid artifact revision request';
  end if;

  -- Common lock order: conversation, then artifact. Also fences deletion.
  perform 1 from public.conversations as conversation
  where conversation.id = _conversation_id and conversation.owner_id = _expected_owner_id
    and conversation.status = 'active'
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'artifact conversation owner or state mismatch';
  end if;

  select * into locked_artifact from public.artifacts as artifact
  where artifact.id = _artifact_id for update;
  if found and (locked_artifact.owner_id is distinct from _expected_owner_id
    or locked_artifact.conversation_id is distinct from _conversation_id) then
    raise exception using errcode = '42501', message = 'artifact owner or conversation mismatch';
  end if;
  if locked_artifact.status = 'archived' then
    raise exception using errcode = '55000', message = 'archived artifact cannot be edited';
  end if;

  select * into saved_request from public.artifact_revision_requests as request
  where request.request_id = _request_id;
  if found then
    if saved_request.artifact_id is distinct from _artifact_id
      or saved_request.owner_id is distinct from _expected_owner_id
      or saved_request.expected_version_id is distinct from _expected_version_id
      or saved_request.payload is distinct from _payload
    then
      raise exception using errcode = 'PT409', message = 'artifact request key reused with different input';
    end if;
    return saved_request.request_id;
  end if;

  if _expected_version_id is null then
    if locked_artifact.id is not null then
      raise exception using errcode = 'PT409', message = 'artifact already exists';
    end if;
    perform * from public.create_artifact_with_version(
      _artifact_id, _request_id, _expected_owner_id, _conversation_id, _payload
    );
  else
    if locked_artifact.id is null then
      raise exception using errcode = 'P0002', message = 'artifact not found';
    end if;
    if locked_artifact.current_version_id is distinct from _expected_version_id then
      raise exception using errcode = 'PT409', message = 'artifact version changed';
    end if;
    -- Both operations share this transaction; an invalid version rolls back title too.
    if _payload ? 'title' then
      perform * from public.update_artifact_state(_artifact_id, _expected_owner_id, _payload ->> 'title', null);
    end if;
    perform * from public.append_artifact_version(_request_id, _artifact_id, _expected_owner_id, _payload);
  end if;

  insert into public.artifact_revision_requests(request_id, artifact_id, owner_id, expected_version_id, payload)
  values (_request_id, _artifact_id, _expected_owner_id, _expected_version_id, _payload);
  return _request_id;
end;
$$;


--
-- Name: complete_mission_run(uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_mission_run(_mission_run_id uuid, _mission_evaluation_id uuid, _mission_reward_id uuid, _expected_owner_id uuid) RETURNS TABLE(mission_run_id uuid, mission_evaluation_id uuid, reward_unlock_id uuid, score numeric, stars smallint, experience_points_awarded integer, already_completed boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  locked_run public.mission_runs%rowtype;
begin
  select *
  into locked_run
  from public.mission_runs as run
  where run.id = _mission_run_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'mission run not found';
  end if;

  if locked_run.owner_id is distinct from _expected_owner_id then
    raise exception using
      errcode = '42501',
      message = 'mission run does not belong to the expected owner';
  end if;

  if locked_run.status = 'passed'
    and locked_run.awarded_evaluation_id is distinct from _mission_evaluation_id
  then
    raise exception using
      errcode = '23514',
      message = 'mission run was completed with a different evaluation';
  end if;

  return query
  select
    completion.mission_run_id,
    completion.mission_evaluation_id,
    completion.reward_unlock_id,
    completion.score,
    completion.stars,
    completion.experience_points_awarded,
    completion.already_completed
  from public.complete_mission_run_unchecked(
    _mission_run_id,
    _mission_evaluation_id,
    _mission_reward_id,
    _expected_owner_id
  ) as completion;
end;
$$;


--
-- Name: FUNCTION complete_mission_run(_mission_run_id uuid, _mission_evaluation_id uuid, _mission_reward_id uuid, _expected_owner_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.complete_mission_run(_mission_run_id uuid, _mission_evaluation_id uuid, _mission_reward_id uuid, _expected_owner_id uuid) IS 'Server-only guarded atomic transition from evaluated mission run to XP, daily stats, and one private image reward unlock.';


--
-- Name: complete_mission_run_unchecked(uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_mission_run_unchecked(_mission_run_id uuid, _mission_evaluation_id uuid, _mission_reward_id uuid, _expected_owner_id uuid) RETURNS TABLE(mission_run_id uuid, mission_evaluation_id uuid, reward_unlock_id uuid, score numeric, stars smallint, experience_points_awarded integer, already_completed boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  locked_run public.mission_runs%rowtype;
  passed_evaluation public.mission_evaluations%rowtype;
  run_mission public.missions%rowtype;
  run_mission_version public.mission_versions%rowtype;
  selected_reward public.mission_rewards%rowtype;
  reward_asset public.character_assets%rowtype;
  unlocked_reward public.reward_unlocks%rowtype;
  calculated_stars smallint;
  affected_rows integer;
  completed_time timestamptz := now();
begin
  select *
  into locked_run
  from public.mission_runs as run
  where run.id = _mission_run_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'mission run not found';
  end if;

  if locked_run.owner_id <> _expected_owner_id then
    raise exception using
      errcode = '42501',
      message = 'mission run does not belong to the expected owner';
  end if;

  select *
  into selected_reward
  from public.mission_rewards as reward
  where reward.id = _mission_reward_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'mission reward not found';
  end if;

  select *
  into reward_asset
  from public.character_assets as asset
  where asset.id = selected_reward.character_asset_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'reward asset not found';
  end if;

  select *
  into run_mission
  from public.missions as mission
  where mission.id = locked_run.mission_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'mission snapshot not found';
  end if;

  if locked_run.status = 'passed' then
    if locked_run.awarded_mission_reward_id is distinct from _mission_reward_id then
      raise exception using
        errcode = '23514',
        message = 'mission run was completed with a different reward';
    end if;

    select *
    into unlocked_reward
    from public.reward_unlocks as reward_unlock
    where reward_unlock.user_id = locked_run.owner_id
      and reward_unlock.character_asset_id = selected_reward.character_asset_id;

    if not found then
      raise exception using
        errcode = '23514',
        message = 'passed mission run has no matching reward unlock';
    end if;

    return query
    select
      locked_run.id,
      locked_run.awarded_evaluation_id,
      unlocked_reward.id,
      locked_run.score,
      locked_run.stars,
      run_mission.reward_experience_points,
      true;
    return;
  end if;

  if locked_run.status <> 'evaluating' then
    raise exception using
      errcode = '23514',
      message = 'mission run must be evaluating before it can pass';
  end if;

  if not exists (
    select 1
    from public.conversations as conversation
    where conversation.id = locked_run.conversation_id
      and conversation.owner_id = locked_run.owner_id
      and conversation.character_id = locked_run.character_id
      and conversation.character_version_id = locked_run.character_version_id
      and conversation.mission_id = locked_run.mission_id
      and conversation.mission_version_id = locked_run.mission_version_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'mission run context no longer matches its conversation snapshot';
  end if;

  select *
  into run_mission_version
  from public.mission_versions as mission_version
  where mission_version.id = locked_run.mission_version_id
    and mission_version.mission_id = locked_run.mission_id
  for share;

  if not found then
    raise exception using
      errcode = '23514',
      message = 'mission version does not match the run snapshot';
  end if;

  select *
  into passed_evaluation
  from public.mission_evaluations as evaluation
  where evaluation.id = _mission_evaluation_id
    and evaluation.mission_run_id = locked_run.id
  for share;

  if not found
    or passed_evaluation.status <> 'completed'
    or passed_evaluation.passed is distinct from true
    or passed_evaluation.completed_at is null
    or passed_evaluation.total_score is null
    or passed_evaluation.total_score < run_mission_version.pass_score
  then
    raise exception using
      errcode = '23514',
      message = 'a completed passing evaluation at or above the mission pass score is required';
  end if;

  if not (
    passed_evaluation.completed_learning_goals
    @> run_mission_version.learning_goals
  ) then
    raise exception using
      errcode = '23514',
      message = 'evaluation does not complete every required learning goal';
  end if;

  if not exists (
    select 1
    from public.mission_steps as required_step
    where required_step.mission_version_id = locked_run.mission_version_id
      and not required_step.is_optional
  ) then
    raise exception using
      errcode = '23514',
      message = 'mission version has no required steps';
  end if;

  if exists (
    select 1
    from public.mission_steps as required_step
    where required_step.mission_version_id = locked_run.mission_version_id
      and not required_step.is_optional
      and not exists (
        select 1
        from public.mission_step_progress as step_progress
        where step_progress.mission_run_id = locked_run.id
          and step_progress.mission_step_id = required_step.id
          and step_progress.status = 'completed'
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'every required mission step must be completed';
  end if;

  if not selected_reward.is_active
    or selected_reward.mission_id <> locked_run.mission_id
    or selected_reward.mission_version_id <> locked_run.mission_version_id
  then
    raise exception using
      errcode = '23514',
      message = 'reward is not active for the run mission version';
  end if;

  if reward_asset.asset_type <> 'reward'
    or reward_asset.access_level <> 'reward'
    or reward_asset.storage_bucket <> 'character-private'
    or reward_asset.character_id <> locked_run.character_id
    or reward_asset.character_version_id is distinct from locked_run.character_version_id
  then
    raise exception using
      errcode = '23514',
      message = 'reward asset does not match the private character version reward policy';
  end if;

  if not exists (
    select 1
    from public.mission_characters as allowed_character
    where allowed_character.mission_id = locked_run.mission_id
      and allowed_character.character_id = locked_run.character_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'run character is not allowed by the mission';
  end if;

  if not exists (
    select 1
    from storage.objects as object
    where object.bucket_id = reward_asset.storage_bucket
      and object.name = reward_asset.storage_path
  ) then
    raise exception using
      errcode = '23514',
      message = 'reward storage object does not exist';
  end if;

  calculated_stars := case
    when passed_evaluation.total_score >= 90 then 3
    when passed_evaluation.total_score >= 80 then 2
    else 1
  end;

  if passed_evaluation.total_score < selected_reward.minimum_score
    or calculated_stars < selected_reward.minimum_stars
  then
    raise exception using
      errcode = '23514',
      message = 'evaluation does not satisfy the selected reward threshold';
  end if;

  insert into public.reward_unlocks (
    user_id,
    character_asset_id,
    mission_reward_id,
    mission_id,
    mission_run_id,
    mission_evaluation_id
  )
  values (
    locked_run.owner_id,
    reward_asset.id,
    selected_reward.id,
    locked_run.mission_id,
    locked_run.id,
    passed_evaluation.id
  )
  on conflict (user_id, character_asset_id) do nothing
  returning * into unlocked_reward;

  if unlocked_reward.id is null then
    select *
    into unlocked_reward
    from public.reward_unlocks as reward_unlock
    where reward_unlock.user_id = locked_run.owner_id
      and reward_unlock.character_asset_id = reward_asset.id;
  end if;

  if unlocked_reward.id is null then
    raise exception using
      errcode = '23514',
      message = 'reward unlock could not be persisted';
  end if;

  update public.mission_runs as run
  set
    status = 'passed',
    score = passed_evaluation.total_score,
    stars = calculated_stars,
    awarded_mission_reward_id = selected_reward.id,
    awarded_evaluation_id = passed_evaluation.id,
    completed_at = completed_time
  where run.id = locked_run.id
    and run.status = 'evaluating'
  returning * into locked_run;

  if not found then
    raise exception using
      errcode = 'PT409',
      message = 'mission run changed while completion was in progress';
  end if;

  update public.profiles as profile
  set
    experience_points = profile.experience_points + run_mission.reward_experience_points,
    last_learning_at = completed_time
  where profile.id = locked_run.owner_id;

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception using
      errcode = '23514',
      message = 'mission owner profile does not exist';
  end if;

  insert into public.daily_learning_stats (
    user_id,
    learning_date,
    missions_completed,
    experience_earned
  )
  values (
    locked_run.owner_id,
    (completed_time at time zone 'utc')::date,
    1,
    run_mission.reward_experience_points
  )
  on conflict (user_id, learning_date) do update
  set
    missions_completed = public.daily_learning_stats.missions_completed + 1,
    experience_earned = public.daily_learning_stats.experience_earned + excluded.experience_earned;

  update public.missions as mission
  set completion_count = mission.completion_count + 1
  where mission.id = locked_run.mission_id;

  return query
  select
    locked_run.id,
    passed_evaluation.id,
    unlocked_reward.id,
    locked_run.score,
    locked_run.stars,
    run_mission.reward_experience_points,
    false;
end;
$$;


--
-- Name: FUNCTION complete_mission_run_unchecked(_mission_run_id uuid, _mission_evaluation_id uuid, _mission_reward_id uuid, _expected_owner_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.complete_mission_run_unchecked(_mission_run_id uuid, _mission_evaluation_id uuid, _mission_reward_id uuid, _expected_owner_id uuid) IS 'Server-only atomic transition from evaluated mission run to XP, daily stats, and one private image reward unlock.';


--
-- Name: create_artifact_with_version(uuid, uuid, uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_artifact_with_version(_artifact_id uuid, _artifact_version_id uuid, _expected_owner_id uuid, _conversation_id uuid, _payload jsonb) RETURNS TABLE(artifact_id uuid, artifact_version_id uuid, version_number integer, status text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  desired_status text := coalesce(nullif(_payload ->> 'status', ''), 'draft');
  source_message uuid := nullif(_payload ->> 'sourceMessageId', '')::uuid;
  storage_bucket text := nullif(_payload ->> 'storageBucket', '');
  storage_path text := nullif(_payload ->> 'storagePath', '');
begin
  if _artifact_id is null or _artifact_version_id is null
    or _expected_owner_id is null or _conversation_id is null
    or _payload is null or jsonb_typeof(_payload) <> 'object'
    or _payload ->> 'kind' not in ('text', 'code', 'image', 'sheet')
    or char_length(coalesce(_payload ->> 'title', '')) not between 1 and 200
    or desired_status not in ('draft', 'published')
  then
    raise exception using errcode = '22023', message = 'invalid artifact create request';
  end if;
  if not exists (
    select 1 from public.conversations as conversation
    where conversation.id = _conversation_id
      and conversation.owner_id = _expected_owner_id
      and conversation.status <> 'deleted'
  ) then
    raise exception using errcode = '42501', message = 'artifact conversation owner mismatch';
  end if;
  if source_message is not null and not exists (
    select 1 from public.messages as message
    where message.id = source_message
      and message.conversation_id = _conversation_id
  ) then
    raise exception using errcode = '23514', message = 'artifact source message mismatch';
  end if;
  if _payload ->> 'kind' = 'image' and (
    (_payload -> 'contentJson') ? 'imageUrl'
    or (storage_bucket is not null and storage_bucket <> 'artifact-images')
  ) then
    raise exception using errcode = '23514', message = 'image artifacts require private immutable storage references';
  end if;
  if nullif(_payload ->> 'contentText', '') is null
    and _payload -> 'contentJson' is null
    and (storage_bucket is null or storage_path is null)
  then
    raise exception using errcode = '23514', message = 'artifact version content is required';
  end if;
  if storage_bucket is not null and (
    storage_bucket not in ('chat-attachments', 'artifact-images')
    or split_part(storage_path, '/', 1) <> _expected_owner_id::text
    or (storage_bucket = 'artifact-images' and (split_part(storage_path, '/', 2) <> _artifact_id::text or _payload ->> 'kind' <> 'image'))
    or not exists (
      select 1 from storage.objects as object
      where object.bucket_id = storage_bucket and object.name = storage_path
    )
  ) then
    raise exception using errcode = '23514', message = 'invalid artifact storage object';
  end if;

  insert into public.artifacts (
    id, conversation_id, owner_id, kind, title, status
  ) values (
    _artifact_id, _conversation_id, _expected_owner_id,
    _payload ->> 'kind', _payload ->> 'title', 'draft'
  );

  insert into public.artifact_versions (
    id, artifact_id, version_number, source_message_id,
    content_text, content_json, storage_bucket, storage_path, created_by
  ) values (
    _artifact_version_id, _artifact_id, 1, source_message,
    nullif(_payload ->> 'contentText', ''), _payload -> 'contentJson',
    storage_bucket, storage_path, _expected_owner_id
  );

  update public.artifacts as artifact
  set current_version_id = _artifact_version_id, status = desired_status
  where artifact.id = _artifact_id;

  if desired_status = 'published' then
    update public.artifact_versions as version
    set published_at = timezone('utc', now())
    where version.id = _artifact_version_id;
  end if;

  return query select _artifact_id, _artifact_version_id, 1, desired_status;
end;
$$;


--
-- Name: create_character_report(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_character_report(_character_id uuid, _expected_reporter_id uuid, _reason text, _details text DEFAULT ''::text) RETURNS TABLE(report_id uuid, character_id uuid, status text, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
#variable_conflict use_column
declare
  reported_character public.characters%rowtype;
  created_report public.character_reports%rowtype;
begin
  if _character_id is null or _expected_reporter_id is null then
    raise exception using errcode = '22023', message = 'invalid character report request';
  end if;
  if _reason not in (
    'spam', 'unsafe', 'sexual', 'hate', 'harassment',
    'impersonation', 'copyright', 'other'
  ) or char_length(coalesce(_details, '')) > 2000 then
    raise exception using errcode = '22023', message = 'invalid character report reason';
  end if;
  if not exists (
    select 1 from auth.users as auth_user
    where auth_user.id = _expected_reporter_id
  ) then
    raise exception using errcode = '42501', message = 'reporter does not exist';
  end if;

  select * into reported_character
  from public.characters as character
  where character.id = _character_id
    and character.status = 'published'
    and character.visibility in ('public', 'unlisted')
  for share;

  if not found then
    raise exception using errcode = 'P0002', message = 'reportable character not found';
  end if;
  if reported_character.owner_id is not distinct from _expected_reporter_id then
    raise exception using errcode = '42501', message = 'owners cannot report their own character';
  end if;

  insert into public.character_reports (
    reporter_id,
    character_id,
    reason,
    details
  )
  values (
    _expected_reporter_id,
    reported_character.id,
    _reason,
    coalesce(_details, '')
  )
  on conflict (reporter_id, character_id)
    where status in ('pending', 'reviewing')
  do update set
    reason = excluded.reason,
    details = excluded.details,
    updated_at = timezone('utc', now())
  returning * into created_report;

  return query
  select
    created_report.id,
    created_report.character_id,
    created_report.status,
    created_report.created_at;
end;
$$;


--
-- Name: create_character_version(uuid, uuid, uuid, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_character_version(_character_id uuid, _character_version_id uuid, _expected_owner_id uuid, _expected_version_number integer, _payload jsonb) RETURNS TABLE(character_id uuid, character_version_id uuid, version_number integer, status text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  locked_character public.characters%rowtype;
  current_version_number integer;
  next_version_number integer;
  desired_status text := coalesce(nullif(_payload ->> 'publishStatus', ''), 'draft');
  desired_visibility text := coalesce(nullif(_payload ->> 'visibility', ''), 'private');
  asset_payload jsonb := _payload -> 'asset';
  tag_value text;
begin
  if _expected_owner_id is null
    or _character_id is null
    or _character_version_id is null
    or _expected_version_number is null
    or _expected_version_number < 1
    or _payload is null
    or jsonb_typeof(_payload) <> 'object'
  then
    raise exception using errcode = '22023', message = 'invalid character version request';
  end if;

  if desired_status not in ('draft', 'published')
    or desired_visibility not in ('private', 'public')
    or coalesce(jsonb_typeof(_payload -> 'personalityTraits'), 'array') <> 'array'
    or coalesce(jsonb_typeof(_payload -> 'personaGoals'), 'array') <> 'array'
    or coalesce(jsonb_typeof(_payload -> 'learningGoals'), 'array') <> 'array'
    or coalesce(jsonb_typeof(_payload -> 'tags'), 'array') <> 'array'
    or coalesce(jsonb_typeof(_payload -> 'voiceConfig'), 'object') <> 'object'
    or coalesce(jsonb_typeof(_payload -> 'conversationRules'), 'object') <> 'object'
  then
    raise exception using errcode = '22023', message = 'invalid character version payload';
  end if;

  select *
  into locked_character
  from public.characters as character
  where character.id = _character_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'character not found';
  end if;
  if locked_character.owner_id is distinct from _expected_owner_id then
    raise exception using errcode = '42501', message = 'character owner mismatch';
  end if;
  if locked_character.status = 'review' then
    raise exception using errcode = '42501', message = 'character is under moderation review';
  end if;
  if locked_character.current_version_id is null then
    raise exception using errcode = '23514', message = 'character has no active version';
  end if;

  select version.version_number
  into current_version_number
  from public.character_versions as version
  where version.id = locked_character.current_version_id
    and version.character_id = locked_character.id;

  if current_version_number is null then
    raise exception using errcode = '23514', message = 'character current version is invalid';
  end if;
  if current_version_number <> _expected_version_number then
    raise exception using errcode = 'PT409', message = 'character version conflict';
  end if;

  select coalesce(max(version.version_number), 0) + 1
  into next_version_number
  from public.character_versions as version
  where version.character_id = locked_character.id;

  if asset_payload is not null and jsonb_typeof(asset_payload) = 'object' then
    if asset_payload ->> 'storageBucket' not in ('character-public', 'character-private')
      or split_part(asset_payload ->> 'storagePath', '/', 1) <> _expected_owner_id::text
      or (
        asset_payload ->> 'accessLevel' = 'public'
        and asset_payload ->> 'storageBucket' <> 'character-public'
      )
      or (
        asset_payload ->> 'accessLevel' <> 'public'
        and asset_payload ->> 'storageBucket' <> 'character-private'
      )
      or not exists (
        select 1
        from storage.objects as object
        where object.bucket_id = asset_payload ->> 'storageBucket'
          and object.name = asset_payload ->> 'storagePath'
      )
    then
      raise exception using errcode = '23514', message = 'invalid character storage asset';
    end if;
  end if;

  if desired_status = 'published'
    and not (
      (
        asset_payload is not null
        and jsonb_typeof(asset_payload) = 'object'
        and (
          (desired_visibility = 'public' and asset_payload ->> 'accessLevel' = 'public')
          or (desired_visibility <> 'public' and asset_payload ->> 'accessLevel' = 'owner')
        )
      )
      or exists (
        select 1
        from public.character_assets as asset
        where asset.character_id = locked_character.id
          and asset.asset_type = 'avatar'
          and asset.is_primary
          and (
            (desired_visibility = 'public' and asset.access_level = 'public')
            or (desired_visibility <> 'public' and asset.access_level = 'owner')
          )
      )
    )
  then
    raise exception using errcode = '23514', message = 'published characters require a compatible primary avatar';
  end if;

  insert into public.character_versions (
    id,
    character_id,
    version_number,
    change_summary,
    personality_summary,
    personality_traits,
    persona_goals,
    learning_goals,
    backstory,
    greeting,
    example_dialogues,
    voice_config,
    image_prompt,
    locale,
    created_by
  )
  values (
    _character_version_id,
    locked_character.id,
    next_version_number,
    coalesce(nullif(_payload ->> 'changeSummary', ''), 'Creator update'),
    _payload ->> 'personalitySummary',
    coalesce(_payload -> 'personalityTraits', '[]'::jsonb),
    _payload -> 'personaGoals',
    _payload -> 'learningGoals',
    coalesce(_payload ->> 'backstory', ''),
    _payload ->> 'greeting',
    coalesce(_payload -> 'exampleDialogues', '[]'::jsonb),
    coalesce(_payload -> 'voiceConfig', '{}'::jsonb),
    coalesce(_payload ->> 'imagePrompt', ''),
    coalesce(nullif(_payload ->> 'locale', ''), 'en-US'),
    _expected_owner_id
  );

  insert into public.character_version_instructions (
    character_version_id,
    system_prompt,
    safety_instructions,
    conversation_rules,
    model_config
  )
  values (
    _character_version_id,
    _payload ->> 'systemPrompt',
    coalesce(_payload ->> 'safetyInstructions', ''),
    coalesce(_payload -> 'conversationRules', '{}'::jsonb),
    coalesce(_payload -> 'modelConfig', '{}'::jsonb)
  );

  delete from public.character_tags as tag
  where tag.character_id = locked_character.id;

  for tag_value in
    select distinct value
    from jsonb_array_elements_text(coalesce(_payload -> 'tags', '[]'::jsonb)) as tag(value)
    where char_length(value) between 1 and 40
  loop
    insert into public.character_tags (character_id, tag)
    values (locked_character.id, tag_value)
    on conflict do nothing;
  end loop;

  if asset_payload is not null and jsonb_typeof(asset_payload) = 'object' then
    insert into public.character_assets (
      id,
      character_id,
      character_version_id,
      asset_type,
      access_level,
      storage_bucket,
      storage_path,
      mime_type,
      alt_text,
      is_primary,
      metadata,
      created_by
    )
    values (
      (asset_payload ->> 'id')::uuid,
      locked_character.id,
      _character_version_id,
      'avatar',
      asset_payload ->> 'accessLevel',
      asset_payload ->> 'storageBucket',
      asset_payload ->> 'storagePath',
      asset_payload ->> 'mimeType',
      coalesce(asset_payload ->> 'altText', _payload ->> 'name'),
      true,
      coalesce(asset_payload -> 'metadata', '{}'::jsonb),
      _expected_owner_id
    );
  end if;

  update public.characters as character
  set
    slug = _payload ->> 'slug',
    name = _payload ->> 'name',
    tagline = coalesce(_payload ->> 'tagline', ''),
    description = coalesce(_payload ->> 'description', ''),
    visibility = desired_visibility,
    current_version_id = _character_version_id,
    status = desired_status,
    published_at = case
      when desired_status = 'published'
        then coalesce(character.published_at, timezone('utc', now()))
      else character.published_at
    end
  where character.id = locked_character.id;

  if desired_status = 'published' then
    update public.character_versions as version
    set published_at = timezone('utc', now())
    where version.id = _character_version_id;
  end if;

  return query
  select locked_character.id, _character_version_id, next_version_number, desired_status;
end;
$$;


--
-- Name: create_character_with_version(uuid, uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_character_with_version(_character_id uuid, _character_version_id uuid, _expected_owner_id uuid, _payload jsonb) RETURNS TABLE(character_id uuid, character_version_id uuid, status text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  desired_status text := coalesce(nullif(_payload ->> 'publishStatus', ''), 'draft');
  desired_visibility text := coalesce(nullif(_payload ->> 'visibility', ''), 'private');
  asset_payload jsonb := _payload -> 'asset';
  tag_value text;
begin
  if _expected_owner_id is null
    or _character_id is null
    or _character_version_id is null
    or _payload is null
    or jsonb_typeof(_payload) <> 'object'
  then
    raise exception using errcode = '22023', message = 'invalid character create request';
  end if;

  if desired_status not in ('draft', 'published')
    or desired_visibility not in ('private', 'public')
  then
    raise exception using errcode = '22023', message = 'invalid character publication state';
  end if;

  if desired_status = 'published'
    and (asset_payload is null or jsonb_typeof(asset_payload) <> 'object')
  then
    raise exception using errcode = '23514', message = 'published characters require an avatar';
  end if;

  if coalesce(jsonb_typeof(_payload -> 'personalityTraits'), 'array') <> 'array'
    or coalesce(jsonb_typeof(_payload -> 'personaGoals'), 'array') <> 'array'
    or coalesce(jsonb_typeof(_payload -> 'learningGoals'), 'array') <> 'array'
    or coalesce(jsonb_typeof(_payload -> 'tags'), 'array') <> 'array'
    or coalesce(jsonb_typeof(_payload -> 'voiceConfig'), 'object') <> 'object'
    or coalesce(jsonb_typeof(_payload -> 'conversationRules'), 'object') <> 'object'
  then
    raise exception using errcode = '22023', message = 'invalid character version JSON';
  end if;

  insert into public.characters (
    id,
    owner_id,
    slug,
    name,
    tagline,
    description,
    visibility,
    status,
    age_rating
  )
  values (
    _character_id,
    _expected_owner_id,
    _payload ->> 'slug',
    _payload ->> 'name',
    coalesce(_payload ->> 'tagline', ''),
    coalesce(_payload ->> 'description', ''),
    desired_visibility,
    'draft',
    'everyone'
  );

  insert into public.character_versions (
    id,
    character_id,
    version_number,
    change_summary,
    personality_summary,
    personality_traits,
    persona_goals,
    learning_goals,
    backstory,
    greeting,
    example_dialogues,
    voice_config,
    image_prompt,
    locale,
    created_by
  )
  values (
    _character_version_id,
    _character_id,
    1,
    'Initial creator version',
    _payload ->> 'personalitySummary',
    coalesce(_payload -> 'personalityTraits', '[]'::jsonb),
    _payload -> 'personaGoals',
    _payload -> 'learningGoals',
    coalesce(_payload ->> 'backstory', ''),
    _payload ->> 'greeting',
    coalesce(_payload -> 'exampleDialogues', '[]'::jsonb),
    coalesce(_payload -> 'voiceConfig', '{}'::jsonb),
    coalesce(_payload ->> 'imagePrompt', ''),
    coalesce(nullif(_payload ->> 'locale', ''), 'en-US'),
    _expected_owner_id
  );

  insert into public.character_version_instructions (
    character_version_id,
    system_prompt,
    safety_instructions,
    conversation_rules,
    model_config
  )
  values (
    _character_version_id,
    _payload ->> 'systemPrompt',
    coalesce(_payload ->> 'safetyInstructions', ''),
    coalesce(_payload -> 'conversationRules', '{}'::jsonb),
    coalesce(_payload -> 'modelConfig', '{}'::jsonb)
  );

  for tag_value in
    select distinct value
    from jsonb_array_elements_text(coalesce(_payload -> 'tags', '[]'::jsonb)) as tag(value)
    where char_length(value) between 1 and 40
  loop
    insert into public.character_tags (character_id, tag)
    values (_character_id, tag_value)
    on conflict do nothing;
  end loop;

  if asset_payload is not null and jsonb_typeof(asset_payload) = 'object' then
    if asset_payload ->> 'storageBucket' not in ('character-public', 'character-private')
      or split_part(asset_payload ->> 'storagePath', '/', 1) <> _expected_owner_id::text
      or (
        asset_payload ->> 'accessLevel' = 'public'
        and asset_payload ->> 'storageBucket' <> 'character-public'
      )
      or (
        asset_payload ->> 'accessLevel' <> 'public'
        and asset_payload ->> 'storageBucket' <> 'character-private'
      )
      or not exists (
        select 1
        from storage.objects as object
        where object.bucket_id = asset_payload ->> 'storageBucket'
          and object.name = asset_payload ->> 'storagePath'
      )
    then
      raise exception using errcode = '23514', message = 'invalid character storage asset';
    end if;

    insert into public.character_assets (
      id,
      character_id,
      character_version_id,
      asset_type,
      access_level,
      storage_bucket,
      storage_path,
      mime_type,
      alt_text,
      is_primary,
      metadata,
      created_by
    )
    values (
      (asset_payload ->> 'id')::uuid,
      _character_id,
      _character_version_id,
      'avatar',
      asset_payload ->> 'accessLevel',
      asset_payload ->> 'storageBucket',
      asset_payload ->> 'storagePath',
      asset_payload ->> 'mimeType',
      coalesce(asset_payload ->> 'altText', _payload ->> 'name'),
      true,
      coalesce(asset_payload -> 'metadata', '{}'::jsonb),
      _expected_owner_id
    );
  end if;

  update public.characters as character
  set
    current_version_id = _character_version_id,
    status = desired_status,
    published_at = case
      when desired_status = 'published' then timezone('utc', now())
      else null
    end
  where character.id = _character_id;

  if desired_status = 'published' then
    update public.character_versions as version
    set published_at = timezone('utc', now())
    where version.id = _character_version_id;
  end if;

  return query
  select _character_id, _character_version_id, desired_status;
end;
$$;


--
-- Name: create_mission_version(uuid, uuid, uuid, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_mission_version(_mission_id uuid, _mission_version_id uuid, _expected_owner_id uuid, _expected_version_number integer, _payload jsonb) RETURNS TABLE(mission_id uuid, mission_version_id uuid, version_number integer, status text, mission_reward_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  locked_mission public.missions%rowtype;
  recommended_character public.characters%rowtype;
  current_version_number integer;
  next_version_number integer;
  desired_status text := coalesce(nullif(_payload ->> 'publishStatus', ''), 'draft');
  desired_visibility text := coalesce(nullif(_payload ->> 'visibility', ''), 'private');
  asset_payload jsonb := _payload -> 'rewardAsset';
  previous_reward public.mission_rewards%rowtype;
  step_record record;
  created_reward_id uuid;
begin
  if _expected_owner_id is null
    or _mission_id is null
    or _mission_version_id is null
    or _expected_version_number is null
    or _expected_version_number < 1
    or _payload is null
    or jsonb_typeof(_payload) <> 'object'
  then
    raise exception using errcode = '22023', message = 'invalid mission version request';
  end if;

  if desired_status not in ('draft', 'published')
    or desired_visibility not in ('private', 'public')
    or coalesce(jsonb_typeof(_payload -> 'learningGoals'), 'array') <> 'array'
    or coalesce(jsonb_typeof(_payload -> 'targetVocabulary'), 'array') <> 'array'
    or coalesce(jsonb_typeof(_payload -> 'targetGrammar'), 'array') <> 'array'
    or coalesce(jsonb_typeof(_payload -> 'steps'), 'array') <> 'array'
    or coalesce(jsonb_typeof(_payload -> 'evaluatorConfig'), 'object') <> 'object'
  then
    raise exception using errcode = '22023', message = 'invalid mission version payload';
  end if;

  select *
  into locked_mission
  from public.missions as mission
  where mission.id = _mission_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'mission not found';
  end if;
  if locked_mission.owner_id is distinct from _expected_owner_id then
    raise exception using errcode = '42501', message = 'mission owner mismatch';
  end if;
  if locked_mission.status = 'review' then
    raise exception using errcode = '42501', message = 'mission is under moderation review';
  end if;
  if locked_mission.current_version_id is null then
    raise exception using errcode = '23514', message = 'mission has no active version';
  end if;

  select version.version_number
  into current_version_number
  from public.mission_versions as version
  where version.id = locked_mission.current_version_id
    and version.mission_id = locked_mission.id;

  if current_version_number is null then
    raise exception using errcode = '23514', message = 'mission current version is invalid';
  end if;
  if current_version_number <> _expected_version_number then
    raise exception using errcode = 'PT409', message = 'mission version conflict';
  end if;

  select *
  into recommended_character
  from public.characters as character
  where character.id = (_payload ->> 'recommendedCharacterId')::uuid
  for share;

  if not found
    or recommended_character.current_version_id is null
    or not exists (
      select 1
      from public.mission_characters as assignment
      where assignment.mission_id = locked_mission.id
        and assignment.character_id = recommended_character.id
        and assignment.is_recommended
    )
  then
    raise exception using errcode = '23514', message = 'mission recommended character cannot change between versions';
  end if;

  select *
  into previous_reward
  from public.mission_rewards as reward
  where reward.mission_id = locked_mission.id
    and reward.mission_version_id = locked_mission.current_version_id
    and reward.is_active
  order by reward.sort_order, reward.created_at
  limit 1;

  if desired_status = 'published'
    and (asset_payload is null or jsonb_typeof(asset_payload) <> 'object')
    and previous_reward.id is null
  then
    raise exception using errcode = '23514', message = 'published missions require a reward image';
  end if;

  if asset_payload is not null and jsonb_typeof(asset_payload) = 'object' then
    if asset_payload ->> 'storageBucket' <> 'character-private'
      or asset_payload ->> 'accessLevel' <> 'reward'
      or split_part(asset_payload ->> 'storagePath', '/', 1) <> _expected_owner_id::text
      or not exists (
        select 1
        from storage.objects as object
        where object.bucket_id = asset_payload ->> 'storageBucket'
          and object.name = asset_payload ->> 'storagePath'
      )
    then
      raise exception using errcode = '23514', message = 'invalid mission reward storage asset';
    end if;
  end if;

  select coalesce(max(version.version_number), 0) + 1
  into next_version_number
  from public.mission_versions as version
  where version.mission_id = locked_mission.id;

  insert into public.mission_versions (
    id,
    mission_id,
    version_number,
    change_summary,
    learning_goals,
    scenario_context,
    learner_role,
    character_role,
    opening_instruction,
    target_vocabulary,
    target_grammar,
    pass_score,
    maximum_turns,
    locale,
    created_by
  )
  values (
    _mission_version_id,
    locked_mission.id,
    next_version_number,
    coalesce(nullif(_payload ->> 'changeSummary', ''), 'Creator update'),
    _payload -> 'learningGoals',
    _payload ->> 'scenarioContext',
    coalesce(nullif(_payload ->> 'learnerRole', ''), 'English learner'),
    coalesce(nullif(_payload ->> 'characterRole', ''), recommended_character.name),
    _payload ->> 'openingInstruction',
    coalesce(_payload -> 'targetVocabulary', '[]'::jsonb),
    coalesce(_payload -> 'targetGrammar', '[]'::jsonb),
    coalesce((_payload ->> 'passScore')::numeric, 70),
    coalesce((_payload ->> 'maximumTurns')::integer, 20),
    coalesce(nullif(_payload ->> 'locale', ''), 'en-US'),
    _expected_owner_id
  );

  insert into public.mission_version_instructions (
    mission_version_id,
    director_prompt,
    evaluator_prompt,
    safety_instructions,
    evaluator_config
  )
  values (
    _mission_version_id,
    _payload ->> 'directorPrompt',
    _payload ->> 'evaluatorPrompt',
    coalesce(_payload ->> 'safetyInstructions', ''),
    coalesce(_payload -> 'evaluatorConfig', '{}'::jsonb)
  );

  for step_record in
    select step.value, step.ordinality
    from jsonb_array_elements(_payload -> 'steps') with ordinality as step(value, ordinality)
  loop
    insert into public.mission_steps (
      mission_version_id,
      step_order,
      title,
      objective,
      learner_goal,
      character_instruction,
      success_criteria,
      hints,
      vocabulary,
      is_optional
    )
    values (
      _mission_version_id,
      step_record.ordinality,
      coalesce(nullif(step_record.value ->> 'title', ''), step_record.value ->> 'label'),
      step_record.value ->> 'label',
      coalesce(nullif(step_record.value ->> 'learnerGoal', ''), step_record.value ->> 'label'),
      coalesce(nullif(step_record.value ->> 'characterInstruction', ''), 'Guide the learner without completing the step for them.'),
      coalesce(
        step_record.value -> 'successCriteria',
        jsonb_build_array(step_record.value ->> 'label')
      ),
      case
        when nullif(step_record.value ->> 'hint', '') is null then '[]'::jsonb
        else jsonb_build_array(step_record.value ->> 'hint')
      end,
      coalesce(step_record.value -> 'vocabulary', '[]'::jsonb),
      coalesce((step_record.value ->> 'optional')::boolean, false)
    );
  end loop;

  if not exists (
    select 1
    from public.mission_steps as step
    where step.mission_version_id = _mission_version_id
      and not step.is_optional
  ) then
    raise exception using errcode = '23514', message = 'mission requires at least one required step';
  end if;

  if asset_payload is not null and jsonb_typeof(asset_payload) = 'object' then
    insert into public.character_assets (
      id,
      character_id,
      character_version_id,
      asset_type,
      access_level,
      storage_bucket,
      storage_path,
      mime_type,
      alt_text,
      is_primary,
      metadata,
      created_by
    )
    values (
      (asset_payload ->> 'id')::uuid,
      recommended_character.id,
      recommended_character.current_version_id,
      'reward',
      'reward',
      'character-private',
      asset_payload ->> 'storagePath',
      asset_payload ->> 'mimeType',
      coalesce(asset_payload ->> 'altText', _payload ->> 'rewardTitle'),
      false,
      coalesce(asset_payload -> 'metadata', '{}'::jsonb),
      _expected_owner_id
    );

    created_reward_id := coalesce(
      nullif(asset_payload ->> 'missionRewardId', '')::uuid,
      gen_random_uuid()
    );

    insert into public.mission_rewards (
      id,
      mission_id,
      mission_version_id,
      character_asset_id,
      minimum_score,
      minimum_stars,
      is_active
    )
    values (
      created_reward_id,
      locked_mission.id,
      _mission_version_id,
      (asset_payload ->> 'id')::uuid,
      coalesce((_payload ->> 'passScore')::numeric, 70),
      1,
      true
    );
  elsif previous_reward.id is not null then
    created_reward_id := gen_random_uuid();
    insert into public.mission_rewards (
      id,
      mission_id,
      mission_version_id,
      character_asset_id,
      minimum_score,
      minimum_stars,
      is_active,
      sort_order
    )
    values (
      created_reward_id,
      locked_mission.id,
      _mission_version_id,
      previous_reward.character_asset_id,
      coalesce((_payload ->> 'passScore')::numeric, previous_reward.minimum_score),
      previous_reward.minimum_stars,
      true,
      previous_reward.sort_order
    );
  end if;

  update public.missions as mission
  set
    slug = _payload ->> 'slug',
    title = _payload ->> 'title',
    summary = coalesce(_payload ->> 'summary', ''),
    scenario_category = _payload ->> 'scenarioCategory',
    difficulty = coalesce(nullif(_payload ->> 'difficulty', ''), 'A1'),
    estimated_minutes = coalesce((_payload ->> 'estimatedMinutes')::integer, 10),
    visibility = desired_visibility,
    current_version_id = _mission_version_id,
    status = desired_status,
    published_at = case
      when desired_status = 'published'
        then coalesce(mission.published_at, timezone('utc', now()))
      else mission.published_at
    end
  where mission.id = locked_mission.id;

  if desired_status = 'published' then
    update public.mission_versions as version
    set published_at = timezone('utc', now())
    where version.id = _mission_version_id;
  end if;

  return query
  select locked_mission.id, _mission_version_id, next_version_number, desired_status, created_reward_id;
end;
$$;


--
-- Name: create_mission_with_version(uuid, uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_mission_with_version(_mission_id uuid, _mission_version_id uuid, _expected_owner_id uuid, _payload jsonb) RETURNS TABLE(mission_id uuid, mission_version_id uuid, status text, mission_reward_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  desired_status text := coalesce(nullif(_payload ->> 'publishStatus', ''), 'draft');
  desired_visibility text := coalesce(nullif(_payload ->> 'visibility', ''), 'private');
  recommended_character public.characters%rowtype;
  asset_payload jsonb := _payload -> 'rewardAsset';
  step_record record;
  created_reward_id uuid;
begin
  if _expected_owner_id is null
    or _mission_id is null
    or _mission_version_id is null
    or _payload is null
    or jsonb_typeof(_payload) <> 'object'
  then
    raise exception using errcode = '22023', message = 'invalid mission create request';
  end if;

  if desired_status not in ('draft', 'published')
    or desired_visibility not in ('private', 'public')
    or coalesce(jsonb_typeof(_payload -> 'learningGoals'), 'array') <> 'array'
    or coalesce(jsonb_typeof(_payload -> 'targetVocabulary'), 'array') <> 'array'
    or coalesce(jsonb_typeof(_payload -> 'targetGrammar'), 'array') <> 'array'
    or coalesce(jsonb_typeof(_payload -> 'steps'), 'array') <> 'array'
    or coalesce(jsonb_typeof(_payload -> 'evaluatorConfig'), 'object') <> 'object'
  then
    raise exception using errcode = '22023', message = 'invalid mission publication payload';
  end if;

  select *
  into recommended_character
  from public.characters as character
  where character.id = (_payload ->> 'recommendedCharacterId')::uuid
  for share;

  if not found
    or recommended_character.current_version_id is null
    or not (
      recommended_character.owner_id = _expected_owner_id
      or recommended_character.owner_id is null
      or (
        recommended_character.status = 'published'
        and recommended_character.visibility = 'public'
      )
    )
  then
    raise exception using errcode = '42501', message = 'recommended character is unavailable';
  end if;

  if desired_status = 'published'
    and (asset_payload is null or jsonb_typeof(asset_payload) <> 'object')
  then
    raise exception using errcode = '23514', message = 'published missions require a reward image';
  end if;

  insert into public.missions (
    id,
    owner_id,
    slug,
    title,
    summary,
    scenario_category,
    difficulty,
    estimated_minutes,
    visibility,
    status,
    reward_experience_points
  )
  values (
    _mission_id,
    _expected_owner_id,
    _payload ->> 'slug',
    _payload ->> 'title',
    coalesce(_payload ->> 'summary', ''),
    _payload ->> 'scenarioCategory',
    coalesce(nullif(_payload ->> 'difficulty', ''), 'A1'),
    coalesce((_payload ->> 'estimatedMinutes')::integer, 10),
    desired_visibility,
    'draft',
    coalesce((_payload ->> 'rewardExperiencePoints')::integer, 120)
  );

  insert into public.mission_versions (
    id,
    mission_id,
    version_number,
    change_summary,
    learning_goals,
    scenario_context,
    learner_role,
    character_role,
    opening_instruction,
    target_vocabulary,
    target_grammar,
    pass_score,
    maximum_turns,
    locale,
    created_by
  )
  values (
    _mission_version_id,
    _mission_id,
    1,
    'Initial creator version',
    _payload -> 'learningGoals',
    _payload ->> 'scenarioContext',
    coalesce(nullif(_payload ->> 'learnerRole', ''), 'English learner'),
    coalesce(nullif(_payload ->> 'characterRole', ''), recommended_character.name),
    _payload ->> 'openingInstruction',
    coalesce(_payload -> 'targetVocabulary', '[]'::jsonb),
    coalesce(_payload -> 'targetGrammar', '[]'::jsonb),
    coalesce((_payload ->> 'passScore')::numeric, 70),
    coalesce((_payload ->> 'maximumTurns')::integer, 20),
    coalesce(nullif(_payload ->> 'locale', ''), 'en-US'),
    _expected_owner_id
  );

  insert into public.mission_version_instructions (
    mission_version_id,
    director_prompt,
    evaluator_prompt,
    safety_instructions,
    evaluator_config
  )
  values (
    _mission_version_id,
    _payload ->> 'directorPrompt',
    _payload ->> 'evaluatorPrompt',
    coalesce(_payload ->> 'safetyInstructions', ''),
    coalesce(_payload -> 'evaluatorConfig', '{}'::jsonb)
  );

  for step_record in
    select step.value, step.ordinality
    from jsonb_array_elements(_payload -> 'steps') with ordinality as step(value, ordinality)
  loop
    insert into public.mission_steps (
      mission_version_id,
      step_order,
      title,
      objective,
      learner_goal,
      character_instruction,
      success_criteria,
      hints,
      vocabulary,
      is_optional
    )
    values (
      _mission_version_id,
      step_record.ordinality,
      coalesce(nullif(step_record.value ->> 'title', ''), step_record.value ->> 'label'),
      step_record.value ->> 'label',
      coalesce(nullif(step_record.value ->> 'learnerGoal', ''), step_record.value ->> 'label'),
      coalesce(nullif(step_record.value ->> 'characterInstruction', ''), 'Guide the learner without completing the step for them.'),
      coalesce(
        step_record.value -> 'successCriteria',
        jsonb_build_array(step_record.value ->> 'label')
      ),
      case
        when nullif(step_record.value ->> 'hint', '') is null then '[]'::jsonb
        else jsonb_build_array(step_record.value ->> 'hint')
      end,
      coalesce(step_record.value -> 'vocabulary', '[]'::jsonb),
      coalesce((step_record.value ->> 'optional')::boolean, false)
    );
  end loop;

  if not exists (
    select 1
    from public.mission_steps as step
    where step.mission_version_id = _mission_version_id
      and not step.is_optional
  ) then
    raise exception using errcode = '23514', message = 'mission requires at least one required step';
  end if;

  insert into public.mission_characters (
    mission_id,
    character_id,
    is_recommended,
    role_override
  )
  values (
    _mission_id,
    recommended_character.id,
    true,
    nullif(_payload ->> 'characterRole', '')
  );

  if asset_payload is not null and jsonb_typeof(asset_payload) = 'object' then
    if asset_payload ->> 'storageBucket' <> 'character-private'
      or asset_payload ->> 'accessLevel' <> 'reward'
      or split_part(asset_payload ->> 'storagePath', '/', 1) <> _expected_owner_id::text
      or not exists (
        select 1
        from storage.objects as object
        where object.bucket_id = asset_payload ->> 'storageBucket'
          and object.name = asset_payload ->> 'storagePath'
      )
    then
      raise exception using errcode = '23514', message = 'invalid mission reward storage asset';
    end if;

    insert into public.character_assets (
      id,
      character_id,
      character_version_id,
      asset_type,
      access_level,
      storage_bucket,
      storage_path,
      mime_type,
      alt_text,
      is_primary,
      metadata,
      created_by
    )
    values (
      (asset_payload ->> 'id')::uuid,
      recommended_character.id,
      recommended_character.current_version_id,
      'reward',
      'reward',
      'character-private',
      asset_payload ->> 'storagePath',
      asset_payload ->> 'mimeType',
      coalesce(asset_payload ->> 'altText', _payload ->> 'rewardTitle'),
      false,
      coalesce(asset_payload -> 'metadata', '{}'::jsonb),
      _expected_owner_id
    );

    created_reward_id := coalesce(
      nullif(asset_payload ->> 'missionRewardId', '')::uuid,
      gen_random_uuid()
    );

    insert into public.mission_rewards (
      id,
      mission_id,
      mission_version_id,
      character_asset_id,
      minimum_score,
      minimum_stars,
      is_active
    )
    values (
      created_reward_id,
      _mission_id,
      _mission_version_id,
      (asset_payload ->> 'id')::uuid,
      coalesce((_payload ->> 'passScore')::numeric, 70),
      1,
      true
    );
  end if;

  update public.missions as mission
  set
    current_version_id = _mission_version_id,
    status = desired_status,
    published_at = case
      when desired_status = 'published' then timezone('utc', now())
      else null
    end
  where mission.id = _mission_id;

  if desired_status = 'published' then
    update public.mission_versions as version
    set published_at = timezone('utc', now())
    where version.id = _mission_version_id;
  end if;

  return query
  select _mission_id, _mission_version_id, desired_status, created_reward_id;
end;
$$;


--
-- Name: delete_owned_artifact(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_owned_artifact(_artifact_id uuid, _expected_owner_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  deleted_id uuid;
begin
  delete from public.artifacts as artifact
  where artifact.id = _artifact_id
    and artifact.owner_id = _expected_owner_id
  returning artifact.id into deleted_id;
  if deleted_id is null then
    raise exception using errcode = 'P0002', message = 'artifact not found';
  end if;
  return deleted_id;
end;
$$;


--
-- Name: finish_chat_generation(uuid, uuid, uuid, uuid, text, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finish_chat_generation(_conversation_id uuid, _owner_id uuid, _assistant_message_id uuid, _request_id uuid, _status text, _parts jsonb, _finish_reason text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: finish_chat_generation_base(uuid, uuid, uuid, uuid, text, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finish_chat_generation_base(_conversation_id uuid, _owner_id uuid, _assistant_message_id uuid, _request_id uuid, _status text, _parts jsonb, _finish_reason text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
    raise exception using errcode = 'PT409', message = 'stale generation completion';
  end if;
  if generation.status <> 'running' then
    if generation.status = _status and exists (select 1 from public.messages m
      where m.id = _assistant_message_id and m.parts = _parts) then return _assistant_message_id; end if;
    raise exception using errcode = 'PT409', message = 'generation already finalized';
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


--
-- Name: guard_mission_prerequisites(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_mission_prerequisites() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  settings jsonb;
  required_items jsonb;
  item jsonb;
  identifier text;
begin
  if tg_op = 'UPDATE' then
    if new.owner_id is not distinct from old.owner_id
      and new.mission_id is not distinct from old.mission_id
      and new.mission_version_id is not distinct from old.mission_version_id then
      return new;
    end if;
  end if;
  if new.mission_id is null then return new; end if;

  select instructions.evaluator_config into settings
  from public.mission_version_instructions instructions
  join public.mission_versions version on version.id = instructions.mission_version_id
  where version.id = new.mission_version_id and version.mission_id = new.mission_id;
  if not found then
    raise exception 'Mission start conditions are unavailable' using errcode = '55000';
  end if;
  required_items := coalesce(settings -> 'prerequisites', '[]'::jsonb);
  if jsonb_typeof(required_items) <> 'array' then
    raise exception 'Invalid mission prerequisites' using errcode = '22023';
  end if;
  if jsonb_array_length(required_items) > 30 then
    raise exception 'Too many mission prerequisites' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(required_items) loop
    identifier := btrim(item #>> '{}');
    if jsonb_typeof(item) <> 'string' or identifier is null
      or char_length(identifier) not between 1 and 500 then
      raise exception 'Invalid mission prerequisite identifier' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.mission_runs completed
      join public.missions prerequisite on prerequisite.id = completed.mission_id
      where completed.owner_id = new.owner_id
        and completed.status = 'passed'
        and completed.completed_at is not null
        and completed.awarded_evaluation_id is not null
        and (prerequisite.id::text = identifier or prerequisite.slug = identifier)
    ) then
      -- Stable application error code, no private mission details in the message.
      raise exception 'Complete the prerequisite missions first' using errcode = 'P2001';
    end if;
  end loop;
  return new;
end;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  insert into public.profiles (
    id,
    username,
    display_name,
    avatar_path,
    native_language,
    target_language
  )
  values (
    new.id,
    'learner_' || substr(new.id::text, 1, 8),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'English Learner'),
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'native_language', ''), 'ko'),
    coalesce(nullif(new.raw_user_meta_data ->> 'target_language', ''), 'en')
  )
  on conflict (id) do nothing;

  insert into public.user_entitlements (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin';
$$;


--
-- Name: learning_activity_slices(timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.learning_activity_slices(_from timestamp with time zone, _to timestamp with time zone) RETURNS TABLE(learning_date date, seconds integer)
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  with bounds as (
    select date_trunc('second', _from) as a, date_trunc('second', _to) as b
    where _to > _from and _to - _from <= interval '45 seconds'
  ), dates as (
    select a, b, generate_series(
      (a at time zone 'utc')::date::timestamp,
      (b at time zone 'utc')::date::timestamp, interval '1 day'
    ) at time zone 'utc' as start_at from bounds
  )
  select (start_at at time zone 'utc')::date,
    extract(epoch from least(b, start_at + interval '24 hours') - greatest(a, start_at))::integer
  from dates where least(b, start_at + interval '24 hours') > greatest(a, start_at)
$$;


--
-- Name: moderate_character_report(uuid, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.moderate_character_report(_report_id uuid, _character_id uuid, _expected_admin_id uuid, _resolution_note text DEFAULT ''::text) RETURNS TABLE(report_id uuid, character_id uuid, report_status text, character_status text, character_visibility text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  locked_report public.character_reports%rowtype;
begin
  if _report_id is null or _character_id is null or _expected_admin_id is null
    or char_length(coalesce(_resolution_note, '')) > 2000
  then
    raise exception using errcode = '22023', message = 'invalid moderation request';
  end if;

  if not exists (
    select 1
    from auth.users as auth_user
    where auth_user.id = _expected_admin_id
      and auth_user.raw_app_meta_data ->> 'role' = 'admin'
  ) then
    raise exception using errcode = '42501', message = 'administrator role required';
  end if;

  select * into locked_report
  from public.character_reports as report
  where report.id = _report_id
    and report.character_id = _character_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'character report not found';
  end if;
  if locked_report.status in ('resolved', 'dismissed') then
    raise exception using errcode = '55000', message = 'character report is already finalized';
  end if;

  update public.characters as character
  set
    status = 'review',
    visibility = 'private'
  where character.id = locked_report.character_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'reported character not found';
  end if;

  update public.character_reports as report
  set
    status = 'reviewing',
    resolution_note = coalesce(_resolution_note, ''),
    reviewed_by = _expected_admin_id,
    reviewed_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  where report.id = locked_report.id;

  return query
  select
    locked_report.id,
    locked_report.character_id,
    'reviewing'::text,
    'review'::text,
    'private'::text;
end;
$$;


--
-- Name: owns_artifact(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.owns_artifact(_artifact_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1 from public.artifacts
    where id = _artifact_id and owner_id = (select auth.uid())
  ) or public.is_admin();
$$;


--
-- Name: owns_character(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.owns_character(_character_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1 from public.characters
    where id = _character_id and owner_id = (select auth.uid())
  ) or public.is_admin();
$$;


--
-- Name: owns_conversation(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.owns_conversation(_conversation_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1 from public.conversations
    where id = _conversation_id and owner_id = (select auth.uid())
  ) or public.is_admin();
$$;


--
-- Name: owns_mission(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.owns_mission(_mission_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1 from public.missions
    where id = _mission_id and owner_id = (select auth.uid())
  ) or public.is_admin();
$$;


--
-- Name: prepare_response_regeneration(uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prepare_response_regeneration(_conversation_id uuid, _owner_id uuid, _assistant_id uuid, _request_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
      raise exception using errcode = 'PT409', message = 'regeneration key reused';
    end if;
    return receipt.user_message_id;
  end if;
  if exists (select 1 from public.chat_generations where conversation_id = _conversation_id
    and status = 'running' and lease_expires_at > clock_timestamp()) then
    raise exception using errcode = 'PT409', message = 'generation running';
  end if;
  select * into answer from public.messages where conversation_id = _conversation_id
    order by sequence_number desc limit 1;
  if answer.id is distinct from _assistant_id or answer.role <> 'assistant' or answer.status <> 'complete' then
    raise exception using errcode = 'PT409', message = 'only the latest completed answer can be regenerated';
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


--
-- Name: prevent_published_asset_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_published_asset_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  old_version_id uuid;
  new_version_id uuid;
  target_asset_id uuid;
  target_asset_type text;
begin

  if tg_op = 'DELETE' and pg_trigger_depth() > 1
    and current_user in ('postgres', 'supabase_admin', 'service_role') then
    if tg_table_name = 'character_assets' then
      -- Reward assets still honor surviving published mission references below.
      if old.asset_type <> 'reward' and not exists (select 1 from public.characters where id = old.character_id) then return old; end if;
    elsif tg_table_name = 'mission_assets' then
      if not exists (select 1 from public.missions where id = old.mission_id) then return old; end if;
    end if;
  end if;
  old_version_id := case when tg_op = 'INSERT' then null else
    nullif(coalesce(
      to_jsonb(old) ->> 'character_version_id',
      to_jsonb(old) ->> 'mission_version_id'
    ), '')::uuid end;
  new_version_id := case when tg_op = 'DELETE' then null else
    nullif(coalesce(
      to_jsonb(new) ->> 'character_version_id',
      to_jsonb(new) ->> 'mission_version_id'
    ), '')::uuid end;

  if tg_table_name = 'character_assets' then
    target_asset_id := nullif(
      case when tg_op = 'INSERT' then to_jsonb(new) ->> 'id'
        else to_jsonb(old) ->> 'id' end,
      ''
    )::uuid;
    target_asset_type := case when tg_op = 'DELETE'
      then to_jsonb(old) ->> 'asset_type'
      else to_jsonb(new) ->> 'asset_type' end;

    if target_asset_type <> 'reward' and exists (
      select 1 from public.character_versions as version
      where version.id in (old_version_id, new_version_id)
        and version.published_at is not null
    ) then
      raise exception using errcode = '55000', message = 'published version assets are immutable';
    end if;

    if target_asset_type = 'reward' and exists (
      select 1
      from public.mission_rewards as reward
      join public.mission_versions as version on version.id = reward.mission_version_id
      where reward.character_asset_id = target_asset_id
        and version.published_at is not null
    ) then
      raise exception using errcode = '55000', message = 'published reward assets are immutable';
    end if;
  elsif exists (
      select 1 from public.mission_versions as version
      where version.id in (old_version_id, new_version_id)
        and version.published_at is not null
  ) then
    raise exception using errcode = '55000', message = 'published version assets are immutable';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;


--
-- Name: prevent_published_character_instruction_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_published_character_instruction_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  target_version_id uuid;
begin

  if tg_op = 'DELETE' and pg_trigger_depth() > 1
    and current_user in ('postgres', 'supabase_admin', 'service_role')
    and not exists (select 1 from public.character_versions v join public.characters c on c.id = v.character_id where v.id = old.character_version_id)
  then return old; end if;
  target_version_id := case
    when tg_op = 'DELETE' then old.character_version_id
    else new.character_version_id
  end;

  if exists (
    select 1
    from public.character_versions as version
    where version.id = target_version_id
      and version.published_at is not null
  ) then
    raise exception using
      errcode = '55000',
      message = 'published character instructions are immutable';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;


--
-- Name: prevent_published_mission_character_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_published_mission_character_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  target_mission_id uuid;
begin

  if tg_op = 'DELETE' and pg_trigger_depth() > 1
    and current_user in ('postgres', 'supabase_admin', 'service_role')
    and not exists (select 1 from public.missions where id = old.mission_id)
  then return old; end if;
  target_mission_id := case
    when tg_op = 'DELETE' then old.mission_id
    else new.mission_id
  end;

  if exists (
    select 1
    from public.mission_versions as version
    where version.mission_id = target_mission_id
      and version.published_at is not null
  ) then
    raise exception using
      errcode = '55000',
      message = 'published mission character assignments are immutable';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;


--
-- Name: prevent_published_mission_child_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_published_mission_child_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  target_version_id uuid;
begin

  if tg_op = 'DELETE' and pg_trigger_depth() > 1
    and current_user in ('postgres', 'supabase_admin', 'service_role')
    and not exists (select 1 from public.mission_versions v join public.missions m on m.id = v.mission_id where v.id = old.mission_version_id)
  then return old; end if;
  if tg_table_name = 'mission_version_instructions' then
    target_version_id := case
      when tg_op = 'DELETE' then old.mission_version_id
      else new.mission_version_id
    end;
  elsif tg_table_name = 'mission_steps' then
    target_version_id := case
      when tg_op = 'DELETE' then old.mission_version_id
      else new.mission_version_id
    end;
  else
    target_version_id := case
      when tg_op = 'DELETE' then old.mission_version_id
      else new.mission_version_id
    end;
  end if;

  if exists (
    select 1
    from public.mission_versions as version
    where version.id = target_version_id
      and version.published_at is not null
  ) then
    raise exception using
      errcode = '55000',
      message = 'published mission version children are immutable';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;


--
-- Name: prevent_published_version_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_published_version_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin

  if tg_op = 'DELETE' and pg_trigger_depth() > 1
    and current_user in ('postgres', 'supabase_admin', 'service_role') then
    if tg_table_name = 'character_versions' then
      if not exists (select 1 from public.characters where id = old.character_id) then return old; end if;
    elsif tg_table_name = 'mission_versions' then
      if not exists (select 1 from public.missions where id = old.mission_id) then return old; end if;
    end if;
  end if;
  if current_user in ('postgres', 'supabase_admin')
    and current_setting('app.immutable_purge', true) = 'enabled'
  then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if old.published_at is not null then
    raise exception using
      errcode = '55000',
      message = 'published versions are immutable';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;


--
-- Name: publish_character(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.publish_character(_character_id uuid, _expected_owner_id uuid) RETURNS TABLE(character_id uuid, character_version_id uuid, status text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  locked_character public.characters%rowtype;
begin
  select * into locked_character
  from public.characters as character
  where character.id = _character_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'character not found';
  end if;
  if locked_character.owner_id is distinct from _expected_owner_id then
    raise exception using errcode = '42501', message = 'character owner mismatch';
  end if;
  if locked_character.status = 'review' then
    raise exception using errcode = '42501', message = 'character is under moderation review';
  end if;
  if locked_character.current_version_id is null then
    raise exception using errcode = '23514', message = 'character has no active version';
  end if;
  if not exists (
    select 1 from public.character_assets as asset
    where asset.character_id = locked_character.id
      and asset.asset_type = 'avatar'
      and asset.is_primary
      and (
        (locked_character.visibility = 'public' and asset.access_level = 'public')
        or (locked_character.visibility <> 'public' and asset.access_level = 'owner')
      )
  ) then
    raise exception using errcode = '23514', message = 'character requires a compatible primary avatar';
  end if;

  update public.character_versions as version
  set published_at = coalesce(version.published_at, timezone('utc', now()))
  where version.id = locked_character.current_version_id
    and version.published_at is null;

  update public.characters as character
  set status = 'published', published_at = coalesce(character.published_at, timezone('utc', now()))
  where character.id = locked_character.id;

  return query select locked_character.id, locked_character.current_version_id, 'published'::text;
end;
$$;


--
-- Name: publish_mission(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.publish_mission(_mission_id uuid, _expected_owner_id uuid) RETURNS TABLE(mission_id uuid, mission_version_id uuid, status text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  locked_mission public.missions%rowtype;
begin
  select * into locked_mission
  from public.missions as mission
  where mission.id = _mission_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'mission not found';
  end if;
  if locked_mission.owner_id is distinct from _expected_owner_id then
    raise exception using errcode = '42501', message = 'mission owner mismatch';
  end if;
  if locked_mission.current_version_id is null
    or not exists (
      select 1
      from public.mission_rewards as reward
      where reward.mission_id = locked_mission.id
        and reward.mission_version_id = locked_mission.current_version_id
        and reward.is_active
    )
  then
    raise exception using errcode = '23514', message = 'mission requires an active version reward';
  end if;

  update public.mission_versions as version
  set published_at = coalesce(version.published_at, timezone('utc', now()))
  where version.id = locked_mission.current_version_id
    and version.published_at is null;

  update public.missions as mission
  set status = 'published', published_at = coalesce(mission.published_at, timezone('utc', now()))
  where mission.id = locked_mission.id;

  return query select locked_mission.id, locked_mission.current_version_id, 'published'::text;
end;
$$;


--
-- Name: purge_deleted_conversation(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purge_deleted_conversation(_conversation_id uuid, _expected_owner_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  deleted_id uuid;
begin
  perform set_config('app.immutable_purge', 'enabled', true);

  delete from public.conversations as conversation
  where conversation.id = _conversation_id
    and conversation.owner_id = _expected_owner_id
    and conversation.status = 'deleted'
  returning conversation.id into deleted_id;

  if deleted_id is null then
    raise exception using errcode = 'P0002', message = 'deleted conversation not found';
  end if;
  return deleted_id;
end;
$$;


--
-- Name: purge_owned_conversations(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purge_owned_conversations(_expected_owner_id uuid, _request_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: record_learner_message_activity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_learner_message_activity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare actor uuid;
begin
  if new.role <> 'user' then return new; end if;
  select c.owner_id into actor from public.conversations c where c.id = new.conversation_id;
  if actor is distinct from new.author_id then return new; end if;
  insert into public.daily_learning_stats as daily(user_id, learning_date, messages_sent)
    values(actor, (clock_timestamp() at time zone 'utc')::date, 1)
  on conflict(user_id, learning_date) do update set messages_sent = daily.messages_sent + 1;
  return new;
end
$$;


--
-- Name: record_learning_activity(uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_learning_activity(_conversation_id uuid, _request_id uuid, _active boolean) RETURNS TABLE(accepted_seconds integer, recorded_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  actor uuid := auth.uid();
  previous public.learning_activity_clocks%rowtype;
  receipt public.learning_activity_receipts%rowtype;
  observed_at timestamptz;
  accepted integer := 0;
  slice record;
begin
  if actor is null then raise exception using errcode = '42501', message = 'authentication required'; end if;
  if _conversation_id is null or _request_id is null or _active is null then
    raise exception using errcode = '22023', message = 'activity fields required';
  end if;
  perform 1 from public.conversations c where c.id = _conversation_id and c.owner_id = actor and c.status = 'active' for share;
  if not found then raise exception using errcode = '42501', message = 'active owned conversation required'; end if;
  insert into public.learning_activity_clocks(user_id) values(actor) on conflict do nothing;
  select * into previous from public.learning_activity_clocks c where c.user_id = actor for update;
  select * into receipt from public.learning_activity_receipts r where r.user_id = actor and r.request_id = _request_id;
  if found then
    if receipt.conversation_id <> _conversation_id or receipt.active <> _active then
      raise exception using errcode = '22023', message = 'activity request key reused with different input';
    end if;
    return query select receipt.accepted_seconds, receipt.recorded_at;
    return;
  end if;
  observed_at := clock_timestamp();
  if previous.active and previous.last_seen_at is not null then
    for slice in select * from public.learning_activity_slices(previous.last_seen_at, observed_at) loop
      insert into public.daily_learning_stats as daily(user_id, learning_date, active_seconds, active_minutes)
        values(actor, slice.learning_date, slice.seconds, slice.seconds / 60)
      on conflict(user_id, learning_date) do update set
        active_seconds = daily.active_seconds + excluded.active_seconds,
        active_minutes = ((daily.active_seconds + excluded.active_seconds) / 60)::integer;
      accepted := accepted + slice.seconds;
    end loop;
  end if;
  update public.learning_activity_clocks c set last_seen_at = observed_at, active = _active where c.user_id = actor;
  insert into public.learning_activity_receipts(user_id, request_id, conversation_id, active, accepted_seconds, recorded_at)
    values(actor, _request_id, _conversation_id, _active, accepted, observed_at);
  return query select accepted, observed_at;
end
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: chat_file_uploads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_file_uploads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    storage_path text NOT NULL,
    sha256 text NOT NULL,
    mime_type text NOT NULL,
    byte_size integer NOT NULL,
    filename text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chat_file_uploads_byte_size_check CHECK (((byte_size >= 1) AND (byte_size <= 2097152))),
    CONSTRAINT chat_file_uploads_filename_check CHECK (((char_length(filename) >= 1) AND (char_length(filename) <= 500))),
    CONSTRAINT chat_file_uploads_mime_type_check CHECK ((mime_type = ANY (ARRAY['image/png'::text, 'image/jpeg'::text, 'application/pdf'::text]))),
    CONSTRAINT chat_file_uploads_sha256_check CHECK ((sha256 ~ '^[a-f0-9]{64}$'::text))
);


--
-- Name: register_chat_file(uuid, uuid, text, text, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.register_chat_file(_conversation_id uuid, _owner_id uuid, _sha256 text, _mime_type text, _byte_size integer, _filename text) RETURNS public.chat_file_uploads
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  owned public.conversations%rowtype;
  stored public.chat_file_uploads%rowtype;
  object_path text;
begin
  select * into owned from public.conversations where id = _conversation_id for update;
  if not found or owned.owner_id is distinct from _owner_id then raise exception using errcode='42501', message='conversation owner mismatch'; end if;
  if owned.status <> 'active' then raise exception using errcode='55000', message='conversation not active'; end if;
  if _sha256 is null or _sha256 !~ '^[a-f0-9]{64}$' or _mime_type is null or _mime_type not in ('image/png','image/jpeg','application/pdf')
    or _byte_size is null or _byte_size not between 1 and 2097152 or char_length(coalesce(_filename,'')) not between 1 and 500 then
    raise exception using errcode='22023', message='invalid file metadata';
  end if;
  object_path := _owner_id::text || '/' || _conversation_id::text || '/' || _sha256 ||
    case _mime_type when 'image/png' then '.png' when 'image/jpeg' then '.jpg' else '.pdf' end;
  if not exists (select 1 from storage.objects where bucket_id='chat-message-files' and name=object_path) then
    raise exception using errcode='P0002', message='uploaded object missing';
  end if;
  insert into public.chat_file_uploads(conversation_id,owner_id,storage_path,sha256,mime_type,byte_size,filename)
  values (_conversation_id,_owner_id,object_path,_sha256,_mime_type,_byte_size,_filename)
  on conflict (storage_path) do nothing;
  select * into stored from public.chat_file_uploads where storage_path=object_path;
  if stored.byte_size <> _byte_size or stored.mime_type <> _mime_type then raise exception using errcode='PT409', message='file metadata conflict'; end if;
  return stored;
end;
$_$;


--
-- Name: replace_message_branch(uuid, uuid, uuid, uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.replace_message_branch(_conversation_id uuid, _owner_id uuid, _source_id uuid, _expected_tail_id uuid, _request_id uuid, _parts jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
      raise exception using errcode = 'PT409', message = 'branch key reused with different input';
    end if;
    return _request_id;
  end if;
  if exists (select 1 from public.chat_generations where conversation_id = _conversation_id
    and status = 'running' and lease_expires_at > clock_timestamp()) then
    raise exception using errcode = 'PT409', message = 'a generation is running';
  end if;
  select id into tail_id from public.messages where conversation_id = _conversation_id
    order by sequence_number desc limit 1;
  if tail_id is distinct from _expected_tail_id then
    raise exception using errcode = 'PT409', message = 'conversation changed since editing began';
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


--
-- Name: save_learning_notebook(uuid, uuid, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_learning_notebook(_owner_id uuid, _request_id uuid, _draft jsonb, _identity_key text) RETURNS TABLE(entry jsonb, outcome text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare saved public.learning_notebook_entries%rowtype;
  previous public.learning_notebook_requests%rowtype;
  source_id uuid; message_ref text; result_kind text;
begin
  if _owner_id is null or _request_id is null or _draft is null or jsonb_typeof(_draft) <> 'object'
    or _identity_key is null or length(_identity_key) = 0 then
    raise exception using errcode='22023', message='invalid notebook input';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('notebook:' || _owner_id::text, 0));
  select * into previous from public.learning_notebook_requests r where r.user_id=_owner_id and r.request_id=_request_id;
  if found then
    if previous.draft <> _draft then raise exception using errcode='PT409', message='notebook request changed'; end if;
    select * into saved from public.learning_notebook_entries e where e.user_id=_owner_id and e.id=previous.entry_id;
    result_kind := 'replayed';
  else
    source_id := (_draft->'source'->>'conversationId')::uuid;
    message_ref := _draft->'source'->>'messageId';
    perform 1 from public.conversations c where c.id=source_id and c.owner_id=_owner_id and c.status='active' for share;
    if not found then raise exception using errcode='P0002', message='owned active source not found'; end if;
    if message_ref is not null then
      perform 1 from public.messages m where m.conversation_id=source_id
        and (m.id::text=message_ref or m.client_message_id=message_ref) for share;
      if not found then raise exception using errcode='P0002', message='source message not found'; end if;
    end if;
    select * into saved from public.learning_notebook_entries e
      where e.user_id=_owner_id and md5(e.identity_key)=md5(_identity_key);
    if found then
      if saved.identity_key <> _identity_key then raise exception using errcode='PT409', message='notebook identity conflict'; end if;
      result_kind := 'duplicate';
    else
      insert into public.learning_notebook_entries(user_id,id,draft,identity_key)
        values(_owner_id,_request_id,_draft,_identity_key) returning * into saved;
      result_kind := 'created';
    end if;
    insert into public.learning_notebook_requests(user_id,request_id,draft,entry_id)
      values(_owner_id,_request_id,_draft,saved.id);
  end if;
  return query select jsonb_build_object('id',saved.id,'draft',saved.draft,'createdAt',
    to_char(saved.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')), result_kind;
end;
$$;


--
-- Name: save_learning_preferences(integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_learning_preferences(_expected_revision integer, _settings jsonb) RETURNS TABLE(revision integer, settings jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare owner_id uuid := auth.uid(); saved public.learner_preferences%rowtype;
begin
  if owner_id is null then raise exception using errcode='42501', message='authenticated user required'; end if;
  if _expected_revision is null or _expected_revision not between 0 and 2147483646 or not public.valid_learning_preferences(_settings) then
    raise exception using errcode='22023', message='invalid learning preferences';
  end if;
  if _expected_revision = 0 then
    insert into public.learner_preferences(user_id, settings, revision) values(owner_id, _settings, 1)
      on conflict do nothing returning * into saved;
  else
    update public.learner_preferences p set settings=_settings, revision=p.revision+1
      where p.user_id=owner_id and p.revision=_expected_revision returning p.* into saved;
  end if;
  if saved.user_id is null then raise exception using errcode='PT409', message='learning preferences changed; reload before editing'; end if;
  return query select saved.revision, saved.settings;
end;
$$;


--
-- Name: set_saved_mission(uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_saved_mission(_request_id uuid, _mission_id uuid, _saved boolean) RETURNS TABLE(mission_id uuid, saved boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare owner_id uuid := auth.uid(); previous public.mission_favorite_requests%rowtype;
begin
  if owner_id is null then raise exception using errcode='42501', message='authenticated user required'; end if;
  if _request_id is null or _mission_id is null or _saved is null then raise exception using errcode='22023', message='invalid bookmark request'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('saved-missions:' || owner_id::text, 0));
  select * into previous from public.mission_favorite_requests r where r.user_id=owner_id and r.request_id=_request_id;
  if found then
    if previous.mission_id <> _mission_id or previous.saved <> _saved then raise exception using errcode='PT409', message='bookmark request changed'; end if;
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


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;


--
-- Name: start_mission_run(uuid, uuid, uuid, uuid, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.start_mission_run(_expected_owner_id uuid, _mission_id uuid, _mission_version_id uuid, _character_id uuid, _character_version_id uuid, _conversation_id uuid DEFAULT NULL::uuid, _model_id text DEFAULT 'gpt-5.6-terra'::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
    raise exception 'Publication changed before mission start' using errcode = 'PT409';
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
      character_version_id, title, model_id, metadata, title_source)
    values (_expected_owner_id, _mission_id, _mission_version_id, _character_id,
      _character_version_id, mission.title, _model_id, '{"source":"mission-run"}'::jsonb, 'pending')
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


--
-- Name: touch_conversation_after_message(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_conversation_after_message() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;


--
-- Name: update_artifact_state(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_artifact_state(_artifact_id uuid, _expected_owner_id uuid, _title text DEFAULT NULL::text, _status text DEFAULT NULL::text) RETURNS TABLE(artifact_id uuid, artifact_version_id uuid, status text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  locked_artifact public.artifacts%rowtype;
  desired_status text;
begin
  select * into locked_artifact
  from public.artifacts as artifact
  where artifact.id = _artifact_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'artifact not found';
  end if;
  if locked_artifact.owner_id is distinct from _expected_owner_id then
    raise exception using errcode = '42501', message = 'artifact owner mismatch';
  end if;
  if _title is not null and char_length(_title) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'invalid artifact title';
  end if;
  desired_status := coalesce(_status, locked_artifact.status);
  if desired_status not in ('draft', 'published', 'archived') then
    raise exception using errcode = '22023', message = 'invalid artifact status';
  end if;
  if desired_status = 'published' and locked_artifact.current_version_id is null then
    raise exception using errcode = '23514', message = 'published artifact requires a version';
  end if;

  if desired_status = 'published' then
    update public.artifact_versions as version
    set published_at = timezone('utc', now())
    where version.id = locked_artifact.current_version_id
      and version.published_at is null;
  end if;

  update public.artifacts as artifact
  set
    title = coalesce(_title, artifact.title),
    status = desired_status
  where artifact.id = locked_artifact.id;

  return query
  select locked_artifact.id, locked_artifact.current_version_id, desired_status;
end;
$$;


--
-- Name: valid_learning_preferences(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.valid_learning_preferences(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare fields text[] := array['displayName','learnerLevel','dailyGoal','learningGoal','interests','correctionMode','voice','rate','autoplay'];
begin
  if value is null or jsonb_typeof(value) <> 'object' or not value ?& fields or value - (fields || array['koreanExplanation','responseLength']) <> '{}'::jsonb then return false; end if;
  if value ? 'koreanExplanation' and (jsonb_typeof(value->'koreanExplanation') <> 'string' or value->>'koreanExplanation' not in ('none','brief','detailed')) then return false; end if;
  if value ? 'responseLength' and (jsonb_typeof(value->'responseLength') <> 'string' or value->>'responseLength' not in ('short','standard','long')) then return false; end if;
  if jsonb_typeof(value->'displayName') <> 'string' or char_length(btrim(value->>'displayName')) not between 1 and 40
    or jsonb_typeof(value->'learningGoal') <> 'string' or char_length(value->>'learningGoal') > 500
    or jsonb_typeof(value->'autoplay') <> 'boolean'
    or jsonb_typeof(value->'dailyGoal') <> 'number' or jsonb_typeof(value->'rate') <> 'number'
    or jsonb_typeof(value->'interests') <> 'array' then return false; end if;
  if value->>'learnerLevel' not in ('PRE_A1','A1','A2','B1','B2','C1','C2')
    or value->>'voice' not in ('marin','coral','alloy')
    or value->>'correctionMode' not in ('gentle','immediate','summary')
    or jsonb_typeof(value->'learnerLevel') <> 'string' or jsonb_typeof(value->'voice') <> 'string'
    or jsonb_typeof(value->'correctionMode') <> 'string'
    or (value->>'dailyGoal')::numeric not between 1 and 240
    or trunc((value->>'dailyGoal')::numeric) <> (value->>'dailyGoal')::numeric
    or (value->>'rate')::numeric not in (0.75, 1, 1.25)
    or jsonb_array_length(value->'interests') > 5 then return false; end if;
  if exists (select 1 from jsonb_array_elements(value->'interests') item
    where jsonb_typeof(item) <> 'string' or item #>> '{}' not in ('여행','일상','직장','학업','문화')) then return false; end if;
  return (select count(distinct item) from jsonb_array_elements(value->'interests') item) = jsonb_array_length(value->'interests');
end;
$$;


--
-- Name: validate_artifact_current_version(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_artifact_current_version() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if new.current_version_id is not null and not exists (
    select 1
    from public.artifact_versions as version
    where version.id = new.current_version_id
      and version.artifact_id = new.id
  ) then
    raise exception 'current_version_id must belong to the artifact';
  end if;
  return new;
end;
$$;


--
-- Name: validate_character_current_version(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_character_current_version() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if new.current_version_id is not null and not exists (
    select 1
    from public.character_versions as version
    where version.id = new.current_version_id
      and version.character_id = new.id
  ) then
    raise exception 'current_version_id must belong to the character';
  end if;
  return new;
end;
$$;


--
-- Name: validate_chat_file_parts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_chat_file_parts() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare part jsonb; reference text; file_id uuid; file_count integer := 0;
begin
  if new.role <> 'user' then return new; end if;
  if tg_op='UPDATE' and new.parts is not distinct from old.parts and new.conversation_id=old.conversation_id
    and new.author_id is not distinct from old.author_id and new.role=old.role then return new; end if;
  for part in select value from jsonb_array_elements(new.parts) loop
    if part->>'type' <> 'file' then continue; end if;
    file_count := file_count + 1;
    reference := part->>'url';
    if file_count > 4 or reference is null or reference !~ '^chat-file://[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
      or split_part(substring(reference from 13), '/', 1) <> new.conversation_id::text then
      raise exception using errcode='22023', message='invalid private file reference';
    end if;
    file_id := split_part(substring(reference from 13), '/', 2)::uuid;
    if not exists (select 1 from public.chat_file_uploads f where f.id=file_id and f.conversation_id=new.conversation_id
      and f.owner_id=new.author_id and f.mime_type=part->>'mediaType') then
      raise exception using errcode='42501', message='file reference owner or type mismatch';
    end if;
  end loop;
  return new;
end;
$_$;


--
-- Name: validate_message_parent_and_parts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_message_parent_and_parts() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if new.role = 'user' and jsonb_array_length(new.parts) = 0 then
    raise exception using errcode = '23514', message = 'user messages require typed content parts';
  end if;

  if new.parent_message_id is not null and not exists (
    select 1
    from public.messages as parent
    where parent.id = new.parent_message_id
      and parent.conversation_id = new.conversation_id
      and parent.sequence_number < new.sequence_number
  ) then
    raise exception using errcode = '23514', message = 'message parent must be an earlier message in the conversation';
  end if;
  return new;
end;
$$;


--
-- Name: validate_mission_current_version(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_mission_current_version() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if new.current_version_id is not null and not exists (
    select 1
    from public.mission_versions as version
    where version.id = new.current_version_id
      and version.mission_id = new.id
  ) then
    raise exception 'current_version_id must belong to the mission';
  end if;
  return new;
end;
$$;


--
-- Name: validate_mission_reward_definition(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_mission_reward_definition() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  reward_asset public.character_assets%rowtype;
begin
  if not new.is_active then
    return new;
  end if;

  select *
  into reward_asset
  from public.character_assets
  where id = new.character_asset_id;

  if not found
    or reward_asset.asset_type <> 'reward'
    or reward_asset.access_level <> 'reward'
    or reward_asset.storage_bucket <> 'character-private'
    or reward_asset.character_version_id is null
  then
    raise exception 'mission reward must reference a versioned private reward asset';
  end if;

  if not exists (
    select 1
    from public.mission_characters as allowed_character
    where allowed_character.mission_id = new.mission_id
      and allowed_character.character_id = reward_asset.character_id
  ) then
    raise exception 'reward character must be allowed by the mission';
  end if;

  if not exists (
    select 1
    from storage.objects as object
    where object.bucket_id = reward_asset.storage_bucket
      and object.name = reward_asset.storage_path
  ) then
    raise exception 'reward storage object must exist before activation';
  end if;

  return new;
end;
$$;


--
-- Name: validate_mission_run_context(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_mission_run_context() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  conversation_record public.conversations%rowtype;
begin
  select *
  into conversation_record
  from public.conversations
  where id = new.conversation_id;

  if not found
    or conversation_record.owner_id <> new.owner_id
    or conversation_record.character_id <> new.character_id
    or conversation_record.character_version_id <> new.character_version_id
    or conversation_record.mission_id is distinct from new.mission_id
    or conversation_record.mission_version_id is distinct from new.mission_version_id
  then
    raise exception 'mission run context must match its conversation snapshot';
  end if;

  return new;
end;
$$;


--
-- Name: ai_usage_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_usage_events (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    generation_job_id uuid,
    usage_kind text NOT NULL,
    provider text NOT NULL,
    model_id text NOT NULL,
    input_units bigint DEFAULT 0 NOT NULL,
    output_units bigint DEFAULT 0 NOT NULL,
    cost_micros bigint DEFAULT 0 NOT NULL,
    occurred_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT ai_usage_events_cost_micros_check CHECK ((cost_micros >= 0)),
    CONSTRAINT ai_usage_events_input_units_check CHECK ((input_units >= 0)),
    CONSTRAINT ai_usage_events_metadata_check CHECK ((jsonb_typeof(metadata) = 'object'::text)),
    CONSTRAINT ai_usage_events_output_units_check CHECK ((output_units >= 0)),
    CONSTRAINT ai_usage_events_usage_kind_check CHECK ((usage_kind = ANY (ARRAY['chat'::text, 'image'::text, 'speech'::text, 'evaluation'::text])))
);


--
-- Name: ai_usage_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.ai_usage_events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.ai_usage_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: artifact_revision_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.artifact_revision_requests (
    request_id uuid NOT NULL,
    artifact_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    expected_version_id uuid,
    payload jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: artifact_suggestions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.artifact_suggestions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    artifact_version_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    original_text text NOT NULL,
    suggested_text text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT artifact_suggestions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text])))
);


--
-- Name: artifact_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.artifact_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    artifact_id uuid NOT NULL,
    version_number integer NOT NULL,
    source_message_id uuid,
    content_text text,
    content_json jsonb,
    storage_bucket text,
    storage_path text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    published_at timestamp with time zone,
    CONSTRAINT artifact_versions_check CHECK (((content_text IS NOT NULL) OR (content_json IS NOT NULL) OR ((storage_bucket IS NOT NULL) AND (storage_path IS NOT NULL)))),
    CONSTRAINT artifact_versions_version_number_check CHECK ((version_number > 0))
);


--
-- Name: COLUMN artifact_versions.published_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.artifact_versions.published_at IS 'Once published, an artifact version is immutable; revisions append a new version.';


--
-- Name: artifacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.artifacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    kind text NOT NULL,
    title text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    current_version_id uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT artifacts_kind_check CHECK ((kind = ANY (ARRAY['text'::text, 'code'::text, 'image'::text, 'sheet'::text]))),
    CONSTRAINT artifacts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text]))),
    CONSTRAINT artifacts_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 200)))
);


--
-- Name: character_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.character_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    character_id uuid NOT NULL,
    character_version_id uuid,
    generation_job_id uuid,
    asset_type text NOT NULL,
    access_level text DEFAULT 'owner'::text NOT NULL,
    storage_bucket text NOT NULL,
    storage_path text NOT NULL,
    mime_type text NOT NULL,
    width integer,
    height integer,
    duration_ms integer,
    prompt text DEFAULT ''::text NOT NULL,
    alt_text text DEFAULT ''::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT character_assets_access_level_check CHECK ((access_level = ANY (ARRAY['public'::text, 'owner'::text, 'reward'::text]))),
    CONSTRAINT character_assets_asset_type_check CHECK ((asset_type = ANY (ARRAY['avatar'::text, 'portrait'::text, 'reward'::text, 'background'::text, 'voice-sample'::text]))),
    CONSTRAINT character_assets_check CHECK ((((access_level = 'public'::text) AND (storage_bucket = 'character-public'::text)) OR ((access_level = ANY (ARRAY['owner'::text, 'reward'::text])) AND (storage_bucket = 'character-private'::text)))),
    CONSTRAINT character_assets_duration_ms_check CHECK (((duration_ms IS NULL) OR (duration_ms >= 0))),
    CONSTRAINT character_assets_height_check CHECK (((height IS NULL) OR (height > 0))),
    CONSTRAINT character_assets_metadata_check CHECK ((jsonb_typeof(metadata) = 'object'::text)),
    CONSTRAINT character_assets_storage_bucket_check CHECK ((storage_bucket = ANY (ARRAY['character-public'::text, 'character-private'::text]))),
    CONSTRAINT character_assets_width_check CHECK (((width IS NULL) OR (width > 0)))
);


--
-- Name: COLUMN character_assets.access_level; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_assets.access_level IS 'Reward originals stay in character-private and become readable only through reward_unlocks.';


--
-- Name: character_favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.character_favorites (
    user_id uuid NOT NULL,
    character_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: character_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.character_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reporter_id uuid NOT NULL,
    character_id uuid NOT NULL,
    reason text NOT NULL,
    details text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    resolution_note text DEFAULT ''::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT character_reports_check CHECK ((reporter_id <> reviewed_by)),
    CONSTRAINT character_reports_check1 CHECK ((((status = 'pending'::text) AND (reviewed_by IS NULL) AND (reviewed_at IS NULL)) OR (status <> 'pending'::text))),
    CONSTRAINT character_reports_details_check CHECK ((char_length(details) <= 2000)),
    CONSTRAINT character_reports_reason_check CHECK ((reason = ANY (ARRAY['spam'::text, 'unsafe'::text, 'sexual'::text, 'hate'::text, 'harassment'::text, 'impersonation'::text, 'copyright'::text, 'other'::text]))),
    CONSTRAINT character_reports_resolution_note_check CHECK ((char_length(resolution_note) <= 2000)),
    CONSTRAINT character_reports_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'reviewing'::text, 'resolved'::text, 'dismissed'::text])))
);


--
-- Name: TABLE character_reports; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.character_reports IS 'Private moderation queue. Only the reporter and administrators can read a report.';


--
-- Name: character_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.character_tags (
    character_id uuid NOT NULL,
    tag extensions.citext NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT character_tags_tag_check CHECK (((char_length((tag)::text) >= 1) AND (char_length((tag)::text) <= 40)))
);


--
-- Name: character_version_instructions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.character_version_instructions (
    character_version_id uuid NOT NULL,
    system_prompt text NOT NULL,
    safety_instructions text DEFAULT ''::text NOT NULL,
    conversation_rules jsonb DEFAULT '{}'::jsonb NOT NULL,
    model_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT character_version_instructions_conversation_rules_check CHECK ((jsonb_typeof(conversation_rules) = 'object'::text)),
    CONSTRAINT character_version_instructions_model_config_check CHECK ((jsonb_typeof(model_config) = 'object'::text))
);


--
-- Name: TABLE character_version_instructions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.character_version_instructions IS 'Server-only prompt material. anon/authenticated grants are revoked below.';


--
-- Name: character_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.character_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    character_id uuid NOT NULL,
    version_number integer NOT NULL,
    change_summary text DEFAULT ''::text NOT NULL,
    personality_summary text NOT NULL,
    personality_traits jsonb DEFAULT '[]'::jsonb NOT NULL,
    persona_goals jsonb NOT NULL,
    learning_goals jsonb NOT NULL,
    backstory text DEFAULT ''::text NOT NULL,
    greeting text NOT NULL,
    example_dialogues jsonb DEFAULT '[]'::jsonb NOT NULL,
    voice_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    image_prompt text DEFAULT ''::text NOT NULL,
    locale text DEFAULT 'en-US'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    published_at timestamp with time zone,
    display_metadata jsonb,
    CONSTRAINT character_versions_display_metadata_check CHECK (((display_metadata IS NULL) OR (jsonb_typeof(display_metadata) = 'object'::text))),
    CONSTRAINT character_versions_example_dialogues_check CHECK ((jsonb_typeof(example_dialogues) = 'array'::text)),
    CONSTRAINT character_versions_greeting_check CHECK (((char_length(greeting) >= 1) AND (char_length(greeting) <= 4000))),
    CONSTRAINT character_versions_learning_goals_check CHECK (((jsonb_typeof(learning_goals) = 'array'::text) AND (jsonb_array_length(learning_goals) > 0))),
    CONSTRAINT character_versions_persona_goals_check CHECK (((jsonb_typeof(persona_goals) = 'array'::text) AND (jsonb_array_length(persona_goals) > 0))),
    CONSTRAINT character_versions_personality_summary_check CHECK (((char_length(personality_summary) >= 1) AND (char_length(personality_summary) <= 2000))),
    CONSTRAINT character_versions_personality_traits_check CHECK ((jsonb_typeof(personality_traits) = 'array'::text)),
    CONSTRAINT character_versions_version_number_check CHECK ((version_number > 0)),
    CONSTRAINT character_versions_voice_config_check CHECK ((jsonb_typeof(voice_config) = 'object'::text))
);


--
-- Name: COLUMN character_versions.published_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_versions.published_at IS 'Once set, the version and its server-only instructions are immutable.';


--
-- Name: COLUMN character_versions.display_metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_versions.display_metadata IS 'Public display fields captured by the database on first publication; NULL means historical metadata is unknown.';


--
-- Name: characters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.characters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid,
    slug extensions.citext NOT NULL,
    name text NOT NULL,
    tagline text DEFAULT ''::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    visibility text DEFAULT 'private'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    current_version_id uuid,
    age_rating text DEFAULT 'everyone'::text NOT NULL,
    featured boolean DEFAULT false NOT NULL,
    conversation_count bigint DEFAULT 0 NOT NULL,
    favorite_count bigint DEFAULT 0 NOT NULL,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    search_document tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, ((((COALESCE(name, ''::text) || ' '::text) || COALESCE(tagline, ''::text)) || ' '::text) || COALESCE(description, ''::text)))) STORED,
    CONSTRAINT characters_age_rating_check CHECK ((age_rating = ANY (ARRAY['everyone'::text, 'teen'::text, 'mature'::text]))),
    CONSTRAINT characters_check CHECK (((owner_id IS NOT NULL) OR (status = ANY (ARRAY['published'::text, 'archived'::text])))),
    CONSTRAINT characters_check1 CHECK (((status <> 'published'::text) OR (current_version_id IS NOT NULL))),
    CONSTRAINT characters_conversation_count_check CHECK ((conversation_count >= 0)),
    CONSTRAINT characters_favorite_count_check CHECK ((favorite_count >= 0)),
    CONSTRAINT characters_name_check CHECK (((char_length(name) >= 1) AND (char_length(name) <= 80))),
    CONSTRAINT characters_slug_check CHECK (((slug)::text ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)),
    CONSTRAINT characters_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'generating'::text, 'review'::text, 'published'::text, 'archived'::text]))),
    CONSTRAINT characters_tagline_check CHECK ((char_length(tagline) <= 160)),
    CONSTRAINT characters_visibility_check CHECK ((visibility = ANY (ARRAY['private'::text, 'unlisted'::text, 'public'::text])))
);


--
-- Name: chat_generations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_generations (
    conversation_id uuid NOT NULL,
    user_message_id uuid NOT NULL,
    assistant_message_id uuid NOT NULL,
    request_id uuid NOT NULL,
    lease_expires_at timestamp with time zone NOT NULL,
    status text NOT NULL,
    continuation_parts jsonb,
    continuation_decisions jsonb,
    CONSTRAINT chat_generations_status_check CHECK ((status = ANY (ARRAY['running'::text, 'complete'::text, 'error'::text, 'cancelled'::text])))
);


--
-- Name: conversation_clear_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_clear_requests (
    conversation_id uuid NOT NULL,
    request_id uuid NOT NULL,
    deleted_count integer NOT NULL
);


--
-- Name: conversation_purge_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_purge_requests (
    owner_id uuid NOT NULL,
    request_id uuid NOT NULL,
    deleted_count integer NOT NULL
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    character_id uuid NOT NULL,
    character_version_id uuid NOT NULL,
    mission_id uuid,
    mission_version_id uuid,
    title text DEFAULT 'New conversation'::text NOT NULL,
    title_source text DEFAULT 'manual'::text NOT NULL CHECK (title_source IN ('manual', 'pending', 'auto')),
    visibility text DEFAULT 'private'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    model_id text NOT NULL,
    share_token uuid DEFAULT gen_random_uuid() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    last_message_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT conversations_check CHECK (((mission_id IS NULL) = (mission_version_id IS NULL))),
    CONSTRAINT conversations_metadata_check CHECK ((jsonb_typeof(metadata) = 'object'::text)),
    CONSTRAINT conversations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text, 'deleted'::text]))),
    CONSTRAINT conversations_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 200))),
    CONSTRAINT conversations_visibility_check CHECK ((visibility = ANY (ARRAY['private'::text, 'unlisted'::text, 'public'::text])))
);


--
-- Name: TABLE conversations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.conversations IS 'Pins character and optional mission versions so later edits never rewrite an active chat persona or learning contract.';


--
-- Name: daily_learning_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_learning_stats (
    user_id uuid NOT NULL,
    learning_date date NOT NULL,
    active_minutes integer DEFAULT 0 NOT NULL,
    messages_sent integer DEFAULT 0 NOT NULL,
    missions_started integer DEFAULT 0 NOT NULL,
    missions_completed integer DEFAULT 0 NOT NULL,
    experience_earned integer DEFAULT 0 NOT NULL,
    speech_seconds integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    active_seconds bigint DEFAULT 0 NOT NULL,
    CONSTRAINT daily_learning_stats_active_minutes_check CHECK ((active_minutes >= 0)),
    CONSTRAINT daily_learning_stats_active_seconds_check CHECK ((active_seconds >= 0)),
    CONSTRAINT daily_learning_stats_experience_earned_check CHECK ((experience_earned >= 0)),
    CONSTRAINT daily_learning_stats_messages_sent_check CHECK ((messages_sent >= 0)),
    CONSTRAINT daily_learning_stats_missions_completed_check CHECK ((missions_completed >= 0)),
    CONSTRAINT daily_learning_stats_missions_started_check CHECK ((missions_started >= 0)),
    CONSTRAINT daily_learning_stats_speech_seconds_check CHECK ((speech_seconds >= 0)),
    CONSTRAINT learning_minutes_match_seconds CHECK ((active_minutes = (active_seconds / 60)))
);


--
-- Name: generation_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.generation_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    job_type text NOT NULL,
    target_type text NOT NULL,
    target_id uuid,
    provider text NOT NULL,
    model_id text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    progress smallint DEFAULT 0 NOT NULL,
    request_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    result_payload jsonb,
    error_code text,
    error_message text,
    idempotency_key text,
    input_tokens integer,
    output_tokens integer,
    estimated_cost_micros bigint,
    attempt_count integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 3 NOT NULL,
    available_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT generation_jobs_attempt_count_check CHECK ((attempt_count >= 0)),
    CONSTRAINT generation_jobs_check CHECK (((completed_at IS NULL) OR (started_at IS NULL) OR (completed_at >= started_at))),
    CONSTRAINT generation_jobs_estimated_cost_micros_check CHECK (((estimated_cost_micros IS NULL) OR (estimated_cost_micros >= 0))),
    CONSTRAINT generation_jobs_input_tokens_check CHECK (((input_tokens IS NULL) OR (input_tokens >= 0))),
    CONSTRAINT generation_jobs_job_type_check CHECK ((job_type = ANY (ARRAY['character-draft'::text, 'character-image'::text, 'mission-draft'::text, 'mission-image'::text, 'chat-title'::text, 'artifact'::text, 'evaluation'::text, 'speech'::text, 'other'::text]))),
    CONSTRAINT generation_jobs_max_attempts_check CHECK ((max_attempts > 0)),
    CONSTRAINT generation_jobs_output_tokens_check CHECK (((output_tokens IS NULL) OR (output_tokens >= 0))),
    CONSTRAINT generation_jobs_progress_check CHECK (((progress >= 0) AND (progress <= 100))),
    CONSTRAINT generation_jobs_request_payload_check CHECK ((jsonb_typeof(request_payload) = 'object'::text)),
    CONSTRAINT generation_jobs_result_payload_check CHECK (((result_payload IS NULL) OR (jsonb_typeof(result_payload) = 'object'::text))),
    CONSTRAINT generation_jobs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'succeeded'::text, 'failed'::text, 'cancelled'::text])))
);

ALTER TABLE ONLY public.generation_jobs REPLICA IDENTITY FULL;


--
-- Name: learner_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learner_preferences (
    user_id uuid NOT NULL,
    settings jsonb NOT NULL,
    revision integer NOT NULL,
    CONSTRAINT learner_preferences_revision_check CHECK ((revision >= 1)),
    CONSTRAINT learner_preferences_settings_check CHECK (public.valid_learning_preferences(settings))
);


--
-- Name: learning_activity_clocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_activity_clocks (
    user_id uuid NOT NULL,
    last_seen_at timestamp with time zone,
    active boolean DEFAULT false NOT NULL
);


--
-- Name: learning_activity_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_activity_receipts (
    user_id uuid NOT NULL,
    request_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    active boolean NOT NULL,
    accepted_seconds integer NOT NULL,
    recorded_at timestamp with time zone NOT NULL,
    CONSTRAINT learning_activity_receipts_accepted_seconds_check CHECK (((accepted_seconds >= 0) AND (accepted_seconds <= 45)))
);


--
-- Name: learning_notebook_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_notebook_entries (
    user_id uuid NOT NULL,
    id uuid NOT NULL,
    draft jsonb NOT NULL,
    identity_key text NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT learning_notebook_entries_draft_check CHECK ((jsonb_typeof(draft) = 'object'::text))
);


--
-- Name: learning_notebook_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_notebook_requests (
    user_id uuid NOT NULL,
    request_id uuid NOT NULL,
    draft jsonb NOT NULL,
    entry_id uuid NOT NULL
);


--
-- Name: message_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    storage_bucket text DEFAULT 'chat-attachments'::text NOT NULL,
    storage_path text NOT NULL,
    filename text NOT NULL,
    mime_type text NOT NULL,
    byte_size bigint NOT NULL,
    access_level text DEFAULT 'private'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT message_attachments_access_level_check CHECK ((access_level = ANY (ARRAY['private'::text, 'conversation'::text]))),
    CONSTRAINT message_attachments_byte_size_check CHECK (((byte_size >= 1) AND (byte_size <= 26214400))),
    CONSTRAINT message_attachments_metadata_check CHECK ((jsonb_typeof(metadata) = 'object'::text)),
    CONSTRAINT message_attachments_storage_bucket_check CHECK ((storage_bucket = 'chat-attachments'::text))
);


--
-- Name: message_audio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_audio (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    generation_job_id uuid,
    message_revision integer DEFAULT 1 NOT NULL,
    text_hash text NOT NULL,
    voice_id text NOT NULL,
    model_id text NOT NULL,
    speaking_rate numeric(4,2) DEFAULT 1.00 NOT NULL,
    storage_bucket text DEFAULT 'chat-attachments'::text NOT NULL,
    storage_path text NOT NULL,
    mime_type text DEFAULT 'audio/mpeg'::text NOT NULL,
    duration_ms integer,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT message_audio_duration_ms_check CHECK (((duration_ms IS NULL) OR (duration_ms > 0))),
    CONSTRAINT message_audio_message_revision_check CHECK ((message_revision > 0)),
    CONSTRAINT message_audio_speaking_rate_check CHECK (((speaking_rate >= 0.25) AND (speaking_rate <= 4.00))),
    CONSTRAINT message_audio_storage_bucket_check CHECK ((storage_bucket = 'chat-attachments'::text)),
    CONSTRAINT message_audio_text_hash_check CHECK ((text_hash ~ '^[0-9a-f]{64}$'::text))
);


--
-- Name: TABLE message_audio; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.message_audio IS 'Immutable TTS cache keyed by message revision, normalized text hash, model, voice, and speaking rate.';


--
-- Name: message_branch_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_branch_requests (
    request_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    source_message_id uuid NOT NULL,
    expected_tail_id uuid NOT NULL,
    parts jsonb NOT NULL
);


--
-- Name: message_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_feedback (
    user_id uuid NOT NULL,
    message_id uuid NOT NULL,
    rating smallint NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT message_feedback_rating_check CHECK ((rating = ANY (ARRAY['-1'::integer, 1])))
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    author_id uuid,
    role text NOT NULL,
    status text DEFAULT 'complete'::text NOT NULL,
    parts jsonb DEFAULT '[]'::jsonb NOT NULL,
    plain_text text DEFAULT ''::text NOT NULL,
    parent_message_id uuid,
    model_id text,
    provider_message_id text,
    finish_reason text,
    error_code text,
    error_message text,
    input_tokens integer,
    output_tokens integer,
    sequence_number bigint NOT NULL,
    client_message_id text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT messages_check CHECK ((((role = 'user'::text) AND (author_id IS NOT NULL)) OR (role = ANY (ARRAY['system'::text, 'assistant'::text, 'tool'::text])))),
    CONSTRAINT messages_input_tokens_check CHECK (((input_tokens IS NULL) OR (input_tokens >= 0))),
    CONSTRAINT messages_output_tokens_check CHECK (((output_tokens IS NULL) OR (output_tokens >= 0))),
    CONSTRAINT messages_parts_check CHECK ((jsonb_typeof(parts) = 'array'::text)),
    CONSTRAINT messages_role_check CHECK ((role = ANY (ARRAY['system'::text, 'user'::text, 'assistant'::text, 'tool'::text]))),
    CONSTRAINT messages_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'streaming'::text, 'complete'::text, 'error'::text, 'cancelled'::text])))
);

ALTER TABLE ONLY public.messages REPLICA IDENTITY FULL;


--
-- Name: COLUMN messages.role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.messages.role IS 'Authenticated public clients may insert only user rows; system, assistant, and tool rows require the server secret client.';


--
-- Name: messages_sequence_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.messages ALTER COLUMN sequence_number ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.messages_sequence_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: mission_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mission_id uuid NOT NULL,
    mission_version_id uuid,
    generation_job_id uuid,
    asset_type text NOT NULL,
    access_level text DEFAULT 'owner'::text NOT NULL,
    storage_bucket text DEFAULT 'mission-private'::text NOT NULL,
    storage_path text NOT NULL,
    mime_type text NOT NULL,
    width integer,
    height integer,
    alt_text text DEFAULT ''::text NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT mission_assets_access_level_check CHECK ((access_level = ANY (ARRAY['public'::text, 'owner'::text]))),
    CONSTRAINT mission_assets_asset_type_check CHECK ((asset_type = ANY (ARRAY['thumbnail'::text, 'scene'::text, 'badge'::text]))),
    CONSTRAINT mission_assets_check CHECK ((((access_level = 'public'::text) AND (storage_bucket = 'mission-public'::text)) OR ((access_level = 'owner'::text) AND (storage_bucket = 'mission-private'::text)))),
    CONSTRAINT mission_assets_height_check CHECK (((height IS NULL) OR (height > 0))),
    CONSTRAINT mission_assets_metadata_check CHECK ((jsonb_typeof(metadata) = 'object'::text)),
    CONSTRAINT mission_assets_storage_bucket_check CHECK ((storage_bucket = ANY (ARRAY['mission-public'::text, 'mission-private'::text]))),
    CONSTRAINT mission_assets_width_check CHECK (((width IS NULL) OR (width > 0)))
);


--
-- Name: mission_characters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_characters (
    mission_id uuid NOT NULL,
    character_id uuid NOT NULL,
    is_recommended boolean DEFAULT false NOT NULL,
    role_override text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: mission_evaluations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_evaluations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mission_run_id uuid NOT NULL,
    generation_job_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    evaluator_model_id text NOT NULL,
    total_score numeric(5,2),
    passed boolean,
    rubric_scores jsonb DEFAULT '{}'::jsonb NOT NULL,
    feedback jsonb DEFAULT '{}'::jsonb NOT NULL,
    corrections jsonb DEFAULT '[]'::jsonb NOT NULL,
    completed_learning_goals jsonb DEFAULT '[]'::jsonb NOT NULL,
    vocabulary_observed jsonb DEFAULT '[]'::jsonb NOT NULL,
    raw_response jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT mission_evaluations_completed_learning_goals_check CHECK ((jsonb_typeof(completed_learning_goals) = 'array'::text)),
    CONSTRAINT mission_evaluations_corrections_check CHECK ((jsonb_typeof(corrections) = 'array'::text)),
    CONSTRAINT mission_evaluations_feedback_check CHECK ((jsonb_typeof(feedback) = 'object'::text)),
    CONSTRAINT mission_evaluations_rubric_scores_check CHECK ((jsonb_typeof(rubric_scores) = 'object'::text)),
    CONSTRAINT mission_evaluations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text]))),
    CONSTRAINT mission_evaluations_total_score_check CHECK (((total_score IS NULL) OR ((total_score >= (0)::numeric) AND (total_score <= (100)::numeric)))),
    CONSTRAINT mission_evaluations_vocabulary_observed_check CHECK ((jsonb_typeof(vocabulary_observed) = 'array'::text))
);


--
-- Name: mission_favorite_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_favorite_requests (
    user_id uuid NOT NULL,
    request_id uuid NOT NULL,
    mission_id uuid NOT NULL,
    saved boolean NOT NULL
);


--
-- Name: mission_favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_favorites (
    user_id uuid NOT NULL,
    mission_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: mission_rewards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_rewards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mission_id uuid NOT NULL,
    mission_version_id uuid NOT NULL,
    character_asset_id uuid NOT NULL,
    minimum_score numeric(5,2) DEFAULT 0 NOT NULL,
    minimum_stars smallint DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT mission_rewards_minimum_score_check CHECK (((minimum_score >= (0)::numeric) AND (minimum_score <= (100)::numeric))),
    CONSTRAINT mission_rewards_minimum_stars_check CHECK (((minimum_stars >= 1) AND (minimum_stars <= 3)))
);


--
-- Name: TABLE mission_rewards; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.mission_rewards IS 'Server-managed mapping from a versioned mission to a private reward character image.';


--
-- Name: mission_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    mission_id uuid NOT NULL,
    mission_version_id uuid NOT NULL,
    character_id uuid NOT NULL,
    character_version_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    status text DEFAULT 'not-started'::text NOT NULL,
    current_step_order integer DEFAULT 1 NOT NULL,
    attempt_number integer DEFAULT 1 NOT NULL,
    score numeric(5,2),
    stars smallint,
    awarded_mission_reward_id uuid,
    awarded_evaluation_id uuid,
    turn_count integer DEFAULT 0 NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT mission_runs_attempt_number_check CHECK ((attempt_number > 0)),
    CONSTRAINT mission_runs_check CHECK (((completed_at IS NULL) OR (started_at IS NULL) OR (completed_at >= started_at))),
    CONSTRAINT mission_runs_check1 CHECK (((status <> 'passed'::text) OR ((awarded_mission_reward_id IS NOT NULL) AND (awarded_evaluation_id IS NOT NULL)))),
    CONSTRAINT mission_runs_current_step_order_check CHECK ((current_step_order > 0)),
    CONSTRAINT mission_runs_score_check CHECK (((score IS NULL) OR ((score >= (0)::numeric) AND (score <= (100)::numeric)))),
    CONSTRAINT mission_runs_stars_check CHECK (((stars IS NULL) OR ((stars >= 0) AND (stars <= 3)))),
    CONSTRAINT mission_runs_status_check CHECK ((status = ANY (ARRAY['not-started'::text, 'in-progress'::text, 'evaluating'::text, 'passed'::text, 'failed'::text, 'abandoned'::text]))),
    CONSTRAINT mission_runs_turn_count_check CHECK ((turn_count >= 0))
);

ALTER TABLE ONLY public.mission_runs REPLICA IDENTITY FULL;


--
-- Name: mission_step_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_step_progress (
    mission_run_id uuid NOT NULL,
    mission_step_id uuid NOT NULL,
    status text DEFAULT 'locked'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    evidence_message_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    score numeric(5,2),
    feedback text,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT mission_step_progress_attempts_check CHECK ((attempts >= 0)),
    CONSTRAINT mission_step_progress_score_check CHECK (((score IS NULL) OR ((score >= (0)::numeric) AND (score <= (100)::numeric)))),
    CONSTRAINT mission_step_progress_status_check CHECK ((status = ANY (ARRAY['locked'::text, 'active'::text, 'completed'::text, 'skipped'::text])))
);


--
-- Name: mission_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mission_version_id uuid NOT NULL,
    step_order integer NOT NULL,
    title text NOT NULL,
    objective text NOT NULL,
    learner_goal text NOT NULL,
    character_instruction text NOT NULL,
    success_criteria jsonb DEFAULT '[]'::jsonb NOT NULL,
    hints jsonb DEFAULT '[]'::jsonb NOT NULL,
    vocabulary jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_optional boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT mission_steps_hints_check CHECK ((jsonb_typeof(hints) = 'array'::text)),
    CONSTRAINT mission_steps_step_order_check CHECK ((step_order > 0)),
    CONSTRAINT mission_steps_success_criteria_check CHECK ((jsonb_typeof(success_criteria) = 'array'::text)),
    CONSTRAINT mission_steps_vocabulary_check CHECK ((jsonb_typeof(vocabulary) = 'array'::text))
);


--
-- Name: mission_version_instructions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_version_instructions (
    mission_version_id uuid NOT NULL,
    director_prompt text NOT NULL,
    evaluator_prompt text NOT NULL,
    safety_instructions text DEFAULT ''::text NOT NULL,
    evaluator_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT mission_version_instructions_evaluator_config_check CHECK ((jsonb_typeof(evaluator_config) = 'object'::text))
);


--
-- Name: TABLE mission_version_instructions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.mission_version_instructions IS 'Server-only director and evaluator prompts. anon/authenticated grants are revoked below.';


--
-- Name: mission_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mission_id uuid NOT NULL,
    version_number integer NOT NULL,
    change_summary text DEFAULT ''::text NOT NULL,
    learning_goals jsonb NOT NULL,
    scenario_context text NOT NULL,
    learner_role text NOT NULL,
    character_role text NOT NULL,
    opening_instruction text NOT NULL,
    target_vocabulary jsonb DEFAULT '[]'::jsonb NOT NULL,
    target_grammar jsonb DEFAULT '[]'::jsonb NOT NULL,
    pass_score numeric(5,2) DEFAULT 70 NOT NULL,
    maximum_turns integer DEFAULT 20 NOT NULL,
    locale text DEFAULT 'en-US'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    published_at timestamp with time zone,
    display_metadata jsonb,
    CONSTRAINT mission_versions_display_metadata_check CHECK (((display_metadata IS NULL) OR (jsonb_typeof(display_metadata) = 'object'::text))),
    CONSTRAINT mission_versions_learning_goals_check CHECK (((jsonb_typeof(learning_goals) = 'array'::text) AND (jsonb_array_length(learning_goals) > 0))),
    CONSTRAINT mission_versions_maximum_turns_check CHECK (((maximum_turns >= 1) AND (maximum_turns <= 100))),
    CONSTRAINT mission_versions_pass_score_check CHECK (((pass_score >= (0)::numeric) AND (pass_score <= (100)::numeric))),
    CONSTRAINT mission_versions_target_grammar_check CHECK ((jsonb_typeof(target_grammar) = 'array'::text)),
    CONSTRAINT mission_versions_target_vocabulary_check CHECK ((jsonb_typeof(target_vocabulary) = 'array'::text)),
    CONSTRAINT mission_versions_version_number_check CHECK ((version_number > 0))
);


--
-- Name: COLUMN mission_versions.published_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mission_versions.published_at IS 'Once set, the version, steps, rewards, and server-only instructions are immutable.';


--
-- Name: COLUMN mission_versions.display_metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mission_versions.display_metadata IS 'Public display fields captured by the database on first publication; NULL means historical metadata is unknown. Does not define reward grants.';


--
-- Name: missions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.missions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid,
    slug extensions.citext NOT NULL,
    title text NOT NULL,
    summary text DEFAULT ''::text NOT NULL,
    scenario_category text NOT NULL,
    difficulty text DEFAULT 'A1'::text NOT NULL,
    estimated_minutes integer DEFAULT 10 NOT NULL,
    visibility text DEFAULT 'private'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    current_version_id uuid,
    reward_experience_points integer DEFAULT 50 NOT NULL,
    featured boolean DEFAULT false NOT NULL,
    completion_count bigint DEFAULT 0 NOT NULL,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    search_document tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, ((((COALESCE(title, ''::text) || ' '::text) || COALESCE(summary, ''::text)) || ' '::text) || COALESCE(scenario_category, ''::text)))) STORED,
    CONSTRAINT missions_check CHECK (((owner_id IS NOT NULL) OR (status = ANY (ARRAY['published'::text, 'archived'::text])))),
    CONSTRAINT missions_check1 CHECK (((status <> 'published'::text) OR (current_version_id IS NOT NULL))),
    CONSTRAINT missions_completion_count_check CHECK ((completion_count >= 0)),
    CONSTRAINT missions_difficulty_check CHECK ((difficulty = ANY (ARRAY['pre-A1'::text, 'A1'::text, 'A2'::text, 'B1'::text, 'B2'::text, 'C1'::text, 'C2'::text]))),
    CONSTRAINT missions_estimated_minutes_check CHECK (((estimated_minutes >= 1) AND (estimated_minutes <= 180))),
    CONSTRAINT missions_reward_experience_points_check CHECK ((reward_experience_points >= 0)),
    CONSTRAINT missions_slug_check CHECK (((slug)::text ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)),
    CONSTRAINT missions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'generating'::text, 'review'::text, 'published'::text, 'archived'::text]))),
    CONSTRAINT missions_summary_check CHECK ((char_length(summary) <= 500)),
    CONSTRAINT missions_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 120))),
    CONSTRAINT missions_visibility_check CHECK ((visibility = ANY (ARRAY['private'::text, 'unlisted'::text, 'public'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    username extensions.citext,
    display_name text DEFAULT 'English Learner'::text NOT NULL,
    avatar_path text,
    bio text DEFAULT ''::text NOT NULL,
    native_language text DEFAULT 'ko'::text NOT NULL,
    target_language text DEFAULT 'en'::text NOT NULL,
    cefr_level text DEFAULT 'A1'::text NOT NULL,
    daily_goal_minutes integer DEFAULT 10 NOT NULL,
    onboarding_completed boolean DEFAULT false NOT NULL,
    is_public boolean DEFAULT true NOT NULL,
    experience_points integer DEFAULT 0 NOT NULL,
    current_streak integer DEFAULT 0 NOT NULL,
    longest_streak integer DEFAULT 0 NOT NULL,
    last_learning_at timestamp with time zone,
    preferences jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT profiles_cefr_level_check CHECK ((cefr_level = ANY (ARRAY['pre-A1'::text, 'A1'::text, 'A2'::text, 'B1'::text, 'B2'::text, 'C1'::text, 'C2'::text]))),
    CONSTRAINT profiles_current_streak_check CHECK ((current_streak >= 0)),
    CONSTRAINT profiles_daily_goal_minutes_check CHECK (((daily_goal_minutes >= 1) AND (daily_goal_minutes <= 240))),
    CONSTRAINT profiles_experience_points_check CHECK ((experience_points >= 0)),
    CONSTRAINT profiles_longest_streak_check CHECK ((longest_streak >= 0)),
    CONSTRAINT profiles_preferences_check CHECK ((jsonb_typeof(preferences) = 'object'::text))
);


--
-- Name: response_regeneration_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.response_regeneration_requests (
    request_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    assistant_message_id uuid NOT NULL,
    user_message_id uuid NOT NULL
);


--
-- Name: reward_unlocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reward_unlocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    character_asset_id uuid NOT NULL,
    mission_reward_id uuid NOT NULL,
    mission_id uuid NOT NULL,
    mission_run_id uuid NOT NULL,
    mission_evaluation_id uuid,
    unlocked_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT reward_unlocks_metadata_check CHECK ((jsonb_typeof(metadata) = 'object'::text))
);


--
-- Name: stream_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stream_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    message_id uuid,
    resume_token_hash text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    transport_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT stream_sessions_check CHECK ((expires_at > created_at)),
    CONSTRAINT stream_sessions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'expired'::text, 'cancelled'::text]))),
    CONSTRAINT stream_sessions_transport_metadata_check CHECK ((jsonb_typeof(transport_metadata) = 'object'::text))
);


--
-- Name: user_entitlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_entitlements (
    user_id uuid NOT NULL,
    plan text DEFAULT 'free'::text NOT NULL,
    messages_per_hour integer DEFAULT 30 NOT NULL,
    image_generations_per_day integer DEFAULT 3 NOT NULL,
    speech_seconds_per_day integer DEFAULT 300 NOT NULL,
    active_from timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    active_until timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT user_entitlements_check CHECK (((active_until IS NULL) OR (active_until > active_from))),
    CONSTRAINT user_entitlements_image_generations_per_day_check CHECK ((image_generations_per_day >= 0)),
    CONSTRAINT user_entitlements_messages_per_hour_check CHECK ((messages_per_hour > 0)),
    CONSTRAINT user_entitlements_metadata_check CHECK ((jsonb_typeof(metadata) = 'object'::text)),
    CONSTRAINT user_entitlements_plan_check CHECK ((plan = ANY (ARRAY['free'::text, 'plus'::text, 'creator'::text, 'admin'::text]))),
    CONSTRAINT user_entitlements_speech_seconds_per_day_check CHECK ((speech_seconds_per_day >= 0))
);


--
-- Name: vocabulary_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vocabulary_progress (
    user_id uuid NOT NULL,
    normalized_term extensions.citext NOT NULL,
    display_term text NOT NULL,
    meaning text DEFAULT ''::text NOT NULL,
    mastery_level smallint DEFAULT 0 NOT NULL,
    exposure_count integer DEFAULT 0 NOT NULL,
    correct_use_count integer DEFAULT 0 NOT NULL,
    last_seen_at timestamp with time zone,
    next_review_at timestamp with time zone,
    source_mission_id uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT vocabulary_progress_correct_use_count_check CHECK ((correct_use_count >= 0)),
    CONSTRAINT vocabulary_progress_exposure_count_check CHECK ((exposure_count >= 0)),
    CONSTRAINT vocabulary_progress_mastery_level_check CHECK (((mastery_level >= 0) AND (mastery_level <= 5)))
);


--
-- Name: ai_usage_events ai_usage_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_events
    ADD CONSTRAINT ai_usage_events_pkey PRIMARY KEY (id);


--
-- Name: artifact_revision_requests artifact_revision_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifact_revision_requests
    ADD CONSTRAINT artifact_revision_requests_pkey PRIMARY KEY (request_id);


--
-- Name: artifact_suggestions artifact_suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifact_suggestions
    ADD CONSTRAINT artifact_suggestions_pkey PRIMARY KEY (id);


--
-- Name: artifact_versions artifact_versions_artifact_id_version_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifact_versions
    ADD CONSTRAINT artifact_versions_artifact_id_version_number_key UNIQUE (artifact_id, version_number);


--
-- Name: artifact_versions artifact_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifact_versions
    ADD CONSTRAINT artifact_versions_pkey PRIMARY KEY (id);


--
-- Name: artifacts artifacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifacts
    ADD CONSTRAINT artifacts_pkey PRIMARY KEY (id);


--
-- Name: character_assets character_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_assets
    ADD CONSTRAINT character_assets_pkey PRIMARY KEY (id);


--
-- Name: character_assets character_assets_storage_bucket_storage_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_assets
    ADD CONSTRAINT character_assets_storage_bucket_storage_path_key UNIQUE (storage_bucket, storage_path);


--
-- Name: character_favorites character_favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_favorites
    ADD CONSTRAINT character_favorites_pkey PRIMARY KEY (user_id, character_id);


--
-- Name: character_reports character_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_reports
    ADD CONSTRAINT character_reports_pkey PRIMARY KEY (id);


--
-- Name: character_tags character_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_tags
    ADD CONSTRAINT character_tags_pkey PRIMARY KEY (character_id, tag);


--
-- Name: character_version_instructions character_version_instructions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_version_instructions
    ADD CONSTRAINT character_version_instructions_pkey PRIMARY KEY (character_version_id);


--
-- Name: character_versions character_versions_character_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_versions
    ADD CONSTRAINT character_versions_character_id_id_key UNIQUE (character_id, id);


--
-- Name: character_versions character_versions_character_id_version_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_versions
    ADD CONSTRAINT character_versions_character_id_version_number_key UNIQUE (character_id, version_number);


--
-- Name: character_versions character_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_versions
    ADD CONSTRAINT character_versions_pkey PRIMARY KEY (id);


--
-- Name: characters characters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characters
    ADD CONSTRAINT characters_pkey PRIMARY KEY (id);


--
-- Name: characters characters_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characters
    ADD CONSTRAINT characters_slug_key UNIQUE (slug);


--
-- Name: chat_file_uploads chat_file_uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_file_uploads
    ADD CONSTRAINT chat_file_uploads_pkey PRIMARY KEY (id);


--
-- Name: chat_file_uploads chat_file_uploads_storage_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_file_uploads
    ADD CONSTRAINT chat_file_uploads_storage_path_key UNIQUE (storage_path);


--
-- Name: chat_generations chat_generations_assistant_message_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_generations
    ADD CONSTRAINT chat_generations_assistant_message_id_key UNIQUE (assistant_message_id);


--
-- Name: chat_generations chat_generations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_generations
    ADD CONSTRAINT chat_generations_pkey PRIMARY KEY (user_message_id);


--
-- Name: conversation_clear_requests conversation_clear_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_clear_requests
    ADD CONSTRAINT conversation_clear_requests_pkey PRIMARY KEY (conversation_id, request_id);


--
-- Name: conversation_purge_requests conversation_purge_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_purge_requests
    ADD CONSTRAINT conversation_purge_requests_pkey PRIMARY KEY (owner_id, request_id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_share_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_share_token_key UNIQUE (share_token);


--
-- Name: daily_learning_stats daily_learning_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_learning_stats
    ADD CONSTRAINT daily_learning_stats_pkey PRIMARY KEY (user_id, learning_date);


--
-- Name: generation_jobs generation_jobs_owner_id_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generation_jobs
    ADD CONSTRAINT generation_jobs_owner_id_idempotency_key_key UNIQUE (owner_id, idempotency_key);


--
-- Name: generation_jobs generation_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generation_jobs
    ADD CONSTRAINT generation_jobs_pkey PRIMARY KEY (id);


--
-- Name: learner_preferences learner_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_preferences
    ADD CONSTRAINT learner_preferences_pkey PRIMARY KEY (user_id);


--
-- Name: learning_activity_clocks learning_activity_clocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_activity_clocks
    ADD CONSTRAINT learning_activity_clocks_pkey PRIMARY KEY (user_id);


--
-- Name: learning_activity_receipts learning_activity_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_activity_receipts
    ADD CONSTRAINT learning_activity_receipts_pkey PRIMARY KEY (user_id, request_id);


--
-- Name: learning_notebook_entries learning_notebook_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_notebook_entries
    ADD CONSTRAINT learning_notebook_entries_pkey PRIMARY KEY (user_id, id);


--
-- Name: learning_notebook_requests learning_notebook_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_notebook_requests
    ADD CONSTRAINT learning_notebook_requests_pkey PRIMARY KEY (user_id, request_id);


--
-- Name: message_attachments message_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_attachments
    ADD CONSTRAINT message_attachments_pkey PRIMARY KEY (id);


--
-- Name: message_attachments message_attachments_storage_bucket_storage_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_attachments
    ADD CONSTRAINT message_attachments_storage_bucket_storage_path_key UNIQUE (storage_bucket, storage_path);


--
-- Name: message_audio message_audio_message_id_owner_id_message_revision_text_has_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_audio
    ADD CONSTRAINT message_audio_message_id_owner_id_message_revision_text_has_key UNIQUE (message_id, owner_id, message_revision, text_hash, model_id, voice_id, speaking_rate);


--
-- Name: message_audio message_audio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_audio
    ADD CONSTRAINT message_audio_pkey PRIMARY KEY (id);


--
-- Name: message_audio message_audio_storage_bucket_storage_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_audio
    ADD CONSTRAINT message_audio_storage_bucket_storage_path_key UNIQUE (storage_bucket, storage_path);


--
-- Name: message_branch_requests message_branch_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_branch_requests
    ADD CONSTRAINT message_branch_requests_pkey PRIMARY KEY (request_id);


--
-- Name: message_feedback message_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_feedback
    ADD CONSTRAINT message_feedback_pkey PRIMARY KEY (user_id, message_id);


--
-- Name: messages messages_conversation_id_client_message_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_client_message_id_key UNIQUE (conversation_id, client_message_id);


--
-- Name: messages messages_conversation_id_sequence_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_sequence_number_key UNIQUE (conversation_id, sequence_number);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: mission_assets mission_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_assets
    ADD CONSTRAINT mission_assets_pkey PRIMARY KEY (id);


--
-- Name: mission_assets mission_assets_storage_bucket_storage_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_assets
    ADD CONSTRAINT mission_assets_storage_bucket_storage_path_key UNIQUE (storage_bucket, storage_path);


--
-- Name: mission_characters mission_characters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_characters
    ADD CONSTRAINT mission_characters_pkey PRIMARY KEY (mission_id, character_id);


--
-- Name: mission_evaluations mission_evaluations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_evaluations
    ADD CONSTRAINT mission_evaluations_pkey PRIMARY KEY (id);


--
-- Name: mission_favorite_requests mission_favorite_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_favorite_requests
    ADD CONSTRAINT mission_favorite_requests_pkey PRIMARY KEY (user_id, request_id);


--
-- Name: mission_favorites mission_favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_favorites
    ADD CONSTRAINT mission_favorites_pkey PRIMARY KEY (user_id, mission_id);


--
-- Name: mission_rewards mission_rewards_mission_version_id_character_asset_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_rewards
    ADD CONSTRAINT mission_rewards_mission_version_id_character_asset_id_key UNIQUE (mission_version_id, character_asset_id);


--
-- Name: mission_rewards mission_rewards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_rewards
    ADD CONSTRAINT mission_rewards_pkey PRIMARY KEY (id);


--
-- Name: mission_runs mission_runs_conversation_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_runs
    ADD CONSTRAINT mission_runs_conversation_id_key UNIQUE (conversation_id);


--
-- Name: mission_runs mission_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_runs
    ADD CONSTRAINT mission_runs_pkey PRIMARY KEY (id);


--
-- Name: mission_step_progress mission_step_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_step_progress
    ADD CONSTRAINT mission_step_progress_pkey PRIMARY KEY (mission_run_id, mission_step_id);


--
-- Name: mission_steps mission_steps_mission_version_id_step_order_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_steps
    ADD CONSTRAINT mission_steps_mission_version_id_step_order_key UNIQUE (mission_version_id, step_order);


--
-- Name: mission_steps mission_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_steps
    ADD CONSTRAINT mission_steps_pkey PRIMARY KEY (id);


--
-- Name: mission_version_instructions mission_version_instructions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_version_instructions
    ADD CONSTRAINT mission_version_instructions_pkey PRIMARY KEY (mission_version_id);


--
-- Name: mission_versions mission_versions_mission_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_versions
    ADD CONSTRAINT mission_versions_mission_id_id_key UNIQUE (mission_id, id);


--
-- Name: mission_versions mission_versions_mission_id_version_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_versions
    ADD CONSTRAINT mission_versions_mission_id_version_number_key UNIQUE (mission_id, version_number);


--
-- Name: mission_versions mission_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_versions
    ADD CONSTRAINT mission_versions_pkey PRIMARY KEY (id);


--
-- Name: missions missions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_pkey PRIMARY KEY (id);


--
-- Name: missions missions_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_slug_key UNIQUE (slug);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: response_regeneration_requests response_regeneration_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.response_regeneration_requests
    ADD CONSTRAINT response_regeneration_requests_pkey PRIMARY KEY (request_id);


--
-- Name: reward_unlocks reward_unlocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_unlocks
    ADD CONSTRAINT reward_unlocks_pkey PRIMARY KEY (id);


--
-- Name: reward_unlocks reward_unlocks_user_id_character_asset_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_unlocks
    ADD CONSTRAINT reward_unlocks_user_id_character_asset_id_key UNIQUE (user_id, character_asset_id);


--
-- Name: stream_sessions stream_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stream_sessions
    ADD CONSTRAINT stream_sessions_pkey PRIMARY KEY (id);


--
-- Name: stream_sessions stream_sessions_resume_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stream_sessions
    ADD CONSTRAINT stream_sessions_resume_token_hash_key UNIQUE (resume_token_hash);


--
-- Name: user_entitlements user_entitlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_entitlements
    ADD CONSTRAINT user_entitlements_pkey PRIMARY KEY (user_id);


--
-- Name: vocabulary_progress vocabulary_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vocabulary_progress
    ADD CONSTRAINT vocabulary_progress_pkey PRIMARY KEY (user_id, normalized_term);


--
-- Name: ai_usage_events_user_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_usage_events_user_time_idx ON public.ai_usage_events USING btree (user_id, occurred_at DESC);


--
-- Name: artifact_revision_requests_artifact_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX artifact_revision_requests_artifact_idx ON public.artifact_revision_requests USING btree (artifact_id);


--
-- Name: artifact_revision_requests_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX artifact_revision_requests_owner_idx ON public.artifact_revision_requests USING btree (owner_id);


--
-- Name: artifact_versions_artifact_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX artifact_versions_artifact_idx ON public.artifact_versions USING btree (artifact_id, version_number DESC);


--
-- Name: artifacts_conversation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX artifacts_conversation_idx ON public.artifacts USING btree (conversation_id, updated_at DESC);


--
-- Name: character_assets_character_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX character_assets_character_idx ON public.character_assets USING btree (character_id, asset_type, sort_order);


--
-- Name: character_assets_one_primary_per_version_type; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX character_assets_one_primary_per_version_type ON public.character_assets USING btree (character_id, character_version_id, asset_type) WHERE (is_primary AND (character_version_id IS NOT NULL));


--
-- Name: character_favorites_character_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX character_favorites_character_idx ON public.character_favorites USING btree (character_id, created_at DESC);


--
-- Name: character_reports_one_open_per_reporter; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX character_reports_one_open_per_reporter ON public.character_reports USING btree (reporter_id, character_id) WHERE (status = ANY (ARRAY['pending'::text, 'reviewing'::text]));


--
-- Name: character_reports_review_queue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX character_reports_review_queue ON public.character_reports USING btree (status, created_at);


--
-- Name: character_tags_tag_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX character_tags_tag_idx ON public.character_tags USING btree (tag, character_id);


--
-- Name: character_versions_character_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX character_versions_character_idx ON public.character_versions USING btree (character_id, version_number DESC);


--
-- Name: characters_discovery_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX characters_discovery_idx ON public.characters USING btree (status, visibility, featured DESC, published_at DESC);


--
-- Name: characters_owner_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX characters_owner_created_idx ON public.characters USING btree (owner_id, created_at DESC);


--
-- Name: characters_search_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX characters_search_idx ON public.characters USING gin (search_document);


--
-- Name: chat_file_uploads_conversation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_file_uploads_conversation_idx ON public.chat_file_uploads USING btree (conversation_id);


--
-- Name: conversations_character_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversations_character_idx ON public.conversations USING btree (character_id, created_at DESC);


--
-- Name: conversations_owner_recent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversations_owner_recent_idx ON public.conversations USING btree (owner_id, status, last_message_at DESC NULLS LAST, created_at DESC);


--
-- Name: daily_learning_stats_user_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX daily_learning_stats_user_date_idx ON public.daily_learning_stats USING btree (user_id, learning_date DESC);


--
-- Name: generation_jobs_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX generation_jobs_owner_idx ON public.generation_jobs USING btree (owner_id, created_at DESC);


--
-- Name: generation_jobs_queue_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX generation_jobs_queue_idx ON public.generation_jobs USING btree (status, available_at, created_at) WHERE (status = ANY (ARRAY['queued'::text, 'running'::text]));


--
-- Name: learning_notebook_identity; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX learning_notebook_identity ON public.learning_notebook_entries USING btree (user_id, md5(identity_key));


--
-- Name: message_attachments_message_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_attachments_message_idx ON public.message_attachments USING btree (message_id);


--
-- Name: messages_conversation_sequence_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_conversation_sequence_idx ON public.messages USING btree (conversation_id, sequence_number);


--
-- Name: messages_parent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_parent_idx ON public.messages USING btree (parent_message_id);


--
-- Name: mission_assets_one_primary_per_type; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX mission_assets_one_primary_per_type ON public.mission_assets USING btree (mission_id, asset_type) WHERE is_primary;


--
-- Name: mission_characters_character_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_characters_character_idx ON public.mission_characters USING btree (character_id, mission_id);


--
-- Name: mission_evaluations_run_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_evaluations_run_idx ON public.mission_evaluations USING btree (mission_run_id, created_at DESC);


--
-- Name: mission_favorites_mission_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_favorites_mission_idx ON public.mission_favorites USING btree (mission_id, created_at DESC);


--
-- Name: mission_rewards_mission_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_rewards_mission_idx ON public.mission_rewards USING btree (mission_id, mission_version_id, sort_order) WHERE is_active;


--
-- Name: mission_runs_mission_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_runs_mission_status_idx ON public.mission_runs USING btree (mission_id, status, completed_at DESC);


--
-- Name: mission_runs_owner_recent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_runs_owner_recent_idx ON public.mission_runs USING btree (owner_id, created_at DESC);


--
-- Name: mission_versions_mission_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_versions_mission_idx ON public.mission_versions USING btree (mission_id, version_number DESC);


--
-- Name: missions_discovery_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX missions_discovery_idx ON public.missions USING btree (status, visibility, difficulty, featured DESC, published_at DESC);


--
-- Name: missions_owner_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX missions_owner_created_idx ON public.missions USING btree (owner_id, created_at DESC);


--
-- Name: missions_search_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX missions_search_idx ON public.missions USING gin (search_document);


--
-- Name: reward_unlocks_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reward_unlocks_user_idx ON public.reward_unlocks USING btree (user_id, unlocked_at DESC);


--
-- Name: stream_sessions_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stream_sessions_active_idx ON public.stream_sessions USING btree (user_id, expires_at) WHERE (status = 'active'::text);


--
-- Name: vocabulary_progress_review_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vocabulary_progress_review_idx ON public.vocabulary_progress USING btree (user_id, next_review_at) WHERE (mastery_level < 5);


--
-- Name: artifact_suggestions artifact_suggestions_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER artifact_suggestions_set_updated_at BEFORE UPDATE ON public.artifact_suggestions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: artifact_versions artifact_versions_prevent_published_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER artifact_versions_prevent_published_mutation BEFORE DELETE OR UPDATE ON public.artifact_versions FOR EACH ROW EXECUTE FUNCTION public.prevent_published_version_mutation();


--
-- Name: artifacts artifacts_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER artifacts_set_updated_at BEFORE UPDATE ON public.artifacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: artifacts artifacts_validate_current_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER artifacts_validate_current_version AFTER INSERT OR UPDATE OF current_version_id ON public.artifacts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_artifact_current_version();


--
-- Name: character_assets character_assets_prevent_published_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER character_assets_prevent_published_mutation BEFORE INSERT OR DELETE OR UPDATE ON public.character_assets FOR EACH ROW EXECUTE FUNCTION public.prevent_published_asset_mutation();


--
-- Name: character_version_instructions character_instructions_prevent_published_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER character_instructions_prevent_published_mutation BEFORE INSERT OR DELETE OR UPDATE ON public.character_version_instructions FOR EACH ROW EXECUTE FUNCTION public.prevent_published_character_instruction_mutation();


--
-- Name: character_version_instructions character_version_instructions_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER character_version_instructions_set_updated_at BEFORE UPDATE ON public.character_version_instructions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: character_versions character_versions_capture_display_metadata; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER character_versions_capture_display_metadata BEFORE INSERT OR UPDATE ON public.character_versions FOR EACH ROW EXECUTE FUNCTION public.capture_version_display_metadata();


--
-- Name: character_versions character_versions_prevent_published_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER character_versions_prevent_published_mutation BEFORE DELETE OR UPDATE ON public.character_versions FOR EACH ROW EXECUTE FUNCTION public.prevent_published_version_mutation();


--
-- Name: characters characters_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER characters_set_updated_at BEFORE UPDATE ON public.characters FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: characters characters_validate_current_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER characters_validate_current_version AFTER INSERT OR UPDATE OF current_version_id ON public.characters DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_character_current_version();


--
-- Name: conversations conversations_mission_prerequisites; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER conversations_mission_prerequisites BEFORE INSERT OR UPDATE OF owner_id, mission_id, mission_version_id ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.guard_mission_prerequisites();


--
-- Name: conversations conversations_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER conversations_set_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: daily_learning_stats daily_learning_stats_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER daily_learning_stats_set_updated_at BEFORE UPDATE ON public.daily_learning_stats FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: generation_jobs generation_jobs_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER generation_jobs_set_updated_at BEFORE UPDATE ON public.generation_jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: message_feedback message_feedback_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER message_feedback_set_updated_at BEFORE UPDATE ON public.message_feedback FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: messages messages_private_file_refs; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER messages_private_file_refs BEFORE INSERT OR UPDATE OF parts, conversation_id, author_id, role ON public.messages FOR EACH ROW EXECUTE FUNCTION public.validate_chat_file_parts();


--
-- Name: messages messages_record_learning_activity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER messages_record_learning_activity AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.record_learner_message_activity();


--
-- Name: messages messages_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER messages_set_updated_at BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: messages messages_touch_conversation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER messages_touch_conversation AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.touch_conversation_after_message();


--
-- Name: messages messages_validate_parent_and_parts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER messages_validate_parent_and_parts BEFORE INSERT OR UPDATE OF conversation_id, role, parts, parent_message_id ON public.messages FOR EACH ROW EXECUTE FUNCTION public.validate_message_parent_and_parts();


--
-- Name: mission_assets mission_assets_prevent_published_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mission_assets_prevent_published_mutation BEFORE INSERT OR DELETE OR UPDATE ON public.mission_assets FOR EACH ROW EXECUTE FUNCTION public.prevent_published_asset_mutation();


--
-- Name: mission_characters mission_characters_prevent_published_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mission_characters_prevent_published_mutation BEFORE INSERT OR DELETE OR UPDATE ON public.mission_characters FOR EACH ROW EXECUTE FUNCTION public.prevent_published_mission_character_mutation();


--
-- Name: mission_version_instructions mission_instructions_prevent_published_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mission_instructions_prevent_published_mutation BEFORE INSERT OR DELETE OR UPDATE ON public.mission_version_instructions FOR EACH ROW EXECUTE FUNCTION public.prevent_published_mission_child_mutation();


--
-- Name: mission_rewards mission_rewards_prevent_published_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mission_rewards_prevent_published_mutation BEFORE INSERT OR DELETE OR UPDATE ON public.mission_rewards FOR EACH ROW EXECUTE FUNCTION public.prevent_published_mission_child_mutation();


--
-- Name: mission_rewards mission_rewards_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mission_rewards_set_updated_at BEFORE UPDATE ON public.mission_rewards FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: mission_rewards mission_rewards_validate_definition; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mission_rewards_validate_definition BEFORE INSERT OR UPDATE OF mission_id, mission_version_id, character_asset_id, is_active ON public.mission_rewards FOR EACH ROW EXECUTE FUNCTION public.validate_mission_reward_definition();


--
-- Name: mission_runs mission_runs_prerequisites; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mission_runs_prerequisites BEFORE INSERT OR UPDATE OF owner_id, mission_id, mission_version_id ON public.mission_runs FOR EACH ROW EXECUTE FUNCTION public.guard_mission_prerequisites();


--
-- Name: mission_runs mission_runs_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mission_runs_set_updated_at BEFORE UPDATE ON public.mission_runs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: mission_runs mission_runs_validate_context; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER mission_runs_validate_context AFTER INSERT OR UPDATE OF owner_id, conversation_id, character_id, character_version_id, mission_id, mission_version_id ON public.mission_runs DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_mission_run_context();


--
-- Name: mission_step_progress mission_step_progress_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mission_step_progress_set_updated_at BEFORE UPDATE ON public.mission_step_progress FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: mission_steps mission_steps_prevent_published_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mission_steps_prevent_published_mutation BEFORE INSERT OR DELETE OR UPDATE ON public.mission_steps FOR EACH ROW EXECUTE FUNCTION public.prevent_published_mission_child_mutation();


--
-- Name: mission_version_instructions mission_version_instructions_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mission_version_instructions_set_updated_at BEFORE UPDATE ON public.mission_version_instructions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: mission_versions mission_versions_capture_display_metadata; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mission_versions_capture_display_metadata BEFORE INSERT OR UPDATE ON public.mission_versions FOR EACH ROW EXECUTE FUNCTION public.capture_version_display_metadata();


--
-- Name: mission_versions mission_versions_prevent_published_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mission_versions_prevent_published_mutation BEFORE DELETE OR UPDATE ON public.mission_versions FOR EACH ROW EXECUTE FUNCTION public.prevent_published_version_mutation();


--
-- Name: missions missions_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER missions_set_updated_at BEFORE UPDATE ON public.missions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: missions missions_validate_current_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER missions_validate_current_version AFTER INSERT OR UPDATE OF current_version_id ON public.missions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_mission_current_version();


--
-- Name: profiles profiles_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: stream_sessions stream_sessions_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER stream_sessions_set_updated_at BEFORE UPDATE ON public.stream_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: user_entitlements user_entitlements_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_entitlements_set_updated_at BEFORE UPDATE ON public.user_entitlements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: vocabulary_progress vocabulary_progress_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER vocabulary_progress_set_updated_at BEFORE UPDATE ON public.vocabulary_progress FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: ai_usage_events ai_usage_events_generation_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_events
    ADD CONSTRAINT ai_usage_events_generation_job_id_fkey FOREIGN KEY (generation_job_id) REFERENCES public.generation_jobs(id) ON DELETE SET NULL;


--
-- Name: ai_usage_events ai_usage_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_events
    ADD CONSTRAINT ai_usage_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: artifact_revision_requests artifact_revision_requests_artifact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifact_revision_requests
    ADD CONSTRAINT artifact_revision_requests_artifact_id_fkey FOREIGN KEY (artifact_id) REFERENCES public.artifacts(id) ON DELETE CASCADE;


--
-- Name: artifact_revision_requests artifact_revision_requests_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifact_revision_requests
    ADD CONSTRAINT artifact_revision_requests_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: artifact_revision_requests artifact_revision_requests_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifact_revision_requests
    ADD CONSTRAINT artifact_revision_requests_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.artifact_versions(id) ON DELETE CASCADE;


--
-- Name: artifact_suggestions artifact_suggestions_artifact_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifact_suggestions
    ADD CONSTRAINT artifact_suggestions_artifact_version_id_fkey FOREIGN KEY (artifact_version_id) REFERENCES public.artifact_versions(id) ON DELETE CASCADE;


--
-- Name: artifact_suggestions artifact_suggestions_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifact_suggestions
    ADD CONSTRAINT artifact_suggestions_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: artifact_versions artifact_versions_artifact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifact_versions
    ADD CONSTRAINT artifact_versions_artifact_id_fkey FOREIGN KEY (artifact_id) REFERENCES public.artifacts(id) ON DELETE CASCADE;


--
-- Name: artifact_versions artifact_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifact_versions
    ADD CONSTRAINT artifact_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: artifact_versions artifact_versions_source_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifact_versions
    ADD CONSTRAINT artifact_versions_source_message_id_fkey FOREIGN KEY (source_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- Name: artifacts artifacts_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifacts
    ADD CONSTRAINT artifacts_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: artifacts artifacts_current_version_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifacts
    ADD CONSTRAINT artifacts_current_version_fk FOREIGN KEY (current_version_id) REFERENCES public.artifact_versions(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: artifacts artifacts_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifacts
    ADD CONSTRAINT artifacts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: character_assets character_assets_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_assets
    ADD CONSTRAINT character_assets_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.characters(id) ON DELETE CASCADE;


--
-- Name: character_assets character_assets_character_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_assets
    ADD CONSTRAINT character_assets_character_version_id_fkey FOREIGN KEY (character_version_id) REFERENCES public.character_versions(id) ON DELETE SET NULL;


--
-- Name: character_assets character_assets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_assets
    ADD CONSTRAINT character_assets_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: character_assets character_assets_generation_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_assets
    ADD CONSTRAINT character_assets_generation_job_id_fkey FOREIGN KEY (generation_job_id) REFERENCES public.generation_jobs(id) ON DELETE SET NULL;


--
-- Name: character_favorites character_favorites_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_favorites
    ADD CONSTRAINT character_favorites_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.characters(id) ON DELETE CASCADE;


--
-- Name: character_favorites character_favorites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_favorites
    ADD CONSTRAINT character_favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: character_reports character_reports_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_reports
    ADD CONSTRAINT character_reports_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.characters(id) ON DELETE CASCADE;


--
-- Name: character_reports character_reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_reports
    ADD CONSTRAINT character_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: character_reports character_reports_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_reports
    ADD CONSTRAINT character_reports_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: character_tags character_tags_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_tags
    ADD CONSTRAINT character_tags_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.characters(id) ON DELETE CASCADE;


--
-- Name: character_version_instructions character_version_instructions_character_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_version_instructions
    ADD CONSTRAINT character_version_instructions_character_version_id_fkey FOREIGN KEY (character_version_id) REFERENCES public.character_versions(id) ON DELETE CASCADE;


--
-- Name: character_versions character_versions_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_versions
    ADD CONSTRAINT character_versions_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.characters(id) ON DELETE CASCADE;


--
-- Name: character_versions character_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_versions
    ADD CONSTRAINT character_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: characters characters_current_version_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characters
    ADD CONSTRAINT characters_current_version_fk FOREIGN KEY (current_version_id) REFERENCES public.character_versions(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: characters characters_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characters
    ADD CONSTRAINT characters_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chat_file_uploads chat_file_uploads_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_file_uploads
    ADD CONSTRAINT chat_file_uploads_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: chat_file_uploads chat_file_uploads_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_file_uploads
    ADD CONSTRAINT chat_file_uploads_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chat_generations chat_generations_assistant_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_generations
    ADD CONSTRAINT chat_generations_assistant_message_id_fkey FOREIGN KEY (assistant_message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: chat_generations chat_generations_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_generations
    ADD CONSTRAINT chat_generations_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: chat_generations chat_generations_user_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_generations
    ADD CONSTRAINT chat_generations_user_message_id_fkey FOREIGN KEY (user_message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: conversation_clear_requests conversation_clear_requests_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_clear_requests
    ADD CONSTRAINT conversation_clear_requests_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: conversation_purge_requests conversation_purge_requests_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_purge_requests
    ADD CONSTRAINT conversation_purge_requests_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.characters(id) ON DELETE RESTRICT;


--
-- Name: conversations conversations_character_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_character_version_id_fkey FOREIGN KEY (character_version_id) REFERENCES public.character_versions(id) ON DELETE RESTRICT;


--
-- Name: conversations conversations_character_version_snapshot_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_character_version_snapshot_fk FOREIGN KEY (character_id, character_version_id) REFERENCES public.character_versions(character_id, id) ON DELETE RESTRICT;


--
-- Name: conversations conversations_mission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE SET NULL;


--
-- Name: conversations conversations_mission_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_mission_version_id_fkey FOREIGN KEY (mission_version_id) REFERENCES public.mission_versions(id) ON DELETE RESTRICT;


--
-- Name: conversations conversations_mission_version_snapshot_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_mission_version_snapshot_fk FOREIGN KEY (mission_id, mission_version_id) REFERENCES public.mission_versions(mission_id, id) ON DELETE RESTRICT;


--
-- Name: conversations conversations_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: daily_learning_stats daily_learning_stats_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_learning_stats
    ADD CONSTRAINT daily_learning_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: generation_jobs generation_jobs_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generation_jobs
    ADD CONSTRAINT generation_jobs_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: learner_preferences learner_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_preferences
    ADD CONSTRAINT learner_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: learning_activity_clocks learning_activity_clocks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_activity_clocks
    ADD CONSTRAINT learning_activity_clocks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: learning_activity_receipts learning_activity_receipts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_activity_receipts
    ADD CONSTRAINT learning_activity_receipts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: learning_notebook_entries learning_notebook_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_notebook_entries
    ADD CONSTRAINT learning_notebook_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: learning_notebook_requests learning_notebook_requests_user_id_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_notebook_requests
    ADD CONSTRAINT learning_notebook_requests_user_id_entry_id_fkey FOREIGN KEY (user_id, entry_id) REFERENCES public.learning_notebook_entries(user_id, id) ON DELETE CASCADE;


--
-- Name: message_attachments message_attachments_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_attachments
    ADD CONSTRAINT message_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: message_attachments message_attachments_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_attachments
    ADD CONSTRAINT message_attachments_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: message_audio message_audio_generation_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_audio
    ADD CONSTRAINT message_audio_generation_job_id_fkey FOREIGN KEY (generation_job_id) REFERENCES public.generation_jobs(id) ON DELETE SET NULL;


--
-- Name: message_audio message_audio_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_audio
    ADD CONSTRAINT message_audio_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: message_audio message_audio_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_audio
    ADD CONSTRAINT message_audio_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: message_branch_requests message_branch_requests_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_branch_requests
    ADD CONSTRAINT message_branch_requests_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: message_branch_requests message_branch_requests_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_branch_requests
    ADD CONSTRAINT message_branch_requests_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: message_feedback message_feedback_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_feedback
    ADD CONSTRAINT message_feedback_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: message_feedback message_feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_feedback
    ADD CONSTRAINT message_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: messages messages_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: messages messages_parent_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_parent_message_id_fkey FOREIGN KEY (parent_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- Name: mission_assets mission_assets_generation_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_assets
    ADD CONSTRAINT mission_assets_generation_job_id_fkey FOREIGN KEY (generation_job_id) REFERENCES public.generation_jobs(id) ON DELETE SET NULL;


--
-- Name: mission_assets mission_assets_mission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_assets
    ADD CONSTRAINT mission_assets_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE CASCADE;


--
-- Name: mission_assets mission_assets_mission_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_assets
    ADD CONSTRAINT mission_assets_mission_version_id_fkey FOREIGN KEY (mission_version_id) REFERENCES public.mission_versions(id) ON DELETE SET NULL;


--
-- Name: mission_characters mission_characters_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_characters
    ADD CONSTRAINT mission_characters_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.characters(id) ON DELETE CASCADE;


--
-- Name: mission_characters mission_characters_mission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_characters
    ADD CONSTRAINT mission_characters_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE CASCADE;


--
-- Name: mission_evaluations mission_evaluations_generation_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_evaluations
    ADD CONSTRAINT mission_evaluations_generation_job_id_fkey FOREIGN KEY (generation_job_id) REFERENCES public.generation_jobs(id) ON DELETE SET NULL;


--
-- Name: mission_evaluations mission_evaluations_mission_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_evaluations
    ADD CONSTRAINT mission_evaluations_mission_run_id_fkey FOREIGN KEY (mission_run_id) REFERENCES public.mission_runs(id) ON DELETE CASCADE;


--
-- Name: mission_favorite_requests mission_favorite_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_favorite_requests
    ADD CONSTRAINT mission_favorite_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mission_favorites mission_favorites_mission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_favorites
    ADD CONSTRAINT mission_favorites_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE CASCADE;


--
-- Name: mission_favorites mission_favorites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_favorites
    ADD CONSTRAINT mission_favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mission_rewards mission_rewards_character_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_rewards
    ADD CONSTRAINT mission_rewards_character_asset_id_fkey FOREIGN KEY (character_asset_id) REFERENCES public.character_assets(id) ON DELETE RESTRICT;


--
-- Name: mission_rewards mission_rewards_mission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_rewards
    ADD CONSTRAINT mission_rewards_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE CASCADE;


--
-- Name: mission_rewards mission_rewards_mission_id_mission_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_rewards
    ADD CONSTRAINT mission_rewards_mission_id_mission_version_id_fkey FOREIGN KEY (mission_id, mission_version_id) REFERENCES public.mission_versions(mission_id, id) ON DELETE CASCADE;


--
-- Name: mission_rewards mission_rewards_mission_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_rewards
    ADD CONSTRAINT mission_rewards_mission_version_id_fkey FOREIGN KEY (mission_version_id) REFERENCES public.mission_versions(id) ON DELETE CASCADE;


--
-- Name: mission_runs mission_runs_awarded_evaluation_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_runs
    ADD CONSTRAINT mission_runs_awarded_evaluation_fk FOREIGN KEY (awarded_evaluation_id) REFERENCES public.mission_evaluations(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: mission_runs mission_runs_awarded_mission_reward_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_runs
    ADD CONSTRAINT mission_runs_awarded_mission_reward_id_fkey FOREIGN KEY (awarded_mission_reward_id) REFERENCES public.mission_rewards(id) ON DELETE RESTRICT;


--
-- Name: mission_runs mission_runs_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_runs
    ADD CONSTRAINT mission_runs_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.characters(id) ON DELETE RESTRICT;


--
-- Name: mission_runs mission_runs_character_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_runs
    ADD CONSTRAINT mission_runs_character_version_id_fkey FOREIGN KEY (character_version_id) REFERENCES public.character_versions(id) ON DELETE RESTRICT;


--
-- Name: mission_runs mission_runs_character_version_snapshot_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_runs
    ADD CONSTRAINT mission_runs_character_version_snapshot_fk FOREIGN KEY (character_id, character_version_id) REFERENCES public.character_versions(character_id, id) ON DELETE RESTRICT;


--
-- Name: mission_runs mission_runs_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_runs
    ADD CONSTRAINT mission_runs_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: mission_runs mission_runs_mission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_runs
    ADD CONSTRAINT mission_runs_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE RESTRICT;


--
-- Name: mission_runs mission_runs_mission_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_runs
    ADD CONSTRAINT mission_runs_mission_version_id_fkey FOREIGN KEY (mission_version_id) REFERENCES public.mission_versions(id) ON DELETE RESTRICT;


--
-- Name: mission_runs mission_runs_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_runs
    ADD CONSTRAINT mission_runs_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mission_runs mission_runs_version_belongs_to_mission_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_runs
    ADD CONSTRAINT mission_runs_version_belongs_to_mission_fk FOREIGN KEY (mission_id, mission_version_id) REFERENCES public.mission_versions(mission_id, id) ON DELETE RESTRICT;


--
-- Name: mission_step_progress mission_step_progress_mission_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_step_progress
    ADD CONSTRAINT mission_step_progress_mission_run_id_fkey FOREIGN KEY (mission_run_id) REFERENCES public.mission_runs(id) ON DELETE CASCADE;


--
-- Name: mission_step_progress mission_step_progress_mission_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_step_progress
    ADD CONSTRAINT mission_step_progress_mission_step_id_fkey FOREIGN KEY (mission_step_id) REFERENCES public.mission_steps(id) ON DELETE RESTRICT;


--
-- Name: mission_steps mission_steps_mission_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_steps
    ADD CONSTRAINT mission_steps_mission_version_id_fkey FOREIGN KEY (mission_version_id) REFERENCES public.mission_versions(id) ON DELETE CASCADE;


--
-- Name: mission_version_instructions mission_version_instructions_mission_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_version_instructions
    ADD CONSTRAINT mission_version_instructions_mission_version_id_fkey FOREIGN KEY (mission_version_id) REFERENCES public.mission_versions(id) ON DELETE CASCADE;


--
-- Name: mission_versions mission_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_versions
    ADD CONSTRAINT mission_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: mission_versions mission_versions_mission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_versions
    ADD CONSTRAINT mission_versions_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE CASCADE;


--
-- Name: missions missions_current_version_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_current_version_fk FOREIGN KEY (current_version_id) REFERENCES public.mission_versions(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: missions missions_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: response_regeneration_requests response_regeneration_requests_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.response_regeneration_requests
    ADD CONSTRAINT response_regeneration_requests_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: response_regeneration_requests response_regeneration_requests_user_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.response_regeneration_requests
    ADD CONSTRAINT response_regeneration_requests_user_message_id_fkey FOREIGN KEY (user_message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: reward_unlocks reward_unlocks_character_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_unlocks
    ADD CONSTRAINT reward_unlocks_character_asset_id_fkey FOREIGN KEY (character_asset_id) REFERENCES public.character_assets(id) ON DELETE CASCADE;


--
-- Name: reward_unlocks reward_unlocks_mission_evaluation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_unlocks
    ADD CONSTRAINT reward_unlocks_mission_evaluation_id_fkey FOREIGN KEY (mission_evaluation_id) REFERENCES public.mission_evaluations(id) ON DELETE SET NULL;


--
-- Name: reward_unlocks reward_unlocks_mission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_unlocks
    ADD CONSTRAINT reward_unlocks_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE RESTRICT;


--
-- Name: reward_unlocks reward_unlocks_mission_reward_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_unlocks
    ADD CONSTRAINT reward_unlocks_mission_reward_id_fkey FOREIGN KEY (mission_reward_id) REFERENCES public.mission_rewards(id) ON DELETE RESTRICT;


--
-- Name: reward_unlocks reward_unlocks_mission_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_unlocks
    ADD CONSTRAINT reward_unlocks_mission_run_id_fkey FOREIGN KEY (mission_run_id) REFERENCES public.mission_runs(id) ON DELETE CASCADE;


--
-- Name: reward_unlocks reward_unlocks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_unlocks
    ADD CONSTRAINT reward_unlocks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: stream_sessions stream_sessions_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stream_sessions
    ADD CONSTRAINT stream_sessions_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: stream_sessions stream_sessions_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stream_sessions
    ADD CONSTRAINT stream_sessions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: stream_sessions stream_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stream_sessions
    ADD CONSTRAINT stream_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_entitlements user_entitlements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_entitlements
    ADD CONSTRAINT user_entitlements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: vocabulary_progress vocabulary_progress_source_mission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vocabulary_progress
    ADD CONSTRAINT vocabulary_progress_source_mission_id_fkey FOREIGN KEY (source_mission_id) REFERENCES public.missions(id) ON DELETE SET NULL;


--
-- Name: vocabulary_progress vocabulary_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vocabulary_progress
    ADD CONSTRAINT vocabulary_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ai_usage_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_usage_events ai_usage_events_select_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_usage_events_select_self ON public.ai_usage_events FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));


--
-- Name: artifact_revision_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.artifact_revision_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: artifact_suggestions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.artifact_suggestions ENABLE ROW LEVEL SECURITY;

--
-- Name: artifact_suggestions artifact_suggestions_delete_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY artifact_suggestions_delete_owned ON public.artifact_suggestions FOR DELETE TO authenticated USING (((owner_id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));


--
-- Name: artifact_suggestions artifact_suggestions_insert_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY artifact_suggestions_insert_owned ON public.artifact_suggestions FOR INSERT TO authenticated WITH CHECK (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.artifact_versions version
  WHERE ((version.id = artifact_suggestions.artifact_version_id) AND public.owns_artifact(version.artifact_id))))));


--
-- Name: artifact_suggestions artifact_suggestions_select_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY artifact_suggestions_select_owned ON public.artifact_suggestions FOR SELECT TO authenticated USING (((owner_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.artifact_versions version
  WHERE ((version.id = artifact_suggestions.artifact_version_id) AND public.owns_artifact(version.artifact_id)))) OR public.is_admin()));


--
-- Name: artifact_suggestions artifact_suggestions_update_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY artifact_suggestions_update_owned ON public.artifact_suggestions FOR UPDATE TO authenticated USING (((owner_id = ( SELECT auth.uid() AS uid)) OR public.is_admin())) WITH CHECK (((owner_id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));


--
-- Name: artifact_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.artifact_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: artifact_versions artifact_versions_delete_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY artifact_versions_delete_owned ON public.artifact_versions FOR DELETE TO authenticated USING (public.owns_artifact(artifact_id));


--
-- Name: artifact_versions artifact_versions_insert_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY artifact_versions_insert_owned ON public.artifact_versions FOR INSERT TO authenticated WITH CHECK ((public.owns_artifact(artifact_id) AND ((created_by = ( SELECT auth.uid() AS uid)) OR public.is_admin())));


--
-- Name: artifact_versions artifact_versions_select_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY artifact_versions_select_visible ON public.artifact_versions FOR SELECT USING ((public.owns_artifact(artifact_id) OR (EXISTS ( SELECT 1
   FROM public.artifacts artifact
  WHERE ((artifact.id = artifact_versions.artifact_id) AND (artifact.current_version_id = artifact_versions.id) AND (artifact.status = 'published'::text) AND public.can_view_conversation(artifact.conversation_id))))));


--
-- Name: artifact_versions artifact_versions_update_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY artifact_versions_update_owned ON public.artifact_versions FOR UPDATE TO authenticated USING (public.owns_artifact(artifact_id)) WITH CHECK (public.owns_artifact(artifact_id));


--
-- Name: artifacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.artifacts ENABLE ROW LEVEL SECURITY;

--
-- Name: artifacts artifacts_delete_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY artifacts_delete_owned ON public.artifacts FOR DELETE TO authenticated USING (((owner_id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));


--
-- Name: artifacts artifacts_insert_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY artifacts_insert_owned ON public.artifacts FOR INSERT TO authenticated WITH CHECK (((owner_id = ( SELECT auth.uid() AS uid)) AND public.owns_conversation(conversation_id)));


--
-- Name: artifacts artifacts_select_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY artifacts_select_visible ON public.artifacts FOR SELECT USING (((owner_id = ( SELECT auth.uid() AS uid)) OR ((status = 'published'::text) AND public.can_view_conversation(conversation_id)) OR public.is_admin()));


--
-- Name: artifacts artifacts_update_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY artifacts_update_owned ON public.artifacts FOR UPDATE TO authenticated USING (((owner_id = ( SELECT auth.uid() AS uid)) OR public.is_admin())) WITH CHECK (((owner_id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));


--
-- Name: character_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.character_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: character_assets character_assets_delete_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY character_assets_delete_owned ON public.character_assets FOR DELETE TO authenticated USING (public.owns_character(character_id));


--
-- Name: character_assets character_assets_insert_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY character_assets_insert_owned ON public.character_assets FOR INSERT TO authenticated WITH CHECK ((public.owns_character(character_id) AND ((created_by = ( SELECT auth.uid() AS uid)) OR public.is_admin())));


--
-- Name: character_assets character_assets_select_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY character_assets_select_visible ON public.character_assets FOR SELECT USING (public.can_view_character(character_id));


--
-- Name: character_assets character_assets_update_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY character_assets_update_owned ON public.character_assets FOR UPDATE TO authenticated USING (public.owns_character(character_id)) WITH CHECK (public.owns_character(character_id));


--
-- Name: character_favorites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.character_favorites ENABLE ROW LEVEL SECURITY;

--
-- Name: character_favorites character_favorites_delete_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY character_favorites_delete_self ON public.character_favorites FOR DELETE TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));


--
-- Name: character_favorites character_favorites_insert_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY character_favorites_insert_self ON public.character_favorites FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND public.can_view_character(character_id)));


--
-- Name: character_favorites character_favorites_select_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY character_favorites_select_self ON public.character_favorites FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));


--
-- Name: character_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.character_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: character_reports character_reports_select_self_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY character_reports_select_self_or_admin ON public.character_reports FOR SELECT TO authenticated USING (((reporter_id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));


--
-- Name: character_tags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.character_tags ENABLE ROW LEVEL SECURITY;

--
-- Name: character_tags character_tags_delete_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY character_tags_delete_owned ON public.character_tags FOR DELETE TO authenticated USING (public.owns_character(character_id));


--
-- Name: character_tags character_tags_insert_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY character_tags_insert_owned ON public.character_tags FOR INSERT TO authenticated WITH CHECK (public.owns_character(character_id));


--
-- Name: character_tags character_tags_select_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY character_tags_select_visible ON public.character_tags FOR SELECT USING (public.can_view_character(character_id));


--
-- Name: character_version_instructions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.character_version_instructions ENABLE ROW LEVEL SECURITY;

--
-- Name: character_version_instructions character_version_instructions_delete_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY character_version_instructions_delete_owned ON public.character_version_instructions FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.character_versions version
  WHERE ((version.id = character_version_instructions.character_version_id) AND public.owns_character(version.character_id)))));


--
-- Name: character_version_instructions character_version_instructions_insert_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY character_version_instructions_insert_owned ON public.character_version_instructions FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.character_versions version
  WHERE ((version.id = character_version_instructions.character_version_id) AND public.owns_character(version.character_id)))));


--
-- Name: character_version_instructions character_version_instructions_select_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY character_version_instructions_select_owned ON public.character_version_instructions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.character_versions version
  WHERE ((version.id = character_version_instructions.character_version_id) AND public.owns_character(version.character_id)))));


--
-- Name: character_version_instructions character_version_instructions_update_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY character_version_instructions_update_owned ON public.character_version_instructions FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.character_versions version
  WHERE ((version.id = character_version_instructions.character_version_id) AND public.owns_character(version.character_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.character_versions version
  WHERE ((version.id = character_version_instructions.character_version_id) AND public.owns_character(version.character_id)))));


--
-- Name: character_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.character_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: character_versions character_versions_delete_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY character_versions_delete_owned ON public.character_versions FOR DELETE TO authenticated USING (public.owns_character(character_id));


--
-- Name: character_versions character_versions_insert_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY character_versions_insert_owned ON public.character_versions FOR INSERT TO authenticated WITH CHECK ((public.owns_character(character_id) AND ((created_by = ( SELECT auth.uid() AS uid)) OR public.is_admin())));


--
-- Name: character_versions character_versions_select_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY character_versions_select_visible ON public.character_versions FOR SELECT USING ((public.owns_character(character_id) OR (EXISTS ( SELECT 1
   FROM public.characters "character"
  WHERE (("character".id = character_versions.character_id) AND ("character".current_version_id = character_versions.id) AND public.can_view_character("character".id))))));


--
-- Name: character_versions character_versions_update_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY character_versions_update_owned ON public.character_versions FOR UPDATE TO authenticated USING (public.owns_character(character_id)) WITH CHECK (public.owns_character(character_id));


--
-- Name: characters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;

--
-- Name: characters characters_delete_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY characters_delete_owned ON public.characters FOR DELETE TO authenticated USING (public.owns_character(id));


--
-- Name: characters characters_insert_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY characters_insert_owned ON public.characters FOR INSERT TO authenticated WITH CHECK (((owner_id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));


--
-- Name: characters characters_select_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY characters_select_visible ON public.characters FOR SELECT USING (public.can_view_character(id));


--
-- Name: characters characters_update_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY characters_update_owned ON public.characters FOR UPDATE TO authenticated USING (public.owns_character(id)) WITH CHECK (((owner_id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));


--
-- Name: chat_file_uploads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_file_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_generations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_generations ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_clear_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_clear_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_purge_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_purge_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations conversations_delete_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversations_delete_owned ON public.conversations FOR DELETE TO authenticated USING (public.owns_conversation(id));


--
-- Name: conversations conversations_insert_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversations_insert_owned ON public.conversations FOR INSERT TO authenticated WITH CHECK (((owner_id = ( SELECT auth.uid() AS uid)) AND public.can_view_character(character_id) AND (public.owns_character(character_id) OR (EXISTS ( SELECT 1
   FROM public.characters "character"
  WHERE (("character".id = conversations.character_id) AND ("character".current_version_id = conversations.character_version_id))))) AND ((mission_id IS NULL) OR (public.can_view_mission(mission_id) AND (public.owns_mission(mission_id) OR (EXISTS ( SELECT 1
   FROM public.missions mission
  WHERE ((mission.id = conversations.mission_id) AND (mission.current_version_id = conversations.mission_version_id)))))))));


--
-- Name: conversations conversations_select_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversations_select_visible ON public.conversations FOR SELECT USING ((((status <> 'deleted'::text) AND ((owner_id = ( SELECT auth.uid() AS uid)) OR (visibility = 'public'::text))) OR public.is_admin()));


--
-- Name: conversations conversations_update_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversations_update_owned ON public.conversations FOR UPDATE TO authenticated USING (public.owns_conversation(id)) WITH CHECK (((owner_id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));


--
-- Name: daily_learning_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.daily_learning_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_learning_stats daily_learning_stats_select_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY daily_learning_stats_select_self ON public.daily_learning_stats FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));


--
-- Name: generation_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: generation_jobs generation_jobs_select_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY generation_jobs_select_self ON public.generation_jobs FOR SELECT TO authenticated USING (((owner_id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));


--
-- Name: learner_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learner_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: learner_preferences learner_preferences_read_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY learner_preferences_read_self ON public.learner_preferences FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: learning_activity_clocks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learning_activity_clocks ENABLE ROW LEVEL SECURITY;

--
-- Name: learning_activity_receipts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learning_activity_receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: learning_notebook_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learning_notebook_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: learning_notebook_entries learning_notebook_read_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY learning_notebook_read_self ON public.learning_notebook_entries FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: learning_notebook_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learning_notebook_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: message_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: message_attachments message_attachments_delete_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY message_attachments_delete_owned ON public.message_attachments FOR DELETE TO authenticated USING (((owner_id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));


--
-- Name: message_attachments message_attachments_insert_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY message_attachments_insert_owned ON public.message_attachments FOR INSERT TO authenticated WITH CHECK (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.messages message
  WHERE ((message.id = message_attachments.message_id) AND public.owns_conversation(message.conversation_id))))));


--
-- Name: message_attachments message_attachments_select_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY message_attachments_select_visible ON public.message_attachments FOR SELECT TO authenticated USING (((owner_id = ( SELECT auth.uid() AS uid)) OR ((access_level = 'conversation'::text) AND (EXISTS ( SELECT 1
   FROM public.messages message
  WHERE ((message.id = message_attachments.message_id) AND public.can_view_conversation(message.conversation_id))))) OR public.is_admin()));


--
-- Name: message_attachments message_attachments_update_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY message_attachments_update_owned ON public.message_attachments FOR UPDATE TO authenticated USING (((owner_id = ( SELECT auth.uid() AS uid)) OR public.is_admin())) WITH CHECK (((owner_id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));


--
-- Name: message_audio; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.message_audio ENABLE ROW LEVEL SECURITY;

--
-- Name: message_audio message_audio_select_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY message_audio_select_self ON public.message_audio FOR SELECT TO authenticated USING (((owner_id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));


--
-- Name: message_branch_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.message_branch_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: message_feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.message_feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: message_feedback message_feedback_delete_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY message_feedback_delete_self ON public.message_feedback FOR DELETE TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));


--
-- Name: message_feedback message_feedback_insert_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY message_feedback_insert_self ON public.message_feedback FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.messages message
  WHERE ((message.id = message_feedback.message_id) AND public.can_view_conversation(message.conversation_id))))));


--
-- Name: message_feedback message_feedback_select_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY message_feedback_select_visible ON public.message_feedback FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.messages message
  WHERE ((message.id = message_feedback.message_id) AND public.can_view_conversation(message.conversation_id)))));


--
-- Name: message_feedback message_feedback_update_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY message_feedback_update_self ON public.message_feedback FOR UPDATE TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin())) WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));


--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: messages messages_delete_owned_conversation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_delete_owned_conversation ON public.messages FOR DELETE TO authenticated USING (public.owns_conversation(conversation_id));


--
-- Name: messages messages_insert_user_owned_conversation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_insert_user_owned_conversation ON public.messages FOR INSERT TO authenticated WITH CHECK ((public.owns_conversation(conversation_id) AND (role = 'user'::text) AND (author_id = ( SELECT auth.uid() AS uid))));


--
-- Name: messages messages_select_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_select_visible ON public.messages FOR SELECT USING ((((role <> 'system'::text) AND public.can_view_conversation(conversation_id)) OR public.is_admin()));


--
-- Name: messages messages_update_user_owned_conversation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_update_user_owned_conversation ON public.messages FOR UPDATE TO authenticated USING ((public.owns_conversation(conversation_id) AND (role = 'user'::text) AND (author_id = ( SELECT auth.uid() AS uid)))) WITH CHECK ((public.owns_conversation(conversation_id) AND (role = 'user'::text) AND (author_id = ( SELECT auth.uid() AS uid))));


--
-- Name: mission_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mission_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: mission_assets mission_assets_delete_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mission_assets_delete_owned ON public.mission_assets FOR DELETE TO authenticated USING (public.owns_mission(mission_id));


--
-- Name: mission_assets mission_assets_insert_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mission_assets_insert_owned ON public.mission_assets FOR INSERT TO authenticated WITH CHECK (public.owns_mission(mission_id));


--
-- Name: mission_assets mission_assets_select_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mission_assets_select_visible ON public.mission_assets FOR SELECT USING (public.can_view_mission(mission_id));


--
-- Name: mission_assets mission_assets_update_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mission_assets_update_owned ON public.mission_assets FOR UPDATE TO authenticated USING (public.owns_mission(mission_id)) WITH CHECK (public.owns_mission(mission_id));


--
-- Name: mission_characters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mission_characters ENABLE ROW LEVEL SECURITY;

--
-- Name: mission_characters mission_characters_delete_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mission_characters_delete_owned ON public.mission_characters FOR DELETE TO authenticated USING (public.owns_mission(mission_id));


--
-- Name: mission_characters mission_characters_insert_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mission_characters_insert_owned ON public.mission_characters FOR INSERT TO authenticated WITH CHECK ((public.owns_mission(mission_id) AND public.can_view_character(character_id)));


--
-- Name: mission_characters mission_characters_select_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mission_characters_select_visible ON public.mission_characters FOR SELECT USING ((public.can_view_mission(mission_id) AND public.can_view_character(character_id)));


--
-- Name: mission_characters mission_characters_update_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mission_characters_update_owned ON public.mission_characters FOR UPDATE TO authenticated USING (public.owns_mission(mission_id)) WITH CHECK (public.owns_mission(mission_id));


--
-- Name: mission_evaluations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mission_evaluations ENABLE ROW LEVEL SECURITY;

--
-- Name: mission_evaluations mission_evaluations_select_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mission_evaluations_select_self ON public.mission_evaluations FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.mission_runs run
  WHERE ((run.id = mission_evaluations.mission_run_id) AND ((run.owner_id = ( SELECT auth.uid() AS uid)) OR public.is_admin())))));


--
-- Name: mission_favorite_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mission_favorite_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: mission_favorites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mission_favorites ENABLE ROW LEVEL SECURITY;

--
-- Name: mission_favorites mission_favorites_delete_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mission_favorites_delete_self ON public.mission_favorites FOR DELETE TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));


--
-- Name: mission_favorites mission_favorites_insert_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mission_favorites_insert_self ON public.mission_favorites FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND public.can_view_mission(mission_id)));


--
-- Name: mission_favorites mission_favorites_select_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mission_favorites_select_self ON public.mission_favorites FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));


--
-- Name: mission_rewards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mission_rewards ENABLE ROW LEVEL SECURITY;

--
-- Name: mission_rewards mission_rewards_select_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mission_rewards_select_visible ON public.mission_rewards FOR SELECT USING ((public.owns_mission(mission_id) OR (is_active AND public.can_view_mission(mission_id) AND (EXISTS ( SELECT 1
   FROM public.character_assets reward_asset
  WHERE ((reward_asset.id = mission_rewards.character_asset_id) AND public.can_view_character(reward_asset.character_id)))))));


--
-- Name: mission_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mission_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: mission_runs mission_runs_insert_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mission_runs_insert_self ON public.mission_runs FOR INSERT TO authenticated WITH CHECK (((owner_id = ( SELECT auth.uid() AS uid)) AND public.can_view_mission(mission_id) AND public.can_view_character(character_id) AND public.owns_conversation(conversation_id) AND (status = 'not-started'::text) AND (score IS NULL) AND (stars IS NULL) AND (awarded_mission_reward_id IS NULL) AND (awarded_evaluation_id IS NULL) AND (started_at IS NULL) AND (completed_at IS NULL) AND (turn_count = 0)));


--
-- Name: mission_runs mission_runs_select_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mission_runs_select_self ON public.mission_runs FOR SELECT TO authenticated USING (((owner_id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));


--
-- Name: mission_step_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mission_step_progress ENABLE ROW LEVEL SECURITY;

--
-- Name: mission_step_progress mission_step_progress_insert_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mission_step_progress_insert_self ON public.mission_step_progress FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.mission_runs run
  WHERE ((run.id = mission_step_progress.mission_run_id) AND (run.owner_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: mission_step_progress mission_step_progress_select_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mission_step_progress_select_self ON public.mission_step_progress FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.mission_runs run
  WHERE ((run.id = mission_step_progress.mission_run_id) AND ((run.owner_id = ( SELECT auth.uid() AS uid)) OR public.is_admin())))));


--
-- Name: mission_step_progress mission_step_progress_update_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mission_step_progress_update_self ON public.mission_step_progress FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.mission_runs run
  WHERE ((run.id = mission_step_progress.mission_run_id) AND ((run.owner_id = ( SELECT auth.uid() AS uid)) OR public.is_admin()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.mission_runs run
  WHERE ((run.id = mission_step_progress.mission_run_id) AND ((run.owner_id = ( SELECT auth.uid() AS uid)) OR public.is_admin())))));


--
-- Name: mission_steps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mission_steps ENABLE ROW LEVEL SECURITY;

--
-- Name: mission_steps mission_steps_delete_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mission_steps_delete_owned ON public.mission_steps FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.mission_versions version
  WHERE ((version.id = mission_steps.mission_version_id) AND public.owns_mission(version.mission_id)))));


--
-- Name: mission_steps mission_steps_insert_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mission_steps_insert_owned ON public.mission_steps FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.mission_versions version
  WHERE ((version.id = mission_steps.mission_version_id) AND public.owns_mission(version.mission_id)))));


--
-- Name: mission_steps mission_steps_select_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mission_steps_select_visible ON public.mission_steps FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.mission_versions version
     JOIN public.missions mission ON ((mission.id = version.mission_id)))
  WHERE ((version.id = mission_steps.mission_version_id) AND (public.owns_mission(mission.id) OR ((mission.current_version_id = version.id) AND public.can_view_mission(mission.id)))))));


--
-- Name: mission_steps mission_steps_update_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mission_steps_update_owned ON public.mission_steps FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.mission_versions version
  WHERE ((version.id = mission_steps.mission_version_id) AND public.owns_mission(version.mission_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.mission_versions version
  WHERE ((version.id = mission_steps.mission_version_id) AND public.owns_mission(version.mission_id)))));


--
-- Name: mission_version_instructions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mission_version_instructions ENABLE ROW LEVEL SECURITY;

--
-- Name: mission_version_instructions mission_version_instructions_delete_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mission_version_instructions_delete_owned ON public.mission_version_instructions FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.mission_versions version
  WHERE ((version.id = mission_version_instructions.mission_version_id) AND public.owns_mission(version.mission_id)))));


--
-- Name: mission_version_instructions mission_version_instructions_insert_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mission_version_instructions_insert_owned ON public.mission_version_instructions FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.mission_versions version
  WHERE ((version.id = mission_version_instructions.mission_version_id) AND public.owns_mission(version.mission_id)))));


--
-- Name: mission_version_instructions mission_version_instructions_select_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mission_version_instructions_select_owned ON public.mission_version_instructions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.mission_versions version
  WHERE ((version.id = mission_version_instructions.mission_version_id) AND public.owns_mission(version.mission_id)))));


--
-- Name: mission_version_instructions mission_version_instructions_update_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mission_version_instructions_update_owned ON public.mission_version_instructions FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.mission_versions version
  WHERE ((version.id = mission_version_instructions.mission_version_id) AND public.owns_mission(version.mission_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.mission_versions version
  WHERE ((version.id = mission_version_instructions.mission_version_id) AND public.owns_mission(version.mission_id)))));


--
-- Name: mission_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mission_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: mission_versions mission_versions_delete_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mission_versions_delete_owned ON public.mission_versions FOR DELETE TO authenticated USING (public.owns_mission(mission_id));


--
-- Name: mission_versions mission_versions_insert_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mission_versions_insert_owned ON public.mission_versions FOR INSERT TO authenticated WITH CHECK ((public.owns_mission(mission_id) AND ((created_by = ( SELECT auth.uid() AS uid)) OR public.is_admin())));


--
-- Name: mission_versions mission_versions_select_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mission_versions_select_visible ON public.mission_versions FOR SELECT USING ((public.owns_mission(mission_id) OR (EXISTS ( SELECT 1
   FROM public.missions mission
  WHERE ((mission.id = mission_versions.mission_id) AND (mission.current_version_id = mission_versions.id) AND public.can_view_mission(mission.id))))));


--
-- Name: mission_versions mission_versions_update_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mission_versions_update_owned ON public.mission_versions FOR UPDATE TO authenticated USING (public.owns_mission(mission_id)) WITH CHECK (public.owns_mission(mission_id));


--
-- Name: missions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

--
-- Name: missions missions_delete_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY missions_delete_owned ON public.missions FOR DELETE TO authenticated USING (public.owns_mission(id));


--
-- Name: missions missions_insert_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY missions_insert_owned ON public.missions FOR INSERT TO authenticated WITH CHECK (((owner_id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));


--
-- Name: missions missions_select_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY missions_select_visible ON public.missions FOR SELECT USING (public.can_view_mission(id));


--
-- Name: missions missions_update_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY missions_update_owned ON public.missions FOR UPDATE TO authenticated USING (public.owns_mission(id)) WITH CHECK (((owner_id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_insert_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_insert_self ON public.profiles FOR INSERT TO authenticated WITH CHECK (((id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));


--
-- Name: profiles profiles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select ON public.profiles FOR SELECT USING ((is_public OR (id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));


--
-- Name: profiles profiles_update_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE TO authenticated USING (((id = ( SELECT auth.uid() AS uid)) OR public.is_admin())) WITH CHECK (((id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));


--
-- Name: response_regeneration_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.response_regeneration_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: reward_unlocks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reward_unlocks ENABLE ROW LEVEL SECURITY;

--
-- Name: reward_unlocks reward_unlocks_select_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reward_unlocks_select_self ON public.reward_unlocks FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));


--
-- Name: stream_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stream_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: stream_sessions stream_sessions_select_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stream_sessions_select_self ON public.stream_sessions FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));


--
-- Name: user_entitlements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;

--
-- Name: user_entitlements user_entitlements_select_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_entitlements_select_self ON public.user_entitlements FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));


--
-- Name: vocabulary_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vocabulary_progress ENABLE ROW LEVEL SECURITY;

--
-- Name: vocabulary_progress vocabulary_progress_select_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vocabulary_progress_select_self ON public.vocabulary_progress FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION append_artifact_version(_artifact_version_id uuid, _artifact_id uuid, _expected_owner_id uuid, _payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.append_artifact_version(_artifact_version_id uuid, _artifact_id uuid, _expected_owner_id uuid, _payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.append_artifact_version(_artifact_version_id uuid, _artifact_id uuid, _expected_owner_id uuid, _payload jsonb) TO service_role;


--
-- Name: FUNCTION archive_character(_character_id uuid, _expected_owner_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.archive_character(_character_id uuid, _expected_owner_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.archive_character(_character_id uuid, _expected_owner_id uuid) TO service_role;


--
-- Name: FUNCTION archive_mission(_mission_id uuid, _expected_owner_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.archive_mission(_mission_id uuid, _expected_owner_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.archive_mission(_mission_id uuid, _expected_owner_id uuid) TO service_role;


--
-- Name: FUNCTION attach_character_asset(_asset_id uuid, _character_id uuid, _expected_owner_id uuid, _payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.attach_character_asset(_asset_id uuid, _character_id uuid, _expected_owner_id uuid, _payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.attach_character_asset(_asset_id uuid, _character_id uuid, _expected_owner_id uuid, _payload jsonb) TO service_role;


--
-- Name: FUNCTION attach_mission_asset(_asset_id uuid, _mission_id uuid, _expected_owner_id uuid, _payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.attach_mission_asset(_asset_id uuid, _mission_id uuid, _expected_owner_id uuid, _payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.attach_mission_asset(_asset_id uuid, _mission_id uuid, _expected_owner_id uuid, _payload jsonb) TO service_role;


--
-- Name: FUNCTION begin_chat_generation(_conversation_id uuid, _owner_id uuid, _client_message_id text, _parts jsonb, _request_id uuid, _model_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.begin_chat_generation(_conversation_id uuid, _owner_id uuid, _client_message_id text, _parts jsonb, _request_id uuid, _model_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.begin_chat_generation(_conversation_id uuid, _owner_id uuid, _client_message_id text, _parts jsonb, _request_id uuid, _model_id text) TO service_role;


--
-- Name: FUNCTION begin_chat_generation_user(_conversation_id uuid, _owner_id uuid, _client_message_id text, _parts jsonb, _request_id uuid, _model_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.begin_chat_generation_user(_conversation_id uuid, _owner_id uuid, _client_message_id text, _parts jsonb, _request_id uuid, _model_id text) FROM PUBLIC;


--
-- Name: FUNCTION begin_chat_tool_continuation(_conversation_id uuid, _owner_id uuid, _assistant_id uuid, _request_id uuid, _model_id text, _decisions jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.begin_chat_tool_continuation(_conversation_id uuid, _owner_id uuid, _assistant_id uuid, _request_id uuid, _model_id text, _decisions jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.begin_chat_tool_continuation(_conversation_id uuid, _owner_id uuid, _assistant_id uuid, _request_id uuid, _model_id text, _decisions jsonb) TO service_role;


--
-- Name: FUNCTION can_read_storage_object(_bucket_id text, _object_name text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_read_storage_object(_bucket_id text, _object_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_read_storage_object(_bucket_id text, _object_name text) TO anon;
GRANT ALL ON FUNCTION public.can_read_storage_object(_bucket_id text, _object_name text) TO authenticated;
GRANT ALL ON FUNCTION public.can_read_storage_object(_bucket_id text, _object_name text) TO service_role;


--
-- Name: FUNCTION can_view_character(_character_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_view_character(_character_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_view_character(_character_id uuid) TO anon;
GRANT ALL ON FUNCTION public.can_view_character(_character_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_view_character(_character_id uuid) TO service_role;


--
-- Name: FUNCTION can_view_conversation(_conversation_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_view_conversation(_conversation_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_view_conversation(_conversation_id uuid) TO anon;
GRANT ALL ON FUNCTION public.can_view_conversation(_conversation_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_view_conversation(_conversation_id uuid) TO service_role;


--
-- Name: FUNCTION can_view_mission(_mission_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_view_mission(_mission_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_view_mission(_mission_id uuid) TO anon;
GRANT ALL ON FUNCTION public.can_view_mission(_mission_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_view_mission(_mission_id uuid) TO service_role;


--
-- Name: FUNCTION capture_version_display_metadata(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.capture_version_display_metadata() FROM PUBLIC;
GRANT ALL ON FUNCTION public.capture_version_display_metadata() TO service_role;


--
-- Name: FUNCTION clear_conversation_messages(_conversation_id uuid, _owner_id uuid, _request_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.clear_conversation_messages(_conversation_id uuid, _owner_id uuid, _request_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.clear_conversation_messages(_conversation_id uuid, _owner_id uuid, _request_id uuid) TO service_role;


--
-- Name: FUNCTION commit_artifact_revision(_request_id uuid, _artifact_id uuid, _expected_owner_id uuid, _conversation_id uuid, _expected_version_id uuid, _payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.commit_artifact_revision(_request_id uuid, _artifact_id uuid, _expected_owner_id uuid, _conversation_id uuid, _expected_version_id uuid, _payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.commit_artifact_revision(_request_id uuid, _artifact_id uuid, _expected_owner_id uuid, _conversation_id uuid, _expected_version_id uuid, _payload jsonb) TO service_role;


--
-- Name: FUNCTION complete_mission_run(_mission_run_id uuid, _mission_evaluation_id uuid, _mission_reward_id uuid, _expected_owner_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.complete_mission_run(_mission_run_id uuid, _mission_evaluation_id uuid, _mission_reward_id uuid, _expected_owner_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.complete_mission_run(_mission_run_id uuid, _mission_evaluation_id uuid, _mission_reward_id uuid, _expected_owner_id uuid) TO service_role;


--
-- Name: FUNCTION complete_mission_run_unchecked(_mission_run_id uuid, _mission_evaluation_id uuid, _mission_reward_id uuid, _expected_owner_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.complete_mission_run_unchecked(_mission_run_id uuid, _mission_evaluation_id uuid, _mission_reward_id uuid, _expected_owner_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION create_artifact_with_version(_artifact_id uuid, _artifact_version_id uuid, _expected_owner_id uuid, _conversation_id uuid, _payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_artifact_with_version(_artifact_id uuid, _artifact_version_id uuid, _expected_owner_id uuid, _conversation_id uuid, _payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_artifact_with_version(_artifact_id uuid, _artifact_version_id uuid, _expected_owner_id uuid, _conversation_id uuid, _payload jsonb) TO service_role;


--
-- Name: FUNCTION create_character_report(_character_id uuid, _expected_reporter_id uuid, _reason text, _details text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_character_report(_character_id uuid, _expected_reporter_id uuid, _reason text, _details text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_character_report(_character_id uuid, _expected_reporter_id uuid, _reason text, _details text) TO service_role;


--
-- Name: FUNCTION create_character_version(_character_id uuid, _character_version_id uuid, _expected_owner_id uuid, _expected_version_number integer, _payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_character_version(_character_id uuid, _character_version_id uuid, _expected_owner_id uuid, _expected_version_number integer, _payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_character_version(_character_id uuid, _character_version_id uuid, _expected_owner_id uuid, _expected_version_number integer, _payload jsonb) TO service_role;


--
-- Name: FUNCTION create_character_with_version(_character_id uuid, _character_version_id uuid, _expected_owner_id uuid, _payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_character_with_version(_character_id uuid, _character_version_id uuid, _expected_owner_id uuid, _payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_character_with_version(_character_id uuid, _character_version_id uuid, _expected_owner_id uuid, _payload jsonb) TO service_role;


--
-- Name: FUNCTION create_mission_version(_mission_id uuid, _mission_version_id uuid, _expected_owner_id uuid, _expected_version_number integer, _payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_mission_version(_mission_id uuid, _mission_version_id uuid, _expected_owner_id uuid, _expected_version_number integer, _payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_mission_version(_mission_id uuid, _mission_version_id uuid, _expected_owner_id uuid, _expected_version_number integer, _payload jsonb) TO service_role;


--
-- Name: FUNCTION create_mission_with_version(_mission_id uuid, _mission_version_id uuid, _expected_owner_id uuid, _payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_mission_with_version(_mission_id uuid, _mission_version_id uuid, _expected_owner_id uuid, _payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_mission_with_version(_mission_id uuid, _mission_version_id uuid, _expected_owner_id uuid, _payload jsonb) TO service_role;


--
-- Name: FUNCTION delete_owned_artifact(_artifact_id uuid, _expected_owner_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_owned_artifact(_artifact_id uuid, _expected_owner_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_owned_artifact(_artifact_id uuid, _expected_owner_id uuid) TO service_role;


--
-- Name: FUNCTION finish_chat_generation(_conversation_id uuid, _owner_id uuid, _assistant_message_id uuid, _request_id uuid, _status text, _parts jsonb, _finish_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.finish_chat_generation(_conversation_id uuid, _owner_id uuid, _assistant_message_id uuid, _request_id uuid, _status text, _parts jsonb, _finish_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.finish_chat_generation(_conversation_id uuid, _owner_id uuid, _assistant_message_id uuid, _request_id uuid, _status text, _parts jsonb, _finish_reason text) TO service_role;


--
-- Name: FUNCTION finish_chat_generation_base(_conversation_id uuid, _owner_id uuid, _assistant_message_id uuid, _request_id uuid, _status text, _parts jsonb, _finish_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.finish_chat_generation_base(_conversation_id uuid, _owner_id uuid, _assistant_message_id uuid, _request_id uuid, _status text, _parts jsonb, _finish_reason text) FROM PUBLIC;


--
-- Name: FUNCTION guard_mission_prerequisites(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.guard_mission_prerequisites() FROM PUBLIC;
GRANT ALL ON FUNCTION public.guard_mission_prerequisites() TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION is_admin(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_admin() TO anon;
GRANT ALL ON FUNCTION public.is_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_admin() TO service_role;


--
-- Name: FUNCTION learning_activity_slices(_from timestamp with time zone, _to timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.learning_activity_slices(_from timestamp with time zone, _to timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.learning_activity_slices(_from timestamp with time zone, _to timestamp with time zone) TO service_role;


--
-- Name: FUNCTION moderate_character_report(_report_id uuid, _character_id uuid, _expected_admin_id uuid, _resolution_note text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.moderate_character_report(_report_id uuid, _character_id uuid, _expected_admin_id uuid, _resolution_note text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.moderate_character_report(_report_id uuid, _character_id uuid, _expected_admin_id uuid, _resolution_note text) TO service_role;


--
-- Name: FUNCTION owns_artifact(_artifact_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.owns_artifact(_artifact_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.owns_artifact(_artifact_id uuid) TO anon;
GRANT ALL ON FUNCTION public.owns_artifact(_artifact_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.owns_artifact(_artifact_id uuid) TO service_role;


--
-- Name: FUNCTION owns_character(_character_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.owns_character(_character_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.owns_character(_character_id uuid) TO anon;
GRANT ALL ON FUNCTION public.owns_character(_character_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.owns_character(_character_id uuid) TO service_role;


--
-- Name: FUNCTION owns_conversation(_conversation_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.owns_conversation(_conversation_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.owns_conversation(_conversation_id uuid) TO anon;
GRANT ALL ON FUNCTION public.owns_conversation(_conversation_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.owns_conversation(_conversation_id uuid) TO service_role;


--
-- Name: FUNCTION owns_mission(_mission_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.owns_mission(_mission_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.owns_mission(_mission_id uuid) TO anon;
GRANT ALL ON FUNCTION public.owns_mission(_mission_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.owns_mission(_mission_id uuid) TO service_role;


--
-- Name: FUNCTION prepare_response_regeneration(_conversation_id uuid, _owner_id uuid, _assistant_id uuid, _request_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.prepare_response_regeneration(_conversation_id uuid, _owner_id uuid, _assistant_id uuid, _request_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.prepare_response_regeneration(_conversation_id uuid, _owner_id uuid, _assistant_id uuid, _request_id uuid) TO service_role;


--
-- Name: FUNCTION prevent_published_asset_mutation(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.prevent_published_asset_mutation() FROM PUBLIC;
GRANT ALL ON FUNCTION public.prevent_published_asset_mutation() TO service_role;


--
-- Name: FUNCTION prevent_published_character_instruction_mutation(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.prevent_published_character_instruction_mutation() FROM PUBLIC;
GRANT ALL ON FUNCTION public.prevent_published_character_instruction_mutation() TO service_role;


--
-- Name: FUNCTION prevent_published_mission_character_mutation(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.prevent_published_mission_character_mutation() FROM PUBLIC;
GRANT ALL ON FUNCTION public.prevent_published_mission_character_mutation() TO service_role;


--
-- Name: FUNCTION prevent_published_mission_child_mutation(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.prevent_published_mission_child_mutation() FROM PUBLIC;
GRANT ALL ON FUNCTION public.prevent_published_mission_child_mutation() TO service_role;


--
-- Name: FUNCTION prevent_published_version_mutation(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.prevent_published_version_mutation() FROM PUBLIC;
GRANT ALL ON FUNCTION public.prevent_published_version_mutation() TO service_role;


--
-- Name: FUNCTION publish_character(_character_id uuid, _expected_owner_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.publish_character(_character_id uuid, _expected_owner_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.publish_character(_character_id uuid, _expected_owner_id uuid) TO service_role;


--
-- Name: FUNCTION publish_mission(_mission_id uuid, _expected_owner_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.publish_mission(_mission_id uuid, _expected_owner_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.publish_mission(_mission_id uuid, _expected_owner_id uuid) TO service_role;


--
-- Name: FUNCTION purge_deleted_conversation(_conversation_id uuid, _expected_owner_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.purge_deleted_conversation(_conversation_id uuid, _expected_owner_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.purge_deleted_conversation(_conversation_id uuid, _expected_owner_id uuid) TO service_role;


--
-- Name: FUNCTION purge_owned_conversations(_expected_owner_id uuid, _request_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.purge_owned_conversations(_expected_owner_id uuid, _request_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.purge_owned_conversations(_expected_owner_id uuid, _request_id uuid) TO service_role;


--
-- Name: FUNCTION record_learner_message_activity(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_learner_message_activity() FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_learner_message_activity() TO service_role;


--
-- Name: FUNCTION record_learning_activity(_conversation_id uuid, _request_id uuid, _active boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_learning_activity(_conversation_id uuid, _request_id uuid, _active boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_learning_activity(_conversation_id uuid, _request_id uuid, _active boolean) TO authenticated;
GRANT ALL ON FUNCTION public.record_learning_activity(_conversation_id uuid, _request_id uuid, _active boolean) TO service_role;


--
-- Name: TABLE chat_file_uploads; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.chat_file_uploads TO service_role;


--
-- Name: FUNCTION register_chat_file(_conversation_id uuid, _owner_id uuid, _sha256 text, _mime_type text, _byte_size integer, _filename text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.register_chat_file(_conversation_id uuid, _owner_id uuid, _sha256 text, _mime_type text, _byte_size integer, _filename text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.register_chat_file(_conversation_id uuid, _owner_id uuid, _sha256 text, _mime_type text, _byte_size integer, _filename text) TO service_role;


--
-- Name: FUNCTION replace_message_branch(_conversation_id uuid, _owner_id uuid, _source_id uuid, _expected_tail_id uuid, _request_id uuid, _parts jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.replace_message_branch(_conversation_id uuid, _owner_id uuid, _source_id uuid, _expected_tail_id uuid, _request_id uuid, _parts jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.replace_message_branch(_conversation_id uuid, _owner_id uuid, _source_id uuid, _expected_tail_id uuid, _request_id uuid, _parts jsonb) TO service_role;


--
-- Name: FUNCTION save_learning_notebook(_owner_id uuid, _request_id uuid, _draft jsonb, _identity_key text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.save_learning_notebook(_owner_id uuid, _request_id uuid, _draft jsonb, _identity_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.save_learning_notebook(_owner_id uuid, _request_id uuid, _draft jsonb, _identity_key text) TO service_role;


--
-- Name: FUNCTION save_learning_preferences(_expected_revision integer, _settings jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.save_learning_preferences(_expected_revision integer, _settings jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.save_learning_preferences(_expected_revision integer, _settings jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.save_learning_preferences(_expected_revision integer, _settings jsonb) TO service_role;


--
-- Name: FUNCTION set_saved_mission(_request_id uuid, _mission_id uuid, _saved boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_saved_mission(_request_id uuid, _mission_id uuid, _saved boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_saved_mission(_request_id uuid, _mission_id uuid, _saved boolean) TO authenticated;
GRANT ALL ON FUNCTION public.set_saved_mission(_request_id uuid, _mission_id uuid, _saved boolean) TO service_role;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;


--
-- Name: FUNCTION start_mission_run(_expected_owner_id uuid, _mission_id uuid, _mission_version_id uuid, _character_id uuid, _character_version_id uuid, _conversation_id uuid, _model_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.start_mission_run(_expected_owner_id uuid, _mission_id uuid, _mission_version_id uuid, _character_id uuid, _character_version_id uuid, _conversation_id uuid, _model_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.start_mission_run(_expected_owner_id uuid, _mission_id uuid, _mission_version_id uuid, _character_id uuid, _character_version_id uuid, _conversation_id uuid, _model_id text) TO service_role;


--
-- Name: FUNCTION touch_conversation_after_message(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.touch_conversation_after_message() FROM PUBLIC;
GRANT ALL ON FUNCTION public.touch_conversation_after_message() TO service_role;


--
-- Name: FUNCTION update_artifact_state(_artifact_id uuid, _expected_owner_id uuid, _title text, _status text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_artifact_state(_artifact_id uuid, _expected_owner_id uuid, _title text, _status text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_artifact_state(_artifact_id uuid, _expected_owner_id uuid, _title text, _status text) TO service_role;


--
-- Name: FUNCTION valid_learning_preferences(value jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.valid_learning_preferences(value jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.valid_learning_preferences(value jsonb) TO service_role;


--
-- Name: FUNCTION validate_artifact_current_version(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.validate_artifact_current_version() FROM PUBLIC;
GRANT ALL ON FUNCTION public.validate_artifact_current_version() TO service_role;


--
-- Name: FUNCTION validate_character_current_version(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.validate_character_current_version() FROM PUBLIC;
GRANT ALL ON FUNCTION public.validate_character_current_version() TO service_role;


--
-- Name: FUNCTION validate_chat_file_parts(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.validate_chat_file_parts() FROM PUBLIC;
GRANT ALL ON FUNCTION public.validate_chat_file_parts() TO service_role;


--
-- Name: FUNCTION validate_message_parent_and_parts(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.validate_message_parent_and_parts() FROM PUBLIC;
GRANT ALL ON FUNCTION public.validate_message_parent_and_parts() TO service_role;


--
-- Name: FUNCTION validate_mission_current_version(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.validate_mission_current_version() FROM PUBLIC;
GRANT ALL ON FUNCTION public.validate_mission_current_version() TO service_role;


--
-- Name: FUNCTION validate_mission_reward_definition(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.validate_mission_reward_definition() FROM PUBLIC;
GRANT ALL ON FUNCTION public.validate_mission_reward_definition() TO service_role;


--
-- Name: FUNCTION validate_mission_run_context(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.validate_mission_run_context() FROM PUBLIC;
GRANT ALL ON FUNCTION public.validate_mission_run_context() TO service_role;


--
-- Name: TABLE ai_usage_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_usage_events TO anon;
GRANT ALL ON TABLE public.ai_usage_events TO authenticated;
GRANT ALL ON TABLE public.ai_usage_events TO service_role;


--
-- Name: SEQUENCE ai_usage_events_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.ai_usage_events_id_seq TO anon;
GRANT ALL ON SEQUENCE public.ai_usage_events_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.ai_usage_events_id_seq TO service_role;


--
-- Name: TABLE artifact_revision_requests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.artifact_revision_requests TO service_role;


--
-- Name: TABLE artifact_suggestions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.artifact_suggestions TO anon;
GRANT ALL ON TABLE public.artifact_suggestions TO authenticated;
GRANT ALL ON TABLE public.artifact_suggestions TO service_role;


--
-- Name: TABLE artifact_versions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.artifact_versions TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.artifact_versions TO authenticated;
GRANT ALL ON TABLE public.artifact_versions TO service_role;


--
-- Name: TABLE artifacts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.artifacts TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.artifacts TO authenticated;
GRANT ALL ON TABLE public.artifacts TO service_role;


--
-- Name: TABLE character_assets; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.character_assets TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.character_assets TO authenticated;
GRANT ALL ON TABLE public.character_assets TO service_role;


--
-- Name: TABLE character_favorites; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.character_favorites TO anon;
GRANT ALL ON TABLE public.character_favorites TO authenticated;
GRANT ALL ON TABLE public.character_favorites TO service_role;


--
-- Name: TABLE character_reports; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.character_reports TO anon;
GRANT ALL ON TABLE public.character_reports TO authenticated;
GRANT ALL ON TABLE public.character_reports TO service_role;


--
-- Name: TABLE character_tags; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.character_tags TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.character_tags TO authenticated;
GRANT ALL ON TABLE public.character_tags TO service_role;


--
-- Name: TABLE character_version_instructions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.character_version_instructions TO service_role;


--
-- Name: TABLE character_versions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.character_versions TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.character_versions TO authenticated;
GRANT ALL ON TABLE public.character_versions TO service_role;


--
-- Name: TABLE characters; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.characters TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.characters TO authenticated;
GRANT ALL ON TABLE public.characters TO service_role;


--
-- Name: TABLE chat_generations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.chat_generations TO service_role;


--
-- Name: TABLE conversation_clear_requests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.conversation_clear_requests TO service_role;


--
-- Name: TABLE conversation_purge_requests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.conversation_purge_requests TO service_role;


--
-- Name: TABLE conversations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.conversations TO anon;
GRANT ALL ON TABLE public.conversations TO authenticated;
GRANT ALL ON TABLE public.conversations TO service_role;


--
-- Name: TABLE daily_learning_stats; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.daily_learning_stats TO anon;
GRANT ALL ON TABLE public.daily_learning_stats TO authenticated;
GRANT ALL ON TABLE public.daily_learning_stats TO service_role;


--
-- Name: TABLE generation_jobs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.generation_jobs TO anon;
GRANT ALL ON TABLE public.generation_jobs TO authenticated;
GRANT ALL ON TABLE public.generation_jobs TO service_role;


--
-- Name: TABLE learner_preferences; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.learner_preferences TO service_role;
GRANT SELECT ON TABLE public.learner_preferences TO authenticated;


--
-- Name: TABLE learning_activity_clocks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.learning_activity_clocks TO service_role;


--
-- Name: TABLE learning_activity_receipts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.learning_activity_receipts TO service_role;


--
-- Name: TABLE learning_notebook_entries; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.learning_notebook_entries TO service_role;
GRANT SELECT ON TABLE public.learning_notebook_entries TO authenticated;


--
-- Name: TABLE learning_notebook_requests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.learning_notebook_requests TO service_role;


--
-- Name: TABLE message_attachments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.message_attachments TO anon;
GRANT ALL ON TABLE public.message_attachments TO authenticated;
GRANT ALL ON TABLE public.message_attachments TO service_role;


--
-- Name: TABLE message_audio; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.message_audio TO anon;
GRANT ALL ON TABLE public.message_audio TO authenticated;
GRANT ALL ON TABLE public.message_audio TO service_role;


--
-- Name: TABLE message_branch_requests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.message_branch_requests TO service_role;


--
-- Name: TABLE message_feedback; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.message_feedback TO anon;
GRANT ALL ON TABLE public.message_feedback TO authenticated;
GRANT ALL ON TABLE public.message_feedback TO service_role;


--
-- Name: TABLE messages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.messages TO anon;
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.messages TO authenticated;
GRANT ALL ON TABLE public.messages TO service_role;


--
-- Name: SEQUENCE messages_sequence_number_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.messages_sequence_number_seq TO anon;
GRANT ALL ON SEQUENCE public.messages_sequence_number_seq TO authenticated;
GRANT ALL ON SEQUENCE public.messages_sequence_number_seq TO service_role;


--
-- Name: TABLE mission_assets; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mission_assets TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.mission_assets TO authenticated;
GRANT ALL ON TABLE public.mission_assets TO service_role;


--
-- Name: TABLE mission_characters; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mission_characters TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.mission_characters TO authenticated;
GRANT ALL ON TABLE public.mission_characters TO service_role;


--
-- Name: TABLE mission_evaluations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mission_evaluations TO anon;
GRANT ALL ON TABLE public.mission_evaluations TO authenticated;
GRANT ALL ON TABLE public.mission_evaluations TO service_role;


--
-- Name: TABLE mission_favorite_requests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mission_favorite_requests TO service_role;


--
-- Name: TABLE mission_favorites; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mission_favorites TO anon;
GRANT ALL ON TABLE public.mission_favorites TO authenticated;
GRANT ALL ON TABLE public.mission_favorites TO service_role;


--
-- Name: TABLE mission_rewards; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mission_rewards TO anon;
GRANT ALL ON TABLE public.mission_rewards TO authenticated;
GRANT ALL ON TABLE public.mission_rewards TO service_role;


--
-- Name: TABLE mission_runs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mission_runs TO anon;
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.mission_runs TO authenticated;
GRANT ALL ON TABLE public.mission_runs TO service_role;


--
-- Name: TABLE mission_step_progress; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mission_step_progress TO anon;
GRANT ALL ON TABLE public.mission_step_progress TO authenticated;
GRANT ALL ON TABLE public.mission_step_progress TO service_role;


--
-- Name: TABLE mission_steps; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mission_steps TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.mission_steps TO authenticated;
GRANT ALL ON TABLE public.mission_steps TO service_role;


--
-- Name: TABLE mission_version_instructions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mission_version_instructions TO service_role;


--
-- Name: TABLE mission_versions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mission_versions TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.mission_versions TO authenticated;
GRANT ALL ON TABLE public.mission_versions TO service_role;


--
-- Name: TABLE missions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.missions TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.missions TO authenticated;
GRANT ALL ON TABLE public.missions TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: COLUMN profiles.id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(id) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.username; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(username),UPDATE(username) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.display_name; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(display_name),UPDATE(display_name) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.avatar_path; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(avatar_path),UPDATE(avatar_path) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.bio; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(bio),UPDATE(bio) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.native_language; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(native_language),UPDATE(native_language) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.target_language; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(target_language),UPDATE(target_language) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.cefr_level; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(cefr_level),UPDATE(cefr_level) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.daily_goal_minutes; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(daily_goal_minutes),UPDATE(daily_goal_minutes) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.onboarding_completed; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(onboarding_completed),UPDATE(onboarding_completed) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.is_public; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(is_public),UPDATE(is_public) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.preferences; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(preferences),UPDATE(preferences) ON TABLE public.profiles TO authenticated;


--
-- Name: TABLE response_regeneration_requests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.response_regeneration_requests TO service_role;


--
-- Name: TABLE reward_unlocks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.reward_unlocks TO anon;
GRANT ALL ON TABLE public.reward_unlocks TO authenticated;
GRANT ALL ON TABLE public.reward_unlocks TO service_role;


--
-- Name: TABLE stream_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.stream_sessions TO anon;
GRANT ALL ON TABLE public.stream_sessions TO authenticated;
GRANT ALL ON TABLE public.stream_sessions TO service_role;


--
-- Name: TABLE user_entitlements; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_entitlements TO anon;
GRANT ALL ON TABLE public.user_entitlements TO authenticated;
GRANT ALL ON TABLE public.user_entitlements TO service_role;


--
-- Name: TABLE vocabulary_progress; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.vocabulary_progress TO anon;
GRANT ALL ON TABLE public.vocabulary_progress TO authenticated;
GRANT ALL ON TABLE public.vocabulary_progress TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--



-- Character saved-conversation counter (20260910203419).
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated, service_role;

create function app_private.maintain_character_conversation_count()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  old_character uuid;
  new_character uuid;
begin
  if tg_op <> 'INSERT' then
    if old.status <> 'deleted' then old_character := old.character_id; end if;
  end if;
  if tg_op <> 'DELETE' then
    if new.status <> 'deleted' then new_character := new.character_id; end if;
  end if;
  -- Includes active <-> archived and updates of unrelated fields.
  if old_character is not distinct from new_character then return null; end if;

  -- Atomic deltas avoid recount races. UUID ordering handles opposite transfers;
  -- NO KEY UPDATE remains compatible with the conversation FK's KEY SHARE lock.
  perform id from public.characters
    where id in (old_character, new_character)
    order by id for no key update;
  if old_character is not null then
    update public.characters set conversation_count = conversation_count - 1
      where id = old_character;
  end if;
  if new_character is not null then
    update public.characters set conversation_count = conversation_count + 1
      where id = new_character;
  end if;
  return null;
end;
$$;
revoke all on function app_private.maintain_character_conversation_count() from public, anon, authenticated, service_role;

create trigger conversations_maintain_character_count
  after insert or delete or update of character_id, status on public.conversations
  for each row execute function app_private.maintain_character_conversation_count();

comment on column public.characters.conversation_count is
  'Number of saved conversations in active or archived state; excludes deleted conversations, not a distinct learner count. Maintained by an internal trigger.';


-- First saved user-message titles (20260910213224).
comment on column public.conversations.title_source is
  'Server-owned title intent: pending opts a new contextual title into first saved learner-message naming; auto/manual persist across clear, edits and retries. Legacy rows stay manual.';

-- Preserve the existing browser write surface, excluding the new server marker.
revoke insert, update on public.conversations from anon, authenticated;
grant insert (id, owner_id, character_id, character_version_id, mission_id, mission_version_id,
  title, visibility, status, model_id, share_token, metadata, last_message_at, created_at, updated_at),
  update (id, owner_id, character_id, character_version_id, mission_id, mission_version_id,
  title, visibility, status, model_id, share_token, metadata, last_message_at, created_at, updated_at)
  on public.conversations to anon, authenticated;

create function app_private.mark_manual_conversation_title()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  -- Only the trusted automatic writer can supply this protected transition.
  if old.title_source = 'pending' and new.title_source = 'auto' then return new; end if;
  -- UPDATE OF title also fires when a user deliberately saves the same string.
  new.title_source := 'manual';
  return new;
end;
$$;
revoke all on function app_private.mark_manual_conversation_title() from public, anon, authenticated, service_role;
create trigger conversations_mark_manual_title before update of title on public.conversations
  for each row execute function app_private.mark_manual_conversation_title();

create function app_private.name_conversation_from_first_message()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  candidate text;
begin
  if new.role <> 'user' or new.status <> 'complete' then return null; end if;
  select string_agg(part->>'text', '' order by ordinal) into candidate
    from jsonb_array_elements(new.parts) with ordinality as item(part, ordinal)
    where part->>'type' = 'text' and jsonb_typeof(part->'text') = 'string';
  candidate := left(btrim(regexp_replace(coalesce(candidate, ''), '[[:space:]]+', ' ', 'g')), 80);
  if candidate = '' then
    candidate := case when exists (select 1 from jsonb_array_elements(new.parts) as part where part->>'type' = 'file')
      then '첨부파일 대화' else '새 대화' end;
  end if;
  -- The guarded UPDATE takes the same conversation row lock as rename/clear/chat
  -- RPCs, and is committed or rolled back with this saved user message.
  update public.conversations set title = candidate, title_source = 'auto'
    where id = new.conversation_id and owner_id = new.author_id
      and status = 'active' and title_source = 'pending';
  return null;
end;
$$;
revoke all on function app_private.name_conversation_from_first_message() from public, anon, authenticated, service_role;
create trigger messages_name_conversation after insert on public.messages
  for each row execute function app_private.name_conversation_from_first_message();


-- RLS-preserving creation title intent (20260910214228).
-- Opting one's new conversation into automatic naming is a public creation
-- choice. Keep INSERT under the caller's RLS instead of granting marker writes.
create function app_private.bootstrap_conversation_title_intent()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.title_source = 'manual' and new.metadata->>'initialTitleMode' = 'auto' then
    new.title_source := 'pending';
  end if;
  return new;
end;
$$;
revoke all on function app_private.bootstrap_conversation_title_intent() from public, anon, authenticated, service_role;
create trigger conversations_bootstrap_title_intent before insert on public.conversations
  for each row execute function app_private.bootstrap_conversation_title_intent();

comment on function app_private.bootstrap_conversation_title_intent() is
  'Reads public initialTitleMode only at creation, preserving caller RLS. Later metadata writes never reset auto/manual intent; explicit trusted pending is preserved.';

-- Persisted Artifact provider suggestions (20260910215332).
alter table public.artifact_suggestions
  add column mode text check (mode in ('rewrite', 'grammar', 'analysis')),
  add column selection_start integer,
  add column selection_end integer,
  add constraint artifact_suggestions_selection_check check (
    (mode is null and selection_start is null and selection_end is null)
    or (mode is not null and mode in ('grammar', 'analysis') and selection_start is null and selection_end is null)
    or (mode is not null and mode = 'rewrite' and selection_start is not null and selection_end is not null
      and selection_start >= 0 and selection_end > selection_start)
  );
comment on column public.artifact_suggestions.mode is
  'Typed server-generated suggestion mode; NULL legacy rows have no recoverable provider metadata.';
comment on column public.artifact_suggestions.original_text is
  'For typed rows, the complete immutable source-version text snapshot; selection offsets use JavaScript UTF-16 units. Historical pending rows do not claim an application audit.';
create index artifact_suggestions_current_pending_idx
  on public.artifact_suggestions(artifact_version_id, owner_id, created_at desc, id desc)
  where status = 'pending' and mode is not null;

revoke all on public.artifact_suggestions from public, anon, authenticated;
grant select on public.artifact_suggestions to authenticated;
drop policy artifact_suggestions_insert_owned on public.artifact_suggestions;
drop policy artifact_suggestions_update_owned on public.artifact_suggestions;
drop policy artifact_suggestions_delete_owned on public.artifact_suggestions;
drop policy artifact_suggestions_select_owned on public.artifact_suggestions;
create policy artifact_suggestions_select_owned on public.artifact_suggestions
  for select to authenticated using (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.artifact_versions version join public.artifacts artifact on artifact.id = version.artifact_id
      where version.id = artifact_version_id and artifact.owner_id = (select auth.uid())
    )
  );

create function public.persist_artifact_suggestion(
  _request_id uuid, _artifact_id uuid, _expected_owner_id uuid, _expected_version_id uuid,
  _mode text, _selection_start integer, _selection_end integer,
  _source_content text, _suggested_text text, _description text
)
returns setof public.artifact_suggestions
language plpgsql security definer set search_path = ''
as $$
declare
  owned_conversation_id uuid;
  artifact public.artifacts%rowtype;
  saved public.artifact_suggestions%rowtype;
  source text;
  source_units integer;
begin
  if _request_id is null or _artifact_id is null or _expected_owner_id is null or _expected_version_id is null
    or _mode is null or _mode not in ('rewrite', 'grammar', 'analysis')
    or _source_content is null or char_length(btrim(_source_content)) not between 1 and 20000
    or _suggested_text is null or char_length(btrim(_suggested_text)) not between 1 and 20000
    or _description is null or char_length(btrim(_description)) not between 1 and 2000 then
    raise exception using errcode = '22023', message = 'invalid artifact suggestion';
  end if;
  -- Browser selection offsets count astral characters as two UTF-16 units.
  select coalesce(sum(case when ascii(piece) > 65535 then 2 else char_length(piece) end), 0)::integer
    into source_units from regexp_split_to_table(_source_content, '') as piece;
  if source_units > 20000
    or (_mode = 'rewrite' and (_selection_start is null or _selection_end is null
      or _selection_start < 0 or _selection_end <= _selection_start or _selection_end > source_units))
    or (_mode <> 'rewrite' and (_selection_start is not null or _selection_end is not null)) then
    raise exception using errcode = '22023', message = 'invalid suggestion selection';
  end if;

  select a.conversation_id into owned_conversation_id from public.artifacts a
    where a.id = _artifact_id and a.owner_id = _expected_owner_id;
  if not found then raise exception using errcode = '42501', message = 'artifact suggestion owner mismatch'; end if;
  -- Same lock order as commit_artifact_revision: conversation, then artifact.
  perform 1 from public.conversations c where c.id = owned_conversation_id and c.owner_id = _expected_owner_id and c.status = 'active' for update;
  if not found then raise exception using errcode = '42501', message = 'artifact suggestion conversation unavailable'; end if;
  select a.* into artifact from public.artifacts a where a.id = _artifact_id
    and a.owner_id = _expected_owner_id and a.conversation_id = owned_conversation_id for update;
  if not found then raise exception using errcode = '42501', message = 'artifact suggestion owner changed'; end if;
  if artifact.status = 'archived' then raise exception using errcode = 'PT409', message = 'artifact is archived'; end if;
  if (_mode = 'grammar' and artifact.kind <> 'text') or (_mode = 'analysis' and artifact.kind <> 'sheet')
    or (_mode = 'rewrite' and artifact.kind not in ('text', 'code', 'sheet')) then
    raise exception using errcode = '22023', message = 'suggestion mode does not match artifact kind';
  end if;

  select v.content_text into source from public.artifact_versions v where v.id = _expected_version_id and v.artifact_id = _artifact_id;
  if not found or source is distinct from _source_content then
    raise exception using errcode = 'PT409', message = 'artifact suggestion source changed';
  end if;

  select s.* into saved from public.artifact_suggestions s where s.id = _request_id;
  if found then
    if saved.owner_id is distinct from _expected_owner_id or saved.artifact_version_id is distinct from _expected_version_id
      or saved.mode is distinct from _mode or saved.selection_start is distinct from _selection_start
      or saved.selection_end is distinct from _selection_end or saved.original_text is distinct from _source_content then
      raise exception using errcode = 'PT409', message = 'suggestion request key reused with different input';
    end if;
    return next saved; return;
  end if;
  if artifact.current_version_id is distinct from _expected_version_id then
    raise exception using errcode = 'PT409', message = 'artifact version changed before suggestion persistence';
  end if;
  insert into public.artifact_suggestions(id,artifact_version_id,owner_id,original_text,suggested_text,description,mode,selection_start,selection_end)
    values(_request_id,_expected_version_id,_expected_owner_id,_source_content,_suggested_text,_description,_mode,_selection_start,_selection_end)
    on conflict(id) do nothing returning * into saved;
  if not found then
    -- A concurrent call for another artifact can collide on the global request ID.
    select s.* into saved from public.artifact_suggestions s where s.id = _request_id;
    if saved.owner_id is distinct from _expected_owner_id or saved.artifact_version_id is distinct from _expected_version_id
      or saved.mode is distinct from _mode or saved.selection_start is distinct from _selection_start
      or saved.selection_end is distinct from _selection_end or saved.original_text is distinct from _source_content then
      raise exception using errcode = 'PT409', message = 'suggestion request key reused with different input';
    end if;
  end if;
  return next saved;
end;
$$;
revoke all on function public.persist_artifact_suggestion(uuid,uuid,uuid,uuid,text,integer,integer,text,text,text) from public, anon, authenticated;
grant execute on function public.persist_artifact_suggestion(uuid,uuid,uuid,uuid,text,integer,integer,text,text,text) to service_role;
-- Existing attempts remain unknown; new attempts are tracked from their insertion.
alter table public.mission_runs add column hint_tracking_started_at timestamptz;
create function public.protect_mission_hint_tracking() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then new.hint_tracking_started_at := clock_timestamp();
  elsif new.hint_tracking_started_at is distinct from old.hint_tracking_started_at then
    raise exception using errcode='42501', message='hint tracking is server managed';
  end if;
  return new;
end; $$;
revoke all on function public.protect_mission_hint_tracking() from public, anon, authenticated;
create trigger protect_mission_hint_tracking before insert or update on public.mission_runs
for each row execute function public.protect_mission_hint_tracking();

create table public.mission_hint_requests (
  id uuid primary key,
  mission_run_id uuid not null references public.mission_runs(id) on delete cascade,
  mission_step_id uuid not null references public.mission_steps(id) on delete restrict,
  depth integer not null check(depth between 1 and 3),
  result jsonb not null check(jsonb_typeof(result)='object'
    and jsonb_typeof(result->'text')='string' and char_length(btrim(result->>'text')) between 1 and 1200
    and jsonb_typeof(result->'explanation')='string' and char_length(btrim(result->>'explanation')) between 1 and 1200
    and result ? 'text' and result ? 'explanation'),
  -- Historical identifiers, deliberately not FKs: clearing messages cannot rewrite help evidence.
  context_message_id uuid,
  context_sequence_number bigint,
  created_at timestamptz not null default clock_timestamp(),
  check ((context_message_id is null) = (context_sequence_number is null))
);
create index mission_hint_requests_run_created_idx on public.mission_hint_requests(mission_run_id,created_at,id);
create index mission_hint_requests_step_idx on public.mission_hint_requests(mission_step_id);
alter table public.mission_hint_requests enable row level security;
revoke all on public.mission_hint_requests from public, anon, authenticated, service_role;
grant select on public.mission_hint_requests to authenticated;
grant select,insert,delete on public.mission_hint_requests to service_role;
create policy mission_hint_requests_select_owner on public.mission_hint_requests for select to authenticated
using(exists(select 1 from public.mission_runs r where r.id=mission_run_id and r.owner_id=(select auth.uid())));

create function public.persist_mission_hint(
 _expected_owner_id uuid,_request_id uuid,_mission_run_id uuid,_mission_step_id uuid,_depth integer,
 _result jsonb,_context_message_id uuid,_context_sequence_number bigint
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 run public.mission_runs%rowtype;
 saved public.mission_hint_requests%rowtype;
 owned_conversation_id uuid;
 latest_id uuid;
 latest_sequence bigint;
begin
 if _expected_owner_id is null or _request_id is null or _mission_run_id is null or _mission_step_id is null
   or _depth is null or _depth not between 1 and 3 then
   raise exception using errcode='22023',message='invalid mission hint request';
 end if;
 select r.conversation_id into owned_conversation_id from public.mission_runs r
 where r.id=_mission_run_id and r.owner_id=_expected_owner_id;
 if not found then raise exception using errcode='42501',message='mission hint owner mismatch'; end if;
 perform 1 from public.conversations c where c.id=owned_conversation_id and c.owner_id=_expected_owner_id and c.status='active' for update;
 if not found then raise exception using errcode='42501',message='mission hint conversation unavailable'; end if;
 select r.* into run from public.mission_runs r where r.id=_mission_run_id and r.owner_id=_expected_owner_id for update;
 if not found or run.status='abandoned' then raise exception using errcode='PT409',message='mission run unavailable'; end if;
 perform 1 from public.mission_steps s where s.id=_mission_step_id and s.mission_version_id=run.mission_version_id;
 if not found then raise exception using errcode='22023',message='hint step does not belong to pinned mission version'; end if;
 select h.* into saved from public.mission_hint_requests h where h.id=_request_id;
 if found then
   if saved.mission_run_id<>_mission_run_id or saved.mission_step_id<>_mission_step_id or saved.depth<>_depth then
     raise exception using errcode='PT409',message='hint request key reused';
   end if;
   return to_jsonb(saved);
 end if;
 select m.id,m.sequence_number into latest_id,latest_sequence from public.messages m
 where m.conversation_id=owned_conversation_id and m.status='complete' and m.role in ('user','assistant')
 order by m.sequence_number desc limit 1;
 if latest_id is distinct from _context_message_id or latest_sequence is distinct from _context_sequence_number then
   raise exception using errcode='PT409',message='mission hint context changed';
 end if;
 insert into public.mission_hint_requests(id,mission_run_id,mission_step_id,depth,result,context_message_id,context_sequence_number)
 values(_request_id,_mission_run_id,_mission_step_id,_depth,_result,_context_message_id,_context_sequence_number)
 on conflict(id) do nothing returning * into saved;
 if not found then
   select h.* into saved from public.mission_hint_requests h where h.id=_request_id;
   if saved.mission_run_id<>_mission_run_id or saved.mission_step_id<>_mission_step_id or saved.depth<>_depth then
     raise exception using errcode='PT409',message='hint request key reused';
   end if;
 end if;
 return to_jsonb(saved);
end; $$;
revoke all on function public.persist_mission_hint(uuid,uuid,uuid,uuid,integer,jsonb,uuid,bigint) from public,anon,authenticated;
grant execute on function public.persist_mission_hint(uuid,uuid,uuid,uuid,integer,jsonb,uuid,bigint) to service_role;

create function public.snapshot_mission_assistance() returns trigger
language plpgsql security definer set search_path = '' as $$
declare tracked_at timestamptz; snapshot jsonb;
begin
 if tg_op='UPDATE' then
   -- Evaluation assistance is fixed at insertion, including absent legacy evidence.
   new.feedback := new.feedback - 'assistance';
   if old.feedback ? 'assistance' then new.feedback := new.feedback || jsonb_build_object('assistance',old.feedback->'assistance'); end if;
   return new;
 end if;
 select r.hint_tracking_started_at into tracked_at from public.mission_runs r where r.id=new.mission_run_id for update;
 select jsonb_build_object('status',case when tracked_at is null then 'unknown' else 'tracked' end,
   'requestCount',coalesce(sum(grouped.n),0),'maxDepth',coalesce(max(grouped.depth),0),
   'steps',coalesce(jsonb_agg(jsonb_build_object('stepId',grouped.mission_step_id,'maxDepth',grouped.depth,'requestCount',grouped.n)
     order by grouped.mission_step_id),'[]'::jsonb),'capturedAt',clock_timestamp()) into snapshot
 from (select h.mission_step_id,count(*)::integer n,max(h.depth) depth from public.mission_hint_requests h
   where h.mission_run_id=new.mission_run_id group by h.mission_step_id) grouped;
 new.feedback := new.feedback || jsonb_build_object('assistance',snapshot);
 return new;
end; $$;
revoke all on function public.snapshot_mission_assistance() from public,anon,authenticated;
create trigger snapshot_mission_assistance before insert or update of feedback on public.mission_evaluations
for each row execute function public.snapshot_mission_assistance();

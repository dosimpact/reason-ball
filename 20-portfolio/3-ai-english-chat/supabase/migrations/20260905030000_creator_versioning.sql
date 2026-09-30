begin;

-- Primary media is part of a versioned creator snapshot. Keeping one primary
-- per version lets a published version retain its immutable image while a new
-- draft or publication points at a different image.
drop index if exists public.character_assets_one_primary_per_type;

create unique index character_assets_one_primary_per_version_type
  on public.character_assets(character_id, character_version_id, asset_type)
  where is_primary and character_version_id is not null;

create or replace function public.create_character_version(
  _character_id uuid,
  _character_version_id uuid,
  _expected_owner_id uuid,
  _expected_version_number integer,
  _payload jsonb
)
returns table (
  character_id uuid,
  character_version_id uuid,
  version_number integer,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
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
    raise exception using errcode = '40001', message = 'character version conflict';
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

create or replace function public.create_mission_version(
  _mission_id uuid,
  _mission_version_id uuid,
  _expected_owner_id uuid,
  _expected_version_number integer,
  _payload jsonb
)
returns table (
  mission_id uuid,
  mission_version_id uuid,
  version_number integer,
  status text,
  mission_reward_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
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
    raise exception using errcode = '40001', message = 'mission version conflict';
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

-- Publishing a later version may intentionally reuse a compatible immutable
-- portrait from an earlier version when the creator did not regenerate it.
create or replace function public.publish_character(
  _character_id uuid,
  _expected_owner_id uuid
)
returns table (character_id uuid, character_version_id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
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

revoke execute on function public.create_character_version(uuid, uuid, uuid, integer, jsonb)
from public, anon, authenticated;
revoke execute on function public.create_mission_version(uuid, uuid, uuid, integer, jsonb)
from public, anon, authenticated;

grant execute on function public.create_character_version(uuid, uuid, uuid, integer, jsonb)
to service_role;
grant execute on function public.create_mission_version(uuid, uuid, uuid, integer, jsonb)
to service_role;

commit;

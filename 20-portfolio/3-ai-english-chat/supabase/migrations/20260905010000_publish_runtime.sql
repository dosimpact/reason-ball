begin;

alter table public.character_versions
  add column if not exists published_at timestamptz;

alter table public.mission_versions
  add column if not exists published_at timestamptz;

update public.character_versions as version
set published_at = coalesce(character.published_at, character.updated_at, character.created_at)
from public.characters as character
where character.current_version_id = version.id
  and character.status in ('published', 'archived')
  and version.published_at is null;

update public.mission_versions as version
set published_at = coalesce(mission.published_at, mission.updated_at, mission.created_at)
from public.missions as mission
where mission.current_version_id = version.id
  and mission.status in ('published', 'archived')
  and version.published_at is null;

create or replace function public.prevent_published_version_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
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

create trigger character_versions_prevent_published_mutation
before update or delete on public.character_versions
for each row execute function public.prevent_published_version_mutation();

create trigger mission_versions_prevent_published_mutation
before update or delete on public.mission_versions
for each row execute function public.prevent_published_version_mutation();

create or replace function public.prevent_published_character_instruction_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_version_id uuid;
begin
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

create trigger character_instructions_prevent_published_mutation
before insert or update or delete on public.character_version_instructions
for each row execute function public.prevent_published_character_instruction_mutation();

create or replace function public.prevent_published_mission_child_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_version_id uuid;
begin
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

create trigger mission_instructions_prevent_published_mutation
before insert or update or delete on public.mission_version_instructions
for each row execute function public.prevent_published_mission_child_mutation();

create trigger mission_steps_prevent_published_mutation
before insert or update or delete on public.mission_steps
for each row execute function public.prevent_published_mission_child_mutation();

create trigger mission_rewards_prevent_published_mutation
before insert or update or delete on public.mission_rewards
for each row execute function public.prevent_published_mission_child_mutation();

create or replace function public.prevent_published_mission_character_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_mission_id uuid;
begin
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

create trigger mission_characters_prevent_published_mutation
before insert or update or delete on public.mission_characters
for each row execute function public.prevent_published_mission_character_mutation();

create or replace function public.prevent_published_asset_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  old_version_id uuid;
  new_version_id uuid;
  target_asset_id uuid;
  target_asset_type text;
begin
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

create trigger character_assets_prevent_published_mutation
before insert or update or delete on public.character_assets
for each row execute function public.prevent_published_asset_mutation();

create trigger mission_assets_prevent_published_mutation
before insert or update or delete on public.mission_assets
for each row execute function public.prevent_published_asset_mutation();

create table public.character_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  reason text not null check (
    reason in (
      'spam', 'unsafe', 'sexual', 'hate', 'harassment',
      'impersonation', 'copyright', 'other'
    )
  ),
  details text not null default '' check (char_length(details) <= 2000),
  status text not null default 'pending'
    check (status in ('pending', 'reviewing', 'resolved', 'dismissed')),
  resolution_note text not null default '' check (char_length(resolution_note) <= 2000),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (reporter_id <> reviewed_by),
  check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null)
    or status <> 'pending'
  )
);

create unique index character_reports_one_open_per_reporter
  on public.character_reports(reporter_id, character_id)
  where status in ('pending', 'reviewing');

create index character_reports_review_queue
  on public.character_reports(status, created_at);

alter table public.character_reports enable row level security;

create policy character_reports_select_self_or_admin
on public.character_reports for select to authenticated
using (reporter_id = (select auth.uid()) or public.is_admin());

comment on table public.character_reports is
  'Private moderation queue. Only the reporter and administrators can read a report.';

create or replace function public.create_character_with_version(
  _character_id uuid,
  _character_version_id uuid,
  _expected_owner_id uuid,
  _payload jsonb
)
returns table (
  character_id uuid,
  character_version_id uuid,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
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

create or replace function public.create_mission_with_version(
  _mission_id uuid,
  _mission_version_id uuid,
  _expected_owner_id uuid,
  _payload jsonb
)
returns table (
  mission_id uuid,
  mission_version_id uuid,
  status text,
  mission_reward_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
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
  if locked_character.current_version_id is null then
    raise exception using errcode = '23514', message = 'character has no active version';
  end if;
  if not exists (
    select 1 from public.character_assets as asset
    where asset.character_id = locked_character.id
      and asset.character_version_id = locked_character.current_version_id
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

create or replace function public.archive_character(
  _character_id uuid,
  _expected_owner_id uuid
)
returns table (character_id uuid, status text)
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

  update public.characters as character
  set status = 'archived'
  where character.id = locked_character.id;

  return query select locked_character.id, 'archived'::text;
end;
$$;

create or replace function public.publish_mission(
  _mission_id uuid,
  _expected_owner_id uuid
)
returns table (mission_id uuid, mission_version_id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
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

create or replace function public.archive_mission(
  _mission_id uuid,
  _expected_owner_id uuid
)
returns table (mission_id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
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

create or replace function public.attach_character_asset(
  _asset_id uuid,
  _character_id uuid,
  _expected_owner_id uuid,
  _payload jsonb
)
returns table (asset_id uuid, storage_bucket text, storage_path text)
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

create or replace function public.attach_mission_asset(
  _asset_id uuid,
  _mission_id uuid,
  _expected_owner_id uuid,
  _payload jsonb
)
returns table (asset_id uuid, storage_bucket text, storage_path text)
language plpgsql
security definer
set search_path = ''
as $$
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

create or replace function public.create_character_report(
  _character_id uuid,
  _expected_reporter_id uuid,
  _reason text,
  _details text default ''
)
returns table (
  report_id uuid,
  character_id uuid,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
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

create or replace function public.moderate_character_report(
  _report_id uuid,
  _character_id uuid,
  _expected_admin_id uuid,
  _resolution_note text default ''
)
returns table (
  report_id uuid,
  character_id uuid,
  report_status text,
  character_status text,
  character_visibility text
)
language plpgsql
security definer
set search_path = ''
as $$
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

revoke execute on function public.prevent_published_version_mutation() from public, anon, authenticated;
revoke execute on function public.prevent_published_character_instruction_mutation() from public, anon, authenticated;
revoke execute on function public.prevent_published_mission_child_mutation() from public, anon, authenticated;
revoke execute on function public.prevent_published_mission_character_mutation() from public, anon, authenticated;
revoke execute on function public.prevent_published_asset_mutation() from public, anon, authenticated;

revoke execute on function public.create_character_with_version(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.create_mission_with_version(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.publish_character(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.archive_character(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.publish_mission(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.archive_mission(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.attach_character_asset(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.attach_mission_asset(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.create_character_report(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.moderate_character_report(uuid, uuid, uuid, text) from public, anon, authenticated;

grant execute on function public.create_character_with_version(uuid, uuid, uuid, jsonb) to service_role;
grant execute on function public.create_mission_with_version(uuid, uuid, uuid, jsonb) to service_role;
grant execute on function public.publish_character(uuid, uuid) to service_role;
grant execute on function public.archive_character(uuid, uuid) to service_role;
grant execute on function public.publish_mission(uuid, uuid) to service_role;
grant execute on function public.archive_mission(uuid, uuid) to service_role;
grant execute on function public.attach_character_asset(uuid, uuid, uuid, jsonb) to service_role;
grant execute on function public.attach_mission_asset(uuid, uuid, uuid, jsonb) to service_role;
grant execute on function public.create_character_report(uuid, uuid, text, text) to service_role;
grant execute on function public.moderate_character_report(uuid, uuid, uuid, text) to service_role;

grant select on table public.character_reports to authenticated;
grant all privileges on table public.character_reports to service_role;

revoke insert, update, delete on table
  public.characters,
  public.character_versions,
  public.character_assets,
  public.character_tags,
  public.missions,
  public.mission_versions,
  public.mission_steps,
  public.mission_characters,
  public.mission_assets
from authenticated;

comment on column public.character_versions.published_at is
  'Once set, the version and its server-only instructions are immutable.';
comment on column public.mission_versions.published_at is
  'Once set, the version, steps, rewards, and server-only instructions are immutable.';

commit;

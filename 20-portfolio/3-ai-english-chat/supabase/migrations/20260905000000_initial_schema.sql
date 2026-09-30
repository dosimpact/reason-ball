begin;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username extensions.citext unique,
  display_name text not null default 'English Learner',
  avatar_path text,
  bio text not null default '',
  native_language text not null default 'ko',
  target_language text not null default 'en',
  cefr_level text not null default 'A1'
    check (cefr_level in ('pre-A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  daily_goal_minutes integer not null default 10
    check (daily_goal_minutes between 1 and 240),
  onboarding_completed boolean not null default false,
  is_public boolean not null default true,
  experience_points integer not null default 0 check (experience_points >= 0),
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_learning_at timestamptz,
  preferences jsonb not null default '{}'::jsonb
    check (jsonb_typeof(preferences) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.user_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'plus', 'creator', 'admin')),
  messages_per_hour integer not null default 30 check (messages_per_hour > 0),
  image_generations_per_day integer not null default 3
    check (image_generations_per_day >= 0),
  speech_seconds_per_day integer not null default 300
    check (speech_seconds_per_day >= 0),
  active_from timestamptz not null default timezone('utc', now()),
  active_until timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (active_until is null or active_until > active_from)
);

create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  job_type text not null check (
    job_type in (
      'character-draft', 'character-image', 'mission-draft', 'mission-image',
      'chat-title', 'artifact', 'evaluation', 'speech', 'other'
    )
  ),
  target_type text not null,
  target_id uuid,
  provider text not null,
  model_id text not null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  progress smallint not null default 0 check (progress between 0 and 100),
  request_payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(request_payload) = 'object'),
  result_payload jsonb check (result_payload is null or jsonb_typeof(result_payload) = 'object'),
  error_code text,
  error_message text,
  idempotency_key text,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  estimated_cost_micros bigint check (estimated_cost_micros is null or estimated_cost_micros >= 0),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts > 0),
  available_at timestamptz not null default timezone('utc', now()),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (owner_id, idempotency_key),
  check (completed_at is null or started_at is null or completed_at >= started_at)
);

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  slug extensions.citext not null unique
    check (slug::text ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 80),
  tagline text not null default '' check (char_length(tagline) <= 160),
  description text not null default '',
  visibility text not null default 'private'
    check (visibility in ('private', 'unlisted', 'public')),
  status text not null default 'draft'
    check (status in ('draft', 'generating', 'review', 'published', 'archived')),
  current_version_id uuid,
  age_rating text not null default 'everyone'
    check (age_rating in ('everyone', 'teen', 'mature')),
  featured boolean not null default false,
  conversation_count bigint not null default 0 check (conversation_count >= 0),
  favorite_count bigint not null default 0 check (favorite_count >= 0),
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  search_document tsvector generated always as (
    to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(tagline, '') || ' ' || coalesce(description, ''))
  ) stored,
  check (owner_id is not null or status in ('published', 'archived')),
  check (status <> 'published' or current_version_id is not null)
);

create table public.character_versions (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  change_summary text not null default '',
  personality_summary text not null check (char_length(personality_summary) between 1 and 2000),
  personality_traits jsonb not null default '[]'::jsonb
    check (jsonb_typeof(personality_traits) = 'array'),
  persona_goals jsonb not null
    check (
      jsonb_typeof(persona_goals) = 'array'
      and jsonb_array_length(persona_goals) > 0
    ),
  learning_goals jsonb not null
    check (
      jsonb_typeof(learning_goals) = 'array'
      and jsonb_array_length(learning_goals) > 0
    ),
  backstory text not null default '',
  greeting text not null check (char_length(greeting) between 1 and 4000),
  example_dialogues jsonb not null default '[]'::jsonb
    check (jsonb_typeof(example_dialogues) = 'array'),
  voice_config jsonb not null default '{}'::jsonb
    check (jsonb_typeof(voice_config) = 'object'),
  image_prompt text not null default '',
  locale text not null default 'en-US',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (character_id, version_number),
  unique (character_id, id)
);

create table public.character_version_instructions (
  character_version_id uuid primary key
    references public.character_versions(id) on delete cascade,
  system_prompt text not null,
  safety_instructions text not null default '',
  conversation_rules jsonb not null default '{}'::jsonb
    check (jsonb_typeof(conversation_rules) = 'object'),
  model_config jsonb not null default '{}'::jsonb
    check (jsonb_typeof(model_config) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.character_version_instructions is
  'Server-only prompt material. anon/authenticated grants are revoked below.';

alter table public.characters
  add constraint characters_current_version_fk
  foreign key (current_version_id) references public.character_versions(id)
  on delete no action deferrable initially deferred;

create table public.character_assets (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  character_version_id uuid references public.character_versions(id) on delete set null,
  generation_job_id uuid references public.generation_jobs(id) on delete set null,
  asset_type text not null
    check (asset_type in ('avatar', 'portrait', 'reward', 'background', 'voice-sample')),
  access_level text not null default 'owner'
    check (access_level in ('public', 'owner', 'reward')),
  storage_bucket text not null
    check (storage_bucket in ('character-public', 'character-private')),
  storage_path text not null,
  mime_type text not null,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  prompt text not null default '',
  alt_text text not null default '',
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (storage_bucket, storage_path),
  check (
    (access_level = 'public' and storage_bucket = 'character-public')
    or (access_level in ('owner', 'reward') and storage_bucket = 'character-private')
  )
);

comment on column public.character_assets.access_level is
  'Reward originals stay in character-private and become readable only through reward_unlocks.';

create unique index character_assets_one_primary_per_type
  on public.character_assets(character_id, asset_type)
  where is_primary;

create table public.character_tags (
  character_id uuid not null references public.characters(id) on delete cascade,
  tag extensions.citext not null check (char_length(tag::text) between 1 and 40),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (character_id, tag)
);

create table public.character_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, character_id)
);

create table public.missions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  slug extensions.citext not null unique
    check (slug::text ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 120),
  summary text not null default '' check (char_length(summary) <= 500),
  scenario_category text not null,
  difficulty text not null default 'A1'
    check (difficulty in ('pre-A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  estimated_minutes integer not null default 10 check (estimated_minutes between 1 and 180),
  visibility text not null default 'private'
    check (visibility in ('private', 'unlisted', 'public')),
  status text not null default 'draft'
    check (status in ('draft', 'generating', 'review', 'published', 'archived')),
  current_version_id uuid,
  reward_experience_points integer not null default 50
    check (reward_experience_points >= 0),
  featured boolean not null default false,
  completion_count bigint not null default 0 check (completion_count >= 0),
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  search_document tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(scenario_category, ''))
  ) stored,
  check (owner_id is not null or status in ('published', 'archived')),
  check (status <> 'published' or current_version_id is not null)
);

create table public.mission_versions (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  change_summary text not null default '',
  learning_goals jsonb not null
    check (
      jsonb_typeof(learning_goals) = 'array'
      and jsonb_array_length(learning_goals) > 0
    ),
  scenario_context text not null,
  learner_role text not null,
  character_role text not null,
  opening_instruction text not null,
  target_vocabulary jsonb not null default '[]'::jsonb
    check (jsonb_typeof(target_vocabulary) = 'array'),
  target_grammar jsonb not null default '[]'::jsonb
    check (jsonb_typeof(target_grammar) = 'array'),
  pass_score numeric(5,2) not null default 70 check (pass_score between 0 and 100),
  maximum_turns integer not null default 20 check (maximum_turns between 1 and 100),
  locale text not null default 'en-US',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (mission_id, version_number),
  unique (mission_id, id)
);

create table public.mission_version_instructions (
  mission_version_id uuid primary key references public.mission_versions(id) on delete cascade,
  director_prompt text not null,
  evaluator_prompt text not null,
  safety_instructions text not null default '',
  evaluator_config jsonb not null default '{}'::jsonb
    check (jsonb_typeof(evaluator_config) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.mission_version_instructions is
  'Server-only director and evaluator prompts. anon/authenticated grants are revoked below.';

create table public.mission_steps (
  id uuid primary key default gen_random_uuid(),
  mission_version_id uuid not null references public.mission_versions(id) on delete cascade,
  step_order integer not null check (step_order > 0),
  title text not null,
  objective text not null,
  learner_goal text not null,
  character_instruction text not null,
  success_criteria jsonb not null default '[]'::jsonb
    check (jsonb_typeof(success_criteria) = 'array'),
  hints jsonb not null default '[]'::jsonb check (jsonb_typeof(hints) = 'array'),
  vocabulary jsonb not null default '[]'::jsonb check (jsonb_typeof(vocabulary) = 'array'),
  is_optional boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  unique (mission_version_id, step_order)
);

create table public.mission_characters (
  mission_id uuid not null references public.missions(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  is_recommended boolean not null default false,
  role_override text,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (mission_id, character_id)
);

create table public.mission_assets (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  mission_version_id uuid references public.mission_versions(id) on delete set null,
  generation_job_id uuid references public.generation_jobs(id) on delete set null,
  asset_type text not null check (asset_type in ('thumbnail', 'scene', 'badge')),
  access_level text not null default 'owner'
    check (access_level in ('public', 'owner')),
  storage_bucket text not null default 'mission-private'
    check (storage_bucket in ('mission-public', 'mission-private')),
  storage_path text not null,
  mime_type text not null,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  alt_text text not null default '',
  is_primary boolean not null default false,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  unique (storage_bucket, storage_path),
  check (
    (access_level = 'public' and storage_bucket = 'mission-public')
    or (access_level = 'owner' and storage_bucket = 'mission-private')
  )
);

create unique index mission_assets_one_primary_per_type
  on public.mission_assets(mission_id, asset_type)
  where is_primary;

create table public.mission_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, mission_id)
);

create table public.mission_rewards (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  mission_version_id uuid not null references public.mission_versions(id) on delete cascade,
  character_asset_id uuid not null references public.character_assets(id) on delete restrict,
  minimum_score numeric(5,2) not null default 0
    check (minimum_score between 0 and 100),
  minimum_stars smallint not null default 1 check (minimum_stars between 1 and 3),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (mission_version_id, character_asset_id),
  foreign key (mission_id, mission_version_id)
    references public.mission_versions(mission_id, id) on delete cascade
);

comment on table public.mission_rewards is
  'Server-managed mapping from a versioned mission to a private reward character image.';

alter table public.missions
  add constraint missions_current_version_fk
  foreign key (current_version_id) references public.mission_versions(id)
  on delete no action deferrable initially deferred;

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete restrict,
  character_version_id uuid not null references public.character_versions(id) on delete restrict,
  mission_id uuid references public.missions(id) on delete set null,
  mission_version_id uuid references public.mission_versions(id) on delete restrict,
  title text not null default 'New conversation' check (char_length(title) between 1 and 200),
  visibility text not null default 'private'
    check (visibility in ('private', 'unlisted', 'public')),
  status text not null default 'active'
    check (status in ('active', 'archived', 'deleted')),
  model_id text not null,
  share_token uuid not null default gen_random_uuid() unique,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  last_message_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check ((mission_id is null) = (mission_version_id is null))
);

alter table public.conversations
  add constraint conversations_character_version_snapshot_fk
  foreign key (character_id, character_version_id)
  references public.character_versions(character_id, id) on delete restrict;

alter table public.conversations
  add constraint conversations_mission_version_snapshot_fk
  foreign key (mission_id, mission_version_id)
  references public.mission_versions(mission_id, id) on delete restrict;

comment on table public.conversations is
  'Pins character and optional mission versions so later edits never rewrite an active chat persona or learning contract.';

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  role text not null check (role in ('system', 'user', 'assistant', 'tool')),
  status text not null default 'complete'
    check (status in ('pending', 'streaming', 'complete', 'error', 'cancelled')),
  parts jsonb not null default '[]'::jsonb check (jsonb_typeof(parts) = 'array'),
  plain_text text not null default '',
  parent_message_id uuid references public.messages(id) on delete set null,
  model_id text,
  provider_message_id text,
  finish_reason text,
  error_code text,
  error_message text,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  sequence_number bigint generated always as identity,
  client_message_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (conversation_id, sequence_number),
  unique (conversation_id, client_message_id),
  check (
    (role = 'user' and author_id is not null)
    or (role in ('system', 'assistant', 'tool'))
  )
);

comment on column public.messages.role is
  'Authenticated public clients may insert only user rows; system, assistant, and tool rows require the server secret client.';

create table public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_bucket text not null default 'chat-attachments'
    check (storage_bucket = 'chat-attachments'),
  storage_path text not null,
  filename text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size between 1 and 26214400),
  access_level text not null default 'private'
    check (access_level in ('private', 'conversation')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  unique (storage_bucket, storage_path)
);

create table public.message_feedback (
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  rating smallint not null check (rating in (-1, 1)),
  reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, message_id)
);

create table public.stream_sessions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  resume_token_hash text not null unique,
  status text not null default 'active'
    check (status in ('active', 'completed', 'expired', 'cancelled')),
  transport_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(transport_metadata) = 'object'),
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (expires_at > created_at)
);

create table public.message_audio (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  generation_job_id uuid references public.generation_jobs(id) on delete set null,
  message_revision integer not null default 1 check (message_revision > 0),
  text_hash text not null check (text_hash ~ '^[0-9a-f]{64}$'),
  voice_id text not null,
  model_id text not null,
  speaking_rate numeric(4,2) not null default 1.00
    check (speaking_rate between 0.25 and 4.00),
  storage_bucket text not null default 'chat-attachments'
    check (storage_bucket = 'chat-attachments'),
  storage_path text not null,
  mime_type text not null default 'audio/mpeg',
  duration_ms integer check (duration_ms is null or duration_ms > 0),
  created_at timestamptz not null default timezone('utc', now()),
  unique (
    message_id,
    owner_id,
    message_revision,
    text_hash,
    model_id,
    voice_id,
    speaking_rate
  ),
  unique (storage_bucket, storage_path)
);

comment on table public.message_audio is
  'Immutable TTS cache keyed by message revision, normalized text hash, model, voice, and speaking rate.';

create table public.artifacts (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('text', 'code', 'image', 'sheet')),
  title text not null check (char_length(title) between 1 and 200),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  current_version_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.artifact_versions (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.artifacts(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  source_message_id uuid references public.messages(id) on delete set null,
  content_text text,
  content_json jsonb,
  storage_bucket text,
  storage_path text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (artifact_id, version_number),
  check (
    content_text is not null
    or content_json is not null
    or (storage_bucket is not null and storage_path is not null)
  )
);

alter table public.artifacts
  add constraint artifacts_current_version_fk
  foreign key (current_version_id) references public.artifact_versions(id)
  on delete no action deferrable initially deferred;

create table public.artifact_suggestions (
  id uuid primary key default gen_random_uuid(),
  artifact_version_id uuid not null references public.artifact_versions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  original_text text not null,
  suggested_text text not null,
  description text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.mission_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete restrict,
  mission_version_id uuid not null references public.mission_versions(id) on delete restrict,
  character_id uuid not null references public.characters(id) on delete restrict,
  character_version_id uuid not null references public.character_versions(id) on delete restrict,
  conversation_id uuid not null unique references public.conversations(id) on delete cascade,
  status text not null default 'not-started'
    check (status in ('not-started', 'in-progress', 'evaluating', 'passed', 'failed', 'abandoned')),
  current_step_order integer not null default 1 check (current_step_order > 0),
  attempt_number integer not null default 1 check (attempt_number > 0),
  score numeric(5,2) check (score is null or score between 0 and 100),
  stars smallint check (stars is null or stars between 0 and 3),
  awarded_mission_reward_id uuid references public.mission_rewards(id) on delete restrict,
  awarded_evaluation_id uuid,
  turn_count integer not null default 0 check (turn_count >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (completed_at is null or started_at is null or completed_at >= started_at),
  check (
    status <> 'passed'
    or (awarded_mission_reward_id is not null and awarded_evaluation_id is not null)
  )
);

create table public.mission_step_progress (
  mission_run_id uuid not null references public.mission_runs(id) on delete cascade,
  mission_step_id uuid not null references public.mission_steps(id) on delete restrict,
  status text not null default 'locked'
    check (status in ('locked', 'active', 'completed', 'skipped')),
  attempts integer not null default 0 check (attempts >= 0),
  evidence_message_ids uuid[] not null default '{}'::uuid[],
  score numeric(5,2) check (score is null or score between 0 and 100),
  feedback text,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (mission_run_id, mission_step_id)
);

create table public.mission_evaluations (
  id uuid primary key default gen_random_uuid(),
  mission_run_id uuid not null references public.mission_runs(id) on delete cascade,
  generation_job_id uuid references public.generation_jobs(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed')),
  evaluator_model_id text not null,
  total_score numeric(5,2) check (total_score is null or total_score between 0 and 100),
  passed boolean,
  rubric_scores jsonb not null default '{}'::jsonb
    check (jsonb_typeof(rubric_scores) = 'object'),
  feedback jsonb not null default '{}'::jsonb check (jsonb_typeof(feedback) = 'object'),
  corrections jsonb not null default '[]'::jsonb check (jsonb_typeof(corrections) = 'array'),
  completed_learning_goals jsonb not null default '[]'::jsonb
    check (jsonb_typeof(completed_learning_goals) = 'array'),
  vocabulary_observed jsonb not null default '[]'::jsonb
    check (jsonb_typeof(vocabulary_observed) = 'array'),
  raw_response jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

alter table public.mission_runs
  add constraint mission_runs_awarded_evaluation_fk
  foreign key (awarded_evaluation_id) references public.mission_evaluations(id)
  on delete no action deferrable initially deferred;

create table public.reward_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_asset_id uuid not null references public.character_assets(id) on delete cascade,
  mission_reward_id uuid not null references public.mission_rewards(id) on delete restrict,
  mission_id uuid not null references public.missions(id) on delete restrict,
  mission_run_id uuid not null references public.mission_runs(id) on delete cascade,
  mission_evaluation_id uuid references public.mission_evaluations(id) on delete set null,
  unlocked_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  unique (user_id, character_asset_id)
);

create table public.vocabulary_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  normalized_term extensions.citext not null,
  display_term text not null,
  meaning text not null default '',
  mastery_level smallint not null default 0 check (mastery_level between 0 and 5),
  exposure_count integer not null default 0 check (exposure_count >= 0),
  correct_use_count integer not null default 0 check (correct_use_count >= 0),
  last_seen_at timestamptz,
  next_review_at timestamptz,
  source_mission_id uuid references public.missions(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, normalized_term)
);

create table public.daily_learning_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  learning_date date not null,
  active_minutes integer not null default 0 check (active_minutes >= 0),
  messages_sent integer not null default 0 check (messages_sent >= 0),
  missions_started integer not null default 0 check (missions_started >= 0),
  missions_completed integer not null default 0 check (missions_completed >= 0),
  experience_earned integer not null default 0 check (experience_earned >= 0),
  speech_seconds integer not null default 0 check (speech_seconds >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, learning_date)
);

create table public.ai_usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  generation_job_id uuid references public.generation_jobs(id) on delete set null,
  usage_kind text not null check (usage_kind in ('chat', 'image', 'speech', 'evaluation')),
  provider text not null,
  model_id text not null,
  input_units bigint not null default 0 check (input_units >= 0),
  output_units bigint not null default 0 check (output_units >= 0),
  cost_micros bigint not null default 0 check (cost_micros >= 0),
  occurred_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object')
);

create index characters_owner_created_idx on public.characters(owner_id, created_at desc);
create index characters_discovery_idx
  on public.characters(status, visibility, featured desc, published_at desc);
create index characters_search_idx on public.characters using gin(search_document);
create index character_versions_character_idx
  on public.character_versions(character_id, version_number desc);
create index character_assets_character_idx
  on public.character_assets(character_id, asset_type, sort_order);
create index character_tags_tag_idx on public.character_tags(tag, character_id);
create index character_favorites_character_idx
  on public.character_favorites(character_id, created_at desc);

create index missions_owner_created_idx on public.missions(owner_id, created_at desc);
create index missions_discovery_idx
  on public.missions(status, visibility, difficulty, featured desc, published_at desc);
create index missions_search_idx on public.missions using gin(search_document);
create index mission_versions_mission_idx
  on public.mission_versions(mission_id, version_number desc);
create index mission_characters_character_idx
  on public.mission_characters(character_id, mission_id);
create index mission_favorites_mission_idx
  on public.mission_favorites(mission_id, created_at desc);
create index mission_rewards_mission_idx
  on public.mission_rewards(mission_id, mission_version_id, sort_order)
  where is_active;

create index conversations_owner_recent_idx
  on public.conversations(owner_id, status, last_message_at desc nulls last, created_at desc);
create index conversations_character_idx
  on public.conversations(character_id, created_at desc);
create index messages_conversation_sequence_idx
  on public.messages(conversation_id, sequence_number);
create index messages_parent_idx on public.messages(parent_message_id);
create index message_attachments_message_idx on public.message_attachments(message_id);
create index stream_sessions_active_idx
  on public.stream_sessions(user_id, expires_at)
  where status = 'active';
create index artifacts_conversation_idx on public.artifacts(conversation_id, updated_at desc);
create index artifact_versions_artifact_idx
  on public.artifact_versions(artifact_id, version_number desc);

create index mission_runs_owner_recent_idx
  on public.mission_runs(owner_id, created_at desc);
create index mission_runs_mission_status_idx
  on public.mission_runs(mission_id, status, completed_at desc);
create index mission_evaluations_run_idx
  on public.mission_evaluations(mission_run_id, created_at desc);
create index reward_unlocks_user_idx
  on public.reward_unlocks(user_id, unlocked_at desc);
create index vocabulary_progress_review_idx
  on public.vocabulary_progress(user_id, next_review_at)
  where mastery_level < 5;
create index daily_learning_stats_user_date_idx
  on public.daily_learning_stats(user_id, learning_date desc);
create index generation_jobs_queue_idx
  on public.generation_jobs(status, available_at, created_at)
  where status in ('queued', 'running');
create index generation_jobs_owner_idx
  on public.generation_jobs(owner_id, created_at desc);
create index ai_usage_events_user_time_idx
  on public.ai_usage_events(user_id, occurred_at desc);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger user_entitlements_set_updated_at
before update on public.user_entitlements
for each row execute function public.set_updated_at();

create trigger generation_jobs_set_updated_at
before update on public.generation_jobs
for each row execute function public.set_updated_at();

create trigger characters_set_updated_at
before update on public.characters
for each row execute function public.set_updated_at();

create trigger character_version_instructions_set_updated_at
before update on public.character_version_instructions
for each row execute function public.set_updated_at();

create trigger missions_set_updated_at
before update on public.missions
for each row execute function public.set_updated_at();

create trigger mission_rewards_set_updated_at
before update on public.mission_rewards
for each row execute function public.set_updated_at();

create trigger mission_version_instructions_set_updated_at
before update on public.mission_version_instructions
for each row execute function public.set_updated_at();

create trigger conversations_set_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

create trigger messages_set_updated_at
before update on public.messages
for each row execute function public.set_updated_at();

create trigger message_feedback_set_updated_at
before update on public.message_feedback
for each row execute function public.set_updated_at();

create trigger stream_sessions_set_updated_at
before update on public.stream_sessions
for each row execute function public.set_updated_at();

create trigger artifacts_set_updated_at
before update on public.artifacts
for each row execute function public.set_updated_at();

create trigger artifact_suggestions_set_updated_at
before update on public.artifact_suggestions
for each row execute function public.set_updated_at();

create trigger mission_runs_set_updated_at
before update on public.mission_runs
for each row execute function public.set_updated_at();

create trigger mission_step_progress_set_updated_at
before update on public.mission_step_progress
for each row execute function public.set_updated_at();

create trigger vocabulary_progress_set_updated_at
before update on public.vocabulary_progress
for each row execute function public.set_updated_at();

create trigger daily_learning_stats_set_updated_at
before update on public.daily_learning_stats
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.touch_conversation_after_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_touch_conversation
after insert on public.messages
for each row execute function public.touch_conversation_after_message();

create or replace function public.validate_character_current_version()
returns trigger
language plpgsql
set search_path = ''
as $$
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

create constraint trigger characters_validate_current_version
after insert or update of current_version_id on public.characters
deferrable initially deferred
for each row execute function public.validate_character_current_version();

create or replace function public.validate_mission_current_version()
returns trigger
language plpgsql
set search_path = ''
as $$
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

create constraint trigger missions_validate_current_version
after insert or update of current_version_id on public.missions
deferrable initially deferred
for each row execute function public.validate_mission_current_version();

create or replace function public.validate_mission_reward_definition()
returns trigger
language plpgsql
set search_path = ''
as $$
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

create trigger mission_rewards_validate_definition
before insert or update of
  mission_id,
  mission_version_id,
  character_asset_id,
  is_active
on public.mission_rewards
for each row execute function public.validate_mission_reward_definition();

create or replace function public.validate_artifact_current_version()
returns trigger
language plpgsql
set search_path = ''
as $$
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

create constraint trigger artifacts_validate_current_version
after insert or update of current_version_id on public.artifacts
deferrable initially deferred
for each row execute function public.validate_artifact_current_version();

create or replace function public.validate_mission_run_context()
returns trigger
language plpgsql
set search_path = ''
as $$
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

create constraint trigger mission_runs_validate_context
after insert or update of
  owner_id,
  conversation_id,
  character_id,
  character_version_id,
  mission_id,
  mission_version_id
on public.mission_runs
deferrable initially deferred
for each row execute function public.validate_mission_run_context();

create or replace function public.owns_character(_character_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.characters
    where id = _character_id and owner_id = (select auth.uid())
  ) or public.is_admin();
$$;

create or replace function public.can_view_character(_character_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
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

create or replace function public.owns_mission(_mission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.missions
    where id = _mission_id and owner_id = (select auth.uid())
  ) or public.is_admin();
$$;

create or replace function public.can_view_mission(_mission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
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

create or replace function public.owns_conversation(_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversations
    where id = _conversation_id and owner_id = (select auth.uid())
  ) or public.is_admin();
$$;

create or replace function public.can_view_conversation(_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversations
    where id = _conversation_id
      and status <> 'deleted'
      and (
        owner_id = (select auth.uid())
        or visibility = 'public'
        or (visibility = 'unlisted' and (select auth.uid()) is not null)
      )
  ) or public.is_admin();
$$;

create or replace function public.owns_artifact(_artifact_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.artifacts
    where id = _artifact_id and owner_id = (select auth.uid())
  ) or public.is_admin();
$$;

alter table public.mission_runs
  add constraint mission_runs_version_belongs_to_mission_fk
  foreign key (mission_id, mission_version_id)
  references public.mission_versions(mission_id, id) on delete restrict;

alter table public.mission_runs
  add constraint mission_runs_character_version_snapshot_fk
  foreign key (character_id, character_version_id)
  references public.character_versions(character_id, id) on delete restrict;

alter table public.profiles enable row level security;
alter table public.user_entitlements enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.characters enable row level security;
alter table public.character_versions enable row level security;
alter table public.character_version_instructions enable row level security;
alter table public.character_assets enable row level security;
alter table public.character_tags enable row level security;
alter table public.character_favorites enable row level security;
alter table public.missions enable row level security;
alter table public.mission_versions enable row level security;
alter table public.mission_version_instructions enable row level security;
alter table public.mission_steps enable row level security;
alter table public.mission_characters enable row level security;
alter table public.mission_assets enable row level security;
alter table public.mission_favorites enable row level security;
alter table public.mission_rewards enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.message_attachments enable row level security;
alter table public.message_feedback enable row level security;
alter table public.stream_sessions enable row level security;
alter table public.message_audio enable row level security;
alter table public.artifacts enable row level security;
alter table public.artifact_versions enable row level security;
alter table public.artifact_suggestions enable row level security;
alter table public.mission_runs enable row level security;
alter table public.mission_step_progress enable row level security;
alter table public.mission_evaluations enable row level security;
alter table public.reward_unlocks enable row level security;
alter table public.vocabulary_progress enable row level security;
alter table public.daily_learning_stats enable row level security;
alter table public.ai_usage_events enable row level security;

create policy profiles_select
on public.profiles for select
using (is_public or id = (select auth.uid()) or public.is_admin());

create policy profiles_insert_self
on public.profiles for insert to authenticated
with check (id = (select auth.uid()) or public.is_admin());

create policy profiles_update_self
on public.profiles for update to authenticated
using (id = (select auth.uid()) or public.is_admin())
with check (id = (select auth.uid()) or public.is_admin());

create policy user_entitlements_select_self
on public.user_entitlements for select to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

create policy generation_jobs_select_self
on public.generation_jobs for select to authenticated
using (owner_id = (select auth.uid()) or public.is_admin());

create policy characters_select_visible
on public.characters for select
using (public.can_view_character(id));

create policy characters_insert_owned
on public.characters for insert to authenticated
with check (owner_id = (select auth.uid()) or public.is_admin());

create policy characters_update_owned
on public.characters for update to authenticated
using (public.owns_character(id))
with check (owner_id = (select auth.uid()) or public.is_admin());

create policy characters_delete_owned
on public.characters for delete to authenticated
using (public.owns_character(id));

create policy character_versions_select_visible
on public.character_versions for select
using (
  public.owns_character(character_id)
  or exists (
    select 1 from public.characters as character
    where character.id = character_id
      and character.current_version_id = public.character_versions.id
      and public.can_view_character(character.id)
  )
);

create policy character_versions_insert_owned
on public.character_versions for insert to authenticated
with check (
  public.owns_character(character_id)
  and (created_by = (select auth.uid()) or public.is_admin())
);

create policy character_versions_update_owned
on public.character_versions for update to authenticated
using (public.owns_character(character_id))
with check (public.owns_character(character_id));

create policy character_versions_delete_owned
on public.character_versions for delete to authenticated
using (public.owns_character(character_id));

create policy character_version_instructions_select_owned
on public.character_version_instructions for select to authenticated
using (
  exists (
    select 1 from public.character_versions as version
    where version.id = character_version_id
      and public.owns_character(version.character_id)
  )
);

create policy character_version_instructions_insert_owned
on public.character_version_instructions for insert to authenticated
with check (
  exists (
    select 1 from public.character_versions as version
    where version.id = character_version_id
      and public.owns_character(version.character_id)
  )
);

create policy character_version_instructions_update_owned
on public.character_version_instructions for update to authenticated
using (
  exists (
    select 1 from public.character_versions as version
    where version.id = character_version_id
      and public.owns_character(version.character_id)
  )
)
with check (
  exists (
    select 1 from public.character_versions as version
    where version.id = character_version_id
      and public.owns_character(version.character_id)
  )
);

create policy character_version_instructions_delete_owned
on public.character_version_instructions for delete to authenticated
using (
  exists (
    select 1 from public.character_versions as version
    where version.id = character_version_id
      and public.owns_character(version.character_id)
  )
);

create policy character_assets_select_visible
on public.character_assets for select
using (public.can_view_character(character_id));

create policy character_assets_insert_owned
on public.character_assets for insert to authenticated
with check (
  public.owns_character(character_id)
  and (created_by = (select auth.uid()) or public.is_admin())
);

create policy character_assets_update_owned
on public.character_assets for update to authenticated
using (public.owns_character(character_id))
with check (public.owns_character(character_id));

create policy character_assets_delete_owned
on public.character_assets for delete to authenticated
using (public.owns_character(character_id));

create policy character_tags_select_visible
on public.character_tags for select
using (public.can_view_character(character_id));

create policy character_tags_insert_owned
on public.character_tags for insert to authenticated
with check (public.owns_character(character_id));

create policy character_tags_delete_owned
on public.character_tags for delete to authenticated
using (public.owns_character(character_id));

create policy character_favorites_select_self
on public.character_favorites for select to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

create policy character_favorites_insert_self
on public.character_favorites for insert to authenticated
with check (
  user_id = (select auth.uid())
  and public.can_view_character(character_id)
);

create policy character_favorites_delete_self
on public.character_favorites for delete to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

create policy missions_select_visible
on public.missions for select
using (public.can_view_mission(id));

create policy missions_insert_owned
on public.missions for insert to authenticated
with check (owner_id = (select auth.uid()) or public.is_admin());

create policy missions_update_owned
on public.missions for update to authenticated
using (public.owns_mission(id))
with check (owner_id = (select auth.uid()) or public.is_admin());

create policy missions_delete_owned
on public.missions for delete to authenticated
using (public.owns_mission(id));

create policy mission_versions_select_visible
on public.mission_versions for select
using (
  public.owns_mission(mission_id)
  or exists (
    select 1 from public.missions as mission
    where mission.id = mission_id
      and mission.current_version_id = public.mission_versions.id
      and public.can_view_mission(mission.id)
  )
);

create policy mission_versions_insert_owned
on public.mission_versions for insert to authenticated
with check (
  public.owns_mission(mission_id)
  and (created_by = (select auth.uid()) or public.is_admin())
);

create policy mission_versions_update_owned
on public.mission_versions for update to authenticated
using (public.owns_mission(mission_id))
with check (public.owns_mission(mission_id));

create policy mission_versions_delete_owned
on public.mission_versions for delete to authenticated
using (public.owns_mission(mission_id));

create policy mission_version_instructions_select_owned
on public.mission_version_instructions for select to authenticated
using (
  exists (
    select 1 from public.mission_versions as version
    where version.id = mission_version_id
      and public.owns_mission(version.mission_id)
  )
);

create policy mission_version_instructions_insert_owned
on public.mission_version_instructions for insert to authenticated
with check (
  exists (
    select 1 from public.mission_versions as version
    where version.id = mission_version_id
      and public.owns_mission(version.mission_id)
  )
);

create policy mission_version_instructions_update_owned
on public.mission_version_instructions for update to authenticated
using (
  exists (
    select 1 from public.mission_versions as version
    where version.id = mission_version_id
      and public.owns_mission(version.mission_id)
  )
)
with check (
  exists (
    select 1 from public.mission_versions as version
    where version.id = mission_version_id
      and public.owns_mission(version.mission_id)
  )
);

create policy mission_version_instructions_delete_owned
on public.mission_version_instructions for delete to authenticated
using (
  exists (
    select 1 from public.mission_versions as version
    where version.id = mission_version_id
      and public.owns_mission(version.mission_id)
  )
);

create policy mission_steps_select_visible
on public.mission_steps for select
using (
  exists (
    select 1
    from public.mission_versions as version
    join public.missions as mission on mission.id = version.mission_id
    where version.id = mission_version_id
      and (
        public.owns_mission(mission.id)
        or (
          mission.current_version_id = version.id
          and public.can_view_mission(mission.id)
        )
      )
  )
);

create policy mission_steps_insert_owned
on public.mission_steps for insert to authenticated
with check (
  exists (
    select 1 from public.mission_versions as version
    where version.id = mission_version_id
      and public.owns_mission(version.mission_id)
  )
);

create policy mission_steps_update_owned
on public.mission_steps for update to authenticated
using (
  exists (
    select 1 from public.mission_versions as version
    where version.id = mission_version_id
      and public.owns_mission(version.mission_id)
  )
)
with check (
  exists (
    select 1 from public.mission_versions as version
    where version.id = mission_version_id
      and public.owns_mission(version.mission_id)
  )
);

create policy mission_steps_delete_owned
on public.mission_steps for delete to authenticated
using (
  exists (
    select 1 from public.mission_versions as version
    where version.id = mission_version_id
      and public.owns_mission(version.mission_id)
  )
);

create policy mission_characters_select_visible
on public.mission_characters for select
using (
  public.can_view_mission(mission_id)
  and public.can_view_character(character_id)
);

create policy mission_characters_insert_owned
on public.mission_characters for insert to authenticated
with check (
  public.owns_mission(mission_id)
  and public.can_view_character(character_id)
);

create policy mission_characters_update_owned
on public.mission_characters for update to authenticated
using (public.owns_mission(mission_id))
with check (public.owns_mission(mission_id));

create policy mission_characters_delete_owned
on public.mission_characters for delete to authenticated
using (public.owns_mission(mission_id));

create policy mission_assets_select_visible
on public.mission_assets for select
using (public.can_view_mission(mission_id));

create policy mission_assets_insert_owned
on public.mission_assets for insert to authenticated
with check (public.owns_mission(mission_id));

create policy mission_assets_update_owned
on public.mission_assets for update to authenticated
using (public.owns_mission(mission_id))
with check (public.owns_mission(mission_id));

create policy mission_assets_delete_owned
on public.mission_assets for delete to authenticated
using (public.owns_mission(mission_id));

create policy mission_favorites_select_self
on public.mission_favorites for select to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

create policy mission_favorites_insert_self
on public.mission_favorites for insert to authenticated
with check (
  user_id = (select auth.uid())
  and public.can_view_mission(mission_id)
);

create policy mission_favorites_delete_self
on public.mission_favorites for delete to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

create policy mission_rewards_select_visible
on public.mission_rewards for select
using (
  public.owns_mission(mission_id)
  or (
    is_active
    and public.can_view_mission(mission_id)
    and exists (
      select 1
      from public.character_assets as reward_asset
      where reward_asset.id = character_asset_id
        and public.can_view_character(reward_asset.character_id)
    )
  )
);

create policy conversations_select_visible
on public.conversations for select
using (public.can_view_conversation(id));

create policy conversations_insert_owned
on public.conversations for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and public.can_view_character(character_id)
  and (
    public.owns_character(character_id)
    or exists (
      select 1
      from public.characters as character
      where character.id = character_id
        and character.current_version_id = character_version_id
    )
  )
  and (
    mission_id is null
    or (
      public.can_view_mission(mission_id)
      and (
        public.owns_mission(mission_id)
        or exists (
          select 1
          from public.missions as mission
          where mission.id = mission_id
            and mission.current_version_id = mission_version_id
        )
      )
    )
  )
);

create policy conversations_update_owned
on public.conversations for update to authenticated
using (public.owns_conversation(id))
with check (owner_id = (select auth.uid()) or public.is_admin());

create policy conversations_delete_owned
on public.conversations for delete to authenticated
using (public.owns_conversation(id));

create policy messages_select_visible
on public.messages for select
using (
  (role <> 'system' and public.can_view_conversation(conversation_id))
  or public.is_admin()
);

create policy messages_insert_user_owned_conversation
on public.messages for insert to authenticated
with check (
  public.owns_conversation(conversation_id)
  and role = 'user'
  and author_id = (select auth.uid())
);

create policy messages_update_user_owned_conversation
on public.messages for update to authenticated
using (
  public.owns_conversation(conversation_id)
  and role = 'user'
  and author_id = (select auth.uid())
)
with check (
  public.owns_conversation(conversation_id)
  and role = 'user'
  and author_id = (select auth.uid())
);

create policy messages_delete_owned_conversation
on public.messages for delete to authenticated
using (public.owns_conversation(conversation_id));

create policy message_attachments_select_visible
on public.message_attachments for select to authenticated
using (
  owner_id = (select auth.uid())
  or (
    access_level = 'conversation'
    and exists (
      select 1
      from public.messages as message
      where message.id = message_id
        and public.can_view_conversation(message.conversation_id)
    )
  )
  or public.is_admin()
);

create policy message_attachments_insert_owned
on public.message_attachments for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and exists (
    select 1
    from public.messages as message
    where message.id = message_id
      and public.owns_conversation(message.conversation_id)
  )
);

create policy message_attachments_update_owned
on public.message_attachments for update to authenticated
using (owner_id = (select auth.uid()) or public.is_admin())
with check (owner_id = (select auth.uid()) or public.is_admin());

create policy message_attachments_delete_owned
on public.message_attachments for delete to authenticated
using (owner_id = (select auth.uid()) or public.is_admin());

create policy message_feedback_select_visible
on public.message_feedback for select
using (
  exists (
    select 1
    from public.messages as message
    where message.id = message_id
      and public.can_view_conversation(message.conversation_id)
  )
);

create policy message_feedback_insert_self
on public.message_feedback for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.messages as message
    where message.id = message_id
      and public.can_view_conversation(message.conversation_id)
  )
);

create policy message_feedback_update_self
on public.message_feedback for update to authenticated
using (user_id = (select auth.uid()) or public.is_admin())
with check (user_id = (select auth.uid()) or public.is_admin());

create policy message_feedback_delete_self
on public.message_feedback for delete to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

create policy stream_sessions_select_self
on public.stream_sessions for select to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

create policy message_audio_select_self
on public.message_audio for select to authenticated
using (owner_id = (select auth.uid()) or public.is_admin());

create policy artifacts_select_visible
on public.artifacts for select
using (
  owner_id = (select auth.uid())
  or (
    status = 'published'
    and public.can_view_conversation(conversation_id)
  )
  or public.is_admin()
);

create policy artifacts_insert_owned
on public.artifacts for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and public.owns_conversation(conversation_id)
);

create policy artifacts_update_owned
on public.artifacts for update to authenticated
using (owner_id = (select auth.uid()) or public.is_admin())
with check (owner_id = (select auth.uid()) or public.is_admin());

create policy artifacts_delete_owned
on public.artifacts for delete to authenticated
using (owner_id = (select auth.uid()) or public.is_admin());

create policy artifact_versions_select_visible
on public.artifact_versions for select
using (
  public.owns_artifact(artifact_id)
  or exists (
    select 1
    from public.artifacts as artifact
    where artifact.id = artifact_id
      and artifact.current_version_id = public.artifact_versions.id
      and artifact.status = 'published'
      and public.can_view_conversation(artifact.conversation_id)
  )
);

create policy artifact_versions_insert_owned
on public.artifact_versions for insert to authenticated
with check (
  public.owns_artifact(artifact_id)
  and (created_by = (select auth.uid()) or public.is_admin())
);

create policy artifact_versions_update_owned
on public.artifact_versions for update to authenticated
using (public.owns_artifact(artifact_id))
with check (public.owns_artifact(artifact_id));

create policy artifact_versions_delete_owned
on public.artifact_versions for delete to authenticated
using (public.owns_artifact(artifact_id));

create policy artifact_suggestions_select_owned
on public.artifact_suggestions for select to authenticated
using (
  owner_id = (select auth.uid())
  or exists (
    select 1
    from public.artifact_versions as version
    where version.id = artifact_version_id
      and public.owns_artifact(version.artifact_id)
  )
  or public.is_admin()
);

create policy artifact_suggestions_insert_owned
on public.artifact_suggestions for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and exists (
    select 1
    from public.artifact_versions as version
    where version.id = artifact_version_id
      and public.owns_artifact(version.artifact_id)
  )
);

create policy artifact_suggestions_update_owned
on public.artifact_suggestions for update to authenticated
using (owner_id = (select auth.uid()) or public.is_admin())
with check (owner_id = (select auth.uid()) or public.is_admin());

create policy artifact_suggestions_delete_owned
on public.artifact_suggestions for delete to authenticated
using (owner_id = (select auth.uid()) or public.is_admin());

create policy mission_runs_select_self
on public.mission_runs for select to authenticated
using (owner_id = (select auth.uid()) or public.is_admin());

create policy mission_runs_insert_self
on public.mission_runs for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and public.can_view_mission(mission_id)
  and public.can_view_character(character_id)
  and public.owns_conversation(conversation_id)
  and status = 'not-started'
  and score is null
  and stars is null
  and awarded_mission_reward_id is null
  and awarded_evaluation_id is null
  and started_at is null
  and completed_at is null
  and turn_count = 0
);

create policy mission_step_progress_select_self
on public.mission_step_progress for select to authenticated
using (
  exists (
    select 1 from public.mission_runs as run
    where run.id = mission_run_id
      and (run.owner_id = (select auth.uid()) or public.is_admin())
  )
);

create policy mission_step_progress_insert_self
on public.mission_step_progress for insert to authenticated
with check (
  exists (
    select 1 from public.mission_runs as run
    where run.id = mission_run_id
      and run.owner_id = (select auth.uid())
  )
);

create policy mission_step_progress_update_self
on public.mission_step_progress for update to authenticated
using (
  exists (
    select 1 from public.mission_runs as run
    where run.id = mission_run_id
      and (run.owner_id = (select auth.uid()) or public.is_admin())
  )
)
with check (
  exists (
    select 1 from public.mission_runs as run
    where run.id = mission_run_id
      and (run.owner_id = (select auth.uid()) or public.is_admin())
  )
);

create policy mission_evaluations_select_self
on public.mission_evaluations for select to authenticated
using (
  exists (
    select 1 from public.mission_runs as run
    where run.id = mission_run_id
      and (run.owner_id = (select auth.uid()) or public.is_admin())
  )
);

create policy reward_unlocks_select_self
on public.reward_unlocks for select to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

create policy vocabulary_progress_select_self
on public.vocabulary_progress for select to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

create policy daily_learning_stats_select_self
on public.daily_learning_stats for select to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

create policy ai_usage_events_select_self
on public.ai_usage_events for select to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

create or replace function public.can_read_storage_object(
  _bucket_id text,
  _object_name text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
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

create or replace function public.complete_mission_run(
  _mission_run_id uuid,
  _mission_evaluation_id uuid,
  _mission_reward_id uuid,
  _expected_owner_id uuid
)
returns table (
  mission_run_id uuid,
  mission_evaluation_id uuid,
  reward_unlock_id uuid,
  score numeric,
  stars smallint,
  experience_points_awarded integer,
  already_completed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
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
      errcode = '40001',
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

comment on function public.complete_mission_run(uuid, uuid, uuid, uuid) is
  'Server-only atomic transition from evaluated mission run to XP, daily stats, and one private image reward unlock.';

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'profile-avatars',
    'profile-avatars',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  ),
  (
    'character-public',
    'character-public',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  ),
  (
    'character-private',
    'character-private',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'audio/mpeg', 'audio/mp4']
  ),
  (
    'mission-public',
    'mission-public',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  ),
  (
    'mission-private',
    'mission-private',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  ),
  (
    'chat-attachments',
    'chat-attachments',
    false,
    26214400,
    array[
      'image/jpeg', 'image/png', 'image/webp', 'image/avif',
      'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/webm',
      'application/pdf', 'text/plain'
    ]
  )
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy storage_public_assets_select
on storage.objects for select
using (bucket_id in ('profile-avatars', 'character-public', 'mission-public'));

create policy storage_private_assets_select
on storage.objects for select to authenticated
using (public.can_read_storage_object(bucket_id, name));

create policy storage_user_folder_insert
on storage.objects for insert to authenticated
with check (
  bucket_id in (
    'profile-avatars', 'character-public', 'character-private',
    'mission-public', 'mission-private', 'chat-attachments'
  )
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy storage_user_folder_update
on storage.objects for update to authenticated
using (
  bucket_id in (
    'profile-avatars', 'character-public', 'character-private',
    'mission-public', 'mission-private', 'chat-attachments'
  )
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id in (
    'profile-avatars', 'character-public', 'character-private',
    'mission-public', 'mission-private', 'chat-attachments'
  )
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy storage_user_folder_delete
on storage.objects for delete to authenticated
using (
  bucket_id in (
    'profile-avatars', 'character-public', 'character-private',
    'mission-public', 'mission-private', 'chat-attachments'
  )
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

grant usage on schema public to anon, authenticated, service_role;

grant select on table
  public.profiles,
  public.characters,
  public.character_versions,
  public.character_assets,
  public.character_tags,
  public.missions,
  public.mission_versions,
  public.mission_steps,
  public.mission_characters,
  public.mission_assets,
  public.mission_rewards,
  public.conversations,
  public.messages,
  public.message_feedback,
  public.artifacts,
  public.artifact_versions
to anon;

grant select on all tables in schema public to authenticated;

grant insert, update, delete on table
  public.characters,
  public.character_versions,
  public.character_assets,
  public.character_tags,
  public.character_favorites,
  public.missions,
  public.mission_versions,
  public.mission_steps,
  public.mission_characters,
  public.mission_assets,
  public.mission_favorites,
  public.conversations,
  public.messages,
  public.message_attachments,
  public.message_feedback,
  public.artifacts,
  public.artifact_versions,
  public.artifact_suggestions,
  public.mission_runs,
  public.mission_step_progress
to authenticated;

revoke update, delete on table public.mission_runs from authenticated;

revoke all privileges on table
  public.character_version_instructions,
  public.mission_version_instructions
from anon, authenticated;

grant insert (
  id,
  username,
  display_name,
  avatar_path,
  bio,
  native_language,
  target_language,
  cefr_level,
  daily_goal_minutes,
  onboarding_completed,
  is_public,
  preferences
) on public.profiles to authenticated;

grant update (
  username,
  display_name,
  avatar_path,
  bio,
  native_language,
  target_language,
  cefr_level,
  daily_goal_minutes,
  onboarding_completed,
  is_public,
  preferences
) on public.profiles to authenticated;

grant usage, select on all sequences in schema public to authenticated, service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_conversation_after_message() from public, anon, authenticated;
revoke execute on function public.validate_character_current_version() from public, anon, authenticated;
revoke execute on function public.validate_mission_current_version() from public, anon, authenticated;
revoke execute on function public.validate_mission_reward_definition() from public, anon, authenticated;
revoke execute on function public.validate_artifact_current_version() from public, anon, authenticated;
revoke execute on function public.validate_mission_run_context() from public, anon, authenticated;
revoke execute on function public.complete_mission_run(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;

revoke execute on function public.is_admin() from public;
revoke execute on function public.owns_character(uuid) from public;
revoke execute on function public.can_view_character(uuid) from public;
revoke execute on function public.owns_mission(uuid) from public;
revoke execute on function public.can_view_mission(uuid) from public;
revoke execute on function public.owns_conversation(uuid) from public;
revoke execute on function public.can_view_conversation(uuid) from public;
revoke execute on function public.owns_artifact(uuid) from public;
revoke execute on function public.can_read_storage_object(text, text) from public;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.owns_character(uuid) to anon, authenticated;
grant execute on function public.can_view_character(uuid) to anon, authenticated;
grant execute on function public.owns_mission(uuid) to anon, authenticated;
grant execute on function public.can_view_mission(uuid) to anon, authenticated;
grant execute on function public.owns_conversation(uuid) to authenticated;
grant execute on function public.can_view_conversation(uuid) to anon, authenticated;
grant execute on function public.owns_artifact(uuid) to anon, authenticated;
grant execute on function public.can_read_storage_object(text, text) to authenticated;
grant execute on function public.complete_mission_run(uuid, uuid, uuid, uuid) to service_role;

alter table public.messages replica identity full;
alter table public.generation_jobs replica identity full;
alter table public.mission_runs replica identity full;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'messages'
    ) then
      alter publication supabase_realtime add table public.messages;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'generation_jobs'
    ) then
      alter publication supabase_realtime add table public.generation_jobs;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'mission_runs'
    ) then
      alter publication supabase_realtime add table public.mission_runs;
    end if;
  end if;
end;
$$;

commit;

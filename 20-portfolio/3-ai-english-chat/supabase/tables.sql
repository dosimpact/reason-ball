-- Final CREATE TABLE definitions, extracted from schema.sql on 2026-09-10.
-- Reading reference only. PK/FK/indexes, functions, triggers, policies and grants
-- are in schema.sql; auth/storage integration is in migrations/.
-- Do not use this file alone to initialize or migrate a database.

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

CREATE TABLE public.artifact_revision_requests (
    request_id uuid NOT NULL,
    artifact_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    expected_version_id uuid,
    payload jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

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

CREATE TABLE public.character_favorites (
    user_id uuid NOT NULL,
    character_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

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

CREATE TABLE public.character_tags (
    character_id uuid NOT NULL,
    tag extensions.citext NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT character_tags_tag_check CHECK (((char_length((tag)::text) >= 1) AND (char_length((tag)::text) <= 40)))
);

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

CREATE TABLE public.conversation_clear_requests (
    conversation_id uuid NOT NULL,
    request_id uuid NOT NULL,
    deleted_count integer NOT NULL
);

CREATE TABLE public.conversation_purge_requests (
    owner_id uuid NOT NULL,
    request_id uuid NOT NULL,
    deleted_count integer NOT NULL
);

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    character_id uuid NOT NULL,
    character_version_id uuid NOT NULL,
    mission_id uuid,
    mission_version_id uuid,
    title text DEFAULT 'New conversation'::text NOT NULL,
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

CREATE TABLE public.learner_preferences (
    user_id uuid NOT NULL,
    settings jsonb NOT NULL,
    revision integer NOT NULL,
    CONSTRAINT learner_preferences_revision_check CHECK ((revision >= 1)),
    CONSTRAINT learner_preferences_settings_check CHECK (public.valid_learning_preferences(settings))
);

CREATE TABLE public.learning_activity_clocks (
    user_id uuid NOT NULL,
    last_seen_at timestamp with time zone,
    active boolean DEFAULT false NOT NULL
);

CREATE TABLE public.learning_activity_receipts (
    user_id uuid NOT NULL,
    request_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    active boolean NOT NULL,
    accepted_seconds integer NOT NULL,
    recorded_at timestamp with time zone NOT NULL,
    CONSTRAINT learning_activity_receipts_accepted_seconds_check CHECK (((accepted_seconds >= 0) AND (accepted_seconds <= 45)))
);

CREATE TABLE public.learning_notebook_entries (
    user_id uuid NOT NULL,
    id uuid NOT NULL,
    draft jsonb NOT NULL,
    identity_key text NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT learning_notebook_entries_draft_check CHECK ((jsonb_typeof(draft) = 'object'::text))
);

CREATE TABLE public.learning_notebook_requests (
    user_id uuid NOT NULL,
    request_id uuid NOT NULL,
    draft jsonb NOT NULL,
    entry_id uuid NOT NULL
);

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

CREATE TABLE public.message_branch_requests (
    request_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    source_message_id uuid NOT NULL,
    expected_tail_id uuid NOT NULL,
    parts jsonb NOT NULL
);

CREATE TABLE public.message_feedback (
    user_id uuid NOT NULL,
    message_id uuid NOT NULL,
    rating smallint NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT message_feedback_rating_check CHECK ((rating = ANY (ARRAY['-1'::integer, 1])))
);

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

CREATE TABLE public.mission_characters (
    mission_id uuid NOT NULL,
    character_id uuid NOT NULL,
    is_recommended boolean DEFAULT false NOT NULL,
    role_override text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

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

CREATE TABLE public.mission_favorite_requests (
    user_id uuid NOT NULL,
    request_id uuid NOT NULL,
    mission_id uuid NOT NULL,
    saved boolean NOT NULL
);

CREATE TABLE public.mission_favorites (
    user_id uuid NOT NULL,
    mission_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

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

CREATE TABLE public.response_regeneration_requests (
    request_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    assistant_message_id uuid NOT NULL,
    user_message_id uuid NOT NULL
);

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

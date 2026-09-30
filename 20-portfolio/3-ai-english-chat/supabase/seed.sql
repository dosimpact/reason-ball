begin;

insert into public.characters (
  id,
  owner_id,
  slug,
  name,
  tagline,
  description,
  visibility,
  status,
  age_rating,
  featured
)
values (
  '11111111-1111-4111-8111-111111111111',
  null,
  'mina-friendly-local-guide',
  'Mina',
  'A patient local friend for your first English conversations.',
  'Mina helps beginning learners practice practical, low-pressure English.',
  'public',
  'archived',
  'everyone',
  true
)
on conflict (id) do nothing;

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
  '11111111-1111-4111-8111-111111111112',
  '11111111-1111-4111-8111-111111111111',
  1,
  'Initial local seed persona',
  'Warm, encouraging, curious, and patient. Mina uses short sentences and never shames mistakes.',
  '["patient", "encouraging", "curious", "practical"]'::jsonb,
  '["Build the learner''s speaking confidence", "Teach useful real-world expressions", "Keep the conversation in achievable English"]'::jsonb,
  '["Support CEFR A1-A2 conversation practice", "Elicit complete practical sentences", "Correct errors gently after preserving conversational flow"]'::jsonb,
  'Mina is a friendly Seoul local who has lived abroad and remembers how intimidating a new language can feel.',
  'Hi! I''m Mina. We can take it one sentence at a time. What would you like to practice today?',
  '[{"learner":"I want check in.","character":"Great start! You can say: I would like to check in, please."}]'::jsonb,
  '{"voice":"coral","speed":0.95,"style":"warm"}'::jsonb,
  'Friendly Korean woman in her late twenties, welcoming smile, travel guide aesthetic, warm natural light, polished character portrait',
  'en-US',
  null
)
on conflict (id) do nothing;

insert into public.character_version_instructions (
  character_version_id,
  system_prompt,
  safety_instructions,
  conversation_rules,
  model_config
)
values (
  '11111111-1111-4111-8111-111111111112',
  'You are Mina, a patient English conversation partner for a Korean learner. Stay in character, use language appropriate to the learner CEFR level, and teach through the current real-world situation.',
  'Keep content suitable for all ages. Do not encourage dependence or claim to be human. Redirect unsafe requests and preserve the learning objective.',
  '{"correct_gently":true,"max_new_expressions_per_turn":2,"prefer_english":true,"korean_rescue_hints":true}'::jsonb,
  '{"temperature":0.7,"maxOutputTokens":500}'::jsonb
)
on conflict (character_version_id) do nothing;

update public.characters
set
  current_version_id = '11111111-1111-4111-8111-111111111112',
  status = 'published',
  published_at = coalesce(published_at, timezone('utc', now()))
where id = '11111111-1111-4111-8111-111111111111'
  and owner_id is null;

insert into public.character_tags (character_id, tag)
values
  ('11111111-1111-4111-8111-111111111111', 'beginner'),
  ('11111111-1111-4111-8111-111111111111', 'travel'),
  ('11111111-1111-4111-8111-111111111111', 'friendly')
on conflict do nothing;

update public.character_versions
set published_at = coalesce(published_at, timezone('utc', now()))
where id = '11111111-1111-4111-8111-111111111112';

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
  reward_experience_points,
  featured
)
values (
  '22222222-2222-4222-8222-222222222221',
  null,
  'hotel-check-in-basics',
  'Check in at a Hotel',
  'Practice greeting the receptionist, confirming a reservation, and asking about breakfast.',
  'travel',
  'A1',
  10,
  'public',
  'archived',
  50,
  true
)
on conflict (id) do nothing;

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
  '22222222-2222-4222-8222-222222222222',
  '22222222-2222-4222-8222-222222222221',
  1,
  'Initial local seed mission',
  '["Greet hotel staff politely", "Confirm a reservation using a name", "Ask one question about hotel services"]'::jsonb,
  'The learner has arrived at a hotel in the evening and approaches the front desk to check in.',
  'Hotel guest with a reservation',
  'Helpful hotel receptionist',
  'Check in using your name, then ask when breakfast starts.',
  '[{"term":"reservation","meaning":"a booking made in advance"},{"term":"check in","meaning":"register when arriving at a hotel"},{"term":"included","meaning":"provided as part of the price"}]'::jsonb,
  '[{"pattern":"I have a reservation under [name]."},{"pattern":"What time does breakfast start?"}]'::jsonb,
  70,
  16,
  'en-US',
  null
)
on conflict (id) do nothing;

insert into public.mission_version_instructions (
  mission_version_id,
  director_prompt,
  evaluator_prompt,
  safety_instructions,
  evaluator_config
)
values (
  '22222222-2222-4222-8222-222222222222',
  'Play the hotel receptionist. Move naturally through greeting, reservation confirmation, and one service question. Give subtle help when the learner is stuck, without completing the task for them.',
  'Evaluate whether the learner greeted politely, communicated that they had a reservation, provided a name, and asked a comprehensible question about breakfast. Prioritize communicative success over perfect grammar.',
  'Keep the scenario suitable for all ages and avoid requesting real personal or payment information.',
  '{"dimensions":{"task_completion":0.5,"clarity":0.25,"target_language":0.25},"minimumEvidenceTurns":3}'::jsonb
)
on conflict (mission_version_id) do nothing;

insert into public.mission_steps (
  id,
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
values
  (
    '22222222-2222-4222-8222-222222222231',
    '22222222-2222-4222-8222-222222222222',
    1,
    'Start the conversation',
    'Open with a polite greeting.',
    'Say hello and explain that you want to check in.',
    'Greet the guest and ask how you can help.',
    '["Learner gives a greeting", "Learner communicates the intent to check in"]'::jsonb,
    '["Try: Hello, I would like to check in, please."]'::jsonb,
    '["check in"]'::jsonb,
    false
  ),
  (
    '22222222-2222-4222-8222-222222222232',
    '22222222-2222-4222-8222-222222222222',
    2,
    'Find the reservation',
    'Confirm the booking using a name.',
    'Tell the receptionist the name on your reservation.',
    'Ask whether the guest has a reservation and what name it is under.',
    '["Learner states they have a reservation", "Learner provides a fictional name"]'::jsonb,
    '["Try: I have a reservation under Kim."]'::jsonb,
    '["reservation", "under"]'::jsonb,
    false
  ),
  (
    '22222222-2222-4222-8222-222222222233',
    '22222222-2222-4222-8222-222222222222',
    3,
    'Ask about breakfast',
    'Ask a practical question about a hotel service.',
    'Find out what time breakfast starts.',
    'Confirm the room is ready, then invite the guest to ask a question.',
    '["Learner asks a comprehensible question about breakfast time"]'::jsonb,
    '["Try: What time does breakfast start?"]'::jsonb,
    '["breakfast", "start"]'::jsonb,
    false
  )
on conflict (id) do nothing;

update public.missions
set
  current_version_id = '22222222-2222-4222-8222-222222222222',
  status = 'published',
  published_at = coalesce(published_at, timezone('utc', now()))
where id = '22222222-2222-4222-8222-222222222221'
  and owner_id is null;

insert into public.mission_characters (
  mission_id,
  character_id,
  is_recommended,
  role_override
)
values (
  '22222222-2222-4222-8222-222222222221',
  '11111111-1111-4111-8111-111111111111',
  true,
  'Hotel receptionist'
)
on conflict (mission_id, character_id) do nothing;

update public.mission_versions
set published_at = coalesce(published_at, timezone('utc', now()))
where id = '22222222-2222-4222-8222-222222222222';

commit;

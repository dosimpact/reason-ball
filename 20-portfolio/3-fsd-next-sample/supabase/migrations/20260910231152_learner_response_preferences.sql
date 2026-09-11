-- Preserve existing nine-field settings and revisions; optional additions are validated when present.
begin;

create or replace function public.valid_learning_preferences(value jsonb)
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

commit;

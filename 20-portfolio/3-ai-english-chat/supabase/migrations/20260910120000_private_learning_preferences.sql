begin;

create function public.valid_learning_preferences(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare fields text[] := array['displayName','learnerLevel','dailyGoal','learningGoal','interests','correctionMode','voice','rate','autoplay'];
begin
  if value is null or jsonb_typeof(value) <> 'object' or not value ?& fields or value - fields <> '{}'::jsonb then return false; end if;
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

create table public.learner_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null check (public.valid_learning_preferences(settings)),
  revision integer not null check (revision >= 1)
);
alter table public.learner_preferences enable row level security;
revoke all on public.learner_preferences from public, anon, authenticated;
grant select on public.learner_preferences to authenticated;
grant all on public.learner_preferences to service_role;
create policy learner_preferences_read_self on public.learner_preferences for select to authenticated
  using (user_id = (select auth.uid()));

create function public.save_learning_preferences(_expected_revision integer, _settings jsonb)
returns table(revision integer, settings jsonb)
language plpgsql security definer set search_path = '' as $$
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
  if saved.user_id is null then raise exception using errcode='40001', message='learning preferences changed; reload before editing'; end if;
  return query select saved.revision, saved.settings;
end;
$$;
revoke execute on function public.valid_learning_preferences(jsonb) from public, anon, authenticated;
revoke execute on function public.save_learning_preferences(integer,jsonb) from public, anon;
grant execute on function public.save_learning_preferences(integer,jsonb) to authenticated;

commit;

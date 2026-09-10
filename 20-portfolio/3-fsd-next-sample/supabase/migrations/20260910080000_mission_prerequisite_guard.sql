-- Enforce the pinned version's prerequisites for both API and direct DB writes.
create function public.guard_mission_prerequisites()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

revoke all on function public.guard_mission_prerequisites() from public, anon, authenticated;

create trigger conversations_mission_prerequisites
before insert or update of owner_id, mission_id, mission_version_id on public.conversations
for each row execute function public.guard_mission_prerequisites();

create trigger mission_runs_prerequisites
before insert or update of owner_id, mission_id, mission_version_id on public.mission_runs
for each row execute function public.guard_mission_prerequisites();

begin;

-- Preserve the original atomic implementation while placing strict identity
-- and idempotency validation in front of it. In particular, SQL `<> null`
-- does not evaluate to true, and a completed run must reject a retry carrying
-- a different evaluation id even when its reward id happens to match.
alter function public.complete_mission_run(uuid, uuid, uuid, uuid)
  rename to complete_mission_run_unchecked;

revoke execute on function public.complete_mission_run_unchecked(uuid, uuid, uuid, uuid)
from public, anon, authenticated, service_role;

create function public.complete_mission_run(
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

comment on function public.complete_mission_run(uuid, uuid, uuid, uuid) is
  'Server-only guarded atomic transition from evaluated mission run to XP, daily stats, and one private image reward unlock.';

revoke execute on function public.complete_mission_run(uuid, uuid, uuid, uuid)
from public, anon, authenticated;

grant execute on function public.complete_mission_run(uuid, uuid, uuid, uuid)
to service_role;

commit;

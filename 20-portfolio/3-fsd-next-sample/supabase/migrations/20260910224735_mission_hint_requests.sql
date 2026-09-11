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

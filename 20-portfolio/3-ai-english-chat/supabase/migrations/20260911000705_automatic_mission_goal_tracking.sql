-- Automatic learning progress is separate from final evaluation and rewards.
create table public.mission_goal_tracking_receipts (
 mission_run_id uuid not null references public.mission_runs(id) on delete cascade,
 context_hash text not null,
 result jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(mission_run_id,context_hash)
);
alter table public.mission_goal_tracking_receipts enable row level security;
revoke all on public.mission_goal_tracking_receipts from public,anon,authenticated;
grant select,insert,delete on public.mission_goal_tracking_receipts to service_role;

create function public.mission_goal_tracking_context(_conversation_id uuid,_owner_id uuid,_assistant_id uuid,_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.mission_runs%rowtype; g public.chat_generations%rowtype; snapshot jsonb;
begin
 perform 1 from public.conversations where id=_conversation_id and owner_id=_owner_id and status='active';
 if not found then raise exception using errcode='42501',message='goal tracking owner mismatch'; end if;
 select * into g from public.chat_generations where conversation_id=_conversation_id and assistant_message_id=_assistant_id;
 if not found or g.request_id is distinct from _request_id or g.status<>'running' or g.lease_expires_at<=clock_timestamp() then
  raise exception using errcode='PT409',message='goal tracking generation changed';
 end if;
 select * into r from public.mission_runs where conversation_id=_conversation_id and owner_id=_owner_id;
 if not found or r.status in ('passed','abandoned','evaluating') then return null; end if;
 select jsonb_build_object('runId',r.id,'versionId',r.mission_version_id,'userMessageId',g.user_message_id,
  'steps',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'order',s.step_order,'title',s.title,'objective',s.objective,'learnerGoal',s.learner_goal,'criteria',s.success_criteria,'optional',s.is_optional) order by s.step_order),'[]'::jsonb) from public.mission_steps s where s.mission_version_id=r.mission_version_id),
  'messages',(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'role',m.role,'text',(select coalesce(string_agg(p->>'text','' order by ord),'') from jsonb_array_elements(m.parts) with ordinality as parts(p,ord) where p->>'type'='text')) order by m.sequence_number),'[]'::jsonb) from public.messages m where m.conversation_id=_conversation_id and m.status='complete' and (m.role='assistant' or (m.role='user' and m.author_id=_owner_id)) and m.sequence_number <= (select sequence_number from public.messages where id=g.user_message_id))) into snapshot;
 return jsonb_build_object('context',snapshot,'cached',(select result from public.mission_goal_tracking_receipts where mission_run_id=r.id and context_hash=md5(snapshot::text)));
end; $$;
revoke all on function public.mission_goal_tracking_context(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.mission_goal_tracking_context(uuid,uuid,uuid,uuid) to service_role;

create function public.persist_mission_goal_tracking(_conversation_id uuid,_owner_id uuid,_assistant_id uuid,_request_id uuid,_context jsonb,_result jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_context jsonb; r public.mission_runs%rowtype; item jsonb; ids uuid[]; next_order integer; stored jsonb;
begin
 -- Same lock order as message generation/edit and final evaluation: conversation, run.
 perform 1 from public.conversations where id=_conversation_id and owner_id=_owner_id and status='active' for update;
 if not found then raise exception using errcode='42501',message='goal tracking owner mismatch'; end if;
 select * into r from public.mission_runs where conversation_id=_conversation_id and owner_id=_owner_id for update;
 current_context:=public.mission_goal_tracking_context(_conversation_id,_owner_id,_assistant_id,_request_id);
 if current_context is null then return null; end if;
 if current_context->'context' is distinct from _context then raise exception using errcode='PT409',message='goal tracking transcript changed'; end if;
 if current_context->'cached'<>'null'::jsonb then _result:=current_context->'cached'; end if;
 if jsonb_typeof(_result)<>'array' or jsonb_array_length(_result)<>jsonb_array_length(_context->'steps') or
  (select count(distinct x->>'stepId') from jsonb_array_elements(_result) x)<>jsonb_array_length(_result) then
  raise exception using errcode='22023',message='invalid goal tracking result';
 end if;
 for item in select value from jsonb_array_elements(_result) loop
  perform 1 from public.mission_steps where id=(item->>'stepId')::uuid and mission_version_id=r.mission_version_id;
  if not found or jsonb_typeof(item->'completed') is distinct from 'boolean' or jsonb_typeof(item->'evidenceMessageIds') is distinct from 'array' then
   raise exception using errcode='22023',message='invalid goal tracking step';
  end if;
  select coalesce(array_agg(value::uuid),'{}'::uuid[]) into ids from jsonb_array_elements_text(item->'evidenceMessageIds');
  if ((item->>'completed')::boolean and cardinality(ids)=0) or exists(select 1 from unnest(ids) i where not exists(select 1 from jsonb_array_elements(_context->'messages') m where m->>'id'=i::text and m->>'role'='user' and length(btrim(m->>'text'))>0)) then
   raise exception using errcode='22023',message='goal tracking requires owned learner evidence';
  end if;
  insert into public.mission_step_progress(mission_run_id,mission_step_id,status,evidence_message_ids,feedback,completed_at)
   values(r.id,(item->>'stepId')::uuid,case when (item->>'completed')::boolean then 'completed' else 'locked' end,ids,item->>'feedback',case when (item->>'completed')::boolean then clock_timestamp() else null end)
  on conflict(mission_run_id,mission_step_id) do update set status=excluded.status,evidence_message_ids=excluded.evidence_message_ids,feedback=excluded.feedback,completed_at=case when excluded.status='completed' then coalesce(public.mission_step_progress.completed_at,excluded.completed_at) else null end,updated_at=clock_timestamp();
 end loop;
 select min(s.step_order) into next_order from public.mission_steps s join public.mission_step_progress p on p.mission_step_id=s.id and p.mission_run_id=r.id where p.status<>'completed' and not s.is_optional;
 if next_order is not null then update public.mission_step_progress p set status='active' from public.mission_steps s where p.mission_run_id=r.id and p.mission_step_id=s.id and s.step_order=next_order; end if;
 update public.mission_runs set current_step_order=coalesce(next_order,(select max(step_order) from public.mission_steps where mission_version_id=r.mission_version_id),1),turn_count=(select count(*) from jsonb_array_elements(_context->'messages') m where m->>'role'='user') where id=r.id;
 insert into public.mission_goal_tracking_receipts(mission_run_id,context_hash,result) values(r.id,md5(_context::text),_result) on conflict(mission_run_id,context_hash) do nothing;
 select result into stored from public.mission_goal_tracking_receipts where mission_run_id=r.id and context_hash=md5(_context::text);
 return stored;
end; $$;
revoke all on function public.persist_mission_goal_tracking(uuid,uuid,uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.persist_mission_goal_tracking(uuid,uuid,uuid,uuid,jsonb,jsonb) to service_role;

-- Learner clients read progress but cannot manufacture completed objectives.
revoke insert,update,delete on public.mission_step_progress from anon,authenticated;

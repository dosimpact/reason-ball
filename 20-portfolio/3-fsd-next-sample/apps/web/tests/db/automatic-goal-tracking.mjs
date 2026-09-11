import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyAutomaticGoalTracking(db, migration) {
 await db.exec('begin');
 try {
  await db.exec(migration);
  const owner=randomUUID(),other=randomUUID(),chat=randomUUID(),run=randomUUID(),request=randomUUID();
  const version='22222222-2222-4222-8222-222222222222';
  await db.query('insert into auth.users(id) values($1),($2)',[owner,other]);
  const mission=(await db.query('select mission_id from public.mission_versions where id=$1',[version])).rows[0].mission_id;
  await db.query(`insert into public.conversations(id,owner_id,mission_id,mission_version_id,character_id,character_version_id,model_id) values($1,$2,$3,$4,'11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111112','test')`,[chat,owner,mission,version]);
  await db.query(`insert into public.mission_runs(id,owner_id,mission_id,mission_version_id,character_id,character_version_id,conversation_id,status) values($1,$2,$3,$4,'11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111112',$5,'in-progress')`,[run,owner,mission,version,chat]);
  const claimed=(await db.query(`select * from public.begin_chat_generation($1,$2,$3,'[{"type":"text","text":"I would like tea. How much is it?"}]',$4,'test')`,[chat,owner,randomUUID(),request])).rows[0];
  const key=[chat,owner,claimed.assistant_message_id,request];
  const load=async(args=key)=>(await db.query('select public.mission_goal_tracking_context($1,$2,$3,$4) value',args)).rows[0].value;
  const original=await load();
  assert.equal(original.cached,null);
  const goals=original.context.steps.map((step,i)=>({stepId:step.id,completed:i===original.context.steps.length-1,evidenceMessageIds:i===original.context.steps.length-1?[claimed.user_message_id]:[],feedback:'실제 발화 근거'}));
  const persist=async(context=original.context,result=goals,args=key)=>(await db.query('select public.persist_mission_goal_tracking($1,$2,$3,$4,$5::jsonb,$6::jsonb) value',[...args,JSON.stringify(context),JSON.stringify(result)])).rows[0].value;
  async function rejects(action,code) { await db.exec('savepoint reject_tracking'); await assert.rejects(action,e=>e.code===code); await db.exec('rollback to savepoint reject_tracking'); }
  await rejects(()=>load([chat,other,claimed.assistant_message_id,request]),'42501');
  await rejects(()=>persist(original.context,goals,[chat,owner,claimed.assistant_message_id,randomUUID()]),'PT409');
  const forged=structuredClone(goals); forged[0]={...forged[0],completed:true,evidenceMessageIds:[claimed.assistant_message_id]};
  await rejects(()=>persist(original.context,forged),'22023');
  await rejects(()=>persist(original.context,goals.slice(1)),'22023');
  assert.deepEqual(await persist(),goals);
  assert.deepEqual((await load()).cached,goals);
  const progress=async()=>(await db.query('select mission_step_id,status,evidence_message_ids,completed_at from public.mission_step_progress where mission_run_id=$1 order by mission_step_id',[run])).rows;
  const first=await progress();
  assert.equal(first.filter(s=>s.status==='completed').length,1);
  assert.equal((await db.query('select current_step_order,turn_count,status,score from public.mission_runs where id=$1',[run])).rows[0].turn_count,1);
  assert.equal((await db.query('select count(*)::int n from public.mission_evaluations where mission_run_id=$1',[run])).rows[0].n,0);
  assert.deepEqual(await persist(original.context,[]),goals); // Cached result wins, timestamps stable.
  assert.deepEqual(await progress(),first);
  await db.query(`update public.messages set parts='[{"type":"text","text":"Hello."}]' where id=$1`,[claimed.user_message_id]);
  await rejects(()=>persist(),'PT409');
  const changed=await load(); assert.equal(changed.cached,null);
  await persist(changed.context,goals.map(s=>({...s,completed:false,evidenceMessageIds:[]})));
  assert.equal((await progress()).filter(s=>s.status==='completed').length,0);
  await db.query(`update public.messages set parts='[{"type":"text","text":"I would like tea. How much is it?"}]' where id=$1`,[claimed.user_message_id]);
  assert.deepEqual((await load()).cached,goals);
  await persist(); // A → B → A uses receipt, but reapplies A progress.
  assert.equal((await progress()).filter(s=>s.status==='completed').length,1);
  for(const role of ['anon','authenticated']) {
   for(const privilege of ['INSERT','UPDATE','DELETE']) assert.equal((await db.query('select has_table_privilege($1,$2,$3) allowed',[role,'public.mission_step_progress',privilege])).rows[0].allowed,false);
   assert.equal((await db.query("select has_function_privilege($1,'public.persist_mission_goal_tracking(uuid,uuid,uuid,uuid,jsonb,jsonb)','execute') allowed",[role])).rows[0].allowed,false);
   assert.equal((await db.query("select has_table_privilege($1,'public.mission_goal_tracking_receipts','select') allowed",[role])).rows[0].allowed,false);
  }
  await db.query("update public.mission_runs set status='abandoned' where id=$1",[run]);
  assert.equal(await load(),null); assert.equal(await persist(),null);
  await db.query("update public.chat_generations set lease_expires_at=clock_timestamp()-interval '1 second' where assistant_message_id=$1",[claimed.assistant_message_id]);
  await rejects(()=>load(),'PT409');
 } finally { await db.exec('rollback'); }
}

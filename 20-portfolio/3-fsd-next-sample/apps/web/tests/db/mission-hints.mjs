import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyMissionHints(db, migration) {
  await db.exec('begin');
  try {
    const owner=randomUUID(), other=randomUUID();
    await db.query('insert into auth.users(id) values($1),($2)',[owner,other]);
    const version='22222222-2222-4222-8222-222222222222';
    const mission=(await db.query('select mission_id from public.mission_versions where id=$1',[version])).rows[0].mission_id;
    const step=(await db.query('select id from public.mission_steps where mission_version_id=$1 order by step_order limit 1',[version])).rows[0].id;
    const makeRun=async(forgeMarker=false)=> {
      const chat=(await db.query(`insert into public.conversations(owner_id,mission_id,mission_version_id,character_id,character_version_id,model_id)
        values($1,$2,$3,'11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111112','test') returning id`,[owner,mission,version])).rows[0].id;
      const run=(await db.query(`insert into public.mission_runs(owner_id,mission_id,mission_version_id,character_id,character_version_id,conversation_id${forgeMarker ? ",hint_tracking_started_at" : ""})
        values($1,$2,$3,'11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111112',$4${forgeMarker ? ",null" : ""}) returning id`,[owner,mission,version,chat])).rows[0].id;
      return {chat,run};
    };
    const legacy=await makeRun();
    await db.exec('set constraints all immediate');
    await db.exec(migration);
    const current=await makeRun();
    async function rejects(action,code) {
      await db.exec('savepoint rejected_hint');
      await assert.rejects(action,error=>error.code===code);
      await db.exec('rollback to savepoint rejected_hint');
    }
    const evaluate=async(run)=>(await db.query(`insert into public.mission_evaluations(mission_run_id,evaluator_model_id,feedback)
      values($1,'test','{"assistance":{"status":"forged"},"strengths":["retained"]}') returning id,feedback`,[run])).rows[0];
    assert.equal((await evaluate(legacy.run)).feedback.assistance.status,'unknown');
    const independent=await evaluate(current.run);
    assert.equal(independent.feedback.assistance.status,'tracked');
    assert.equal(independent.feedback.assistance.requestCount,0);
    const request=randomUUID();
    const input=[owner,request,current.run,step,1,JSON.stringify({text:'Purpose',explanation:'의도'}),null,null];
    const persist=async(args=input)=>(await db.query('select public.persist_mission_hint($1,$2,$3,$4,$5,$6::jsonb,$7,$8) as hint',args)).rows[0].hint;
    const saved=await persist();
    assert.equal(saved.id,request);
    const replay=[...input];replay[5]=JSON.stringify({text:'different',explanation:'다른 결과'});
    assert.deepEqual(await persist(replay),saved);
    for(const [index,value,code] of [[0,other,'42501'],[3,randomUUID(),'22023'],[4,4,'22023'],[4,2,'PT409']]) {
      const changed=[...input];changed[index]=value;await rejects(()=>persist(changed),code);
    }
    const message=(await db.query(`insert into public.messages(conversation_id,author_id,role,plain_text,parts) values($1,$2,'user','Hello','[{"type":"text","text":"Hello"}]') returning id,sequence_number`,[current.chat,owner])).rows[0];
    const next=[...input]; next[1]=randomUUID();next[4]=3;
    await rejects(()=>persist(next),'PT409');
    next[6]=message.id;next[7]=message.sequence_number;await persist(next);
    assert.deepEqual(await persist(),saved); // Replay survives newer conversation context.
    const legacyHint=[...input];legacyHint[1]=randomUUID();legacyHint[2]=legacy.run;await persist(legacyHint);
    const legacyHelped=await evaluate(legacy.run);
    assert.equal(legacyHelped.feedback.assistance.status,'unknown');
    assert.equal(legacyHelped.feedback.assistance.requestCount,1);
    const helped=await evaluate(current.run);
    assert.equal(helped.feedback.assistance.requestCount,2);
    assert.equal(helped.feedback.assistance.maxDepth,3);
    assert.deepEqual(helped.feedback.assistance.steps,[{stepId:step,maxDepth:3,requestCount:2}]);
    assert.deepEqual(helped.feedback.strengths,['retained']);
    assert.deepEqual((await db.query('select feedback from public.mission_evaluations where id=$1',[independent.id])).rows[0].feedback,independent.feedback);
    await db.query(`update public.mission_evaluations set feedback='{"assistance":{},"strengths":["updated"]}' where id=$1`,[helped.id]);
    assert.deepEqual((await db.query('select feedback from public.mission_evaluations where id=$1',[helped.id])).rows[0].feedback.assistance,helped.feedback.assistance);
    await rejects(()=>db.query('update public.mission_runs set hint_tracking_started_at=null where id=$1',[current.run]),'42501');
    for(const role of ['anon','authenticated']) {
      for(const privilege of ['INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES']) {
        assert.equal((await db.query('select has_table_privilege($1,$2,$3) allowed',[role,'public.mission_hint_requests',privilege])).rows[0].allowed,false);
      }
      assert.equal((await db.query("select has_function_privilege($1,'public.persist_mission_hint(uuid,uuid,uuid,uuid,integer,jsonb,uuid,bigint)','EXECUTE') allowed",[role])).rows[0].allowed,false);
    }
    await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:owner})]);
    await db.exec('set local role authenticated');
    assert.equal((await db.query('select count(*)::int n from public.mission_hint_requests')).rows[0].n,3);
    const forgedRun=await makeRun(true);
    assert.ok((await db.query('select hint_tracking_started_at from public.mission_runs where id=$1',[forgedRun.run])).rows[0].hint_tracking_started_at);
    await rejects(()=>db.query('update public.mission_runs set hint_tracking_started_at=null where id=$1',[forgedRun.run]),'42501');
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:other})]);
    await db.exec('set local role authenticated');
    assert.equal((await db.query('select count(*)::int n from public.mission_hint_requests')).rows[0].n,0);
    await db.exec('reset role');
    await db.query("update public.mission_runs set status='abandoned' where id=$1",[current.run]);
    await rejects(()=>persist(),'PT409');
    await db.query("update public.mission_runs set status='in-progress' where id=$1",[current.run]);
    await db.query("update public.conversations set status='archived' where id=$1",[current.chat]);
    await rejects(()=>persist(),'42501');
    console.log('Mission hints PASS: owner RLS, server grants, pinned steps, replay/conflict, context freshness, tracked/legacy assistance and immutable snapshots');
  } finally {await db.exec('rollback');}
}

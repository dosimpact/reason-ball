import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyMissionStart(db, { ownerId, reporterId, expectDatabaseError }) {
  const character = randomUUID();
  const characterVersion = randomUUID();
  await db.query("insert into public.characters(id,owner_id,slug,name) values($1,$2,'atomic-start-persona','Atomic persona')", [character, ownerId]);
  await db.query(`insert into public.character_versions(id,character_id,version_number,personality_summary,persona_goals,learning_goals,greeting)
    values($1,$2,1,'Helpful','["Help"]','["Speak"]','Hello')`, [characterVersion, character]);
  await db.query("update public.character_versions set published_at=now() where id=$1", [characterVersion]);
  await db.query("update public.characters set current_version_id=$1,status='published',visibility='public' where id=$2", [characterVersion, character]);

  async function makeMission({ steps = true, prerequisites = [], assigned = true } = {}) {
    const id = randomUUID();
    const version = randomUUID();
    await db.query("insert into public.missions(id,owner_id,slug,title,scenario_category) values($1,$2,$3,'Atomic lesson','travel')", [id, ownerId, `atomic-${id}`]);
    await db.query(`insert into public.mission_versions(id,mission_id,version_number,learning_goals,scenario_context,learner_role,character_role,opening_instruction)
      values($1,$2,1,'["Ask for help"]','Hotel','Guest','Receptionist','Welcome')`, [version, id]);
    await db.query("insert into public.mission_version_instructions(mission_version_id,director_prompt,evaluator_prompt,evaluator_config) values($1,'Director','Evaluator',$2)", [version, JSON.stringify({ prerequisites })]);
    if (steps) {
      await db.query(`insert into public.mission_steps(mission_version_id,step_order,title,objective,learner_goal,character_instruction)
        values($1,2,'Greeting','Greet','Greet','Respond'),($1,4,'Question','Ask','Ask','Help')`, [version]);
    }
    if (assigned) await db.query('insert into public.mission_characters(mission_id,character_id) values($1,$2)', [id, character]);
    await db.query('update public.mission_versions set published_at=now() where id=$1', [version]);
    await db.query("update public.missions set current_version_id=$1,status='published',visibility='public' where id=$2", [version, id]);
    return { id, version };
  }
  const mission = await makeMission();
  const start = async (target = mission, chat = null, owner = ownerId, version = target.version) =>
    (await db.query('select public.start_mission_run($1,$2,$3,$4,$5,$6,$7) as id',
      [owner, target.id, version, character, characterVersion, chat, 'test-model'])).rows[0].id;
  const getRun = async (id) => (await db.query('select * from public.mission_runs where id=$1', [id])).rows[0];
  const counts = async (target = mission) => (await db.query(`select
    (select count(*)::int from public.conversations where mission_id=$1) chats,
    (select count(*)::int from public.mission_runs where mission_id=$1) runs,
    (select count(*)::int from public.mission_step_progress progress join public.mission_runs run on run.id=progress.mission_run_id where run.mission_id=$1) steps`, [target.id])).rows[0];
  const newChat = async () => (await db.query(`insert into public.conversations(owner_id,mission_id,mission_version_id,character_id,character_version_id,model_id)
    values($1,$2,$3,$4,$5,'test-model') returning id`, [ownerId, mission.id, mission.version, character, characterVersion])).rows[0].id;

  // Fail during the final write, after the RPC has inserted a chat and a run.
  await db.exec(`create function public.test_fail_mission_start() returns trigger language plpgsql as $$
    begin raise exception 'Injected progress write failure' using errcode='P9991'; end $$;
    create trigger test_fail_mission_start before insert on public.mission_step_progress
    for each row execute function public.test_fail_mission_start();`);
  try {
    await expectDatabaseError(() => start(), 'P9991');
    assert.deepEqual(await counts(), { chats: 0, runs: 0, steps: 0 });
  } finally { await db.exec('drop trigger test_fail_mission_start on public.mission_step_progress'); }

  const firstId = await start();
  const first = await getRun(firstId);
  assert.equal(first.attempt_number, 1);
  assert.equal(first.current_step_order, 2);
  assert.deepEqual(await counts(), { chats: 1, runs: 1, steps: 2 });
  const progress = (await db.query(`select definition.step_order, progress.status, progress.started_at is not null as started
    from public.mission_step_progress progress join public.mission_steps definition on definition.id=progress.mission_step_id
    where mission_run_id=$1 order by definition.step_order`, [firstId])).rows;
  assert.deepEqual(progress, [{ step_order: 2, status: 'active', started: true }, { step_order: 4, status: 'locked', started: false }]);
  assert.equal(await start(), firstId);
  assert.equal(await start(mission, first.conversation_id), firstId);

  // Caller-created conversations survive a failed start, but partial run data does not.
  const secondChat = await newChat();
  await db.exec(`create trigger test_fail_mission_start before insert on public.mission_step_progress
    for each row execute function public.test_fail_mission_start()`);
  try {
    await expectDatabaseError(() => start(mission, secondChat), 'P9991');
    assert.deepEqual(await counts(), { chats: 2, runs: 1, steps: 2 });
  } finally {
    await db.exec('drop trigger test_fail_mission_start on public.mission_step_progress; drop function public.test_fail_mission_start()');
  }
  const secondId = await start(mission, secondChat);
  assert.notEqual(secondId, firstId);
  assert.equal((await getRun(secondId)).attempt_number, 2);
  assert.equal(await start(mission, secondChat), secondId);
  assert.deepEqual(await counts(), { chats: 2, runs: 2, steps: 4 });

  await expectDatabaseError(() => start(mission, first.conversation_id, reporterId), 'P2002');
  await expectDatabaseError(() => start(mission, randomUUID()), 'P2002');
  const thirdChat = await newChat();
  await db.query("update public.conversations set status='archived' where id=$1", [thirdChat]);
  await expectDatabaseError(() => start(mission, thirdChat), 'P2002');
  await expectDatabaseError(() => start(mission, null, ownerId, randomUUID()), 'PT409');

  await db.query("update public.mission_runs set status='failed',score=67,completed_at=now() where id=$1", [firstId]);
  const beforeReplay = await getRun(firstId);
  await db.query("update public.missions set status='archived' where id=$1", [mission.id]);
  await db.query("update public.characters set status='archived' where id=$1", [character]);
  assert.equal(await start(mission, first.conversation_id), firstId);
  assert.deepEqual(await getRun(firstId), beforeReplay);
  await expectDatabaseError(() => start(), 'P2005');
  await db.query("update public.characters set status='published' where id=$1", [character]);
  await db.query("update public.missions set status='published',owner_id=null,visibility='private' where id=$1", [mission.id]);
  await expectDatabaseError(() => start(), 'P2005');
  await db.query("update public.missions set owner_id=$1,visibility='public' where id=$2", [ownerId, mission.id]);

  const emptyMission = await makeMission({ steps: false });
  await expectDatabaseError(() => start(emptyMission), 'P2004');
  assert.deepEqual(await counts(emptyMission), { chats: 0, runs: 0, steps: 0 });
  const gatedMission = await makeMission({ prerequisites: ['unfinished-mission'] });
  await expectDatabaseError(() => start(gatedMission), 'P2001');
  assert.deepEqual(await counts(gatedMission), { chats: 0, runs: 0, steps: 0 });
  const unassignedMission = await makeMission({ assigned: false });
  await expectDatabaseError(() => start(unassignedMission), 'P2003');
  assert.deepEqual(await counts(unassignedMission), { chats: 0, runs: 0, steps: 0 });
  await expectDatabaseError(() => start(unassignedMission, secondChat), 'P2002');
  await db.query("update public.characters set owner_id=null,visibility='private' where id=$1", [character]);
  await expectDatabaseError(() => start(), 'P2005');
  await db.query("update public.characters set owner_id=$1,visibility='public' where id=$2", [ownerId, character]);
  await db.query("update public.missions set status='draft' where id=$1", [emptyMission.id]);
  await expectDatabaseError(() => start(emptyMission), 'P2005');
  await expectDatabaseError(() => db.query('select public.start_mission_run(null,$1,$2,$3,$4)', [mission.id, mission.version, character, characterVersion]), '22023');

  const signature = 'public.start_mission_run(uuid,uuid,uuid,uuid,uuid,uuid,text)';
  const grants = (await db.query(`select has_function_privilege('anon',$1,'execute') anon,
    has_function_privilege('authenticated',$1,'execute') browser,
    has_function_privilege('service_role',$1,'execute') server`, [signature])).rows[0];
  assert.deepEqual(grants, { anon: false, browser: false, server: true });
  await db.exec('set role authenticated');
  try { await expectDatabaseError(() => start(), '42501'); }
  finally { await db.exec('reset role'); }
  await db.exec('set role service_role');
  try { assert.equal(await start(mission, secondChat), secondId); }
  finally { await db.exec('reset role'); }
  console.log('Mission start contracts PASS: atomic rollback, replay, attempt allocation, snapshots, prerequisites and server-only grants (single PGlite connection)');
}

import assert from 'node:assert/strict';

export async function verifyMissionPrerequisites(db, { ownerId, reporterId, conversationId, missionId, missionRunId, expectDatabaseError }) {
  const target = '99000000-0000-4000-8000-000000000001';
  const version = '99000000-0000-4000-8000-000000000002';
  await db.query("insert into public.missions(id,owner_id,slug,title,scenario_category) values ($1,$2,'prerequisite-contract','Prerequisite contract','travel')", [target, ownerId]);
  await db.query(`insert into public.mission_versions(id,mission_id,version_number,learning_goals,scenario_context,learner_role,character_role,opening_instruction)
    values ($1,$2,1,'["Introduce yourself"]','Hotel','Guest','Receptionist','Hello')`, [version, target]);
  await db.query("insert into public.mission_version_instructions(mission_version_id,director_prompt,evaluator_prompt) values ($1,'Private director','Private evaluator')", [version]);
  await db.query('update public.missions set current_version_id=$1 where id=$2', [version, target]);
  const setConditions = (prerequisites) => db.query('update public.mission_version_instructions set evaluator_config=$1 where mission_version_id=$2', [JSON.stringify({ prerequisites }), version]);
  const createChat = (owner = ownerId) => db.query(`insert into public.conversations(owner_id,character_id,character_version_id,model_id,mission_id,mission_version_id)
    select $1,character_id,character_version_id,model_id,$2,$3 from public.conversations where id=$4 returning id`, [owner, target, version, conversationId]);
  const openChat = (await createChat()).rows[0].id;
  const createRun = (owner = ownerId, chat = openChat) => db.query(`insert into public.mission_runs(owner_id,mission_id,mission_version_id,character_id,character_version_id,conversation_id)
    select $1,$2,$3,character_id,character_version_id,$4 from public.conversations where id=$4 returning id`, [owner, target, version, chat]);
  const oldRun = (await createRun()).rows[0].id;

  // Learning-goal text alone is never a prerequisite. Explicit unresolved IDs are.
  await setConditions(['missing-mission']);
  await expectDatabaseError(() => createChat(), 'P2001');
  await expectDatabaseError(() => createRun(), 'P2001');
  await db.query("update public.conversations set title='Resume existing lesson' where id=$1", [openChat]);
  await db.query('update public.mission_runs set turn_count=1 where id=$1', [oldRun]);
  assert.equal((await db.query('select turn_count from public.mission_runs where id=$1', [oldRun])).rows[0].turn_count, 1);

  // This prerequisite was completed by the existing complete_mission_run RPC test.
  const completed = (await db.query('select status,completed_at,awarded_evaluation_id from public.mission_runs where id=$1', [missionRunId])).rows[0];
  assert.equal(completed.status, 'passed');
  assert.ok(completed.completed_at && completed.awarded_evaluation_id);
  await setConditions([missionId]);
  const allowedChat = (await createChat()).rows[0].id;
  await createRun(ownerId, allowedChat);
  await db.query("update public.mission_runs set status='evaluating' where id=$1", [missionRunId]);
  try { await expectDatabaseError(() => createChat(), 'P2001'); }
  finally { await db.query("update public.mission_runs set status='passed' where id=$1", [missionRunId]); }
  await setConditions([missionId, 'missing-mission']);
  await expectDatabaseError(() => createChat(), 'P2001');
  await setConditions([missionId]);
  await expectDatabaseError(() => createChat(reporterId), 'P2001');
  await expectDatabaseError(() => createRun(reporterId), 'P2001');
  await expectDatabaseError(() => db.query('update public.conversations set owner_id=$1 where id=$2', [reporterId, openChat]), 'P2001');
  await expectDatabaseError(() => db.query('update public.mission_runs set owner_id=$1 where id=$2', [reporterId, oldRun]), 'P2001');
  const slug = (await db.query('select slug from public.missions where id=$1', [missionId])).rows[0].slug;
  await setConditions([slug]);
  await createChat();

  for (const invalid of [null, 'not-an-array', [42], [' ']]) {
    await setConditions(invalid);
    await expectDatabaseError(() => createChat(), '22023');
  }
  await setConditions(['missing-mission']);
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: ownerId, role: 'authenticated' })]);
  await db.exec('set role authenticated');
  try {
    await expectDatabaseError(() => createChat(), 'P2001');
    await expectDatabaseError(() => createRun(), 'P2001');
    await expectDatabaseError(() => db.query('select * from public.mission_version_instructions'), '42501');
  } finally { await db.exec('reset role'); }
  assert.equal((await db.query("select has_function_privilege('authenticated','public.guard_mission_prerequisites()','execute') allowed")).rows[0].allowed, false);
  await setConditions([]);
  await createChat();
  await db.query('delete from public.mission_version_instructions where mission_version_id=$1', [version]);
  await expectDatabaseError(() => createChat(), '55000');
}

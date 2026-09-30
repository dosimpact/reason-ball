import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyMissionProvisioning(db, { ownerId, expectDatabaseError }) {
  const learner = randomUUID();
  const manager = randomUUID();
  const beginner = randomUUID();
  const lowerFallback = randomUUID();
  for (const id of [learner, manager, beginner, lowerFallback]) await db.query('insert into auth.users(id) values($1)', [id]);
  const claims = (id) => db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: id, app_metadata: {} })]);
  const provision = async (id) => {
    await claims(id);
    await db.exec('set role authenticated');
    try { return (await db.query('select public.provision_my_missions() as result')).rows[0].result; }
    finally { await db.exec('reset role'); }
  };
  const preferences = { displayName: 'Learner', learnerLevel: 'B1', dailyGoal: 10, learningGoal: '', interests: ['여행'], correctionMode: 'gentle', voice: 'marin', rate: 1, autoplay: false };
  const saveProfile = (id, settings) => db.query('insert into public.learner_preferences(user_id,settings,revision) values($1,$2,1) on conflict(user_id) do update set settings=excluded.settings', [id, JSON.stringify(settings)]);
  assert.deepEqual(await provision(learner), { mode: 'needs-profile', assignedCount: 0 });
  await saveProfile(learner, preferences);
  assert.deepEqual(await provision(learner), { mode: 'catalog-empty', assignedCount: 0 });
  await db.exec('update public.mission_catalog_state set is_ready=true');
  assert.deepEqual(await provision(learner), { mode: 'catalog-empty', assignedCount: 0 });

  const character = randomUUID();
  const characterVersion = randomUUID();
  await db.query("insert into public.characters(id,owner_id,slug,name) values($1,$2,$3,'Catalog partner')", [character, ownerId, `catalog-${character}`]);
  await db.query(`insert into public.character_versions(id,character_id,version_number,personality_summary,persona_goals,learning_goals,greeting)
    values($1,$2,1,'Helpful','["Help"]','["Speak"]','Hello')`, [characterVersion, character]);
  await db.query('update public.character_versions set published_at=now() where id=$1', [characterVersion]);
  await db.query("update public.characters set current_version_id=$1,status='published',visibility='public' where id=$2", [characterVersion, character]);
  async function makeMission(level, category, prerequisites = []) {
    const id = randomUUID();
    const version = randomUUID();
    await db.query("insert into public.missions(id,owner_id,slug,title,scenario_category,difficulty,category_id) values($1,$2,$3,'Catalog lesson','travel',$4,$5)", [id, ownerId, `catalog-${id}`, level, category]);
    await db.query(`insert into public.mission_versions(id,mission_id,version_number,learning_goals,scenario_context,learner_role,character_role,opening_instruction)
      values($1,$2,1,'["Ask"]','Trip','Guest','Partner','Hello')`, [version, id]);
    await db.query("insert into public.mission_version_instructions(mission_version_id,director_prompt,evaluator_prompt,evaluator_config) values($1,'Director','Evaluator',$2)", [version, JSON.stringify({ prerequisites })]);
    await db.query("insert into public.mission_steps(mission_version_id,step_order,title,objective,learner_goal,character_instruction) values($1,1,'Ask','Ask','Ask','Help')", [version]);
    await db.query('insert into public.mission_characters(mission_id,character_id) values($1,$2)', [id, character]);
    await db.query('update public.mission_versions set published_at=now() where id=$1', [version]);
    await db.query("update public.missions set current_version_id=$1,status='published',visibility='public' where id=$2", [version, id]);
    await db.query('insert into public.mission_catalog_entries(mission_id,authoring_key) values($1,$2)', [id, `catalog-${id}`]);
    return { id, version };
  }
  const trips = [];
  for (const category of ['hotel','airport','transport','booking','sightseeing']) trips.push(await makeMission('B1', category));
  await makeMission('B1','hotel'); // Duplicate category must lose to five distinct travel subcategories.
  const other = await makeMission('B1','shopping');
  await makeMission('A2','hotel');
  const high = await makeMission('C2','hotel');
  const low = await makeMission('pre-A1','hotel');
  await db.exec('update public.mission_catalog_state set is_ready=false');
  assert.deepEqual(await provision(learner), { mode: 'catalog-empty', assignedCount: 0 });
  await db.exec('update public.mission_catalog_state set is_ready=true');
  assert.deepEqual(await provision(learner), { mode: 'assigned', assignedCount: 5 });
  const assigned = (await db.query('select m.id,m.category_id,m.difficulty from public.mission_assignments a join public.missions m on m.id=a.mission_id where a.user_id=$1 order by m.id', [learner])).rows;
  assert.equal(new Set(assigned.map((row) => row.category_id)).size, 5);
  assert.deepEqual((await db.query('select distinct profile_snapshot from public.mission_assignments where user_id=$1', [learner])).rows, [{ profile_snapshot: { learnerLevel: 'B1', interests: ['여행'] } }]);
  assert.ok(assigned.every((row) => row.difficulty === 'B1' && row.category_id !== 'shopping'));
  await saveProfile(learner, { ...preferences, learnerLevel: 'C2', interests: ['일상'] });
  assert.deepEqual(await provision(learner), { mode: 'assigned', assignedCount: 5 });
  assert.deepEqual((await db.query('select m.id,m.category_id,m.difficulty from public.mission_assignments a join public.missions m on m.id=a.mission_id where a.user_id=$1 order by m.id', [learner])).rows, assigned);
  await saveProfile(beginner, { ...preferences, learnerLevel: 'PRE_A1' });
  assert.deepEqual(await provision(beginner), { mode: 'assigned', assignedCount: 1 });
  assert.deepEqual((await db.query('select mission_id from public.mission_assignments where user_id=$1', [beginner])).rows, [{ mission_id: low.id }]);

  await saveProfile(lowerFallback, { ...preferences, learnerLevel: 'B2' });
  assert.deepEqual(await provision(lowerFallback), { mode: 'assigned', assignedCount: 5 });
  assert.ok((await db.query('select m.difficulty from public.mission_assignments a join public.missions m on m.id=a.mission_id where a.user_id=$1', [lowerFallback])).rows.every((row) => row.difficulty === 'B1'));

  await claims(learner);
  await db.exec('set role authenticated');
  try {
    assert.equal((await db.query('select count(*)::int n from public.missions')).rows[0].n, 5);
    assert.equal((await db.query('select count(*)::int n from public.mission_assignments')).rows[0].n, 5);
    assert.equal((await db.query('select count(*)::int n from public.mission_versions')).rows[0].n, 5);
    for (const statement of [
      `insert into public.mission_assignments(user_id,mission_id) values('${learner}','${other.id}')`,
      `insert into public.mission_catalog_managers(user_id) values('${learner}')`,
      'update public.mission_catalog_state set is_ready=true',
      'select * from public.mission_catalog_entries',
      'select * from public.mission_version_instructions',
    ]) await expectDatabaseError(() => db.exec(statement), '42501');
  } finally { await db.exec('reset role'); }
  await claims(null);
  await db.exec('set role anon');
  try {
    assert.equal((await db.query('select count(*)::int n from public.missions')).rows[0].n, 0);
    await expectDatabaseError(() => db.query('select public.provision_my_missions()'), '42501');
  } finally { await db.exec('reset role'); }

  const privateDraft = randomUUID();
  await db.query("insert into public.missions(id,owner_id,slug,title,scenario_category) values($1,$2,$3,'Private draft','daily')", [privateDraft,ownerId,`private-${privateDraft}`]);
  await db.query('insert into public.mission_catalog_managers(user_id) values($1)', [manager]);
  assert.deepEqual(await provision(manager), { mode: 'manager', assignedCount: 0 });
  await claims(manager);
  await db.exec('set role authenticated');
  try {
    assert.equal((await db.query('select public.is_admin() as admin')).rows[0].admin, false);
    assert.equal((await db.query('select count(*)::int n from public.missions where id=$1', [privateDraft])).rows[0].n, 0);
    assert.ok((await db.query('select count(*)::int n from public.missions')).rows[0].n > 5);
    assert.equal((await db.query('select count(*)::int n from public.mission_catalog_managers')).rows[0].n, 1);
    await expectDatabaseError(() => db.query('select * from public.mission_version_instructions'), '42501');
  } finally { await db.exec('reset role'); }

  const start = (user, target) => db.query('select public.start_mission_run($1,$2,$3,$4,$5,null,$6) as id', [user,target.id,target.version,character,characterVersion,'test-model']);
  const chat = (user, target) => db.query("insert into public.conversations(owner_id,mission_id,mission_version_id,character_id,character_version_id,model_id) values($1,$2,$3,$4,$5,'test-model') returning id", [user,target.id,target.version,character,characterVersion]);
  // The JWT still identifies a manager, but explicit RPC owner is an ordinary learner.
  await expectDatabaseError(() => start(learner, high), '42501');
  await expectDatabaseError(() => chat(learner, high), '42501');
  const selected = trips.find((target) => assigned.some((row) => row.id === target.id));
  const run = (await start(learner, selected)).rows[0].id;
  const savedChat = (await db.query('select conversation_id from public.mission_runs where id=$1', [run])).rows[0].conversation_id;
  await expectDatabaseError(() => db.query('insert into public.mission_runs(owner_id,mission_id,mission_version_id,character_id,character_version_id,conversation_id) values($1,$2,$3,$4,$5,$6)', [learner,high.id,high.version,character,characterVersion,savedChat]), '42501');
  await expectDatabaseError(() => db.query('update public.mission_runs set owner_id=$1 where id=$2', [beginner,run]), '42501');
  await expectDatabaseError(() => db.query('update public.conversations set owner_id=$1 where id=$2', [beginner,savedChat]), '42501');
  await expectDatabaseError(() => db.query('update public.mission_runs set mission_id=$1,mission_version_id=$2 where id=$3', [high.id,high.version,run]), '42501');
  await expectDatabaseError(() => db.query('update public.conversations set mission_id=$1,mission_version_id=$2 where id=$3', [high.id,high.version,savedChat]), '42501');
  await db.query('delete from public.mission_assignments where user_id=$1 and mission_id=$2', [learner,selected.id]);
  await db.query('update public.mission_runs set turn_count=1 where id=$1', [run]);
  await db.query("update public.conversations set title='Resume preserved' where id=$1", [savedChat]);
  assert.equal((await db.query('select turn_count from public.mission_runs where id=$1', [run])).rows[0].turn_count, 1);
  assert.deepEqual(await provision(learner), { mode: 'assigned', assignedCount: 4 });
  await start(manager, high);
  const required = await makeMission('B1','hotel',['missing-prerequisite']);
  await db.query('insert into public.mission_assignments(user_id,mission_id) values($1,$2)', [learner,required.id]);
  await expectDatabaseError(() => start(learner, required), 'P2001');
  console.log('Mission provisioning PASS: profile/readiness gate, exact-level interests and diversity, one-time five, PRE_A1, self RLS, manager isolation, explicit-owner start guard, resume and prerequisites');
}

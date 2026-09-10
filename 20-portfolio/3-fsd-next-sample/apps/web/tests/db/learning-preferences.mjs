import assert from "node:assert/strict";

export async function verifyLearningPreferences(db, { ownerId, reporterId, expectDatabaseError }) {
  const settings = { displayName: "Jisu", learnerLevel: "B1", dailyGoal: 20, learningGoal: "Work conversations", interests: ["직장"], correctionMode: "summary", voice: "coral", rate: 0.75, autoplay: false };
  const claims = (id) => db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify(id ? { sub: id, role: "authenticated" } : {})]);
  const save = (revision, input = settings) => db.query("select * from public.save_learning_preferences($1,$2)", [revision, JSON.stringify(input)]);
  await claims(ownerId);
  await db.exec("set role authenticated");
  assert.deepEqual((await save(0)).rows[0], { revision: 1, settings });
  await expectDatabaseError(() => save(0), "40001");
  assert.deepEqual((await save(1, { ...settings, learnerLevel: "C1" })).rows[0], { revision: 2, settings: { ...settings, learnerLevel: "C1" } });
  for (const invalid of [{ ...settings, interests: ["직장", "직장"] }, { ...settings, voice: "unknown" }, { ...settings, learnerLevel: null }, { ...settings, autoplay: "yes" }, { ...settings, dailyGoal: 1.5 }, { ...settings, ownerId }, { ...settings, learningGoal: "x".repeat(501) }]) {
    await expectDatabaseError(() => save(2, invalid), "22023");
  }
  assert.equal((await db.query("select revision from public.learner_preferences")).rows[0].revision, 2);
  await expectDatabaseError(() => db.query("update public.learner_preferences set revision=10"), "42501");
  await db.exec("reset role");
  await claims(reporterId);
  await db.exec("set role authenticated");
  assert.equal((await db.query("select * from public.learner_preferences")).rows.length, 0);
  await expectDatabaseError(() => save(2), "40001");
  assert.equal((await save(0)).rows[0].revision, 1);
  assert.equal((await db.query("select user_id from public.learner_preferences")).rows[0].user_id, reporterId);
  await db.exec("reset role");
  await claims(null);
  await db.exec("set role anon");
  await expectDatabaseError(() => db.query("select * from public.learner_preferences"), "42501");
  await expectDatabaseError(() => save(0), "42501");
  await db.exec("reset role");
  const grants = (await db.query("select has_table_privilege('authenticated','public.learner_preferences','insert') as write, has_function_privilege('authenticated','public.save_learning_preferences(integer,jsonb)','execute') as save")).rows[0];
  assert.deepEqual(grants, { write: false, save: true });
}

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function verifyLearningPreferences(db, { ownerId, reporterId, expectDatabaseError }) {
  const settings = { displayName: "Jisu", learnerLevel: "B1", dailyGoal: 20, learningGoal: "Work conversations", interests: ["직장"], correctionMode: "summary", voice: "coral", rate: 0.75, autoplay: false };
  const claims = (id) => db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify(id ? { sub: id, role: "authenticated" } : {})]);
  const save = (revision, input = settings) => db.query("select * from public.save_learning_preferences($1,$2)", [revision, JSON.stringify(input)]);
  await claims(ownerId);
  await db.exec("set role authenticated");
  assert.deepEqual((await save(0)).rows[0], { revision: 1, settings });
  await expectDatabaseError(() => save(0), "PT409");
  assert.deepEqual((await save(1, { ...settings, learnerLevel: "C1" })).rows[0], { revision: 2, settings: { ...settings, learnerLevel: "C1" } });
  for (const invalid of [{ ...settings, interests: ["직장", "직장"] }, { ...settings, voice: "unknown" }, { ...settings, learnerLevel: null }, { ...settings, autoplay: "yes" }, { ...settings, dailyGoal: 1.5 }, { ...settings, ownerId }, { ...settings, learningGoal: "x".repeat(501) }]) {
    await expectDatabaseError(() => save(2, invalid), "22023");
  }
  for (const key of ["koreanExplanation", "responseLength"]) {
    for (const value of [null, "unknown", 1, false, [], {}]) await expectDatabaseError(() => save(2, { ...settings, [key]: value }), "22023");
  }
  assert.equal((await db.query("select revision from public.learner_preferences")).rows[0].revision, 2);
  let revision = 2;
  for (const koreanExplanation of ["none", "brief", "detailed"]) {
    for (const responseLength of ["short", "standard", "long"]) {
      const expanded = { ...settings, koreanExplanation, responseLength };
      assert.deepEqual((await save(revision++, expanded)).rows[0], { revision, settings: expanded });
    }
  }
  // Each new field is independently optional for older clients; no implicit DB backfill.
  for (const partial of [{ ...settings, koreanExplanation: "none" }, { ...settings, responseLength: "long" }, settings]) {
    assert.deepEqual((await save(revision++, partial)).rows[0], { revision, settings: partial });
  }
  await expectDatabaseError(() => db.query("update public.learner_preferences set revision=10"), "42501");
  await db.exec("reset role");
  await claims(reporterId);
  await db.exec("set role authenticated");
  assert.equal((await db.query("select * from public.learner_preferences")).rows.length, 0);
  await expectDatabaseError(() => save(2), "PT409");
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


export async function verifyLearningPreferenceUpgrade(db, migration) {
  await db.exec("begin");
  try {
    const owner = randomUUID();
    const settings = { displayName: "Existing", learnerLevel: "A1", dailyGoal: 10, learningGoal: "", interests: [], correctionMode: "gentle", voice: "marin", rate: 1, autoplay: false };
    await db.query("insert into auth.users(id) values($1)", [owner]);
    await db.query("insert into public.learner_preferences(user_id,settings,revision) values($1,$2,7)", [owner, JSON.stringify(settings)]);
    const before = (await db.query("select * from public.learner_preferences where user_id=$1", [owner])).rows[0];
    await db.exec(migration);
    assert.deepEqual((await db.query("select * from public.learner_preferences where user_id=$1", [owner])).rows[0], before);
    for (const input of [settings, { ...settings, koreanExplanation: "brief", responseLength: "short" }]) {
      assert.equal((await db.query("select public.valid_learning_preferences($1) as valid", [JSON.stringify(input)])).rows[0].valid, true);
    }
    console.log("Learning preference upgrade PASS: existing JSON and revision preserved, optional response preferences accepted");
  } finally {
    await db.exec("rollback");
  }
}

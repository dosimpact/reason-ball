import assert from "node:assert/strict";

export async function verifyLearningNotebook(db, { ownerId, reporterId, conversationId, expectDatabaseError }) {
  const key = (n) => `62000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const messageId = (await db.query("select id from public.messages where conversation_id=$1 limit 1", [conversationId])).rows[0].id;
  const draft = { kind: "expression", text: "Could I check in?", meaning: "체크인 요청", originalText: "", source: { conversationId, messageId } };
  const identity = JSON.stringify(["expression", "could i check in?", ""]);
  const save = (n, input = draft, owner = ownerId) => db.query("select * from public.save_learning_notebook($1,$2,$3,$4)", [owner, key(n), JSON.stringify(input), identity]);
  const first = (await save(1)).rows[0];
  assert.equal(first.outcome, "created");
  assert.deepEqual(first.entry.draft, draft);
  assert.deepEqual((await save(1)).rows[0], { entry: first.entry, outcome: "replayed" });
  await expectDatabaseError(() => save(1, { ...draft, meaning: "changed" }), "PT409");
  const duplicate = { ...draft, meaning: "Do not replace existing note" };
  assert.deepEqual((await save(2, duplicate)).rows[0], { entry: first.entry, outcome: "duplicate" });
  assert.deepEqual((await save(2, duplicate)).rows[0], { entry: first.entry, outcome: "replayed" });
  await expectDatabaseError(() => save(2, draft), "PT409");
  await expectDatabaseError(() => save(3, draft, reporterId), "P0002");
  await expectDatabaseError(() => save(3, { ...draft, source: { conversationId, messageId: "missing" } }), "P0002");
  assert.equal((await db.query("select count(*)::int as n from public.learning_notebook_entries where user_id=$1", [ownerId])).rows[0].n, 1);
  assert.equal((await db.query("select count(*)::int as n from public.learning_notebook_requests where user_id=$1", [ownerId])).rows[0].n, 2);

  const claims = (id) => db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: id, role: "authenticated" })]);
  await claims(ownerId);
  await db.exec("set role authenticated");
  assert.equal((await db.query("select id from public.learning_notebook_entries")).rows[0].id, first.entry.id);
  await expectDatabaseError(() => save(4), "42501");
  await expectDatabaseError(() => db.query("update public.learning_notebook_entries set draft='{}'"), "42501");
  await expectDatabaseError(() => db.query("select * from public.learning_notebook_requests"), "42501");
  await db.exec("reset role");
  await claims(reporterId);
  await db.exec("set role authenticated");
  assert.equal((await db.query("select * from public.learning_notebook_entries")).rows.length, 0);
  await db.exec("reset role; set role anon");
  await expectDatabaseError(() => db.query("select * from public.learning_notebook_entries"), "42501");
  await expectDatabaseError(() => save(4), "42501");
  await db.exec("reset role");

  await db.query("update public.conversations set status='archived' where id=$1", [conversationId]);
  await expectDatabaseError(() => save(4), "P0002");
  assert.deepEqual((await save(1)).rows[0].entry, first.entry);
  await db.query("update public.conversations set status='active' where id=$1", [conversationId]);
  await db.exec("begin");
  await db.query("update public.conversations set status='deleted', visibility='private' where id=$1", [conversationId]);
  await db.query("select public.purge_deleted_conversation($1,$2)", [conversationId, ownerId]);
  assert.deepEqual((await save(1)).rows[0].entry, first.entry);
  assert.equal((await db.query("select count(*)::int as n from public.learning_notebook_entries where user_id=$1", [ownerId])).rows[0].n, 1);
  await db.exec("rollback");
  const grants = (await db.query("select has_function_privilege('authenticated','public.save_learning_notebook(uuid,uuid,jsonb,text)','execute') as browser, has_function_privilege('service_role','public.save_learning_notebook(uuid,uuid,jsonb,text)','execute') as server")).rows[0];
  assert.deepEqual(grants, { browser: false, server: true });
}

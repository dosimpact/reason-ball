import assert from "node:assert/strict";

export async function verifyLearningActivity(db, { ownerId, reporterId, conversationId, expectDatabaseError }) {
  const claims = (id) => db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify(id ? { sub: id, role: "authenticated" } : {})]);
  const key = (number) => `58000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
  const record = (number, active = true, conversation = conversationId) => db.query("select * from public.record_learning_activity($1,$2,$3)", [conversation, key(number), active]);
  const slices = await db.query("select learning_date::text, seconds from public.learning_activity_slices('2026-12-31T23:59:50.25Z','2027-01-01T00:00:10.25Z')");
  assert.deepEqual(slices.rows, [{ learning_date: "2026-12-31", seconds: 10 }, { learning_date: "2027-01-01", seconds: 10 }]);
  for (const [from, to] of [["2026-09-10T00:00:00Z", "2026-09-10T00:00:46Z"], ["2026-09-10T00:00:01Z", "2026-09-10T00:00:00Z"]]) {
    assert.equal((await db.query("select * from public.learning_activity_slices($1,$2)", [from, to])).rows.length, 0);
  }
  await claims(ownerId);
  await db.exec("set role authenticated");
  assert.equal((await record(1)).rows[0].accepted_seconds, 0);
  await expectDatabaseError(() => db.query("update public.learning_activity_clocks set active=true"), "42501");
  await expectDatabaseError(() => db.query("select * from public.learning_activity_slices(now(),now())"), "42501");
  await db.exec("reset role");
  await db.query("update public.learning_activity_clocks set last_seen_at=clock_timestamp()-interval '15 seconds' where user_id=$1", [ownerId]);
  const before = Number((await db.query("select coalesce(sum(active_seconds),0) as seconds from public.daily_learning_stats where user_id=$1", [ownerId])).rows[0].seconds);
  await db.exec("set role authenticated");
  const response = (await record(2)).rows[0];
  assert.ok(response.accepted_seconds >= 15 && response.accepted_seconds <= 16);
  assert.deepEqual((await record(2)).rows[0], response);
  await expectDatabaseError(() => record(2, false), "22023");
  await record(3, false);
  await db.exec("reset role");
  const after = Number((await db.query("select coalesce(sum(active_seconds),0) as seconds from public.daily_learning_stats where user_id=$1", [ownerId])).rows[0].seconds);
  assert.ok(after - before >= 15 && after - before <= 17, "same-request replay must not double count");
  await db.query("update public.learning_activity_clocks set last_seen_at=clock_timestamp()-interval '20 seconds' where user_id=$1", [ownerId]);
  await db.exec("set role authenticated");
  assert.equal((await record(4)).rows[0].accepted_seconds, 0, "inactive interval is excluded");
  await db.exec("reset role");
  await db.query("update public.learning_activity_clocks set last_seen_at=clock_timestamp()-interval '46 seconds' where user_id=$1", [ownerId]);
  await db.exec("set role authenticated");
  assert.equal((await record(5)).rows[0].accepted_seconds, 0, "disconnected interval is excluded");
  await db.exec("reset role");
  await claims(reporterId);
  await db.exec("set role authenticated");
  await expectDatabaseError(() => record(6), "42501");
  await db.exec("reset role");
  await claims(null);
  await db.exec("set role anon");
  await expectDatabaseError(() => record(7), "42501");
  await db.exec("reset role");
  assert.equal((await db.query("select count(*)::int as count from public.learning_activity_receipts where user_id=$1", [ownerId])).rows[0].count, 5);
  const beforeMessages = Number((await db.query("select coalesce(sum(messages_sent),0) as count from public.daily_learning_stats where user_id=$1", [ownerId])).rows[0].count);
  const separateConversation = key(100);
  await db.query(`insert into public.conversations(id,owner_id,character_id,character_version_id,model_id)
    select $1,owner_id,character_id,character_version_id,model_id from public.conversations where id=$2`, [separateConversation, conversationId]);
  const parts = JSON.stringify([{ type: "text", text: "Learning activity" }]);
  await db.query("insert into public.messages(id,conversation_id,author_id,role,client_message_id,parts) values($1,$2,$3,'user','activity-test',$4)", [key(101), separateConversation, ownerId, parts]);
  await db.query("insert into public.messages(id,conversation_id,author_id,role,client_message_id,parts) values($1,$2,$3,'user','activity-test',$4) on conflict(conversation_id,client_message_id) do update set plain_text='Retry'", [key(101), separateConversation, ownerId, parts]);
  await db.query("insert into public.messages(id,conversation_id,role,parts) values($1,$2,'assistant',$3)", [key(102), separateConversation, parts]);
  const afterMessages = Number((await db.query("select coalesce(sum(messages_sent),0) as count from public.daily_learning_stats where user_id=$1", [ownerId])).rows[0].count);
  assert.equal(afterMessages - beforeMessages, 1);
  await db.query("update public.conversations set status='archived' where id=$1", [separateConversation]);
  await claims(ownerId);
  await db.exec("set role authenticated");
  await expectDatabaseError(() => record(8, true, separateConversation), "42501");
  await db.exec("reset role");
  await claims(null);
}

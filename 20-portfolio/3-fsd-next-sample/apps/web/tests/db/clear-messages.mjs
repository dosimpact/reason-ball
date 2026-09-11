import assert from "node:assert/strict";

export async function verifyClearMessages(db, { ownerId, reporterId, conversationId, expectDatabaseError }) {
  const chat = "95000000-0000-4000-8000-000000000001";
  const key = "95000000-0000-4000-8000-000000000002";
  const nextKey = "95000000-0000-4000-8000-000000000003";
  const artifact = "95000000-0000-4000-8000-000000000004";
  const version = "95000000-0000-4000-8000-000000000005";
  const parts = JSON.stringify([{ type: "text", text: "Private message" }]);
  await db.query(`insert into public.conversations(id,owner_id,character_id,character_version_id,model_id,title)
    select $1,owner_id,character_id,character_version_id,model_id,'Keep my title' from public.conversations where id=$2`, [chat, conversationId]);
  const clear = (request = key, owner = ownerId) => db.query('select public.clear_conversation_messages($1,$2,$3) as n', [chat, owner, request]);
  await expectDatabaseError(() => clear(key, reporterId), "42501");
  await db.query("update public.conversations set status='archived' where id=$1", [chat]);
  await expectDatabaseError(() => clear(), "55000");
  await db.query("update public.conversations set status='active' where id=$1", [chat]);

  const generation = (await db.query("select * from public.begin_chat_generation($1,$2,'clear-turn',$3,$4,'test-model')", [chat, ownerId, parts, nextKey])).rows[0];
  await expectDatabaseError(() => clear(), "55000");
  assert.equal((await db.query('select count(*)::int as n from public.messages where conversation_id=$1', [chat])).rows[0].n, 2);
  await db.query("select * from public.create_artifact_with_version($1,$2,$3,$4,$5::jsonb)", [artifact, version, ownerId, chat,
    JSON.stringify({ kind: "text", title: "Keep my artifact", contentText: "Published content", status: "published", sourceMessageId: generation.user_message_id })]);
  await db.query("update public.chat_generations set lease_expires_at=clock_timestamp()-interval '1 second' where conversation_id=$1", [chat]);
  const otherCount = (await db.query('select count(*)::int as n from public.messages where conversation_id<>$1', [chat])).rows;
  assert.equal((await clear()).rows[0].n, 2);
  assert.equal((await db.query('select count(*)::int as n from public.messages where conversation_id=$1', [chat])).rows[0].n, 0);
  assert.deepEqual((await db.query('select count(*)::int as n from public.messages where conversation_id<>$1', [chat])).rows, otherCount);
  assert.deepEqual((await db.query('select title,status,last_message_at from public.conversations where id=$1', [chat])).rows[0], { title: 'Keep my title', status: 'active', last_message_at: null });
  assert.deepEqual((await db.query('select content_text,source_message_id from public.artifact_versions where id=$1', [version])).rows[0], { content_text: 'Published content', source_message_id: null });
  await expectDatabaseError(() => db.query("update public.artifact_versions set content_text='forbidden' where id=$1", [version]), '55000');
  await expectDatabaseError(() => db.query("select public.finish_chat_generation($1,$2,$3,$4,'complete',$5,'stop')", [chat, ownerId, generation.assistant_message_id, nextKey, parts]), 'PT409');

  await db.query("insert into public.messages(conversation_id,author_id,role,status,parts) values($1,$2,'user','complete',$3)", [chat, ownerId, parts]);
  assert.equal((await clear()).rows[0].n, 2); // Old result, not a new deletion.
  assert.equal((await db.query('select count(*)::int as n from public.messages where conversation_id=$1', [chat])).rows[0].n, 1);
  assert.equal((await clear(nextKey)).rows[0].n, 1);
  assert.equal((await clear(version)).rows[0].n, 0);
  const grants = (await db.query("select has_function_privilege('authenticated','public.clear_conversation_messages(uuid,uuid,uuid)','execute') as browser, has_function_privilege('service_role','public.clear_conversation_messages(uuid,uuid,uuid)','execute') as server")).rows[0];
  assert.deepEqual(grants, { browser: false, server: true });
}

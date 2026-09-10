import assert from "node:assert/strict";

export async function verifyResponseRegeneration(db, { ownerId, reporterId, conversationId, expectDatabaseError }) {
  const chat = '97000000-0000-4000-8000-000000000001';
  const key = '97000000-0000-4000-8000-000000000002';
  const request = '97000000-0000-4000-8000-000000000003';
  const parts = JSON.stringify([{ type: 'text', text: 'Keep my question' }]);
  await db.query(`insert into public.conversations(id,owner_id,character_id,character_version_id,model_id)
    select $1,owner_id,character_id,character_version_id,model_id from public.conversations where id=$2`, [chat, conversationId]);
  const begin = async (clientKey = 'regen-user') => (await db.query("select * from public.begin_chat_generation($1,$2,$3,$4,$5,'test-model')", [chat, ownerId, clientKey, parts, request])).rows[0];
  const finish = (turn, text) => db.query("select public.finish_chat_generation($1,$2,$3,$4,'complete',$5,'stop')", [chat, ownerId, turn.assistant_message_id, request, JSON.stringify([{ type: 'text', text }])]);
  const original = await begin();
  const prepare = (id = key, answer = original.assistant_message_id, owner = ownerId) => db.query('select public.prepare_response_regeneration($1,$2,$3,$4) as id', [chat, owner, answer, id]);
  await expectDatabaseError(() => prepare(), '40001');
  await finish(original, 'Original answer');
  await expectDatabaseError(() => prepare(key, original.assistant_message_id, reporterId), '42501');
  await db.query("update public.conversations set status='archived' where id=$1", [chat]);
  await expectDatabaseError(() => prepare(), '55000');
  await db.query("update public.conversations set status='active' where id=$1", [chat]);
  const before = (await db.query('select id,parts,client_message_id from public.messages where id=$1', [original.user_message_id])).rows;
  assert.equal((await prepare()).rows[0].id, original.user_message_id);
  await prepare();
  assert.deepEqual((await db.query('select id,parts,client_message_id from public.messages where id=$1', [original.user_message_id])).rows, before);
  assert.equal((await db.query('select count(*)::int as n from public.messages where conversation_id=$1', [chat])).rows[0].n, 1);
  await expectDatabaseError(() => finish(original, 'Late original answer'), '40001');
  const next = await begin();
  assert.equal(next.user_message_id, original.user_message_id);
  assert.notEqual(next.assistant_message_id, original.assistant_message_id);
  await prepare(); // Lost response replay must not cancel a newer running reply.
  await finish(next, 'Regenerated answer');
  await prepare(); // Nor may replay delete the new completed reply.
  assert.equal((await db.query('select plain_text from public.messages where id=$1', [next.assistant_message_id])).rows[0].plain_text, 'Regenerated answer');
  await expectDatabaseError(() => prepare(key, next.assistant_message_id), '40001');
  await expectDatabaseError(() => prepare(request), '40001'); // old answer no longer tail
  const later = await begin('later-user');
  await finish(later, 'Later reply');
  await expectDatabaseError(() => prepare(request, next.assistant_message_id), '40001');
  assert.equal((await db.query('select count(*)::int as n from public.messages where conversation_id=$1', [chat])).rows[0].n, 4);
  await db.query("update public.messages set status='error' where id=$1", [later.user_message_id]);
  await expectDatabaseError(() => prepare(request, later.assistant_message_id), '55000');
  await db.query("update public.messages set status='complete',client_message_id=null where id=$1", [later.user_message_id]);
  const artifact = '97000000-0000-4000-8000-000000000004';
  const version = '97000000-0000-4000-8000-000000000005';
  await db.query('select * from public.create_artifact_with_version($1,$2,$3,$4,$5::jsonb)', [artifact, version, ownerId, chat,
    JSON.stringify({ kind: 'text', title: 'Preserved', status: 'published', contentText: 'Keep this note', sourceMessageId: later.assistant_message_id })]);
  assert.equal((await prepare(request, later.assistant_message_id)).rows[0].id, later.user_message_id);
  const legacy = (await db.query('select id,client_message_id,parts from public.messages where id=$1', [later.user_message_id])).rows[0];
  assert.equal(legacy.client_message_id, later.user_message_id);
  assert.deepEqual(legacy.parts, JSON.parse(parts));
  assert.deepEqual((await db.query('select content_text,source_message_id from public.artifact_versions where id=$1', [version])).rows[0], { content_text: 'Keep this note', source_message_id: null });
  await expectDatabaseError(() => db.query("update public.artifact_versions set content_text='forbidden' where id=$1", [version]), '55000');
  const legacyGeneration = await begin(later.user_message_id);
  assert.equal(legacyGeneration.user_message_id, later.user_message_id);
  await finish(legacyGeneration, 'Legacy row regenerated');
  assert.deepEqual((await db.query("select has_function_privilege('authenticated','public.prepare_response_regeneration(uuid,uuid,uuid,uuid)','execute') as browser, has_function_privilege('service_role','public.prepare_response_regeneration(uuid,uuid,uuid,uuid)','execute') as server")).rows[0], { browser: false, server: true });
}

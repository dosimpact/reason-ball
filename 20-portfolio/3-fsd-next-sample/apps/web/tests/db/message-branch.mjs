import assert from "node:assert/strict";

export async function verifyMessageBranch(db, { ownerId, reporterId, conversationId, expectDatabaseError }) {
  const chat = '96000000-0000-4000-8000-000000000001';
  const key = '96000000-0000-4000-8000-000000000002';
  const request = '96000000-0000-4000-8000-000000000003';
  const parts = (text) => [{ type: 'text', text }];
  await db.query(`insert into public.conversations(id,owner_id,character_id,character_version_id,model_id)
    select $1,owner_id,character_id,character_version_id,model_id from public.conversations where id=$2`, [chat, conversationId]);
  const begin = async (clientKey, text) => (await db.query("select * from public.begin_chat_generation($1,$2,$3,$4,$5,'test-model')", [chat, ownerId, clientKey, JSON.stringify(parts(text)), request])).rows[0];
  const finish = (turn) => db.query("select public.finish_chat_generation($1,$2,$3,$4,'complete',$5,'stop')", [chat, ownerId, turn.assistant_message_id, request, JSON.stringify(parts('Answer'))]);
  const first = await begin('first', 'Keep this');
  await finish(first);
  const second = await begin('second', 'Edit this');
  await finish(second);
  const third = await begin('third', 'Discard this');
  const replace = (id = key, tail = third.assistant_message_id, owner = ownerId, text = 'Edited') => db.query(
    'select public.replace_message_branch($1,$2,$3,$4,$5,$6) as id', [chat, owner, second.user_message_id, tail, id, JSON.stringify(parts(text))]);
  await expectDatabaseError(() => replace(), 'PT409'); // live generation
  await finish(third);
  await expectDatabaseError(() => replace(key, third.assistant_message_id, reporterId), '42501');
  await expectDatabaseError(() => replace(key, second.assistant_message_id), 'PT409');
  // A collision occurs after deletion; the transaction must restore that tail.
  await expectDatabaseError(() => replace(first.user_message_id), '23505');
  assert.equal((await db.query('select count(*)::int as n from public.messages where conversation_id=$1', [chat])).rows[0].n, 6);
  assert.equal((await replace()).rows[0].id, key);
  assert.equal((await replace()).rows[0].id, key);
  await expectDatabaseError(() => replace(key, third.assistant_message_id, ownerId, 'Different input'), 'PT409');
  const rows = (await db.query('select id,role,plain_text,client_message_id from public.messages where conversation_id=$1 order by sequence_number', [chat])).rows;
  assert.deepEqual(rows.map((row) => row.id), [first.user_message_id, first.assistant_message_id, key]);
  assert.equal(rows[2].plain_text, 'Edited');
  assert.equal(rows[2].client_message_id, key);
  assert.equal((await db.query('select count(*)::int as n from public.chat_generations where conversation_id=$1', [chat])).rows[0].n, 1);
  // The saved replacement is the exact user turn accepted by AI generation.
  const edited = await begin(key, 'Edited');
  assert.equal(edited.user_message_id, key);
  assert.equal(edited.replayed, false);
  await finish(edited);
  assert.equal((await begin(key, 'Edited')).replayed, true);
  await replace(); // Lost branch response must not reset the completed answer.
  assert.equal((await db.query('select count(*)::int as n from public.messages where conversation_id=$1', [chat])).rows[0].n, 4);
  assert.deepEqual((await db.query("select has_function_privilege('authenticated','public.replace_message_branch(uuid,uuid,uuid,uuid,uuid,jsonb)','execute') as browser, has_function_privilege('service_role','public.replace_message_branch(uuid,uuid,uuid,uuid,uuid,jsonb)','execute') as server")).rows[0], { browser: false, server: true });
}

import assert from 'node:assert/strict';

export async function verifyChatFiles(db, { ownerId, reporterId, conversationId, expectDatabaseError }) {
  const chat = '98000000-0000-4000-8000-000000000001';
  const foreignChat = '98000000-0000-4000-8000-000000000002';
  const digest = 'a'.repeat(64);
  await db.query(`insert into public.conversations(id,owner_id,character_id,character_version_id,model_id)
    select $1,owner_id,character_id,character_version_id,model_id from public.conversations where id=$2`, [chat, conversationId]);
  await db.query(`insert into public.conversations(id,owner_id,character_id,character_version_id,model_id)
    select $1,owner_id,character_id,character_version_id,model_id from public.conversations where id=$2`, [foreignChat, conversationId]);
  const register = (owner = ownerId, size = 8) => db.query("select * from public.register_chat_file($1,$2,$3,'image/png',$4,'key.png')", [chat, owner, digest, size]);
  await expectDatabaseError(() => register(), 'P0002');
  await db.query("insert into storage.objects(bucket_id,name) values ('chat-message-files',$1)", [`${ownerId}/${chat}/${digest}.png`]);
  await expectDatabaseError(() => register(reporterId), '42501');
  await expectDatabaseError(() => register(ownerId, 2097153), '22023');
  const file = (await register()).rows[0];
  assert.equal((await register()).rows[0].id, file.id);
  await expectDatabaseError(() => register(ownerId, 9), '40001');
  assert.equal((await db.query("select public from storage.buckets where id='chat-message-files'")).rows[0].public, false);
  const part = { type: 'file', url: `chat-file://${chat}/${file.id}`, mediaType: 'image/png', filename: 'key.png' };
  const insert = (filePart, target = chat, owner = ownerId) => db.query("insert into public.messages(conversation_id,author_id,role,parts,plain_text) values ($1,$2,'user',$3,'hello') returning id", [target, owner, JSON.stringify([{ type: 'text', text: 'hello' }, filePart])]);
  const message = (await insert(part)).rows[0];
  await expectDatabaseError(() => insert(part, chat, reporterId), '42501');
  await expectDatabaseError(() => insert(part, foreignChat), '22023');
  await expectDatabaseError(() => insert({ ...part, mediaType: 'application/pdf' }), '42501');
  await expectDatabaseError(() => insert({ ...part, url: 'data:image/png;base64,AA==' }), '22023');
  await expectDatabaseError(() => insert({ ...part, url: 'https://internal.example/file' }), '22023');
  await expectDatabaseError(() => insert({ ...part, url: `chat-file://${chat}/98000000-0000-4000-8000-000000000099` }), '42501');
  await expectDatabaseError(() => insert({ ...part, url: `chat-file://${chat}/${'-'.repeat(36)}` }), '22023');
  await expectDatabaseError(() => db.query("insert into public.messages(conversation_id,author_id,role,parts,plain_text) values ($1,$2,'user',$3,'hello')", [chat, ownerId, JSON.stringify([{ type: 'text', text: 'hello' }, ...Array(5).fill(part)])]), '22023');
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: ownerId, role: 'authenticated' })]);
  await db.exec('set role authenticated');
  await expectDatabaseError(() => register(), '42501');
  await expectDatabaseError(() => db.query('select * from public.chat_file_uploads'), '42501');
  assert.equal((await db.query("select count(*)::int n from storage.objects where bucket_id='chat-message-files'")).rows[0].n, 0);
  await expectDatabaseError(() => db.query("insert into storage.objects(bucket_id,name) values ('chat-message-files',$1)", [`${ownerId}/${chat}/attempt.png`]), '42501');
  await db.exec('reset role');
  await db.query("update public.conversations set status='archived' where id=$1", [chat]);
  await expectDatabaseError(() => register(), '55000');
  // Message deletion does not delete the durable upload used by an edited branch.
  await db.query('delete from public.messages where id=$1', [message.id]);
  assert.equal((await db.query('select count(*)::int n from public.chat_file_uploads where id=$1', [file.id])).rows[0].n, 1);
  assert.deepEqual((await db.query("select has_function_privilege('authenticated','public.register_chat_file(uuid,uuid,text,text,integer,text)','execute') browser, has_function_privilege('service_role','public.register_chat_file(uuid,uuid,text,text,integer,text)','execute') server")).rows[0], { browser: false, server: true });
}

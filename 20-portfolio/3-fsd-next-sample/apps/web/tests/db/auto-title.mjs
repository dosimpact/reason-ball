import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyAutoTitle(db, migrationSql) {
  await db.exec('begin');
  try {
    const owner = randomUUID(), other = randomUUID();
    const character = '11111111-1111-4111-8111-111111111111', version = '11111111-1111-4111-8111-111111111112';
    await db.query('insert into auth.users(id) values($1),($2)', [owner, other]);
    const legacy = randomUUID();
    await db.query(`insert into public.conversations(id,owner_id,character_id,character_version_id,title,model_id)
      values($1,$2,$3,$4,'Legacy custom title','test-model')`, [legacy, owner, character, version]);
    await db.exec(migrationSql.replace(/^begin;\s*/i, '').replace(/commit;\s*$/i, ''));
    const parts = text => [{ type: 'text', text }];
    async function create(source = 'pending', title = 'Context placeholder') {
      const id = randomUUID();
      await db.query(`insert into public.conversations(id,owner_id,character_id,character_version_id,title,model_id,title_source)
        values($1,$2,$3,$4,$5,'test-model',$6)`, [id, owner, character, version, title, source]);
      return id;
    }
    async function message(chat, content, role = 'user', status = 'complete') {
      const id = randomUUID();
      await db.query(`insert into public.messages(id,conversation_id,author_id,role,status,parts)
        values($1,$2,$3,$4,$5,$6)`, [id, chat, role === 'user' ? owner : null, role, status, JSON.stringify(content)]);
      return id;
    }
    async function title(chat, text, source) {
      assert.deepEqual((await db.query('select title,title_source from public.conversations where id=$1', [chat])).rows,
        [{ title: text, title_source: source }]);
    }
    async function asOwner(id = owner) {
      await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: id })]);
      await db.exec('set local role authenticated');
    }
    async function denied(action, code = '42501') {
      await db.exec('savepoint forbidden_title');
      await assert.rejects(action, error => error.code === code);
      await db.exec('rollback to savepoint forbidden_title');
    }
    await message(legacy, parts('Never replace a legacy title')); await title(legacy, 'Legacy custom title', 'manual');
    const normal = await create();
    await message(normal, parts('Assistant does not title this'), 'assistant');
    await title(normal, 'Context placeholder', 'pending');
    await message(normal, [{ type: 'text', text: '  Hello\n' }, { type: 'text', text: '\tworld!  ' }, { type: 'reasoning', text: 'hidden' }]);
    await title(normal, 'Hello world!', 'auto');
    await message(normal, parts('A later message')); await title(normal, 'Hello world!', 'auto');
    const original = (await db.query("select id from public.messages where conversation_id=$1 and role='user' order by sequence_number limit 1", [normal])).rows[0].id;
    const tail = (await db.query('select id from public.messages where conversation_id=$1 order by sequence_number desc limit 1', [normal])).rows[0].id;
    const branch = randomUUID();
    await db.query('select public.replace_message_branch($1,$2,$3,$4,$5,$6)', [normal, owner, original, tail, branch, JSON.stringify(parts('Edited first turn'))]);
    await title(normal, 'Hello world!', 'auto');
    await db.query('select public.replace_message_branch($1,$2,$3,$4,$5,$6)', [normal, owner, original, tail, branch, JSON.stringify(parts('Edited first turn'))]);
    await title(normal, 'Hello world!', 'auto');
    await db.query('select public.clear_conversation_messages($1,$2,$3)', [normal, owner, randomUUID()]);
    await message(normal, parts('New message after clear')); await title(normal, 'Hello world!', 'auto');

    const manual = await create();
    await asOwner();
    // Save the SAME placeholder: explicit intent must be durable even without a text change.
    await db.query('update public.conversations set title=title where id=$1', [manual]);
    await db.exec('reset role');
    await message(manual, parts('Must not replace deliberate placeholder'));
    await title(manual, 'Context placeholder', 'manual');
    await asOwner();
    await db.query("update public.conversations set title='My custom name' where id=$1", [normal]);
    await db.exec('reset role');
    await db.query('select public.clear_conversation_messages($1,$2,$3)', [normal, owner, randomUUID()]);
    await message(normal, parts('Still my custom name')); await title(normal, 'My custom name', 'manual');
    const manualSource = (await db.query('select id from public.messages where conversation_id=$1 order by sequence_number desc limit 1', [normal])).rows[0].id;
    await db.query('select public.replace_message_branch($1,$2,$3,$3,$4,$5)', [normal, owner, manualSource, randomUUID(), JSON.stringify(parts('Manual branch'))]);
    await title(normal, 'My custom name', 'manual');

    const emojiChat = await create(), long = '🙂한'.repeat(60);
    await message(emojiChat, parts(long)); await title(emojiChat, [...long].slice(0, 80).join(''), 'auto');
    const fileChat = await create(), sha = 'a'.repeat(64);
    await db.query("insert into storage.objects(bucket_id,name) values('chat-message-files',$1)", [`${owner}/${fileChat}/${sha}.png`]);
    const file = (await db.query("select * from public.register_chat_file($1,$2,$3,'image/png',1,'do-not-copy-this-name.png')", [fileChat, owner, sha])).rows[0];
    await message(fileChat, [{ type: 'file', mediaType: 'image/png', url: `chat-file://${fileChat}/${file.id}`, filename: 'do-not-copy-this-name.png' }]);
    await title(fileChat, '첨부파일 대화', 'auto');

    const aiChat = await create(), clientKey = randomUUID(), requestKey = randomUUID();
    const generation = (await db.query("select * from public.begin_chat_generation($1,$2,$3,$4,$5,'test-model')", [aiChat, owner, clientKey, JSON.stringify(parts('Saved before provider success')), requestKey])).rows[0];
    await title(aiChat, 'Saved before provider success', 'auto');
    await db.query("select public.finish_chat_generation($1,$2,$3,$4,'complete',$5,'stop')", [aiChat, owner, generation.assistant_message_id, requestKey, JSON.stringify(parts('Answer'))]);
    const replay = (await db.query("select * from public.begin_chat_generation($1,$2,$3,$4,$5,'test-model')", [aiChat, owner, clientKey, JSON.stringify(parts('Saved before provider success')), requestKey])).rows[0];
    assert.equal(replay.replayed, true); await title(aiChat, 'Saved before provider success', 'auto');
    await db.query('select public.prepare_response_regeneration($1,$2,$3,$4)', [aiChat, owner, generation.assistant_message_id, randomUUID()]);
    await title(aiChat, 'Saved before provider success', 'auto');

    const run = (await db.query("select public.start_mission_run($1,'22222222-2222-4222-8222-222222222221','22222222-2222-4222-8222-222222222222',$2,$3) as id", [owner, character, version])).rows[0].id;
    const missionChat = (await db.query('select conversation_id from public.mission_runs where id=$1', [run])).rows[0].conversation_id;
    assert.equal((await db.query('select title_source from public.conversations where id=$1', [missionChat])).rows[0].title_source, 'pending');
    await message(missionChat, parts('Mission first message')); await title(missionChat, 'Mission first message', 'auto');
    const resumed = (await db.query("select public.start_mission_run($1,'22222222-2222-4222-8222-222222222221','22222222-2222-4222-8222-222222222222',$2,$3,$4) as id", [owner, character, version, missionChat])).rows[0].id;
    assert.equal(resumed, run); await title(missionChat, 'Mission first message', 'auto');

    await asOwner();
    await denied(() => db.query("update public.conversations set title_source='pending' where id=$1", [normal]));
    await denied(() => db.query("insert into public.conversations(owner_id,character_id,character_version_id,model_id,title_source) values($1,$2,$3,'test-model','pending')", [owner, character, version]));
    const direct = (await db.query("insert into public.conversations(owner_id,character_id,character_version_id,model_id,title) values($1,$2,$3,'test-model','Direct custom') returning id,title_source", [owner, character, version])).rows[0];
    assert.equal(direct.title_source, 'manual');
    await db.query("update public.conversations set title='Direct renamed',visibility='unlisted',model_id='other-model',metadata='{}' where id=$1", [direct.id]);
    await db.exec('reset role'); await title(direct.id, 'Direct renamed', 'manual');
    await asOwner(other);
    assert.equal((await db.query("update public.conversations set title='Foreign overwrite' where id=$1 returning id", [normal])).rows.length, 0);
    await denied(() => message(normal, parts('Foreign message')));
    await db.exec('reset role'); await title(normal, 'My custom name', 'manual');
    for (const fn of ['mark_manual_conversation_title', 'name_conversation_from_first_message']) {
      const privileges = (await db.query(`select has_function_privilege('anon',$1,'execute') as anon,
        has_function_privilege('authenticated',$1,'execute') as authenticated,
        has_function_privilege('service_role',$1,'execute') as service`, [`app_private.${fn}()`])).rows[0];
      assert.deepEqual(privileges, { anon: false, authenticated: false, service: false });
    }
    console.log('Automatic title DB PASS: legacy/manual intent, first stored user, clear/edit/replay, AI/mission paths, Unicode/file and protected marker');
  } finally {
    await db.exec('rollback');
  }
}

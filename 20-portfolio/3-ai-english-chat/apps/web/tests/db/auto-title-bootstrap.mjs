import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyAutoTitleBootstrap(db) {
  await db.exec('begin');
  try {
    const owner = randomUUID();
    const character = '11111111-1111-4111-8111-111111111111', version = '11111111-1111-4111-8111-111111111112';
    await db.query('insert into auth.users(id) values($1)', [owner]);
    await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: owner })]);
    await db.exec('set local role authenticated');
    async function create(metadata) {
      const row = (await db.query(`insert into public.conversations(owner_id,character_id,character_version_id,title,model_id,metadata)
        values($1,$2,$3,'Placeholder','test-model',$4) returning id,title_source`, [owner, character, version, JSON.stringify(metadata)])).rows[0];
      return row;
    }
    async function title(id, expected) {
      assert.deepEqual((await db.query('select title,title_source from public.conversations where id=$1', [id])).rows[0], expected);
    }
    const automatic = await create({ initialTitleMode: 'auto', creationRequest: 'preserved fingerprint' });
    assert.equal(automatic.title_source, 'pending');
    assert.equal((await db.query('select metadata from public.conversations where id=$1', [automatic.id])).rows[0].metadata.creationRequest, 'preserved fingerprint');
    await db.query(`insert into public.messages(conversation_id,author_id,role,status,parts)
      values($1,$2,'user','complete','[{"type":"text","text":"First saved title"}]')`, [automatic.id, owner]);
    await title(automatic.id, { title: 'First saved title', title_source: 'auto' });
    await db.query("update public.conversations set metadata='{}' where id=$1", [automatic.id]);
    await db.query("update public.conversations set metadata='{\"initialTitleMode\":\"auto\"}' where id=$1", [automatic.id]);
    await title(automatic.id, { title: 'First saved title', title_source: 'auto' });
    for (const metadata of [{}, { initialTitleMode: 'manual' }, { initialTitleMode: true }, { initialTitleMode: 'unsupported' }]) {
      const manual = await create(metadata);
      assert.equal(manual.title_source, 'manual');
      await db.query("update public.conversations set metadata='{\"initialTitleMode\":\"auto\"}' where id=$1", [manual.id]);
      await db.query(`insert into public.messages(conversation_id,author_id,role,status,parts)
        values($1,$2,'user','complete','[{"type":"text","text":"Must not rename"}]')`, [manual.id, owner]);
      await title(manual.id, { title: 'Placeholder', title_source: 'manual' });
    }
    const renamed = await create({ initialTitleMode: 'auto' });
    await db.query('update public.conversations set title=title where id=$1', [renamed.id]);
    await db.query("update public.conversations set metadata='{\"initialTitleMode\":\"auto\"}' where id=$1", [renamed.id]);
    await db.query(`insert into public.messages(conversation_id,author_id,role,status,parts)
      values($1,$2,'user','complete','[{"type":"text","text":"Still manual"}]')`, [renamed.id, owner]);
    await title(renamed.id, { title: 'Placeholder', title_source: 'manual' });
    for (const action of [
      () => db.query("update public.conversations set title_source='pending' where id=$1", [renamed.id]),
      () => db.query(`insert into public.conversations(owner_id,character_id,character_version_id,model_id,title_source)
        values($1,$2,$3,'test-model','pending')`, [owner, character, version]),
      () => db.query(`insert into public.conversations(owner_id,character_id,character_version_id,model_id,metadata)
        values($1,$2,$3,'test-model','{"initialTitleMode":"auto"}')`, [randomUUID(), character, version]),
    ]) {
      await db.exec('savepoint denied_marker');
      await assert.rejects(action, error => error.code === '42501');
      await db.exec('rollback to savepoint denied_marker');
    }
    await db.exec('reset role');
    const trusted = (await db.query(`insert into public.conversations(owner_id,character_id,character_version_id,model_id,title_source)
      values($1,$2,$3,'test-model','pending') returning title_source`, [owner, character, version])).rows[0];
    assert.equal(trusted.title_source, 'pending');
    const grants = (await db.query(`select has_function_privilege('anon','app_private.bootstrap_conversation_title_intent()','execute') as anon,
      has_function_privilege('authenticated','app_private.bootstrap_conversation_title_intent()','execute') as authenticated,
      has_function_privilege('service_role','app_private.bootstrap_conversation_title_intent()','execute') as service`)).rows[0];
    assert.deepEqual(grants, { anon: false, authenticated: false, service: false });
    console.log('Title intent bootstrap PASS: authenticated opt-in INSERT with RLS, no metadata reset, same-title manual intent and protected marker');
  } finally { await db.exec('rollback'); }
}

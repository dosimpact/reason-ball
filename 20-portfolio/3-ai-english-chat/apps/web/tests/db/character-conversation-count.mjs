import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyCharacterConversationCount(db, migrationSql) {
  await db.exec('begin');
  try {
    const owner = randomUUID(), learner = randomUUID();
    await db.query('insert into auth.users(id) values($1),($2)', [owner, learner]);
    const chars = [randomUUID(), randomUUID()], versions = [randomUUID(), randomUUID()];
    for (let index = 0; index < 2; index++) {
      await db.query(`insert into public.characters(id,owner_id,slug,name,conversation_count)
        values($1,$2,$3,'Counter fixture',999)`, [chars[index], owner, `counter-${chars[index]}`]);
      const columns = (await db.query("select column_name from information_schema.columns where table_schema='public' and table_name='character_versions' and is_generated='NEVER' order by ordinal_position")).rows.map(row => row.column_name);
      const changes = { id: versions[index], character_id: chars[index], published_at: null };
      const values = ['11111111-1111-4111-8111-111111111112'];
      const expressions = columns.map(column => {
        if (!(column in changes)) return `source.${column}`;
        values.push(changes[column]); return `$${values.length}`;
      });
      await db.query(`insert into public.character_versions(${columns.join(',')}) select ${expressions.join(',')}
        from public.character_versions source where id=$1`, values);
    }
    async function insert(index, status = 'active', user = learner) {
      const id = randomUUID();
      await db.query(`insert into public.conversations(id,owner_id,character_id,character_version_id,status,model_id)
        values($1,$2,$3,$4,$5,'test-model')`, [id, user, chars[index], versions[index], status]);
      return id;
    }
    const active = await insert(0), archived = await insert(0, 'archived'), deleted = await insert(0, 'deleted');
    // Install the exact migration with preexisting rows and deliberately stale counters.
    await db.exec(migrationSql.replace(/^begin;\s*/i, '').replace(/commit;\s*$/i, ''));
    async function counts(expected) {
      for (const [index, id] of chars.entries()) {
        const actual = await db.query(`select conversation_count::int as stored,
          (select count(*)::int from public.conversations where character_id=$1 and status<>'deleted') as actual
          from public.characters where id=$1`, [id]);
        assert.deepEqual(actual.rows, [{ stored: expected[index], actual: expected[index] }]);
      }
    }
    await counts([2, 0]);
    const extra = await insert(1); await counts([2, 1]);
    await db.query("update public.conversations set status='archived' where id=$1", [active]); await counts([2, 1]);
    await db.query("update public.conversations set status='active' where id=$1", [archived]); await counts([2, 1]);
    const beforeNoop = await db.query('select id,updated_at from public.characters where id=any($1::uuid[]) order by id', [chars]);
    await db.query("update public.conversations set title='Renamed',status=status,character_id=character_id where id=$1", [active]);
    assert.deepEqual((await db.query('select id,updated_at from public.characters where id=any($1::uuid[]) order by id', [chars])).rows, beforeNoop.rows);
    await counts([2, 1]);
    await db.query("update public.conversations set status='deleted' where id=$1", [active]); await counts([1, 1]);
    await db.query("update public.conversations set status='active' where id=$1", [active]); await counts([2, 1]);
    await db.query("update public.conversations set status='archived' where id=$1", [deleted]); await counts([3, 1]);
    await db.query('update public.conversations set character_id=$2,character_version_id=$3 where id=$1', [active, chars[1], versions[1]]); await counts([2, 2]);
    await db.query("update public.conversations set status='deleted',character_id=$2,character_version_id=$3 where id=$1", [active, chars[0], versions[0]]); await counts([2, 1]);
    await db.query('delete from public.conversations where id=$1', [active]); await counts([2, 1]);
    await db.query('delete from public.conversations where id=$1', [extra]); await counts([2, 0]);
    await insert(1, 'deleted'); await counts([2, 0]);
    const grants = await db.query(`select
      has_function_privilege('authenticated','app_private.maintain_character_conversation_count()','execute') as browser,
      has_function_privilege('anon','app_private.maintain_character_conversation_count()','execute') as anonymous,
      has_function_privilege('service_role','app_private.maintain_character_conversation_count()','execute') as server,
      has_schema_privilege('authenticated','app_private','usage') as schema_access`);
    assert.deepEqual(grants.rows[0], { browser: false, anonymous: false, server: false, schema_access: false });
    await db.exec('savepoint forged_counter');
    await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: owner })]);
    await db.exec('set local role authenticated');
    await assert.rejects(() => db.query('update public.characters set conversation_count=100000 where id=$1', [chars[0]]), error => error.code === '42501');
    await db.exec('rollback to savepoint forged_counter');
    await counts([2, 0]);
    // Real FK cascade does not have a signed-in user and must still decrement.
    await db.query('delete from auth.users where id=$1', [learner]);
    await counts([0, 0]);
    console.log('Character conversation counter PASS: backfill, insert, archive/restore/delete, transfer, no-op, cascade, no browser metric writes');
  } finally {
    await db.exec('rollback');
  }
}

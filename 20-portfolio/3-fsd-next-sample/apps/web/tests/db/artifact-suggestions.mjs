import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyArtifactSuggestions(db) {
  await db.exec('begin');
  try {
    const owner = randomUUID(), other = randomUUID(), artifact = randomUUID();
    const first = randomUUID(), second = randomUUID(), request = randomUUID();
    const source = 'A😀B original text';
    await db.query('insert into auth.users(id) values($1),($2)', [owner, other]);
    const conversation = (await db.query(`insert into public.conversations(owner_id,character_id,character_version_id,model_id)
      values($1,'11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111112','test-model') returning id`, [owner])).rows[0].id;
    const commit = (id, base, content) => db.query('select public.commit_artifact_revision($1,$2,$3,$4,$5,$6::jsonb)',
      [id, artifact, owner, conversation, base, JSON.stringify({ kind: 'text', title: 'Suggestion source', contentText: content, status: 'draft' })]);
    await commit(first, null, source);
    const input = [request, artifact, owner, first, 'rewrite', 1, 3, source, 'First provider output', 'Explanation'];
    const persist = (args = input) => db.query('select * from public.persist_artifact_suggestion($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', args);
    async function rejects(action, code) {
      await db.exec('savepoint invalid_suggestion');
      await assert.rejects(action, error => error.code === code);
      await db.exec('rollback to savepoint invalid_suggestion');
    }
    const saved = (await persist()).rows[0];
    assert.equal(saved.id, request);
    assert.equal(saved.original_text, source);
    assert.equal(saved.selection_end, 3); // JavaScript UTF-16 range selects the entire emoji.
    assert.equal(saved.status, 'pending');
    const replay = [...input]; replay[8] = 'Later provider output';
    assert.deepEqual((await persist(replay)).rows[0], saved);
    for (const [index, value, code] of [[2, other, '42501'], [7, 'forged source', 'PT409'], [6, 999, '22023'], [4, 'analysis', '22023']]) {
      const changed = [...input]; changed[index] = value;
      await rejects(() => persist(changed), code);
    }
    const collision = [...input]; collision[5] = 0;
    await rejects(() => persist(collision), 'PT409');
    assert.equal((await db.query('select count(*)::int as n from public.artifact_versions where artifact_id=$1', [artifact])).rows[0].n, 1);
    await rejects(() => db.query(`insert into public.artifact_suggestions(artifact_version_id,owner_id,original_text,suggested_text,description,selection_start)
      values($1,$2,'legacy','bad','bad',1)`, [first, owner]), '23514');
    const signature = 'public.persist_artifact_suggestion(uuid,uuid,uuid,uuid,text,integer,integer,text,text,text)';
    for (const role of ['anon', 'authenticated']) {
      for (const privilege of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
        assert.equal((await db.query('select has_table_privilege($1,$2,$3) as allowed', [role, 'public.artifact_suggestions', privilege])).rows[0].allowed, false);
      }
      assert.equal((await db.query('select has_function_privilege($1,$2,$3) as allowed', [role, signature, 'EXECUTE'])).rows[0].allowed, false);
    }
    assert.equal((await db.query('select has_function_privilege($1,$2,$3) as allowed', ['service_role', signature, 'EXECUTE'])).rows[0].allowed, true);
    for (const [user, expected] of [[owner, 1], [other, 0]]) {
      await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: user })]);
      await db.exec('set local role authenticated');
      assert.equal((await db.query('select count(*)::int as n from public.artifact_suggestions where id=$1', [request])).rows[0].n, expected);
      await rejects(() => db.query("update public.artifact_suggestions set status='accepted' where id=$1", [request]), '42501');
      await rejects(() => persist(), '42501');
      await db.exec('reset role');
    }
    await commit(second, first, 'Second source');
    const stale = [...input]; stale[0] = randomUUID();
    await rejects(() => persist(stale), 'PT409');
    assert.deepEqual((await persist()).rows[0], saved); // Historical replay cannot rewrite the current version.
    assert.equal((await db.query('select current_version_id from public.artifacts where id=$1', [artifact])).rows[0].current_version_id, second);
    assert.equal((await db.query('select count(*)::int as n from public.artifact_suggestions where artifact_version_id=$1', [second])).rows[0].n, 0);
    await db.query("update public.artifacts set status='archived' where id=$1", [artifact]);
    await rejects(() => persist(), 'PT409');
    await db.query("update public.artifacts set status='draft' where id=$1", [artifact]);
    await db.query("update public.conversations set status='deleted' where id=$1", [conversation]);
    await rejects(() => persist(), '42501');
    await db.query('select public.purge_owned_conversations($1,$2)', [owner, randomUUID()]);
    assert.equal((await db.query('select count(*)::int as n from public.artifact_suggestions where id=$1', [request])).rows[0].n, 0);
    console.log('Artifact suggestions PASS: source/version binding, UTF-16, first-output replay, stale/archive rejection, owner-only reads, server-only writes and purge cascade');
  } finally { await db.exec('rollback'); }
}

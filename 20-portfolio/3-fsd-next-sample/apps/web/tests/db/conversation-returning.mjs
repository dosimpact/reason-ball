import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function verifyConversationReturning(db, ownerId, otherId) {
  await db.exec("begin");
  const ids = [randomUUID(), randomUUID(), randomUUID()];
  async function asUser(id, role = "authenticated") {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: id, app_metadata: {} })]);
    await db.exec(`set local role ${role}`);
  }
  try {
    await asUser(ownerId);
    for (const [index, visibility] of ["private", "public", "unlisted"].entries()) {
      const result = await db.query(`insert into public.conversations
        (id, owner_id, character_id, character_version_id, visibility, model_id)
        values ($1, $2, '11111111-1111-4111-8111-111111111111',
          '11111111-1111-4111-8111-111111111112', $3, 'test-model') returning id`,
      [ids[index], ownerId, visibility]);
      assert.equal(result.rows[0].id, ids[index]);
    }
    await asUser(otherId);
    const otherRows = await db.query("select id from public.conversations where id = any($1::uuid[])", [ids]);
    assert.deepEqual(otherRows.rows.map((row) => row.id).sort(), ids.slice(1).sort());
    await db.exec("savepoint wrong_owner");
    await assert.rejects(() => db.query(`insert into public.conversations
      (owner_id, character_id, character_version_id, visibility, model_id)
      values ($1, '11111111-1111-4111-8111-111111111111',
        '11111111-1111-4111-8111-111111111112', 'private', 'test-model') returning id`, [ownerId]),
    (error) => error.code === "42501");
    await db.exec("rollback to savepoint wrong_owner");
    await asUser(null, "anon");
    const publicRows = await db.query("select id from public.conversations where id = any($1::uuid[])", [ids]);
    assert.deepEqual(publicRows.rows, [{ id: ids[1] }]);
    await db.exec("reset role");
    await db.query("update public.conversations set status = 'deleted' where id = any($1::uuid[])", [ids]);
    await asUser(ownerId);
    assert.equal((await db.query("select id from public.conversations where id = any($1::uuid[])", [ids])).rows.length, 0);
    console.log("Conversation RETURNING RLS PASS: insert/read, owner isolation, visibility and deleted rows");
  } finally {
    await db.exec("rollback");
  }
}

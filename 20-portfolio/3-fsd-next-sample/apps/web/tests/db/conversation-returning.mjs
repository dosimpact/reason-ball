import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function verifyConversationReturning(db, ownerId, otherId) {
  await db.exec("begin");
  const ids = [randomUUID(), randomUUID(), randomUUID()];
  async function asUser(id, role = "authenticated", admin = false) {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: id, app_metadata: admin ? { role: "admin" } : {} })]);
    await db.exec(`set local role ${role}`);
  }
  async function assertVisible(expected) {
    const rows = await db.query("select id from public.conversations where id = any($1::uuid[]) order by id", [ids]);
    assert.deepEqual(rows.rows.map(row => row.id), [...expected].sort());
    const messages = await db.query("select conversation_id from public.messages where conversation_id = any($1::uuid[]) order by conversation_id", [ids]);
    assert.deepEqual(messages.rows.map(row => row.conversation_id), [...expected].sort());
    for (const id of ids) {
      assert.equal((await db.query("select public.can_view_conversation($1) as visible", [id])).rows[0].visible, expected.includes(id));
    }
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
      await db.query(`insert into public.messages(conversation_id,author_id,role,status,parts,plain_text)
        values ($1,$2,'user','complete','[{"type":"text","text":"Visibility test"}]','Visibility test')`, [ids[index],ownerId]);
    }
    await assertVisible(ids);
    await asUser(otherId);
    const otherRows = await db.query("select id from public.conversations where id = any($1::uuid[])", [ids]);
    assert.deepEqual(otherRows.rows.map((row) => row.id).sort(), [ids[1]]);
    await assertVisible([ids[1]]);
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
    await assertVisible([ids[1]]);
    await asUser(otherId, "authenticated", true);
    await assertVisible(ids);
    await db.exec("reset role");
    await db.query("update public.conversations set status = 'deleted' where id = any($1::uuid[])", [ids]);
    await asUser(ownerId);
    assert.equal((await db.query("select id from public.conversations where id = any($1::uuid[])", [ids])).rows.length, 0);
    await assertVisible([]);
    await asUser(otherId);
    await assertVisible([]);
    await asUser(null, "anon");
    await assertVisible([]);
    await asUser(otherId, "authenticated", true);
    await assertVisible(ids);
    console.log("Conversation RETURNING RLS PASS: INSERT RETURNING, owner/admin/public, tokenless unlisted denial, messages/helper and deleted rows");
  } finally {
    await db.exec("rollback");
  }
}

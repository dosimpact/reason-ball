import assert from "node:assert/strict";

export async function verifyChatGeneration(db, { ownerId, reporterId, conversationId, expectDatabaseError }) {
  const chatId = "50000000-0000-4000-8000-000000000090";
  const firstRequest = "51000000-0000-4000-8000-000000000090";
  const retryRequest = "51000000-0000-4000-8000-000000000091";
  const parts = [{ type: "text", text: "Can I check in?" }];
  const answer = [{ type: "text", text: "Of course. What is your name?" }];
  await db.query(`insert into public.conversations
    (id, owner_id, character_id, character_version_id, model_id)
    select $1, owner_id, character_id, character_version_id, model_id
    from public.conversations where id = $2`, [chatId, conversationId]);
  const begin = (requestId, body = parts, key = "client-turn-1", owner = ownerId) => db.query(
    "select * from public.begin_chat_generation($1, $2, $3, $4, $5, 'test-model')",
    [chatId, owner, key, JSON.stringify(body), requestId],
  );
  await expectDatabaseError(() => begin(firstRequest, parts, "client-turn-1", reporterId), "42501");
  const claimed = (await begin(firstRequest)).rows[0];
  assert.equal(claimed.replayed, false);
  const firstRows = await db.query("select role, status, parts from public.messages where conversation_id = $1 order by sequence_number", [chatId]);
  assert.deepEqual(firstRows.rows, [
    { role: "user", status: "complete", parts },
    { role: "assistant", status: "pending", parts: [] },
  ]);
  await expectDatabaseError(() => begin(retryRequest), "40001");
  await expectDatabaseError(() => begin(retryRequest, parts, "another-turn"), "40001");
  await expectDatabaseError(() => begin(retryRequest, [{ type: "text", text: "changed" }]), "40001");
  const finish = (requestId, status, body = answer, owner = ownerId) => db.query(
    "select public.finish_chat_generation($1, $2, $3, $4, $5, $6, 'stop') as id",
    [chatId, owner, claimed.assistant_message_id, requestId, status, JSON.stringify(body)],
  );
  await expectDatabaseError(() => finish(firstRequest, "complete", answer, reporterId), "42501");

  // A crashed worker's expired lease is reclaimable, but it cannot overwrite
  // the replacement worker's result. The user and assistant IDs remain stable.
  await db.query("update public.chat_generations set lease_expires_at = now() - interval '1 second' where conversation_id = $1", [chatId]);
  assert.deepEqual((await begin(retryRequest)).rows[0], claimed);
  await expectDatabaseError(() => finish(firstRequest, "complete"), "40001");
  await finish(retryRequest, "error", [{ type: "text", text: "partial" }]);
  assert.deepEqual((await begin(firstRequest)).rows[0], claimed);
  await finish(firstRequest, "complete");
  await finish(firstRequest, "complete");
  await expectDatabaseError(() => finish(firstRequest, "complete", [{ type: "text", text: "overwrite" }]), "40001");
  assert.deepEqual((await begin(retryRequest)).rows[0], { ...claimed, replayed: true });
  const completed = await db.query("select role, status, parts, plain_text from public.messages where conversation_id = $1 order by sequence_number", [chatId]);
  assert.deepEqual(completed.rows, [
    { role: "user", status: "complete", parts, plain_text: "Can I check in?" },
    { role: "assistant", status: "complete", parts: answer, plain_text: "Of course. What is your name?" },
  ]);

  const next = (await begin(retryRequest, parts, "client-turn-2")).rows[0];
  assert.notEqual(next.user_message_id, claimed.user_message_id);
  await db.query("update public.conversations set status = 'deleted' where id = $1", [chatId]);
  await expectDatabaseError(() => db.query(
    "select public.finish_chat_generation($1, $2, $3, $4, 'complete', $5)",
    [chatId, ownerId, next.assistant_message_id, retryRequest, JSON.stringify(answer)],
  ), "42501");

  const permissions = await db.query(`select
    has_function_privilege('authenticated', 'public.begin_chat_generation(uuid,uuid,text,jsonb,uuid,text)', 'execute') as browser_begin,
    has_function_privilege('authenticated', 'public.finish_chat_generation(uuid,uuid,uuid,uuid,text,jsonb,text)', 'execute') as browser_finish,
    has_function_privilege('service_role', 'public.begin_chat_generation(uuid,uuid,text,jsonb,uuid,text)', 'execute') as server_begin,
    has_table_privilege('authenticated', 'public.chat_generations', 'select') as browser_lease`);
  assert.deepEqual(permissions.rows[0], { browser_begin: false, browser_finish: false, server_begin: true, browser_lease: false });
}

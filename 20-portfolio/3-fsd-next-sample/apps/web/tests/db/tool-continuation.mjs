import assert from "node:assert/strict";

export async function verifyToolContinuation(db, { ownerId, reporterId, conversationId, expectDatabaseError }) {
  const chatId = "52000000-0000-4000-8000-000000000090";
  const requests = [0, 1, 2, 3].map((n) => `53000000-0000-4000-8000-00000000009${n}`);
  await db.query(`insert into public.conversations(id, owner_id, character_id, character_version_id, model_id)
    select $1, owner_id, character_id, character_version_id, model_id from public.conversations where id = $2`, [chatId, conversationId]);
  const userParts = [{ type: "text", text: "Weather in London and Seoul?" }];
  const beginUser = (key = "approval-user") => db.query("select * from public.begin_chat_generation($1,$2,$3,$4,$5,'test-model')", [chatId, ownerId, key, JSON.stringify(userParts), requests[0]]);
  const claim = (await beginUser()).rows[0];
  const pending = [
    { type: "text", text: "Please approve these locations." },
    ...["London", "Seoul"].map((location, n) => ({ type: "tool-weather", toolCallId: `call-${n}`, state: "approval-requested", input: { location }, approval: { id: `approval-${n}`, signature: "server-signature" } })),
  ];
  const decisions = [
    { approvalId: "approval-0", toolCallId: "call-0", approved: true },
    { approvalId: "approval-1", toolCallId: "call-1", approved: false, reason: "No thanks" },
  ];
  const finish = (requestId, status, parts) => db.query("select public.finish_chat_generation($1,$2,$3,$4,$5,$6,'stop')", [chatId, ownerId, claim.assistant_message_id, requestId, status, JSON.stringify(parts)]);
  const begin = (body = decisions, requestId = requests[1], owner = ownerId, assistantId = claim.assistant_message_id, model = "test-model") => db.query(
    "select * from public.begin_chat_tool_continuation($1,$2,$3,$4,$5,$6)", [chatId, owner, assistantId, requestId, model, JSON.stringify(body)]);
  await finish(requests[0], "complete", pending);
  await expectDatabaseError(() => begin(decisions, requests[1], reporterId), "42501");
  await expectDatabaseError(() => begin(decisions, requests[1], ownerId, conversationId), "40001");
  await expectDatabaseError(() => begin(decisions, requests[1], ownerId, claim.assistant_message_id, "other-model"), "40001");
  for (const invalid of [[], [decisions[0], decisions[0]], [{ ...decisions[0], approved: "yes" }], [{ ...decisions[0], reason: null }], [{ ...decisions[0], input: "tamper" }], decisions.slice(0, 1)]) {
    await expectDatabaseError(() => begin(invalid), "22023");
  }
  await expectDatabaseError(() => begin([{ ...decisions[0], approvalId: "unknown" }, decisions[1]]), "40001");
  assert.deepEqual((await db.query("select parts from public.messages where id=$1", [claim.assistant_message_id])).rows[0].parts, pending);
  const resumed = (await begin()).rows[0];
  assert.equal(resumed.assistant_message_id, claim.assistant_message_id);
  assert.equal(resumed.user_message_id, claim.user_message_id);
  assert.equal(resumed.replayed, false);
  const checkpoint = pending.map((part, index) => index === 0 ? part : { ...part, state: "approval-responded", approval: { ...part.approval, approved: decisions[index - 1].approved, ...(index === 2 ? { reason: "No thanks" } : {}) } });
  assert.deepEqual(resumed.continuation_parts, checkpoint);
  await expectDatabaseError(() => begin(), "40001");
  await expectDatabaseError(() => beginUser(), "40001");
  await expectDatabaseError(() => beginUser("other-user"), "40001");
  await expectDatabaseError(() => finish(requests[0], "complete", pending), "40001");
  await finish(requests[1], "error", []);
  assert.deepEqual((await db.query("select parts,status from public.messages where id=$1", [claim.assistant_message_id])).rows[0], { parts: checkpoint, status: "error" });
  await expectDatabaseError(() => begin([{ ...decisions[0], approved: false }, decisions[1]], requests[2]), "40001");
  await expectDatabaseError(() => beginUser(), "40001");
  assert.deepEqual((await begin(decisions.toReversed(), requests[2])).rows[0], resumed);
  await db.query("update public.chat_generations set lease_expires_at=now()-interval '1 second' where conversation_id=$1", [chatId]);
  assert.deepEqual((await begin(decisions, requests[3])).rows[0], resumed);
  await expectDatabaseError(() => finish(requests[2], "complete", pending), "40001");
  const completed = checkpoint.map((part, index) => index === 0 ? part : { ...part, state: index === 1 ? "output-available" : "output-denied", ...(index === 1 ? { output: { location: "London", temperature: 20, condition: "sunny", source: "mock" } } : {}) });
  completed.push({ type: "text", text: "London is sunny; Seoul was not queried." });
  await finish(requests[3], "complete", completed);
  await finish(requests[3], "complete", completed);
  assert.equal((await begin()).rows[0].replayed, true);
  await expectDatabaseError(() => begin([{ ...decisions[0], approved: false }, decisions[1]]), "40001");
  assert.equal((await db.query("select count(*)::integer as n from public.messages where conversation_id=$1", [chatId])).rows[0].n, 2);

  // A later approval round preserves all prior outputs and accepts only its own decisions.
  const nextApproval = { type: "tool-weather", toolCallId: "call-2", state: "approval-requested", input: { location: "Paris" }, approval: { id: "approval-2" } };
  await db.query("update public.messages set parts=$2 where id=$1", [claim.assistant_message_id, JSON.stringify([...completed, nextApproval])]);
  const nextDecision = [{ approvalId: "approval-2", toolCallId: "call-2", approved: false }];
  const nextRound = (await begin(nextDecision, requests[0])).rows[0];
  assert.deepEqual(nextRound.continuation_parts.slice(0, completed.length), completed);
  await finish(requests[0], "cancelled", []);
  assert.deepEqual((await begin(nextDecision, requests[1])).rows[0], nextRound);
  const finalParts = nextRound.continuation_parts.map((part) => part.toolCallId === "call-2" ? { ...part, state: "output-denied" } : part);
  await finish(requests[1], "complete", finalParts);
  await beginUser("later-user");
  await expectDatabaseError(() => begin(nextDecision), "40001");
  await db.query("update public.conversations set status='deleted' where id=$1", [chatId]);
  await expectDatabaseError(() => begin(nextDecision), "42501");
  const grants = (await db.query(`select
    has_function_privilege('authenticated','public.begin_chat_tool_continuation(uuid,uuid,uuid,uuid,text,jsonb)','execute') as browser,
    has_function_privilege('anon','public.begin_chat_tool_continuation(uuid,uuid,uuid,uuid,text,jsonb)','execute') as anonymous,
    has_function_privilege('service_role','public.begin_chat_tool_continuation(uuid,uuid,uuid,uuid,text,jsonb)','execute') as server,
    has_function_privilege('service_role','public.begin_chat_generation_user(uuid,uuid,text,jsonb,uuid,text)','execute') as internal_begin,
    has_function_privilege('service_role','public.finish_chat_generation_base(uuid,uuid,uuid,uuid,text,jsonb,text)','execute') as internal_finish`)).rows[0];
  assert.deepEqual(grants, { browser: false, anonymous: false, server: true, internal_begin: false, internal_finish: false });
}

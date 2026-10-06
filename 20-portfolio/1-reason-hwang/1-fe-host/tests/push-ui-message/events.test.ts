import { test } from "node:test";
import assert from "node:assert/strict";
import { applyEvent, finishTurn, Turn } from "../../src/features/push-ui-message/model";
import { readEvents } from "../../src/features/push-ui-message/stream";

const initial: Turn = { id: "turn", messageId: "answer", question: "hi", answer: "", status: "running", steps: [] };
function ui(id: string, messageId: string, status: string) {
  return { event: "ui", data: { id, name: "turn_progress", props: { title: "자료 조사", status }, metadata: { message_id: messageId } } };
}
test("append steps, update same ID, reject events from another turn", () => {
  const started = applyEvent(initial, ui("step", "answer", "running"));
  const done = applyEvent(started, ui("step", "answer", "completed"));
  assert.equal(done.steps.length, 1);
  assert.equal(done.steps[0].status, "completed");
  assert.equal(applyEvent(done, ui("other", "wrong", "running")), done);
  assert.equal(applyEvent(done, ui("next", "answer", "running")).steps.length, 2);
  assert.equal(initial.steps.length, 0);
});
test("cancel terminates pending steps while preserving completed history", () => {
  const turn = applyEvent(applyEvent(initial, ui("a", "answer", "completed")), ui("b", "answer", "running"));
  assert.deepEqual(finishTurn(turn, "cancelled", "cancel").steps.map(s => s.status), ["completed", "cancelled"]);
});
test("SSE parses split UTF-8 and multiple frames", async () => {
  const bytes = new TextEncoder().encode('event: answer\ndata: {"content":"매출"}\n\nevent: done\ndata: {}\n\n');
  const events: unknown[] = [];
  const body = new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i += 2) controller.enqueue(bytes.slice(i, i + 2)); controller.close(); } });
  await readEvents(new Response(body), event => events.push(event));
  assert.deepEqual(events, [{ event: "answer", data: { content: "매출" } }, { event: "done", data: {} }]);
});
test("truncated stream is a failure", async () => {
  await assert.rejects(readEvents(new Response('event: start\ndata: {}\n\n'), () => {}), /완료 전에/);
});

// Explicit one-time authoring command: creates real model outputs, never runs on page load.
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.CHAT_TEST_URL || "http://127.0.0.1:3048";
const cases = [
  ["dashboard", "01 · Saga 대시보드", "Create a Saga dashboard using sample values, BigValue, BarGauge, Table and Alert."],
  ["times", "02 · 시간과 필터", "Create a sample monitoring view with TimeRangePicker, Select, Table and sample metric summaries."],
  ["market", "03 · 주식 비교", "Call get_stock_price for AAPL and NVDA, then compare mock prices in a Saga Table and Alert. Label demo data."],
  ["settings", "04 · 설정 폼", "Create a Saga settings form with name, notifications and selection controls. This is a local demo only."],
];
await mkdir(new URL("../output/demo-history/", import.meta.url), { recursive: true });
const records = [];
async function generate([key, title, instruction], index) {
  const user = { id: `demo-${key}-user`, role: "user", content: `${instruction} Use only the registered Saga catalog. Write visible labels and explanations in Korean where natural. Use English short chart category labels. Do not describe how to build it: return the rendered OpenUI Lang program.` };
  const response = await fetch(`${base}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [user] }), signal: AbortSignal.timeout(240_000) });
  if (!response.ok) throw new Error(`${title}: HTTP ${response.status}`);
  const stream = await response.text();
  await writeFile(new URL(`../output/demo-history/${key}.sse`, import.meta.url), stream);
  const events = stream.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => JSON.parse(line.slice(5)));
  if (events.at(-1)?.type !== "RUN_FINISHED" || events.some(e => e.type === "RUN_ERROR")) throw new Error(`${title}: incomplete run`);
  const messages = [user];
  for (const event of events) {
    if (event.type === "TOOL_CALL_START") {
      const args = events.filter(e => e.type === "TOOL_CALL_ARGS" && e.toolCallId === event.toolCallId).map(e => e.delta).join("");
      JSON.parse(args);
      messages.push({ id: `assistant-${event.toolCallId}`, role: "assistant", content: "", toolCalls: [{ id: event.toolCallId, type: "function", function: { name: event.toolCallName, arguments: args } }] });
    } else if (event.type === "TOOL_CALL_RESULT") {
      messages.push({ id: event.messageId, role: "tool", toolCallId: event.toolCallId, content: event.content });
    } else if (event.type === "TEXT_MESSAGE_START") {
      const content = events.filter(e => e.type === "TEXT_MESSAGE_CONTENT" && e.messageId === event.messageId).map(e => e.delta).join("");
      if (content.trim()) messages.push({ id: event.messageId, role: "assistant", content });
    }
  }
  if (!messages.some(m => m.role === "assistant" && m.content)) throw new Error(`${title}: empty program`);
  const record = { thread: { id: `saga-demo-v1-${key}`, title, createdAt: new Date(Date.now() - index * 1000).toISOString() }, messages };
  records[index] = record;
  console.log(`${title}: generated (${messages.length} messages)`);
}
// Bounded provider concurrency; each case makes a real LangGraph request.
for (let start = 0; start < cases.length; start += 2) await Promise.all(cases.slice(start, start + 2).map((c, i) => generate(c, start + i)));
await writeFile(new URL("../src/data/demo-threads.json", import.meta.url), JSON.stringify(records, null, 2) + "\n");
console.log(`Saved ${records.length} real model-generated demo threads.`);

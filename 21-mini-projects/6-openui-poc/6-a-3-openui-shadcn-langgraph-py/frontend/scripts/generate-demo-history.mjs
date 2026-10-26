// Explicit one-time authoring command: creates real model outputs, never runs on page load.
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.CHAT_TEST_URL || "http://127.0.0.1:3046";
const cases = [
  ["startup", "01 · 스타트업 대시보드", "Create a startup analytics dashboard with sample numbers. Include CardHeader, TagBlock, key metrics Table, annual goal Progress, Tabs with Revenue BarChart, Growth LineChart and Breakdown PieChart, and FollowUpBlock."],
  ["travel", "02 · 여행 계획", "Design a Tokyo, Paris and New York trip planner. Include a range CalendarBlock for two months, Accordion with 3 destination descriptions and budgets, and a preferences Form with Select, Slider and CheckBoxGroup. Add FollowUpBlock. Clearly label budgets as examples."],
  ["market", "03 · 주식 비교", "Call get_stock_price for AAPL, NVDA, GOOGL and TSLA. Render a market overview with a Table, TagBlock, biggest-mover Alert, and DrawerBlock containing BarChart comparing their returned prices. Clearly explain that all prices are mock demo data. Add FollowUpBlock."],
  ["rsvp", "04 · 행사 RSVP 폼", "Create a tech summit RSVP. Include info Alert, Form with name/email Input, ticket Select, diet RadioGroup, DatePicker, group-size Slider, sessions CheckBoxGroup, notification SwitchGroup, and submit Button. Add FollowUpBlock. This is a demo form, no real registration."],
  ["standup", "05 · 팀 스탠드업", "Create a sample team standup board with sprint Progress, task Table for 5 members, blockers Alert, Yesterday/Today/Blockers Accordion, and DialogBlock with sprint metrics PieChart and summary Table. Add FollowUpBlock."],
  ["recipe", "06 · 레시피 카드", "Create a Spicy Thai Basil Chicken recipe with TagBlock and Tabs for Ingredients Table, Instructions Accordion with 5 steps, and Nutrition donut PieChart and Table. Add Blockquote, a Button opening a DialogBlock for recipe tips, and FollowUpBlock. Nutrition values are illustrative estimates."],
  ["charts", "07 · 차트 쇼케이스", "Create a compact sample Global Tech Industry Report with TagBlock and Tabs for seven chart types: grouped BarChart, LineChart, AreaChart, donut PieChart, RadarChart, ScatterChart with labeled Point entries, and RadialChart. Each chart needs sample data. Add a summary Table and FollowUpBlock."],
];
await mkdir(new URL("../output/demo-history/", import.meta.url), { recursive: true });
const records = [];
async function generate([key, title, instruction], index) {
  const user = { id: `demo-${key}-user`, role: "user", content: `${instruction} Use only the registered shadcn catalog. Write visible labels and explanations in Korean where natural. Use English short chart category labels. Do not describe how to build it: return the rendered OpenUI Lang program.` };
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
  const record = { thread: { id: `shadcn-demo-v1-${key}`, title, createdAt: new Date(Date.now() - index * 1000).toISOString() }, messages };
  records[index] = record;
  console.log(`${title}: generated (${messages.length} messages)`);
}
// Bounded provider concurrency; each case makes a real LangGraph request.
for (let start = 0; start < cases.length; start += 2) await Promise.all(cases.slice(start, start + 2).map((c, i) => generate(c, start + i)));
await writeFile(new URL("../src/data/demo-threads.json", import.meta.url), JSON.stringify(records, null, 2) + "\n");
console.log(`Saved ${records.length} real model-generated demo threads.`);

import { expect, test, type Page } from "@playwright/test";

const graphId = "25_push_ui_message_example";
type DomSample = {
  id: string;
  content: string;
  heading: string;
  count: number;
  open: boolean;
  stages: { title: string; status: string }[];
};
const chat = (page: Page) => page.getByRole("log", { name: "Messages" });
const assistants = (page: Page) => chat(page).locator("article.assistant");
const composer = (page: Page) => page.getByRole("textbox", { name: "Message", exact: true });
const status = (page: Page) => page.locator(".runtime-facts > div").filter({ hasText: "Status" }).locator("strong");
const threadId = (page: Page) => page.locator(".runtime-facts > div").filter({ hasText: "Thread ID" }).locator("strong");
const finalState = (page: Page) => page.getByRole("region", { name: "Final State" }).locator("pre");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "25 push_ui_message Example implemented", exact: true }).click();
  await expect(page.getByRole("heading", { name: "push_ui_message Example", exact: true })).toBeVisible();
});

test("initial chat controls and collapsed diagnostics", async ({ page }) => {
  await expect(composer(page)).toBeEnabled();
  await expect(status(page)).toHaveText("idle");
  await expect(threadId(page)).toHaveText("none");
  await expect(chat(page).locator("article")).toHaveCount(0);
  await expect(page.locator(".push-ui-chat-debug")).not.toHaveAttribute("open", "");
  await composer(page).fill("   ");
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
});

test("live provider: streamed answer, stages, thread reuse, disclosure and new chat", async ({ page, request }, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  const createdThreads: string[] = [];
  const runBodies: Record<string, unknown>[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (req) => {
    if (req.method() === "POST" && req.url().endsWith("/runs/stream")) runBodies.push(req.postDataJSON());
  });
  const apiUrl = await page.getByRole("textbox", { name: "LangGraph API URL", exact: true }).inputValue();
  try {
    // Observe actual DOM changes without substituting network responses or provider output.
    await page.evaluate(() => {
      const samples: DomSample[] = [];
      Object.assign(window, { pushUiSamples: samples });
      new MutationObserver(() => {
        const bubbles = document.querySelectorAll("article.assistant");
        const bubble = bubbles[0];
        if (!bubble) return;
        const sample = {
          id: bubble.getAttribute("data-chat-message-id") ?? "",
          content: bubble.querySelector("p")?.textContent ?? "",
          heading: bubble.querySelectorAll("strong")[bubble.querySelectorAll("strong").length - 1]?.textContent ?? "",
          count: bubbles.length,
          open: bubble.querySelector("details")?.open ?? false,
          stages: Array.from(bubble.querySelectorAll("li")).map((node) => ({
            title: node.querySelector("strong")?.textContent ?? "",
            status: node.querySelector(".push-ui-progress-status")?.textContent ?? "",
          })),
        };
        if (JSON.stringify(samples[samples.length - 1]) !== JSON.stringify(sample)) samples.push(sample);
      }).observe(document.querySelector(".push-ui-chat-layout")!, { subtree: true, childList: true, characterData: true, attributes: true });
    });
    const prompt = `기억할 단어는 푸른구름입니다. push_ui_message 기능과 UI 연결을 한국어 5문장으로 설명해줘. 검증번호 ${Date.now()}`;
    await composer(page).fill(prompt);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(status(page)).toHaveText("running");
    await expect(composer(page)).toBeDisabled();
    await expect(page.getByRole("button", { name: "New chat", exact: true })).toBeDisabled();
    await expect(assistants(page)).toHaveCount(1);
    const assistantId = await assistants(page).first().getAttribute("data-chat-message-id");
    const disclosure = assistants(page).first().locator("details");
    await expect(disclosure).not.toHaveAttribute("open", "");
    await disclosure.locator("summary").click();
    await expect(disclosure).toHaveAttribute("open", "");
    await expect(status(page)).toHaveText("completed", { timeout: 60_000 });
    const firstThread = await threadId(page).innerText();
    createdThreads.push(firstThread);
    await expect(assistants(page)).toHaveCount(1);
    await expect(assistants(page).first()).toHaveAttribute("data-chat-message-id", assistantId!);
    await expect(disclosure).toHaveAttribute("open", "");
    await expect(disclosure.locator("li strong")).toHaveText(["작업 착수", "데이터 검색중", "자료 취합중", "자료 완성중"]);
    await expect(disclosure.locator("li .push-ui-progress-status")).toHaveText(["완료", "1/3 · 완료", "2/3 · 완료", "3/3 · 완료"]);
    const answer = await assistants(page).first().locator("p").innerText();
    expect(answer.length).toBeGreaterThan(20);
    await disclosure.locator("summary").press("Enter");
    await expect(disclosure).not.toHaveAttribute("open", "");
    await expect(assistants(page).first().locator("p")).toBeVisible();
    await page.getByText("실행 상태와 스트림 상세", { exact: true }).click();
    const firstState = JSON.parse(await finalState(page).innerText());
    expect(firstState.messages).toHaveLength(2);
    expect(firstState.messages[1].id).toBe(assistantId);
    expect(firstState.messages[1].content).toBe(answer);
    expect(firstState.ui).toHaveLength(4);
    expect(firstState.ui.every((ui: { metadata: { message_id: string } }) => ui.metadata.message_id === assistantId)).toBe(true);
    for (const field of ["workflow_id", "answer", "final", "ui_render_status"]) expect(firstState).not.toHaveProperty(field);
    const samples = await page.evaluate(() => (window as unknown as { pushUiSamples: DomSample[] }).pushUiSamples);
    await testInfo.attach("live-dom-stream-timeline", { body: JSON.stringify(samples, null, 2), contentType: "application/json" });
    expect(new Set(samples.map((sample) => sample.id))).toEqual(new Set([assistantId]));
    expect(samples.every((sample) => sample.count === 1)).toBe(true);
    const partials = samples.filter((sample) => sample.heading === "응답 작성중…" && sample.content.length > 0);
    expect(new Set(partials.map((sample) => sample.content)).size).toBeGreaterThan(1);
    expect(partials.every((sample) => answer.startsWith(sample.content))).toBe(true);
    const stageTitles = ["데이터 검색중", "자료 취합중", "자료 완성중"];
    const runningAt = stageTitles.map((title) => samples.findIndex((sample) => sample.stages.some((stage) => stage.title === title && stage.status.includes("진행중"))));
    expect(runningAt.every((index) => index >= 0)).toBe(true);
    expect(runningAt[0]).toBeLessThan(runningAt[1]);
    expect(runningAt[1]).toBeLessThan(runningAt[2]);
    for (let stage = 1; stage < stageTitles.length; stage++) {
      expect(samples[runningAt[stage]].stages.find((item) => item.title === stageTitles[stage - 1])?.status).toContain("완료");
    }
    expect(partials.every((sample) => sample.open && sample.stages.some((stage) => stage.title === "자료 완성중" && stage.status.includes("완료")))).toBe(true);

    await composer(page).fill("이전 요청에서 기억하라고 한 단어만 답해줘.");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(status(page)).toHaveText("completed", { timeout: 60_000 });
    await expect(threadId(page)).toHaveText(firstThread);
    await expect(chat(page).locator("article")).toHaveCount(4);
    await expect(assistants(page).last().locator("p")).toContainText("푸른구름");
    const secondState = JSON.parse(await finalState(page).innerText());
    expect(secondState.messages).toHaveLength(4);
    expect(secondState.ui).toHaveLength(8);
    expect(secondState.messages[3].id).not.toBe(assistantId);
    expect(secondState.ui.slice(4).every((ui: { metadata: { message_id: string } }) => ui.metadata.message_id === secondState.messages[3].id)).toBe(true);
    await expect(disclosure).not.toHaveAttribute("open", "");
    await expect(assistants(page).last().locator("details")).not.toHaveAttribute("open", "");
    await testInfo.attach("live-chat", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });

    await page.getByRole("button", { name: "New chat", exact: true }).click();
    await expect(chat(page).locator("article")).toHaveCount(0);
    await expect(threadId(page)).toHaveText("none");
    await expect(status(page)).toHaveText("idle");
    await composer(page).fill("안녕이라고만 답해줘.");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(status(page)).toHaveText("completed", { timeout: 60_000 });
    const newThread = await threadId(page).innerText();
    createdThreads.push(newThread);
    expect(newThread).not.toBe(firstThread);
    await expect(chat(page).locator("article")).toHaveCount(2);
    expect(runBodies).toHaveLength(3);
    for (const body of runBodies) {
      expect(body.assistant_id).toBe(graphId);
      expect(body.stream_mode).toEqual(["messages-tuple", "updates", "custom"]);
      expect(Object.keys(body.input as object)).toEqual(["messages"]);
    }
    const streamLog = page.getByRole("region", { name: "Raw Stream Events" });
    await expect(streamLog).toContainText("messages");
    const rawEvents = await streamLog.textContent();
    expect(rawEvents).toContain("generate_final_answer");
    await testInfo.attach("live-stream-events", { body: rawEvents ?? "", contentType: "text/plain" });
    expect(errors).toEqual([]);
  } finally {
    for (const id of createdThreads) expect((await request.delete(`${apiUrl}/threads/${id}`)).ok()).toBe(true);
  }
});

for (const interrupted of [false, true]) {
  test(`isolated stream fixture: ${interrupted ? "interrupted partial answer" : "text blocks, UI merge, removal and fallback"}`, async ({ page }) => {
    const assistantId = "assistant-fixture";
    const placeholder = { id: assistantId, type: "ai", content: "", additional_kwargs: { turn_status: "running" } };
    const ui = { type: "ui", name: "thinking_status", id: "work", props: { title: "작업 착수", stage: 0, total: 3, status: "running", summary: "시작", dummy: true }, metadata: { message_id: assistantId, ordinal: 0 } };
    const fallback = { ...ui, id: "fallback", name: "unknown_component", props: { content: "fallback data" } };
    const events: [string, unknown][] = [
      ["updates", { prepare_prompt: { assistant_message_id: assistantId, messages: [placeholder] } }],
      ["custom", ui], ["custom", { ...ui, id: "remove-me" }],
      ["custom", { type: "remove-ui", id: "remove-me" }], ["custom", fallback],
      ["custom", { ...ui, props: { status: interrupted ? "failed" : "completed" }, metadata: { ...ui.metadata, merge: true } }],
      ["custom", { ...ui, props: { status: "invalid" }, metadata: { ...ui.metadata, merge: true } }],
      ["messages", [{ type: "ai", content: "INTERNAL_HIDDEN" }, { langgraph_node: "search_data_llm_call_with_push_ui_message", tags: ["langsmith:nostream"] }]],
      ["messages", [{ id: "provider-id", type: "ai", content: [{ type: "text", text: "Hello " }, { type: "reasoning", text: "PRIVATE_HIDDEN" }] }, { langgraph_node: "generate_final_answer", message_id: assistantId }]],
      ["messages", [{ id: "provider-id", type: "ai", content: "world\n" }, { langgraph_node: "generate_final_answer", message_id: assistantId }]],
    ];
    if (interrupted) events.push(["updates", { generate_final_answer: { messages: [{ ...placeholder, additional_kwargs: { turn_status: "failed" } }], final_status: "failed", error: "Fixture provider interrupted" } }]);
    else events.push(["updates", { generate_final_answer: { messages: [{ ...placeholder, content: "Hello world\n", additional_kwargs: {} }], final_status: "completed" } }]);
    // Late deltas must not duplicate a completed/failed message.
    events.push(["messages", [{ type: "ai", content: "LATE_HIDDEN" }, { langgraph_node: "generate_final_answer", message_id: assistantId }]]);
    await page.route("**/threads**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/runs/stream")) return route.fulfill({ contentType: "text/event-stream", body: events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join("") });
      if (url.pathname.endsWith("/state")) return route.fulfill({ json: { values: { messages: [{ id: "user-fixture", type: "human", content: "Fixture prompt" }, { ...placeholder, content: interrupted ? "" : "Hello world\n", additional_kwargs: interrupted ? { turn_status: "failed" } : {} }], final_status: interrupted ? "failed" : "completed", error: interrupted ? "Fixture provider interrupted" : "" } } });
      return route.fulfill({ json: { thread_id: "fixture-thread" } });
    });
    await composer(page).fill("Fixture prompt");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(status(page)).toHaveText(interrupted ? "failed" : "completed");
    await expect(assistants(page)).toHaveCount(1);
    await expect(assistants(page).first()).toHaveAttribute("data-chat-message-id", assistantId);
    expect(await assistants(page).first().locator("p").textContent()).toBe("Hello world\n");
    await expect(chat(page)).not.toContainText(/INTERNAL_HIDDEN|PRIVATE_HIDDEN|LATE_HIDDEN/);
    await assistants(page).first().locator("summary").click();
    await expect(assistants(page).first().locator("li")).toHaveCount(2);
    await expect(assistants(page).first().locator("li").first()).toContainText(interrupted ? "중단" : "완료");
    await expect(assistants(page).first().locator("li").last()).toContainText("fallback data");
    if (interrupted) {
      await expect(page.getByRole("alert")).toContainText("Fixture provider interrupted");
      await expect(composer(page)).toHaveValue("Fixture prompt");
      await expect(assistants(page).first()).toContainText("응답이 중단되었습니다.");
    }
  });
}

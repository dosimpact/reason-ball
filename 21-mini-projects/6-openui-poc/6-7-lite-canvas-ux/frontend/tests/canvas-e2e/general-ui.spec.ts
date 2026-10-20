import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

test("general Intelligent UI: Lisbon renders three map stops in chat and survives reload", async ({ page }) => {
  const prompt = "Plan a relaxed afternoon exploring Lisbon, with three stops and a map";
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("textbox", { name: "채팅 메시지" }).fill(prompt);
  const responsePromise = page.waitForResponse(response => response.url().endsWith("/api/chat") && response.request().method() === "POST");
  await page.getByRole("button", { name: "메시지 보내기" }).click();
  const response = await responsePromise;
  const ui = page.getByLabel("Intelligent UI 응답");
  await expect(ui).toBeVisible({ timeout: 90000 });
  await expect(page.locator(".chat-activity")).toHaveCount(0, { timeout: 300000 });
  await expect(ui.locator(".iui-map")).toBeVisible();
  await expect(ui.locator(".maplibregl-marker")).toHaveCount(3, { timeout: 45000 });
  await expect(page.getByRole("region", { name: "리포트 Canvas" })).toHaveCount(0);
  await expect(ui.getByRole("alert")).toHaveCount(0);
  const stream = await response.text();
  expect(stream).toContain('"target":"ui"');
  expect(stream).toContain('"format":"openui"');
  expect(stream).not.toContain('"channel":"canvas"');
  expect(stream).not.toContain('"type":"UI_ERROR"');
  await page.reload();
  await expect(page.getByLabel("Intelligent UI 응답").locator(".iui-map")).toBeVisible();
  expect(errors).toEqual([]);
  mkdirSync("output/validation", { recursive: true });
  mkdirSync("output/playwright", { recursive: true });
  await page.screenshot({ path: "output/playwright/general-lisbon.png", fullPage: true });
  writeFileSync("output/validation/general-ui-sse.txt", stream);
  writeFileSync("output/validation/general-ui-result.json", JSON.stringify({ passed: true, prompt, errors, markers: 3 }, null, 2));
});

test("general UI interactions: local state and form follow-up preserve context", async ({ page }) => {
  const threadId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const program = 'root = Col([title, counter, add, form])\n$guests = 2\n$name = "Lisbon"\ntitle = Title("Interactive", "lg")\ncounter = Text("Guests: " + $guests)\nadd = Button("Add guest", @Set($guests, $guests + 1))\nform = Form([Input($name, "Name"), Button("Plan my trip", @ToAssistant("Plan my trip", {guests: $guests}))] )';
  await page.addInitScript(({ threadId, program }) => localStorage.setItem("lite-canvas:threads:v1", JSON.stringify({ selected: threadId, threads: [{ id: threadId, title: "UI interaction", messages: [{ id: "ui1", role: "assistant", format: "openui", status: "ready", content: program }] }] })), { threadId, program });
  await page.route(`**/api/threads/${threadId}/report`, route => route.fulfill({ json: { report: null } }));
  let payload: { message: string } | undefined;
  await page.route("**/api/chat", route => {
    payload = route.request().postDataJSON();
    return route.fulfill({ contentType: "text/event-stream", body: 'event: custom\ndata: {"channel":"chat","type":"message","content":"Follow-up received"}\n\n' });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Add guest", exact: true }).click();
  await expect(page.getByLabel("Intelligent UI 응답")).toContainText("Guests: 3");
  await page.getByRole("button", { name: "Plan my trip", exact: true }).click();
  await expect(page.locator(".chat-message.assistant").last()).toContainText("Follow-up received");
  expect(payload?.message).toContain("Lisbon");
  expect(payload?.message).toContain('"guests":3');
  await expect(page.locator(".chat-message.user")).toContainText("Plan my trip");
  await expect(page.locator(".chat-message.user")).not.toContainText("openui:context");
});

import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

test("real supplier report: streamed Canvas, quote, publish, PDF, regenerate and restore", async ({ page, browser, request }) => {
  mkdirSync("output/validation", { recursive: true });
  mkdirSync("output/pdf", { recursive: true });
  mkdirSync("output/playwright", { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const exchanges: { request: Record<string, unknown>; response: string }[] = [];
  page.on("response", async response => {
    if (response.url().endsWith("/api/chat")) {
      try { exchanges.push({ request: response.request().postDataJSON(), response: await response.text() }); writeFileSync("output/validation/browser-exchanges.json", JSON.stringify(exchanges, null, 2)); } catch { /* Request error is asserted through the UI. */ }
    }
  });
  await page.goto("/");
  await page.getByRole("button", { name: "공급업체1 리포트 생성해줘", exact: true }).click();
  const canvas = page.getByRole("region", { name: "리포트 Canvas" });
  await expect(canvas).toBeVisible({ timeout: 60000 });
  await expect(canvas).toHaveAttribute("data-status", /generating|validating|reviewing|repairing/);
  const firstId = await canvas.getAttribute("data-report-id");
  await expect(canvas).toHaveAttribute("data-status", /ready|error/, { timeout: 600000 });
  await expect(canvas).toHaveAttribute("data-status", "ready");
  await expect(page.getByRole("button", { name: "PDF 저장" })).toBeEnabled();
  expect(await canvas.locator(".iui-chart svg").count()).toBeGreaterThanOrEqual(3);
  expect(await canvas.locator("table").count()).toBeLessThanOrEqual(2);
  await expect(canvas).toContainText("원문 수치");
  const beforeFilter = await canvas.locator(".iui-chart").allTextContents();
  const radios = canvas.getByRole("radio");
  if (await radios.count() > 1) await radios.nth(1).click();
  else {
    const select = canvas.getByRole("combobox").first();
    const value = await select.locator("option").nth(1).getAttribute("value");
    await select.selectOption(value!);
  }
  await expect.poll(async () => JSON.stringify(await canvas.locator(".iui-chart").allTextContents())).not.toBe(JSON.stringify(beforeFilter));
  await page.screenshot({ path: "output/playwright/live-filtered-canvas.png" });

  // Actual mouse selection of rendered report text, followed by the visible quote action.
  const heading = canvas.getByRole("article", { name: "리포트 본문" }).getByRole("heading").first();
  await heading.scrollIntoViewIfNeeded();
  const box = (await heading.boundingBox())!;
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + Math.min(box.width - 3, 360), box.y + box.height / 2, { steps: 14 });
  await page.mouse.up();
  await page.getByRole("button", { name: "채팅에 물어보기" }).click();
  await expect(page.getByLabel("질문할 인용")).toBeVisible();
  const quoteText = await page.getByLabel("질문할 인용").innerText();
  await page.getByRole("textbox", { name: "채팅 메시지" }).fill("이 부분의 핵심 성과와 원문 수치 충돌을 구체적인 숫자로 설명해줘. 리포트는 다시 만들지 마.");
  await page.getByRole("button", { name: "메시지 보내기" }).click();
  await expect(page.getByLabel("인용된 리포트")).toContainText(quoteText.trim());
  await expect.poll(async () => page.locator(".chat-message.assistant").last().innerText(), { timeout: 120000 }).toContain("원");
  await expect(page.locator(".chat-activity")).toHaveCount(0, { timeout: 120000 });
  await expect(canvas).toHaveAttribute("data-report-id", firstId!);
  const storage = JSON.parse((await page.evaluate(() => localStorage.getItem("lite-canvas:threads:v1")))!);
  const threadId = storage.selected;
  const graphState = await (await request.get(`http://127.0.0.1:2040/threads/${threadId}/state`)).json();
  expect(graphState.values.report.id).toBe(firstId);
  expect(graphState.values.quote.reportId).toBe(firstId);
  expect(graphState.values.quote.text.trim()).toBe(quoteText.trim());
  expect(graphState.values.report.source_text).toContain("8,000,000");
  writeFileSync("output/validation/quote-state.json", JSON.stringify({ threadId, reportId: graphState.values.report.id, quote: graphState.values.quote, answer: graphState.values.messages.at(-1).content }, null, 2));

  await page.getByRole("button", { name: "공유 링크", exact: true }).click();
  const shareLink = canvas.locator('.share-notice a');
  await expect(shareLink).toHaveAttribute("href", new RegExp(`/reports/${firstId}$`));
  const sharedContext = await browser.newContext();
  const shared = await sharedContext.newPage();
  await shared.goto((await shareLink.getAttribute("href"))!);
  await expect(shared.getByRole("article", { name: "리포트 본문" })).toContainText("공급업체1");
  expect(await shared.locator(".iui-chart svg").count()).toBeGreaterThanOrEqual(3);
  await expect(shared.getByRole("textbox", { name: "채팅 메시지" })).toHaveCount(0);
  await shared.evaluate(() => { window.print = () => { document.documentElement.dataset.printCalled = "true"; }; });
  await shared.getByRole("button", { name: "PDF 저장" }).click();
  await expect(shared.locator("html")).toHaveAttribute("data-print-called", "true");
  await shared.emulateMedia({ media: "print" });
  await shared.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  await shared.pdf({ path: "output/pdf/supplier-report.pdf", format: "A4", printBackground: true, preferCSSPageSize: true });
  await shared.screenshot({ path: "output/playwright/shared-report-print.png", fullPage: true });
  await sharedContext.close();

  await page.getByRole("textbox", { name: "채팅 메시지" }).fill("리포트 다시 만들어줘");
  await page.getByRole("button", { name: "메시지 보내기" }).click();
  await expect(canvas).not.toHaveAttribute("data-report-id", firstId!, { timeout: 60000 });
  const secondId = await canvas.getAttribute("data-report-id");
  expect((await request.get(`/api/reports/${firstId}`)).status()).toBe(404);
  await expect(canvas).toHaveAttribute("data-status", /ready|error/, { timeout: 600000 });
  await expect(canvas).toHaveAttribute("data-status", "ready");
  await expect(page.getByRole("region", { name: "리포트 Canvas" })).toHaveCount(1);
  await expect(page.locator(".chat-activity")).toHaveCount(0);
  const current = await (await request.get(`/api/threads/${threadId}/report`)).json();
  expect(current.report.id).toBe(secondId);
  const stateAfter = await (await request.get(`http://127.0.0.1:2040/threads/${threadId}/state`)).json();
  expect(stateAfter.values.report.id).toBe(secondId);
  expect(stateAfter.values.quote).toBeNull();
  await page.getByRole("button", { name: "공유 링크", exact: true }).click();
  await expect(canvas.locator('.share-notice a')).toHaveAttribute("href", new RegExp(`/reports/${secondId}$`));

  await page.getByRole("button", { name: "새 대화", exact: true }).click();
  await expect(page.getByRole("region", { name: "리포트 Canvas" })).toHaveCount(0);
  await page.getByRole("textbox", { name: "채팅 메시지" }).fill("어떤 공급업체 자료가 있어?");
  await page.getByRole("button", { name: "메시지 보내기" }).click();
  await expect(page.locator(".chat-message.assistant")).toContainText("공급업체", { timeout: 90000 });
  await expect(page.locator(".chat-activity")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "리포트 Canvas" })).toHaveCount(0);
  await page.getByRole("navigation", { name: "대화 목록" }).getByRole("button", { name: "공급업체1 리포트 생성해줘", exact: true }).click();
  await expect(page.getByRole("region", { name: "리포트 Canvas" })).toHaveAttribute("data-report-id", secondId!);
  await page.reload();
  await expect(page.getByRole("region", { name: "리포트 Canvas" })).toHaveAttribute("data-report-id", secondId!);
  await expect(page.getByLabel("인용된 리포트")).toBeVisible();
  await page.screenshot({ path: "output/playwright/live-final-workspace.png" });
  expect(errors).toEqual([]);
  const generation = exchanges.find(e => e.request.message === "공급업체1 리포트 생성해줘")!;
  expect(generation.response).toContain('"target":"generate"');
  expect(generation.response).toContain("custom|report_subagent:");
  expect(generation.response.indexOf('"type":"open"')).toBeLessThan(generation.response.indexOf('"type":"TEXT_MESSAGE_CONTENT"'));
  writeFileSync("output/validation/browser-exchanges.json", JSON.stringify(exchanges, null, 2));
  writeFileSync("output/validation/lifecycle-result.json", JSON.stringify({ threadId, firstId, secondId, errors, shareUrl: `http://127.0.0.1:3048/reports/${secondId}`, passed: true }, null, 2));
});

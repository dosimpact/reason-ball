import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

test("supplier source UI and PDF-mode report use separate channels", async ({ page, browser, request }) => {
  mkdirSync("output/validation", { recursive: true });
  mkdirSync("output/pdf", { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const exchanges: string[] = [];
  page.on("response", async response => {
    if (response.url().endsWith("/api/chat")) {
      exchanges.push(await response.text());
      writeFileSync("output/validation/pdf-supplier-exchanges.json", JSON.stringify(exchanges));
    }
  });
  await page.goto("/");
  const input = page.getByRole("textbox", { name: "채팅 메시지" });
  const send = page.getByRole("button", { name: "메시지 보내기" });
  await input.fill("공급업체1의 W1과 W2 광고 매출을 원문 근거와 함께 비교해줘. 수치 모순도 설명해줘.");
  await send.click();
  await expect(page.getByLabel("Intelligent UI 응답")).toBeVisible({ timeout: 60000 });
  await expect(page.locator(".chat-activity")).toHaveCount(0, { timeout: 240000 });
  await expect(page.getByLabel("Intelligent UI 응답")).toContainText("9,000,000");
  await expect(page.getByRole("region", { name: "리포트 Canvas" })).toHaveCount(0);
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
  const threadId = await page.evaluate(() => JSON.parse(localStorage.getItem("lite-canvas:threads:v1")!).selected);
  const firstState = await (await request.get(`http://127.0.0.1:2040/threads/${threadId}/state`)).json();
  expect(firstState.values.decision.action).toBe("supplier_ui");
  expect(firstState.values.supplier_context.name).toBe("공급업체1");
  expect(firstState.values.report).toBeNull();

  await input.fill("공급업체1 PDF 보고서용으로 리포트 만들어줘. 탭이나 필터 없이 모든 캠페인과 주요 수치를 바로 볼 수 있게 해줘.");
  await send.click();
  const canvas = page.getByRole("region", { name: "리포트 Canvas" });
  await expect(canvas).toBeVisible({ timeout: 60000 });
  await expect(canvas).toHaveAttribute("data-report-mode", "pdf");
  await expect(canvas).toHaveAttribute("data-status", /ready|error/, { timeout: 600000 });
  await expect(canvas).toHaveAttribute("data-status", "ready");
  const reportId = await canvas.getAttribute("data-report-id");
  const article = canvas.getByRole("article", { name: "리포트 본문" });
  expect(await article.locator(".iui-chart svg").count()).toBeGreaterThanOrEqual(3);
  await expect(article.locator("input, select, button, [role=tab], [role=radio], details")).toHaveCount(0);
  await expect(article).toContainText("CAMP_003");
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "공유 링크", exact: true }).click();
  const link = canvas.locator(".share-notice a");
  await expect(link).toHaveAttribute("href", new RegExp(`/reports/${reportId}$`));
  const context = await browser.newContext();
  const shared = await context.newPage();
  await shared.goto((await link.getAttribute("href"))!);
  await expect(shared.locator('[data-report-mode="pdf"]')).toBeVisible();
  await shared.emulateMedia({ media: "print" });
  await shared.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  await shared.pdf({ path: "output/pdf/static-supplier-report.pdf", format: "A4", printBackground: true, preferCSSPageSize: true });
  await shared.screenshot({ path: "output/validation/static-supplier-report.png", fullPage: true });
  await context.close();

  await input.fill("그 업체의 재고 위험에서 우선 확인할 상품은 뭐야? 근거를 보여줘.");
  await send.click();
  await expect(page.getByLabel("Intelligent UI 응답")).toHaveCount(2, { timeout: 60000 });
  await expect(page.locator(".chat-activity")).toHaveCount(0, { timeout: 240000 });
  await expect(canvas).toHaveAttribute("data-report-id", reportId!);
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
  const finalState = await (await request.get(`http://127.0.0.1:2040/threads/${threadId}/state`)).json();
  expect(finalState.values.decision.action).toBe("supplier_ui");
  expect(finalState.values.report.report_mode).toBe("pdf");
  expect(errors).toEqual([]);
  expect(exchanges[0]).toContain('"target":"supplier_ui"');
  expect(exchanges[0]).not.toContain('"channel":"canvas"');
  writeFileSync("output/validation/pdf-supplier-result.json", JSON.stringify({ threadId, reportId, errors, passed: true }, null, 2));
});

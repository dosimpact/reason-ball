import { test, expect } from "@playwright/test";
import { exampleVendorReport } from "../../src/reporting/prompt-options";

// Deterministic browser regressions. Live provider cases are intent-routing.spec.ts.
test("report controls and selected chat survive reload (catalog fixture)", async ({ page }) => {
  await page.route("**/api/chat", (route) => route.fulfill({
    contentType: "text/event-stream; charset=utf-8",
    body: [{ type: "RUN_STARTED", runId: "fixture", threadId: "fixture" },
      { type: "TEXT_MESSAGE_START", messageId: "fixture", role: "assistant" },
      { type: "TEXT_MESSAGE_CONTENT", messageId: "fixture", delta: exampleVendorReport },
      { type: "TEXT_MESSAGE_END", messageId: "fixture" },
      { type: "RUN_FINISHED", runId: "fixture", threadId: "fixture" }]
      .map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
  }));
  await page.goto("/");
  await page.getByRole("button", { name: "보고서 만들기", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "문서로 보고서 만들기" });
  await dialog.getByLabel("분석 문서 선택").setInputFiles({ name: "fixture.md", mimeType: "text/markdown", buffer: Buffer.from("UI 계약 회귀 테스트용 문서") });
  await dialog.getByRole("button", { name: "인터랙티브 보고서 생성" }).click();
  await expect(page.getByRole("radio")).toHaveCount(0);
  for (const name of ["캠페인 탐색", "재고 위험", "실행 체크리스트", "원문 근거"]) {
    await expect(page.getByRole("heading", { name, exact: true })).toBeAttached();
  }
  await page.locator(".iui-pressable").first().click();
  await expect(page.locator(".iui-pressable").first()).toHaveClass(/is-selected/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("oiu:selected-thread"))).not.toBeNull();
  await page.reload();
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(page.locator(".iui-pressable").first()).toHaveClass(/is-selected/);
  await page.getByRole("button", { name: "New chat", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "What can I help with?" })).toBeVisible();
});

test("HTML is text evidence; scripts and missing/oversized documents do not run", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "보고서 만들기", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "문서로 보고서 만들기" });
  const input = dialog.getByLabel("분석 문서 선택");
  await input.setInputFiles({ name: "empty.md", mimeType: "text/markdown", buffer: Buffer.from(" ") });
  await expect(dialog.getByRole("alert")).toContainText("본문");
  await expect(dialog.getByRole("button", { name: "인터랙티브 보고서 생성" })).toBeDisabled();
  await input.setInputFiles({ name: "large.md", mimeType: "text/markdown", buffer: Buffer.alloc(500_001) });
  await expect(dialog.getByRole("alert")).toContainText("500KB");
  await input.setInputFiles({ name: "source.html", mimeType: "text/html", buffer: Buffer.from('<article><h2>원문</h2><script>window.__htmlExecuted = true</script><table><tr><th>지표</th><th>값</th></tr><tr><td>매출</td><td>123원</td></tr></table></article>') });
  await expect(dialog.getByRole("status")).toContainText("source.html");
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__htmlExecuted)).toBeUndefined();
  const request = page.waitForRequest("**/api/chat");
  await page.route("**/api/chat", (route) => route.fulfill({ status: 503 }));
  await dialog.getByRole("button", { name: "인터랙티브 보고서 생성" }).click();
  const data = (await request).postDataJSON();
  expect(data.messages[0].content).toContain("| 매출 | 123원 |");
  expect(data.messages[0].content).not.toContain("__htmlExecuted");
});

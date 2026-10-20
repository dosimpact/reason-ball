import { test, expect } from "@playwright/test";

const threadId = "33333333-3333-4333-8333-333333333333";
const report = { id: "44444444-4444-4444-8444-444444444444", title: "Splitter 리포트", vendor: "공급업체1", source_file: "fixture.md", program: 'root = Col([Title("크기 조절 확인", "lg"), Text("같은 리포트를 유지합니다.")])', status: "ready", published: false, created_at: "2026-10-20" };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(threadId => localStorage.setItem("lite-canvas:threads:v1", JSON.stringify({ selected: threadId, threads: [{ id: threadId, title: "Splitter", messages: [{ id: "m", role: "user", content: "리포트" }] }] })), threadId);
  await page.route(`**/api/threads/${threadId}/report`, route => route.fulfill({ json: { report } }));
});

test("desktop splitter drags, clamps, persists and remains keyboard accessible", async ({ page }) => {
  await page.goto("/");
  const splitter = page.getByRole("separator", { name: "채팅과 Canvas 크기 조절" });
  const chat = page.getByRole("region", { name: "채팅", exact: true });
  const canvas = page.getByRole("region", { name: "리포트 Canvas" });
  await expect(splitter).toHaveAttribute("aria-orientation", "vertical");
  const before = (await chat.boundingBox())!.width;
  const canvasBefore = (await canvas.boundingBox())!.width;
  const box = (await splitter.boundingBox())!;
  await page.mouse.move(box.x + 4, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 184, box.y + 200, { steps: 10 });
  await page.mouse.up();
  const resized = (await chat.boundingBox())!.width;
  expect(resized).toBeGreaterThan(before + 150);
  expect((await canvas.boundingBox())!.width).toBeLessThan(canvasBefore - 150);
  await page.reload();
  await expect(splitter).toHaveAttribute("aria-valuenow", String(resized));
  await splitter.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(splitter).toHaveAttribute("aria-valuenow", String(resized - 20));
  await page.keyboard.press("End");
  expect((await canvas.boundingBox())!.width).toBeGreaterThanOrEqual(320);
  await page.keyboard.press("Home");
  await expect(splitter).toHaveAttribute("aria-valuenow", "300");
  await splitter.dblclick();
  await expect(splitter).toHaveAttribute("aria-valuenow", "360");
  await page.setViewportSize({ width: 800, height: 900 });
  expect((await canvas.boundingBox())!.width).toBeGreaterThanOrEqual(320);
  await page.getByRole("button", { name: "Canvas 닫기" }).click();
  await expect(splitter).toHaveCount(0);
  await page.getByRole("button", { name: "Canvas 열기" }).click();
  await expect(canvas).toHaveAttribute("data-report-id", report.id);
  await expect(splitter).toBeVisible();
  await page.screenshot({ path: "output/playwright/splitter-desktop.png" });
});

test("mobile splitter adjusts vertical space and is hidden in print", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const splitter = page.getByRole("separator", { name: "채팅과 Canvas 크기 조절" });
  await expect(splitter).toHaveAttribute("aria-orientation", "horizontal");
  const before = Number(await splitter.getAttribute("aria-valuenow"));
  const box = (await splitter.boundingBox())!;
  await page.mouse.move(box.x + 100, box.y + 4);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 84, { steps: 8 });
  await page.mouse.up();
  expect(Number(await splitter.getAttribute("aria-valuenow"))).toBeGreaterThan(before + 60);
  await splitter.focus();
  await page.keyboard.press("ArrowUp");
  const now = Number(await splitter.getAttribute("aria-valuenow"));
  await page.reload();
  await expect(splitter).toHaveAttribute("aria-valuenow", String(now));
  await page.screenshot({ path: "output/playwright/splitter-mobile.png" });
  await page.emulateMedia({ media: "print" });
  await expect(splitter).toBeHidden();
});

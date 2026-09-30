import { expect, test } from "@playwright/test";
import { installCleanAppState } from "./test-setup";

for (const { width, height } of [{ width: 1280, height: 800 }, { width: 360, height: 800 }, { width: 360, height: 640 }]) test(`LEARN-04 previews step hints without changing progress or replacing drafts at ${width}x${height}`, async ({ page }, testInfo) => {
  await installCleanAppState(page);
  await page.setViewportSize({ width, height });
  let progressWrites = 0;
  let chatWrites = 0;
  page.on("request", (request) => {
    if (request.method() === "PATCH" && request.url().endsWith("/progress")) progressWrites++;
    if (request.method() === "POST" && request.url().endsWith("/api/ai/chat")) chatWrites++;
  });
  const started = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/mission-runs");
  await page.goto("/chat/mia-hotelier?mission=hotel-check-in");
  const { run } = await (await started).json();
  await page.getByRole("button", { name: "단계별 힌트 열기" }).click();
  await expect(page.getByTestId("mission-step-hint")).toHaveText("I have a reservation under...");
  const input = page.getByTestId("chat-input");
  await input.fill("Keep my draft");
  await page.getByLabel("연습할 단계").selectOption("passport");
  await expect(page.getByTestId("mission-step-hint")).toHaveText("Here is my passport.");
  await page.getByRole("button", { name: "힌트를 입력창에 덧붙이기" }).click();
  await expect(input).toHaveValue("Keep my draft\nHere is my passport.");
  if (width === 360) {
    const inputBox = await input.boundingBox();
    const navBox = await page.getByRole("navigation", { name: "하단 메뉴" }).boundingBox();
    expect(inputBox).not.toBeNull();
    expect(navBox).not.toBeNull();
    expect(inputBox!.y).toBeGreaterThan(0);
    expect(inputBox!.y + inputBox!.height).toBeLessThan(navBox!.y);
  }
  await page.screenshot({ path: testInfo.outputPath("step-hint.png"), fullPage: true });
  await page.getByLabel("연습할 단계").selectOption("");
  await expect(page.getByTestId("mission-step-hint")).toHaveText("I have a reservation under...");
  expect(progressWrites).toBe(0);
  expect(chatWrites).toBe(0);
  // Change the mock server state deliberately; the hint UI itself never writes progress.
  const update = await page.request.patch(`/api/mission-runs/${run.id}/progress`, { data: { stepId: "reservation", status: "completed" } });
  expect(update.ok()).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "단계별 힌트 열기" }).click();
  await expect(page.getByTestId("mission-step-hint")).toHaveText("Here is my passport.");
  await expect(input).toHaveValue("Keep my draft\nHere is my passport.");
  await page.getByRole("button", { name: "단계별 힌트 접기" }).click();
  await input.fill("/hint");
  await input.press("Enter");
  await expect(page.getByTestId("mission-step-hint")).toHaveText("Here is my passport.");
  expect(chatWrites).toBe(0);
});

test("LEARN-04 does not substitute another hint when the run and definitions disagree", async ({ page }) => {
  await installCleanAppState(page);
  await page.route("**/api/mission-runs*", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const response = await route.fetch();
    const payload = await response.json();
    payload.run.steps[0].id = "unmapped-step";
    await route.fulfill({ response, json: payload });
  });
  await page.goto("/chat/mia-hotelier?mission=hotel-check-in");
  await page.getByRole("button", { name: "단계별 힌트 열기" }).click();
  await expect(page.getByTestId("mission-guidance")).toContainText("실행 단계와 힌트를 연결하지 못했어요.");
  await expect(page.getByRole("button", { name: "힌트를 입력창에 덧붙이기" })).toHaveCount(0);
  await page.getByTestId("chat-input").fill("Keep this draft");
  await page.getByRole("button", { name: "단계 정보 다시 불러오기" }).click();
  await expect(page.getByTestId("mission-step-hint")).toHaveText("I have a reservation under...");
  await expect(page.getByTestId("chat-input")).toHaveValue("Keep this draft");
});

import { test, expect } from "@playwright/test";

const threadId = "11111111-1111-4111-8111-111111111111";
const reportId = "22222222-2222-4222-8222-222222222222";
const report = { id: reportId, title: "복원 테스트 리포트", vendor: "공급업체1", source_file: "fixture.md", program: 'root = Col([Title("복원된 리포트", "lg"), Text("서버의 최신 리포트입니다.")])', status: "ready", published: false, created_at: "2026-10-20" };

test("recovery: reload during generation polls the same report until ready", async ({ page }) => {
  await page.addInitScript(({ threadId }) => localStorage.setItem("lite-canvas:threads:v1", JSON.stringify({ threads: [{ id: threadId, title: "복원 테스트", messages: [{ id: "m1", role: "user", content: "리포트를 생성해줘" }] }], selected: threadId })), { threadId });
  let requests = 0;
  await page.route(`**/api/threads/${threadId}/report`, route => {
    requests += 1;
    return route.fulfill({ json: { report: requests < 3 ? { ...report, program: "", status: "generating" } : report } });
  });
  await page.goto("/");
  const canvas = page.getByRole("region", { name: "리포트 Canvas" });
  await expect(canvas).toHaveAttribute("data-status", "generating");
  await expect(page.getByRole("button", { name: "PDF 저장" })).toBeDisabled();
  await expect(canvas).toHaveAttribute("data-status", "ready");
  await expect(canvas).toContainText("복원된 리포트");
  await expect(canvas).toHaveAttribute("data-report-id", reportId);
  await expect(page.getByRole("button", { name: "PDF 저장" })).toBeEnabled();
  expect(requests).toBeGreaterThanOrEqual(3);
  await page.getByRole("button", { name: "Canvas 닫기" }).click();
  await expect(canvas).toHaveCount(0);
  await page.getByRole("button", { name: "Canvas 열기" }).click();
  await expect(canvas).toHaveAttribute("data-report-id", reportId);
  await page.getByRole("button", { name: "새 대화", exact: true }).click();
  await expect(canvas).toHaveCount(0);
});

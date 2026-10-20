import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { createParser } from "@openuidev/lang-core";
import spec from "../../src/generated/spec.json";
import { reportProblems } from "../../src/reporting/validate-report";

async function send(page: Page, text: string, mode: "chat" | "report", info: TestInfo) {
  const input = page.getByRole("textbox", { name: "Ask anything...", exact: true });
  await input.fill(text);
  const pending = page.waitForResponse(response => response.url().endsWith("/api/chat") && response.request().method() === "POST", { timeout: 90_000 });
  await input.press("Enter");
  const response = await pending;
  const stream = await response.text();
  await info.attach(`${mode}-${Date.now()}.sse`, { body: stream, contentType: "text/plain" });
  expect(response.status(), stream.slice(0, 500)).toBe(200);
  expect(response.headers()["x-ui-intent"]).toBe(mode);
  const events = stream.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => JSON.parse(line.slice(5)));
  expect(events.find(event => event.type === "RUN_ERROR")).toBeUndefined();
  expect(events.at(-1)?.type).toBe("RUN_FINISHED");
  const program = events.filter(event => event.type === "TEXT_MESSAGE_CONTENT").map(event => event.delta).join("");
  const parsed = createParser(spec.schema, spec.root).parse(program);
  expect(parsed.meta.errors).toEqual([]);
  expect(parsed.meta.unresolved).toEqual([]);
  if (mode === "report") {
    expect(reportProblems(program, undefined, "general")).toEqual([]);
    expect(events.find(event => event.type === "CUSTOM" && event.name === "report_generation")?.value.strategy).toBe("model_report");
  }
  const last = page.locator(".openui-shell-thread-message-assistant").last();
  await expect(last).toBeVisible();
  if (mode === "report") await expect(last.getByRole("heading").first()).toBeVisible();
  return { program, source: response.headers()["x-ui-intent-source"], last };
}

test("Lisbon ordinary UI → contextual report → narrow follow-up are model-routed", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  const ordinary = await send(page, "Plan a relaxed afternoon exploring Lisbon, with three stops and a map", "chat", info);
  expect(ordinary.source).toBe("none");
  expect(ordinary.program).toMatch(/\bMap\(/);
  await expect(ordinary.last.getByRole("region", { name: "Map", exact: true }).first()).toBeVisible();
  const report = await send(page, "방금 일정을 한국어 여행 검토 보고서로 바꿔줘. 요약, 세 장소별 일정, 이동 계획, 주의사항을 탭 없이 이어서 작성하고 지도도 포함해줘. 실시간 가격이나 운영 시간을 확인했다고 주장하지 마.", "report", info);
  expect(report.source).toBe("history");
  expect(report.program).toMatch(/\bMap\(/);
  expect(report.program).not.toMatch(/CAMP_|\bSlider\(/);
  expect(await report.last.getByRole("heading").count()).toBeGreaterThanOrEqual(3);
  await report.last.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("travel-report.png"), fullPage: true });
  await send(page, "위 보고서에 있는 추천 일정의 한계를 두 문장으로만 설명해줘. 보고서를 다시 작성하지는 마.", "chat", info);
  expect(errors).toEqual([]);
});

test("short non-vendor source becomes a report without vendor UI requirements", async ({ page }, info) => {
  await page.goto("/");
  const result = await send(page, "아래 프로젝트 현황을 팀장에게 공유할 보고서로 정리해줘. A작업: 완료. B작업: 지연(담당자 확인 필요). C작업: 다음 주 진행 예정. 요약, 진행 상태, 위험 및 다음 조치를 설명해줘. 없는 수치는 만들지 마.", "report", info);
  expect(result.source).toBe("latest");
  expect(result.program).toContain("지연");
  expect(result.program).not.toMatch(/CAMP_|\bSlider\(/);
  await page.reload();
  await expect(page.locator(".openui-shell-thread-message-assistant").last().getByRole("heading").first()).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".openui-agent-thread-scroll-area")).toHaveCSS("overflow", "visible");
  await page.emulateMedia({ media: "screen" });
});

test("a non-vendor text upload uses topic-appropriate report generation", async ({ page }, info) => {
  await page.goto("/");
  await page.getByRole("button", { name: "보고서 만들기", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "문서로 보고서 만들기" });
  await dialog.getByLabel("분석 문서 선택").setInputFiles({ name: "project-status.txt", mimeType: "text/plain", buffer: Buffer.from("프로젝트 현황: A작업 완료. B작업 지연으로 담당자 확인 필요. C작업 다음 주 진행 예정.") });
  const pending = page.waitForResponse(response => response.url().endsWith("/api/chat") && response.request().method() === "POST");
  await dialog.getByRole("button", { name: "인터랙티브 보고서 생성" }).click();
  const response = await pending;
  const stream = await response.text();
  await info.attach("text-upload.sse", { body: stream, contentType: "text/plain" });
  expect(response.headers()["x-ui-intent"]).toBe("report");
  expect(response.headers()["x-ui-intent-source"]).toBe("latest");
  const events = stream.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => JSON.parse(line.slice(5)));
  expect(events.at(-1)?.type).toBe("RUN_FINISHED");
  expect(events.find(event => event.type === "CUSTOM")?.value.strategy).toBe("model_report");
  const program = events.filter(event => event.type === "TEXT_MESSAGE_CONTENT").map(event => event.delta).join("");
  expect(reportProblems(program, undefined, "general")).toEqual([]);
  expect(program).not.toMatch(/CAMP_|\bSlider\(/);
  await expect(page.locator(".openui-shell-thread-message-assistant").getByRole("heading").first()).toBeVisible();
});

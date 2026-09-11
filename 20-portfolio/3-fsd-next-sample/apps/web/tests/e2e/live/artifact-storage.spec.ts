import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { adminClient, expect, signIn, test } from "./fixtures";

const origin = "http://dodonet.iptime.org:13000";

async function openWorkspace(page: Page, mobile = false) {
  if (mobile) await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /외우지 말고/ })).toBeVisible();
  await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
  if (mobile) {
    await page.getByRole("button", { name: "메뉴 열기", exact: true }).click();
    await page.getByRole("navigation", { name: "모바일 메뉴", exact: true })
      .getByRole("button", { name: "새 채팅", exact: true }).click();
  } else {
    await page.getByRole("button", { name: "새 채팅", exact: true }).click();
  }
  await expect(page.getByRole("textbox", { name: "영어 메시지" })).toBeEnabled();
  const conversation = await page.getByTestId("chat-workspace").getAttribute("data-conversation-id");
  expect(conversation).toMatch(/^[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "Artifact 열기" }).click();
  const dialog = page.getByRole("dialog", { name: "Artifact workspace", exact: true });
  await expect(dialog).toBeVisible();
  return { dialog, conversation };
}

async function versions(id: string) {
  const result = await adminClient().from("artifact_versions")
    .select("id,version_number,content_text").eq("artifact_id", id).order("version_number");
  expect(result.error).toBeNull();
  return result.data!;
}

// ART-01/02/03: manually authored text/code/sheet artifacts use real Auth, API,
// version records and reloads. These tests do not claim AI-generated content.
for (const { kind, mobile } of [
  { kind: "Text", mobile: false }, { kind: "Code", mobile: false },
  { kind: "Sheet", mobile: false }, { kind: "Code", mobile: true },
] as const) {
  test(`ART-${kind}${mobile ? " mobile360" : ""} manual creation, autosave, version restore and private access survive reload`, async ({ page, account, playwright, createAccount }) => {
    test.setTimeout(180_000);
    const { dialog, conversation } = await openWorkspace(page, mobile);
    const creation = page.waitForResponse(response => new URL(response.url()).pathname === "/api/artifacts" && response.request().method() === "POST");
    await dialog.getByRole("button", { name: `${kind} artifact 만들기`, exact: true }).click();
    const response = await creation;
    expect(response.ok(), await response.text()).toBe(true);
    const id = (await response.json()).item.id as string;
    const initial = await versions(id);
    expect(initial).toHaveLength(1);
    const baseline = initial[0].content_text!;
    const title = `${kind} practice ${randomUUID()}`;
    const editor = dialog.getByLabel("Artifact 내용", { exact: true });
    const saved = dialog.getByTestId("artifact-autosave-status");
    await dialog.getByLabel("Artifact 제목", { exact: true }).fill(title);
    await expect(saved).toHaveText("모든 변경사항 저장됨");
    const content = kind === "Code" ? "6 * 7" : kind === "Sheet" ? "Expression,Meaning\nHello,안녕하세요\nThank you,감사합니다" : `Private practice note ${randomUUID()}`;
    await editor.fill(content);
    await expect(saved).toHaveText("모든 변경사항 저장됨");
    await expect.poll(async () => (await versions(id)).at(-1)?.content_text).toBe(content);
    const owned = await adminClient().from("artifacts").select("owner_id,conversation_id,title,kind").eq("id", id).single();
    expect(owned.error).toBeNull();
    expect(owned.data).toEqual({ owner_id: account!.id, conversation_id: conversation, title, kind: kind.toLowerCase() });

    if (kind === "Code") {
      await dialog.getByRole("button", { name: "안전 실행", exact: true }).click();
      await expect(dialog.getByTestId("code-output")).toHaveText("42");
    }
    if (kind === "Sheet") {
      await dialog.getByLabel("셀 2-1", { exact: true }).fill("  Hello  ");
      await dialog.getByRole("button", { name: "데이터 정리", exact: true }).click();
      await expect(dialog.getByLabel("셀 2-1", { exact: true })).toHaveValue("Hello");
      await dialog.getByRole("button", { name: "표 크기 확인", exact: true }).click();
      await expect(dialog.getByTestId("sheet-analysis")).toContainText("2개 데이터 행");
      await expect(saved).toHaveText("모든 변경사항 저장됨");
      const download = page.waitForEvent("download");
      await dialog.getByRole("link", { name: "CSV 다운로드" }).click();
      expect((await download).suggestedFilename()).toBe(`${title}.csv`);
    }
    if (mobile) {
      const bounds = await dialog.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(360);
      expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    }
    const before = await versions(id);
    await dialog.getByRole("button", { name: "새 버전 저장", exact: true }).click();
    await expect.poll(async () => (await versions(id)).length).toBe(before.length + 1);
    await expect(saved).toHaveText("모든 변경사항 저장됨");
    await dialog.getByRole("button", { name: "버전 1 복원", exact: true }).click();
    await expect(editor).toHaveValue(baseline);
    await expect(saved).toHaveText("모든 변경사항 저장됨");
    const restored = await versions(id);
    expect(restored.length).toBe(before.length + 2);
    expect(restored.at(-1)?.content_text).toBe(baseline);
    expect(restored[0]).toEqual(initial[0]);
    await dialog.getByRole("button", { name: "Artifact 닫기", exact: true }).click();
    await page.reload();
    await expect(page.getByTestId("chat-workspace")).toHaveAttribute("data-conversation-id", conversation!);
    await page.getByRole("button", { name: "Artifact 열기", exact: true }).click();
    await expect(dialog.getByLabel("Artifact 제목", { exact: true })).toHaveValue(title);
    await expect(editor).toHaveValue(baseline);
    await expect(dialog.getByRole("button", { name: `버전 ${restored.length} 복원`, exact: true })).toBeVisible();

    const other = await playwright.request.newContext({ baseURL: origin });
    try {
      await signIn(other, await createAccount());
      expect([403, 404]).toContain((await other.get(`/api/artifacts/${id}`)).status());
      const rejected = await other.post(`/api/artifacts/${id}/versions`, {
        headers: { Origin: origin }, data: { requestId: randomUUID(), expectedVersionId: restored.at(-1)!.id,
          title: "Unauthorized edit", contentText: "Must never be stored", contentJson: {}, status: "draft" },
      });
      expect([403, 404]).toContain(rejected.status());
      expect(await versions(id)).toEqual(restored);
    } finally { await other.dispose(); }
  });
}

// ART-CODE-ISOLATION: browser worker + actual VM, with source persisted normally.
test("ART-Code isolated execution rejects host access, bounds infinite loops and recovers", async ({ page }) => {
  test.setTimeout(180_000);
  const { dialog } = await openWorkspace(page);
  await dialog.getByRole("button", { name: "Code artifact 만들기", exact: true }).click();
  const editor = dialog.getByLabel("Artifact 내용", { exact: true });
  const saved = dialog.getByTestId("artifact-autosave-status");
  async function run(source: string) {
    await editor.fill(source);
    await expect(saved).toHaveText("모든 변경사항 저장됨");
    await dialog.getByRole("button", { name: "안전 실행", exact: true }).click();
  }
  await run("[typeof document, typeof fetch, typeof localStorage, typeof process].join(',')");
  await expect(dialog.getByTestId("code-output")).toHaveText("undefined,undefined,undefined,undefined");
  await run("throw new Error('Deliberate artifact failure')");
  await expect(dialog.getByTestId("code-error")).toContainText("Deliberate artifact failure");
  await run("while (true) {}");
  await expect(dialog.getByTestId("code-error")).toContainText("실행 시간 제한", { timeout: 15_000 });
  await expect(editor).toBeEnabled();
  await run("21 * 2");
  await expect(dialog.getByTestId("code-output")).toHaveText("42");
  await expect(dialog.getByTestId("code-error")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Artifact 닫기", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Artifact 열기", exact: true }).click();
  await expect(editor).toHaveValue("21 * 2");
});

test("REF-26/29 version navigation and diff preserve saved sheet while native CSV copy uses current content", async ({ page }) => {
  await page.addInitScript(() => {
    const calls: Array<{ command: string; text: string; succeeded: boolean }> = [];
    Object.assign(window, { artifactCopyCalls: calls });
    const original = document.execCommand.bind(document);
    document.execCommand = (command, showUI, value) => {
      const text = document.activeElement instanceof HTMLTextAreaElement ? document.activeElement.value : "";
      const succeeded = original(command, showUI, value);
      calls.push({ command, text, succeeded });
      return succeeded;
    };
  });
  const { dialog } = await openWorkspace(page);
  const creation = page.waitForResponse(response => new URL(response.url()).pathname === "/api/artifacts" && response.request().method() === "POST");
  await dialog.getByRole("button", { name: "Sheet artifact 만들기", exact: true }).click();
  const response = await creation;
  expect(response.ok()).toBe(true);
  const id = (await response.json()).item.id as string;
  const editor = dialog.getByLabel("Artifact 내용", { exact: true });
  const saved = dialog.getByTestId("artifact-autosave-status");
  const contents = ["Stage,Expression\nA,Hello", "Stage,Expression\nB,Good morning", "Stage,Expression\nC,Thank you"];
  for (const content of contents) {
    await editor.fill(content);
    await expect(saved).toHaveText("모든 변경사항 저장됨");
    await expect.poll(async () => (await versions(id)).at(-1)?.content_text).toBe(content);
  }
  const before = await versions(id);
  async function currentVersionId() {
    const row = await adminClient().from("artifacts").select("current_version_id").eq("id", id).single();
    expect(row.error).toBeNull();
    return row.data!.current_version_id;
  }
  const currentId = await currentVersionId();
  const writes: string[] = [];
  page.on("request", request => {
    if (new URL(request.url()).pathname === `/api/artifacts/${id}/versions` && request.method() === "POST") writes.push(request.url());
  });
  const preview = dialog.getByTestId("artifact-sheet-preview");
  const previous = dialog.getByRole("button", { name: "이전 버전 보기", exact: true });
  const next = dialog.getByRole("button", { name: "다음 버전 보기", exact: true });
  const latest = dialog.getByRole("button", { name: "최신 버전 보기", exact: true });
  await expect(next).toBeDisabled();
  await previous.click();
  await expect(preview).toHaveText(contents[1]);
  await previous.click();
  await expect(preview).toHaveText(contents[0]);
  await expect(editor).toHaveValue(contents[2]);
  await expect(dialog.getByTestId("artifact-diff-previous")).toHaveText(`- ${contents[1]}`);
  await expect(dialog.getByTestId("artifact-diff-current")).toHaveText(`+ ${contents[2]}`);
  await next.click();
  await expect(preview).toHaveText(contents[1]);
  await next.click();
  await expect(preview).toHaveText(contents[2]);
  await expect(next).toBeDisabled();
  await previous.click();
  await latest.click();
  await expect(preview).toHaveText(contents[2]);
  await expect(latest).toBeDisabled();
  // Copy always uses the current editor, even while an older version is previewed.
  await previous.click();
  await expect(preview).toHaveText(contents[1]);
  expect(await page.evaluate(() => typeof navigator.clipboard)).toBe("undefined");
  await dialog.getByRole("button", { name: "CSV 복사", exact: true }).click();
  await expect(dialog.getByText("CSV를 복사했어요.", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as Window & { artifactCopyCalls?: unknown }).artifactCopyCalls))
    .toEqual([{ command: "copy", text: contents[2], succeeded: true }]);
  await expect(page.locator('textarea[readonly]')).toHaveCount(0);
  await expect(editor).toHaveValue(contents[2]);
  await dialog.getByRole("button", { name: "Artifact 닫기", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Artifact 열기", exact: true }).click();
  await expect(editor).toHaveValue(contents[2]);
  await expect(preview).toHaveText(contents[2]);
  expect(await versions(id)).toEqual(before);
  expect(await currentVersionId()).toBe(currentId);
  expect(writes).toEqual([]);
});

test("REF-28 remote HTTP copies real code and execution output, reports clipboard denial and preserves versions", async ({ page }) => {
  await page.addInitScript(() => {
    const state = { deny: false, calls: [] as Array<{ text: string; succeeded: boolean }> };
    Object.assign(window, { codeClipboard: state });
    const original = document.execCommand.bind(document);
    document.execCommand = (command, showUI, value) => {
      const text = document.activeElement instanceof HTMLTextAreaElement ? document.activeElement.value : "";
      const succeeded = state.deny ? false : original(command, showUI, value);
      state.calls.push({ text, succeeded });
      return succeeded;
    };
  });
  const { dialog } = await openWorkspace(page);
  const creation = page.waitForResponse(response => new URL(response.url()).pathname === "/api/artifacts" && response.request().method() === "POST");
  await dialog.getByRole("button", { name: "Code artifact 만들기", exact: true }).click();
  const response = await creation;
  expect(response.ok()).toBe(true);
  const id = (await response.json()).item.id as string;
  const source = 'const greeting = "Hello learner";\nconsole.log(greeting);\n6 * 7';
  const editor = dialog.getByLabel("Artifact 내용", { exact: true });
  await editor.fill(source);
  await expect(dialog.getByTestId("artifact-autosave-status")).toHaveText("모든 변경사항 저장됨");
  await expect.poll(async () => (await versions(id)).at(-1)?.content_text).toBe(source);
  const before = await versions(id);
  const runner = dialog.getByRole("region", { name: "격리 JavaScript 실행", exact: true });
  const copyCode = runner.getByRole("button", { name: "코드 복사", exact: true });
  const copyOutput = runner.getByRole("button", { name: "출력 복사", exact: true });
  await expect(copyOutput).toHaveCount(0);
  expect(await page.evaluate(() => typeof navigator.clipboard)).toBe("undefined");
  await copyCode.click();
  await expect(runner.getByRole("status")).toHaveText("복사했어요.");
  await expect(copyCode).toBeFocused();
  await runner.getByRole("button", { name: "안전 실행", exact: true }).click();
  await expect(runner.getByTestId("code-output")).toHaveText("Hello learner\n42");
  await copyOutput.click();
  await expect(runner.getByRole("status")).toHaveText("복사했어요.");
  await expect(copyOutput).toBeFocused();
  expect(await page.evaluate(() => (window as Window & { codeClipboard?: { calls: unknown } }).codeClipboard?.calls))
    .toEqual([{ text: source, succeeded: true }, { text: "Hello learner\n42", succeeded: true }]);
  // Only this denial is injected; the preceding successful copies call the native command.
  await page.evaluate(() => { (window as Window & { codeClipboard?: { deny: boolean } }).codeClipboard!.deny = true; });
  await copyOutput.click();
  await expect(runner.getByRole("status")).toHaveText("복사하지 못했어요. 출력 내용을 직접 선택해 주세요.");
  await expect(copyOutput).toBeFocused();
  await expect(runner.getByTestId("code-output")).toHaveText("Hello learner\n42");
  await expect(editor).toHaveValue(source);
  await expect(page.locator('textarea[readonly]')).toHaveCount(0);
  await page.evaluate(() => { (window as Window & { codeClipboard?: { deny: boolean } }).codeClipboard!.deny = false; });
  await copyOutput.click();
  await expect(runner.getByRole("status")).toHaveText("복사했어요.");
  expect(await versions(id)).toEqual(before);
  await dialog.getByRole("button", { name: "Artifact 닫기", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Artifact 열기", exact: true }).click();
  await expect(editor).toHaveValue(source);
  await expect(copyOutput).toHaveCount(0);
  expect(await versions(id)).toEqual(before);
});

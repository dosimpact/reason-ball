import { expect, test } from "@playwright/test";

import { installChatBrowserStubs, installCleanAppState } from "./test-setup";

const chatPath = "/chat/mia-hotelier?mission=hotel-check-in";

test.describe("Chat parity", () => {
  test.beforeEach(async ({ page }) => {
    await installCleanAppState(page);
    await installChatBrowserStubs(page);
  });

  test("regenerates an answer without duplicating its user turn after reload", async ({ page }) => {
    await page.goto(chatPath);
    const input = page.getByRole("textbox", { name: "영어 메시지" });
    await input.fill("Could I check in now?");
    await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
    await expect(page.getByTestId("message-assistant")).toHaveCount(2);
    await expect(page.getByRole("button", { name: "메시지 보내기", exact: true })).toBeVisible();
    const generated = page.waitForResponse((response) => response.url().endsWith('/api/ai/chat') && response.status() === 200);
    const answer = page.getByTestId("message-assistant").last();
    await answer.hover();
    await answer.getByRole("button", { name: "답변 다시 생성" }).click();
    await (await generated).finished();
    await expect(page.getByRole("button", { name: "메시지 보내기", exact: true })).toBeVisible();
    await expect(page.getByTestId("message-user")).toHaveCount(1);
    await expect(page.getByTestId("message-assistant")).toHaveCount(2);
    await page.reload();
    await expect(page.getByTestId("message-user")).toHaveCount(1);
    await expect(page.getByTestId("message-user")).toContainText("Could I check in now?");
    await expect(page.getByTestId("message-assistant")).toHaveCount(2);
  });

  test("validates model commands and sends with the restored selection", async ({ page }) => {
    await page.goto(chatPath);
    const input = page.getByRole('textbox', { name: '영어 메시지' });
    const send = page.getByRole('button', { name: '메시지 보내기', exact: true });
    await input.fill('/model unknown');
    await send.click();
    await expect(page.getByText('선택 가능한 모델 ID를 입력해 주세요.')).toBeVisible();
    await expect(input).toHaveValue('/model unknown');
    await input.fill('/model gpt-5-mini');
    await send.click();
    await expect(page.getByLabel('AI 모델 선택')).toHaveValue('gpt-5-mini');
    await expect(input).toHaveValue('');
    await page.reload();
    await expect(page.getByLabel('AI 모델 선택')).toHaveValue('gpt-5-mini');
    const response = page.waitForResponse((result) => result.url().endsWith('/api/ai/chat') && result.status() === 200);
    await input.fill('Can I check in?');
    await send.click();
    expect((await response).headers()['x-ai-model']).toBe('gpt-5-mini');
    await expect(send).toBeVisible();
    await expect(page.getByTestId('message-user')).toHaveCount(1);
  });

  test('retries a failed model catalog and searches without losing the selected model', async ({ page }) => {
    let catalogAvailable = false;
    await page.route('**/api/ai/models', async (route) => {
      if (!catalogAvailable) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Unavailable' } }) });
      return route.continue();
    });
    await page.goto(chatPath);
    const select = page.getByLabel('AI 모델 선택');
    await expect(select).toBeDisabled();
    await expect(page.getByRole('button', { name: '모델 목록 다시 불러오기' })).toBeVisible();
    catalogAvailable = true;
    await page.getByRole('button', { name: '모델 목록 다시 불러오기' }).click();
    await expect(select).toBeEnabled();
    await page.getByLabel('AI 모델 검색').fill('MINI');
    await select.selectOption('gpt-5-mini');
    await expect(select.locator('option')).toHaveCount(1);
    await page.getByLabel('AI 모델 검색').fill('no-such-model');
    await expect(page.getByText('선택 가능한 검색 결과가 없어요.')).toBeVisible();
    await expect(select).toHaveValue('gpt-5-mini');
    await page.reload();
    await expect(select).toBeEnabled();
    await expect(select).toHaveValue('gpt-5-mini');
  });

  test('searches and selects a model on a 360px screen', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(chatPath);
    await page.getByLabel('AI 모델 검색').fill('MINI');
    const select = page.getByLabel('AI 모델 선택');
    await select.selectOption('gpt-5-mini');
    await expect(select).toHaveValue('gpt-5-mini');
    await expect(page.getByRole('textbox', { name: '영어 메시지' })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('model-mobile.png') });
  });

  test('explains capabilities and preserves a draft and attachment when switching to an incompatible model', async ({ page }) => {
    // REF-08 / REF-14: supported attachment -> incompatible selection -> recovery.
    await page.goto(chatPath);
    const model = page.getByLabel('AI 모델 선택');
    const features = page.getByLabel('선택 모델 기능');
    await expect(features).toContainText('이미지: 지원');
    await expect(features).toContainText('모의 공급자 기능');
    await page.getByLabel('파일 첨부').setInputFiles({ name: 'key.png', mimeType: 'image/png', buffer: Buffer.from('89504e470d0a1a0a', 'hex') });
    await expect(page.getByTestId('attachment-preview')).toBeVisible();
    const input = page.getByRole('textbox', { name: '영어 메시지' });
    await input.fill('Can you describe this key?');
    await model.selectOption('text-only-test');
    await expect(features).toContainText('이미지: 미지원');
    await expect(features).toContainText('도구: 미지원');
    await expect(features).toContainText('추론: 미지원');
    await page.getByRole('button', { name: '메시지 보내기', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: '지원 모델을 선택하거나 첨부를 제거' })).toBeVisible();
    await expect(input).toHaveValue('Can you describe this key?');
    await expect(page.getByTestId('attachment-preview')).toBeVisible();
    await expect(page.getByTestId('message-user')).toHaveCount(0);
    await model.selectOption('unverified-test');
    await expect(features).toContainText('이미지: 미확인');
    await expect(features).toContainText('추론: 미확인');
    await page.reload();
    await expect(model).toHaveValue('unverified-test');
    await expect(features).toContainText('도구: 미확인');
    await expect(input).toHaveValue('Can you describe this key?');
    await page.getByLabel('파일 첨부').setInputFiles({ name: 'key.png', mimeType: 'image/png', buffer: Buffer.from('89504e470d0a1a0a', 'hex') });
    await expect(page.getByRole('alert').filter({ hasText: '첨부 지원이 확인되지 않았어요' })).toBeVisible();
    await expect(page.getByTestId('attachment-preview')).toHaveCount(0);
    await model.selectOption('gpt-5-mini');
    await expect(features).toContainText('이미지: 지원');
    await page.getByLabel('파일 첨부').setInputFiles({ name: 'key.png', mimeType: 'image/png', buffer: Buffer.from('89504e470d0a1a0a', 'hex') });
    await expect(page.getByTestId('attachment-preview')).toBeVisible();
    await page.getByRole('button', { name: '메시지 보내기', exact: true }).click();
    await expect(page.getByTestId('message-user')).toHaveCount(1);
    await expect(page.getByTestId('message-assistant')).toHaveCount(2);
    await expect(page.getByRole('button', { name: '메시지 보내기', exact: true })).toBeVisible();
    await model.selectOption('text-only-test');
    await expect(model).toHaveValue('gpt-5-mini');
    await expect(page.getByText('이 대화의 기존 첨부 또는 도구 기록을 지원하는 모델을 선택해 주세요.')).toBeVisible();
  });

  test("persists a typed conversation, branches edits, manages history, votes, and a read-only share", async ({ page }) => {
    await page.goto(chatPath);
    const workspace = page.getByTestId("chat-workspace");
    await expect(workspace).toBeVisible();
    const firstId = await workspace.getAttribute("data-conversation-id");
    expect(firstId).toMatch(/^conversation-/);

    const input = page.getByRole("textbox", { name: "영어 메시지" });
    const model = page.getByLabel("AI 모델 선택");
    await input.fill("This draft survives a reload");
    await model.selectOption("gpt-5-mini");
    await page.reload();
    await expect(input).toHaveValue("This draft survives a reload");
    await expect(model).toHaveValue("gpt-5-mini");

    await expect(page.getByLabel('선택 모델 기능')).toContainText('이미지: 지원');
    await page.getByLabel("파일 첨부").setInputFiles({
      buffer: Buffer.from("89504e470d0a1a0a", "hex"),
      mimeType: "image/png",
      name: "hotel-key.png",
    });
    await expect(page.getByTestId("attachment-preview")).toContainText("hotel-key.png");
    await input.fill("Please describe this hotel key.");
    await page.getByRole("button", { name: "메시지 보내기" }).click();
    await expect(page.getByTestId("message-assistant")).toHaveCount(2);
    await expect(page.getByTestId("message-user")).toContainText("hotel-key.png");

    const userMessage = page.getByTestId("message-user").last();
    await userMessage.hover();
    await userMessage.getByRole("button", { name: "메시지 편집" }).click();
    await input.fill("Please describe this room key instead.");
    await page.getByRole("button", { name: "수정한 메시지 보내기" }).click();
    await expect(page.getByTestId("message-user").last()).toContainText("room key instead");
    await expect(page.getByTestId("message-assistant")).toHaveCount(2);
    const branchedAssistant = page.getByTestId("message-assistant").last();
    await branchedAssistant.hover();
    await branchedAssistant.getByRole("button", { name: "싫어요" }).click();
    await branchedAssistant.getByLabel("싫어요 이유").selectOption("정확하지 않음");

    await expect.poll(() => page.evaluate(() => {
      const store = JSON.parse(window.localStorage.getItem("lingua-chat-parity-v1") ?? "{}") as { conversations?: Array<{ pendingRequest?: unknown }> };
      return store.conversations?.[0]?.pendingRequest ?? null;
    })).toBeNull();

    await page.evaluate(() => {
      const key = "lingua-chat-parity-v1";
      const store = JSON.parse(window.localStorage.getItem(key) ?? "{}") as {
        conversations: Array<{ id: string; messages: unknown[] }>;
      };
      const conversation = store.conversations[0];
      conversation.messages.push({
        id: "rich-content-message",
        role: "assistant",
        parts: [{
          type: "text",
          text: "Practice table:\n| Phrase | Meaning |\n| --- | --- |\n| check in | register |\n\n```ts\nconst polite = true;\n```",
        }],
      });
      window.localStorage.setItem(key, JSON.stringify(store));
    });
    await page.reload();
    await expect(page.getByRole("table")).toContainText("check in");
    await expect(page.locator("pre")).toContainText("const polite = true");
    await expect(page.getByTestId("message-attachment")).toHaveCount(1);
    await expect(page.getByTestId("message-attachment").first()).toContainText("hotel-key.png");
    await expect(page.getByTestId("message-assistant").filter({ hasText: "English conversation partner" }).getByRole("button", { name: "싫어요" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("싫어요 이유")).toHaveValue("정확하지 않음");

    await page.getByRole("button", { name: "대화 관리" }).click();
    const manageDialog = page.getByRole("dialog", { name: "대화 관리" });
    await manageDialog.getByLabel("대화 제목").fill("런던 호텔 복습");
    await manageDialog.getByRole("button", { name: "제목 저장" }).click();
    await expect(page.getByText("런던 호텔 복습", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "대화 공유" }).click();
    const shareDialog = page.getByRole("dialog", { name: "대화 공유" });
    const shareHref = await shareDialog.getByRole("link", { name: "읽기 전용 화면 열기" }).getAttribute("href");
    expect(shareHref).toMatch(/^\/shared\/mia-hotelier-/);
    await page.goto(shareHref!);
    await expect(page.getByTestId("shared-chat-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: "런던 호텔 복습" })).toBeVisible();
    await expect(page.getByText("이 화면은 읽기 전용이에요.")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "영어 메시지" })).toHaveCount(0);

    await page.goto("/history");
    const persistedHistory = page.getByTestId("persisted-history").filter({ hasText: "런던 호텔 복습" });
    await expect(persistedHistory).toBeVisible();
    await persistedHistory.getByRole("link", { name: "이어서 대화" }).click();
    await expect(page.getByTestId("chat-workspace")).toHaveAttribute("data-conversation-id", firstId!);

    await page.getByRole("button", { name: "새 대화 시작" }).click();
    await expect(page.getByTestId("chat-workspace")).not.toHaveAttribute("data-conversation-id", firstId!);
  });

  test("runs slash commands, approves a durable tool result, and versions all artifact kinds", async ({ page }) => {
    await page.goto(chatPath);
    const input = page.getByRole("textbox", { name: "영어 메시지" });

    await input.fill("/");
    const commandMenu = page.getByTestId("slash-command-menu");
    await expect(commandMenu).toContainText("/weather Seoul");
    await expect(commandMenu).toContainText("/artifact text");
    await expect(commandMenu).toContainText("/new");
    await expect(commandMenu).toContainText("/clear");

    await input.fill("/weather Busan");
    await input.press("Enter");
    const weather = page.getByTestId("weather-tool-card");
    await expect(weather).toContainText("Busan 날씨 조회");
    await weather.getByRole("button", { name: "허용" }).click();
    await expect(weather).toContainText("23°C");
    await page.reload();
    await expect(page.getByTestId("weather-tool-card")).toContainText("맑음");

    await input.fill("/artifact text");
    await input.press("Enter");
    const artifactDialog = page.getByRole("dialog", { name: "Artifact workspace" });
    await expect(artifactDialog).toBeVisible();
    const artifactEditor = artifactDialog.getByLabel("Artifact 내용");
    await artifactEditor.fill("please help me");
    await artifactEditor.selectText();
    await artifactDialog.getByRole("button", { name: "선택 영역 다듬기" }).click();
    await expect(artifactEditor).toHaveValue("Please help me.");
    await artifactEditor.fill("I has a reservation.");
    await artifactDialog.getByRole("button", { name: "문법 제안 적용" }).click();
    await expect(artifactEditor).toHaveValue("I have a reservation.");
    await expect(artifactDialog.getByTestId("artifact-autosave-status")).toHaveText("모든 변경사항 저장됨");
    await artifactDialog.getByRole("button", { name: "새 버전 저장" }).click();
    await expect(artifactDialog.getByRole("button", { name: "버전 2 복원" })).toBeVisible();
    await expect(artifactDialog.getByTestId("artifact-diff-current")).toContainText("I have a reservation.");
    await artifactDialog.getByRole("button", { name: "이전 버전 보기" }).click();
    await expect(artifactDialog.getByTestId("artifact-text-preview")).toContainText("Conversation notes");
    await artifactDialog.getByRole("button", { name: "최신 버전 보기" }).click();
    await expect(artifactDialog.getByTestId("artifact-text-preview")).toContainText("I have a reservation.");
    await artifactDialog.getByRole("button", { name: "버전 1 복원" }).click();
    await expect(artifactDialog.getByRole("button", { name: "버전 3 복원" })).toBeVisible();
    await expect(artifactEditor).toHaveValue(/today’s practice/i);

    await artifactDialog.getByRole("button", { name: "Code artifact 만들기" }).click();
    await expect(artifactDialog.getByTestId("artifact-code-preview")).toBeVisible();
    await artifactEditor.fill("1 + 2 * 3");
    await artifactDialog.getByRole("button", { name: "안전 실행" }).click();
    await expect(artifactDialog.getByTestId("code-output")).toHaveText("7");
    await artifactDialog.getByRole("button", { name: "출력 복사" }).click();
    await expect.poll(() => page.evaluate(() => (window as typeof window & { __e2eClipboardText?: string }).__e2eClipboardText)).toBe("7");
    await artifactEditor.fill("fetch('https://example.com')");
    await artifactDialog.getByRole("button", { name: "안전 실행" }).click();
    await expect(artifactDialog.getByTestId("code-error")).toContainText("fetch");

    await artifactDialog.getByRole("button", { name: "Sheet artifact 만들기" }).click();
    await expect(artifactDialog.getByTestId("artifact-sheet-preview")).toContainText("Expression");
    await artifactDialog.getByLabel("셀 2-1").fill("  Could I check in?  ");
    await artifactDialog.getByRole("button", { name: "데이터 정리" }).click();
    await expect(artifactDialog.getByLabel("셀 2-1")).toHaveValue("Could I check in?");
    await artifactDialog.getByRole("button", { name: "Sheet 분석" }).click();
    await expect(artifactDialog.getByTestId("sheet-analysis")).toContainText("2개 데이터 행");
    await artifactDialog.getByRole("button", { name: "CSV 복사" }).click();
    await expect.poll(() => page.evaluate(() => (window as typeof window & { __e2eClipboardText?: string }).__e2eClipboardText)).toContain("Could I check in?");
    const downloadPromise = page.waitForEvent("download");
    await artifactDialog.getByRole("link", { name: "CSV 다운로드" }).click();
    expect((await downloadPromise).suggestedFilename()).toContain("Expression sheet");

    await artifactDialog.getByRole("button", { name: "Image artifact 만들기" }).click();
    await expect(artifactDialog.getByTestId("artifact-image-preview")).toBeVisible();
    const imageRequest = page.waitForResponse((response) => response.url().endsWith("/api/ai/image") && response.request().method() === "POST");
    await artifactDialog.getByRole("button", { name: "이미지 생성" }).click();
    expect((await imageRequest).ok()).toBe(true);
    await expect(artifactDialog.getByTestId("generated-artifact-image")).toBeVisible();
    await expect(artifactDialog.getByRole("button", { name: "버전 2 복원" })).toBeVisible();
    await artifactDialog.getByRole("button", { name: "버전 1 복원", exact: true }).click();
    await expect(artifactDialog.getByTestId("generated-artifact-image")).toHaveCount(0);
    await artifactDialog.getByRole("button", { name: "버전 2 복원", exact: true }).click();
    await expect(artifactDialog.getByTestId("generated-artifact-image")).toBeVisible();
    await page.route("**/api/ai/image", (route) => route.abort("failed"));
    await artifactDialog.getByRole("button", { name: "이미지 생성" }).click();
    await expect(artifactDialog.getByRole("alert")).toContainText("이미지를 생성하지 못했어요");
    await page.unroute("**/api/ai/image");
    await artifactDialog.getByRole("button", { name: "Artifact 닫기" }).click();

    await page.getByRole("button", { name: "Artifact 열기" }).click();
    await expect(page.getByRole("dialog", { name: "Artifact workspace" })).toContainText("Practice code");
    await expect(page.getByRole("dialog", { name: "Artifact workspace" })).toContainText("Scene prompt");
    await expect(page.getByRole("dialog", { name: "Artifact workspace" })).toContainText("Expression sheet");
    await page.getByRole("dialog", { name: "Artifact workspace" }).getByRole("button", { name: /Scene prompt/ }).click();
    await expect(page.getByTestId("generated-artifact-image")).toBeVisible();
    await page.getByRole("button", { name: "Artifact 닫기" }).click();

    await input.fill("/model gpt-5-mini");
    await input.press("Enter");
    await expect(page.getByLabel("AI 모델 선택")).toHaveValue("gpt-5-mini");
    const wasDark = await page.locator("html").evaluate(element => element.classList.contains("dark"));
    await input.fill("/theme");
    await input.press("Enter");
    await expect(page.locator("html")).toHaveClass(wasDark ? /light/ : /dark/);
    await page.reload();
    await expect(page.getByLabel("AI 모델 선택")).toHaveValue("gpt-5-mini");
    await expect(page.locator("html")).toHaveClass(wasDark ? /light/ : /dark/);
  });

  test("shows an explicit request failure and retries the same turn", async ({ page }) => {
    let shouldFail = true;
    await page.route("**/api/ai/chat", async (route) => {
      if (shouldFail) {
        shouldFail = false;
        await route.abort("failed");
        return;
      }
      await route.continue();
    });
    await page.goto(chatPath);
    await page.getByRole("textbox", { name: "영어 메시지" }).fill("Please help me check in.");
    await page.getByRole("button", { name: "메시지 보내기" }).click();
    const errorPanel = page.getByTestId("chat-error");
    await expect(errorPanel).toContainText("답변을 가져오지 못했어요.");
    await errorPanel.getByRole("button", { name: "다시 시도" }).click();
    await expect(errorPanel).toHaveCount(0);
    await expect(page.getByTestId("message-assistant")).toHaveCount(2);
  });

  test("executes management commands with destructive confirmations and durable deletion", async ({ page }) => {
    await page.goto(chatPath);
    const input = page.getByRole("textbox", { name: "영어 메시지" });
    const workspace = page.getByTestId("chat-workspace");
    const originalId = await workspace.getAttribute("data-conversation-id");

    await input.fill("/rename Command practice");
    await input.press("Enter");
    await expect(page.getByText("Command practice", { exact: true })).toBeVisible();
    await input.fill("A message that will be cleared.");
    await input.press("Enter");
    await expect(page.getByTestId("message-user")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "메시지 보내기", exact: true })).toBeVisible();
    await input.fill("/clear");
    await input.press("Enter");
    const clearDialog = page.getByRole("dialog", { name: "메시지를 초기화할까요?" });
    await clearDialog.getByRole("button", { name: "취소" }).click();
    await expect(page.getByTestId("message-user")).toHaveCount(1);
    await input.fill("/clear");
    await input.press("Enter");
    await clearDialog.getByRole("button", { name: "메시지 초기화 확인" }).click();
    await expect(page.getByTestId("message-user")).toHaveCount(0);
    await expect(page.getByTestId("message-assistant")).toHaveCount(1);

    await page.reload();
    await expect(workspace).toHaveAttribute("data-conversation-id", originalId!);
    await expect(page.getByTestId("message-user")).toHaveCount(0);
    await expect(page.getByText("Command practice", { exact: true })).toBeVisible();

    await input.fill("A durable message before creating a new chat.");
    await input.press("Enter");
    await expect(page.getByTestId("message-assistant")).toHaveCount(2);
    await input.fill("/new");
    await input.press("Enter");
    await expect(workspace).not.toHaveAttribute("data-conversation-id", originalId!);
    const secondId = await workspace.getAttribute("data-conversation-id");

    await page.getByRole("button", { name: "대화 관리" }).click();
    await page.getByRole("dialog", { name: "대화 관리" }).getByRole("button", { name: "대화 삭제" }).click();
    const deleteDialog = page.getByRole("dialog", { name: "이 대화를 삭제할까요?" });
    await deleteDialog.getByRole("button", { name: "취소" }).click();
    await expect(workspace).toHaveAttribute("data-conversation-id", secondId!);

    await input.fill("/delete");
    await input.press("Enter");
    await page.getByRole("dialog", { name: "이 대화를 삭제할까요?" }).getByRole("button", { name: "대화 삭제 확인" }).click();
    await expect(workspace).not.toHaveAttribute("data-conversation-id", secondId!);
    await page.goto("/history");
    await expect(page.locator(`[href*="conversation=${secondId}"]`)).toHaveCount(0);
    await expect(page.getByTestId("persisted-history").filter({ hasText: "Command practice" })).toBeVisible();

    await page.goto(chatPath);
    await input.fill("/purge");
    await input.press("Enter");
    const purgeDialog = page.getByRole("dialog", { name: "모든 대화를 삭제할까요?" });
    const purgeButton = purgeDialog.getByRole("button", { name: "모든 대화 삭제 확인" });
    await expect(purgeButton).toBeDisabled();
    await purgeDialog.getByLabel("모든 대화 삭제 확인 문구").fill("DELETE ALL");
    await purgeButton.click();
    await page.goto("/history");
    await expect(page.getByTestId("persisted-history")).toHaveCount(0);
  });

  test("groups history by date and reveals cursor-sized pages", async ({ page }) => {
    await page.goto("/history");
    await page.evaluate(() => {
      const makeConversation = (index: number, updatedAt: string) => ({
        artifacts: [], characterId: "mia-hotelier", characterName: "Mia",
        createdAt: updatedAt, draft: "", id: `fixture-conversation-${index}`,
        messages: [
          { id: `welcome-${index}`, role: "assistant", parts: [{ type: "text", text: "Welcome" }] },
          { id: `user-${index}`, role: "user", parts: [{ type: "text", text: `Fixture message ${index}` }] },
        ],
        missionId: "hotel-check-in", missionTitle: "호텔 체크인하기", modelId: "gpt-5.6-terra",
        routeKey: `fixture-${index}`, theme: "light", title: `Fixture history ${index}`,
        updatedAt, votes: {},
      });
      const dates = [
        "2026-09-05T11:00:00.000Z", "2026-09-05T10:00:00.000Z",
        "2026-09-04T11:00:00.000Z", "2026-09-04T10:00:00.000Z",
        "2026-09-02T11:00:00.000Z", "2026-09-01T10:00:00.000Z",
      ];
      window.localStorage.setItem("lingua-chat-parity-v1", JSON.stringify({
        activeByRoute: {}, conversations: dates.map((date, index) => makeConversation(index, date)), deletedConversationIds: [],
      }));
      window.dispatchEvent(new CustomEvent("lingua-chat-conversations-changed"));
    });
    await expect(page.getByTestId("history-group-오늘")).toBeVisible();
    await expect(page.getByTestId("history-group-어제")).toBeVisible();
    await expect(page.getByTestId("history-load-more")).toBeVisible();
    await page.getByTestId("history-load-more").click();
    await expect(page.getByTestId("history-group-이전")).toBeVisible();
    await expect(page.getByTestId("persisted-history")).toHaveCount(6);
  });

  test("reattaches an interrupted mock stream without duplicate messages", async ({ page }) => {
    await page.goto(`${chatPath}&scenario=chat-slow`);
    await page.getByRole("textbox", { name: "영어 메시지" }).fill("I would like to practice slowly.");
    await page.getByRole("button", { name: "메시지 보내기" }).click();
    await expect(page.getByTestId("message-assistant")).toHaveCount(2);
    const streamedAssistant = page.getByTestId("message-assistant").last();
    await expect(streamedAssistant).toBeVisible();
    const originalAssistantId = await streamedAssistant.getAttribute("data-message-id");
    await expect.poll(() => page.evaluate(() => {
      const store = JSON.parse(window.localStorage.getItem("lingua-chat-parity-v1") ?? "{}") as { conversations?: Array<{ pendingRequest?: { assistantMessageId?: string } }> };
      return store.conversations?.[0]?.pendingRequest?.assistantMessageId;
    })).toBe(originalAssistantId);

    await page.reload();
    await expect(page.getByTestId("message-assistant").last()).toContainText("Then, say that you have a reservation.");
    await expect(page.getByTestId("message-assistant")).toHaveCount(2);
    await expect(page.getByTestId("message-assistant").last()).toHaveAttribute("data-message-id", originalAssistantId!);
    await expect(page.getByTestId("message-user")).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => {
      const store = JSON.parse(window.localStorage.getItem("lingua-chat-parity-v1") ?? "{}") as { conversations?: Array<{ pendingRequest?: unknown }> };
      return store.conversations?.[0]?.pendingRequest ?? null;
    })).toBeNull();
  });
});

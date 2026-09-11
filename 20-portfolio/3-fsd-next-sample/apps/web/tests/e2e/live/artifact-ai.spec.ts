import { adminClient, expect, signIn, test } from "./fixtures";
import { artifactAssistanceResponse } from "../../../src/features/chat-artifact/model/assistance";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

for (const { mode, code } of [
  { mode: "rewrite", code: false }, { mode: "grammar", code: false },
  { mode: "analysis", code: false }, { mode: "rewrite", code: true },
] as const) {
  test(`REF-25/27/29/31 real Artifact AI ${code ? "Code " : ""}${mode} ${mode === "analysis" ? "returns analysis without changing source" : "preserves source until explicit apply"}`, async ({ page, playwright, createAccount, account }) => {
    test.setTimeout(180_000);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /외우지 말고/ })).toBeVisible();
    await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
    await page.getByRole("button", { name: "새 채팅", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "영어 메시지" })).toBeEnabled();
    await page.getByRole("button", { name: "Artifact 열기", exact: true }).click();
    const workspace = page.getByRole("dialog", { name: "Artifact workspace", exact: true });
    const created = page.waitForResponse(response => new URL(response.url()).pathname === "/api/artifacts" && response.request().method() === "POST");
    await workspace.getByRole("button", { name: `${code ? "Code" : mode === "analysis" ? "Sheet" : "Text"} artifact 만들기`, exact: true }).click();
    const createResponse = await created; expect(createResponse.ok()).toBe(true);
    const id = (await createResponse.json()).item.id;
    const source = code ? "// BEGIN\nfunction add(a, b) { return a + b; }\n// END\nconsole.log(add(20, 22));" : mode === "analysis" ? "Item,Count\nApples,3\nPears,2" : "BEGIN\nI has a reservation.\nEND";
    const editor = workspace.getByLabel("Artifact 내용", { exact: true });
    await editor.fill(source);
    await expect(workspace.getByTestId("artifact-autosave-status")).toHaveText("모든 변경사항 저장됨");
    async function versions() {
      const result = await adminClient().from("artifact_versions").select("id,content_text").eq("artifact_id", id).order("version_number");
      expect(result.error).toBeNull(); return result.data!;
    }
    await expect.poll(async () => (await versions()).at(-1)?.content_text).toBe(source);
    const before = await versions(); const version = before.at(-1)!.id;
    const selection = code ? { start: source.indexOf("function"), end: source.indexOf("\n// END") } : { start: 6, end: source.indexOf("\nEND") };
    const payload = { requestId: randomUUID(), artifactId: id, expectedVersionId: version, mode, ...(mode === "rewrite" ? { selection } : {}) };
    const other = await playwright.request.newContext({ baseURL: "http://dodonet.iptime.org:13000" });
    const otherAccount = await createAccount();
    try {
      await signIn(other, otherAccount);
      const forbidden = await other.post("/api/ai/artifact-assistance", { headers: { Origin: "http://dodonet.iptime.org:13000" }, data: payload });
      expect(forbidden.status()).toBe(404);
      const read = await other.get(`/api/ai/artifact-assistance?artifactId=${id}&expectedVersionId=${version}`);
      expect(read.status()).toBe(404);
    } finally { await other.dispose(); }
    if (mode === "rewrite") {
      await editor.focus();
      await editor.evaluate((element, range) => (element as HTMLTextAreaElement).setSelectionRange(range.start, range.end), selection);
    }
    let lostRequestId: string | undefined;
    if (mode === "grammar") {
      await page.route("**/api/ai/artifact-assistance", async route => {
        lostRequestId = route.request().postDataJSON().requestId;
        const persisted = await route.fetch();
        expect(persisted.ok(), await persisted.text()).toBe(true);
        expect(artifactAssistanceResponse.parse(await persisted.json()).suggestionId).toBe(lostRequestId);
        await route.abort("failed");
      }, { times: 1 });
    }
    const generated = page.waitForResponse(response => new URL(response.url()).pathname === "/api/ai/artifact-assistance" && response.request().method() === "POST", { timeout: 90_000 });
    const action = workspace.getByRole("button", { name: mode === "rewrite" ? "AI 선택 영역 다듬기" : mode === "grammar" ? "AI 문법 제안" : "AI Sheet 분석", exact: true });
    await action.click();
    if (mode === "grammar") {
      await expect(workspace.getByRole("region", { name: "Artifact AI 도움", exact: true }).getByRole("alert")).toBeVisible({ timeout: 60_000 });
      await expect(editor).toHaveValue(source);
      await action.click();
    }
    const response = await generated; expect(response.ok(), await response.text()).toBe(true);
    const result = artifactAssistanceResponse.parse(await response.json());
    expect(result.source).toBe("provider"); expect(result.sourceContent).toBe(source);
    if (mode === "grammar") {
      expect(result.suggestionId).toBe(lostRequestId);
      expect(response.request().postDataJSON().requestId).toBe(lostRequestId);
      const rows = await adminClient().from("artifact_suggestions").select("id").eq("artifact_version_id", version);
      expect(rows.error).toBeNull(); expect(rows.data).toEqual([{ id: lostRequestId }]);
    }
    const stored = await adminClient().from("artifact_suggestions").select("id,artifact_version_id,original_text,suggested_text,description,mode,selection_start,selection_end,status").eq("id", result.suggestionId).single();
    expect(stored.error).toBeNull();
    expect(stored.data).toEqual({ id: result.suggestionId, artifact_version_id: version, original_text: source, suggested_text: result.result.suggestion, description: result.result.explanation, mode,
      selection_start: mode === "rewrite" ? selection.start : null, selection_end: mode === "rewrite" ? selection.end : null, status: "pending" });
    const replay = await page.request.post("/api/ai/artifact-assistance", { headers: { Origin: "http://dodonet.iptime.org:13000" }, data: response.request().postDataJSON() });
    expect(replay.ok(), await replay.text()).toBe(true);
    expect(artifactAssistanceResponse.parse(await replay.json())).toEqual(result);
    const collision = await page.request.post("/api/ai/artifact-assistance", { headers: { Origin: "http://dodonet.iptime.org:13000" }, data: { ...response.request().postDataJSON(), mode: mode === "grammar" ? "analysis" : "grammar" } });
    expect(collision.status()).toBe(409);
    if (mode === "grammar") {
      const makeClient = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
      const owner = makeClient(); const outsider = makeClient();
      try {
        expect((await owner.auth.signInWithPassword({ email: account!.email, password: account!.password })).error).toBeNull();
        expect((await outsider.auth.signInWithPassword({ email: otherAccount.email, password: otherAccount.password })).error).toBeNull();
        const visible = await owner.from("artifact_suggestions").select("id").eq("id", result.suggestionId);
        expect(visible.error).toBeNull(); expect(visible.data).toEqual([{ id: result.suggestionId }]);
        const hidden = await outsider.from("artifact_suggestions").select("id").eq("id", result.suggestionId);
        expect(hidden.error).toBeNull(); expect(hidden.data).toEqual([]);
        const forged = await owner.from("artifact_suggestions").update({ suggested_text: "forged provider content" }).eq("id", result.suggestionId);
        expect(forged.error?.code).toBe("42501");
      } finally { await owner.auth.signOut({ scope: "local" }); await outsider.auth.signOut({ scope: "local" }); }
    }
    await expect(workspace.getByTestId("artifact-ai-suggestion")).toHaveText(result.result.suggestion);
    await expect(editor).toHaveValue(source); expect(await versions()).toEqual(before);
    // REF-31: an unapplied provider suggestion is durable independently of the
    // document. Reload must restore it without paying for another generation.
    let regenerated = 0;
    page.on("request", request => {
      if (new URL(request.url()).pathname === "/api/ai/artifact-assistance" && request.method() === "POST") regenerated++;
    });
    await workspace.getByRole("button", { name: "Artifact 닫기", exact: true }).click();
    let allowRestore = false;
    if (mode === "grammar") {
      // Development mounts can start and cancel an earlier GET. Hold the outage
      // for all restore requests until the user explicitly retries.
      await page.route("**/api/ai/artifact-assistance?**", route => allowRestore ? route.continue() : route.abort("failed"));
    }
    await page.reload();
    await page.getByRole("button", { name: "Artifact 열기", exact: true }).click();
    if (mode === "grammar") {
      await expect(workspace.getByRole("button", { name: "저장된 AI 제안 다시 불러오기", exact: true })).toBeVisible();
      await expect(editor).toHaveValue(source);
      allowRestore = true;
      await workspace.getByRole("button", { name: "저장된 AI 제안 다시 불러오기", exact: true }).click();
    }
    await expect(workspace.getByTestId("artifact-ai-suggestion")).toHaveText(result.result.suggestion);
    await expect(editor).toHaveValue(source);
    expect(await versions()).toEqual(before);
    expect(regenerated).toBe(0);
    let expected = source;
    if (mode !== "analysis") {
      await workspace.getByRole("button", { name: "AI 제안 적용", exact: true }).click();
      expected = mode === "rewrite" ? `${source.slice(0, selection.start)}${result.result.suggestion}${source.slice(selection.end)}` : result.result.suggestion;
      await expect(editor).toHaveValue(expected);
      if (code) {
        expect(expected.startsWith(source.slice(0, selection.start))).toBe(true);
        expect(expected.endsWith(source.slice(selection.end))).toBe(true);
        await workspace.getByRole("button", { name: "안전 실행", exact: true }).click();
        await expect(workspace.getByTestId("code-output")).toHaveText("42");
        await expect(workspace.getByTestId("code-error")).toHaveCount(0);
      }
      await expect.poll(async () => (await versions()).length).toBe(before.length + 1);
      expect((await versions()).at(-1)?.content_text).toBe(expected);
      expect((await versions()).slice(0, -1)).toEqual(before);
      const stale = await page.request.post("/api/ai/artifact-assistance", { headers: { Origin: "http://dodonet.iptime.org:13000" }, data: payload });
      expect(stale.status()).toBe(409);
      const oldRead = await page.request.get(`/api/ai/artifact-assistance?artifactId=${id}&expectedVersionId=${version}`);
      expect(oldRead.status()).toBe(409);
      const historicalReplay = await page.request.post("/api/ai/artifact-assistance", { headers: { Origin: "http://dodonet.iptime.org:13000" }, data: response.request().postDataJSON() });
      expect(historicalReplay.ok()).toBe(true);
      expect(artifactAssistanceResponse.parse(await historicalReplay.json())).toEqual(result);
      expect((await versions()).length).toBe(before.length + 1);
    } else {
      await expect(workspace.getByRole("button", { name: "AI 제안 적용", exact: true })).toHaveCount(0);
    }
    await workspace.getByRole("button", { name: "Artifact 닫기", exact: true }).click();
    await page.reload();
    await page.getByRole("button", { name: "Artifact 열기", exact: true }).click();
    await expect(editor).toHaveValue(expected);
    if (code) {
      await workspace.getByRole("button", { name: "안전 실행", exact: true }).click();
      await expect(workspace.getByTestId("code-output")).toHaveText("42");
    }
    if (mode === "analysis") {
      await expect(workspace.getByTestId("artifact-ai-suggestion")).toHaveText(result.result.suggestion);
    } else {
      await expect(workspace.getByTestId("artifact-ai-result")).toHaveCount(0);
    }
  });
}

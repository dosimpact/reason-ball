import { randomUUID } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";
import { test, expect, adminClient } from "./fixtures";

const origin = "http://dodonet.iptime.org:13000";

async function createPrivateConversation(request: APIRequestContext, title: string) {
  const characters = await request.get("/api/characters");
  expect(characters.ok()).toBe(true);
  const { items } = await characters.json() as { items: Array<{ id: string }> };
  expect(items.length, "At least one published character must be available").toBeGreaterThan(0);
  const response = await request.post("/api/conversations", {
    headers: { Origin: origin }, data: { characterId: items[0].id, title },
  });
  expect(response.ok(), `Create private conversation: HTTP ${response.status()}`).toBe(true);
  return (await response.json()).item as { id: string };
}

test.describe("Real guest identity and account switching", () => {
  test.use({ sessionKind: "guest" });

  test("creates a real anonymous identity and restores the same session after reload", async ({ page }) => {
    const created = page.waitForResponse((response) => response.url().endsWith("/api/auth/anonymous") && response.ok());
    await page.goto("/profile");
    const initial = (await (await created).json()).user;
    expect(initial.isAnonymous).toBe(true);
    expect((await adminClient().auth.admin.getUserById(initial.id)).data.user?.is_anonymous).toBe(true);
    await expect(page.getByTestId("auth-session")).toContainText("게스트");
    await page.reload();
    const restored = await page.request.get("/api/auth/session");
    expect((await restored.json()).user.id).toBe(initial.id);
    await expect(page.getByTestId("auth-session")).toContainText("게스트");
  });

  test("validates login, preserves guest after bad credentials, and explicitly switches to existing member", async ({ page, createAccount }) => {
    const member = await createAccount();
    const created = page.waitForResponse((response) => response.url().endsWith("/api/auth/anonymous") && response.ok());
    await page.goto("/profile");
    const guest = (await (await created).json()).user;
    const conversation = await createPrivateConversation(page.request, "Guest private auth regression");
    await page.getByTestId("auth-session").click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("이메일", { exact: true }).fill(member.email);
    await dialog.getByLabel("비밀번호", { exact: true }).fill("wrong-password-123");
    await dialog.getByRole("button", { name: "로그인", exact: true }).click();
    await expect(dialog.getByRole("checkbox")).not.toBeChecked();
    expect(await dialog.getByRole("checkbox").evaluate((node: HTMLInputElement) => node.validity.valueMissing)).toBe(true);
    await dialog.getByRole("checkbox").check();
    const failure = page.waitForResponse((response) => response.url().endsWith("/api/auth/email"));
    await dialog.getByRole("button", { name: "로그인", exact: true }).click();
    expect((await failure).ok()).toBe(false);
    await expect(dialog.getByRole("alert")).toBeVisible();
    expect((await (await page.request.get("/api/auth/session")).json()).user.id).toBe(guest.id);
    await dialog.getByLabel("비밀번호", { exact: true }).fill(member.password);
    const success = page.waitForResponse((response) => response.url().endsWith("/api/auth/email") && response.ok());
    await dialog.getByRole("button", { name: "로그인", exact: true }).click();
    expect((await success).ok()).toBe(true);
    await expect(page.getByTestId("auth-session")).toContainText(member.email);
    expect((await (await page.request.get("/api/auth/session")).json()).user.id).toBe(member.id);
    const inaccessible = await page.request.get(`/api/conversations/${conversation.id}/context`);
    expect(inaccessible.status()).toBe(404);
    await page.reload();
    await expect(page.getByTestId("auth-session")).toContainText(member.email);
  });
});

test("member logout creates a distinct guest and cannot read member conversations", async ({ page, account }) => {
  await page.goto("/profile");
  await expect(page.getByTestId("auth-session")).toContainText(account!.email);
  const conversation = await createPrivateConversation(page.request, "Member private logout regression");
  await page.getByTestId("auth-session").click();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page.getByTestId("auth-session")).toContainText("게스트");
  await expect.poll(async () => (await (await page.request.get("/api/auth/session")).json()).user?.isAnonymous).toBe(true);
  expect((await (await page.request.get("/api/auth/session")).json()).user.id).not.toBe(account!.id);
  expect((await page.request.get(`/api/conversations/${conversation.id}/context`)).status()).toBe(404);
});

test("verified member can set a password through UI and use it after logout", async ({ page, account }) => {
  await page.goto("/profile");
  await expect(page.getByTestId("auth-session")).toContainText(account!.email);
  await page.getByTestId("auth-session").click();
  const password = `E2e!${randomUUID()}a9`;
  await page.getByLabel("새 비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "비밀번호 설정", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("비밀번호를 설정했어요");
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page.getByTestId("auth-session")).toContainText("게스트");
  await page.getByTestId("auth-session").click();
  await page.getByRole("checkbox").check();
  await page.getByLabel("이메일", { exact: true }).fill(account!.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.getByTestId("auth-session")).toContainText(account!.email);
});

test("rejects foreign-origin logout and invalid auth payload without changing browser session", async ({ page, account }) => {
  await page.goto("/profile");
  await expect(page.getByTestId("auth-session")).toContainText(account!.email);
  const denied = await page.request.post("/api/auth/logout", { headers: { Origin: "https://untrusted.invalid" } });
  expect(denied.status()).toBe(403);
  const malformed = await page.request.post("/api/auth/email", {
    headers: { Origin: origin }, data: { action: "sign-in", email: "bad-email", password: "tiny" },
  });
  expect(malformed.status()).toBe(400);
  expect((await (await page.request.get("/api/auth/session")).json()).user.id).toBe(account!.id);
  await page.reload();
  await expect(page.getByTestId("auth-session")).toContainText(account!.email);
});

import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { adminClient, expect, signIn, test } from "./fixtures";

const origin = "http://dodonet.iptime.org:13000";
async function settings(page: Page) {
  await page.goto("/profile");
  await page.getByRole("tab", { name: "설정", exact: true }).click();
  await expect(page.getByTestId("profile-settings")).toContainText("현재 계정에 비공개로 저장합니다.");
  await expect(page.getByLabel("학습 목표", { exact: true })).toBeVisible();
}
async function record(userId: string) {
  const result = await adminClient().from("learner_preferences").select("revision, settings").eq("user_id", userId).single();
  expect(result.error).toBeNull();
  return result.data!;
}
async function save(page: Page) {
  const response = page.waitForResponse(response => new URL(response.url()).pathname === "/api/me/preferences" && response.request().method() === "PATCH");
  await page.getByRole("button", { name: "설정 저장", exact: true }).click();
  return response;
}

test("two tabs reject stale preferences, preserve draft, and reload only with confirmation", async ({ page, account }) => {
  // PREF-CONFLICT: same Auth cookie, independent mounted form baselines.
  await settings(page);
  const second = await page.context().newPage();
  try {
    await settings(second);
    const firstGoal = `Saved first tab ${randomUUID()}`;
    const unsavedGoal = `Preserve second tab ${randomUUID()}`;
    await second.getByLabel("학습 목표", { exact: true }).fill(unsavedGoal);
    await page.getByLabel("학습 목표", { exact: true }).fill(firstGoal);
    expect((await save(page)).status()).toBe(200);
    await expect(page.getByText("학습 설정을 저장했어요.", { exact: true })).toBeVisible();
    const committed = await record(account!.id);
    expect(committed.settings.learningGoal).toBe(firstGoal);
    const conflict = await save(second);
    expect(conflict.status()).toBe(409);
    expect((await conflict.json()).error.code).toBe("VERSION_CONFLICT");
    await expect(second.getByTestId("profile-settings").getByRole("alert")).toContainText("changed after it was loaded");
    await expect(second.getByLabel("학습 목표", { exact: true })).toHaveValue(unsavedGoal);
    expect(await record(account!.id)).toEqual(committed);
    second.once("dialog", dialog => dialog.dismiss());
    await second.getByRole("button", { name: "저장된 설정 다시 불러오기", exact: true }).click();
    await expect(second.getByLabel("학습 목표", { exact: true })).toHaveValue(unsavedGoal);
    expect(await record(account!.id)).toEqual(committed);
    second.once("dialog", dialog => dialog.accept());
    await second.getByRole("button", { name: "저장된 설정 다시 불러오기", exact: true }).click();
    await expect(second.getByLabel("학습 목표", { exact: true })).toHaveValue(firstGoal);
    await second.getByLabel("학습 목표", { exact: true }).fill(unsavedGoal);
    expect((await save(second)).status()).toBe(200);
    const next = await record(account!.id);
    expect(next.revision).toBe(committed.revision + 1);
    expect(next.settings.learningGoal).toBe(unsavedGoal);
    await settings(page);
    await expect(page.getByLabel("학습 목표", { exact: true })).toHaveValue(unsavedGoal);
  } finally { await second.close(); }
});

test("preferences remain separate between accounts and reject another owner's write", async ({ page, account, browser, createAccount }) => {
  // PREF-ACCOUNT: two real Auth owners; privileged reads only verify saved rows.
  await settings(page);
  const firstGoal = `Private owner one ${randomUUID()}`;
  await page.getByLabel("학습 목표", { exact: true }).fill(firstGoal);
  expect((await save(page)).status()).toBe(200);
  const firstRecord = await record(account!.id);
  const otherAccount = await createAccount();
  const other = await browser.newContext({ baseURL: origin });
  try {
    await signIn(other.request, otherAccount);
    const second = await other.newPage();
    await settings(second);
    await expect(second.getByLabel("학습 목표", { exact: true })).not.toHaveValue(firstGoal);
    const otherGoal = `Private owner two ${randomUUID()}`;
    await second.getByLabel("학습 목표", { exact: true }).fill(otherGoal);
    expect((await save(second)).status()).toBe(200);
    const otherRecord = await record(otherAccount.id);
    expect(otherRecord.settings.learningGoal).toBe(otherGoal);
    const forged = await other.request.patch("/api/me/preferences", { headers: { Origin: origin }, data: {
      expectedOwnerId: account!.id, expectedRevision: firstRecord.revision, settings: otherRecord.settings,
    } });
    expect(forged.status()).toBe(409);
    expect((await forged.json()).error.code).toBe("PREFERENCE_ACCOUNT_CHANGED");
    expect(await record(account!.id)).toEqual(firstRecord);
    expect(await record(otherAccount.id)).toEqual(otherRecord);
    await settings(page);
    await settings(second);
    await expect(page.getByLabel("학습 목표", { exact: true })).toHaveValue(firstGoal);
    await expect(second.getByLabel("학습 목표", { exact: true })).toHaveValue(otherGoal);
    const ownResponse = await other.request.get("/api/me/preferences");
    expect(ownResponse.ok()).toBe(true);
    expect((await ownResponse.json()).preferences.ownerId).toBe(otherAccount.id);
  } finally {
    try { expect((await other.request.post("/api/auth/logout", { headers: { Origin: origin } })).ok()).toBe(true); }
    finally { await other.close(); }
  }
});

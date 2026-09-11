import type { Page } from "@playwright/test";
import { adminClient, expect, test } from "./fixtures";
import { conversationReviewPrompt } from "../../../src/entities/chat/model/conversation-review";

// LEARN-06 detailed §11.3: actual saved settings must change provider behavior.
// One existing fixture browser/account per test; no route fulfillment or fake AI.
test.setTimeout(360_000);
type Settings = {
  correctionMode: "gentle" | "immediate" | "summary";
  koreanExplanation: "none" | "brief" | "detailed";
  responseLength: "short" | "standard" | "long";
};
const normalize = (text: string) => text.replace(/^\s*(?:[-+*]|\d+[.)])\s+/gm, "").replace(/[*_`#]/g, "").replace(/\s+/g, " ").trim();
const koreanCount = (text: string) => (text.match(/[가-힣]/g) ?? []).length;
const englishWords = (text: string) => (text.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? []).length;
const englishSentences = (text: string) => [...new Intl.Segmenter("en", { granularity: "sentence" }).segment(text)]
  .filter(({ segment }) => englishWords(segment) > 0).length;
const koreanSentences = (text: string) => [...new Intl.Segmenter("ko", { granularity: "sentence" }).segment(text)]
  .filter(({ segment }) => koreanCount(segment) >= 5).length;

async function settings(page: Page, ownerId: string, value: Settings) {
  await page.goto("/profile");
  await page.getByRole("tab", { name: "설정", exact: true }).click();
  await page.getByLabel("학습자 레벨", { exact: true }).selectOption("A1");
  await page.getByLabel("교정 방식", { exact: true }).selectOption(value.correctionMode);
  await page.getByLabel("한국어 설명 양", { exact: true }).selectOption(value.koreanExplanation);
  await page.getByLabel("답변 길이", { exact: true }).selectOption(value.responseLength);
  await page.getByRole("button", { name: "설정 저장", exact: true }).click();
  await expect(page.getByText("학습 설정을 저장했어요.", { exact: true })).toBeVisible();
  const stored = await adminClient().from("learner_preferences").select("settings").eq("user_id", ownerId).single();
  expect(stored.error).toBeNull();
  expect(stored.data?.settings).toEqual(expect.objectContaining({ ...value, learnerLevel: "A1" }));
  await page.reload();
  await page.getByRole("tab", { name: "설정", exact: true }).click();
  await expect(page.getByLabel("교정 방식", { exact: true })).toHaveValue(value.correctionMode);
  await expect(page.getByLabel("한국어 설명 양", { exact: true })).toHaveValue(value.koreanExplanation);
  await expect(page.getByLabel("답변 길이", { exact: true })).toHaveValue(value.responseLength);
}

async function openChat(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
  await page.getByRole("button", { name: "새 채팅", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "영어 메시지", exact: true })).toBeEnabled();
  await expect(page.getByTestId("chat-workspace")).toHaveAttribute("data-conversation-id", /^[0-9a-f-]{36}$/);
  return (await page.getByTestId("chat-workspace").getAttribute("data-conversation-id"))!;
}
async function messages(id: string) {
  const result = await adminClient().from("messages").select("id,role,status,plain_text").eq("conversation_id", id).order("sequence_number");
  expect(result.error).toBeNull();
  return result.data!;
}
async function finish(page: Page, id: string, previousCount: number) {
  await expect.poll(async () => (await messages(id)).filter(row => row.role === "assistant" && row.status === "complete" && row.plain_text.trim()).length,
    { timeout: 120_000 }).toBe(previousCount + 1);
  await expect(page.getByRole("button", { name: "메시지 보내기", exact: true })).toBeVisible();
  const text = (await messages(id)).filter(row => row.role === "assistant").at(-1)!.plain_text;
  await expect.poll(async () => normalize(await page.getByTestId("message-assistant").last().innerText())).toContain(normalize(text));
  await test.info().attach(`actual-ai-${id}-${previousCount + 1}`, { body: text, contentType: "text/plain" });
  return normalize(text);
}
async function send(page: Page, id: string, text: string) {
  const count = (await messages(id)).filter(row => row.role === "assistant" && row.status === "complete").length;
  await page.getByRole("textbox", { name: "영어 메시지", exact: true }).fill(text);
  await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  const answer = await finish(page, id, count);
  expect((await messages(id)).filter(row => row.role === "user").at(-1)?.plain_text).toBe(text);
  return answer;
}
async function restored(page: Page, id: string) {
  const before = await messages(id);
  await page.reload();
  await expect(page.getByTestId("chat-workspace")).toHaveAttribute("data-conversation-id", id);
  await expect(page.getByTestId("message-assistant")).toHaveCount(before.filter(row => row.role === "assistant").length);
  for (const [index, row] of before.filter(row => row.role === "assistant").entries()) {
    await expect.poll(async () => normalize(await page.getByTestId("message-assistant").nth(index).innerText())).toContain(normalize(row.plain_text));
  }
  expect(await messages(id)).toEqual(before);
}

const error = "Yesterday I go to the park.";
const corrected = "Yesterday I went to the park.";

test("LEARN-06 gentle responds before coaching; immediate corrects first and lets the learner try again", async ({ page, account }) => {
  await settings(page, account!.id, { correctionMode: "gentle", koreanExplanation: "brief", responseLength: "short" });
  const gentleId = await openChat(page);
  const gentle = await send(page, gentleId, error);
  const tipAt = gentle.indexOf("Quick tip:");
  expect(tipAt).toBeGreaterThan(10);
  expect(gentle.slice(0, tipAt)).toMatch(/park|enjoy|fun|nice|good|lovely|walk/i);
  expect(gentle.slice(tipAt)).toMatch(/\bwent\b/i);
  expect(gentle.match(/Quick tip:/g)).toHaveLength(1);
  await restored(page, gentleId);

  await settings(page, account!.id, { correctionMode: "immediate", koreanExplanation: "brief", responseLength: "short" });
  const immediateId = await openChat(page);
  expect(immediateId).not.toBe(gentleId);
  const immediate = await send(page, immediateId, error);
  expect(immediate).toMatch(/^Correction:/);
  expect(immediate).toMatch(/Yesterday,? I went to the park\./i);
  expect(immediate.indexOf("Try again:")).toBeGreaterThan(immediate.indexOf("Correction:"));
  const continuation = await send(page, immediateId, corrected);
  expect(continuation).not.toMatch(/Correction:|Try again:/);
  expect((await messages(immediateId)).filter(row => row.role === "user").map(row => row.plain_text)).toEqual([error, corrected]);
  await restored(page, immediateId);
});

test("LEARN-06 summary waits through errors then reviews actual learner turns while preserving draft and awarding nothing", async ({ page, account }) => {
  await settings(page, account!.id, { correctionMode: "summary", koreanExplanation: "brief", responseLength: "standard" });
  const id = await openChat(page);
  const secondError = "I buy an apple there yesterday.";
  for (const phrase of [error, secondError]) {
    const answer = await send(page, id, phrase);
    expect(answer).not.toMatch(/Quick tip:|Correction:|Try again:|you (?:should|need to) say|correct (?:form|sentence)|past tense|과거형|교정/i);
    expect(answer).toMatch(/park|apple|fruit|enjoy|buy|bought|walk|yesterday/i);
  }
  const before = await messages(id);
  const beforeXp = await adminClient().from("profiles").select("experience_points").eq("id", account!.id).single();
  expect(beforeXp.error).toBeNull();
  // The action must preserve even a draft equal to its generated request text.
  const draft = `  ${conversationReviewPrompt}  `;
  const input = page.getByRole("textbox", { name: "영어 메시지", exact: true });
  await input.fill(draft);
  await page.getByRole("button", { name: "대화 마치고 복습하기", exact: true }).click();
  const review = await finish(page, id, 2);
  expect(review.toLowerCase()).toContain(error.toLowerCase());
  expect(review.toLowerCase()).toContain(secondError.toLowerCase());
  expect(review).toMatch(/Yesterday,? I went to the park\./i);
  expect(review).toMatch(/I bought an apple there yesterday\./i);
  const after = await messages(id);
  expect(after.slice(0, before.length)).toEqual(before);
  expect(after.filter(row => row.role === "user")).toHaveLength(3);
  expect(after.filter(row => row.role === "user").at(-1)?.plain_text).toBe(conversationReviewPrompt);
  await expect(input).toHaveValue(draft);
  for (const [table, ownerColumn] of [["mission_runs", "owner_id"], ["reward_unlocks", "user_id"]] as const) {
    const result = await adminClient().from(table).select("id").eq(ownerColumn, account!.id);
    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  }
  const afterXp = await adminClient().from("profiles").select("experience_points").eq("id", account!.id).single();
  expect(afterXp.error).toBeNull();
  expect(afterXp.data).toEqual(beforeXp.data);
  await restored(page, id);
  await expect(input).toHaveValue(draft);
});

test("LEARN-06 A1 minor capitalization and punctuation do not trigger coaching on every turn", async ({ page, account }) => {
  await settings(page, account!.id, { correctionMode: "immediate", koreanExplanation: "brief", responseLength: "short" });
  const id = await openChat(page);
  const replies = [];
  for (const phrase of ["i like apples", "my favorite color is blue"]) replies.push(await send(page, id, phrase));
  for (const answer of replies) {
    expect(answer).not.toMatch(/Correction:|Try again:|Quick tip:|capitaliz|capital letter|punctuation|대문자|마침표/i);
  }
  expect(replies[0]).toMatch(/apples?|fruit/i);
  expect(replies[1]).toMatch(/blue|colou?r/i);
});

test("LEARN-06 none, brief and detailed Korean explanation settings change actual correction explanations", async ({ page, account }) => {
  const replies: Record<string, string> = {};
  for (const koreanExplanation of ["none", "brief", "detailed"] as const) {
    await settings(page, account!.id, { correctionMode: "immediate", koreanExplanation, responseLength: "standard" });
    replies[koreanExplanation] = await send(page, await openChat(page), error);
    expect(replies[koreanExplanation]).toMatch(/^Correction:/);
    expect(replies[koreanExplanation]).toMatch(/Yesterday,? I went to the park\./i);
    expect(replies[koreanExplanation]).toContain("Try again:");
  }
  expect(koreanCount(replies.none)).toBe(0);
  expect(koreanCount(replies.brief)).toBeGreaterThanOrEqual(5);
  expect(koreanCount(replies.detailed)).toBeGreaterThan(koreanCount(replies.brief));
  expect(koreanSentences(replies.brief)).toBe(1);
  expect(koreanSentences(replies.detailed)).toBeGreaterThanOrEqual(2);
  expect(koreanSentences(replies.detailed)).toBeLessThanOrEqual(3);
  expect(replies.detailed).toMatch(/과거|어제/);
  expect(replies.detailed).toMatch(/\bgo\b/);
  expect(replies.detailed).toMatch(/\bwent\b/);
});

test("LEARN-06 short and long answer settings change actual response length for the same ordinary request", async ({ page, account }) => {
  const replies: Record<string, string> = {};
  for (const responseLength of ["short", "long"] as const) {
    await settings(page, account!.id, { correctionMode: "summary", koreanExplanation: "none", responseLength });
    replies[responseLength] = await send(page, await openChat(page), "What can I do at a park on a sunny day?");
    expect(replies[responseLength]).toMatch(/walk|picnic|play|read|relax/i);
    expect(koreanCount(replies[responseLength])).toBe(0);
  }
  expect(englishSentences(replies.short)).toBeGreaterThanOrEqual(1);
  expect(englishSentences(replies.short)).toBeLessThanOrEqual(2);
  expect(englishSentences(replies.long)).toBeGreaterThanOrEqual(5);
  expect(englishSentences(replies.long)).toBeLessThanOrEqual(6);
});

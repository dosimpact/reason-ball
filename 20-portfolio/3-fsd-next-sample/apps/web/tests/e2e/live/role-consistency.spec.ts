import { randomInt, randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { adminClient, expect, test } from "./fixtures";

const headers = { Origin: "http://dodonet.iptime.org:13000" };
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHmsAAAAASUVORK5CYII=";
test.setTimeout(240_000);
async function rows(id: string) {
  const result = await adminClient().from("messages").select("id,role,status,plain_text").eq("conversation_id", id).order("sequence_number");
  expect(result.error).toBeNull(); return result.data!;
}
async function send(page: Page, id: string, text: string, count: number) {
  await page.getByTestId("chat-input").fill(text);
  const pending = page.waitForResponse(r => new URL(r.url()).pathname === "/api/ai/chat" && r.request().method() === "POST");
  await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  const response = await pending;
  expect(response.ok()).toBe(true); expect(response.headers()["x-ai-provider"]).not.toBe("mock");
  await expect.poll(async () => (await rows(id)).filter(r => r.role === "assistant" && r.status === "complete").length, { timeout: 90_000 }).toBe(count);
  const answer = (await rows(id)).filter(r => r.role === "assistant").at(-1)!.plain_text as string;
  await expect(page.getByTestId("message-assistant").last()).toHaveAttribute("data-message-id", (await rows(id)).at(-1)!.id);
  await expect(page.getByTestId("message-assistant").last()).toBeVisible();
  // Explicitly authored numerical style, not a universal CEFR/personality rubric.
  expect(answer.trim().split(/\s+/).length).toBeLessThanOrEqual(60);
  expect((answer.match(/\?/g) ?? []).length).toBeLessThanOrEqual(1);
  return answer;
}
async function version(table: string, id: string) {
  const result = await adminClient().from(table).select("current_version_id").eq("id", id).single();
  expect(result.error).toBeNull(); return result.data!.current_version_id as string;
}
async function start(page: Page, id: string) {
  await page.goto(`/missions/${id}`);
  const pending = page.waitForResponse(r => new URL(r.url()).pathname === "/api/mission-runs" && r.request().method() === "POST");
  await page.getByTestId("start-mission").click();
  const response = await pending; expect(response.ok()).toBe(true);
  const { run } = await response.json() as { run: { id: string; conversationId: string } };
  await expect(page.getByTestId("chat-input")).toBeEnabled();
  await expect(page.getByTestId("conversation-id")).toHaveText(run.conversationId);
  return run;
}

// Identity facts are authored only in published fixtures, never in learner prompts.
// Three turns test observable role/style continuity, not every personality nuance.
test("LEARN-03 three real turns retain pinned persona and mission while a fresh conversation uses the new roles", async ({ page }) => {
  const oldName = ["Avery", "Brielle", "Clara", "Daphne", "Elena", "Flora", "Gemma", "Hazel"][randomInt(8)];
  const newName = ["Iris", "Jade", "Kira", "Lena", "Mabel", "Nora", "Olive", "Paige"][randomInt(8)];
  const characterDraft = {
    name: oldName, role: "Patient hotel receptionist", tagline: "Welcome to our hotel front desk.",
    description: "A patient receptionist helping nervous guests check into a hotel.", personality: ["patient", "encouraging"],
    personaGoal: "Help nervous guests feel welcome at the hotel front desk.", learningGoal: "Practice hotel check-in and a fictional reservation name.",
    speakingStyle: "Use simple English, at most 60 words and at most one question per reply. Answer directly, then offer one small next step.",
    relationship: "Hotel receptionist and arriving guest", teachingStyle: "Reassure nervous guests and help them say one short sentence.",
    prohibitedInstructions: ["Never ask for real personal data."], accent: "American", level: "입문", topics: ["여행"],
    palette: ["#ff8067", "#ffc65c"], emoji: "🌱", visibility: "public", publishStatus: "published", imageUrl: png,
  };
  const created = await page.request.post("/api/characters", { headers, data: characterDraft });
  expect(created.ok()).toBe(true);
  const characterId = (await created.json()).item.id as string;
  const missionDraft = {
    title: `Hotel check-in ${randomUUID()}`, subtitle: "A guest arrives at a hotel.", description: "Help a guest greet the receptionist and give a fictional reservation name.",
    category: "여행", location: "Hotel front desk", difficulty: "입문", durationMinutes: 3,
    learnerRole: "Arriving hotel guest", characterRole: "Patient hotel receptionist",
    objectives: [{ id: "reservation", label: "Give a fictional reservation name", hint: "My reservation is under Alex." }],
    steps: [{ id: "reservation", label: "Give a fictional reservation name", hint: "My reservation is under Alex.", required: true, successCriteria: ["Learner gives a fictional reservation name"] }],
    keyPhrases: [{ english: "My reservation is under Alex.", korean: "알렉스라는 이름으로 예약했어요." }],
    successThreshold: 70, prerequisites: [], rewardTitle: "Practice keepsake", rewardPalette: ["#ff8067", "#ffc65c"], rewardEmoji: "🌱",
    rewardImageUrl: png, recommendedCharacterId: characterId, publishStatus: "published",
  };
  const missionResponse = await page.request.post("/api/missions", { headers, data: missionDraft });
  expect(missionResponse.ok()).toBe(true);
  const missionId = (await missionResponse.json()).item.id as string;
  const pinned = { character_version_id: await version("characters", characterId), mission_version_id: await version("missions", missionId) };
  async function oldVersions() {
    const character = await adminClient().from("character_versions").select("*").eq("id", pinned.character_version_id).single();
    const mission = await adminClient().from("mission_versions").select("*").eq("id", pinned.mission_version_id).single();
    expect(character.error).toBeNull(); expect(mission.error).toBeNull();
    return { character: character.data, mission: mission.data };
  }
  const immutable = await oldVersions();
  const run = await start(page, missionId);
  const introduction = "Hello. What is your name and what do you do here?";
  const first = await send(page, run.conversationId, introduction, 1);
  expect(first).toContain(oldName); expect(first).toMatch(/hotel|reception|front desk|check[ -]?in/i);
  const changedCharacter = await page.request.patch(`/api/characters/${characterId}`, { headers, data: {
    action: "create-version", expectedVersion: 1, draft: { ...characterDraft, name: newName, role: "Patient dental receptionist",
      tagline: "Welcome to our dental clinic.", description: "A dental receptionist arranging appointments at a dental clinic.",
      personaGoal: "Help patients arrange dental appointments.", learningGoal: "Practice arranging a dental appointment.",
      relationship: "Dental receptionist and patient", teachingStyle: "Reassure nervous patients and arrange an appointment." },
  } });
  expect(changedCharacter.ok()).toBe(true);
  const changedMission = await page.request.patch(`/api/missions/${missionId}`, { headers, data: {
    action: "create-version", expectedVersion: 1, draft: { ...missionDraft, title: `Dental appointment ${randomUUID()}`,
      subtitle: "A patient arranges a dental appointment.", description: "Help the learner request an appointment at a dental clinic.",
      location: "Dental clinic", learnerRole: "Dental patient", characterRole: "Patient dental receptionist",
      objectives: [{ id: "appointment", label: "Request a dental appointment", hint: "I need a dental appointment." }],
      steps: [{ id: "appointment", label: "Request a dental appointment", hint: "I need a dental appointment.", required: true, successCriteria: ["Learner requests a dental appointment"] }],
      keyPhrases: [{ english: "I need a dental appointment.", korean: "치과 예약이 필요해요." }] },
  } });
  expect(changedMission.ok()).toBe(true);
  const latest = { character_version_id: await version("characters", characterId), mission_version_id: await version("missions", missionId) };
  expect(latest.character_version_id).not.toBe(pinned.character_version_id); expect(latest.mission_version_id).not.toBe(pinned.mission_version_id);
  const second = await send(page, run.conversationId, "I am nervous and do not know what to say next.", 2);
  expect(second).toMatch(/reserv|book|check[ -]?in|hotel|name/i);
  expect(second).toMatch(/okay|\bok\b|worr|help|together|step|easy|relax|fine|start|slow|no problem|time/i);
  expect(second).not.toContain(newName);
  await page.reload();
  await expect(page.getByTestId("conversation-id")).toHaveText(run.conversationId);
  const third = await send(page, run.conversationId, "Please remind me who you are and what we are practicing. What should I do next?", 3);
  expect(third).toContain(oldName); expect(third).toMatch(/hotel|reserv|check[ -]?in/i);
  expect(third).not.toContain(newName); expect(third).not.toMatch(/dental|dentist/i);
  for (const table of ["conversations", "mission_runs"]) {
    const result = await adminClient().from(table).select("character_version_id,mission_version_id").eq("id", table === "conversations" ? run.conversationId : run.id).single();
    expect(result.error).toBeNull(); expect(result.data).toEqual(pinned);
  }
  expect(await oldVersions()).toEqual(immutable);
  const renderedThird = await page.getByTestId("message-assistant").last().innerText();
  const saved = await rows(run.conversationId);
  expect(saved).toHaveLength(6); expect(saved.every(row => row.status === "complete")).toBe(true);
  await page.reload();
  await expect(page.getByTestId("message-assistant")).toHaveCount(3);
  await expect(page.getByTestId("message-assistant").last()).toHaveText(renderedThird, { useInnerText: true });
  expect(await rows(run.conversationId)).toEqual(saved);
  // Positive control: latest published versions must actually be usable in a new run.
  const fresh = await start(page, missionId);
  expect(fresh.conversationId).not.toBe(run.conversationId);
  const control = await send(page, fresh.conversationId, introduction, 1);
  expect(control).toContain(newName); expect(control).toMatch(/dental|dentist/i); expect(control).not.toContain(oldName);
  const controlRow = await adminClient().from("conversations").select("character_version_id,mission_version_id").eq("id", fresh.conversationId).single();
  expect(controlRow.error).toBeNull(); expect(controlRow.data).toEqual(latest);
});

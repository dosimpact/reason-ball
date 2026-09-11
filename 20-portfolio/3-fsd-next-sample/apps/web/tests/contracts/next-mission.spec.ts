import { expect, test } from "@playwright/test";
import type { Character, Mission } from "../../src/shared/api/learning/contracts";
import { selectNextMission } from "../../src/features/mission-reward/model/next-mission";

function character(id = "public", overrides: Partial<Character> = {}): Character {
  return { id, name: id, role: "Receptionist", tagline: "Practice", description: "Practice English", personality: [], personaGoal: "Help", learningGoal: "Greet", speakingStyle: "Short", accent: "neutral", level: "입문", topics: [], palette: ["#fff", "#000"], emoji: "🙂", visibility: "public", publishStatus: "published", creator: "test", learnerCount: 0, rating: 0, createdAt: "2026-09-11", ...overrides };
}
function mission(id: string, overrides: Partial<Mission> = {}): Mission {
  return { id, title: id, subtitle: "Practice", description: "Practice", category: "travel", location: "hotel", difficulty: "입문", durationMinutes: 5, objectives: [], keyPhrases: [], prerequisites: [], rewardTitle: "Practice", rewardPalette: ["#fff", "#000"], rewardEmoji: "🙂", recommendedCharacterId: "public", publishStatus: "published", learnerCount: 0, createdAt: "2026-09-11", ...overrides };
}

test("recommendations exclude unavailable, already learned, too difficult and unmet prerequisite missions", () => {
  const characters = [character(), character("private", { visibility: "private" }), character("draft", { publishStatus: "draft" }), character("archived", { publishStatus: "archived" })];
  const ineligible = [mission("current"), mission("completed"), mission("draft", { publishStatus: "draft" }),
    mission("archived", { publishStatus: "archived" }), mission("unknown-status", { publishStatus: undefined }),
    mission("private-character", { recommendedCharacterId: "private" }), mission("draft-character", { recommendedCharacterId: "draft" }),
    mission("archived-character", { recommendedCharacterId: "archived" }), mission("missing-character", { recommendedCharacterId: "missing" }),
    mission("too-hard", { difficulty: "중급" }), mission("unmet", { prerequisites: ["completed", "missing"] }),
    mission("unknown-prerequisite-text", { prerequisites: ["Know how to greet someone"] })];
  const base = { characters, currentId: "current", completedIds: ["completed"], level: "A2" as const };
  // Every exclusion must hold independently, not merely lose to a better-ranked item.
  for (const candidate of ineligible) expect(selectNextMission({ ...base, missions: [candidate] }), candidate.id).toBeUndefined();
  const eligible = mission("eligible", { difficulty: "초급", prerequisites: ["completed"] });
  expect(selectNextMission({ ...base, missions: [...ineligible, eligible] })).toBe(eligible);
});

test("a newly unlocked direct continuation takes priority only after its prerequisite is completed", () => {
  const direct = mission("z-next", { prerequisites: ["current"] });
  const peer = mission("a-peer", { difficulty: "초급" });
  const input = { missions: [peer, direct], characters: [character()], currentId: "current", level: "A2" as const };
  expect(selectNextMission({ ...input, completedIds: [] })).toBe(peer);
  expect(selectNextMission({ ...input, completedIds: ["current"] })).toBe(direct);
  expect(selectNextMission({ ...input, completedIds: ["current", direct.id] })).toBe(peer);
});

test("CEFR ceiling, nearest available difficulty and ID ties are deterministic without mutating caller data", () => {
  const low = mission("low");
  const middleZ = mission("z-middle", { difficulty: "초급" });
  const middleA = mission("a-middle", { difficulty: "초급" });
  const high = mission("high", { difficulty: "중급" });
  const missions = Object.freeze([middleZ, high, low, middleA].map(item => Object.freeze(item)));
  const characters = Object.freeze([Object.freeze(character())]);
  const completedIds = Object.freeze(["older-mission"]);
  const before = JSON.stringify({ missions, characters, completedIds });
  const input = { missions, characters, completedIds, currentId: "current" };
  for (const level of ["PRE_A1", "A1"] as const) expect(selectNextMission({ ...input, level })).toBe(low);
  expect(selectNextMission({ ...input, level: "A2" })).toBe(middleA);
  expect(selectNextMission({ ...input, missions: [...missions].reverse(), level: "A2" })).toBe(middleA);
  for (const level of ["B1", "B2", "C1", "C2"] as const) expect(selectNextMission({ ...input, level })).toBe(high);
  expect(JSON.stringify({ missions, characters, completedIds })).toBe(before);
  expect(selectNextMission({ ...input, missions: [], level: "A1" })).toBeUndefined();
  expect(selectNextMission({ ...input, characters: [], level: "A1" })).toBeUndefined();
  expect(selectNextMission({ ...input, missions: [mission("legacy", { prerequisites: undefined })], level: "A1" })?.id).toBe("legacy");
});

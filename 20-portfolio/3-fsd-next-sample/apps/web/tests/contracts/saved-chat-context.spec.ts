import { expect, test } from "@playwright/test";
import { seedCharacters, seedMissions } from "../../src/shared/api/learning/mock-data";
import { validateSavedChatContext } from "../../src/widgets/chat-workspace/model/saved-context";

const character = seedCharacters[0];
const mission = seedMissions[0];
const context = { conversationId: "chat", character, mission, characterAliases: [character.id, "alias"], missionAliases: [mission.id] };
const route = { conversationId: "chat", characterId: character.id, missionId: mission.id };

test("restores the saved mission even when the route omits its optional query", () => {
  const before = structuredClone(context);
  expect(validateSavedChatContext(context, { ...route, missionId: undefined })).toBe(context);
  expect(validateSavedChatContext(context, { ...route, characterId: "alias" })).toBe(context);
  expect(context).toEqual(before);
});

test("rejects foreign conversation, character and mission routes", () => {
  for (const field of ["conversationId", "characterId", "missionId"] as const) {
    expect(() => validateSavedChatContext(context, { ...route, [field]: "other" })).toThrow("일치하지");
  }
});

test("never downgrades a requested mission into free chat or trusts inconsistent aliases", () => {
  expect(() => validateSavedChatContext({ ...context, mission: undefined, missionAliases: [] }, route)).toThrow();
  expect(() => validateSavedChatContext({ ...context, characterAliases: ["alias"] }, { ...route, characterId: "alias" })).toThrow();
  expect(() => validateSavedChatContext({ ...context, missionAliases: [] }, { ...route, missionId: undefined })).toThrow();
  expect(validateSavedChatContext({ ...context, mission: undefined, missionAliases: [] }, { ...route, missionId: undefined }).mission).toBeUndefined();
});

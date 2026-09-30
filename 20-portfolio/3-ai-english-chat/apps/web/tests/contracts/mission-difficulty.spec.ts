import { test, expect } from "@playwright/test";
import { readMissionDifficulty, writeMissionDifficulty } from "../../src/shared/api/supabase/mission-difficulty";

test("mission difficulty preserves the authored level through storage and does not classify B1 as beginner", () => {
  for (const level of ["입문", "초급", "중급"] as const) expect(readMissionDifficulty(writeMissionDifficulty(level))).toBe(level);
  expect(readMissionDifficulty("pre-A1")).toBe("입문");
  expect(readMissionDifficulty("A2")).toBe("초급");
  for (const level of ["B1", "B2", "C1", "C2"]) expect(readMissionDifficulty(level)).toBe("중급");
});

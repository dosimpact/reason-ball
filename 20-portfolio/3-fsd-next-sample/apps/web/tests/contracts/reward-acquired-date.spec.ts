import { expect, test } from "@playwright/test";
import { formatRewardAcquiredDate } from "../../src/features/mission-reward/model/reward-acquired-date";

test("reward acquisition dates use the persisted instant and explicit Korea midnight", () => {
  expect(formatRewardAcquiredDate("2026-09-10T14:59:59.999Z")).toBe("2026. 09. 10. (한국 시간)");
  expect(formatRewardAcquiredDate("2026-09-10T15:00:00Z")).toBe("2026. 09. 11. (한국 시간)");
  expect(formatRewardAcquiredDate("2026-09-11T00:00:00+09:00")).toBe("2026. 09. 11. (한국 시간)");
  expect(formatRewardAcquiredDate("2020-12-31T23:30:00Z")).toBe("2021. 01. 01. (한국 시간)");
});

test("missing or invalid acquisition timestamps never become today's date", () => {
  for (const value of ["", " ", "not-a-date"]) expect(formatRewardAcquiredDate(value)).toBeNull();
});

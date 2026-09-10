import { expect, test } from "@playwright/test";
import { seedMissions } from "../../src/shared/api/learning/mock-data";
import { readMissionPrerequisites } from "../../src/shared/api/supabase/mission-version-fields";

for (const restricted of [false, true]) {
  test(`MISSION-09 restores ${restricted ? "explicit prerequisite gating" : "an unrestricted mission"} from version settings`, async ({ page }) => {
    // Local UI fixture uses the real adapter decoder, not a live Supabase query.
    const config = restricted ? { prerequisites: ["coffee-order"] } : { successThreshold: 75 };
    const missions = seedMissions.map((mission) => mission.id === "hotel-check-in"
      ? { ...mission, prerequisites: readMissionPrerequisites(config) }
      : mission);
    await page.addInitScript((missions) => {
      if (sessionStorage.getItem("mission-prerequisite-fixture")) return;
      localStorage.clear();
      localStorage.setItem("lingua-character-lab", JSON.stringify({ version: 1, state: { missions, completedMissionIds: [] } }));
      sessionStorage.setItem("mission-prerequisite-fixture", "1");
    }, missions);
    await page.goto("/missions/hotel-check-in");
    await expect(page.getByTestId("mission-detail")).toBeVisible();
    if (restricted) {
      await expect(page.getByTestId("mission-prerequisite-gate")).toContainText("선수 미션을 먼저 완료");
      await expect(page.getByTestId("start-mission")).toHaveCount(0);
      await page.reload();
      await expect(page.getByTestId("mission-prerequisite-gate")).toBeVisible();
      // Seed completed learner state; reward/evaluation integrity has separate tests.
      await page.evaluate(() => {
        const stored = JSON.parse(localStorage.getItem("lingua-character-lab")!);
        stored.state.completedMissionIds = ["coffee-order"];
        localStorage.setItem("lingua-character-lab", JSON.stringify(stored));
      });
      await page.reload();
    }
    await expect(page.getByTestId("mission-prerequisite-gate")).toHaveCount(0);
    await expect(page.getByTestId("start-mission")).toBeVisible();
    await expect(page.getByTestId("start-mission")).toHaveAttribute("href", "/chat/mia-hotelier?mission=hotel-check-in&attempt=new");
    await page.getByTestId("start-mission").click();
    await expect(page).toHaveURL((url) => url.pathname === "/chat/mia-hotelier"
      && url.searchParams.get("mission") === "hotel-check-in"
      && Boolean(url.searchParams.get("conversation"))
      && !url.searchParams.has("attempt"));
    await expect(page.getByTestId("chat-workspace")).toBeVisible();
    await expect(page.getByTestId("mission-evaluation-panel")).toBeVisible();
  });
}

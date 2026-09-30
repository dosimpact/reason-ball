import { expect, test } from "@playwright/test";
import { seedCharacters, seedMissions } from "../../src/shared/api/learning/mock-data";
import { installCleanAppState } from "./test-setup";

test("legacy browser creations migrate and ownership is independent of display metadata", async ({ page }) => {
  await installCleanAppState(page);
  await page.goto("/profile");
  await expect(page.getByTestId("profile-page")).toHaveAttribute("data-hydrated", "true");
  await page.evaluate(({ characters, missions }) => {
    localStorage.setItem("lingua-character-lab", JSON.stringify({ version: 1, state: {
      characters: [...characters, { ...characters[0], id: "local-owner-character", name: "Local Owner", creator: "Renamed creator", publishStatus: "draft" }],
      missions: [...missions, { ...missions[0], id: "local-owner-mission", title: "Owned Popular Mission", learnerCount: 500, publishStatus: "published" }],
      xp: 1400,
    } }));
  }, { characters: seedCharacters, missions: seedMissions });
  await page.reload();
  await page.getByRole("tab", { name: "내 생성물" }).click();
  await expect(page.getByTestId("profile-creations")).toContainText("이 브라우저에서 만든 데모 콘텐츠");
  await expect(page.getByTestId("profile-created-character-local-owner-character")).toContainText("Local Owner");
  await expect(page.getByTestId("profile-created-mission-local-owner-mission")).toContainText("Owned Popular Mission");
  await expect(page.getByTestId(`profile-created-mission-${seedMissions[0].id}`)).toHaveCount(0);
  const migrated = await page.evaluate(() => JSON.parse(localStorage.getItem("lingua-character-lab")!));
  expect(migrated.version).toBe(2);
  expect(migrated.state.ownedCharacterIds).toEqual(["local-owner-character"]);
  expect(migrated.state.ownedMissionIds).toEqual(["local-owner-mission"]);
  expect(migrated.state.xp).toBe(1400);
  await page.goto("/characters/local-owner-character/edit");
  await expect(page.getByTestId("character-name")).toHaveValue("Local Owner");
  await page.goto("/missions/local-owner-mission/edit");
  await expect(page.getByTestId("mission-title")).toHaveValue("Owned Popular Mission");
  await page.goto(`/missions/${seedMissions[0].id}/edit`);
  await expect(page.getByRole("heading", { name: "편집할 수 없는 콘텐츠예요." })).toBeVisible();
  await expect(page.getByTestId("mission-title")).toHaveCount(0);
});

test("corrupt browser ownership reports an error without replacing stored data", async ({ page }) => {
  await installCleanAppState(page);
  await page.goto("/profile");
  await expect(page.getByTestId("profile-page")).toHaveAttribute("data-hydrated", "true");
  await page.evaluate(() => localStorage.setItem("lingua-character-lab", '{"version":1,"state":{"missions":"corrupt"}}'));
  await page.reload();
  await page.getByRole("tab", { name: "내 생성물" }).click();
  await expect(page.getByRole("button", { name: "내 생성물 다시 불러오기" })).toBeVisible();
  await expect(page.getByTestId("profile-creations")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("lingua-character-lab"))).toBe('{"version":1,"state":{"missions":"corrupt"}}');
});

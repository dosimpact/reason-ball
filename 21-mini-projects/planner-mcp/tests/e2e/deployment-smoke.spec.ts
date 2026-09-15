import { expect, test } from "@playwright/test";

test("배포 진입 화면이 프로젝트 조회를 완료한다", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/?name=Hello&description=");

  await expect(page).toHaveTitle("Planner MCP · Design Workspace");
  await expect(
    page.getByRole("heading", { name: "프로젝트 목록", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "프로젝트 로딩" }),
  ).toBeHidden({ timeout: 10_000 });
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

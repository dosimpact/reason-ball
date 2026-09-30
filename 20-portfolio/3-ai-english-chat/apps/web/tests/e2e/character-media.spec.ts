import { expect, test } from "@playwright/test";
import { installCleanAppState } from "./test-setup";

// MEDIA-GOOGLE-02: browser transport mocks prove recovery, not Google generation.
for (const failureStatus of [403, 502]) {
  test(`video ${failureStatus} recovery preserves prompt and never automatically creates a paid job`, async ({ page }) => {
    await installCleanAppState(page);
    let posts = 0;
    let polls = 0;
    await page.route("**/api/ai/video**", async route => {
      if (route.request().method() === "POST") {
        posts += 1;
        await route.fulfill({ json: { operationToken: `test-operation-${posts}`, status: "pending" } });
      } else {
        polls += 1;
        await route.fulfill({ status: failureStatus, json: { error: { message: "Video request unavailable" } } });
      }
    });
    await page.goto("/chat/mia-hotelier");
    await page.getByRole("button", { name: "영상 생성", exact: true }).click();
    const prompt = page.getByLabel("만들고 싶은 장면");
    await prompt.fill("Two friends ordering coffee at a sunny cafe");
    const start = page.getByRole("button", { name: "영상 생성 시작", exact: true });
    await start.click();
    await expect(page.getByRole("alert").filter({ hasText: "Video request unavailable" })).toBeVisible();
    await expect(start).toBeDisabled();
    await page.getByRole("button", { name: "생성 상태 확인", exact: true }).click();
    await expect.poll(() => polls).toBe(2);
    expect(posts).toBe(1);
    await page.getByRole("button", { name: "미디어 생성 닫기" }).click();
    await page.getByRole("button", { name: "영상 생성", exact: true }).click();
    await expect(start).toBeDisabled();
    await page.getByRole("button", { name: "현재 요청 확인 종료", exact: true }).click();
    await expect(start).toBeEnabled();
    await expect(prompt).toHaveValue("Two friends ordering coffee at a sunny cafe");
    await expect(page.getByRole("button", { name: "생성 상태 확인", exact: true })).toHaveCount(0);
    expect(posts).toBe(1);
    await start.click();
    await expect.poll(() => posts).toBe(2);
  });
}

test("image failure retains the scene description and the previous preview", async ({ page }) => {
  await installCleanAppState(page);
  await page.goto("/chat/mia-hotelier");
  await page.getByRole("button", { name: "이미지 생성", exact: true }).click();
  await page.getByLabel("만들고 싶은 장면").fill("A welcoming hotel lobby with warm afternoon light");
  await page.getByRole("button", { name: "장면 이미지 만들기", exact: true }).click();
  const preview = page.getByRole("img", { name: "직접 요청해 생성한 캐릭터 장면" });
  await expect(preview).toBeVisible();
  const source = await preview.getAttribute("src");
  await page.route("**/api/ai/image", route => route.fulfill({ status: 503, json: { error: { message: "Image unavailable" } } }));
  await page.getByRole("button", { name: "장면 이미지 만들기", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Image unavailable" })).toBeVisible();
  await expect(preview).toHaveAttribute("src", source!);
  await expect(page.getByLabel("만들고 싶은 장면")).toHaveValue("A welcoming hotel lobby with warm afternoon light");
});

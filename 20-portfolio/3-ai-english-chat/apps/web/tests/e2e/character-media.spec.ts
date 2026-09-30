import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { installCleanAppState } from "./test-setup";

// MEDIA-GOOGLE-02: browser transport mocks prove recovery, not Google generation.
test("mock video moves from pending to a playable 3s MP4 and downloads without another POST", async ({ page }, testInfo) => {
  await installCleanAppState(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = readFileSync("tests/fixtures/mock-video-3s.mp4");
  let posts = 0;
  let polls = 0;
  await page.route("**/api/ai/video**", async route => {
    if (route.request().method() === "POST") {
      posts++;
      return route.fulfill({ json: { operationToken: "mock-operation", status: "pending" } });
    }
    expect(new URL(route.request().url()).searchParams.get("token")).toBe("mock-operation");
    polls++;
    return polls < 3
      ? route.fulfill({ json: { status: "pending", pollAfterMs: 10000 } })
      : route.fulfill({ contentType: "video/mp4", body: fixture });
  });
  await page.goto("/chat/mia-hotelier");
  await page.getByRole("button", { name: "영상 생성", exact: true }).click();
  await page.getByLabel("만들고 싶은 장면").fill("A calm cafe scene for a mock video playback test");
  const start = page.getByRole("button", { name: "영상 생성 시작", exact: true });
  const check = page.getByRole("button", { name: "생성 상태 확인", exact: true });
  await start.click();
  await expect.poll(() => polls).toBe(1);
  await expect(start).toBeDisabled();
  await check.click();
  await expect.poll(() => polls).toBe(2);
  await expect(start).toBeDisabled();
  await check.click();
  const video = page.locator("video");
  await expect(video).toHaveAttribute("src", /^blob:/);
  await expect.poll(() => video.evaluate(node => (node as HTMLVideoElement).duration)).toBeCloseTo(3, 1);
  expect(await video.evaluate(node => (node as HTMLVideoElement).paused)).toBe(true);
  await video.evaluate(node => { const element = node as HTMLVideoElement; element.muted = true; return element.play(); });
  await expect.poll(() => video.evaluate(node => (node as HTMLVideoElement).currentTime)).toBeGreaterThan(0);
  await video.evaluate(node => (node as HTMLVideoElement).pause());
  await video.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("mock-video-playback.png"), fullPage: true });
  const downloading = page.waitForEvent("download");
  await page.getByRole("link", { name: "영상 다운로드", exact: true }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("lingua-scene.mp4");
  const downloaded = testInfo.outputPath("downloaded-mock-video.mp4");
  await download.saveAs(downloaded);
  expect(readFileSync(downloaded)).toEqual(fixture);
  expect(posts).toBe(1);
  expect(polls).toBe(3);
  await expect(check).toHaveCount(0);
});

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
  await expect.poll(() => preview.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const source = await preview.getAttribute("src");
  await page.route("**/api/ai/image", route => route.fulfill({ status: 503, json: { error: { message: "Image unavailable" } } }));
  await page.getByRole("button", { name: "장면 이미지 만들기", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Image unavailable" })).toBeVisible();
  await expect(preview).toHaveAttribute("src", source!);
  await expect(page.getByLabel("만들고 싶은 장면")).toHaveValue("A welcoming hotel lobby with warm afternoon light");
});

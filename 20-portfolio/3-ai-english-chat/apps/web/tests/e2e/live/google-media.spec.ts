import { test, expect } from "./fixtures";
import { readMediaBudget, reserveMediaRequest } from "./media-budget";

const mediaBudget = readMediaBudget();

// Explicit opt-in: these tests create paid media. Never run them as implicit retries.
test.describe("Google media live gates", () => {
  test.skip(process.env.PLAYWRIGHT_GOOGLE_MEDIA !== "1", "Requires explicit Google media verification profile");

  const imageTest = process.env.PLAYWRIGHT_GOOGLE_IMAGE === "1" && mediaBudget.image.reservedRequests < mediaBudget.image.maxRequests ? test : test.skip;
  imageTest("authenticated Playground decodes a Google image", async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    await page.goto("/admin/playground");
    await expect(page.getByRole("heading", { name: "AI Playground", exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "이미지", exact: true }).click();
    await page.getByLabel("이미지 설명", { exact: true }).fill("An original friendly adult hotel concierge in a warm boutique hotel, cinematic illustration, no text");
    const imageResponse = page.waitForResponse(response => response.url().endsWith("/api/admin/playground/image") && response.request().method() === "POST");
    reserveMediaRequest("image");
    await page.getByRole("button", { name: "이미지 생성", exact: true }).click();
    const generatedImage = await imageResponse;
    expect(generatedImage.status()).toBe(200);
    expect(generatedImage.headers()["x-ai-provider"]).toBe("google");
    const image = page.getByRole("img", { name: "Playground에서 생성한 캐릭터 이미지" });
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await page.screenshot({ path: testInfo.outputPath("google-image.png"), fullPage: true });
  });

  test("authenticated Playground plays its generated Google WAV", async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    await page.goto("/admin/playground");
    await expect(page.getByRole("heading", { name: "AI Playground", exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "음성", exact: true }).click();
    await page.getByLabel("읽을 문장", { exact: true }).fill("Welcome to Lingua. How can I help you today?");
    await page.getByRole("combobox", { name: "음성", exact: true }).selectOption("Kore");
    const speechResponse = page.waitForResponse(response => response.url().endsWith("/api/admin/playground/speech") && response.request().method() === "POST");
    await page.getByRole("button", { name: "음성 생성", exact: true }).click();
    const speech = await speechResponse;
    expect(speech.status()).toBe(200);
    expect(speech.headers()["x-ai-provider"]).toBe("google");
    expect(speech.headers()["content-type"]).toContain("audio/wav");
    const audio = page.locator("audio");
    await expect(audio).toHaveAttribute("src", /^blob:/);
    // Validate the bytes installed in the player; Chromium's network inspector
    // can omit the body of an audio response even when Content-Length is set.
    const wav = Buffer.from(await audio.evaluate(async node => Array.from(new Uint8Array(
      await (await fetch((node as HTMLAudioElement).src)).arrayBuffer(),
    ))));
    expect(wav.subarray(0, 4).toString()).toBe("RIFF");
    expect(wav.subarray(8, 12).toString()).toBe("WAVE");
    await expect.poll(() => audio.evaluate(node => (node as HTMLAudioElement).duration)).toBeGreaterThan(0);
    await audio.evaluate(node => (node as HTMLAudioElement).play());
    await expect.poll(() => audio.evaluate(node => (node as HTMLAudioElement).currentTime)).toBeGreaterThan(0);
    await audio.evaluate(node => (node as HTMLAudioElement).pause());
    await testInfo.attach("google-speech.wav", { body: wav, contentType: "audio/wav" });
    await page.screenshot({ path: testInfo.outputPath("google-speech.png"), fullPage: true });
  });

  // Current provider implementation requests 8s. The user's 3s cap forbids it;
  // Veo supports 4/6/8s, so no real video runs until the user changes this limit.
  const requestedVideoSeconds = 8;
  const videoTest = process.env.PLAYWRIGHT_GOOGLE_VIDEO === "1"
    && requestedVideoSeconds <= mediaBudget.video.maxDurationSeconds
    && mediaBudget.video.reservedRequests < mediaBudget.video.maxRequests ? test : test.skip;
  videoTest("authenticated character scene reaches a playable MP4 with one video POST", async ({ page, practiceMission }, testInfo) => {
    test.setTimeout(660_000);
    let starts = 0;
    page.on("request", request => { if (request.method() === "POST" && new URL(request.url()).pathname === "/api/ai/video") starts += 1; });
    await page.goto(`/chat/${practiceMission.recommendedCharacterId}`);
    await page.getByRole("button", { name: "영상 생성", exact: true }).click();
    await page.getByLabel("만들고 싶은 장면").fill("A cinematic eight second scene of sunlight crossing an empty cozy cafe table with a cup of tea, gentle camera motion, no text");
    const accepted = page.waitForResponse(response => new URL(response.url()).pathname === "/api/ai/video" && response.request().method() === "POST");
    reserveMediaRequest("video", requestedVideoSeconds);
    await page.getByRole("button", { name: "영상 생성 시작", exact: true }).click();
    expect((await accepted).status()).toBe(200);
    const video = page.locator("video");
    await expect.poll(async () => {
      if (await video.count()) return true;
      const check = page.getByRole("button", { name: "생성 상태 확인", exact: true });
      if (await check.isEnabled()) await check.click();
      return await video.count() > 0;
    }, { intervals: [10_000], timeout: 600_000 }).toBe(true);
    expect(starts).toBe(1);
    await expect.poll(() => video.evaluate(node => (node as HTMLVideoElement).duration)).toBeGreaterThan(0);
    await video.evaluate(node => { (node as HTMLVideoElement).muted = true; return (node as HTMLVideoElement).play(); });
    await expect.poll(() => video.evaluate(node => (node as HTMLVideoElement).currentTime)).toBeGreaterThan(0);
    await video.evaluate(node => (node as HTMLVideoElement).pause());
    await expect(page.getByRole("link", { name: "영상 다운로드" })).toHaveAttribute("href", /^blob:/);
    await page.screenshot({ path: testInfo.outputPath("google-video.png"), fullPage: true });
  });
});

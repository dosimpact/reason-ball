import { expect, test } from "@playwright/test";

test("basic chat, image and TTS use the guarded playground endpoints", async ({ page }) => {
  await page.goto("/admin/playground");
  await expect(page.getByRole("heading", { name: "AI Playground", exact: true })).toBeVisible();
  const chatResponse = page.waitForResponse((response) => response.url().endsWith("/api/admin/playground/chat") && response.request().method() === "POST");
  await page.getByLabel("메시지", { exact: true }).fill("Hi! Can we practice ordering coffee in English?");
  await page.getByRole("button", { name: "보내기", exact: true }).click();
  expect((await chatResponse).ok()).toBe(true);
  await expect(page.getByTestId("rich-text")).toHaveCount(2);
  await expect(page.getByLabel("메시지", { exact: true })).toHaveValue("");

  await page.getByRole("tab", { name: "이미지", exact: true }).click();
  const imageResponse = page.waitForResponse((response) => response.url().endsWith("/api/admin/playground/image") && response.request().method() === "POST");
  await page.getByRole("button", { name: "이미지 생성", exact: true }).click();
  expect((await imageResponse).ok()).toBe(true);
  const image = page.getByRole("img", { name: "Playground에서 생성한 캐릭터 이미지" });
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute("src", /^data:image\//);

  await page.getByRole("tab", { name: "음성", exact: true }).click();
  const speechResponse = page.waitForResponse((response) => response.url().endsWith("/api/admin/playground/speech") && response.request().method() === "POST");
  await page.getByRole("button", { name: "음성 생성", exact: true }).click();
  const speech = await speechResponse;
  expect(speech.ok()).toBe(true);
  expect(speech.headers()["content-type"]).toContain("audio/");
  await expect(page.locator("audio")).toHaveAttribute("src", /^blob:/);
  await expect(page.locator("audio")).toHaveAttribute("controls", "");
  await expect(page.getByText("AI가 생성한 음성입니다.", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "채팅", exact: true }).click();
  await expect(page.getByTestId("rich-text")).toHaveCount(2);
  await page.getByRole("button", { name: "대화 초기화", exact: true }).click();
  await expect(page.getByTestId("rich-text")).toHaveCount(0);
});

test("generation failure preserves image prompt and the previous generated result", async ({ page }) => {
  await page.goto("/admin/playground");
  await page.getByRole("tab", { name: "이미지", exact: true }).click();
  await page.getByRole("button", { name: "이미지 생성", exact: true }).click();
  const image = page.getByRole("img", { name: "Playground에서 생성한 캐릭터 이미지" });
  await expect(image).toBeVisible();
  const previousSource = await image.getAttribute("src");
  await page.route("**/api/admin/playground/image", (route) => route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: { message: "Image provider unavailable" } }) }));
  await page.getByLabel("이미지 설명", { exact: true }).fill("A friendly cinematic character portrait with soft afternoon light");
  await page.getByRole("button", { name: "이미지 생성", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Image provider unavailable" })).toBeVisible();
  await expect(page.getByLabel("이미지 설명", { exact: true })).toHaveValue("A friendly cinematic character portrait with soft afternoon light");
  await expect(image).toHaveAttribute("src", previousSource!);
});

test("switching tabs cancels generation and does not display a late chat answer", async ({ page }) => {
  await page.goto("/admin/playground");
  await page.route("**/api/admin/playground/chat", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: "Late answer should stay hidden", modelId: "test" }) }).catch(() => undefined);
  });
  await page.getByRole("button", { name: "보내기", exact: true }).click();
  await expect(page.getByRole("button", { name: "중단", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "이미지", exact: true }).click();
  await expect(page.getByRole("button", { name: "이미지 생성", exact: true })).toBeEnabled();
  await page.getByRole("tab", { name: "채팅", exact: true }).click();
  await expect(page.getByText("Late answer should stay hidden")).toHaveCount(0);
  await expect(page.getByLabel("메시지", { exact: true })).toHaveValue("Hi! Can we practice ordering coffee in English?");
});

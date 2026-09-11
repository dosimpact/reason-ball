import type { Locator } from "@playwright/test";
import { expect, test } from "./fixtures";

async function colors(locator: Locator) {
  return locator.evaluate((element) => {
    // Canvas resolves CSS Color 4/oklch as well as rgb colors.
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d")!;
    function luminance(color: string) {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const channels = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3)
        .map((value) => value / 255)
        .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    }
    let surface: Element | null = element;
    while (surface && getComputedStyle(surface).backgroundColor === "rgba(0, 0, 0, 0)") surface = surface.parentElement;
    const background = luminance(getComputedStyle(surface ?? element).backgroundColor);
    const foreground = luminance(getComputedStyle(element).color);
    return { background, contrast: (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05) };
  });
}

test("theme changes actual home surfaces and remains readable across both reloads", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const heading = page.getByRole("heading", { name: "외우지 말고, 캐릭터와 살아봐요." });
  const character = page.locator('[data-testid^="character-card-"]').first().getByRole("heading");
  const mission = page.locator('[data-testid^="mission-card-"]').first().getByRole("heading");
  const summary = page.getByTestId("home-learning-summary").locator("article").first().locator("p").first();
  const contents = [heading, character, mission, summary];
  for (const item of contents) await expect(item).toBeVisible();
  for (const mode of ["dark", "light"] as const) {
    await page.getByRole("button", { name: mode === "dark" ? "다크 테마로 전환" : "라이트 테마로 전환" }).click();
    for (const reload of [false, true]) {
      if (reload) await page.reload();
      await expect(page.getByTestId("theme-toggle")).toHaveAttribute("aria-pressed", String(mode === "dark"));
      await expect(page.getByTestId("theme-toggle")).toHaveAccessibleName(mode === "dark" ? "라이트 테마로 전환" : "다크 테마로 전환");
      await expect.poll(() => page.evaluate(() => localStorage.getItem("lingua-theme"))).toBe(mode);
      for (const item of contents) {
        await expect(item).toBeVisible();
        await expect.poll(async () => (await colors(item)).contrast).toBeGreaterThanOrEqual(4.5);
        if (mode === "dark") await expect.poll(async () => (await colors(item)).background).toBeLessThan(0.1);
        else await expect.poll(async () => (await colors(item)).background).toBeGreaterThan(0.8);
      }
    }
  }
});

test("mobile menu opens, closes, and navigates real account screens", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const menu = page.getByRole("navigation", { name: "모바일 메뉴", exact: true });
  await page.getByRole("button", { name: "메뉴 열기", exact: true }).click();
  await expect(menu).toBeVisible();
  await page.getByRole("button", { name: "메뉴 닫기", exact: true }).click();
  await expect(menu).toBeHidden();
  for (const [name, path] of [["캐릭터", "/characters"], ["미션", "/missions"], ["대화 기록", "/history"], ["프로필", "/profile"], ["홈", "/"]]) {
    await page.getByRole("button", { name: "메뉴 열기", exact: true }).click();
    await menu.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(`http://dodonet.iptime.org:13000${path}`);
    await expect(menu).toBeHidden();
    await expect(page.getByRole("main")).toBeVisible();
  }
  await page.getByRole("button", { name: "메뉴 열기", exact: true }).click();
  await menu.getByRole("button", { name: "새 채팅", exact: true }).click();
  await expect(menu).toBeHidden();
  await expect(page.getByTestId("chat-workspace")).toHaveAttribute("data-conversation-id", /^[0-9a-f-]{36}$/);
  const id = await page.getByTestId("chat-workspace").getAttribute("data-conversation-id");
  const response = await page.request.get(`/api/conversations/${id}`);
  expect(response.ok()).toBe(true);
  await page.reload();
  await expect(page.getByTestId("chat-workspace")).toHaveAttribute("data-conversation-id", id!);
});

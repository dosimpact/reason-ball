import { expect, test } from "@playwright/test";

import { installCleanAppState } from "./test-setup";

test.describe("App shell and theme", () => {
  test.beforeEach(async ({ page }) => {
    await installCleanAppState(page);
  });

  test("persists theme, exposes the desktop sidebar, and starts a unique chat by keyboard", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByRole("complementary", { name: "데스크톱 사이드바" })).toBeVisible();
    await page.getByTestId("theme-toggle").click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect.poll(() => page.evaluate(() => localStorage.getItem("lingua-theme"))).toBe("dark");

    // Delay hydration deterministically: the inline theme bootstrap may finish
    // while the app's keyboard listener is still unavailable.
    let releaseScripts!: () => void;
    const scriptsReady = new Promise<void>((resolve) => { releaseScripts = resolve; });
    await page.route("**/_next/static/chunks/**", async (route) => {
      await scriptsReady;
      await route.continue();
    });
    try {
      await page.reload({ waitUntil: "commit" });
      await expect(page.locator("html")).toHaveClass(/dark/);
      await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "false");
    } finally {
      releaseScripts();
    }
    await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");

    await page.keyboard.press("Control+Shift+O");
    await expect(page).toHaveURL(/\/chat\/mia-hotelier\?conversation=[^&]+&new=1/);
  });
});

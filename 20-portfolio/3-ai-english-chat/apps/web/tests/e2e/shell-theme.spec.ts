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

    await expect(page.getByRole("navigation", { name: "주요 메뉴" })).toBeVisible();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.getByTestId("theme-toggle").click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await expect.poll(() => page.evaluate(() => localStorage.getItem("lingua-theme"))).toBe("light");

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
      await expect(page.locator("html")).not.toHaveClass(/dark/);
      // A production Suspense boundary may not render the shell until its
      // chunks load; neither an absent shell nor an unhydrated shell is ready.
      expect(await page.getByTestId("app-shell").count() === 0
        ? "not-rendered"
        : await page.getByTestId("app-shell").getAttribute("data-shortcuts-ready")).not.toBe("true");
    } finally {
      releaseScripts();
    }
    await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");

    await page.keyboard.press("Control+Shift+O");
    await expect(page).toHaveURL(/\/chat\/[^/?]+\?[^#]*conversation=/);
    await expect(page.getByTestId("chat-workspace")).toHaveAttribute("data-conversation-id", /.+/);
  });
});

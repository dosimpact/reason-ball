import { test, expect } from "@playwright/test";

test("board, five slots and controls fit viewport; hardest level is available", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Queue 1:", exact: false }),
  ).toBeVisible();
  await expect(page.locator('[data-testid^="slot-"]')).toHaveCount(5);
  await page.getByLabel("Difficulty", { exact: true }).selectOption("hard");
  await page.getByLabel("Level", { exact: true }).selectOption("100");
  await expect(page.getByLabel("Level", { exact: true })).toHaveValue("100");
  for (const locator of [
    page.getByRole("region", { name: "Cat Atelier game board" }),
    page.locator("canvas"),
    page.getByTestId("queue-0"),
    page.getByRole("button", { name: "Hint", exact: true }),
    page.getByLabel("Level", { exact: true }),
  ]) {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    if (page.viewportSize()!.height >= 720) {
      expect(box!.y + box!.height).toBeLessThanOrEqual(
        page.viewportSize()!.height,
      );
    }
  }
  for (const control of [
    page.getByTestId("queue-0"),
    page.getByRole("button", { name: "Speed 1x", exact: true }),
    page.getByRole("button", { name: "Hint", exact: true }),
    page.getByLabel("Level", { exact: true }),
  ]) {
    const bounds = await control.boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/${test.info().project.name}-hard100.png`,
  });
  expect(errors).toEqual([]);
});

test("selection animates collection, pause freezes, speed and restart work", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Hint", exact: true }).click();
  const hint = (await page.locator(".status-message").innerText()).match(
    /(\d)번/,
  );
  expect(hint).not.toBeNull();
  await page.getByTestId(`queue-${Number(hint![1]) - 1}`).click();
  await expect(
    page.locator('[data-testid^="slot-"].occupied').first(),
  ).toBeVisible();
  await expect
    .poll(async () => await page.locator("canvas").getAttribute("aria-label"))
    .not.toContain(": 0 of");
  await page.getByRole("button", { name: "Pause game", exact: true }).click();
  const before = await page.getByRole("timer").innerText();
  await page.waitForTimeout(1200); // Explicit pause contract: time must stay constant across a wall-clock interval.
  expect(await page.getByRole("timer").innerText()).toBe(before);
  await expect(page.getByTestId("queue-0")).toBeDisabled();
  await page.getByRole("button", { name: "Resume game", exact: true }).click();
  await page.getByRole("button", { name: "Speed 1x", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Speed 3x", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Restart level", exact: true })
    .click();
  await expect(page.locator("canvas")).toHaveAttribute("aria-label", /: 0 of/);
  await expect(page.locator('[data-testid^="slot-"].occupied')).toHaveCount(0);
});

test("a player can complete a level using hints and advance; progress survives reload", async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== "desktop",
    "Full flow once; mobile controls verified separately.",
  );
  await page.goto("/");
  await page.getByLabel("Difficulty", { exact: true }).selectOption("easy");
  await page.getByRole("button", { name: "Speed 1x", exact: true }).click();
  const deadline = Date.now() + 70_000;
  while (
    (await page.getByTestId("game-status").textContent()) === "playing" &&
    Date.now() < deadline
  ) {
    await page.getByRole("button", { name: "Hint", exact: true }).click();
    const hint = (await page.locator(".status-message").innerText()).match(
      /(\d)번/,
    );
    if (hint) await page.getByTestId(`queue-${Number(hint[1]) - 1}`).click();
    await page.waitForTimeout(150); // Observe the real cat travel, never mutate engine state from the test.
  }
  await expect(
    page.getByRole("dialog", { name: "Level complete" }),
  ).toBeVisible();
  await expect(page.locator("canvas")).toHaveAttribute(
    "aria-label",
    /Pixel artwork: (\d+) of \1 blocks collected/,
  );
  await page.getByRole("button", { name: "다음 레벨 →", exact: true }).click();
  await expect(page.getByLabel("Level", { exact: true })).toHaveValue("2");
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("ant-atelier-progress-v1") || "{}")
          .easy,
    ),
  ).toBe(2);
  await page.reload();
  await expect(page.getByLabel("Difficulty", { exact: true })).toHaveValue(
    "easy",
  );
  await expect(page.getByLabel("Level", { exact: true })).toHaveValue("2");
});

test("malformed stored progress does not crash and instructions are usable", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("ant-atelier-progress-v1", "null"),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "How to play", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "How to play" })).toBeVisible();
  await page.getByRole("button", { name: "시작하기", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("game-status")).toHaveText("playing");
});

test("native rewarded hints require the matching earned response; failed ads grant nothing", async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== "desktop",
    "Native message boundary is viewport independent.",
  );
  await page.addInitScript(() => {
    const scope = window as unknown as {
      ReactNativeWebView: { postMessage: (message: string) => void };
      requests: string[];
    };
    scope.requests = [];
    scope.ReactNativeWebView = {
      postMessage: (message) => scope.requests.push(message),
    };
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Watch rewarded ad for hint", exact: true })
    .click();
  const request = await page.evaluate(() => {
    const scope = window as unknown as { requests: string[] };
    return scope.requests
      .map((raw) => JSON.parse(raw))
      .find((message) => message.type === "REWARDED_HINT");
  });
  expect(request.requestId).toBeTruthy();
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("ant:native", {
        detail: {
          v: 1,
          type: "REWARDED_RESULT",
          requestId: "wrong",
          earned: true,
        },
      }),
    ),
  );
  await expect(page.locator(".status-message")).not.toContainText("번 상자");
  await page.evaluate(
    (id) =>
      window.dispatchEvent(
        new CustomEvent("ant:native", {
          detail: {
            v: 1,
            type: "REWARDED_RESULT",
            requestId: id,
            earned: false,
          },
        }),
      ),
    request.requestId,
  );
  await expect(page.locator(".status-message")).toContainText("지급되지");
  await page
    .getByRole("button", { name: "Watch rewarded ad for hint", exact: true })
    .click();
  const second = await page.evaluate(() =>
    (window as unknown as { requests: string[] }).requests
      .map((raw) => JSON.parse(raw))
      .filter((message) => message.type === "REWARDED_HINT")
      .at(-1),
  );
  await page.evaluate(
    (id) =>
      window.dispatchEvent(
        new CustomEvent("ant:native", {
          detail: {
            v: 1,
            type: "REWARDED_RESULT",
            requestId: id,
            earned: true,
          },
        }),
      ),
    second.requestId,
  );
  await expect(page.locator(".status-message")).toContainText("번 상자");
  const hintedLane =
    Number(
      (await page.locator(".status-message").innerText()).match(/(\d)번/)![1],
    ) - 1;
  await page.getByTestId(`queue-${hintedLane}`).click();
  await page
    .getByRole("button", { name: "Watch rewarded ad for hint", exact: true })
    .click();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { requests: string[] }).requests
          .map((raw) => JSON.parse(raw))
          .filter((message) => message.type === "REWARDED_HINT").length,
    ),
  ).toBe(2);
  await page.getByRole("button", { name: "Pause game", exact: true }).click();
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("ant:native", {
        detail: { v: 1, type: "PAUSE", paused: false },
      }),
    ),
  );
  await expect(
    page.getByRole("button", { name: "Resume game", exact: true }),
  ).toBeVisible();
});

test("keyboard controls deploy and pause without a mouse", async ({ page }) => {
  test.skip(
    test.info().project.name !== "desktop",
    "Keyboard is a desktop input.",
  );
  await page.goto("/");
  await page.keyboard.press("1");
  await expect(page.locator('[data-testid^="slot-"].occupied')).toHaveCount(1);
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "Resume game", exact: true }),
  ).toBeVisible();
});

test("a bad queue order produces a recoverable blocked game", async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== "desktop",
    "The deterministic loss path is viewport independent.",
  );
  await page.goto("/");
  await page.getByLabel("Difficulty", { exact: true }).selectOption("hard");
  await page.getByLabel("Level", { exact: true }).selectOption("6");
  for (const lane of [1, 1, 1, 1, 1]) {
    await page.getByTestId(`queue-${lane}`).click();
    await page.waitForTimeout(1000); // Deliberately wait for the established delivery order in this puzzle.
  }
  await expect(page.getByRole("dialog", { name: "Try again" })).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("상자가 모두 막혔어요");
  await page.getByRole("button", { name: "다시 도전", exact: true }).click();
  await expect(page.getByTestId("game-status")).toHaveText("playing");
  await expect(page.locator("canvas")).toHaveAttribute("aria-label", /: 0 of/);
});

test("first choice starts the clock and help preserves a manual pause", async ({
  page,
}) => {
  await page.goto("/");
  const initial = await page.getByRole("timer").innerText();
  await page.waitForTimeout(1200);
  expect(await page.getByRole("timer").innerText()).toBe(initial);
  await page.getByTestId("queue-0").click();
  await expect
    .poll(() => page.getByRole("timer").innerText())
    .not.toBe(initial);
  await page.getByRole("button", { name: "Pause game", exact: true }).click();
  await page.getByRole("button", { name: "How to play", exact: true }).click();
  await page.getByRole("dialog").getByRole("button").last().click();
  await expect(
    page.getByRole("button", { name: "Resume game", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("queue-0")).toBeDisabled();
});

test("Phaser uses WebGL and resizes at capped device resolution", async ({
  browser,
}) => {
  test.skip(
    test.info().project.name !== "desktop",
    "Renderer contract once with explicit high DPI.",
  );
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  try {
    await page.goto("/");
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-renderer",
      "phaser-webgl",
    );
    await page.setViewportSize({ width: 360, height: 640 });
    await expect
      .poll(() =>
        page
          .locator("canvas")
          .evaluate((canvas) =>
            Math.abs(canvas.width - canvas.clientWidth * 2),
          ),
      )
      .toBeLessThanOrEqual(1);
    await page.getByTestId("queue-0").click();
    await expect
      .poll(() => page.locator("canvas").getAttribute("aria-label"))
      .not.toContain(": 0 of");
    await page.screenshot({
      path: "test-results/phaser-high-dpi-reduced-motion.png",
      fullPage: true,
    });
  } finally {
    await context.close();
  }
});

test("Phaser falls back to Canvas when WebGL is unavailable", async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== "desktop",
    "Fallback contract is viewport independent.",
  );
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      type: string,
      ...args: unknown[]
    ) {
      if (/webgl/i.test(type)) return null;
      return original.call(this, type as "2d", ...args);
    } as typeof original;
  });
  await page.goto("/");
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-renderer",
    "phaser-canvas",
  );
  await page.getByTestId("queue-0").click();
  await expect
    .poll(() => page.locator("canvas").getAttribute("aria-label"))
    .not.toContain(": 0 of");
  await page.screenshot({ path: "test-results/phaser-canvas-fallback.png" });
});

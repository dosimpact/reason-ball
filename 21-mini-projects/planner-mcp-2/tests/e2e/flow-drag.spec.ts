import { test, expect } from "@playwright/test";

test("UI-05 horizontal defaults, drag persistence and failed-save rollback", async ({
  page,
  request,
}) => {
  const project = await (
    await request.post("/api/projects", {
      data: { title: `Flow ${crypto.randomUUID()}` },
    })
  ).json();
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page
      .getByRole("button", { name: project.title, exact: true })
      .click();
    const nodes = page.locator(".react-flow__node");
    await expect(nodes).toHaveCount(3);
    await expect(nodes.first()).toBeVisible();
    const boxes = await nodes.evaluateAll((elements) =>
      elements.map((e) => ({
        x: e.getBoundingClientRect().x,
        y: e.getBoundingClientRect().y,
      })),
    );
    expect(boxes[0].x).toBeLessThan(boxes[1].x);
    expect(boxes[1].x).toBeLessThan(boxes[2].x);
    expect(boxes.map((b) => b.y)).toEqual([boxes[0].y, boxes[0].y, boxes[0].y]);
    const first = nodes.first();
    const nodeId = await first.getAttribute("data-id");
    const endpoint = `/api/projects/${project.id}/nodes/${nodeId}`;
    async function drag() {
      const box = (await first.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        box.x + box.width / 2 + 40,
        box.y + box.height / 2 + 65,
        { steps: 10 },
      );
      await page.mouse.up();
    }
    const savedResponse = page.waitForResponse(
      (r) => r.url().endsWith(endpoint) && r.request().method() === "PATCH",
    );
    await drag();
    const response = await savedResponse;
    expect(response.ok()).toBe(true);
    const saved = await response.json();
    expect(saved.coordinates.x).toBeGreaterThan(30);
    expect(saved.coordinates.y).toBeGreaterThan(80);
    await expect(first).toBeVisible();
    await page.reload();
    await page
      .getByRole("button", { name: project.title, exact: true })
      .click();
    await expect(first).toBeVisible();
    async function expectSavedPosition() {
      await expect
        .poll(async () => {
          const actual = await first.evaluate((e) => {
            const matrix = new DOMMatrix(getComputedStyle(e).transform);
            return { x: matrix.m41, y: matrix.m42 };
          });
          return Math.max(
            Math.abs(actual.x - saved.coordinates.x),
            Math.abs(actual.y - saved.coordinates.y),
          );
        })
        .toBeLessThan(0.01);
    }
    await expect(first).toHaveCSS("transform", /matrix/);
    await expectSavedPosition();
    await page.route(`**${endpoint}`, (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "위치 저장 실패" }),
      }),
    );
    await drag();
    await expect(
      page.getByRole("alert").filter({ hasText: "위치 저장 실패" }),
    ).toContainText("위치 저장 실패");
    await expectSavedPosition();
    await expect(first).toBeVisible();
    await page.screenshot({
      path: "test-results/horizontal-draggable-flow.png",
    });
  } finally {
    await request.delete(`/api/projects/${project.id}`, { data: {} });
  }
});

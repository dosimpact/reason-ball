import { test, expect } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

test("REQ-010 sidebar navigation and guide match live MCP schemas", async ({
  page,
}) => {
  const client = new Client({ name: "guide-e2e", version: "1" });
  try {
    await client.connect(
      new StreamableHTTPClientTransport(new URL("/mcp", process.env.BASE_URL!)),
    );
    const { tools } = await client.listTools();
    await page.goto("/");
    await page.getByRole("link", { name: "AI MCP Interface 안내" }).click();
    await expect(page).toHaveURL(/\/mcp-guide$/);
    await expect(
      page.getByRole("heading", { name: "AI MCP Interface 안내", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(tools.length);
    for (const tool of tools) {
      const card = page.getByRole("article", { name: tool.name, exact: true });
      await expect(
        card.getByRole("heading", { name: tool.name, exact: true }),
      ).toBeVisible();
      const schema = await card
        .locator("details")
        .first()
        .locator("pre")
        .textContent();
      expect(JSON.parse(schema!)).toEqual(tool.inputSchema);
    }
    const search = page.getByRole("searchbox", { name: "도구 검색" });
    await search.fill("UPDATE_DOCUMENT");
    await expect(page.getByRole("article")).toHaveCount(
      tools.filter((tool) =>
        `${tool.name} ${tool.description ?? ""}`
          .toLowerCase()
          .includes("update_document"),
      ).length,
    );
    await expect(
      page
        .getByRole("article", { name: "update_document", exact: true })
        .getByText("expectedRevision 필수", { exact: true }),
    ).toBeVisible();
    await search.fill("no-such-tool");
    await expect(page.getByText("검색 결과가 없습니다.")).toBeVisible();
    await search.fill("get_workflow_rules");
    await expect(
      page.getByText("입력 파라미터 없음", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByRole("article")).toHaveCount(tools.length);
    await page.setViewportSize({ width: 390, height: 844 });
    const projectTrigger = page.getByRole("button", {
      name: "프로젝트 메뉴 열기",
      exact: true,
    });
    await projectTrigger.click();
    const drawer = page.getByRole("dialog", { name: "프로젝트 탐색" });
    await expect(
      drawer.getByRole("link", { name: "AI MCP Interface 안내" }),
    ).toBeInViewport();
    await page.keyboard.press("Escape");
    await expect(projectTrigger).toBeFocused();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(390);
    await page.screenshot({ path: "test-results/mcp-guide-mobile.png" });
  } finally {
    await client.close();
  }
});

test("MCP guide navigation returns from dirty template editor across routes", async ({
  page,
}) => {
  await page.goto("/mcp-guide");
  await page.getByRole("link", { name: "템플릿 관리", exact: true }).click();
  await page
    .getByRole("textbox", { name: "템플릿 제목", exact: true })
    .fill("저장하지 않은 템플릿");
  await page.getByRole("link", { name: "AI MCP Interface 안내" }).click();
  await page
    .getByRole("dialog", { name: "저장하지 않은 변경 사항" })
    .getByRole("button", { name: "변경 버리고 이동" })
    .click();
  await expect(
    page.getByRole("heading", { name: "AI MCP Interface 안내", exact: true }),
  ).toBeVisible();
});

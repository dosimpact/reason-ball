import { sourceEditor } from "./markdown-source";
import { test, expect } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
let server: Server;
let url: string;
test.beforeAll(async () => {
  const root = path.resolve("storybook-static");
  server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(
        new URL(req.url!, "http://localhost").pathname,
      );
      const file = path.resolve(
        root,
        "." + (pathname === "/" ? "/index.html" : pathname),
      );
      if (!file.startsWith(root + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      const mime: Record<string, string> = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".svg": "image/svg+xml",
        ".png": "image/png",
      };
      res.setHeader(
        "Content-Type",
        mime[path.extname(file)] ?? "application/octet-stream",
      );
      res.end(await readFile(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address();
  if (!address || typeof address === "string") throw Error("No port");
  url = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((e) => (e ? reject(e) : resolve())),
  );
});
test("VIEW-01 Storybook checklist, empty, overview and Mermaid states", async ({
  page,
}) => {
  await page.goto(
    `${url}/iframe.html?id=planner-checklist--mixed&viewMode=story`,
  );
  await expect(page.getByText("정상 로그인", { exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox").nth(0)).toBeChecked();
  await expect(page.getByRole("checkbox").nth(1)).not.toBeChecked();
  await expect(page.getByText("AI: failed", { exact: true })).toBeVisible();
  await page.goto(
    `${url}/iframe.html?id=planner-checklist--empty&viewMode=story`,
  );
  await expect(page.getByText("검증 항목이 없습니다.")).toBeVisible();
  await page.goto(
    `${url}/iframe.html?id=planner-checklist--overview&viewMode=story`,
  );
  await expect(page.getByText("회원 관리", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "검증 방법 보기" }),
  ).toBeVisible();
  await page.goto(
    `${url}/iframe.html?id=planner-checklist--markdown&viewMode=story`,
  );
  await expect(
    page.getByRole("heading", { name: "로그인 설계" }),
  ).toBeVisible();
  await expect(page.locator(".mermaid svg")).toBeVisible();
  await page.screenshot({
    path: "test-results/storybook-mermaid.png",
    fullPage: true,
  });
});

test("VIEW-02 resizable workspace and preview modal components", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(
    `${url}/iframe.html?id=planner-workspacepanels--resizable&viewMode=story`,
  );
  const handle = page.getByRole("separator", {
    name: "캔버스와 상세 패널 크기 조절",
  });
  await expect(handle).toBeVisible();
  const canvas = page.locator(".canvas-panel");
  const before = (await canvas.boundingBox())!.width;
  await handle.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(async () => (await canvas.boundingBox())!.width)
    .toBeGreaterThan(before);
  await page.getByLabel("문서 입력").fill("패널을 닫아도 유지");
  await page.getByRole("button", { name: "상세 패널 닫기" }).click();
  await expect(page.getByLabel("문서 입력")).toBeHidden();
  await page.getByRole("button", { name: "상세 패널 열기" }).click();
  await expect(page.getByLabel("문서 입력")).toHaveValue("패널을 닫아도 유지");
  await page.goto(
    `${url}/iframe.html?id=planner-workspacepanels--preview-modal&viewMode=story`,
  );
  await page.getByRole("button", { name: "템플릿 미리보기" }).click();
  const modal = page.getByRole("dialog", { name: "템플릿 미리보기" });
  await expect(modal.locator(".mermaid svg")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
  await expect(
    page.getByRole("button", { name: "템플릿 미리보기" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "템플릿 미리보기" }).click();
  await modal.getByRole("button", { name: "미리보기 닫기" }).click();
  await expect(modal).toBeHidden();
});

test("VIEW-03 MCP guide search and empty catalog", async ({ page }) => {
  await page.goto(
    `${url}/iframe.html?id=planner-mcpguide--catalog&viewMode=story`,
  );
  await expect(page.getByRole("article")).toHaveCount(2);
  const toc = page.getByRole("navigation", { name: "MCP 도구 목차" });
  await expect(toc).toBeHidden();
  await page.getByText("도구 목차 · 2개", { exact: true }).click();
  await expect(toc.getByRole("link")).toHaveCount(2);
  await toc.getByRole("link", { name: "get_document", exact: true }).click();
  await expect(page).toHaveURL(/#mcp-tool-get_document$/);
  await expect(
    page.getByRole("article", { name: "get_document", exact: true }),
  ).toBeInViewport();
  await page.getByRole("searchbox", { name: "도구 검색" }).fill("get_document");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(toc.getByRole("link")).toHaveCount(1);
  await page.getByText("도구 목차 · 1개", { exact: true }).click();
  await expect(toc).toBeHidden();
  await expect(
    page.getByText("documentId 필수", { exact: true }),
  ).toBeVisible();
  await page.getByText("전체 입력 JSON Schema", { exact: true }).click();
  await expect(page.locator("details pre")).toBeVisible();
  await page.goto(
    `${url}/iframe.html?id=planner-mcpguide--empty&viewMode=story`,
  );
  await expect(page.getByText("검색 결과가 없습니다.")).toBeVisible();
  await expect(page.locator(".mcp-toc")).toHaveCount(0);
});

test("VIEW-04 index progress checklist is a distinct section", async ({
  page,
}) => {
  await page.goto(
    `${url}/iframe.html?id=planner-documenteditor--index-progress&viewMode=story`,
  );
  const section = page.getByRole("region", {
    name: "진행 체크리스트",
    exact: true,
  });
  await expect(section).toHaveClass(/index-progress-section/);
  await expect(
    section.getByRole("heading", { name: "진행 체크리스트" }),
  ).toBeVisible();
  await expect(
    section.locator(".checklist").getByText("설계 범위 확인", { exact: true }),
  ).toBeVisible();
  await expect(section.getByLabel("새 체크리스트 항목")).toBeVisible();
  await expect(
    section.getByRole("button", { name: "항목 추가" }),
  ).toBeVisible();
  await expect(
    section.getByRole("heading", { name: "하위 문서 카탈로그" }),
  ).toHaveCount(0);
  await section.screenshot({ path: "test-results/index-progress-section.png" });
  await page.goto(
    `${url}/iframe.html?id=planner-documenteditor--empty-index&viewMode=story`,
  );
  await expect(
    page
      .getByRole("region", { name: "진행 체크리스트" })
      .getByText("검증 항목이 없습니다."),
  ).toBeVisible();
});

test("VIEW-05 GitHub palette, accessible dialog and keyboard tabs", async ({
  page,
}) => {
  await page.goto(
    `${url}/iframe.html?id=planner-designsystem--git-hub-palette&viewMode=story`,
  );
  await expect(
    page.getByRole("heading", { name: "Planner 디자인 시스템" }),
  ).toBeVisible();
  const implementation = page.getByRole("tab", { name: "구현", exact: true });
  await implementation.click();
  await expect(implementation).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toContainText(
    "설계에 따라 구현 작업",
  );
  await implementation.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "검증", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toContainText("사람의 최종 확인");
  const trigger = page.getByRole("button", {
    name: "하위 문서 만들기",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "하위 문서 만들기" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: "문서 제목" }).fill("로그인 흐름");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByRole("button", { name: "취소" }).click();
  await expect(dialog).toBeHidden();
  await page.screenshot({
    path: "test-results/storybook-design-system.png",
    fullPage: true,
  });
});

test("VIEW-06 child catalog creation CTA precedes the document editor", async ({
  page,
}) => {
  await page.goto(
    `${url}/iframe.html?id=planner-documenteditor--child-document-catalog&viewMode=story`,
  );
  const catalog = page.locator(".child-document-section");
  const create = catalog.getByRole("button", {
    name: "하위 문서 만들기",
    exact: true,
  });
  await expect(create).toBeVisible();
  await expect(
    catalog.getByRole("button", { name: /로그인 흐름 설계/ }),
  ).toBeVisible();
  await expect(
    catalog.getByRole("button", { name: /첫 프로젝트 온보딩/ }),
  ).toBeVisible();
  const body = await sourceEditor(page, "문서 본문");
  expect((await create.boundingBox())!.y).toBeLessThan(
    (await body.boundingBox())!.y,
  );
  await page.screenshot({
    path: "test-results/storybook-child-document-catalog.png",
    fullPage: true,
  });
});

test("VIEW-07 attached React Flow diagram and empty extension list", async ({
  page,
}) => {
  await page.goto(
    `${url}/iframe.html?id=planner-documentextensions--diagram&viewMode=story`,
  );
  const diagram = page.getByRole("group", {
    name: "주문 처리 흐름 다이어그램",
  });
  await expect(diagram.locator(".react-flow__node")).toHaveCount(2);
  await expect(diagram.getByText("결제 확인", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/storybook-diagram-extension.png",
  });
  await page.goto(
    `${url}/iframe.html?id=planner-documentextensions--empty&viewMode=story`,
  );
  await expect(page.getByText("첨부된 확장이 없습니다.")).toBeVisible();
});

test("VIEW-08 Notion-style Markdown editor renders blocks and preserves source", async ({
  page,
}) => {
  await page.goto(
    `${url}/iframe.html?id=planner-markdowneditor--blocks&viewMode=story`,
  );
  const editor = page.getByRole("textbox", { name: "설계 본문", exact: true });
  await expect(editor.locator("h1")).toHaveText("로그인 설계");
  const region = page.getByRole("region", {
    name: "설계 본문 편집기",
    exact: true,
  });
  await region.getByRole("button", { name: "Markdown", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "설계 본문", exact: true }),
  ).toHaveValue(/```mermaid/);
  await region.getByRole("button", { name: "미리보기", exact: true }).click();
  await expect(region.locator(".mermaid svg")).toBeVisible();
});

test("VIEW-09 CodeWeave tree, diff markers and comment ownership", async ({
  page,
}) => {
  await page.goto(
    `${url}/iframe.html?id=planner-documentextensions--code-weave&viewMode=story`,
  );
  await expect(page.getByRole("treeitem")).toHaveCount(4);
  await expect(
    page.locator(".codeweave-node.added .codeweave-marker"),
  ).toHaveText("+");
  await expect(
    page.locator(".codeweave-node.removed .codeweave-marker"),
  ).toHaveText("-");
  await page.getByRole("button", { name: "5행 주석", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "CodeWeave 라인 정보" }),
  ).toContainText("line:3");
  await page.getByRole("button", { name: "전체 접기", exact: true }).click();
  await expect(page.getByRole("treeitem")).toHaveCount(1);
  await page.getByRole("button", { name: "전체 펼치기", exact: true }).click();
  await expect(page.getByRole("treeitem")).toHaveCount(4);
});

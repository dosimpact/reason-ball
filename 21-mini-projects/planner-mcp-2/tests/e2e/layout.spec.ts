import { sourceEditor } from "./markdown-source";
import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
async function seed(request: APIRequestContext, title: string) {
  const p = await (
    await request.post("/api/projects", {
      data: { title: `${title} ${crypto.randomUUID().slice(0, 8)}` },
    })
  ).json();
  const d = await (
    await request.post("/api/documents", {
      data: {
        projectId: p.id,
        title: "레이아웃 문서",
        phase: "design",
        templateName: "view",
        body: Array.from(
          { length: 45 },
          (_, i) => `## 검증 항목 ${i + 1}\n\n설계와 검증 내용입니다.`,
        ).join("\n\n"),
      },
    })
  ).json();
  return { p, d };
}
async function open(page: Page, title: string) {
  await page.goto("/");
  await page.getByRole("button", { name: title, exact: true }).click();
  await page
    .locator(".document-list")
    .getByRole("button", { name: /레이아웃 문서/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "레이아웃 문서", exact: true }),
  ).toBeVisible();
  await page.locator(".shell > main").evaluate((e) => (e.scrollTop = 0));
}

test("UI-01/02/03 panel drag, keyboard, minimum widths, round nodes and independent sidebar scrolling", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { p } = await seed(request, "크기 조절 프로젝트");
  const extra: string[] = [];
  try {
    await open(page, p.title);
    const canvas = page.locator(".canvas-panel");
    const detail = page.locator(".detail-panel");
    const handle = page.getByRole("separator", {
      name: "캔버스와 상세 패널 크기 조절",
    });
    const before = (await canvas.boundingBox())!;
    const detailBefore = (await detail.boundingBox())!;
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, 180);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 120, 180, { steps: 12 });
    await page.mouse.up();
    await expect
      .poll(async () => (await canvas.boundingBox())!.width)
      .toBeGreaterThan(before.width + 100);
    expect((await detail.boundingBox())!.width).toBeLessThan(
      detailBefore.width - 100,
    );
    const dragged = (await canvas.boundingBox())!.width;
    await handle.focus();
    await page.keyboard.press("ArrowLeft");
    await expect
      .poll(async () => (await canvas.boundingBox())!.width)
      .toBeLessThan(dragged);
    await page.keyboard.press("Home");
    await expect
      .poll(async () => Math.round((await canvas.boundingBox())!.width))
      .toBeGreaterThanOrEqual(300);
    expect((await detail.boundingBox())!.width).toBeGreaterThanOrEqual(340);
    await expect(page.locator(".react-flow__node").first()).toHaveCSS(
      "border-radius",
      "22px",
    );
    const sidebar = page.locator(".sidebar-content");
    const sidebarBefore = (await sidebar.boundingBox())!;
    const main = page.locator(".shell > main");
    const mainBox = (await main.boundingBox())!;
    await page.mouse.move(mainBox.x + mainBox.width - 8, mainBox.y + 600);
    await page.mouse.wheel(0, 600);
    await expect
      .poll(() => main.evaluate((e) => e.scrollTop))
      .toBeGreaterThan(300);
    expect((await sidebar.boundingBox())!.y).toBe(sidebarBefore.y);
    expect((await sidebar.boundingBox())!.height).toBe(sidebarBefore.height);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    expect(await sidebar.evaluate((e) => e.scrollTop)).toBe(0);
    for (let i = 0; i < 22; i++) {
      const r = await (
        await request.post("/api/projects", {
          data: { title: `스크롤 확인 ${i}` },
        })
      ).json();
      extra.push(r.id);
    }
    await expect(
      page.getByRole("button", { name: "스크롤 확인 21", exact: true }),
    ).toBeAttached();
    const guideLink = page.getByRole("link", { name: "AI MCP Interface 안내" });
    const guideBefore = await guideLink.boundingBox();
    const mainScroll = await main.evaluate((e) => e.scrollTop);
    await page.mouse.move(110, 550);
    await page.mouse.wheel(0, 600);
    await expect
      .poll(() => sidebar.evaluate((e) => e.scrollTop))
      .toBeGreaterThan(100);
    expect(await main.evaluate((e) => e.scrollTop)).toBe(mainScroll);
    await expect(guideLink).toBeInViewport();
    expect(await guideLink.boundingBox()).toEqual(guideBefore);
    await main.evaluate((e) => (e.scrollTop = 0));
    await page.screenshot({ path: "test-results/resizable-workspace.png" });
  } finally {
    for (const id of [...extra, p.id])
      await request.delete(`/api/projects/${id}`, { data: {} });
  }
});

test("UI-01/03 narrow layout keeps unsaved document and avoids horizontal page scrolling", async ({
  page,
  request,
}) => {
  const { p } = await seed(request, "반응형 프로젝트");
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, p.title);
    await (await sourceEditor(page, "문서 본문")).fill("저장 전 입력 유지");
    for (const width of [900, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(
        page.getByRole("separator", { name: "캔버스와 상세 패널 크기 조절" }),
      ).toBeHidden();
      await expect(
        page.getByRole("tab", { name: "문서 상세", exact: true }),
      ).toHaveAttribute("aria-selected", "true");
      await expect(await sourceEditor(page, "문서 본문")).toHaveValue(
        "저장 전 입력 유지",
      );
      const bounds = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        viewport: innerWidth,
        height: document.documentElement.scrollHeight,
        viewportHeight: innerHeight,
      }));
      expect(bounds.width).toBeLessThanOrEqual(bounds.viewport);
      expect(bounds.height).toBe(bounds.viewportHeight);
      await (await sourceEditor(page, "문서 본문")).scrollIntoViewIfNeeded();
      await expect(await sourceEditor(page, "문서 본문")).toBeVisible();
      await page.getByRole("tab", { name: "문서 목록", exact: true }).click();
      await expect(page.locator(".canvas-panel")).toBeVisible();
      await expect(page.locator(".detail-panel")).toBeHidden();
      await page.getByRole("tab", { name: "문서 상세", exact: true }).click();
      await expect(await sourceEditor(page, "문서 본문")).toHaveValue(
        "저장 전 입력 유지",
      );
    }
    await page.screenshot({ path: "test-results/workspace-mobile.png" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(
      page.getByRole("separator", { name: "캔버스와 상세 패널 크기 조절" }),
    ).toBeVisible();
    await expect(await sourceEditor(page, "문서 본문")).toHaveValue(
      "저장 전 입력 유지",
    );
  } finally {
    await request.delete(`/api/projects/${p.id}`, { data: {} });
  }
});

test("UI-04 template preview opens only in dialog and closes with Escape, button and backdrop", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "템플릿 관리", exact: true }).click();
  await page.getByLabel("템플릿 제목").fill("미리보기 테스트");
  await (
    await sourceEditor(page, "템플릿 본문")
  ).fill("# 모달 본문\n\n```mermaid\nflowchart LR\n A[설계] --> B[검증]\n```");
  await (await sourceEditor(page, "작성 예시")).fill("예시 내용");
  const trigger = page.getByRole("button", {
    name: "템플릿 미리보기",
    exact: true,
  });
  const modal = page.getByRole("dialog", {
    name: "템플릿 미리보기",
    exact: true,
  });
  await expect(modal).toBeHidden();
  await expect(page.getByRole("heading", { name: "모달 본문" })).toBeHidden();
  await trigger.click();
  await expect(modal).toBeVisible();
  await expect(modal.getByRole("heading", { name: "모달 본문" })).toBeVisible();
  await expect(modal.getByText("예시 내용", { exact: true })).toBeVisible();
  await expect(modal.locator(".mermaid svg")).toBeVisible();
  await page.keyboard.press("Tab");
  expect(await modal.evaluate((e) => e.contains(document.activeElement))).toBe(
    true,
  );
  await page.screenshot({ path: "test-results/template-preview-modal.png" });
  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await modal.getByRole("button", { name: "미리보기 닫기" }).click();
  await expect(modal).toBeHidden();
  await trigger.click();
  await expect(modal).toBeVisible();
  await page
    .locator('[data-slot="dialog-overlay"]')
    .click({ position: { x: 5, y: 5 } });
  await expect(modal).toBeHidden();
  await expect(page.getByLabel("템플릿 제목")).toHaveValue("미리보기 테스트");
});

test("UI-06 close detail expands canvas and reopening preserves draft and panel width", async ({
  page,
  request,
}) => {
  const { p } = await seed(request, "패널 접기");
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, p.title);
    const editor = await sourceEditor(page, "문서 본문");
    await editor.fill("닫아도 유지할 저장 전 내용");
    const canvas = page.locator(".canvas-panel");
    const separator = page.getByRole("separator", {
      name: "캔버스와 상세 패널 크기 조절",
    });
    await separator.focus();
    await page.keyboard.press("ArrowRight");
    const width = (await canvas.boundingBox())!.width;
    const close = page.getByRole("button", {
      name: "상세 패널 닫기",
      exact: true,
    });
    const reopen = page.getByRole("button", {
      name: "상세 패널 열기",
      exact: true,
    });
    await close.click();
    await expect(page.locator(".detail-panel")).toBeHidden();
    await expect(separator).toBeHidden();
    await expect(reopen).toBeFocused();
    expect((await canvas.boundingBox())!.width).toBeCloseTo(
      (await page.locator(".shell > main").boundingBox())!.width,
      0,
    );
    await page.screenshot({ path: "test-results/canvas-expanded.png" });
    await reopen.click();
    await expect(close).toBeFocused();
    await expect(editor).toHaveValue("닫아도 유지할 저장 전 내용");
    expect((await canvas.boundingBox())!.width).toBeCloseTo(width, 0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("tab", { name: "문서 목록", exact: true }).click();
    await expect(page.locator(".detail-panel")).toBeHidden();
    await page.getByRole("tab", { name: "문서 상세", exact: true }).click();
    await expect(editor).toHaveValue("닫아도 유지할 저장 전 내용");
  } finally {
    await request.delete(`/api/projects/${p.id}`, { data: {} });
  }
});

test("MOBILE-01 project drawer and bottom navigation keep the workspace task-first", async ({
  page,
  request,
}) => {
  const { p } = await seed(request, "모바일 프로젝트 탐색");
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/projects/${p.id}`);
    const projectTrigger = page.getByRole("button", {
      name: "프로젝트 메뉴 열기",
      exact: true,
    });
    await expect(projectTrigger).toBeVisible();
    await expect(page.locator(".shell > .sidebar")).toBeHidden();
    await expect(
      page.getByRole("tab", { name: "문서 상세", exact: true }),
    ).toHaveAttribute("aria-selected", "true");

    await projectTrigger.click();
    const drawer = page.getByRole("dialog", { name: "프로젝트 탐색" });
    await expect(drawer).toBeVisible();
    await expect(
      drawer.getByRole("button", { name: p.title, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      drawer.getByRole("link", { name: "AI MCP Interface 안내" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(projectTrigger).toBeFocused();

    for (const name of ["작업 공간", "템플릿 관리", "AI 작업 안내"]) {
      const item = page.getByRole("link", { name, exact: true });
      const box = await item.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    const bounds = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewport: innerWidth,
    }));
    expect(bounds.width).toBeLessThanOrEqual(bounds.viewport);
    await page.screenshot({ path: "test-results/mobile-workspace-redesign.png" });

    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(projectTrigger).toBeVisible();
    await expect(page.locator(".shell > .sidebar")).toBeHidden();
    await expect(
      page.getByRole("tab", { name: "문서 상세", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(768);
  } finally {
    await request.delete(`/api/projects/${p.id}`, { data: {} });
  }
});

test("UI-06 selecting another document restores a closed detail panel", async ({
  page,
  request,
}) => {
  const { p, d } = await seed(request, "문서 선택 패널 복원");
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, p.title);
    await page
      .getByRole("button", { name: "상세 패널 닫기", exact: true })
      .click();
    await expect(page.locator(".detail-panel")).toBeHidden();
    const index = page
      .locator(".document-list")
      .getByRole("button", { name: /design index/ });
    await index.click();
    await expect(page.locator(".detail-panel")).toBeVisible();
    await expect(
      page
        .locator(".detail-panel")
        .getByRole("heading", { name: "design index", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .locator(".detail-panel")
        .getByRole("button", { name: "하위 문서 만들기", exact: true }),
    ).toBeVisible();
    await page
      .locator(".document-list")
      .getByRole("button", { name: `${d.title} ${d.status}`, exact: true })
      .click();
    await expect(
      page
        .locator(".detail-panel")
        .getByRole("heading", { name: d.title, exact: true }),
    ).toBeVisible();
  } finally {
    await request.delete(`/api/projects/${p.id}`, { data: {} });
  }
});

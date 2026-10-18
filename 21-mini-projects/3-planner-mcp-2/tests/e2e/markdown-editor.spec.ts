import { test, expect } from "@playwright/test";
import { sourceEditor } from "./markdown-source";

test("Notion editor slash blocks, list arrows, Markdown/Mermaid and persistence", async ({
  page,
  request,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const project = await (
    await request.post("/api/projects", { data: { title: "Rich editor" } })
  ).json();
  const doc = await (
    await request.post("/api/documents", {
      data: {
        projectId: project.id,
        title: "Rich document",
        phase: "design",
        kind: "design-verification",
      },
    })
  ).json();
  try {
    await page.goto(`/projects/${project.id}`);
    await page
      .locator(".document-list")
      .getByRole("button", { name: /Rich document/ })
      .click();
    const region = page.getByRole("region", {
      name: "문서 본문 편집기",
      exact: true,
    });
    const editor = region.getByRole("textbox", {
      name: "문서 본문",
      exact: true,
    });
    await editor.fill("/h2");
    await expect(region.getByRole("listbox")).toBeVisible();
    await editor.press("Enter");
    await page.keyboard.type("Design heading");
    await expect(editor.locator("h2")).toHaveText("Design heading");
    await editor.press("End");
    await editor.press("Enter");
    await page.keyboard.type("/bullet");
    await expect(
      region.getByRole("listbox").getByRole("option", { name: /글머리 목록/ }),
    ).toBeVisible();
    await editor.press("Enter");
    await expect(editor.locator("ul")).toHaveCount(1);
    await page.keyboard.type("Parent");
    await editor.press("Enter");
    await page.keyboard.type("Child");
    await region
      .getByRole("button", { name: "→ 들여쓰기", exact: true })
      .click();
    await expect(editor.locator("ul ul li")).toHaveText("Child");
    await region
      .getByRole("button", { name: "← 내어쓰기", exact: true })
      .click();
    await expect(editor.locator("ul ul li")).toHaveCount(0);
    await region
      .getByRole("button", { name: "→ 들여쓰기", exact: true })
      .click();
    await editor.press("Shift+Tab");
    await expect(editor.locator("ul ul li")).toHaveCount(0);
    await editor.press("Tab");
    await expect(editor.locator("ul ul li")).toHaveText("Child");
    await page.getByRole("button", { name: "문서 저장", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await (await request.get(`/api/documents/${doc.id}`)).json()).body,
      )
      .toContain("## Design heading");
    const raw = await sourceEditor(page, "문서 본문");
    await expect(raw).toHaveValue(/Parent\n\s+- Child/);
    const fixture =
      "## Design heading\n\n- [ ] 확인\n\n| 항목 | 값 |\n| --- | --- |\n| A | B |\n\n```mermaid\nflowchart LR\n A[시작] --> B[완료]\n```";
    await raw.fill(fixture);
    await region
      .getByRole("button", { name: "서식 편집", exact: true })
      .click();
    await expect(editor.locator("table")).toBeVisible();
    await expect(editor.locator("input[type=checkbox]")).toHaveCount(1);
    await expect(editor.locator("code.language-mermaid")).toContainText(
      "flowchart LR",
    );
    await editor.locator("h2").click();
    await editor.press("End");
    await page.keyboard.type(" updated");
    await region.getByRole("button", { name: "미리보기", exact: true }).click();
    await expect(region.locator(".mermaid svg")).toBeVisible();
    await page.getByRole("button", { name: "문서 저장", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await (await request.get(`/api/documents/${doc.id}`)).json()).body,
      )
      .toContain("```mermaid");
    await page.reload();
    await page
      .locator(".document-list")
      .getByRole("button", { name: /Rich document/ })
      .click();
    await expect(
      page
        .getByRole("textbox", { name: "문서 본문", exact: true })
        .locator("h2"),
    ).toContainText("updated");
    await region.scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/notion-markdown-editor.png" });
    expect(pageErrors).toEqual([]);
  } finally {
    await request.delete(`/api/projects/${project.id}`, { data: {} });
  }
});

test("source mode preserves unsupported Markdown without converting it", async ({
  page,
  request,
}) => {
  const project = await (
    await request.post("/api/projects", { data: { title: "Raw editor" } })
  ).json();
  const body =
    "<details>\n<summary>원문</summary>\n\n내용[^1]\n\n</details>\n\n[^1]: 각주";
  const doc = await (
    await request.post("/api/documents", {
      data: {
        projectId: project.id,
        title: "Raw document",
        phase: "design",
        kind: "design-verification",
        body,
      },
    })
  ).json();
  try {
    await page.goto(`/projects/${project.id}`);
    await page
      .locator(".document-list")
      .getByRole("button", { name: /Raw document/ })
      .click();
    await expect(
      page.getByRole("textbox", { name: "문서 본문", exact: true }),
    ).toHaveValue(body);
    await page.getByLabel("문서 제목", { exact: true }).fill("Raw renamed");
    await page.getByRole("button", { name: "문서 저장", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await (await request.get(`/api/documents/${doc.id}`)).json()).title,
      )
      .toBe("Raw renamed");
    expect(
      (await (await request.get(`/api/documents/${doc.id}`)).json()).body,
    ).toBe(body);
  } finally {
    await request.delete(`/api/projects/${project.id}`, { data: {} });
  }
});

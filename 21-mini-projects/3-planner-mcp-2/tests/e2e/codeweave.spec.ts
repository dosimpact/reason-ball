import { test, expect } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const source =
  "[App]\n  -> FLOW: 시작\n    -> (+) Custom: 처리 // 설명\n    /*\n멀티라인 설명\n    */\n    <- (-) RETURN: 이전 결과";
test("CodeWeave template → mixed extensions → tree/comments → MCP edit/SSE and conflicts", async ({
  page,
  request,
}) => {
  const name = `cw-${crypto.randomUUID()}`;
  const project = await (
    await request.post("/api/projects", { data: { title: name } })
  ).json();
  const client = new Client({ name: "codeweave-e2e", version: "1" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto("/templates");
    await page.getByLabel("템플릿 이름", { exact: true }).fill(name);
    await page
      .getByLabel("템플릿 제목", { exact: true })
      .fill("CodeWeave 양식");
    await page
      .getByRole("button", { name: "React Flow 다이어그램 추가", exact: true })
      .click();
    await page
      .getByRole("button", { name: "CodeWeave 추가", exact: true })
      .click();
    await page.getByLabel("CodeWeave 제목", { exact: true }).fill("업무 흐름");
    await page
      .getByRole("textbox", { name: "CodeWeave 원문", exact: true })
      .fill(source);
    await page
      .getByRole("button", { name: "CodeWeave 추가", exact: true })
      .click();
    await page
      .getByLabel("CodeWeave 제목", { exact: true })
      .nth(1)
      .fill("보조 흐름");
    await page
      .getByRole("button", { name: "템플릿 저장", exact: true })
      .click();
    await expect(
      page.getByText("템플릿을 저장했습니다.", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "템플릿 미리보기", exact: true })
      .click();
    const preview = page.getByRole("dialog", {
      name: "템플릿 미리보기",
      exact: true,
    });
    await expect(preview.getByRole("tree")).toHaveCount(2);
    await expect(
      preview.locator(".codeweave-node.added").first(),
    ).toContainText("Custom:");
    await page.keyboard.press("Escape");
    const doc = await (
      await request.post("/api/documents", {
        data: {
          projectId: project.id,
          title: "CodeWeave 문서",
          phase: "design",
          templateName: name,
        },
      })
    ).json();
    expect(doc.extensions).toHaveLength(3);
    const extensionId = doc.extensions[1].id;
    const template = await (await request.get(`/api/templates/${name}`)).json();
    await request.patch(`/api/templates/${name}`, {
      data: {
        ...template,
        revision: undefined,
        expectedRevision: template.revision,
        extensions: [],
      },
    });
    expect(
      (await (await request.get(`/api/documents/${doc.id}`)).json()).extensions,
    ).toHaveLength(3);
    await page.goto(`/projects/${project.id}`);
    await page
      .locator(".document-list")
      .getByRole("button", { name: /CodeWeave 문서/ })
      .click();
    const card = page.locator(".codeweave-card").filter({
      has: page.getByText("업무 흐름", { exact: true }),
    });
    const raw = card.getByRole("textbox", {
      name: "CodeWeave 원문",
      exact: true,
    });
    await expect(raw).toHaveValue(source);
    await card.getByRole("button", { name: "5행 주석", exact: true }).click();
    await expect(
      card.getByRole("region", { name: "CodeWeave 라인 정보" }),
    ).toContainText("line:3");
    await expect(
      card.getByRole("region", { name: "CodeWeave 라인 정보" }),
    ).toContainText("멀티라인 설명");
    await card.getByRole("button", { name: "전체 접기", exact: true }).click();
    await expect(card.getByRole("treeitem")).toHaveCount(1);
    await card.getByRole("button", { name: "App 펼치기", exact: true }).click();
    await expect(card.getByRole("treeitem")).toHaveCount(2);
    await card
      .getByRole("button", { name: "시작 펼치기", exact: true })
      .click();
    await expect(card.getByRole("treeitem")).toHaveCount(4);
    await expect(raw).toHaveValue(source);
    await raw.fill("[App]\n   broken");
    await expect(card.getByRole("alert")).toContainText("문법 오류");
    await raw.fill(source);
    await page.getByRole("button", { name: "문서 저장", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await (await request.get(`/api/documents/${doc.id}`)).json())
            .revision,
      )
      .toBe(2);
    await client.connect(
      new StreamableHTTPClientTransport(new URL("/mcp", process.env.BASE_URL!)),
    );
    const parse = (result: Awaited<ReturnType<typeof client.callTool>>) =>
      JSON.parse((result.content as { type: string; text: string }[])[0].text);
    const snapshot = parse(
      await client.callTool({
        name: "get_codeweave",
        arguments: {
          documentId: doc.id,
          extensionId,
          line: 5,
          query: "Custom",
        },
      }),
    );
    expect(snapshot.selected.id).toBe("line:3");
    expect(snapshot.matches).toHaveLength(1);
    const args = {
      documentId: doc.id,
      extensionId,
      expectedRevision: snapshot.revision,
      expectedSource: snapshot.source,
      nodeId: snapshot.selected.id,
      patch: { text: "AI 변경", direction: "<-", blockComment: "MCP 주석" },
    };
    const updated = await client.callTool({
      name: "update_codeweave_node",
      arguments: args,
    });
    expect(updated.isError).not.toBe(true);
    await expect(raw).toHaveValue(/AI 변경/);
    await expect(raw).toHaveValue(/MCP 주석/);
    const stale = await client.callTool({
      name: "update_codeweave_node",
      arguments: args,
    });
    expect(stale.isError).toBe(true);
    expect(parse(stale).status).toBe(409);
    const persisted = await (
      await request.get(`/api/documents/${doc.id}`)
    ).json();
    expect(persisted.extensions[0]).toEqual(doc.extensions[0]);
    expect(persisted.extensions[2]).toEqual(doc.extensions[2]);
    expect(persisted.templateSnapshot.extensions[1].data.source).toBe(source);
    await page.reload();
    await page
      .locator(".document-list")
      .getByRole("button", { name: /CodeWeave 문서/ })
      .click();
    await expect(raw).toHaveValue(/AI 변경/);
    await card.getByRole("tree").scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/codeweave-extension.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await client.close();
    await request.delete(`/api/projects/${project.id}`, { data: {} });
    await request.delete(`/api/templates/${name}`, { data: {} });
  }
});

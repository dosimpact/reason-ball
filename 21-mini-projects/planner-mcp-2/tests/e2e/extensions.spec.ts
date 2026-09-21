import { test, expect } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

test("template diagram → document UI editing → MCP update and invalid graph rejection", async ({
  page,
  request,
}) => {
  const name = `diagram-${crypto.randomUUID()}`;
  const project = await (
    await request.post("/api/projects", { data: { title: name } })
  ).json();
  const client = new Client({ name: "extensions-e2e", version: "1" });
  try {
    await page.goto("/templates");
    await page.getByLabel("템플릿 이름", { exact: true }).fill(name);
    await page
      .getByLabel("템플릿 제목", { exact: true })
      .fill("다이어그램 양식");
    await page
      .getByRole("button", { name: "React Flow 다이어그램 추가", exact: true })
      .click();
    await page.getByLabel("다이어그램 제목", { exact: true }).fill("주문 흐름");
    await page.getByText("노드·연결 편집", { exact: true }).click();
    await page.getByLabel("노드 1 이름", { exact: true }).fill("주문 시작");
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
    await expect(
      preview
        .getByRole("group", { name: "주문 흐름 다이어그램" })
        .getByText("주문 시작", { exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    const doc = await (
      await request.post("/api/documents", {
        data: {
          projectId: project.id,
          title: "Diagram document",
          phase: "design",
          templateName: name,
        },
      })
    ).json();
    expect(doc.extensions[0].data.nodes[0].label).toBe("주문 시작");
    await page
      .getByRole("button", { name: project.title, exact: true })
      .click();
    await page
      .locator(".document-list")
      .getByRole("button", { name: /Diagram document/ })
      .click();
    const diagram = page.getByRole("group", { name: "주문 흐름 다이어그램" });
    await expect(diagram.getByText("주문 시작", { exact: true })).toBeVisible();
    await page.getByText("노드·연결 편집", { exact: true }).click();
    await page.getByLabel("노드 2 이름", { exact: true }).fill("UI 완료");
    await diagram.scrollIntoViewIfNeeded();
    const box = (await diagram
      .locator(".react-flow__node")
      .first()
      .boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + 35,
      box.y + box.height / 2 + 25,
      { steps: 8 },
    );
    await page.mouse.up();
    await page.getByRole("button", { name: "문서 저장", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await (await request.get(`/api/documents/${doc.id}`)).json())
            .extensions[0].data.nodes[1].label,
      )
      .toBe("UI 완료");
    await client.connect(
      new StreamableHTTPClientTransport(new URL("/mcp", process.env.BASE_URL!)),
    );
    const current = await (
      await request.get(`/api/documents/${doc.id}`)
    ).json();
    expect(current.extensions[0].data.nodes[0].position.x).toBeGreaterThan(0);
    const extensions = structuredClone(current.extensions);
    extensions[0].data.nodes[1].label = "AI 완료";
    const result = await client.callTool({
      name: "update_document",
      arguments: {
        documentId: doc.id,
        expectedRevision: current.revision,
        extensions,
      },
    });
    expect(result.isError).not.toBe(true);
    await expect(diagram.getByText("AI 완료", { exact: true })).toBeVisible();
    const read = await client.callTool({
      name: "get_document",
      arguments: { documentId: doc.id },
    });
    const record = JSON.parse((read.content as { text: string }[])[0].text);
    expect(record.extensions).toEqual(extensions);
    extensions[0].data.edges[0].target = "missing";
    const invalid = await client.callTool({
      name: "update_document",
      arguments: {
        documentId: doc.id,
        expectedRevision: record.revision,
        extensions,
      },
    });
    expect(invalid.isError).toBe(true);
    const original = await (await request.get(`/api/templates/${name}`)).json();
    expect(original.extensions[0].data.nodes[1].label).toBe("완료");
    await page.reload();
    await page
      .getByRole("button", { name: project.title, exact: true })
      .click();
    await page
      .locator(".document-list")
      .getByRole("button", { name: /Diagram document/ })
      .click();
    await expect(
      page
        .getByRole("group", { name: "주문 흐름 다이어그램" })
        .getByText("AI 완료", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("group", { name: "주문 흐름 다이어그램" })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/document-extension.png" });
    await page
      .getByRole("button", { name: "다이어그램 제거", exact: true })
      .click();
    await page.getByRole("button", { name: "문서 저장", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await (await request.get(`/api/documents/${doc.id}`)).json())
            .extensions,
      )
      .toEqual([]);
  } finally {
    await client.close();
    await request.delete(`/api/projects/${project.id}`, { data: {} });
    await request.delete(`/api/templates/${name}`, { data: {} });
  }
});

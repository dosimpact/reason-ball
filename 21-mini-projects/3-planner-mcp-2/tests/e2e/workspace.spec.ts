import { sourceEditor } from "./markdown-source";
import { test, expect, type Page } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Document, Project } from "../../src/entities/planner/model";
async function connect() {
  const client = new Client({ name: "planner-e2e", version: "1" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL("/mcp", process.env.BASE_URL!)),
  );
  return client;
}
async function call<T>(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const r = await client.callTool({ name, arguments: args });
  expect(r.isError, JSON.stringify(r.content)).not.toBe(true);
  const content = r.content as { type: string; text: string }[];
  return JSON.parse(content[0].text);
}
async function projectUI(page: Page, name: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "새 프로젝트", exact: true }).click();
  await page.getByLabel("새 프로젝트 이름").fill(name);
  await page.getByRole("button", { name: "프로젝트 만들기" }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}
async function documentUI(page: Page, name: string, template = "view") {
  await page.getByRole("button", { name: "새 문서", exact: true }).click();
  await page.getByLabel("새 문서 제목").fill(name);
  await page.getByLabel("사용할 템플릿").selectOption(template);
  await page.getByRole("button", { name: "문서 만들기", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}

test("E2E-01/03/04/05 MCP AI verification → SSE → human confirmation → selective reopen", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const client = await connect();
  try {
    const tools = await client.listTools();
    expect(tools.tools.map((t) => t.name)).toContain("record_verification");
    expect(tools.tools.map((t) => t.name)).not.toContain(
      "confirm_checklist_item",
    );
    await projectUI(page, "MCP collaboration");
    await expect(
      page.locator(".react-flow__node:not(.flow-document-node)"),
    ).toHaveCount(3);
    await expect(page.locator(".react-flow__node").first()).toBeVisible();
    await page
      .locator(".react-flow__node")
      .filter({ hasText: "design" })
      .click();
    await expect(
      page.getByRole("heading", { name: "design index" }),
    ).toBeVisible();
    await documentUI(page, "Login contract");
    const projects = await call<Project[]>(client, "list_projects");
    const p = projects.find((p) => p.title === "MCP collaboration")!;
    let d = (
      await call<Document[]>(client, "list_documents", { projectId: p.id })
    ).find((d) => d.title === "Login contract")!;
    d = await call<Document>(client, "add_checklist_item", {
      documentId: d.id,
      label: "Error feedback",
      expectedRevision: d.revision,
    });
    for (const item of d.checklist)
      d = await call<Document>(client, "update_checklist_item", {
        documentId: d.id,
        itemId: item.id,
        aiResult: "passed",
        expectedRevision: d.revision,
      });
    const result = await call<Document>(client, "record_verification", {
      documentId: d.id,
      body: "AI checked success and error cases.",
      expectedRevision: d.revision,
    });
    await expect(page.getByText("AI: passed", { exact: true })).toHaveCount(2);
    await expect(
      page.getByRole("button", {
        name: /^Login contract — AI 검증 결과/,
      }),
    ).toBeVisible();
    const checks = page.getByRole("checkbox", { name: "사람 확인" });
    await checks.nth(0).click();
    await expect(checks.nth(0)).toBeChecked();
    await expect(checks.nth(1)).toBeEnabled();
    await checks.nth(1).click();
    await expect(checks.nth(1)).toBeChecked();
    await expect(page.locator(".document-heading > .ui-badge")).toHaveText(
      "검증 완료",
    );
    d = await call<Document>(client, "get_document", { documentId: d.id });
    d = await call<Document>(client, "reopen_document", {
      documentId: d.id,
      affectedItemIds: [d.checklist[0].id],
      reason: "Design changed",
      expectedRevision: d.revision,
    });
    await expect(checks.nth(0)).not.toBeChecked();
    await expect(checks.nth(1)).toBeChecked();
    await expect(page.locator(".document-heading > .ui-badge")).toHaveText(
      "재검증 필요",
    );
    const result2 = await call<Document>(client, "record_verification", {
      documentId: d.id,
      body: "Reverification updated in place.",
      expectedRevision: d.revision,
    });
    expect(result2.id).toBe(result.id);
    const parent = await call<Document & { children: Document[] }>(
      client,
      "get_document",
      { documentId: d.id },
    );
    expect(
      parent.children.filter((c) => c.kind === "verification-result"),
    ).toHaveLength(1);
    await page
      .getByRole("button", {
        name: /^Login contract — AI 검증 결과/,
      })
      .click();
    await expect(await sourceEditor(page, "문서 본문")).toHaveValue(
      "Reverification updated in place.",
    );
    expect(errors).toEqual([]);
    await page.screenshot({
      path: "test-results/collaboration.png",
      fullPage: true,
    });
  } finally {
    await client.close();
  }
});

test("E2E-02 template editing does not mutate instantiated documents", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "템플릿 관리", exact: true }).click();
  await page.getByLabel("템플릿 이름", { exact: true }).fill("ui-template");
  await page.getByLabel("템플릿 제목").fill("UI template");
  await (await sourceEditor(page, "템플릿 본문")).fill("# Original");
  await (await sourceEditor(page, "작성 예시")).fill("Example");
  await (await sourceEditor(page, "AI 작성 지침")).fill("Follow design");
  await page.getByLabel("기본 체크리스트 (한 줄에 하나)").fill("One\nTwo");
  await page.getByRole("button", { name: "템플릿 저장" }).click();
  await expect(
    page.getByRole("button", { name: "UI template", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "작업 공간", exact: true }).click();
  await projectUI(page, "Template independence");
  await documentUI(page, "Instance", "ui-template");
  await expect(await sourceEditor(page, "문서 본문")).toHaveValue("# Original");
  await page.getByRole("link", { name: "템플릿 관리", exact: true }).click();
  await page.getByRole("button", { name: "UI template", exact: true }).click();
  await (await sourceEditor(page, "템플릿 본문")).fill("# Changed");
  await page.getByRole("button", { name: "템플릿 저장" }).click();
  await expect
    .poll(
      async () =>
        (await (await request.get("/api/templates/ui-template")).json()).body,
    )
    .toBe("# Changed");
  await page.getByRole("link", { name: "작업 공간", exact: true }).click();
  await expect(await sourceEditor(page, "문서 본문")).toHaveValue("# Original");
  await expect(page.getByRole("checkbox", { name: "사람 확인" })).toHaveCount(
    2,
  );
});

test("E2E-06 MCP rejects forged confirmation and stale writes", async () => {
  const c = await connect();
  try {
    const p = await call<Project>(c, "create_project", { title: "MCP errors" });
    let d = await call<Document>(c, "create_document", {
      projectId: p.id,
      title: "Contract",
      phase: "design",
      templateName: "api",
    });
    const forged = await c.callTool({
      name: "update_checklist_item",
      arguments: {
        documentId: d.id,
        itemId: d.checklist[0].id,
        humanConfirmed: true,
        expectedRevision: d.revision,
      },
    });
    expect(forged.isError).toBe(true);
    const rev = d.revision;
    d = await call<Document>(c, "update_document", {
      documentId: d.id,
      body: "Fresh",
      expectedRevision: rev,
    });
    const stale = await c.callTool({
      name: "update_document",
      arguments: { documentId: d.id, body: "Stale", expectedRevision: rev },
    });
    expect(stale.isError).toBe(true);
    expect(
      (await call<Document>(c, "get_document", { documentId: d.id })).body,
    ).toBe("Fresh");
    const other = await call<Project>(c, "create_project", { title: "Other" });
    const cross = await c.callTool({
      name: "create_flow_node",
      arguments: {
        projectId: other.id,
        label: "Bad",
        phase: "design",
        documentId: d.id,
        position: 0,
      },
    });
    expect(cross.isError).toBe(true);
  } finally {
    await c.close();
  }
});

test("E2E-07 Overview tree, verification link, Markdown and Mermaid rendering", async ({
  page,
}) => {
  const c = await connect();
  try {
    const p = await call<Project>(c, "create_project", {
      title: "Overview project",
    });
    const v = await call<Document>(c, "create_document", {
      projectId: p.id,
      title: "API verification",
      phase: "design",
      templateName: "api",
    });
    const o = await call<Document>(c, "create_document", {
      projectId: p.id,
      title: "Business flow",
      phase: "design",
      templateName: "overview",
    });
    await call<Document>(c, "update_document", {
      documentId: o.id,
      expectedRevision: o.revision,
      body: "# Business\n\n```mermaid\nflowchart LR\n A[Input] --> B[Result]\n```",
      overview: [
        {
          id: "root",
          parentId: null,
          title: "Member flow",
          what: "Manage membership",
          how: "Account service",
          verificationDocumentId: null,
        },
        {
          id: "login",
          parentId: "root",
          title: "Login",
          what: "Authenticate",
          how: "POST login",
          verificationDocumentId: v.id,
        },
      ],
    });
    await page.goto("/");
    await page
      .getByRole("button", { name: "Overview project", exact: true })
      .click();
    await page
      .locator(".document-list")
      .getByRole("button", { name: /Business flow/ })
      .click();
    await expect(
      page.getByText("What Manage membership", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".mermaid svg")).toBeVisible();
    await page
      .getByRole("textbox", { name: "What — 비즈니스 내용", exact: true })
      .nth(0)
      .fill("Updated business flow");
    await page.getByRole("button", { name: "문서 저장", exact: true }).click();
    await expect(
      page.getByText("What Updated business flow", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "검증 방법 보기" }).click();
    await expect(
      page.getByRole("heading", { name: "API verification", exact: true }),
    ).toBeVisible();
  } finally {
    await c.close();
  }
});

test("E2E-06/07 unsaved UI draft survives external change and cannot overwrite newer revision", async ({
  page,
}) => {
  const c = await connect();
  try {
    await projectUI(page, "Concurrent edits");
    await documentUI(page, "Concurrent doc");
    const p = (await call<Project[]>(c, "list_projects")).find(
      (p) => p.title === "Concurrent edits",
    )!;
    const d = (
      await call<Document[]>(c, "list_documents", { projectId: p.id })
    ).find((d) => d.title === "Concurrent doc")!;
    await (await sourceEditor(page, "문서 본문")).fill("Human draft");
    await call(c, "update_document", {
      documentId: d.id,
      body: "AI update",
      expectedRevision: d.revision,
    });
    await expect(
      page.getByRole("alert").filter({ hasText: "다른 작업" }),
    ).toContainText("다른 작업");
    await expect(await sourceEditor(page, "문서 본문")).toHaveValue(
      "Human draft",
    );
    await page.getByRole("button", { name: "문서 저장", exact: true }).click();
    await expect(
      page.getByText("Document revision conflict: reload latest document", {
        exact: true,
      }),
    ).toBeVisible();
    expect(
      (await call<Document>(c, "get_document", { documentId: d.id })).body,
    ).toBe("AI update");
    await page.getByRole("button", { name: "최신 내용 불러오기" }).click();
    await page
      .getByRole("dialog", { name: "최신 내용을 불러올까요?" })
      .getByRole("button", { name: "불러오기", exact: true })
      .click();
    await expect(await sourceEditor(page, "문서 본문")).toHaveValue(
      "AI update",
    );
  } finally {
    await c.close();
  }
});

test("E2E-01/07 existing node editing, document edit and project removal through UI", async ({
  page,
}) => {
  await projectUI(page, "Editable project");
  await documentUI(page, "Editable doc");
  await (await sourceEditor(page, "문서 본문")).fill("## Updated spec");
  await page.getByRole("button", { name: "문서 저장", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Updated spec" }),
  ).toBeVisible();
  await page.getByText("흐름 노드 관리", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "노드 추가", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "노드 삭제", exact: true }),
  ).toHaveCount(0);
  await page.locator(".react-flow__node").first().click();
  await page
    .getByLabel("노드 연결 문서")
    .selectOption({ label: "Editable doc" });
  await page.getByLabel("노드 이름").fill("Renamed node");
  await page.getByRole("button", { name: "노드 수정", exact: true }).click();
  await expect(
    page.locator(".react-flow__node").filter({ hasText: "Renamed node" }),
  ).toBeVisible();
  await page
    .locator(".document-list")
    .getByRole("button", { name: /Editable doc/ })
    .click();
  await expect(
    page.locator(".react-flow__node:not(.flow-document-node)"),
  ).toHaveCount(3);
  await page.getByRole("button", { name: "문서 삭제", exact: true }).click();
  await page
    .getByRole("dialog", { name: "문서를 삭제할까요?" })
    .getByRole("button", { name: "삭제하기", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "어디서 시작할까요?", exact: true }),
  ).toBeVisible();
  await documentUI(page, "Replacement doc");
  await expect(page.locator(".global-error")).toHaveCount(0);
  await page
    .getByRole("button", { name: "프로젝트 설정", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "프로젝트 삭제", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "프로젝트 삭제", exact: true })
    .getByRole("button", { name: "삭제", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Editable project", exact: true }),
  ).toHaveCount(0);
});

test("HTTP rejects cross-origin mutations and malformed JSON", async ({
  request,
  baseURL,
}) => {
  const cross = await request.post("/api/projects", {
    headers: { Origin: "https://external.invalid" },
    data: { title: "Blocked" },
  });
  expect(cross.status()).toBe(403);
  const good = await request.post("/api/projects", {
    headers: { Origin: baseURL! },
    data: { title: "Same origin" },
  });
  expect(good.ok()).toBe(true);
  const malformed = await request.post("/api/projects", {
    headers: { "Content-Type": "application/json" },
    data: "{bad",
  });
  expect(malformed.status()).toBe(400);
});

test("SSE removes documents and projects deleted through MCP", async ({
  page,
}) => {
  const c = await connect();
  try {
    await projectUI(page, "External deletion");
    await documentUI(page, "To delete");
    const p = (await call<Project[]>(c, "list_projects")).find(
      (p) => p.title === "External deletion",
    )!;
    const d = (
      await call<Document[]>(c, "list_documents", { projectId: p.id })
    ).find((d) => d.title === "To delete")!;
    await call(c, "delete_document", {
      documentId: d.id,
      expectedRevision: d.revision,
    });
    await expect(
      page.getByRole("heading", { name: "어디서 시작할까요?", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /To delete/ })).toHaveCount(
      0,
    );
    await call(c, "delete_project", { projectId: p.id });
    await expect(
      page.getByRole("button", { name: "External deletion", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: /설계부터 검증까지/ }),
    ).toBeVisible();
    await expect(page.locator(".global-error")).toHaveCount(0);
  } finally {
    await c.close();
  }
});

test("human can confirm a pending checklist before AI and undo it", async ({
  page,
  request,
}) => {
  const p = await (
    await request.post("/api/projects", {
      data: { title: `Human first ${crypto.randomUUID()}` },
    })
  ).json();
  try {
    const d = await (
      await request.post("/api/documents", {
        data: {
          projectId: p.id,
          title: "사람 먼저 확인",
          phase: "design",
          templateName: "view",
        },
      })
    ).json();
    await page.goto("/");
    await page.getByRole("button", { name: p.title, exact: true }).click();
    await page
      .getByRole("button", { name: "사람 먼저 확인 draft", exact: true })
      .click();
    const check = page.getByRole("checkbox", {
      name: "사람 확인",
      exact: true,
    });
    await expect(page.getByText("AI: pending", { exact: true })).toBeVisible();
    await expect(check).toBeEnabled();
    await check.click();
    await expect(check).toBeChecked();
    await expect
      .poll(
        async () =>
          (await (await request.get(`/api/documents/${d.id}`)).json())
            .checklist[0].humanConfirmed,
      )
      .toBe(true);
    await page.reload();
    await page.getByRole("button", { name: p.title, exact: true }).click();
    await page
      .getByRole("button", { name: "사람 먼저 확인 in-progress", exact: true })
      .click();
    await expect(check).toBeChecked();
    await expect(page.getByText("AI: pending", { exact: true })).toBeVisible();
    await check.click();
    await expect(check).not.toBeChecked();
    await expect
      .poll(
        async () =>
          (await (await request.get(`/api/documents/${d.id}`)).json())
            .checklist[0].humanConfirmed,
      )
      .toBe(false);
  } finally {
    await request.delete(`/api/projects/${p.id}`, { data: {} });
  }
});

test("UX-01 index child creation shows destination, preserves parent relation and protects unsaved navigation", async ({
  page,
  request,
}) => {
  const title = `Contextual creation ${crypto.randomUUID()}`;
  await projectUI(page, title);
  const projects = (await (
    await request.get("/api/projects")
  ).json()) as Project[];
  const project = projects.find((item) => item.title === title)!;
  try {
    await page
      .getByRole("button", { name: "design index draft", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "design index", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "하위 문서 만들기", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "하위 문서 만들기",
      exact: true,
    });
    await expect(
      dialog.getByText(`${title} / design index`, { exact: true }),
    ).toBeVisible();
    await dialog.getByLabel("새 문서 제목").fill("회원가입 화면");
    await dialog.getByLabel("사용할 템플릿").selectOption("view");
    await dialog
      .getByRole("button", { name: "문서 만들기", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "회원가입 화면", exact: true }),
    ).toBeVisible();
    const documents = (await (
      await request.get(`/api/documents?projectId=${project.id}`)
    ).json()) as Document[];
    const parent = documents.find((item) => item.title === "design index")!;
    const child = documents.find((item) => item.title === "회원가입 화면")!;
    expect(child.parentId).toBe(parent.id);
    expect(child.phase).toBe(parent.phase);
    const body = await sourceEditor(page, "문서 본문");
    await body.fill("저장하지 않은 설계");
    await page.locator(".parent-document-link").click();
    const guard = page.getByRole("dialog", {
      name: "저장하지 않은 변경 사항",
      exact: true,
    });
    await expect(guard).toBeVisible();
    await guard.getByRole("button", { name: "계속 편집", exact: true }).click();
    await expect(body).toHaveValue("저장하지 않은 설계");
    await page.locator(".parent-document-link").click();
    await guard
      .getByRole("button", { name: "변경 버리고 이동", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "design index", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .locator(".child-document-list")
        .getByRole("button", { name: /회원가입 화면/ }),
    ).toBeVisible();
    expect(
      (await (await request.get(`/api/documents/${child.id}`)).json()).body,
    ).not.toBe("저장하지 않은 설계");
  } finally {
    await request.delete(`/api/projects/${project.id}`, { data: {} });
  }
});

test("UX-02 unsaved template edits survive cancelled template and workspace navigation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "템플릿 관리", exact: true }).click();
  const title = page.getByRole("textbox", { name: "템플릿 제목", exact: true });
  const body = await sourceEditor(page, "템플릿 본문");
  await title.fill("저장하지 않은 새 템플릿");
  await body.fill("# 보존할 템플릿 본문");
  const existing = page.locator(".template-choice").first();
  await existing.click();
  const localGuard = page.getByRole("dialog", {
    name: "저장하지 않은 템플릿 변경",
    exact: true,
  });
  await expect(localGuard).toBeVisible();
  await localGuard
    .getByRole("button", { name: "계속 편집", exact: true })
    .click();
  await expect(title).toHaveValue("저장하지 않은 새 템플릿");
  await expect(body).toHaveValue("# 보존할 템플릿 본문");
  await existing.click();
  await localGuard
    .getByRole("button", { name: "변경 버리고 이동", exact: true })
    .click();
  await expect(existing).toHaveAttribute("aria-pressed", "true");
  await expect(title).not.toHaveValue("저장하지 않은 새 템플릿");
  await body.fill("# 기존 템플릿의 저장 전 편집");
  await page.getByRole("link", { name: "작업 공간", exact: true }).click();
  const globalGuard = page.getByRole("dialog", {
    name: "저장하지 않은 변경 사항",
    exact: true,
  });
  await expect(globalGuard).toBeVisible();
  await globalGuard
    .getByRole("button", { name: "계속 편집", exact: true })
    .click();
  await expect(body).toHaveValue("# 기존 템플릿의 저장 전 편집");
});

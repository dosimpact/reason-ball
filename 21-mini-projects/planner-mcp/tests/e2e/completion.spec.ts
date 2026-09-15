import { test, expect, type Page } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { randomUUID } from "node:crypto";
import type {
  PlannerDocument,
  Project,
  ApiSpec,
} from "../../src/entities/document/model/schema";
import type { FlowTree } from "../../src/features/flow-spec-syntax/parser";
async function connect() {
  const client = new Client({ name: "completion-test", version: "1" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`${process.env.BASE_URL}/mcp`)),
  );
  return client;
}
async function call<T>(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const response = await client.callTool({ name, arguments: args });
  if (response.isError) throw new Error(JSON.stringify(response.content));
  return (response.structuredContent as { result: T }).result;
}
async function fixture(client: Client, name: string) {
  const project = await call<Project>(client, "create_project", {
    requestId: randomUUID(),
    name,
  });
  const catalog = await call<{ type: string; example: unknown }[]>(
    client,
    "get_catalog",
  );
  const save = (
    type: string,
    title: string,
    extra: Record<string, unknown> = {},
  ) =>
    call<PlannerDocument>(client, "save_document", {
      requestId: randomUUID(),
      projectId: project.id,
      document: {
        type,
        title,
        scope: "test",
        content: catalog.find((e) => e.type === type)!.example,
        ...extra,
      },
    });
  return { project, save };
}
test("저장 응답 유실 후 같은 요청으로 프로젝트·입력·의견을 중복 없이 복구한다", async ({
  page,
}) => {
  const client = await connect();
  const payloads: Record<string, unknown>[] = [];
  const lost = new Set<string>();
  await page.route("**/api/planner", async (route) => {
    const input = route.request().postDataJSON();
    if (!["createProject", "addSource", "comment"].includes(input.action))
      return route.continue();
    payloads.push(input);
    const response = await route.fetch();
    expect(response.ok()).toBeTruthy();
    if (!lost.has(input.action)) {
      lost.add(input.action);
      await route.abort("failed");
    } else await route.fulfill({ response });
  });
  const retry = async () => {
    await expect(
      page.getByRole("alert", { name: "저장 결과 미확인" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "같은 요청으로 재시도", exact: true })
      .click();
    await expect(
      page.getByRole("alert", { name: "저장 결과 미확인" }),
    ).toHaveCount(0);
  };
  try {
    const name = `Lost response ${randomUUID()}`;
    await page.goto("/");
    await page.getByText("＋ 프로젝트 만들기", { exact: true }).click();
    await page.getByLabel("프로젝트 이름", { exact: true }).fill(name);
    await page.getByRole("button", { name: "생성", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "생성", exact: true }),
    ).toBeDisabled();
    await retry();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    const projects = await call<Project[]>(client, "list_projects");
    expect(projects.filter((p) => p.name === name)).toHaveLength(1);
    const project = projects.find((p) => p.name === name)!;
    await page.getByRole("button", { name: "입력 자료", exact: true }).click();
    await page.getByLabel("제목", { exact: true }).fill("Retry source");
    await page
      .getByLabel("원본 내용", { exact: true })
      .fill("Original requirement");
    await page.getByRole("button", { name: "입력 보존", exact: true }).click();
    await retry();
    await expect(page.getByLabel("원본 내용", { exact: true })).toHaveValue("");
    expect(
      (await call<Project>(client, "get_project", { projectId: project.id }))
        .sources,
    ).toHaveLength(1);
    const catalog = await call<{ type: string; example: unknown }[]>(
      client,
      "get_catalog",
    );
    const doc = await call<PlannerDocument>(client, "save_document", {
      requestId: randomUUID(),
      projectId: project.id,
      document: {
        type: "flow-spec-overview",
        title: "Retry review",
        scope: "retry",
        content: catalog.find((e) => e.type === "flow-spec-overview")!.example,
      },
    });
    await page.getByRole("button", { name: "설계 문서", exact: true }).click();
    await page
      .getByRole("button", {
        name: /Flow Spec Overview Retry review retry 초안 r1/,
      })
      .click();
    await page.getByLabel("질문 또는 검토 의견").fill("Only once");
    await page
      .getByRole("button", { name: "의견 남기기", exact: true })
      .click();
    // SSE can advance the displayed revision while the response is lost.
    await expect(page.getByText("Only once", { exact: true })).toBeVisible();
    await retry();
    await expect(page.getByLabel("질문 또는 검토 의견")).toHaveValue("");
    const updated = await call<PlannerDocument>(client, "get_document", {
      projectId: project.id,
      documentId: doc.id,
    });
    expect(updated.revision).toBe(2);
    expect(updated.comments).toHaveLength(1);
    for (const action of ["createProject", "addSource", "comment"]) {
      const attempts = payloads.filter((p) => p.action === action);
      expect(attempts).toHaveLength(2);
      expect(attempts[0]).toEqual(attempts[1]);
    }
  } finally {
    await client.close();
  }
});

test("늦게 도착한 이전 목록 응답이 SSE로 갱신된 프로젝트를 지우지 않는다", async ({
  page,
}) => {
  const client = await connect();
  let captured = false;
  let intercepted = false;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/planner", async (route) => {
    const input = route.request().postDataJSON();
    if (input.action !== "projects" || intercepted) return route.continue();
    intercepted = true;
    const response = await route.fetch();
    captured = true;
    await gate;
    await route.fulfill({ response });
  });
  try {
    await page.goto("/");
    await expect.poll(() => captured).toBe(true);
    // Wait for the other initial read; the held snapshot precedes this write.
    await expect(
      page.getByRole("region", { name: "전체 프로젝트 목록" }),
    ).toBeVisible();
    const name = `Out of order ${randomUUID()}`;
    await call(client, "create_project", { requestId: randomUUID(), name });
    const entry = page.getByRole("button", {
      name: `${name} 프로젝트 열기`,
      exact: true,
    });
    await expect(entry).toBeVisible();
    release();
    await page.waitForLoadState("networkidle");
    await expect(entry).toBeVisible();
  } finally {
    release();
    await client.close();
  }
});

test("느린 협업 요약을 기다리지 않고 프로젝트 목록을 표시한다", async ({
  page,
}) => {
  const client = await connect();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    const { project } = await fixture(client, "Delayed summary");
    await page.route("**/api/events", (route) => route.abort());
    await page.route("**/api/planner", async (route) => {
      if (route.request().postDataJSON().action === "collaboration") await gate;
      await route.continue();
    });
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: `▧ ${project.name}`, exact: true }),
    ).toBeVisible();
    release();
    await page
      .getByRole("button", { name: `▧ ${project.name}`, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "지금 처리할 일" }),
    ).toBeVisible();
  } finally {
    release();
    await client.close();
  }
});

test("빈 프로젝트 응답은 무한 로딩이 아닌 시작 안내를 표시한다", async ({
  page,
}) => {
  await page.route("**/api/events", (route) => route.abort());
  await page.route("**/api/planner", (route) => {
    if (
      ["projects", "collaboration"].includes(
        route.request().postDataJSON().action,
      )
    )
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ result: [] }),
      });
    return route.continue();
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "첫 프로젝트를 시작하세요" }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "프로젝트 로딩" })).toHaveCount(
    0,
  );
});

test("SSE 연결 실패에도 첫 목록 조회와 프로젝트 선택이 가능하다", async ({
  page,
}) => {
  const client = await connect();
  try {
    const { project } = await fixture(client, "No SSE startup");
    await page.route("**/api/events", (route) => route.abort());
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: `▧ ${project.name}`, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: `▧ ${project.name}`, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: project.name, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("연결 복구 중", { exact: false }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "목록 새로고침", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "프로젝트 홈", exact: true }),
    ).toBeVisible();
  } finally {
    await client.close();
  }
});

test("초기 프로젝트 API 오류를 표시하고 수동 재시도로 복구한다", async ({
  page,
}) => {
  const client = await connect();
  let fail = true;
  try {
    const { project } = await fixture(client, "Retry startup");
    await page.route("**/api/events", (route) => route.abort());
    await page.route("**/api/planner", (route) => {
      if (fail && route.request().postDataJSON().action === "projects")
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "UNAVAILABLE", message: "목록 조회 실패" },
          }),
        });
      return route.continue();
    });
    await page.goto("/");
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "목록 조회 실패",
    );
    await expect(page.getByRole("status")).toContainText(
      "프로젝트를 불러오지 못했습니다.",
    );
    fail = false;
    await page
      .getByRole("button", { name: "다시 불러오기", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: `▧ ${project.name}`, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "프로젝트 로딩" }),
    ).toHaveCount(0);
  } finally {
    await client.close();
  }
});

test("협업 요약 실패가 목록과 문서 조회를 막지 않고 재시도된다", async ({
  page,
}) => {
  const client = await connect();
  let fail = true;
  try {
    const { project } = await fixture(client, "Summary isolated failure");
    await page.route("**/api/events", (route) => route.abort());
    await page.route("**/api/planner", (route) => {
      if (fail && route.request().postDataJSON().action === "collaboration")
        return route.abort();
      return route.continue();
    });
    await page.goto("/");
    await page
      .getByRole("button", { name: `▧ ${project.name}`, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "협업 요약 확인 필요" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "설계 문서", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "아직 문서가 없습니다" }),
    ).toBeVisible();
    fail = false;
    await page
      .getByRole("button", { name: "협업 요약 재시도", exact: true })
      .click();
    await page
      .getByRole("button", { name: "프로젝트 홈", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "지금 처리할 일" }),
    ).toBeVisible();
  } finally {
    await client.close();
  }
});
test("열린 화면에 MCP 생성 프로젝트가 새로고침 없이 표시된다", async ({
  page,
}) => {
  const client = await connect();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto("/");
    await expect(page.getByText("실시간 연결됨")).toBeVisible();
    const name = `MCP live sidebar ${randomUUID()}`;
    await call<Project>(client, "create_project", {
      requestId: randomUUID(),
      name,
    });
    const button = page.getByRole("button", { name: `▧ ${name}`, exact: true });
    await expect(button).toBeVisible();
    const list = page.getByRole("region", { name: "전체 프로젝트 목록" });
    await expect(
      list.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "첫 프로젝트를 시작하세요" }),
    ).toHaveCount(0);
    await list
      .getByRole("button", { name: `${name} 프로젝트 열기`, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    const second = `MCP second sidebar ${randomUUID()}`;
    await call<Project>(client, "create_project", {
      requestId: randomUUID(),
      name: second,
    });
    await expect(
      page.getByRole("button", { name: `▧ ${second}`, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "전체 프로젝트", exact: true })
      .click();
    await expect(
      list.getByRole("heading", { name: second, exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      list.getByRole("button", {
        name: `${second} 프로젝트 열기`,
        exact: true,
      }),
    ).toBeVisible();
    await page.reload();
    await expect(button).toBeVisible();
    await expect(
      page.getByRole("button", { name: `▧ ${second}`, exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await client.close();
  }
});
async function open(page: Page, project: Project, title: string) {
  await page.goto("/");
  await page
    .getByRole("button", { name: `▧ ${project.name}`, exact: true })
    .click();
  await page.getByRole("button", { name: "설계 문서", exact: true }).click();
  await page
    .locator(".document-list")
    .getByRole("button")
    .filter({ hasText: title })
    .click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
}

test("협업 홈 → 질문 답변 → AI 반영 → 사용자 승인 → 고정 인계", async ({
  page,
}) => {
  const client = await connect();
  try {
    const { project, save } = await fixture(client, "Collaboration journey");
    const doc = await save("flow-spec-overview", "Budget decision", {
      openQuestions: [
        { id: "budget-q", text: "예산 상한은 얼마인가요?", blocking: true },
      ],
    });
    await page.goto("/");
    await page
      .getByRole("button", { name: `▧ ${project.name}`, exact: true })
      .click();
    const home = page.getByRole("region", { name: "프로젝트 홈" });
    await expect(
      home.getByRole("button", { name: "미해결 질문 1개", exact: true }),
    ).toBeVisible();
    await home.getByText("설계 AI 작업 지시", { exact: true }).click();
    await expect(
      home.getByRole("textbox", { name: "설계 AI 작업 지시" }),
    ).toHaveValue(new RegExp(project.id));
    await home
      .getByRole("button", { name: "미해결 질문 1개", exact: true })
      .click();
    const inbox = page.getByRole("region", { name: "검토함", exact: true });
    await inbox.getByLabel("답변", { exact: true }).fill("하루 100만원입니다.");
    await inbox.getByRole("button", { name: "답변 기록", exact: true }).click();
    await expect(
      inbox.getByText("답변 기록됨 · 설계 반영 대기", { exact: false }),
    ).toBeVisible();
    const replied = await call<PlannerDocument>(client, "get_document", {
      projectId: project.id,
      documentId: doc.id,
    });
    expect(replied.openQuestions[0].resolved).toBe(false);
    expect(replied.comments[0]).toMatchObject({
      questionId: "budget-q",
      text: "하루 100만원입니다.",
    });
    await call(client, "save_document", {
      requestId: randomUUID(),
      projectId: project.id,
      documentId: doc.id,
      expectedRevision: replied.revision,
      document: {
        type: doc.type,
        title: doc.title,
        scope: doc.scope,
        content: doc.content,
        assumptions: [{ id: "budget", text: "사용자 답변: 하루 100만원 상한" }],
        openQuestions: [
          {
            ...replied.openQuestions[0],
            answer: "하루 100만원",
            resolved: true,
          },
        ],
      },
    });
    await expect(
      inbox.getByText("미해결 질문이 없습니다.", { exact: true }),
    ).toBeVisible();
    await inbox
      .getByRole("button", { name: /Budget decision · r3 검토/ })
      .click();
    await page.getByRole("button", { name: "검토 완료", exact: true }).click();
    await page
      .getByRole("button", { name: "개발용 승인", exact: true })
      .click();
    await page
      .getByRole("button", { name: "프로젝트 홈", exact: true })
      .click();
    await expect(
      home.getByRole("button", { name: "승인 문서 1개 · 인계", exact: true }),
    ).toBeVisible();
    await home
      .getByRole("button", { name: "승인 문서 1개 · 인계", exact: true })
      .click();
    await page.getByRole("checkbox").check();
    const approved = await call<PlannerDocument>(client, "get_document", {
      projectId: project.id,
      documentId: doc.id,
    });
    // Selection must stay pinned even if the design agent writes before export.
    await call(client, "save_document", {
      requestId: randomUUID(),
      projectId: project.id,
      documentId: doc.id,
      expectedRevision: approved.revision,
      document: {
        type: doc.type,
        title: "Next budget draft",
        scope: doc.scope,
        content: doc.content,
      },
    });
    await expect(
      page.getByRole("region", { name: "선택한 고정 승인 버전" }),
    ).toContainText(`선택한 승인 버전 r${approved.revision}을 유지합니다.`);
    await page
      .getByRole("button", { name: "인계 묶음 만들기", exact: true })
      .click();
    await expect(page.locator("pre")).toContainText("get_handoff");
    const exported = JSON.parse(await page.locator("pre").innerText());
    expect(exported.arguments.selections).toEqual([
      { documentId: doc.id, revision: approved.revision },
    ]);
    expect(exported.bundle.documents[0]).toMatchObject({
      revision: approved.revision,
      title: "Budget decision",
      status: "approved",
    });
    const bundle = await call<{ documents: PlannerDocument[] }>(
      client,
      "get_handoff",
      {
        projectId: project.id,
        selections: [{ documentId: doc.id, revision: approved.revision }],
      },
    );
    expect(bundle.documents[0].status).toBe("approved");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "검토함", exact: true }).click();
    await expect(inbox).toBeVisible();
  } finally {
    await client.close();
  }
});

test("Flow UI 추가·이동·삭제가 MCP 조회와 일치", async ({ page }) => {
  const client = await connect();
  try {
    const { project, save } = await fixture(client, "All edit actions");
    const doc = await save("flow-spec-overview", "Node operations");
    await open(page, project, "Node operations");
    await page
      .getByRole("button", { name: "Flow 노드 편집", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "편집 동작", exact: true })
      .selectOption("insert");
    await page.getByLabel("노드 설명", { exact: true }).fill("Added in UI");
    await page
      .getByRole("button", { name: "노드 변경 저장", exact: true })
      .click();
    await expect(page.getByText("Added in UI", { exact: true })).toBeVisible();
    let saved = await call<PlannerDocument>(client, "get_document", {
      projectId: project.id,
      documentId: doc.id,
    });
    const id = (saved.content as FlowTree).layers[0].children[0].id;
    await page
      .getByRole("button", { name: "Flow 노드 편집", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "편집 동작", exact: true })
      .selectOption("move");
    await page
      .getByRole("combobox", { name: "대상 노드", exact: true })
      .selectOption(id);
    await page
      .getByRole("combobox", { name: "부모 노드", exact: true })
      .selectOption("layer-1");
    await page
      .getByRole("button", { name: "노드 변경 저장", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Flow 노드 편집", exact: true }),
    ).toBeVisible();
    saved = await call<PlannerDocument>(client, "get_document", {
      projectId: project.id,
      documentId: doc.id,
    });
    expect((saved.content as FlowTree).layers[1].children[0]).toMatchObject({
      id,
      label: "Added in UI",
    });
    await page
      .getByRole("button", { name: "Flow 노드 편집", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "편집 동작", exact: true })
      .selectOption("remove");
    await page
      .getByRole("combobox", { name: "대상 노드", exact: true })
      .selectOption(id);
    await page
      .getByRole("button", { name: "노드 변경 저장", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Flow 노드 편집", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Added in UI", { exact: true }),
    ).not.toBeVisible();
  } finally {
    await client.close();
  }
});

test("HTTP·MCP 공개 경계와 프로토콜 오류", async ({ request }) => {
  const foreign = await request.post("/api/planner", {
    headers: { Origin: "https://foreign.example" },
    data: { action: "projects" },
  });
  expect(foreign.status()).toBe(403);
  const malformed = await request.post("/api/planner", {
    data: "{broken",
    headers: { "Content-Type": "application/json" },
  });
  expect(malformed.status()).toBe(400);
  expect(await malformed.json()).toMatchObject({
    error: { code: "SCHEMA_INVALID" },
  });
  const getMcp = await request.get("/mcp");
  expect(getMcp.status()).toBe(405);
  const client = await connect();
  try {
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "import_figma",
        "edit_flow_node",
        "get_document_relations",
        "compare_documents",
      ]),
    );
    expect(tools.tools).toHaveLength(15);
    expect(tools.tools.map((tool) => tool.name)).not.toContain("approve");
    const invalid = await client.callTool({
      name: "save_document",
      arguments: {
        requestId: randomUUID(),
        projectId: "missing",
        document: { type: "unknown", title: "x", scope: "x", content: {} },
      },
    });
    expect(invalid.isError).toBe(true);
  } finally {
    await client.close();
  }
});

test("문서·탭 전환 및 SSE 이후 접힘 상태와 키보드 검색 유지", async ({
  page,
}) => {
  const client = await connect();
  try {
    const { project, save } = await fixture(client, "Collapse completion");
    const first = await save("flow-spec-overview", "First flow");
    await save("flow-spec-detail", "Second flow");
    await open(page, project, "First flow");
    await page
      .getByRole("button", { name: "Upstream API 접기", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await page
      .locator(".document-list")
      .getByRole("button")
      .filter({ hasText: "Second flow" })
      .click();
    await expect(
      page.getByRole("button", { name: "Upstream API 접기", exact: true }),
    ).toBeVisible();
    await page
      .locator(".document-list")
      .getByRole("button")
      .filter({ hasText: "First flow" })
      .click();
    await expect(
      page.getByRole("button", { name: "Upstream API 펼치기", exact: true }),
    ).toHaveAttribute("aria-expanded", "false");
    await page.getByRole("button", { name: "입력 자료", exact: true }).click();
    await page.getByRole("button", { name: "설계 문서", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Upstream API 펼치기", exact: true }),
    ).toBeVisible();
    await call(client, "edit_flow_node", {
      requestId: randomUUID(),
      projectId: project.id,
      documentId: first.id,
      expectedRevision: 1,
      edit: { action: "remove", nodeId: "step-0" },
    });
    await expect(
      page.getByRole("button", { name: "Upstream API 펼치기", exact: true }),
    ).not.toBeVisible();
    await call(client, "edit_flow_node", {
      requestId: randomUUID(),
      projectId: project.id,
      documentId: first.id,
      expectedRevision: 2,
      edit: {
        action: "insert",
        parentId: "layer-0",
        index: 0,
        node: { id: "new-step", kind: "step", label: "New visible step" },
      },
    });
    await expect(
      page.getByText("New visible step", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "텍스트 보기", exact: true })
      .click();
    await page.getByLabel("흐름 검색").fill("New visible step");
    await page
      .getByRole("button", { name: "New visible step", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "텍스트 보기", exact: true }),
    ).toBeVisible();
  } finally {
    await client.close();
  }
});

test("Flow UI 편집·낡은 revision 충돌·역사 버전 읽기 전용", async ({
  page,
}) => {
  const client = await connect();
  try {
    const { project, save } = await fixture(client, "Editor completion");
    const doc = await save("flow-spec-overview", "Editable flow");
    await open(page, project, "Editable flow");
    await page
      .getByRole("button", { name: "Flow 노드 편집", exact: true })
      .click();
    await page.getByLabel("노드 설명", { exact: true }).fill("UI renamed");
    await page
      .getByRole("button", { name: "노드 변경 저장", exact: true })
      .click();
    await expect(page.getByText("UI renamed", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "Flow 노드 편집", exact: true })
      .click();
    await page.getByLabel("노드 설명", { exact: true }).fill("stale edit");
    await call(client, "edit_flow_node", {
      requestId: randomUUID(),
      projectId: project.id,
      documentId: doc.id,
      expectedRevision: 2,
      edit: { action: "rename", nodeId: "step-0", label: "Other agent" },
    });
    await expect(page.getByText(/편집 중 문서가 변경/)).toBeVisible();
    await page
      .getByRole("button", { name: "노드 변경 저장", exact: true })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: /최신 문서/ }),
    ).toBeVisible();
    const current = await call<PlannerDocument>(client, "get_document", {
      projectId: project.id,
      documentId: doc.id,
    });
    expect((current.content as FlowTree).layers[0].children[0].label).toBe(
      "Other agent",
    );
    await page.getByRole("button", { name: "편집 취소", exact: true }).click();
    await page.getByLabel("조회할 revision", { exact: true }).fill("1");
    await page.getByRole("button", { name: "버전 조회", exact: true }).click();
    await expect(page.getByText(/역사 버전 r1/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Flow 노드 편집", exact: true }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "개발용 승인", exact: true }),
    ).not.toBeVisible();
    await page
      .getByRole("button", { name: "현재 버전으로", exact: true })
      .click();
    await expect(page.getByText("Other agent", { exact: true })).toBeVisible();
  } finally {
    await client.close();
  }
});

test("Overview·Detail 참조 이동과 기준 변경 재검토 안내", async ({ page }) => {
  const client = await connect();
  try {
    const { project, save } = await fixture(client, "Relations completion");
    const overview = await save("flow-spec-overview", "Linked overview");
    await save("flow-spec-detail", "Linked detail", {
      overviewDocumentId: overview.id,
      overviewNodeId: "step-0",
    });
    await open(page, project, "Linked detail");
    await page
      .getByRole("button", { name: "참조 버전 열기", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Linked overview", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/역사 버전 r1/)).toBeVisible();
    await page
      .getByRole("button", { name: "Linked detail 열기", exact: true })
      .click();
    await call(client, "edit_flow_node", {
      requestId: randomUUID(),
      projectId: project.id,
      documentId: overview.id,
      expectedRevision: 1,
      edit: { action: "rename", nodeId: "step-0", label: "Changed baseline" },
    });
    await expect(
      page.getByRole("status").filter({ hasText: "재검토 필요" }),
    ).toBeVisible();
  } finally {
    await client.close();
  }
});

test("API 기준 버전 비교와 질문 해결 정보 표시", async ({ page }) => {
  const client = await connect();
  try {
    const { project, save } = await fixture(client, "Comparison completion");
    const base = await save("bff-api-spec", "Base API");
    const content = {
      ...(base.content as ApiSpec),
      specKind: "change",
      baseDocumentId: base.id,
      baseRevision: 1,
      changeReason: "Add field",
    };
    await save("bff-api-spec", "Changed API", {
      content,
      openQuestions: [
        {
          id: "q",
          text: "Who?",
          blocking: true,
          resolved: true,
          answer: "Operator",
        },
      ],
    });
    await open(page, project, "Changed API");
    await expect(page.getByText("해결됨", { exact: true })).toBeVisible();
    await expect(
      page.getByText("답변: Operator", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "기준 버전과 비교", exact: true })
      .click();
    await expect(
      page
        .getByRole("region", { name: "버전 비교 결과" })
        .getByText("/content/specKind", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "참조 버전 열기", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Base API", exact: true }),
    ).toBeVisible();
  } finally {
    await client.close();
  }
});

test("Figma UI·MCP 가져오기와 오류·중복 방지 (모의 외부 API)", async ({
  page,
}) => {
  const client = await connect();
  try {
    const { project } = await fixture(client, "Figma completion");
    await page.goto("/");
    await page
      .getByRole("button", { name: `▧ ${project.name}`, exact: true })
      .click();
    await page.getByRole("button", { name: "입력 자료", exact: true }).click();
    await page
      .getByLabel("Figma 파일 또는 노드 URL", { exact: true })
      .fill("https://www.figma.com/design/fixture/Example?node-id=1-2");
    await page
      .getByRole("button", { name: "Figma 원본 가져오기", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Figma · Imported Figma Fixture figma",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText(/fixture-v1/)).toBeVisible();
    const args = {
      requestId: randomUUID(),
      projectId: project.id,
      url: "https://www.figma.com/design/fixture/Example",
    };
    const imported = await call<Project>(client, "import_figma", args);
    const retried = await call<Project>(client, "import_figma", args);
    expect(retried).toEqual(imported);
    expect(imported.sources).toHaveLength(2);
    expect(JSON.stringify(imported)).not.toContain("planner-e2e-fake-token");
    await page
      .getByLabel("Figma 파일 또는 노드 URL", { exact: true })
      .fill("https://www.figma.com/design/forbidden/Example");
    await page
      .getByRole("button", { name: "Figma 원본 가져오기", exact: true })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: /Figma 토큰/ }),
    ).toBeVisible();
    expect(
      (await call<Project>(client, "get_project", { projectId: project.id }))
        .sources,
    ).toHaveLength(2);
    const limited = await client.callTool({
      name: "import_figma",
      arguments: {
        requestId: randomUUID(),
        projectId: project.id,
        url: "https://www.figma.com/design/limited",
      },
    });
    expect(limited.isError).toBe(true);
    expect(JSON.stringify(limited.content)).toContain("FIGMA_RATE_LIMITED");
  } finally {
    await client.close();
  }
});

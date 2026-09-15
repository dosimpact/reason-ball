import { test, expect } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import type {
  PlannerDocument,
  Project,
} from "../../src/entities/document/model/schema";

async function connect() {
  const client = new Client({ name: "planner-e2e-agent", version: "1" });
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
type Entry = { type: string; name: string; example: unknown };

test("MCP → SSE → Flow UI → 사용자 승인 → 별도 구현 에이전트 인계", async ({
  page,
}) => {
  const client = await connect();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto("/");
    await page.getByText("＋ 프로젝트 만들기", { exact: true }).click();
    await page
      .getByLabel("프로젝트 이름", { exact: true })
      .fill("Google Ads E2E");
    await page.getByLabel("설명", { exact: true }).fill("예산 추천 검증");
    await page.getByRole("button", { name: "생성", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Google Ads E2E", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("아직 문서가 없습니다.", { exact: false }),
    ).toBeVisible();
    const project = (await call<Project[]>(client, "list_projects")).find(
      (p) => p.name === "Google Ads E2E",
    )!;
    await page.getByRole("button", { name: "입력 자료", exact: true }).click();
    await page.getByLabel("제목", { exact: true }).fill("원본 비즈니스 요구");
    await page
      .getByLabel("원본 내용")
      .fill("캠페인별 예산 추천을 확인하고 적용한다.");
    await page.getByRole("button", { name: "입력 보존" }).click();
    await expect(
      page.getByRole("heading", { name: "원본 비즈니스 요구 requirement" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "설계 문서", exact: true }).click();
    const catalog = await call<Entry[]>(client, "get_catalog");
    expect(catalog).toHaveLength(7);
    const entry = catalog.find((c) => c.type === "flow-spec-overview")!;
    const withSources = await call<Project>(client, "get_project", {
      projectId: project.id,
    });
    const draft = {
      type: entry.type,
      title: "예산 추천 Overview",
      scope: "budget",
      content: entry.example,
      facts: [
        {
          id: "budget-fact",
          text: "예산 추천 적용이 필요하다.",
          sourceIds: [withSources.sources[0].id],
        },
      ],
    };
    const doc = await call<PlannerDocument>(client, "save_document", {
      requestId: randomUUID(),
      projectId: project.id,
      document: draft,
    });
    await page
      .getByRole("button", {
        name: "Flow Spec Overview 예산 추천 Overview budget 초안 r1",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("예산 추천 조회", { exact: true }),
    ).toBeVisible();
    await page
      .getByText("근거 원문: 원본 비즈니스 요구", { exact: true })
      .click();
    await expect(
      page.getByText("캠페인별 예산 추천을 확인하고 적용한다.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page
        .locator("time")
        .filter({ hasText: withSources.sources[0].capturedAt }),
    ).toBeVisible();
    await page.getByRole("button", { name: "전체 접기", exact: true }).click();
    await expect(
      page.getByText("예산 추천 조회", { exact: true }),
    ).not.toBeVisible();
    await page
      .getByRole("textbox", { name: "흐름 검색" })
      .fill("예산 추천 조회");
    await page
      .getByRole("button", { name: "예산 추천 조회", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Upstream API 접기" }),
    ).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("textbox", { name: "흐름 검색" }).fill("");
    await page.getByRole("button", { name: "Upstream API 접기" }).click();
    const updated = await call<PlannerDocument>(client, "save_document", {
      requestId: randomUUID(),
      projectId: project.id,
      documentId: doc.id,
      expectedRevision: 1,
      document: { ...draft, title: "예산 추천 Overview v2" },
    });
    await expect(
      page.getByRole("heading", { name: "예산 추천 Overview v2", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("캠페인별 예산 추천을 확인하고 적용한다.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Upstream API 펼치기" }),
    ).toHaveAttribute("aria-expanded", "false");
    await page
      .getByRole("textbox", { name: "질문 또는 검토 의견" })
      .fill("추천 근거 확인 완료");
    await page.getByRole("button", { name: "의견 남기기" }).click();
    await expect(
      page.getByText("추천 근거 확인 완료", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "검토 완료", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "개발용 승인" }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "개발용 승인" }).click();
    await expect(page.getByText(/승인 버전 r/)).toBeVisible();
    const approved = await call<PlannerDocument>(client, "get_document", {
      projectId: project.id,
      documentId: doc.id,
    });
    expect(approved.status).toBe("approved");
    await page.getByRole("button", { name: "개발 인계", exact: true }).click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "인계 묶음 만들기" }).click();
    await expect(
      page.getByRole("heading", { name: "MCP 호출과 고정 설계" }),
    ).toBeVisible();
    await call(client, "save_document", {
      requestId: randomUUID(),
      projectId: project.id,
      documentId: doc.id,
      expectedRevision: approved.revision,
      document: { ...draft, title: "개발 중 새 초안" },
    });
    const implementer = await connect();
    try {
      const bundle = await call<{
        documents: PlannerDocument[];
        project: Project;
      }>(implementer, "get_handoff", {
        projectId: project.id,
        selections: [{ documentId: doc.id, revision: approved.revision }],
      });
      expect(bundle.documents[0].title).toBe(updated.title);
      expect(bundle.documents[0].status).toBe("approved");
      expect(bundle.project.sources[0].originalText).toContain("캠페인별");
    } finally {
      await implementer.close();
    }
    expect(errors).toEqual([]);
  } finally {
    await client.close();
  }
});

test("일곱 타입 렌더러·scope 필터와 외부 변경·손상·삭제 실시간 반영", async ({
  page,
}) => {
  const client = await connect();
  try {
    const project = await call<Project>(client, "create_project", {
      requestId: randomUUID(),
      name: "모든 문서 시각화",
    });
    const entries = await call<Entry[]>(client, "get_catalog"),
      docs: PlannerDocument[] = [];
    for (const entry of entries)
      docs.push(
        await call<PlannerDocument>(client, "save_document", {
          requestId: randomUUID(),
          projectId: project.id,
          document: {
            type: entry.type,
            title: entry.name,
            scope: "campaign",
            content: entry.example,
          },
        }),
      );
    await page.goto("/");
    await page
      .getByRole("button", { name: "▧ 모든 문서 시각화", exact: true })
      .click();
    await page.getByRole("button", { name: "설계 문서", exact: true }).click();
    for (const entry of entries) {
      await page
        .getByRole("button", {
          name: `${entry.name} ${entry.name} campaign 초안 r1`,
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("heading", { name: entry.name, exact: true }),
      ).toBeVisible();
      if (entry.type.endsWith("api-spec"))
        await expect(
          page.getByRole("heading", { name: "캠페인 조회" }),
        ).toBeVisible();
      if (entry.type === "db-entity")
        await expect(
          page
            .getByRole("region", { name: "엔티티 다이어그램" })
            .locator("svg"),
        ).toBeVisible();
      if (entry.type === "weblogging-spec")
        await expect(
          page.getByText("대상 캠페인 식별자", { exact: true }),
        ).toBeVisible();
      if (entry.type === "figma-requirements")
        await expect(
          page.getByRole("heading", { name: "BudgetRecommendation widget" }),
        ).toBeVisible();
      if (entry.type.startsWith("flow-spec"))
        await expect(
          page.getByRole("region", { name: "Flow Spec" }),
        ).toBeVisible();
    }
    const target = docs.find((d) => d.type === "flow-spec-detail")!;
    const file = path.join(
      process.env.PLANNER_TEST_DATA!,
      "projects",
      project.id,
      "documents",
      `${target.id}.json`,
    );
    const original = await readFile(file, "utf8");
    await writeFile(
      file,
      JSON.stringify({ ...target, revision: 2, title: "외부 변경 감지" }),
    );
    await expect(
      page.getByRole("heading", { name: "외부 변경 감지", exact: true }),
    ).toBeVisible();
    await writeFile(file, "{broken");
    await expect(page.getByText(/데이터 파일 오류/)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "외부 변경 감지", exact: true }),
    ).toBeVisible();
    await writeFile(file, original);
    await expect(page.getByText(/데이터 파일 오류/)).not.toBeVisible();
    await unlink(file);
    await expect(
      page.getByRole("heading", { name: "문서를 선택하세요" }),
    ).toBeVisible();
    await page.getByLabel("scope 필터").selectOption("campaign");
    await expect(
      page.getByRole("button", {
        name: "Flow Spec Overview Flow Spec Overview campaign 초안 r1",
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await client.close();
  }
});

test("연결이 끊긴 동안 변경된 문서가 재연결 후 모바일 UI에 반영", async ({
  page,
  context,
}) => {
  const client = await connect();
  try {
    const project = await call<Project>(client, "create_project", {
      requestId: randomUUID(),
      name: "재연결 검증",
    });
    const entry = (await call<Entry[]>(client, "get_catalog")).find(
      (e) => e.type === "flow-spec-overview",
    )!;
    const draft = {
      type: entry.type,
      title: "연결 전 설계",
      scope: "mobile",
      content: entry.example,
    };
    const doc = await call<PlannerDocument>(client, "save_document", {
      requestId: randomUUID(),
      projectId: project.id,
      document: draft,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page
      .getByRole("button", { name: "▧ 재연결 검증", exact: true })
      .click();
    await page.getByRole("button", { name: "설계 문서", exact: true }).click();
    await page
      .getByRole("button", {
        name: "Flow Spec Overview 연결 전 설계 mobile 초안 r1",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("heading", { name: "연결 전 설계", exact: true }),
    ).toBeVisible();
    await context.setOffline(true);
    await call(client, "save_document", {
      requestId: randomUUID(),
      projectId: project.id,
      documentId: doc.id,
      expectedRevision: 1,
      document: { ...draft, title: "재연결 후 설계" },
    });
    await context.setOffline(false);
    await expect(
      page.getByRole("heading", { name: "재연결 후 설계", exact: true }),
    ).toBeVisible({ timeout: 20000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  } finally {
    await context.setOffline(false);
    await client.close();
  }
});

import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type {
  DocumentTemplate,
  TemplateDraft,
} from "../../src/entities/template/model/schema";
const fixture = (): TemplateDraft => ({
  name: `template-${randomUUID()}`,
  title: "사용자 템플릿",
  description: "확장한 종류",
  format: "markdown",
  body: "# API 설계\n\n```mermaid\nflowchart LR\n A-->B\n```",
  example: "# 조회 API 예시\n\n| 필드 | 설명 |\n| --- | --- |\n| id | 식별자 |",
  prompt: "원본 요구사항을 확인하세요.",
});
async function connect() {
  const client = new Client({ name: "template-test", version: "1" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`${process.env.BASE_URL}/mcp`)),
  );
  return client;
}
async function call<T>(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
) {
  const response = await client.callTool({ name, arguments: args });
  expect(response.isError, JSON.stringify(response.content)).not.toBe(true);
  return (response.structuredContent as { result: T }).result;
}
test("TPL REST와 MCP는 템플릿과 프롬프트를 공유하고 기존 카탈로그를 유지한다", async ({
  request,
}) => {
  const client = await connect();
  try {
    const template = fixture();
    const created = await call<DocumentTemplate>(client, "create_template", {
      requestId: randomUUID(),
      template,
    });
    const res = await request.get(`/api/templates/${template.name}`);
    expect(res.status()).toBe(200);
    expect((await res.json()).result).toEqual(created);
    const update = await request.put(`/api/templates/${template.name}`, {
      data: {
        requestId: randomUUID(),
        expectedRevision: 1,
        template: { ...template, prompt: "변경 지침" },
      },
    });
    expect(update.status()).toBe(200);
    expect(
      (
        await call<DocumentTemplate>(client, "get_template", {
          name: template.name,
        })
      ).prompt,
    ).toBe("변경 지침");
    expect(
      (await call<DocumentTemplate[]>(client, "list_templates")).some(
        (t) => t.name === template.name,
      ),
    ).toBe(true);
    expect(await call<unknown[]>(client, "get_catalog")).toHaveLength(7);
    await call(client, "update_template", {
      requestId: randomUUID(),
      expectedRevision: 2,
      template: { ...template, prompt: "MCP 수정 지침" },
    });
    await call(client, "delete_template", {
      requestId: randomUUID(),
      name: template.name,
      expectedRevision: 3,
    });
    expect(
      (await request.get(`/api/templates/${template.name}`)).status(),
    ).toBe(404);
  } finally {
    await client.close();
  }
});
test("TPL UI 생성·Markdown/Mermaid·예시·프롬프트 수정·재조회·삭제", async ({
  page,
}) => {
  const template = fixture();
  await page.goto("/");
  await page.getByRole("link", { name: "문서 템플릿 관리 →" }).click();
  await page
    .getByRole("textbox", { name: "템플릿 이름", exact: true })
    .fill(template.name);
  await page
    .getByRole("textbox", { name: "표시 제목", exact: true })
    .fill(template.title);
  await page
    .getByRole("textbox", { name: "템플릿 본문", exact: true })
    .fill(template.body);
  await page
    .getByRole("textbox", { name: "예시 본문", exact: true })
    .fill(template.example);
  await page
    .getByRole("textbox", { name: "AI 사용 프롬프트", exact: true })
    .fill(template.prompt);
  await expect(
    page.getByLabel("Mermaid 다이어그램").locator("svg"),
  ).toBeVisible();
  await page.getByRole("button", { name: "템플릿 저장", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "템플릿" }),
  ).toHaveText("템플릿과 프롬프트를 저장했습니다.");
  await page.getByRole("tab", { name: "예시 보기" }).click();
  await expect(
    page.getByRole("tabpanel").getByRole("heading", { name: "조회 API 예시" }),
  ).toBeVisible();
  await expect(
    page.getByRole("tabpanel").getByRole("cell", { name: "식별자" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "AI 사용 프롬프트", exact: true })
    .fill("수정 지침");
  await page.getByRole("button", { name: "템플릿 저장", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "템플릿" }),
  ).toHaveText("템플릿과 프롬프트를 저장했습니다.");
  await page.reload();
  await page
    .getByRole("button", {
      name: `${template.title} ${template.name} · r2`,
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("textbox", { name: "AI 사용 프롬프트", exact: true }),
  ).toHaveValue("수정 지침");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/template-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "템플릿 삭제", exact: true }).click();
  await page.getByRole("button", { name: "삭제 확정", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "템플릿" }),
  ).toHaveText("템플릿을 삭제했습니다.");
  await expect(
    page.getByRole("button", {
      name: `${template.title} ${template.name} · r2`,
      exact: true,
    }),
  ).toHaveCount(0);
});
test("TPL SSE 갱신과 충돌은 미저장 입력을 보존한다", async ({
  page,
  request,
}) => {
  const template = fixture();
  await page.goto("/templates");
  await request.post("/api/templates", {
    data: { requestId: randomUUID(), template },
  });
  await page
    .getByRole("button", {
      name: `${template.title} ${template.name} · r1`,
      exact: true,
    })
    .click();
  await page
    .getByRole("textbox", { name: "AI 사용 프롬프트", exact: true })
    .fill("내 미저장 입력");
  await request.put(`/api/templates/${template.name}`, {
    data: {
      requestId: randomUUID(),
      expectedRevision: 1,
      template: { ...template, prompt: "외부 수정" },
    },
  });
  await expect(
    page.getByText("저장된 템플릿이 변경되거나 삭제되었습니다.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "AI 사용 프롬프트", exact: true }),
  ).toHaveValue("내 미저장 입력");
  await page.getByRole("button", { name: "템플릿 저장", exact: true }).click();
  await expect(
    page.getByText("다른 변경이 저장되었습니다. 최신 내용을 다시 조회하세요.", {
      exact: true,
    }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "최신 내용 불러오기", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "AI 사용 프롬프트", exact: true }),
  ).toHaveValue("외부 수정");
});
test("TPL 응답 유실 후 같은 requestId로 재시도한다", async ({
  page,
  request,
}) => {
  const template = fixture();
  const bodies: unknown[] = [];
  await page.route("**/api/templates", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    bodies.push(route.request().postDataJSON());
    const response = await route.fetch();
    if (bodies.length === 1) await route.abort("failed");
    else await route.fulfill({ response });
  });
  await page.goto("/templates");
  for (const [label, value] of [
    ["템플릿 이름", template.name],
    ["표시 제목", template.title],
    ["템플릿 본문", template.body],
    ["예시 본문", template.example],
    ["AI 사용 프롬프트", template.prompt],
  ]) {
    await page.getByRole("textbox", { name: label, exact: true }).fill(value);
  }
  await page.getByRole("button", { name: "템플릿 저장", exact: true }).click();
  await page
    .getByRole("button", { name: "같은 요청으로 재시도", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "템플릿" }),
  ).toHaveText("템플릿과 프롬프트를 저장했습니다.");
  expect(bodies).toHaveLength(2);
  expect(bodies[0]).toEqual(bodies[1]);
  expect(
    (await (await request.get(`/api/templates/${template.name}`)).json()).result
      .revision,
  ).toBe(1);
});

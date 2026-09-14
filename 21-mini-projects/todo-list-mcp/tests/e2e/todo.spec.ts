import { test, expect } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ResourceUpdatedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import type { Todo } from "../../src/shared/todo";
const url = "http://127.0.0.1:3137";
test.beforeEach(async ({ request }) => {
  const store = await (await request.get("/api/todos")).json();
  for (const todo of store.todos) await request.delete("/api/todos/" + todo.id);
});
async function withMcp(work: (client: Client) => Promise<void>) {
  const client = new Client({ name: "todo-tests", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(
    new URL(url + "/api/mcp"),
  );
  try {
    await client.connect(transport);
    await work(client);
  } finally {
    try {
      await transport.terminateSession();
    } finally {
      await client.close();
    }
  }
}
test("MCP CRUD updates UI; UI edits are visible through MCP", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("실시간 연결됨");
  await withMcp(async (client) => {
    expect((await client.listTools()).tools.map((t) => t.name).sort()).toEqual(
      [
        "create_todo",
        "delete_todo",
        "get_todo_by_id",
        "get_todo_list",
        "update_todo",
      ].sort(),
    );
    const created = await client.callTool({
      name: "create_todo",
      arguments: { title: "AI task" },
    });
    expect(created.isError).not.toBe(true);
    const { todo } = created.structuredContent as { todo: Todo };
    await expect(page.getByText("AI task", { exact: true })).toBeVisible();
    await client.callTool({
      name: "update_todo",
      arguments: { id: todo.id, completed: true },
    });
    await expect(
      page.getByRole("checkbox", { name: "AI task 완료" }),
    ).toBeChecked();
    await page.getByRole("button", { name: "수정", exact: true }).click();
    await page.getByRole("textbox", { name: "수정할 제목" }).fill("UI renamed");
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByText("UI renamed", { exact: true })).toBeVisible();
    const detail = await client.callTool({
      name: "get_todo_by_id",
      arguments: { id: todo.id },
    });
    expect((detail.structuredContent as { todo: Todo }).todo.title).toBe(
      "UI renamed",
    );
    await client.callTool({ name: "delete_todo", arguments: { id: todo.id } });
    await expect(page.getByText("UI renamed", { exact: true })).toHaveCount(0);
    expect(
      (
        await client.callTool({
          name: "get_todo_by_id",
          arguments: { id: todo.id },
        })
      ).isError,
    ).toBe(true);
  });
  expect(pageErrors).toEqual([]);
});
test("resources, subscriptions, prompt snapshot and failures", async ({
  request,
}) => {
  await withMcp(async (client) => {
    expect(
      (await client.listResources()).resources.some(
        (r) => r.uri === "todo://list",
      ),
    ).toBe(true);
    expect(
      (await client.listResourceTemplates()).resourceTemplates[0].uriTemplate,
    ).toBe("todo://items/{id}");
    expect((await client.listPrompts()).prompts[0].name).toBe("review_todos");
    const notices: string[] = [];
    client.setNotificationHandler(
      ResourceUpdatedNotificationSchema,
      (notice) => {
        notices.push(notice.params.uri);
      },
    );
    await client.subscribeResource({ uri: "todo://list" });
    const { todo } = await (
      await request.post("/api/todos", { data: { title: "Resource task" } })
    ).json();
    await expect.poll(() => notices).toContain("todo://list");
    const uri = "todo://items/" + todo.id;
    await client.subscribeResource({ uri });
    const resource = await client.readResource({ uri });
    expect(
      JSON.parse((resource.contents[0] as { text: string }).text).todo.title,
    ).toBe("Resource task");
    await request.patch("/api/todos/" + todo.id, { data: { completed: true } });
    await expect.poll(() => notices).toContain(uri);
    const before = await (await request.get("/api/todos")).json();
    const prompt = await client.getPrompt({ name: "review_todos" });
    expect(JSON.stringify(prompt)).toContain("Resource task");
    expect(await (await request.get("/api/todos")).json()).toEqual(before);
    await client.unsubscribeResource({ uri: "todo://list" });
    await request.delete("/api/todos/" + todo.id);
    await expect(client.readResource({ uri })).rejects.toThrow();
    expect(
      (
        await client.callTool({
          name: "update_todo",
          arguments: { id: todo.id },
        })
      ).isError,
    ).toBe(true);
    expect(
      (
        await client.callTool({
          name: "create_todo",
          arguments: { title: " " },
        })
      ).isError,
    ).toBe(true);
    const list = await client.callTool({
      name: "get_todo_list",
      arguments: {},
    });
    expect((list.structuredContent as { todos: Todo[] }).todos).toEqual([]);
  });
});
test("UI CRUD, filters, two browsers and SSE reconnect", async ({
  page,
  browser,
  request,
}) => {
  const second = await browser.newContext();
  try {
    const other = await second.newPage();
    await Promise.all([page.goto("/"), other.goto(url)]);
    await expect(page.getByRole("status")).toHaveText("실시간 연결됨");
    await expect(other.getByRole("status")).toHaveText("실시간 연결됨");
    await page.getByRole("textbox", { name: "새 할 일" }).fill("Browser task");
    await page.getByRole("button", { name: "추가", exact: true }).click();
    await expect(
      other.getByText("Browser task", { exact: true }),
    ).toBeVisible();
    // Controlled checkbox commits after the server save, not synchronously on click.
    await page.getByRole("checkbox", { name: "Browser task 완료" }).click();
    await expect(
      page.getByRole("checkbox", { name: "Browser task 완료" }),
    ).toBeChecked();
    await expect(
      other.getByRole("checkbox", { name: "Browser task 완료" }),
    ).toBeChecked();
    await page.getByRole("button", { name: "미완료", exact: true }).click();
    await expect(page.getByText("Browser task", { exact: true })).toHaveCount(
      0,
    );
    await page.getByRole("button", { name: "완료", exact: true }).click();
    await expect(page.getByText("Browser task", { exact: true })).toBeVisible();
    await second.setOffline(true);
    await expect(other.getByRole("status")).toHaveText("오프라인");
    const { todo } = await (
      await request.post("/api/todos", { data: { title: "While offline" } })
    ).json();
    await second.setOffline(false);
    await expect(other.getByText("While offline", { exact: true })).toBeVisible(
      { timeout: 15000 },
    );
    await request.delete("/api/todos/" + todo.id);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "삭제", exact: true }).click();
    await expect(other.getByText("Browser task", { exact: true })).toHaveCount(
      0,
    );
  } finally {
    await second.close();
  }
});
test("HTTP validation, not found and origin protection", async ({
  request,
}) => {
  expect(
    (await request.post("/api/todos", { data: { title: " " } })).status(),
  ).toBe(400);
  expect(
    (await request.patch("/api/todos/missing", { data: {} })).status(),
  ).toBe(400);
  expect((await request.get("/api/todos/missing")).status()).toBe(404);
  expect(
    (
      await request.post("/api/todos", {
        data: { title: "blocked" },
        headers: { Origin: "https://example.com" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/mcp", {
        data: {},
        headers: { Origin: "https://example.com" },
      })
    ).status(),
  ).toBe(403);
});

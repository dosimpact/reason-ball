import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

type Row = Record<string, string | number | null>;
// Exercise the production query/aggregation code and actual Supabase query builder.
// Isolate server-only framework imports and the unrelated history DTO mapper.
const compiled = ts.transpileModule(readFileSync(resolve("src/shared/api/supabase/learning.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const exported: Record<string, unknown> = {};
new Function("require", "exports", compiled)((name: string) => {
  if (name === "server-only") return {};
  if (name === "./http") return { assertDatabaseSuccess: (error: unknown) => { if (error) throw new Error("Database page failed"); } };
  if (name === "./domain") return { historyFromConversation: (row: Row, message?: Row, count?: number) => ({
    conversationId: row.id, preview: message?.plain_text ?? "", turnCount: count ?? 0,
  }) };
  throw new Error(`Unexpected runtime import: ${name}`);
}, exported);
const snapshot = exported.getLearningSnapshot as typeof import("../../src/shared/api/supabase/learning").getLearningSnapshot;

function fixture(count = 105) {
  const conversations: Row[] = Array.from({ length: count }, (_, index) => ({
    id: `conversation-${String(index).padStart(4, "0")}`, owner_id: "owner", status: "active",
    character_id: "character", mission_id: null, title: `Title ${index}`, metadata: null,
    last_message_at: "2026-09-11T01:00:00Z", created_at: "2026-09-10T01:00:00Z",
  }));
  const messages: Row[] = count ? Array.from({ length: 1205 }, (_, index) => ({
    conversation_id: conversations[0].id, sequence_number: index + 1, plain_text: `Turn ${index + 1}`, role: "user",
  })) : [];
  if (count > 1) messages.push({ conversation_id: conversations[count - 1].id, sequence_number: 7, plain_text: "Last conversation", role: "assistant" });
  return { conversations, messages };
}

function transport(data: ReturnType<typeof fixture>, fault?: "later" | "repeat") {
  const requests: URL[] = [];
  const client = createClient("http://supabase.test", "publishable-test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input) => {
      const url = new URL(String(input)); requests.push(url);
      const table = url.pathname.split("/").pop()!;
      const offset = Number(url.searchParams.get("offset") ?? 0);
      if (fault === "later" && table === "messages" && offset > 0) {
        return Response.json({ code: "XX000", message: "Database unavailable" }, { status: 500 });
      }
      let rows = [...(data[table as keyof typeof data] ?? [])];
      for (const [key, filter] of url.searchParams) {
        if (filter.startsWith("eq.")) rows = rows.filter((row) => String(row[key]) === filter.slice(3));
        if (filter.startsWith("neq.")) rows = rows.filter((row) => String(row[key]) !== filter.slice(4));
        if (filter.startsWith("in.(")) {
          const values = filter.slice(4, -1).split(",");
          expect(values.length).toBeLessThanOrEqual(50);
          rows = rows.filter((row) => values.includes(String(row[key])));
        }
      }
      const orders = (url.searchParams.get("order") ?? "").split(",").filter(Boolean);
      rows.sort((a, b) => {
        for (const order of orders) {
          const [key, direction] = order.split(".");
          const comparison = typeof a[key] === "number" ? Number(a[key]) - Number(b[key]) : String(a[key]).localeCompare(String(b[key]));
          if (comparison) return direction === "desc" ? -comparison : comparison;
        }
        return 0;
      });
      // Simulate a project Data API cap smaller than the requested page size.
      const start = fault === "repeat" ? 0 : offset;
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 1000), 37);
      return Response.json(rows.slice(start, start + limit));
    } },
  });
  return { client, requests };
}

test("loads all histories and accurate counts/previews beyond both old caps with timestamp ties", async () => {
  const data = fixture();
  data.conversations.reverse(); // Equal activity times must not determine page boundaries.
  data.conversations.push({ ...data.conversations[0], id: "foreign", owner_id: "other" });
  data.conversations.push({ ...data.conversations[0], id: "deleted", status: "deleted" });
  data.messages.push({ conversation_id: "conversation-0000", sequence_number: 2000, plain_text: "Hidden system", role: "system" });
  const { client, requests } = transport(data);
  const result = await snapshot(client, "owner");
  expect(result.histories).toHaveLength(105);
  expect(new Set(result.histories.map((row) => row.conversationId)).size).toBe(105);
  expect(result.histories[0]).toMatchObject({ conversationId: "conversation-0000", preview: "Turn 1205", turnCount: 1205 });
  expect(result.histories[104]).toMatchObject({ conversationId: "conversation-0104", preview: "Last conversation", turnCount: 1 });
  expect(result.histories[1]).toMatchObject({ preview: "", turnCount: 0 });
  const historyRequests = requests.filter((url) => /\/(conversations|messages)$/.test(url.pathname));
  expect(historyRequests.every((url) => Number(url.searchParams.get("limit")) <= 200)).toBe(true);
  expect(historyRequests.filter((url) => url.pathname.endsWith("conversations")).every((url) => url.searchParams.get("order") === "id.asc")).toBe(true);
  expect(historyRequests.filter((url) => url.pathname.endsWith("messages")).every((url) => url.searchParams.get("order") === "conversation_id.asc,sequence_number.desc")).toBe(true);
});

test("empty history terminates on its first empty page without querying messages", async () => {
  const { client, requests } = transport(fixture(0));
  expect((await snapshot(client, "owner")).histories).toEqual([]);
  expect(requests.filter((url) => url.pathname.endsWith("conversations"))).toHaveLength(1);
  expect(requests.some((url) => url.pathname.endsWith("messages"))).toBe(false);
});

test("later database failures and repeated pages reject instead of returning partial history", async () => {
  await expect(snapshot(transport(fixture(), "later").client, "owner")).rejects.toThrow("Database page failed");
  await expect(snapshot(transport(fixture(), "repeat").client, "owner")).rejects.toThrow("repeated history page");
});

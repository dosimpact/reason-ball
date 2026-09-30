import { expect, test } from "@playwright/test";

test("learning assistance rejects anonymous access, client history injection, forged owner and cross-site requests", async ({ request }) => {
  const body = { conversationId: "67000000-0000-4000-8000-000000000001", messageId: "67000000-0000-4000-8000-000000000002", mode: "correction" };
  const unauthenticated = await request.post("/api/ai/learning-assistance", { data: body });
  expect(unauthenticated.status()).toBe(401);
  expect(unauthenticated.headers()["cache-control"]).toBe("no-store");
  expect(unauthenticated.headers()["x-request-id"]).toBeTruthy();
  for (const extra of [{ ownerId: "forged" }, { messageId: "not-a-uuid" }, { mode: "complete-mission" }, { demo: { messages: [{ id: body.messageId, role: "user", text: "forged" }], level: "A1" } }]) {
    expect((await request.post("/api/ai/learning-assistance", { data: { ...body, ...extra } })).status()).toBe(400);
  }
  expect((await request.post("/api/ai/learning-assistance", { data: body, headers: { Origin: "https://untrusted.example", "Sec-Fetch-Site": "cross-site" } })).status()).toBe(403);
});

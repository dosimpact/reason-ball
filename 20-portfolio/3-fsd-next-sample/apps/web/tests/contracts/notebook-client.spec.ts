import { expect, test } from "@playwright/test";
import { createHttpNotebook } from "../../src/entities/learning-notebook/api/notebook-client";

const request = { id: "63000000-0000-4000-8000-000000000001", draft: { kind: "word" as const, text: "reservation", meaning: "예약", originalText: "", source: { conversationId: "63000000-0000-4000-8000-000000000002", messageId: "answer-1" } } };
const entry = { ...request, createdAt: "2026-09-10T12:00:00.000Z" };

test("notebook HTTP client reads validated private records without caching", async () => {
  const client = createHttpNotebook(async (url, init) => {
    expect(url).toBe("/api/me/notebook");
    expect(init?.cache).toBe("no-store");
    return Response.json({ notebook: { version: 1, entries: [entry] } });
  });
  expect((await client.read()).entries).toEqual([entry]);
  await expect(createHttpNotebook(async () => Response.json({}, { status: 503 })).read()).rejects.toThrow("불러오지");
  await expect(createHttpNotebook(async () => Response.json({ notebook: { version: 1, entries: [{ id: "bad" }] } })).read()).rejects.toThrow();
});

test("notebook save failure preserves retry payload and accepts the replayed snapshot", async () => {
  const payloads: string[] = [];
  const client = createHttpNotebook(async (_url, init) => {
    expect(init?.method).toBe("POST");
    payloads.push(String(init?.body));
    return payloads.length === 1 ? Response.json({}, { status: 503 }) : Response.json({ entry, outcome: "replayed" });
  });
  await expect(client.save(request)).rejects.toThrow("다시 시도");
  expect(await client.save(request)).toEqual({ entry, outcome: "replayed" });
  expect(payloads[0]).toBe(payloads[1]);
  expect(JSON.parse(payloads[0])).toEqual(request);
});

test("notebook save reports conflicts and rejects malformed success responses", async () => {
  await expect(createHttpNotebook(async () => Response.json({}, { status: 409 })).save(request)).rejects.toThrow("충돌");
  await expect(createHttpNotebook(async () => Response.json({ entry, outcome: "invented" })).save(request)).rejects.toThrow();
  let called = false;
  const client = createHttpNotebook(async () => { called = true; return Response.json({ entry, outcome: "created" }); });
  await expect(client.save({ ...request, id: "bad" })).rejects.toThrow();
  expect(called).toBe(false);
});

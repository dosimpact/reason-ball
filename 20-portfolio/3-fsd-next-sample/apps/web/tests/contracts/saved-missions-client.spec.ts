import { expect, test } from "@playwright/test";
import { createHttpSavedMissions } from "../../src/entities/mission/api/saved-missions-client";

const request = { requestId: "65000000-0000-4000-8000-000000000001", missionId: "65000000-0000-4000-8000-000000000002", saved: false };

test("saved mission HTTP reads preserve unavailable entries and reject malformed or failed lists", async () => {
  const items = [{ missionId: request.missionId, savedAt: "2026-09-10T12:00:00.000Z", mission: null }];
  const client = createHttpSavedMissions(async (url, init) => {
    expect(url).toBe("/api/me/saved-missions");
    expect(init?.cache).toBe("no-store");
    return Response.json({ items });
  });
  expect(await client.read()).toEqual(items);
  await expect(createHttpSavedMissions(async () => Response.json({}, { status: 503 })).read()).rejects.toThrow("불러오지");
  await expect(createHttpSavedMissions(async () => Response.json({ items: [{ ...items[0], mission: { id: "other", title: "Private", summary: "" } }] })).read()).rejects.toThrow();
});

test("saved mission retries retain the explicit state and request key after response loss", async () => {
  const requests: string[] = [];
  const client = createHttpSavedMissions(async (_url, init) => {
    expect(init?.method).toBe("PUT");
    requests.push(String(init?.body));
    if (requests.length === 1) return Response.json({}, { status: 503 });
    return Response.json({ result: { missionId: request.missionId, saved: false } });
  });
  await expect(client.set(request)).rejects.toThrow("다시 시도");
  expect(await client.set(request)).toEqual({ missionId: request.missionId, saved: false });
  expect(requests[0]).toBe(requests[1]);
  expect(JSON.parse(requests[0])).toEqual(request);
});

test("saved mission client rejects conflict or a mismatched acknowledgement", async () => {
  await expect(createHttpSavedMissions(async () => Response.json({}, { status: 409 })).set(request)).rejects.toThrow("충돌");
  for (const result of [{ missionId: "other", saved: false }, { missionId: request.missionId, saved: true }]) {
    await expect(createHttpSavedMissions(async () => Response.json({ result })).set(request)).rejects.toThrow("응답");
  }
});

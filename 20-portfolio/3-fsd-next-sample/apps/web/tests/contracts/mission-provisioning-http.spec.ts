import { expect, test } from "@playwright/test";
import { httpLearningRepository } from "../../src/shared/api/learning/http-repository";

const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });

for (const mode of ["assigned", "manager", "needs-profile", "guest", "catalog-empty"]) {
  test(`mission list checks provisioning before reading RLS-visible missions (${mode})`, async () => {
    const calls: Array<{ url: string; method: string; body?: BodyInit | null }> = [];
    const missions = mode === "assigned" ? [{ id: "assigned-1" }] : [];
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      calls.push({ url, method: init?.method ?? "GET", body: init?.body });
      return Response.json(url.endsWith("mission-assignments")
        ? { provisioning: { mode, assignedCount: missions.length } }
        : { items: missions });
    };
    expect(await httpLearningRepository.listMissions()).toEqual(missions);
    expect(calls).toEqual([
      { url: "/api/me/mission-assignments", method: "POST", body: "{}" },
      { url: "/api/missions", method: "GET", body: undefined },
    ]);
  });
}

test("provisioning failure does not read or fabricate an empty mission list", async () => {
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    return Response.json({ error: { code: "DATA_SERVICE_ERROR", message: "Please retry" } }, { status: 503 });
  };
  await expect(httpLearningRepository.listMissions()).rejects.toThrow("503");
  expect(calls).toEqual(["/api/me/mission-assignments"]);
});

test("mission read failure after a successful provisioning remains an error", async () => {
  globalThis.fetch = async (input) => String(input).endsWith("mission-assignments")
    ? Response.json({ provisioning: { mode: "assigned", assignedCount: 5 } })
    : Response.json({ error: { message: "Catalog unavailable" } }, { status: 502 });
  await expect(httpLearningRepository.listMissions()).rejects.toThrow("502");
});

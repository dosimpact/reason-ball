import { afterEach, expect, it, vi } from "vitest";
import { plannerMutation, plannerRequest } from "../src/shared/api/client";

afterEach(() => vi.unstubAllGlobals());

it("returns successful read results without retry", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ result: [] })),
  );
  await expect(plannerRequest({ action: "projects" })).resolves.toEqual([]);
});

it("retains the entire write payload after transport failure and waits for user retry", async () => {
  const fetch = vi
    .fn()
    .mockRejectedValueOnce(new TypeError("offline"))
    .mockResolvedValueOnce(Response.json({ result: { revision: 4 } }));
  vi.stubGlobal("fetch", fetch);
  const input = {
    action: "comment",
    requestId: "same",
    expectedRevision: 3,
    text: "original",
  };
  const retry = vi.fn(async () => {
    input.text = "changed";
    input.expectedRevision = 8;
  });
  await expect(plannerMutation(input, retry)).resolves.toEqual({ revision: 4 });
  expect(retry).toHaveBeenCalledOnce();
  expect(fetch.mock.calls[0][1].body).toBe(fetch.mock.calls[1][1].body);
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({
    text: "original",
    expectedRevision: 3,
    requestId: "same",
  });
});

it.each([
  new Response("broken", { status: 502 }),
  Response.json(
    { error: { code: "INTERNAL_ERROR", message: "failed" } },
    { status: 500 },
  ),
  Response.json(
    { error: { code: "STORAGE_WRITE_FAILED", message: "failed" } },
    { status: 400 },
  ),
  Response.json({ missing: "result" }),
])(
  "treats unknown outcomes as retryable with the original request",
  async (response) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response)
        .mockResolvedValueOnce(Response.json({ result: "ok" })),
    );
    const retry = vi.fn(async () => {});
    await expect(plannerMutation({ requestId: "same" }, retry)).resolves.toBe(
      "ok",
    );
    expect(retry).toHaveBeenCalledOnce();
  },
);

it("returns confirmed conflicts to the form without waiting for retry", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { error: { code: "REVISION_CONFLICT", message: "refresh" } },
          { status: 409 },
        ),
      ),
  );
  const retry = vi.fn(async () => {});
  await expect(
    plannerMutation({ requestId: "same" }, retry),
  ).rejects.toMatchObject({ code: "REVISION_CONFLICT", uncertain: false });
  expect(retry).not.toHaveBeenCalled();
});

it("does not wait for write retry on a read failure", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
  const retry = vi.fn(async () => {});
  await expect(plannerMutation({ action: "handoff" }, retry)).rejects.toThrow(
    "offline",
  );
  expect(retry).not.toHaveBeenCalled();
});

import { describe, expect, it, vi } from "vitest";
import { fetchFigma, parseFigmaUrl } from "../src/app/server/figma";
const url = "https://www.figma.com/design/abc123/Example?node-id=1-2";
const meta = {
  name: "Example",
  lastModified: "2026-09-15T00:00:00Z",
  version: "v1",
};
describe("Figma import boundary", () => {
  it("reads a selected node, records metadata and never stores the token", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({
          ...meta,
          nodes: {
            "1:2": { document: { id: "1:2", name: "Budget", type: "FRAME" } },
          },
        }),
      );
    const result = await fetchFigma(
      { url },
      { token: "private-test-token", fetch: request },
    );
    const [endpoint, init] = request.mock.calls[0];
    expect(String(endpoint)).toBe(
      "https://api.figma.com/v1/files/abc123/nodes?depth=2&ids=1%3A2",
    );
    expect(init).toMatchObject({
      headers: { "X-Figma-Token": "private-test-token" },
      redirect: "error",
    });
    expect(JSON.parse(result.originalText)).toMatchObject({
      requestedDepth: 2,
      nodeId: "1:2",
      response: { version: "v1" },
    });
    expect(JSON.stringify(result)).not.toContain("private-test-token");
  });
  it("supports whole files and pinned Figma versions", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ ...meta, document: { id: "0:0" } }));
    await fetchFigma(
      { url: "https://figma.com/file/abc123/Example?version-id=v1", depth: 1 },
      { token: "t", fetch: request },
    );
    expect(String(request.mock.calls[0][0])).toBe(
      "https://api.figma.com/v1/files/abc123?depth=1&version=v1",
    );
  });
  it.each([
    "http://www.figma.com/design/key",
    "https://evil.example/design/key",
    "https://www.figma.com.evil.example/design/key",
    "https://user:pass@figma.com/design/key",
    "https://figma.com:9999/design/key",
    "https://figma.com/design/key?node-id=invalid",
    "bad",
    "https://figma.com/community/file/key",
  ])("rejects unsupported URLs: %s", (value) =>
    expect(() => parseFigmaUrl(value)).toThrow(),
  );
  it("fails without a token before making an external request", async () => {
    const request = vi.fn<typeof fetch>();
    await expect(
      fetchFigma({ url }, { token: "", fetch: request }),
    ).rejects.toMatchObject({ code: "FIGMA_NOT_CONFIGURED" });
    expect(request).not.toHaveBeenCalled();
  });
  it.each([
    [403, "FIGMA_FORBIDDEN"],
    [404, "FIGMA_NOT_FOUND"],
    [429, "FIGMA_RATE_LIMITED"],
    [500, "FIGMA_UNAVAILABLE"],
  ])(
    "maps upstream %s without leaking response content",
    async (status, code) => {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response("sensitive upstream body", {
            status: Number(status),
            headers: { "Retry-After": "30" },
          }),
        );
      await expect(
        fetchFigma({ url }, { token: "t", fetch: request }),
      ).rejects.toMatchObject({ code });
      expect(request).toHaveBeenCalledTimes(1);
    },
  );
  it("reports missing nodes, malformed JSON and excessive responses", async () => {
    for (const [response, code] of [
      [
        Response.json({ ...meta, nodes: { "1:2": null } }),
        "FIGMA_NODE_NOT_FOUND",
      ],
      [new Response("{broken"), "FIGMA_RESPONSE_INVALID"],
      [Response.json({ document: {} }), "FIGMA_RESPONSE_INVALID"],
      [new Response("x".repeat(180001)), "FIGMA_TOO_LARGE"],
    ] as const)
      await expect(
        fetchFigma(
          { url },
          {
            token: "t",
            fetch: vi.fn<typeof fetch>().mockResolvedValue(response),
          },
        ),
      ).rejects.toMatchObject({ code });
  });
  it("aborts slow requests and sanitizes transport errors", async () => {
    const slow = vi
      .fn<typeof fetch>()
      .mockImplementation(
        (_url, init) =>
          new Promise((_resolve, reject) =>
            init?.signal?.addEventListener("abort", () =>
              reject(new Error("private transport data")),
            ),
          ),
      );
    await expect(
      fetchFigma({ url }, { token: "t", fetch: slow, timeoutMs: 5 }),
    ).rejects.toMatchObject({ code: "FIGMA_TIMEOUT" });
    await expect(
      fetchFigma(
        { url },
        {
          token: "t",
          fetch: vi.fn<typeof fetch>().mockRejectedValue(new Error("secret")),
        },
      ),
    ).rejects.toMatchObject({ code: "FIGMA_UNAVAILABLE" });
  });
});

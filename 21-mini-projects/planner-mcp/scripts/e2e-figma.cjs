// Only preloaded by the owned E2E server. Production has no fixture switch.
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
  );
  if (url.hostname !== "api.figma.com") return realFetch(input, init);
  if (
    new Headers(init?.headers).get("X-Figma-Token") !== "planner-e2e-fake-token"
  )
    throw new Error("E2E requires an isolated fake token");
  if (url.pathname.includes("forbidden"))
    return new Response("", { status: 403 });
  if (url.pathname.includes("limited"))
    return new Response("", { status: 429, headers: { "Retry-After": "30" } });
  if (!url.pathname.startsWith("/v1/files/fixture"))
    throw new Error("Unexpected external Figma request in E2E");
  const document = {
    id: "1:2",
    type: "FRAME",
    name: "Budget Widget",
    children: [
      {
        id: "1:3",
        type: "TEXT",
        name: "Title",
        characters: "Budget recommendation",
      },
    ],
  };
  return Response.json({
    name: "Imported Figma Fixture",
    lastModified: "2026-09-15T00:00:00Z",
    version: "fixture-v1",
    ...(url.pathname.endsWith("/nodes")
      ? { nodes: { "1:2": { document } } }
      : { document }),
  });
};

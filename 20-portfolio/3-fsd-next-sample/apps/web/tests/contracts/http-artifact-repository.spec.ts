import { expect, test } from "@playwright/test";
import { artifactFromHttp, createHttpArtifactRepository } from "../../src/entities/chat/api/http-artifact-repository";

const item = { id: "artifact-1", conversationId: "conversation-1", kind: "text" as const, title: "Note", status: "draft" as const, currentVersionId: "version-2", createdAt: "2026-09-10", updatedAt: "2026-09-11" };
const rows = [
  { id: "version-2", artifactId: item.id, versionNumber: 2, contentText: "new", contentJson: { imageUrl: "data:image/png;base64,test" }, createdAt: "2026-09-11" },
  { id: "version-1", artifactId: item.id, versionNumber: 1, contentText: "old", contentJson: null, createdAt: "2026-09-10" },
];

test("maps ordered versions and image content without mutating server rows", () => {
  const before = structuredClone(rows);
  const result = artifactFromHttp(item, rows);
  expect(result.draft).toBe("new");
  expect(result.versions.map((row) => row.id)).toEqual(["version-1", "version-2"]);
  expect(result.versions[1].imageUrl).toBe(rows[0].contentJson?.imageUrl);
  expect(rows).toEqual(before);
});

test("rejects missing current versions and versions of another artifact", () => {
  expect(() => artifactFromHttp(item, [])).toThrow("버전 정보");
  expect(() => artifactFromHttp(item, [{ ...rows[0], artifactId: "other" }])).toThrow("버전 정보");
});

test("lists only editable artifacts and loads their saved versions", async () => {
  const requests: string[] = [];
  const repo = createHttpArtifactRepository(async (url) => {
    requests.push(String(url));
    return Response.json(requests.length === 1 ? { items: [item, { ...item, id: "archived", status: "archived" }] } : { item, versions: rows });
  });
  expect(await repo.list("conversation-1")).toHaveLength(1);
  expect(requests).toEqual(["/api/artifacts?conversationId=conversation-1", "/api/artifacts/artifact-1"]);
});

test("creates using server IDs and preserves an intentionally empty editor", async () => {
  let body: unknown;
  const repo = createHttpArtifactRepository(async (_url, init) => {
    if (init?.body) body = JSON.parse(String(init.body));
    return Response.json({ item, versions: [{ ...rows[0], contentText: "", contentJson: {} }] });
  });
  const saved = await repo.create("conversation-1", "text", { title: "Note", content: "" });
  expect(body).toEqual({ requestId: expect.any(String), conversationId: "conversation-1", kind: "text", title: "Note", contentText: "", contentJson: {}, status: "draft" });
  expect(saved.id).toBe(item.id);
  expect(saved.draft).toBe("");
});

test("autosave retry does not append content already committed by the server", async () => {
  const methods: string[] = [];
  const repo = createHttpArtifactRepository(async (_url, init) => {
    methods.push(init?.method ?? "GET");
    return Response.json({ item, versions: rows });
  });
  await repo.save(item.id, { title: item.title, content: "new", imageUrl: rows[0].contentJson?.imageUrl }, item.currentVersionId);
  expect(methods).toEqual(["GET"]);
});

test("saves title and content in one revision request with the editor base version", async () => {
  const calls: { method: string; body: unknown }[] = [];
  let revisionId = item.currentVersionId;
  const repo = createHttpArtifactRepository(async (_url, init) => {
    calls.push({ method: init!.method!, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (init?.body) revisionId = JSON.parse(String(init.body)).requestId;
    return Response.json({ item: { ...item, currentVersionId: revisionId }, versions: [{ ...rows[0], id: revisionId }] });
  });
  await repo.save(item.id, { title: "Renamed", content: "edited" }, item.currentVersionId);
  expect(calls.map((call) => call.method)).toEqual(["GET", "POST", "GET"]);
  expect(calls[1].body).toMatchObject({ title: "Renamed", contentText: "edited", status: "draft", expectedVersionId: item.currentVersionId, requestId: expect.any(String) });
});

test("propagates save rejection without returning a fabricated saved version", async () => {
  let count = 0;
  const edit = { title: item.title, content: "unsaved" };
  const repo = createHttpArtifactRepository(async () => ++count === 1
    ? Response.json({ item, versions: rows })
    : Response.json({ error: { message: "Denied", code: "FORBIDDEN" } }, { status: 403 }));
  await expect(repo.save(item.id, edit, item.currentVersionId)).rejects.toMatchObject({ message: "Denied", status: 403, code: "FORBIDDEN" });
  expect(edit.content).toBe("unsaved");
  expect(count).toBe(2);
});

test("reuses a create request ID after its response is lost", async () => {
  const keys: string[] = [];
  const repo = createHttpArtifactRepository(async (_url, init) => {
    if (init?.method === "POST") {
      keys.push(JSON.parse(String(init.body)).requestId);
      if (keys.length === 1) throw new Error("response lost");
    }
    return Response.json({ item, versions: rows });
  });
  const edit = { title: item.title, content: "new" };
  await expect(repo.create(item.conversationId, "text", edit)).rejects.toThrow("response lost");
  await repo.create(item.conversationId, "text", edit);
  expect(keys[0]).toBe(keys[1]);
  await repo.create(item.conversationId, "text", edit);
  expect(keys[2]).not.toBe(keys[1]);
});

test("replays a lost save response with the same key and original base", async () => {
  const requests: { requestId: string; expectedVersionId: string }[] = [];
  let revisionId = item.currentVersionId;
  const repo = createHttpArtifactRepository(async (_url, init) => {
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      requests.push(body);
      revisionId = body.requestId;
      if (requests.length === 1) throw new Error("response lost");
    }
    return Response.json({ item: { ...item, currentVersionId: revisionId }, versions: [{ ...rows[0], id: revisionId }] });
  });
  const edit = { title: "Changed", content: "edited" };
  await expect(repo.save(item.id, edit, item.currentVersionId, true)).rejects.toThrow("response lost");
  await repo.save(item.id, edit, item.currentVersionId);
  expect(requests).toHaveLength(2);
  expect(requests[0]).toEqual(requests[1]);
  expect(requests[1].expectedVersionId).toBe(item.currentVersionId);
});

test("does not replace a stale editor base with the newly fetched server version", async () => {
  const methods: string[] = [];
  const repo = createHttpArtifactRepository(async (_url, init) => {
    methods.push(init!.method!);
    return Response.json({ item, versions: rows });
  });
  await expect(repo.save(item.id, { title: "Old edit", content: "stale" }, "version-1")).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
  expect(methods).toEqual(["GET"]);
});

test("uploads image bytes once and saves a stable Storage reference across a lost revision response", async () => {
  const image = { storageBucket: "artifact-images", storagePath: "owner/artifact/image.png" };
  const source = "data:image/png;base64,new-image";
  let uploads = 0;
  let revisionId = item.currentVersionId;
  const revisionBodies: Record<string, unknown>[] = [];
  const repo = createHttpArtifactRepository(async (url, init) => {
    if (String(url).endsWith("/image") && init?.method === "POST") {
      uploads++;
      expect(JSON.parse(String(init.body))).toEqual({ dataUrl: source });
      return Response.json({ image });
    }
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      revisionBodies.push(body);
      revisionId = body.requestId;
      if (revisionBodies.length === 1) throw new Error("lost revision response");
    }
    return Response.json({
      item: { ...item, kind: "image", currentVersionId: revisionId },
      versions: [{ ...rows[0], id: revisionId, contentJson: {}, ...(revisionBodies.length ? image : {}) }],
    });
  });
  const edit = { title: item.title, content: "Prompt", imageUrl: source };
  await expect(repo.save(item.id, edit, item.currentVersionId)).rejects.toThrow("lost revision response");
  const saved = await repo.save(item.id, edit, item.currentVersionId);
  expect(uploads).toBe(1);
  expect(revisionBodies[0]).toEqual(revisionBodies[1]);
  expect(revisionBodies[1]).toMatchObject({ ...image, contentJson: {} });
  expect(JSON.stringify(revisionBodies)).not.toContain(source);
  expect(saved.versions.at(-1)?.imageUrl).toBe(`/api/artifacts/${item.id}/versions/${revisionId}/image`);
});

test("restores Storage-backed images without persisting the access URL or reuploading", async () => {
  let revisionId = item.currentVersionId;
  const image = { storageBucket: "artifact-images", storagePath: "owner/artifact/saved.png" };
  let savedBody: Record<string, unknown> | undefined;
  const repo = createHttpArtifactRepository(async (_url, init) => {
    if (init?.method === "POST") { savedBody = JSON.parse(String(init.body)); revisionId = String(savedBody!.requestId); }
    return Response.json({ item: { ...item, kind: "image", currentVersionId: revisionId }, versions: [{ ...rows[0], id: revisionId, contentJson: {}, ...image }] });
  });
  const loaded = await repo.get(item.id);
  await repo.save(item.id, { title: item.title, content: "restored", imageUrl: loaded.versions[0].imageUrl }, item.currentVersionId, true);
  expect(savedBody).toMatchObject({ ...image, contentJson: {} });
  expect(JSON.stringify(savedBody)).not.toContain("/versions/");
});

test("refuses to save arbitrary external image URLs", async () => {
  const repo = createHttpArtifactRepository(async () => Response.json({ item, versions: rows }));
  await expect(repo.save(item.id, { title: item.title, content: "image", imageUrl: "https://untrusted.example/file.png" }, item.currentVersionId)).rejects.toThrow("이미지 경로");
});

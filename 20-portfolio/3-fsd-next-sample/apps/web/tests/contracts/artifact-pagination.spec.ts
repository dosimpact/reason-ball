import { expect, test } from "@playwright/test";
import { createHttpArtifactRepository } from "../../src/entities/chat/api/http-artifact-repository";
import { cursorPage } from "../../src/shared/lib/cursor-page";

const item = { id: "artifact-1", conversationId: "conversation-1", kind: "text", title: "Notes", status: "draft", currentVersionId: "version-1005", createdAt: "2026-09-10", updatedAt: "2026-09-10" };
const versions = Array.from({ length: 1005 }, (_, i) => ({ id: `version-${i + 1}`, artifactId: item.id, versionNumber: i + 1, contentText: `Content ${i + 1}`, contentJson: {}, createdAt: "2026-09-10" }));

test("cursor page separates look-ahead without mutating source", () => {
  const rows = [1, 2, 3];
  expect(cursorPage(rows, 2, (value) => value)).toEqual({ items: [1, 2], hasMore: true, nextCursor: 2 });
  expect(rows).toEqual([1, 2, 3]);
  expect(cursorPage([], 2, (value: number) => value)).toEqual({ items: [], hasMore: false, nextCursor: null });
  expect(cursorPage(rows, 3, (value) => value).hasMore).toBe(false);
  for (const limit of [0, -1, 201, 1.5, NaN]) expect(() => cursorPage(rows, limit, (value) => value)).toThrow(RangeError);
});

test("restores over 1000 versions while keeping the first response snapshot", async () => {
  const cursors: number[] = [];
  const repo = createHttpArtifactRepository(async (url) => {
    const parsed = new URL(String(url), "http://test");
    const after = Number(parsed.searchParams.get("after") ?? 0);
    cursors.push(after);
    if (after) expect(parsed.searchParams.get("snapshotVersionId")).toBe(item.currentVersionId);
    const page = cursorPage(versions.slice(after, after + 101), 100, (row) => row.versionNumber);
    return Response.json({ item, versions: page.items, hasMore: page.hasMore, nextCursor: page.nextCursor, snapshotVersionId: item.currentVersionId });
  });
  const restored = await repo.get(item.id);
  expect(restored.versions).toHaveLength(1005);
  expect(restored.versions[0].content).toBe("Content 1");
  expect(restored.draft).toBe("Content 1005");
  expect(cursors).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
});

test("rejects a changed snapshot and a non-advancing version cursor", async () => {
  const stalled = createHttpArtifactRepository(async () => Response.json({ item, versions: [versions[0]], hasMore: true, nextCursor: 0, snapshotVersionId: item.currentVersionId }));
  await expect(stalled.get(item.id)).rejects.toThrow("다음 페이지");
  let count = 0;
  const changed = createHttpArtifactRepository(async () => Response.json(++count === 1
    ? { item, versions: [versions[0]], hasMore: true, nextCursor: 1, snapshotVersionId: item.currentVersionId }
    : { versions: [versions[1]], hasMore: false, snapshotVersionId: "new-snapshot" }));
  await expect(changed.get(item.id)).rejects.toThrow("기준 버전");
});

test("does not mix versions newer than the editor snapshot into restored history", async () => {
  const repo = createHttpArtifactRepository(async () => Response.json({ item: { ...item, currentVersionId: "version-1" }, versions: versions.slice(0, 2), hasMore: false }));
  await expect(repo.get(item.id)).rejects.toThrow("버전 정보");
});

test("loads every artifact page and presents recently updated artifacts first", async () => {
  const paths: string[] = [];
  const second = { ...item, id: "artifact-2", currentVersionId: "second-version", updatedAt: "2026-09-11" };
  const repo = createHttpArtifactRepository(async (url) => {
    const path = String(url);
    paths.push(path);
    if (path.includes("?conversationId=")) return Response.json(path.includes("&after=")
      ? { items: [second], hasMore: false, nextCursor: null }
      : { items: [item], hasMore: true, nextCursor: item.id });
    const selected = path.endsWith(second.id) ? second : item;
    return Response.json({ item: selected, versions: [{ ...versions[0], artifactId: selected.id, id: selected.currentVersionId }], hasMore: false });
  });
  expect((await repo.list(item.conversationId)).map((artifact) => artifact.id)).toEqual([second.id, item.id]);
  expect(paths).toContain("/api/artifacts?conversationId=conversation-1&after=artifact-1");
});

test("rejects repeated artifact pages and does not return a partial list", async () => {
  const repo = createHttpArtifactRepository(async () => Response.json({ items: [item], hasMore: true, nextCursor: item.id }));
  await expect(repo.list(item.conversationId)).rejects.toThrow("페이지가 반복");
});

test("propagates a later page failure instead of silently dropping older history", async () => {
  let count = 0;
  const repo = createHttpArtifactRepository(async () => ++count === 1
    ? Response.json({ item, versions: [versions[0]], hasMore: true, nextCursor: 1, snapshotVersionId: item.currentVersionId })
    : Response.json({ error: { message: "Unavailable", code: "DATA_SERVICE_ERROR" } }, { status: 503 }));
  await expect(repo.get(item.id)).rejects.toMatchObject({ status: 503 });
});

test("bounds artifact detail requests to four in flight", async () => {
  const items = Array.from({ length: 9 }, (_, i) => ({ ...item, id: `artifact-${i}`, currentVersionId: `saved-${i}` }));
  let active = 0;
  let maximum = 0;
  const repo = createHttpArtifactRepository(async (url) => {
    if (String(url).includes("?conversationId=")) return Response.json({ items, hasMore: false });
    active++;
    maximum = Math.max(maximum, active);
    await Promise.resolve();
    const selected = items.find((value) => String(url).endsWith(value.id))!;
    active--;
    return Response.json({ item: selected, versions: [{ ...versions[0], id: selected.currentVersionId, artifactId: selected.id }] });
  });
  expect(await repo.list(item.conversationId)).toHaveLength(9);
  expect(maximum).toBe(4);
  expect(active).toBe(0);
});

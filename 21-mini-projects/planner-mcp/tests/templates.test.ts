import { afterEach, beforeEach, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PlannerStore } from "../src/app/server/store";
import type { TemplateDraft } from "../src/entities/template/model/schema";
let root: string, store: PlannerStore;
const draft: TemplateDraft = {
  name: "api-design",
  title: "API 설계",
  description: "API 템플릿",
  format: "markdown",
  body: "# {{title}}\n```mermaid\nflowchart LR\n A-->B\n```",
  example: "# 조회 API",
  prompt: "입력 근거를 확인하고 작성하세요.",
};
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "planner-templates-"));
  store = await PlannerStore.open(root, 0);
});
afterEach(async () => {
  await store.close();
  await rm(root, { recursive: true, force: true });
});
it("persists templates and prompts and replays requests after restart", async () => {
  expect(await store.templates.list()).toEqual([]);
  const saved = await store.templates.save("create", draft);
  expect(saved).toMatchObject({ ...draft, revision: 1 });
  await store.close();
  store = await PlannerStore.open(root, 0);
  expect(await store.templates.get(draft.name)).toEqual(saved);
  expect(await store.templates.save("create", draft)).toEqual(saved);
  await expect(
    store.templates.save("create", { ...draft, prompt: "different" }),
  ).rejects.toMatchObject({ code: "REQUEST_ID_CONFLICT" });
  const updated = await store.templates.save(
    "edit",
    { ...draft, prompt: "수정한 사용 지침" },
    1,
  );
  expect(updated.revision).toBe(2);
  expect((await store.templates.list())[0].prompt).toBe("수정한 사용 지침");
});
it("rejects duplicate names, stale writes and ABA after deletion/recreation", async () => {
  await store.templates.save("create", draft);
  await expect(store.templates.save("duplicate", draft)).rejects.toMatchObject({
    code: "TEMPLATE_NAME_CONFLICT",
  });
  const writes = await Promise.allSettled([
    store.templates.save("a", { ...draft, title: "A" }, 1),
    store.templates.save("b", { ...draft, title: "B" }, 1),
  ]);
  expect(writes.map((w) => w.status)).toEqual(["fulfilled", "rejected"]);
  await expect(
    store.templates.delete("stale-delete", draft.name, 1),
  ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  const deleted = await store.templates.delete("delete", draft.name, 2);
  expect(deleted.revision).toBe(3);
  expect(await store.templates.list()).toEqual([]);
  await expect(store.templates.get(draft.name)).rejects.toMatchObject({
    code: "TEMPLATE_NOT_FOUND",
  });
  expect(await store.templates.delete("delete", draft.name, 2)).toEqual(
    deleted,
  );
  const recreated = await store.templates.save("recreate", draft);
  expect(recreated.revision).toBe(4);
  await expect(
    store.templates.save("old-edit", draft, 1),
  ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
});
it("rejects unsupported formats, unsafe names, blank fields and oversized input", async () => {
  for (const invalid of [
    { name: "../escape" },
    { name: "UPPER" },
    { format: "react-flow" },
    { body: " " },
    { prompt: " " },
    { example: "x".repeat(200001) },
  ]) {
    await expect(
      store.templates.save("invalid", {
        ...draft,
        ...invalid,
      } as TemplateDraft),
    ).rejects.toMatchObject({ code: "SCHEMA_INVALID" });
  }
  expect(await store.templates.list()).toEqual([]);
  await expect(store.templates.get("../escape")).rejects.toMatchObject({
    code: "SCHEMA_INVALID",
  });
});
it("emits template events for writes and external changes, surfaces corrupt files", async () => {
  const events: unknown[] = [];
  store.events.on("templates", (e) => events.push(e));
  const saved = await store.templates.save("create", draft);
  expect(events).toHaveLength(1);
  await store.scan();
  expect(events).toHaveLength(1);
  const file = path.join(root, "templates", `${draft.name}.json`);
  await writeFile(file, JSON.stringify({ ...saved, prompt: "external" }));
  await store.scan();
  expect(events).toHaveLength(2);
  expect((await store.templates.get(draft.name)).prompt).toBe("external");
  await writeFile(file, "broken");
  await store.scan();
  expect(events).toHaveLength(3);
  await expect(store.templates.list()).rejects.toMatchObject({
    code: "TEMPLATE_CORRUPT",
  });
  await expect(
    store.templates.save("unsafe-overwrite", draft, 1),
  ).rejects.toMatchObject({ code: "TEMPLATE_CORRUPT" });
});

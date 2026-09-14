import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonRepository } from "../../src/server/storage/json-repository";
import { TodoService } from "../../src/server/core/todo-service";
import { TodoEvents } from "../../src/server/events/todo-events";
let dir: string, file: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "todo-unit-"));
  file = join(dir, "todos.json");
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});
test("initialization, concurrent mutations and reopening preserve all changes", async () => {
  const events = new TodoEvents();
  const listener = vi.fn();
  const unsubscribe = events.subscribe(listener);
  const service = new TodoService(new JsonRepository(file), events);
  expect((await service.list()).todos).toEqual([]);
  const [a, b] = await Promise.all([
    service.create({ title: " A " }),
    service.create({ title: "B" }),
  ]);
  await Promise.all([
    service.update(a.todo.id, { completed: true }),
    service.update(b.todo.id, { title: "C" }),
  ]);
  const stored = await new JsonRepository(file).read();
  expect(stored.revision).toBe(4);
  expect(stored.todos.find((t) => t.id === a.todo.id)?.completed).toBe(true);
  expect(stored.todos.find((t) => t.id === b.todo.id)?.title).toBe("C");
  await service.delete(a.todo.id);
  await expect(service.get(a.todo.id)).rejects.toThrow("not found");
  expect(listener.mock.calls.map((c) => c[0].revision)).toEqual([
    1, 2, 3, 4, 5,
  ]);
  unsubscribe();
});
test("corrupt JSON is not overwritten", async () => {
  await writeFile(file, "{broken");
  const service = new TodoService(new JsonRepository(file), new TodoEvents());
  await expect(service.create({ title: "A" })).rejects.toThrow();
  expect(await readFile(file, "utf8")).toBe("{broken");
});
test("failed save publishes nothing and preserves disk; queue recovers", async () => {
  const initial = new TodoService(new JsonRepository(file), new TodoEvents());
  const { todo } = await initial.create({ title: "A" });
  const events = new TodoEvents();
  const listener = vi.fn();
  events.subscribe(listener);
  const service = new TodoService(
    new JsonRepository(file, async () => {
      throw new Error("disk full");
    }),
    events,
  );
  await expect(service.update(todo.id, { title: "B" })).rejects.toThrow(
    "disk full",
  );
  expect(listener).not.toHaveBeenCalled();
  expect((await service.get(todo.id)).todo.title).toBe("A");
});
